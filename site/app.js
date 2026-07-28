const state = {
  data: null,
  category: "すべて",
  sort: "recommended",
  loading: true,
};

const elements = {
  section: document.querySelector("#news-section"),
  refresh: document.querySelector("#refresh"),
  refreshIcon: document.querySelector("#refresh-icon"),
  refreshLabel: document.querySelector("#refresh-label"),
  itemCount: document.querySelector("#item-count"),
  updatedAt: document.querySelector("#updated-at"),
  resultCount: document.querySelector("#result-count"),
  warning: document.querySelector("#warning"),
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  empty: document.querySelector("#empty"),
  grid: document.querySelector("#news-grid"),
  sort: document.querySelector("#sort"),
  showAll: document.querySelector("#show-all"),
  categoryButtons: [...document.querySelectorAll("[data-category]")],
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

elements.categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.category = button.dataset.category;
    syncCategoryButtons();
    render();
  });
});

elements.sort.addEventListener("change", () => {
  state.sort = elements.sort.value;
  render();
});

elements.refresh.addEventListener("click", () => loadNews());

elements.showAll.addEventListener("click", () => {
  state.category = "すべて";
  syncCategoryButtons();
  render();
});

renderLoadingCards();
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
  const allItems = [...state.data.items];
  const filtered =
    state.category === "すべて"
      ? allItems
      : allItems.filter((item) => item.category === state.category);

  filtered.sort((a, b) => {
    if (state.sort === "newest") {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    }
    return (
      b.score - a.score ||
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );
  });

  elements.itemCount.textContent = state.data.items.length;
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
  elements.grid.replaceChildren(...filtered.map(createCard));
}

function createCard(item, index) {
  const article = el("article", "news-card");
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

  const matchArea = el("div", "match-area");
  matchArea.append(textEl("span", "match-label", "ハチドリとの接点"));
  const termList = el("div", "term-list");
  item.matchedTerms.slice(0, 3).forEach((term) => {
    termList.append(textEl("span", "", term));
  });
  matchArea.append(termList);

  const articleLink = link(item.url, "元記事を読む ↗");
  articleLink.className = "article-link";
  articleLink.setAttribute("aria-label", `${item.title}の元記事を読む`);

  article.append(topLine, heading, sourceLine, matchArea, articleLink);
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

function renderLoadingCards() {
  for (let index = 0; index < 6; index += 1) {
    const card = el("div", "news-card loading-card");
    card.append(
      el("span", "loading-line short"),
      el("span", "loading-line title"),
      el("span", "loading-line title second"),
      el("span", "loading-line meta"),
    );
    elements.loading.append(card);
  }
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

function syncCategoryButtons() {
  elements.categoryButtons.forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
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
