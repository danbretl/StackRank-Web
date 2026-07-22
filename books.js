import {
  categoryStorageKeys,
  resolveDocumentCategory,
} from "./lib/category.js?v=2";
import {
  BOOKS_CATEGORY,
  BOOK_STARTER_SHELVES,
  normalizeBookSearchResult,
} from "./lib/categories/books.js?v=2";
import {
  createRankedEntity,
  entityRefKey,
  isDuplicateEntity,
} from "./lib/entity.js?v=1";
import {
  advanceRankSession,
  createRankSession,
  insertSettledRankSession,
} from "./lib/rank-session.js?v=1";
import {
  parseRankedListPayload,
  serializeRankedListPayload,
} from "./lib/ranked-list.js?v=1";
import {
  buildCategoryBackup,
  parseCategoryBackup,
} from "./lib/category-backup.js?v=1";

const ACTIVE_CATEGORY = resolveDocumentCategory(
  {
    marker: document.documentElement.dataset.stackrankCategory,
    pathname: window.location.pathname,
  },
  [BOOKS_CATEGORY],
);
if (!ACTIVE_CATEGORY) throw new Error("Unknown or mismatched StackRank Books category");

const STORAGE_KEYS = categoryStorageKeys(ACTIVE_CATEGORY);
const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7GOGG6iSHMfax2YpOtqVqg_JIvcrBwl";
const BOOKS_SEARCH_URL = `${SUPABASE_URL}/functions/v1/books-search`;
const SEARCH_DEBOUNCE_MS = 250;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const searchForm = $("#books-search-form");
const searchInput = $("#books-search");
const suggestionsEl = $("#books-suggestions");
const searchStatus = $("#books-search-status");
const recentSection = $("#books-recent-section");
const recentEl = $("#books-recent");
const starterShelvesEl = $("#books-starter-shelves");
const rankingEl = $("#books-ranking");
const rankingEmpty = $("#books-ranking-empty");
const rankingSubtitle = $("#books-ranking-subtitle");
const comparisonEl = $("#books-comparison");
const comparisonProgress = $("#books-comparison-progress");
const newChoice = $("#books-new-choice");
const existingChoice = $("#books-existing-choice");
const cancelComparison = $("#books-cancel-comparison");
const settingsToggle = $("#books-settings-toggle");
const settings = $("#books-settings");
const clearRankingButton = $("#books-clear-ranking");
const downloadBackupButton = $("#books-download-backup");
const restoreBackupButton = $("#books-restore-backup");
const restoreFileInput = $("#books-restore-file");
const toast = $("#books-toast");

let ranking = [];
let rankingUpdatedAt = null;
let searchResults = [];
let activeSuggestionIndex = -1;
let searchTimer = null;
let searchRequest = null;
let searchSequence = 0;
let rankSession = null;
let toastTimer = null;

const safeImage = (snapshot, className = "", loading = "lazy") => {
  const image = document.createElement("img");
  image.className = className;
  image.loading = loading;
  image.alt = snapshot?.image?.alt || "";
  if (snapshot?.image?.url) image.src = snapshot.image.url;
  image.addEventListener("error", () => {
    image.removeAttribute("src");
    image.alt = "";
  }, { once: true });
  return image;
};

const itemMeta = (item) => {
  const author = item?.snapshot?.secondaryText || "Author unknown";
  return item?.snapshot?.year ? `${author} · ${item.snapshot.year}` : author;
};

const showToast = (message, duration = 2600) => {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, duration);
};

const normalizeStoredRanking = (items) => {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const ranked = createRankedEntity(item);
    const key = entityRefKey(ranked);
    if (!ranked || !key || ranked.entityRef.domain !== "books" || seen.has(key)) return;
    seen.add(key);
    normalized.push(ranked);
  });
  return normalized;
};

const loadRanking = () => {
  try {
    const payload = parseRankedListPayload(localStorage.getItem(STORAGE_KEYS.ranking));
    ranking = normalizeStoredRanking(payload.items);
    rankingUpdatedAt = payload.updated_at;
  } catch (_error) {
    ranking = [];
    rankingUpdatedAt = null;
    showToast("Browser storage is unavailable. This preview cannot save changes.", 5200);
  }
};

const saveRanking = () => {
  rankingUpdatedAt = new Date().toISOString();
  try {
    localStorage.setItem(
      STORAGE_KEYS.ranking,
      serializeRankedListPayload(ranking, rankingUpdatedAt),
    );
    return true;
  } catch (_error) {
    showToast("This change could not be saved in browser storage.", 5200);
    return false;
  }
};

const makeBookCopy = (item) => {
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = item.snapshot.primaryText;
  const meta = document.createElement("span");
  meta.textContent = itemMeta(item);
  copy.append(title, meta);
  return copy;
};

const renderRecent = () => {
  const recent = [...ranking]
    .filter((item) => item.rankedAt)
    .sort((a, b) => Date.parse(b.rankedAt) - Date.parse(a.rankedAt))
    .slice(0, 3);
  recentEl.replaceChildren();
  recentSection.hidden = recent.length === 0;
  recent.forEach((item) => {
    const rank = ranking.findIndex((candidate) => entityRefKey(candidate) === entityRefKey(item)) + 1;
    const row = document.createElement("article");
    row.className = "recent-item";
    const copy = makeBookCopy(item);
    const rankLabel = document.createElement("b");
    rankLabel.textContent = `#${rank}`;
    row.append(safeImage(item.snapshot), copy, rankLabel);
    recentEl.appendChild(row);
  });
};

const renderStarterShelves = () => {
  starterShelvesEl.replaceChildren();
  BOOK_STARTER_SHELVES.forEach((shelf) => {
    const section = document.createElement("section");
    section.className = "book-shelf";
    const heading = document.createElement("h3");
    heading.textContent = shelf.title;
    const rail = document.createElement("div");
    rail.className = "book-shelf__rail";
    shelf.items.forEach((item) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "book-tile";
      const ranked = isDuplicateEntity(ranking, item);
      tile.classList.toggle("is-ranked", ranked);
      tile.disabled = ranked;
      tile.setAttribute("aria-label", ranked
        ? `${item.snapshot.primaryText} is already ranked`
        : `Rank ${item.snapshot.primaryText} by ${item.snapshot.secondaryText}`);
      const title = document.createElement("strong");
      title.textContent = item.snapshot.primaryText;
      const author = document.createElement("span");
      author.textContent = item.snapshot.secondaryText;
      tile.append(safeImage(item.snapshot, "", "eager"), title, author);
      tile.addEventListener("click", () => beginRanking(item));
      rail.appendChild(tile);
    });
    section.append(heading, rail);
    starterShelvesEl.appendChild(section);
  });
};

const iconButton = (label, action, text, disabled = false) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = text;
  button.disabled = disabled;
  return button;
};

const renderRanking = () => {
  rankingEl.replaceChildren();
  rankingEmpty.hidden = ranking.length > 0;
  rankingEl.hidden = ranking.length === 0;
  rankingSubtitle.textContent = ranking.length
    ? `${ranking.length} book${ranking.length === 1 ? "" : "s"}, in your exact order.`
    : "No books ranked yet.";

  ranking.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "ranking-row";
    row.dataset.key = entityRefKey(item);
    const rank = document.createElement("span");
    rank.className = "ranking-row__rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const copy = makeBookCopy(item);
    copy.className = "ranking-row__copy";
    const actions = document.createElement("div");
    actions.className = "ranking-row__actions";
    actions.append(
      iconButton(`Move ${item.snapshot.primaryText} up`, "up", "↑", index === 0),
      iconButton(`Move ${item.snapshot.primaryText} down`, "down", "↓", index === ranking.length - 1),
      iconButton(`Remove ${item.snapshot.primaryText}`, "remove", "×"),
    );
    row.append(rank, safeImage(item.snapshot), copy, actions);
    rankingEl.appendChild(row);
  });
};

const renderYou = () => {
  $("#books-stat-count").textContent = String(ranking.length);
  $("#books-stat-top").textContent = ranking[0]?.snapshot?.primaryText || "—";
  const years = ranking.map((item) => item.snapshot.year).filter(Number.isFinite).sort((a, b) => a - b);
  $("#books-stat-years").textContent = years.length
    ? years[0] === years[years.length - 1]
      ? String(years[0])
      : `${years[0]}–${years[years.length - 1]}`
    : "—";
};

const renderAll = () => {
  renderRecent();
  renderStarterShelves();
  renderRanking();
  renderYou();
};

const activeView = () => $(".books-view:not([hidden])")?.dataset.view || "rank";

const showView = (name) => {
  const next = ["rank", "ranking", "you"].includes(name) ? name : "rank";
  $$(".books-view").forEach((view) => {
    view.hidden = view.dataset.view !== next;
  });
  $$("[data-view-target]").forEach((button) => {
    if (!button.closest(".books-nav")) return;
    if (button.dataset.viewTarget === next) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  closeSettings();
  window.scrollTo({ top: 0, behavior: "instant" });
};

const closeSuggestions = () => {
  suggestionsEl.hidden = true;
  suggestionsEl.replaceChildren();
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.setAttribute("aria-activedescendant", "");
  searchResults = [];
  activeSuggestionIndex = -1;
};

const selectSuggestion = (index) => {
  if (!searchResults.length) return;
  activeSuggestionIndex = Math.max(0, Math.min(searchResults.length - 1, index));
  const options = $$("#books-suggestions .search-option");
  options.forEach((option, optionIndex) => {
    option.setAttribute("aria-selected", String(optionIndex === activeSuggestionIndex));
  });
  const active = options[activeSuggestionIndex];
  searchInput.setAttribute("aria-activedescendant", active?.id || "");
  active?.scrollIntoView({ block: "nearest" });
};

const renderSearchResults = (results) => {
  searchResults = results.filter((item) => !isDuplicateEntity(ranking, item));
  suggestionsEl.replaceChildren();
  if (!searchResults.length) {
    closeSuggestions();
    searchStatus.textContent = results.length
      ? "Those matches are already in your ranking."
      : "No matching works found. Try a title, author, or ISBN.";
    return;
  }
  searchResults.forEach((item, index) => {
    const option = document.createElement("li");
    option.id = `books-suggestion-${index}`;
    option.className = "search-option";
    option.role = "option";
    option.tabIndex = -1;
    option.setAttribute("aria-selected", "false");
    const copy = document.createElement("span");
    const title = document.createElement("span");
    title.className = "search-option__title";
    title.textContent = item.snapshot.primaryText;
    const author = document.createElement("span");
    author.className = "search-option__author";
    author.textContent = item.snapshot.secondaryText || "Author unknown";
    copy.append(title, author);
    const year = document.createElement("span");
    year.className = "search-option__year";
    year.textContent = item.snapshot.year || "";
    option.append(safeImage(item.snapshot, "search-option__cover", "eager"), copy, year);
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => beginRanking(item));
    suggestionsEl.appendChild(option);
  });
  suggestionsEl.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  searchStatus.textContent = `${searchResults.length} work${searchResults.length === 1 ? "" : "s"} found.`;
  selectSuggestion(0);
};

const runSearch = async (query) => {
  searchRequest?.abort();
  searchRequest = new AbortController();
  const sequence = ++searchSequence;
  searchStatus.textContent = "Searching Open Library…";
  try {
    const response = await fetch(`${BOOKS_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: searchRequest.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (sequence !== searchSequence) return;
    if (!response.ok) throw new Error(payload?.error || "Search failed");
    const results = (Array.isArray(payload?.results) ? payload.results : [])
      .map(normalizeBookSearchResult)
      .filter(Boolean);
    renderSearchResults(results);
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (sequence !== searchSequence) return;
    closeSuggestions();
    searchStatus.textContent = "Book search is unavailable right now. The starter shelves still work.";
  }
};

const scheduleSearch = () => {
  window.clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchRequest?.abort();
    closeSuggestions();
    searchStatus.textContent = query ? "Type at least two characters." : "";
    return;
  }
  searchTimer = window.setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
};

const comparisonCardContent = (item, label) => {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(safeImage(item.snapshot, "", "eager"));
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = item.snapshot.primaryText;
  const meta = document.createElement("span");
  meta.textContent = itemMeta(item);
  const action = document.createElement("b");
  action.textContent = label;
  copy.append(title, meta, action);
  fragment.appendChild(copy);
  return fragment;
};

const renderComparison = () => {
  if (!rankSession || rankSession.status !== "comparing") return;
  const existing = ranking[rankSession.comparisonIndex];
  if (!existing) {
    cancelActiveRanking();
    return;
  }
  const estimatedMax = Math.ceil(Math.log2(ranking.length + 1)) + 1;
  comparisonProgress.textContent = `Choice ${rankSession.comparisons + 1} of about ${estimatedMax}`;
  newChoice.replaceChildren(comparisonCardContent(rankSession.item, "Rank this higher"));
  existingChoice.replaceChildren(comparisonCardContent(existing, "Keep this higher"));
  newChoice.setAttribute("aria-label", `Rank ${rankSession.item.snapshot.primaryText} higher`);
  existingChoice.setAttribute("aria-label", `Keep ${existing.snapshot.primaryText} higher`);
  comparisonEl.hidden = false;
  document.body.style.overflow = "hidden";
};

const settleRanking = (settledSession) => {
  const inserted = insertSettledRankSession(ranking, settledSession, (item, meta) =>
    createRankedEntity({
      entityRef: item.entityRef,
      snapshot: item.snapshot,
      comparisons: meta.comparisons,
      rankedAt: new Date().toISOString(),
    }));
  if (!inserted) {
    cancelActiveRanking();
    showToast("The ranking changed before this book could be placed. Try again.");
    return;
  }
  ranking = inserted;
  rankSession = null;
  comparisonEl.hidden = true;
  document.body.style.overflow = "";
  saveRanking();
  renderAll();
  searchInput.value = "";
  searchInput.blur();
  closeSuggestions();
  searchStatus.textContent = "";
  const rank = settledSession.insertionIndex + 1;
  showToast(`${settledSession.item.snapshot.primaryText} is #${rank}.`);
};

function beginRanking(item) {
  const ranked = createRankedEntity(item);
  if (!ranked) return;
  if (isDuplicateEntity(ranking, ranked)) {
    showToast(`${ranked.snapshot.primaryText} is already ranked.`);
    return;
  }
  closeSuggestions();
  searchInput.blur();
  rankSession = createRankSession({ item: ranked, rankingLength: ranking.length });
  if (rankSession.status === "settled") settleRanking(rankSession);
  else renderComparison();
}

const handleChoice = (newItemWins) => {
  if (!rankSession || rankSession.status !== "comparing") return;
  rankSession = advanceRankSession(rankSession, newItemWins);
  if (rankSession.status === "settled") settleRanking(rankSession);
  else renderComparison();
};

function cancelActiveRanking() {
  rankSession = null;
  comparisonEl.hidden = true;
  document.body.style.overflow = "";
  searchInput.blur();
}

const closeSettings = () => {
  settings.hidden = true;
  settingsToggle.setAttribute("aria-expanded", "false");
};

const downloadBackup = () => {
  const backup = buildCategoryBackup("books", ranking);
  if (!backup) return;
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stackrank-books-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("Books backup downloaded.");
  closeSettings();
};

const restoreBackup = async (file) => {
  try {
    const backup = parseCategoryBackup(await file.text(), "books");
    if (!backup) throw new Error("Not a Books backup");
    const restored = normalizeStoredRanking(backup.ranking);
    if (restored.length !== backup.ranking.length) throw new Error("Backup contains invalid book records");
    if (ranking.length && !window.confirm("Replace this device's current Books ranking with the backup?")) return;
    ranking = restored;
    saveRanking();
    renderAll();
    showToast(`Restored ${ranking.length} book${ranking.length === 1 ? "" : "s"}.`);
  } catch (_error) {
    showToast("That file is not a valid StackRank Books backup.", 4200);
  } finally {
    restoreFileInput.value = "";
    closeSettings();
  }
};

$$('[data-view-target]').forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewTarget));
});

searchInput.addEventListener("input", scheduleSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && !suggestionsEl.hidden) {
    event.preventDefault();
    selectSuggestion(activeSuggestionIndex + 1);
  } else if (event.key === "ArrowUp" && !suggestionsEl.hidden) {
    event.preventDefault();
    selectSuggestion(activeSuggestionIndex - 1);
  } else if (event.key === "Enter" && !suggestionsEl.hidden && activeSuggestionIndex >= 0) {
    event.preventDefault();
    beginRanking(searchResults[activeSuggestionIndex]);
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeSuggestionIndex >= 0) beginRanking(searchResults[activeSuggestionIndex]);
});
document.addEventListener("pointerdown", (event) => {
  if (!searchForm.contains(event.target)) closeSuggestions();
  if (!settings.hidden && !settings.contains(event.target) && !settingsToggle.contains(event.target)) closeSettings();
});

newChoice.addEventListener("click", () => handleChoice(true));
existingChoice.addEventListener("click", () => handleChoice(false));
cancelComparison.addEventListener("click", cancelActiveRanking);

rankingEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = event.target.closest(".ranking-row");
  if (!button || !row) return;
  const index = ranking.findIndex((item) => entityRefKey(item) === row.dataset.key);
  if (index < 0) return;
  if (button.dataset.action === "remove") {
    if (!window.confirm(`Remove ${ranking[index].snapshot.primaryText} from this ranking?`)) return;
    ranking.splice(index, 1);
  } else {
    const nextIndex = button.dataset.action === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ranking.length) return;
    [ranking[index], ranking[nextIndex]] = [ranking[nextIndex], ranking[index]];
  }
  saveRanking();
  renderAll();
});

settingsToggle.addEventListener("click", () => {
  settings.hidden = !settings.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settings.hidden));
});
clearRankingButton.addEventListener("click", () => {
  if (!ranking.length || !window.confirm("Clear this device's entire Books ranking?")) return;
  ranking = [];
  saveRanking();
  renderAll();
  closeSettings();
  showToast("Books ranking cleared.");
});
downloadBackupButton.addEventListener("click", downloadBackup);
restoreBackupButton.addEventListener("click", () => restoreFileInput.click());
restoreFileInput.addEventListener("change", () => {
  const [file] = restoreFileInput.files || [];
  if (file) restoreBackup(file);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!comparisonEl.hidden) cancelActiveRanking();
  else if (!settings.hidden) closeSettings();
});

loadRanking();
renderAll();
showView(activeView());
console.info("StackRank Books preview", { storedAt: rankingUpdatedAt, count: ranking.length });
