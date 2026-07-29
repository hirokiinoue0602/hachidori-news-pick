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
    "サステナブル OR サステナビリティ OR SDGs OR 持続可能",
  ],
  ["社会・地域", "社会課題 OR 地域共創 OR ソーシャルビジネス OR 寄付"],
  [
    "自然・生物多様性",
    "生物多様性 OR ネイチャーポジティブ OR 自然再生 OR 森林保全 OR 海洋保全",
  ],
  [
    "循環・エシカル",
    "サーキュラーエコノミー OR 循環型社会 OR 資源循環 OR エシカル消費 OR リユース OR フードロス",
  ],
  [
    "移動・まちづくり",
    "電気自動車 再エネ OR EV充電 脱炭素 OR V2H OR 脱炭素まちづくり OR ゼロカーボンシティ",
  ],
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
      "持続可能",
      "sdgs",
      "esg",
      "環境配慮",
      "グリーン購入",
    ],
  ],
  [
    "自然・生物多様性",
    4,
    [
      "生物多様性",
      "ネイチャーポジティブ",
      "自然再生",
      "森林保全",
      "海洋保全",
      "環境保全",
      "生態系",
      "絶滅危惧",
      "ブルーカーボン",
    ],
  ],
  [
    "循環・エシカル",
    4,
    [
      "サーキュラーエコノミー",
      "循環型",
      "資源循環",
      "エシカル",
      "リユース",
      "リサイクル",
      "フードロス",
      "アップサイクル",
      "食品ロス",
      "脱プラ",
    ],
  ],
  [
    "移動・まちづくり",
    5,
    [
      "電気自動車",
      "ev充電",
      "充電インフラ",
      "v2h",
      "v2g",
      "ゼロカーボンシティ",
      "脱炭素まちづくり",
      "スマートシティ",
      "グリーンスローモビリティ",
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
  "連携",
  "開発",
  "拡大",
  "削減",
  "保全",
  "再生",
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
  "株価",
  "注目銘柄",
  "投資判断",
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
const categoryOrder = queries.map(([category]) => category);
const items = selectDiversified(scored, 24, 3, categoryOrder).map(addPostDrafts);

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
    const normalized = item.title
      .toLowerCase()
      .replace(/[\s　「」『』【】（）()・、。,:：!！?？\-–—_|｜]/g, "");
    const key =
      normalized.length > 45 ? normalized.slice(0, 45) : normalized;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectDiversified(items, limit, firstPassPerCategory, categoryOrder) {
  const selected = [];
  const selectedIds = new Set();
  const buckets = new Map(
    categoryOrder.map((category) => [
      category,
      items.filter((item) => item.category === category),
    ]),
  );

  for (let round = 0; round < firstPassPerCategory; round += 1) {
    for (const category of categoryOrder) {
      const item = buckets.get(category)?.[round];
      if (!item) continue;
      selected.push(item);
      selectedIds.add(item.id);
      if (selected.length >= limit) return selected;
    }
  }

  for (const item of items) {
    if (selectedIds.has(item.id)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

function addPostDrafts(item) {
  const summary = buildSummary(item);
  return {
    ...item,
    summary,
    xPost: buildXPost(item),
    linePost: buildLinePost(item, summary),
  };
}

function buildSummary(item) {
  const terms = item.matchedTerms.slice(0, 2).join("・");
  return `${item.source}が報じた、${terms || item.category}に関するニュースです。`;
}

function buildXPost(item) {
  const bridge = {
    再エネ: "再エネをもっと身近にするために、いま知っておきたい動きです。",
    "電力・暮らし":
      "毎日の電気と、これからの暮らしを考えるきっかけになりそうです。",
    "脱炭素・気候":
      "気候変動を止める一歩として、注目したいニュースです。",
    サステナブル:
      "地球にも人にもやさしい選択を広げるヒントがありそうです。",
    "社会・地域":
      "地域や社会をより良くする取り組みとして注目です。",
    "自然・生物多様性":
      "身近な自然や生きものを未来へ残すために、知っておきたい動きです。",
    "循環・エシカル":
      "ものの選び方や使い方を見直すヒントとして注目したいニュースです。",
    "移動・まちづくり":
      "移動とまちのしくみを、地球にやさしく変える動きとして注目です。",
  }[item.category];
  const hashtags = {
    再エネ: "#再生可能エネルギー #ハチドリ電力",
    "電力・暮らし": "#電気のある暮らし #ハチドリ電力",
    "脱炭素・気候": "#脱炭素 #ハチドリ電力",
    サステナブル: "#サステナブル #ハチドリ電力",
    "社会・地域": "#社会にやさしい #ハチドリ電力",
    "自然・生物多様性": "#生物多様性 #ハチドリ電力",
    "循環・エシカル": "#エシカル #ハチドリ電力",
    "移動・まちづくり": "#脱炭素まちづくり #ハチドリ電力",
  }[item.category];
  const brandComment = {
    再エネ:
      "毎日使う電気を選び直す。そんな小さな選択が、自然エネルギーを広げる力になります。",
    "電力・暮らし":
      "毎日使う電気を選ぶことから、大切なものを未来へ守りつないでいけます。",
    "脱炭素・気候":
      "大きな気候課題も、毎日の電気という身近な選択から一緒に変えていけます。",
    サステナブル:
      "一人ひとりの小さな選択を集め、地球にも社会にもやさしい未来をつくります。",
    "社会・地域":
      "毎日の電気を、地域や社会の大切なものを守りつなぐ力に変えていきます。",
    "自然・生物多様性":
      "好きな景色や生きものを未来へ守りつなぐことも、毎日の電気の選択とつながっています。",
    "循環・エシカル":
      "一人ひとりの選択を集め、資源も想いも大切にめぐる未来を一緒につくります。",
    "移動・まちづくり":
      "電気の選び方から、移動もまちも地球にやさしい未来へつないでいきます。",
  }[item.category];
  const beforeTitle = "🌏 気になるニュース\n\n「";
  const afterTitle = `」\n\n${bridge || "地球や社会にやさしい未来を考えるニュースです。"}\n\n🐦 ハチドリ電力から\n${brandComment || "毎日使う電気を選ぶことから、大切なものを未来へ守りつなぎます。"}\n\n${hashtags || "#ハチドリ電力"}\n`;
  const titleLimit = Math.max(
    24,
    247 - [...beforeTitle].length - [...afterTitle].length,
  );
  const title = truncateInline(item.title, titleLimit);
  return `${beforeTitle}${title}${afterTitle}${item.url}`;
}

function buildLinePost(item, summary) {
  const bridge = {
    再エネ:
      "電気を選ぶことは、未来のエネルギーを選ぶこと。再エネを暮らしの中でもっと身近にする視点で注目したいニュースです。",
    "電力・暮らし":
      "毎日使う電気だからこそ、そのつくられ方や使い方を知ることが大切です。暮らしからできる選択を考えるきっかけになります。",
    "脱炭素・気候":
      "気候変動は遠い話ではなく、私たちの暮らしにもつながるテーマです。できることを一つずつ増やす視点で注目したいニュースです。",
    サステナブル:
      "日々の小さな選択が、地球にも人にもやさしい未来につながります。身近な行動に置き換えて考えたいニュースです。",
    "社会・地域":
      "地域や社会の課題は、つながりと選択で変えていけます。より良い循環を生み出す動きとして注目したいニュースです。",
    "自然・生物多様性":
      "好きな景色や生きものも、未来へ守りつなぎたい大切なものです。自然と毎日の暮らしのつながりを考えるきっかけになります。",
    "循環・エシカル":
      "ものを選び、使い、次へつなぐことも、暮らしからできる小さな選択です。資源が大切にめぐる未来につながる動きとして注目です。",
    "移動・まちづくり":
      "電気は家の中だけでなく、移動やまちのしくみにもつながっています。地球にやさしい暮らしの選択肢を広げる視点で注目したいニュースです。",
  }[item.category];

  return `【今日のニュースピック🌱】\n\n${item.title}\n\n${summary}\n\n💡 ハチドリとの接点\n${bridge || "地球や社会にやさしい未来につながる視点で注目したいニュースです。"}\n\nみなさんは、このニュースをどう感じましたか？\n\n▼元記事\n${item.url}`;
}

function truncateInline(value, maxLength) {
  const characters = [...value];
  if (characters.length <= maxLength) return value;
  return `${characters.slice(0, Math.max(0, maxLength - 1)).join("").trim()}…`;
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result.toString(36);
}
