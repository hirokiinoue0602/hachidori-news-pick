const state = {
  data: null,
  sort: "recommended",
  loading: true,
};

const elements = {
  section: document.querySelector("#news-section"),
  refresh: document.querySelector("#refresh"),
  refreshIcon: document.querySelector("#refresh-icon"),
  refreshLabel: document.querySelector("#refresh-label"),
  updatedAt: document.querySelector("#updated-at"),
  resultCount: document.querySelector("#result-count"),
  warning: document.querySelector("#warning"),
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  empty: document.querySelector("#empty"),
  grid: document.querySelector("#news-grid"),
  sort: document.querySelector("#sort"),
  dialog: document.querySelector("#draft-dialog"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogTitle: document.querySelector("#dialog-article-title"),
  dialogSource: document.querySelector("#dialog-source"),
  xDraft: document.querySelector("#x-draft"),
  lineDraft: document.querySelector("#line-draft"),
  xCharacterCount: document.querySelector("#x-character-count"),
  copyToast: document.querySelector("#copy-toast"),
  copyButtons: [...document.querySelectorAll("[data-copy-target]")],
};

const directSearches = [
  [
    "再エネ",
    "https://news.google.com/search?q=%E5%86%8D%E7%94%9F%E5%8F%AF%E8%83%BD%E3%82%A8%E3%83%8D%E3%83%AB%E3%82%AE%E3%83%BC&hl=ja&gl=JP&ceid=JP%3Aja",
  ],
  [
    "電力",
    "https://news.google.com/search?q=%E9%9B%BB%E5%8A%9B%20%E9%9B%BB%E6%B0%97%E6%96%99%E9%87%91&hl=ja&gl=JP&ceid=JP%3Aja",
  ],
  [
    "サステナブル",
    "https://news.google.com/search?q=%E3%82%B5%E3%82%B9%E3%83%86%E3%83%8A%E3%83%96%E3%83%AB&hl=ja&gl=JP&ceid=JP%3Aja",
  ],
];

elements.sort.addEventListener("change", () => {
  state.sort = elements.sort.value;
  render();
});

elements.refresh.addEventListener("click", () => loadNews());

elements.dialogClose.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});
elements.copyButtons.forEach((button) => {
  button.addEventListener("click", () => copyDraft(button));
});

renderLoadingRows();
loadNews();

async function loadNews() {
  setLoading(true);
  try {
    const response = await fetch(`./news.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("fetch failed");
    const payload = await response.json();
    if (!Array.isArray(payload.items)) throw new Error("invalid payload");
    state.data = payload;
    render();
  } catch {
    renderError();
  } finally {
    setLoading(false);
  }
}

function setLoading(value) {
  state.loading = value;
  elements.section.setAttribute("aria-busy", String(value));
  elements.refresh.disabled = value;
  elements.refreshIcon.classList.toggle("spinning", value);
  elements.refreshLabel.textContent = value ? "更新中" : "最新に更新";
  elements.loading.hidden = !value;
  if (value) {
    elements.error.hidden = true;
    elements.empty.hidden = true;
    elements.grid.hidden = true;
    elements.resultCount.textContent = "ニュースを探しています";
  }
}

function render() {
  if (!state.data) return;
  const filtered = [...state.data.items];

  filtered.sort((a, b) => {
    if (state.sort === "newest") {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    }
    return (
      b.score - a.score ||
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );
  });

  elements.updatedAt.textContent = state.data.generatedAt
    ? `${formatDate(state.data.generatedAt)} 更新`
    : "更新時刻不明";
  elements.resultCount.textContent = `${filtered.length}件を表示`;
  elements.warning.textContent = state.data.warnings?.length
    ? "一部の配信元は取得待ちです"
    : "";
  elements.error.hidden = true;
  elements.loading.hidden = true;
  elements.empty.hidden = filtered.length > 0;
  elements.grid.hidden = filtered.length === 0;
  elements.grid.replaceChildren(...filtered.map(createListItem));
}

function createListItem(item, index) {
  const article = el("article", "news-item");
  const topLine = el("div", "card-topline");
  topLine.append(
    textEl("span", "card-index", String(index + 1).padStart(2, "0")),
    recommendationBadge(item.score),
    textEl("span", "card-category", item.category),
  );

  const heading = el("h2");
  const titleLink = link(item.url, item.title);
  heading.append(titleLink);

  const sourceLine = el("div", "source-line");
  sourceLine.append(
    textEl("span", "", item.source),
    textEl("time", "", formatDate(item.publishedAt)),
  );
  sourceLine.querySelector("time").dateTime = item.publishedAt;

  const summary = textEl(
    "p",
    "article-summary",
    item.summary || buildSummary(item),
  );

  const matchArea = el("div", "match-area");
  const termList = el("div", "term-list");
  item.matchedTerms.slice(0, 3).forEach((term) => {
    termList.append(textEl("span", "", term));
  });
  matchArea.append(termList);

  const actions = el("div", "item-actions");
  const draftButton = textEl("button", "draft-button", "投稿案を見る");
  draftButton.type = "button";
  draftButton.addEventListener("click", () => openDraftDialog(item));

  const articleLink = link(item.url, "元記事を読む ↗");
  articleLink.className = "article-link";
  articleLink.setAttribute("aria-label", `${item.title}の元記事を読む`);

  actions.append(draftButton, articleLink);
  const content = el("div", "item-content");
  content.append(topLine, heading, sourceLine, summary, matchArea);
  article.append(
    textEl("span", "list-index", String(index + 1).padStart(2, "0")),
    content,
    actions,
  );
  return article;
}

function recommendationBadge(score) {
  const badge = el("span", "recommendation");
  if (score >= 18) {
    badge.classList.add("best");
    badge.textContent = "特におすすめ";
  } else if (score >= 12) {
    badge.classList.add("good");
    badge.textContent = "おすすめ";
  } else {
    badge.classList.add("related");
    badge.textContent = "関連ニュース";
  }
  return badge;
}

function renderLoadingRows() {
  for (let index = 0; index < 6; index += 1) {
    const row = el("div", "news-item loading-card");
    row.append(
      el("span", "loading-line short"),
      el("span", "loading-block"),
      el("span", "loading-line action"),
    );
    const block = row.querySelector(".loading-block");
    block.append(
      el("span", "loading-line title"),
      el("span", "loading-line title second"),
      el("span", "loading-line meta"),
    );
    elements.loading.append(row);
  }
}

function openDraftDialog(item) {
  const xPost = item.xPost || buildXPost(item);
  const linePost = item.linePost || buildLinePost(item);
  elements.dialogTitle.textContent = item.title;
  elements.dialogSource.textContent = `${item.source} · ${formatDate(item.publishedAt)}`;
  elements.xDraft.value = xPost;
  elements.lineDraft.value = linePost;
  elements.xCharacterCount.textContent = `投稿時 約${estimateXLength(xPost, item.url)}文字`;
  elements.dialog.showModal();
}

async function copyDraft(button) {
  const target = document.querySelector(`#${button.dataset.copyTarget}`);
  if (!target) return;

  try {
    await navigator.clipboard.writeText(target.value);
  } catch {
    target.focus();
    target.select();
    document.execCommand("copy");
    target.setSelectionRange(0, 0);
  }

  const originalLabel = button.textContent;
  button.textContent = "コピーしました ✓";
  button.classList.add("copied");
  elements.copyToast.hidden = false;
  window.clearTimeout(copyDraft.toastTimer);
  copyDraft.toastTimer = window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("copied");
    elements.copyToast.hidden = true;
  }, 1800);
}

function buildSummary(item) {
  const terms = item.matchedTerms.slice(0, 2).join("・");
  return `${item.source}が報じた、${terms || item.category}に関するニュースです。`;
}

function buildXPost(item) {
  const bridge = shortBridge(item.category);
  const hashtags = categoryHashtags(item.category);
  const prefix = `🌏 気になるニュース\n\n「${item.title}」\n\n${bridge}\n\n${hashtags}\n`;
  return `${truncate(prefix, 247)}${item.url}`;
}

function buildLinePost(item) {
  return `【今日のニュースピック🌱】\n\n${item.title}\n\n${buildSummary(item)}\n\n💡 ハチドリとの接点\n${longBridge(item.category)}\n\nみなさんは、このニュースをどう感じましたか？\n\n▼元記事\n${item.url}`;
}

function shortBridge(category) {
  return {
    再エネ: "再エネをもっと身近にするために、いま知っておきたい動きです。",
    "電力・暮らし": "毎日の電気と、これからの暮らしを考えるきっかけになりそうです。",
    "脱炭素・気候": "気候変動を止める一歩として、注目したいニュースです。",
    サステナブル: "地球にも人にもやさしい選択を広げるヒントがありそうです。",
    "社会・地域": "地域や社会をより良くする取り組みとして注目です。",
  }[category] || "地球や社会にやさしい未来を考えるニュースです。";
}

function longBridge(category) {
  return {
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
  }[category] || "地球や社会にやさしい未来につながる視点で注目したいニュースです。";
}

function categoryHashtags(category) {
  return {
    再エネ: "#再生可能エネルギー #ハチドリ電力",
    "電力・暮らし": "#電気のある暮らし #ハチドリ電力",
    "脱炭素・気候": "#脱炭素 #ハチドリ電力",
    サステナブル: "#サステナブル #ハチドリ電力",
    "社会・地域": "#社会にやさしい #ハチドリ電力",
  }[category] || "#ハチドリ電力";
}

function truncate(value, maxLength) {
  const characters = [...value];
  if (characters.length <= maxLength) return value;
  return `${characters.slice(0, Math.max(0, maxLength - 2)).join("").trim()}…\n`;
}

function estimateXLength(post, url) {
  return [...post].length - [...url].length + 23;
}

function renderError() {
  elements.loading.hidden = true;
  elements.grid.hidden = true;
  elements.empty.hidden = true;
  elements.error.hidden = false;
  elements.resultCount.textContent = "ニュースを読み込めませんでした";

  const messageArea = el("div");
  messageArea.append(
    textEl(
      "p",
      "",
      "いまニュースを読み込めません。少し待ってから、もう一度お試しください。",
    ),
  );
  const retry = textEl("button", "", "もう一度読み込む");
  retry.type = "button";
  retry.addEventListener("click", () => loadNews());
  messageArea.append(retry);

  const searches = el("div", "direct-searches");
  searches.append(textEl("span", "", "今すぐ直接チェック"));
  directSearches.forEach(([label, href]) => {
    searches.append(link(href, `${label} ↗`));
  });
  elements.error.replaceChildren(messageArea, searches);
}

function link(href, label) {
  const anchor = textEl("a", "", label);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function textEl(tag, className, value) {
  const element = el(tag, className);
  element.textContent = value;
  return element;
}

function el(tag, className = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
