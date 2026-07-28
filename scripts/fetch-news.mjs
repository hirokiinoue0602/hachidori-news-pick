import { writeFile } from "node:fs/promises";

const queries = [
  ["再エネ", "再生可能エネルギー OR 再エネ OR 自然エネルギー OR 蓄電池"],
  ["電力・暮らし", "電力 OR 電気料金 OR 省エネ OR 電力自由化"],
  [
    "脱炭素・気候",
    "脱炭素 OR 気候変動 OR カーボンニュートラル OR CO2削減",
  ],
  [
    "サステナブル",
    "サステナブル OR 循環型社会 OR 生物多様性 OR エシカル",
  ],
  ["社会・地域", "社会課題 OR 地域共創 OR ソーシャルビジネス OR 寄付"],
];

const topicRules = [
  [
    "再エネ",
    5,
    [
      "再生可能エネルギー",
      "自然エネルギー",
      "再エネ",
      "太陽光",
      "風力",
      "地熱",
      "小水力",
      "蓄電池",
      "非化石",
    ],
  ],
  [
    "電力・暮らし",
    4,
    [
      "電力",
      "電気",
      "電気料金",
      "電気代",
      "省エネ",
      "節電",
      "電力自由化",
      "電力需給",
      "系統",
    ],
  ],
  [
    "脱炭素・気候",
    4,
    [
      "脱炭素",
      "気候変動",
      "カーボンニュートラル",
      "co2",
      "温室効果ガス",
      "ネットゼロ",
      "ゼロカーボン",
      "gx",
    ],
  ],
  [
    "サステナブル",
    3,
    [
      "サステナブル",
      "サステナビリティ",
      "循環型",
      "資源循環",
      "生物多様性",
      "エシカル",
      "リユース",
      "リサイクル",
      "フードロス",
      "環境保全",
    ],
  ],
  [
    "社会・地域",
    3,
    [
      "社会課題",
      "社会貢献",
      "地域共創",
      "地域循環",
      "地域脱炭素",
      "自治体",
      "寄付",
      "npo",
      "ngo",
      "ソーシャルビジネス",
    ],
  ],
];

const actionTerms = [
  "開始",
  "発表",
  "導入",
  "実証",
  "国内初",
  "世界初",
  "制度",
  "採択",
  "支援",
  "調査",
];

const negativeTerms = [
  "人事異動",
  "採用情報",
  "求人",
  "決算短信",
  "株主総会",
  "プレゼントキャンペーン",
  "ウェビナー",
  "有料セミナー",
];

const results = await Promise.allSettled(
  queries.map(([category, query]) => fetchQuery(category, query)),
);
const warnings = [];
const collected = [];

results.forEach((result, index) => {
  if (result.status === "fulfilled") {
    collected.push(...result.value);
  } else {
    warnings.push(`${queries[index][0]}を取得できませんでした`);
  }
});

if (collected.length === 0) {
  throw new Error("すべてのニュース取得に失敗しました");
}

const now = Date.now();
const scored = dedupeNews(collected)
  .filter((item) => {
    const published = new Date(item.publishedAt).getTime();
    return Number.isFinite(published) && now - published <= 72 * 60 * 60 * 1000;
  })
  .map((item) => scoreItem(item, now))
  .filter((item) => item.score >= 7)
  .sort(
    (a, b) =>
      b.score - a.score ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
const items = selectDiversified(scored, 24, 4);

await writeFile(
  new URL("../site/news.json", import.meta.url),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      items,
      warnings,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Updated ${items.length} news items`);

async function fetchQuery(queryCategory, query) {
  const encoded = encodeURIComponent(`${query} when:3d`);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=ja&gl=JP&ceid=JP:ja`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "HachidoriNewsPick/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseRss(await response.text(), queryCategory);
}

function parseRss(xml, queryCategory) {
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .map((block) => {
      const source = extractTag(block, "source");
      const title = cleanTitle(extractTag(block, "title"), source);
      const url = extractTag(block, "link");
      const date = new Date(extractTag(block, "pubDate"));
      return {
        title,
        url,
        source: source || "配信元不明",
        publishedAt: Number.isNaN(date.getTime()) ? "" : date.toISOString(),
        queryCategory,
      };
    })
    .filter((item) => item.title && item.url && item.publishedAt);
}

function extractTag(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"),
  );
  return match ? stripMarkup(match[1]) : "";
}

function stripMarkup(value) {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name] ?? match);
}

function cleanTitle(title, source) {
  if (!source) return title.trim();
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title
    .replace(new RegExp(`\\s+[-–—｜|]\\s*${escaped}$`, "i"), "")
    .trim();
}

function scoreItem(item, now) {
  const text = item.title.toLowerCase();
  const matches = topicRules.map(([category, points, terms]) => {
    const matched = terms.filter((term) => text.includes(term.toLowerCase()));
    return {
      category,
      terms: matched,
      points: Math.min(15, matched.length * points),
    };
  });
  const best = matches
    .filter((match) => match.terms.length)
    .sort((a, b) => b.points - a.points)[0];
  const actions = actionTerms.filter((term) => text.includes(term.toLowerCase()));
  const matchedTerms = [...new Set(matches.flatMap((match) => match.terms).concat(actions))];
  const topicScore = matches.reduce((sum, match) => sum + match.points, 0);
  const negativeScore = Math.min(
    12,
    negativeTerms.filter((term) => text.includes(term.toLowerCase())).length * 6,
  );
  const ageHours = (now - new Date(item.publishedAt).getTime()) / 3_600_000;
  const freshnessScore = ageHours <= 24 ? 3 : ageHours <= 48 ? 1 : 0;
  const officialScore = /環境省|経済産業省|資源エネルギー庁/.test(item.source)
    ? 3
    : 0;

  return {
    ...item,
    id: hash(`${item.url}|${item.title}`),
    category: best?.category ?? item.queryCategory,
    score:
      topicScore +
      Math.min(4, actions.length * 2) +
      freshnessScore +
      officialScore +
      1 -
      negativeScore,
    matchedTerms: matchedTerms.length ? matchedTerms : [item.queryCategory],
  };
}

function dedupeNews(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title
      .toLowerCase()
      .replace(/[\s　「」『』【】（）()・、。,:：!！?？\-–—_|｜]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectDiversified(items, limit, firstPassPerCategory) {
  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = new Map();

  for (const item of items) {
    if ((categoryCounts.get(item.category) ?? 0) >= firstPassPerCategory) continue;
    selected.push(item);
    selectedIds.add(item.id);
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
    if (selected.length >= limit) return selected;
  }

  for (const item of items) {
    if (selectedIds.has(item.id)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result.toString(36);
}
