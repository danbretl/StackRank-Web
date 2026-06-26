import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.info("StackRank build", "share-studio-v3");

const form = document.getElementById("movie-form");
const titleInput = document.getElementById("title");
const suggestions = document.getElementById("suggestions");
const apiStatus = document.getElementById("api-status");
const compareSection = document.getElementById("compare");
const newTitle = document.getElementById("new-title");
const newMeta = document.getElementById("new-meta");
const newPoster = document.getElementById("new-poster");
const newCard = document.getElementById("new-card");
const existingTitle = document.getElementById("existing-title");
const existingMeta = document.getElementById("existing-meta");
const existingPoster = document.getElementById("existing-poster");
const existingCard = document.getElementById("existing-card");
const compareSub = document.getElementById("compare-sub");
const undoChoiceButton = document.getElementById("undo-choice");
const cancelRankingButton = document.getElementById("cancel-ranking");
const skipPackMovieButton = document.getElementById("skip-pack-movie");
const rankingList = document.getElementById("ranking");
const watchListEl = document.getElementById("watch-list");
const notInterestedListEl = document.getElementById("not-interested-list");
const watchListSub = document.getElementById("watch-list-sub");
const notInterestedSub = document.getElementById("not-interested-sub");
const rankingSettingsToggle = document.getElementById("ranking-settings-toggle");
const rankingSettingsPanel = document.getElementById("ranking-settings-panel");
const rankingSettingsClose = document.getElementById("ranking-settings-close");
const settingsAuthState = document.getElementById("settings-auth-state");
const settingsAuthSignedOut = document.getElementById("settings-auth-signed-out");
const settingsAuthEmailInput = document.getElementById("settings-auth-email");
const settingsSignInButton = document.getElementById("settings-sign-in");
const settingsSignOutButton = document.getElementById("settings-sign-out");
const clearButton = document.getElementById("clear-list");
const shareButton = document.getElementById("share-list");
const snapshotSub = document.getElementById("snapshot-sub");
const snapshotContent = document.getElementById("snapshot-content");
const shareStudio = document.getElementById("share-studio");
const shareClose = document.getElementById("share-close");
const sharePreview = document.getElementById("share-preview");
const shareDisplayName = document.getElementById("share-display-name");
const shareIncludeTop = document.getElementById("share-include-top");
const shareIncludeBottom = document.getElementById("share-include-bottom");
const shareIncludeEras = document.getElementById("share-include-eras");
const shareIncludeGenres = document.getElementById("share-include-genres");
const shareIncludePeople = document.getElementById("share-include-people");
const shareIncludeQueues = document.getElementById("share-include-queues");
const shareIncludeFullList = document.getElementById("share-include-full-list");
const shareFullListStyleControls = document.querySelectorAll('input[name="share-full-list-style"]');
const shareShapeFieldset = document.getElementById("share-shape-fieldset");
const shareDownloadPng = document.getElementById("share-download-png");
const shareDownloadSvg = document.getElementById("share-download-svg");
const shareCopyMarkdown = document.getElementById("share-copy-markdown");
const shareCopyJson = document.getElementById("share-copy-json");
const shareCopyText = document.getElementById("share-copy-text");
const shareExportStatus = document.getElementById("share-export-status");
const authSignedOut = document.getElementById("auth-signed-out");
const authSignedIn = document.getElementById("auth-signed-in");
const authEmailInput = document.getElementById("auth-email");
const authSignInButton = document.getElementById("auth-sign-in");
const authSignOutButton = document.getElementById("auth-sign-out");
const authUserLabel = document.getElementById("auth-user");
const authStatus = document.getElementById("auth-status");
const debugPanel = document.getElementById("debug-panel");
const debugContent = document.getElementById("debug-content");
const addFeedback = document.getElementById("add-feedback");
const suggestPanel = document.getElementById("suggest-panel");
const suggestRelatedSection = document.getElementById("suggest-related-section");
const suggestRelatedTitle = document.getElementById("suggest-related-title");
const suggestRelated = document.getElementById("suggest-related");
const suggestRelatedEmpty = document.getElementById("suggest-related-empty");
const suggestPopular = document.getElementById("suggest-popular");
const suggestEssentials = document.getElementById("suggest-essentials");
const suggestRelatedMore = document.getElementById("suggest-related-more");
const suggestPopularMore = document.getElementById("suggest-popular-more");
const suggestEssentialsMore = document.getElementById("suggest-essentials-more");
const packSection = document.getElementById("pack-section");
const packSectionSub = document.getElementById("pack-section-sub");
const packRow = document.getElementById("pack-row");
const packEmpty = document.getElementById("pack-empty");
const packViewAll = document.getElementById("pack-view-all");
const detailOverlay = document.getElementById("movie-detail");
const detailClose = document.getElementById("detail-close");
const detailPoster = document.getElementById("detail-poster");
const detailTitle = document.getElementById("detail-title");
const detailSub = document.getElementById("detail-sub");
const detailGenres = document.getElementById("detail-genres");
const detailOverview = document.getElementById("detail-overview");
const detailDirector = document.getElementById("detail-director");
const detailCast = document.getElementById("detail-cast");
const detailStatus = document.getElementById("detail-status");
const detailActions = detailOverlay.querySelector(".detail-actions");
const detailRank = document.getElementById("detail-rank");
const detailSave = document.getElementById("detail-save");
const detailHide = document.getElementById("detail-hide");
const packDetailOverlay = document.getElementById("pack-detail");
const packDetailClose = document.getElementById("pack-detail-close");
const packDetailCover = document.getElementById("pack-detail-cover");
const packDetailCategory = document.getElementById("pack-detail-category");
const packDetailTitle = document.getElementById("pack-detail-title");
const packDetailSub = document.getElementById("pack-detail-sub");
const packDetailProgressBar = document.getElementById("pack-detail-progress-bar");
const packDetailStatus = document.getElementById("pack-detail-status");
const packAutoStart = document.getElementById("pack-auto-start");
const packShowHandled = document.getElementById("pack-show-handled");
const packSaveAll = document.getElementById("pack-save-all");
const packHideAll = document.getElementById("pack-hide-all");
const packDetailList = document.getElementById("pack-detail-list");

const TMDB_PROXY_PATH = "/functions/v1/tmdb-search";
const TMDB_SUGGEST_PATH = "/functions/v1/tmdb-suggest";
const TMDB_DETAIL_PATH = "/functions/v1/tmdb-detail";
const TMDB_IMAGE_PATH = "/functions/v1/tmdb-image";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const TMDB_POSTER_SMALL = "https://image.tmdb.org/t/p/w92";
const STORAGE_KEY = "stackrank:movies:v1";
const QUEUE_STORAGE_KEY = "stackrank:suggestion-queues:v1";
const PACK_PROGRESS_STORAGE_KEY = "stackrank:pack-progress:v1";
const PACK_FALLBACK_PATH = "data/suggestion-packs.json";
const SHARE_OPTIONS_KEY = "stackrank:share-options:v1";
const SHARE_OPTIONS_VERSION = 6;
const WATCH_LIST_TYPE = "watch";
const NOT_INTERESTED_LIST_TYPE = "not_interested";
const INSPIRED_SEED_KEY = "stackrank:inspired-seed:v1";
const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZmhha3J4c2xscnFtc2N4eHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MzkzOTYsImV4cCI6MjA4MjExNTM5Nn0.XYeheYWAMNbUC9MUPv1oF7J3-MwxfcBS7-QpxRszrSs";

let ranking = [];
let rankingUpdatedAt = null;
let watchList = [];
let notInterestedList = [];
let pending = null;
let pendingOrigin = null;
let searchRange = null;
let selectedSuggestion = null;
let suggestionItems = [];
let activeSuggestionIndex = -1;
let currentSuggestions = [];
let debounceTimer = null;
let currentUser = null;
let authNotice = "";
let statusTimeout = null;
let dragIndex = null;
let dragItem = null;
let dragTargetIndex = null;
let dragPointerY = null;
let dragGhost = null;
let dragOverRaf = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragPointerId = null;
let dragCaptureEl = null;
let migrationStats = null;
const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
let highlightTimeout = null;
let feedbackRemovalTimeout = null;
let compareHistory = [];
let lastAddedTmdbId = null;
let activeSuggestionSeed = null;
let suggestRelatedCursor = 0;
let suggestPopularCursor = 0;
let suggestEssentialsCursor = 0;
let suggestionsRequestId = 0;
let suggestionSectionState = {
  popular: { all: [], visible: [] },
  essentials: { all: [], visible: [] },
  related: { all: [], visible: [] },
};
let suggestionPacks = [];
let packProgress = {};
let packIndexByMovieId = new Map();
let currentPackSlug = null;
let packDetailTrigger = null;
let packDetailShowHandled = false;
let pendingPackContext = null;
let autoPackSession = null;
let lastPackDiscoveryNudgeAt = 0;
let placeholderIndex = 0;
let placeholderTimer = null;
let currentDetail = null;
let detailRequestId = 0;
let detailTrigger = null;
const detailCache = new Map();
let comparisonReturnScroll = null;
let shareStudioTrigger = null;
let shareOptions = {
  version: SHARE_OPTIONS_VERSION,
  displayName: "",
  top: true,
  bottom: true,
  eras: true,
  genres: true,
  people: true,
  queues: true,
  fullList: true,
  fullListStyle: "mixed",
  theme: "classic",
  tone: "neutral",
  format: "single",
  shape: "skinny",
};
let shareDetailRequestId = 0;
let shareDetailsLoading = false;
let sharePngPreparing = false;
// Last preview markup written to the DOM; lets us skip redundant innerHTML
// rewrites (which reload poster <image>s and cause a visible flicker).
let lastSharePreviewMarkup = "";
let shareScrollLockY = 0;
const posterDataCache = new Map();

const storageEnabled = typeof window !== "undefined" && "localStorage" in window;
const supabaseEnabled =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
const supabase = supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const tmdbProxyEnabled = supabaseEnabled;
const tmdbProxyUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_PROXY_PATH}` : "";
const tmdbSuggestUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_SUGGEST_PATH}` : "";
const tmdbImageUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_IMAGE_PATH}` : "";
const SUGGESTION_PAGE_SIZE = 3;
const PACK_PANEL_SIZE = 3;
const PACK_DISCOVERY_NUDGE_COOLDOWN_MS = 1000 * 60 * 30;
const TOAST_DURATION_MS = 3200;
const TOAST_EXIT_MS = 240;
const AUTH_INIT_TIMEOUT_MS = 3200;
const PLACEHOLDER_TITLES = [
  "The Godfather",
  "Moonlight",
  "Paddington 2",
  "The Matrix",
  "Casablanca",
  "Mad Max: Fury Road",
  "My Neighbor Totoro",
  "Parasite",
  "When Harry Met Sally...",
  "Do the Right Thing",
  "The Social Network",
  "Everything Everywhere All at Once",
  "Before Sunrise",
  "Alien",
  "The Princess Bride",
  "In the Mood for Love",
];
const PLACEHOLDER_ROTATION_MS = 3600;
const PLACEHOLDER_FADE_MS = 180;

const formatMeta = (movie) => {
  if (!movie.year) return "Year unknown";
  return `Released ${movie.year}`;
};

const rotateTitlePlaceholder = () => {
  if (titleInput.value.trim()) return;
  titleInput.classList.add("is-placeholder-fading");
  window.setTimeout(() => {
    placeholderIndex = (placeholderIndex + 1) % PLACEHOLDER_TITLES.length;
    titleInput.placeholder = PLACEHOLDER_TITLES[placeholderIndex];
    titleInput.classList.remove("is-placeholder-fading");
  }, PLACEHOLDER_FADE_MS);
};

const startPlaceholderRotation = () => {
  titleInput.placeholder = PLACEHOLDER_TITLES[placeholderIndex];
  if (placeholderTimer) window.clearInterval(placeholderTimer);
  placeholderTimer = window.setInterval(rotateTitlePlaceholder, PLACEHOLDER_ROTATION_MS);
};

const normalizeTitle = (value) => value.trim().toLowerCase();

const movieKey = (movie) => {
  if (movie.tmdbId) return `tmdb:${movie.tmdbId}`;
  const title = normalizeTitle(movie.title || "");
  return movie.year ? `title:${title}:${movie.year}` : `title:${title}`;
};

const isDuplicateMovie = (movie) => {
  const title = normalizeTitle(movie.title);
  return ranking.some((existing) => {
    if (movie.tmdbId && existing.tmdbId && existing.tmdbId === movie.tmdbId) {
      return true;
    }
    const existingTitle = normalizeTitle(existing.title);
    if (existingTitle !== title) return false;
    if (movie.year && existing.year) {
      return existing.year === movie.year;
    }
    return true;
  });
};

const setPoster = (imageEl, movie) => {
  if (movie && movie.posterPath) {
    imageEl.src = `${TMDB_POSTER_BASE}${movie.posterPath}`;
    imageEl.alt = `${movie.title} poster`;
    imageEl.style.visibility = "visible";
  } else {
    imageEl.removeAttribute("src");
    imageEl.alt = "";
    imageEl.style.visibility = "hidden";
  }
};

const formatRuntime = (runtime) => {
  if (!runtime) return "";
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatRuntimeTotal = (minutes) => {
  if (!minutes) return "--";
  return formatRuntime(minutes);
};

const formatShareRuntimeTotal = (stats, totalCount, loading = false) => {
  if (stats.minutes) {
    return { value: formatRuntime(stats.minutes), isDuration: true };
  }
  if (totalCount && loading) {
    return { value: "Loading", isDuration: false };
  }
  if (totalCount) {
    return { value: "Unavailable", isDuration: false };
  }
  return { value: "--", isDuration: false };
};

const runtimeStatsForMovies = (movies) => {
  return movies.reduce(
    (stats, movie) => {
      const runtime = Number(movieWithDetail(movie)?.runtime || movie?.runtime || 0);
      if (!runtime) return stats;
      return {
        minutes: stats.minutes + runtime,
        count: stats.count + 1,
      };
    },
    { minutes: 0, count: 0 },
  );
};

const hiddenRuntimeLabel = (toneName = shareOptions.tone) => {
  const labels = {
    neutral: "Time out of queue",
    punchy: "Time reclaimed",
    funny: "Life spared",
    extreme: "Time rescued",
  };
  return labels[toneName] || labels.neutral;
};

const withTimeout = (promise, timeoutMs, message) => {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  });
};

const getListId = () => {
  if (currentUser && currentUser.id) {
    return `user:${currentUser.id}`;
  }
  return null;
};

function updateRankingSettingsAuthUI() {
  if (!supabaseEnabled) {
    settingsAuthState.textContent = "Sync is not configured.";
    settingsAuthSignedOut.hidden = true;
    settingsSignOutButton.hidden = true;
    return;
  }

  if (currentUser) {
    settingsAuthState.textContent = `Signed in as ${currentUser.email || "user"}`;
    settingsAuthSignedOut.hidden = true;
    settingsSignOutButton.hidden = false;
    return;
  }

  settingsAuthState.textContent = "Not signed in";
  settingsAuthSignedOut.hidden = false;
  settingsSignOutButton.hidden = true;
}

function closeRankingSettings({ restoreFocus = true } = {}) {
  if (rankingSettingsPanel.hidden) return;
  rankingSettingsPanel.hidden = true;
  rankingSettingsToggle.setAttribute("aria-expanded", "false");
  if (restoreFocus) rankingSettingsToggle.focus({ preventScroll: true });
}

function openRankingSettings() {
  updateRankingSettingsAuthUI();
  rankingSettingsPanel.hidden = false;
  rankingSettingsToggle.setAttribute("aria-expanded", "true");
  rankingSettingsClose.focus({ preventScroll: true });
}

function toggleRankingSettings() {
  if (rankingSettingsPanel.hidden) openRankingSettings();
  else closeRankingSettings();
}

const renderRanking = () => {
  rankingList.innerHTML = "";
  const hasRankedMovies = ranking.length > 0;
  shareButton.disabled = !hasRankedMovies;
  clearButton.disabled = !hasRankedMovies;

  if (!hasRankedMovies) {
    const empty = document.createElement("li");
    empty.className = "ranking__empty";
    empty.textContent = "No movies yet. Add one to begin.";
    rankingList.appendChild(empty);
    renderListSnapshot();
    if (!shareStudio.hidden) updateShareStudio();
    return;
  }

  ranking.forEach((movie, index) => {
    const item = document.createElement("li");
    item.className = "ranking__item";
    item.dataset.index = String(index);
    item.setAttribute("aria-grabbed", "false");
    const handle = document.createElement("span");
    handle.className = "ranking__handle";
    handle.textContent = "≡";
    handle.setAttribute("aria-hidden", "true");
    const actions = document.createElement("div");
    actions.className = "ranking__actions";
    const restackButton = document.createElement("button");
    restackButton.className = "ranking__restack";
    restackButton.type = "button";
    restackButton.setAttribute("aria-label", `Re-rank ${movie.title}`);
    restackButton.textContent = "↻";
    const removeButton = document.createElement("button");
    removeButton.className = "ranking__delete";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${movie.title}`);
    removeButton.textContent = "×";
    const poster = document.createElement("img");
    poster.className = "ranking__poster";
    if (movie.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      poster.alt = `${movie.title} poster`;
      poster.style.visibility = "visible";
    } else {
      poster.alt = "";
      poster.style.visibility = "hidden";
    }

    const text = document.createElement("div");
    text.className = "ranking__text";
    const title = document.createElement("div");
    title.className = "ranking__title";
    title.textContent = `${index + 1}. ${movie.title}`;
    const meta = document.createElement("div");
    meta.className = "ranking__meta";
    meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";

    text.append(title, meta);
    actions.append(restackButton, removeButton);
    item.append(handle, poster, text, actions);
    rankingList.appendChild(item);
  });
  renderListSnapshot();
  if (!shareStudio.hidden) updateShareStudio();
};

function movieYear(movie) {
  const year = Number(movie?.year);
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function decadeLabel(decade) {
  return `${decade}s`;
}

function dayKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function movieWithDetail(movie) {
  if (!movie?.tmdbId) return movie;
  return detailCache.get(String(movie.tmdbId)) || movie;
}

function countValues(items) {
  const counts = new Map();
  items
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function preferenceWeight(index, total) {
  if (!total) return 0;
  return (total - index) / total;
}

function countPreferenceValues(entries) {
  const counts = new Map();
  entries
    .filter((entry) => entry?.name)
    .forEach(({ name, weight }) => {
      const current = counts.get(name) || { name, count: 0, score: 0 };
      current.count += 1;
      current.score += weight || 0;
      counts.set(name, current);
    });
  return Array.from(counts.values()).sort((a, b) => b.score - a.score || b.count - a.count || a.name.localeCompare(b.name));
}

function countPreferenceMany(items, getter) {
  const entries = [];
  const total = items.length;
  items.forEach((item, index) => {
    const weight = preferenceWeight(index, total);
    const result = getter(item);
    if (Array.isArray(result)) {
      result.filter(Boolean).forEach((name) => entries.push({ name, weight }));
    } else if (result) {
      entries.push({ name: result, weight });
    }
  });
  return countPreferenceValues(entries);
}

function countReversePreferenceMany(items, getter) {
  const entries = [];
  const total = items.length;
  items.forEach((item, index) => {
    const weight = total ? (index + 1) / total : 0;
    const result = getter(item);
    if (Array.isArray(result)) {
      result.filter(Boolean).forEach((name) => entries.push({ name, weight }));
    } else if (result) {
      entries.push({ name: result, weight });
    }
  });
  return countPreferenceValues(entries);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function getRankingInsights() {
  const enrichedRanking = ranking.map(movieWithDetail);
  const years = enrichedRanking
    .map((movie, index) => ({ movie, index, year: movieYear(movie) }))
    .filter((item) => item.year);
  const decadeEntries = [];
  years.forEach(({ year, index }) => {
    const decade = Math.floor(year / 10) * 10;
    decadeEntries.push({ name: String(decade), weight: preferenceWeight(index, enrichedRanking.length) });
  });
  const decades = countPreferenceValues(decadeEntries).map((item) => ({
    decade: Number(item.name),
    count: item.count,
    score: item.score,
  }));
  const sortedByYear = [...years].sort((a, b) => a.year - b.year);
  const yearValues = years.map((item) => item.year);
  const averageYear = years.length
    ? Math.round(years.reduce((sum, item) => sum + item.year, 0) / years.length)
    : null;
  const rankedDates = ranking
    .map((movie) => movie.rankedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const perMovieRankDatesTracked = rankedDates.length > 0;
  const rankedByDay = countValues(rankedDates.map(dayKey));
  const genres = countPreferenceMany(enrichedRanking, (movie) => movie.genres || []);
  const bottomGenres = countReversePreferenceMany(enrichedRanking, (movie) => movie.genres || []);
  const directors = countPreferenceMany(enrichedRanking, (movie) => movie.director);
  const cast = countPreferenceMany(enrichedRanking, (movie) => (movie.cast || []).slice(0, 4));
  const detailCount = enrichedRanking.filter(
    (movie) =>
      (Array.isArray(movie.genres) && movie.genres.length) ||
      movie.director ||
      (Array.isArray(movie.cast) && movie.cast.length),
  ).length;

  return {
    count: ranking.length,
    enrichedRanking,
    yearsKnown: years.length,
    averageYear,
    medianYear: median(yearValues),
    topMovie: enrichedRanking[0] || null,
    topFive: enrichedRanking.slice(0, 5),
    bottomFive: enrichedRanking.slice(-5),
    topDecade: decades[0] || null,
    decades,
    oldest: sortedByYear[0] || null,
    newest: sortedByYear[sortedByYear.length - 1] || null,
    yearSpan:
      sortedByYear[0] && sortedByYear[sortedByYear.length - 1]
        ? sortedByYear[sortedByYear.length - 1].year - sortedByYear[0].year
        : null,
    firstRankedAt: rankedDates[0] || null,
    lastRankedAt: rankedDates[rankedDates.length - 1] || null,
    rankingUpdatedAt,
    perMovieRankDatesTracked,
    busiestDay: rankedByDay[0] || null,
    watchCount: watchList.length,
    hiddenCount: notInterestedList.length,
    genres,
    bottomGenres,
    directors,
    cast,
    detailCount,
  };
}

function rankedTimeValue(movie) {
  if (!movie?.rankedAt) return null;
  const time = new Date(movie.rankedAt).getTime();
  return Number.isNaN(time) ? null : time;
}

function getRecentRankedItems() {
  const items = ranking.map((movie, index) => ({
    movie,
    rank: index + 1,
    rankedTime: rankedTimeValue(movie),
  }));
  const hasRankedTimes = items.some((item) => item.rankedTime !== null);
  const sorted = hasRankedTimes
    ? [...items].sort((a, b) => {
        const aTime = a.rankedTime ?? 0;
        const bTime = b.rankedTime ?? 0;
        return bTime - aTime || a.rank - b.rank;
      })
    : items;
  return {
    hasRankedTimes,
    items: sorted.slice(0, 3),
  };
}

function createSnapshotMovieRow({ movie, rank, rankedTime }) {
  const row = document.createElement("li");
  row.className = "snapshot__movie";

  const poster = document.createElement("img");
  poster.className = "snapshot__poster";
  if (movie.posterPath) {
    poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
    poster.alt = `${movie.title} poster`;
  } else {
    poster.alt = "";
    poster.setAttribute("aria-hidden", "true");
  }

  const body = document.createElement("div");
  body.className = "snapshot__movie-body";
  const title = document.createElement("div");
  title.className = "snapshot__movie-title";
  title.textContent = movie.title;
  const meta = document.createElement("div");
  meta.className = "snapshot__movie-meta";
  meta.textContent = formatMeta(movie);
  body.append(title, meta);

  const detail = document.createElement("div");
  detail.className = "snapshot__movie-detail";
  const rankLabel = document.createElement("span");
  rankLabel.className = "snapshot__rank";
  rankLabel.textContent = `#${rank}`;
  const dateLabel = document.createElement("span");
  dateLabel.textContent = rankedTime !== null ? formatShortDate(movie.rankedAt) : "Current list";
  detail.append(rankLabel, dateLabel);

  row.append(poster, body, detail);
  return row;
}

function renderListSnapshot() {
  const insights = getRankingInsights();
  snapshotContent.innerHTML = "";

  if (!insights.count) {
    snapshotSub.textContent = "Waiting for ranked movies";
    const empty = document.createElement("div");
    empty.className = "snapshot__empty";
    empty.textContent = "Rank a movie to start a running log here.";
    snapshotContent.appendChild(empty);
    return;
  }

  const recent = getRecentRankedItems();
  const lead = recent.hasRankedTimes ? "Latest additions" : "Current top three";
  snapshotSub.textContent = `${lead} of ${insights.count} total`;

  const list = document.createElement("ol");
  list.className = "snapshot__recent";
  recent.items.forEach((item) => {
    list.appendChild(createSnapshotMovieRow(item));
  });
  snapshotContent.append(list);
}

const createQueueActionButton = (label, ariaLabel, action, className = "") => {
  const button = document.createElement("button");
  button.className = `queue-action ${className}`.trim();
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.dataset.action = action;
  return button;
};

const createInfoIcon = () => `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 11v5"></path>
    <path d="M12 8h.01"></path>
  </svg>
`;

const renderQueueList = (container, list, emptyText, source) => {
  container.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("li");
    empty.className = "queue-list__empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  list.forEach((movie, index) => {
    const item = document.createElement("li");
    item.className = "queue-list__item";
    item.dataset.index = String(index);
    item.dataset.source = source;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", `Rank ${movie.title}`);

    const poster = document.createElement("img");
    poster.className = "queue-list__poster";
    if (movie.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      poster.alt = `${movie.title} poster`;
      poster.style.visibility = "visible";
    } else {
      poster.alt = "";
      poster.style.visibility = "hidden";
    }

    const text = document.createElement("div");
    text.className = "queue-list__text";
    const title = document.createElement("div");
    title.className = "queue-list__title";
    title.textContent = movie.title;
    const meta = document.createElement("div");
    meta.className = "queue-list__meta";
    meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";
    text.append(title, meta);

    const infoButton = document.createElement("button");
    infoButton.className = "queue-info";
    infoButton.type = "button";
    infoButton.setAttribute("aria-label", `Show details for ${movie.title}`);
    infoButton.innerHTML = createInfoIcon();

    const actions = document.createElement("div");
    actions.className = "queue-list__actions";
    if (source === "watch") {
      actions.append(
        createQueueActionButton(
          "Hide",
          `Move ${movie.title} to Not for me`,
          "move",
          "queue-action--secondary",
        ),
        createQueueActionButton(
          "Remove",
          `Remove ${movie.title} from Watch next`,
          "remove",
          "queue-action--remove",
        ),
      );
    } else {
      actions.append(
        createQueueActionButton(
          "Save",
          `Move ${movie.title} to Watch next`,
          "move",
          "queue-action--secondary",
        ),
        createQueueActionButton(
          "Remove",
          `Remove ${movie.title} from Not for me`,
          "remove",
          "queue-action--remove",
        ),
      );
    }

    infoButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openMovieDetail(movie, { type: "queue", source }, infoButton);
    });

    item.append(poster, text, infoButton, actions);
    container.appendChild(item);
  });
};

const queueCountLabel = (count, suffix) => `${count} movie${count === 1 ? "" : "s"} ${suffix}`;

const renderSuggestionQueueSubtitles = () => {
  watchListSub.textContent = queueCountLabel(watchList.length, "saved for later");
  notInterestedSub.textContent = queueCountLabel(notInterestedList.length, "hidden from view");
};

const renderSuggestionQueues = () => {
  renderSuggestionQueueSubtitles();
  renderQueueList(watchListEl, watchList, "No saved movies yet.", "watch");
  renderQueueList(notInterestedListEl, notInterestedList, "Nothing hidden yet.", "notInterested");
};

const mergeRankings = (baseList, incomingList) => {
  const baseKeys = new Set(baseList.map(movieKey));
  const merged = [...baseList];
  incomingList.forEach((movie) => {
    const key = movieKey(movie);
    if (baseKeys.has(key)) return;
    merged.push(movie);
    baseKeys.add(key);
  });
  return merged;
};

const mergeMovieLists = (baseList, incomingList) => mergeRankings(baseList, incomingList);

const getLocalPayload = () => {
  if (!storageEnabled) return { movies: [], updated_at: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { movies: [], updated_at: null };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { movies: parsed, updated_at: null };
    }
    if (parsed && Array.isArray(parsed.movies)) {
      return { movies: parsed.movies, updated_at: parsed.updated_at || null };
    }
  } catch (error) {
    return { movies: [], updated_at: null };
  }
  return { movies: [], updated_at: null };
};

const saveLocalPayload = (movies, updatedAt) => {
  if (!storageEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movies, updated_at: updatedAt }));
  } catch (error) {
    // Ignore write errors (storage full, blocked, etc.).
  }
};

const getQueueStorageKeys = () => {
  const keys = [QUEUE_STORAGE_KEY];
  if (currentUser && currentUser.id) {
    keys.unshift(`${QUEUE_STORAGE_KEY}:user:${currentUser.id}`);
  }
  return keys;
};

const getQueuePayload = (key) => {
  if (!storageEnabled) return { watchList: [], notInterestedList: [], updated_at: null };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { watchList: [], notInterestedList: [], updated_at: null };
    const parsed = JSON.parse(raw);
    return {
      watchList: Array.isArray(parsed.watchList) ? parsed.watchList : [],
      notInterestedList: Array.isArray(parsed.notInterestedList) ? parsed.notInterestedList : [],
      updated_at: parsed.updated_at || null,
    };
  } catch (error) {
    return { watchList: [], notInterestedList: [], updated_at: null };
  }
};

const saveLocalQueuePayload = (updatedAt) => {
  if (!storageEnabled) return;
  const [primaryKey] = getQueueStorageKeys();
  try {
    localStorage.setItem(
      primaryKey,
      JSON.stringify({
        watchList,
        notInterestedList,
        updated_at: updatedAt,
      }),
    );
  } catch (error) {
    // Ignore write errors (storage full, blocked, etc.).
  }
};

const getMergedQueuePayload = (payloads) => {
  const sortedPayloads = payloads.sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  });
  const [newest = { watchList: [], notInterestedList: [], updated_at: null }, ...older] = sortedPayloads;
  const merged = {
    watchList: newest.watchList,
    notInterestedList: newest.notInterestedList,
    updated_at: newest.updated_at || null,
  };
  older.forEach((payload) => {
    merged.watchList = mergeMovieLists(merged.watchList, payload.watchList);
    merged.notInterestedList = mergeMovieLists(merged.notInterestedList, payload.notInterestedList);
  });
  return merged;
};

const normalizeSuggestionQueues = () => {
  const rankedKeys = new Set(ranking.map(movieKey));
  watchList = watchList.filter((movie) => !rankedKeys.has(movieKey(movie)));
  notInterestedList = notInterestedList.filter((movie) => {
    const key = movieKey(movie);
    return !rankedKeys.has(key) && !watchList.some((watchMovie) => movieKey(watchMovie) === key);
  });
};

const saveSuggestionQueues = async () => {
  const updatedAt = new Date().toISOString();
  saveLocalQueuePayload(updatedAt);

  const listId = getListId();
  if (supabaseEnabled && supabase && listId) {
    const { error } = await supabase.from("movie_lists").upsert(
      [
        {
          list_id: listId,
          list_type: WATCH_LIST_TYPE,
          movies: watchList,
          updated_at: updatedAt,
        },
        {
          list_id: listId,
          list_type: NOT_INTERESTED_LIST_TYPE,
          movies: notInterestedList,
          updated_at: updatedAt,
        },
      ],
      { onConflict: "list_id,list_type" },
    );
    if (error) {
      console.warn("Could not sync suggestion queues", error);
    }
  }
};

const removeMovieFromList = (list, movie) => {
  const key = movieKey(movie);
  return list.filter((item) => movieKey(item) !== key);
};

const loadSuggestionQueues = async () => {
  const payloads = storageEnabled ? getQueueStorageKeys().map(getQueuePayload) : [];
  const listId = getListId();

  if (supabaseEnabled && supabase && listId) {
    const { data, error } = await supabase
      .from("movie_lists")
      .select("list_type, movies, updated_at")
      .eq("list_id", listId)
      .in("list_type", [WATCH_LIST_TYPE, NOT_INTERESTED_LIST_TYPE]);
    if (!error && Array.isArray(data)) {
      const watchRow = data.find((row) => row.list_type === WATCH_LIST_TYPE);
      const notInterestedRow = data.find((row) => row.list_type === NOT_INTERESTED_LIST_TYPE);
      const updatedAts = data
        .map((row) => row.updated_at)
        .filter(Boolean)
        .sort();
      payloads.unshift({
        watchList: Array.isArray(watchRow?.movies) ? watchRow.movies : [],
        notInterestedList: Array.isArray(notInterestedRow?.movies) ? notInterestedRow.movies : [],
        updated_at: updatedAts[updatedAts.length - 1] || null,
      });
    } else if (error) {
      console.warn("Could not load synced suggestion queues", error);
    }
  }

  const merged = getMergedQueuePayload(payloads);
  watchList = merged.watchList;
  notInterestedList = merged.notInterestedList;
  normalizeSuggestionQueues();
  await saveSuggestionQueues();
};

const stripProgressMetadata = (entry = {}) => {
  const {
    startedAt = null,
    packVersionSeen = null,
    lastIndex = 0,
    completedAt = null,
    discoveryDismissedAt = null,
  } = entry || {};
  return {
    startedAt,
    packVersionSeen,
    lastIndex: Number.isFinite(Number(lastIndex)) ? Number(lastIndex) : 0,
    completedAt,
    discoveryDismissedAt,
  };
};

const normalizeProgressEntry = (entry = {}, updatedAt = null) => ({
  ...stripProgressMetadata(entry),
  updated_at: entry.updated_at || updatedAt || null,
});

const getPackProgressStorageKeys = () => {
  const keys = [PACK_PROGRESS_STORAGE_KEY];
  if (currentUser && currentUser.id) {
    keys.unshift(`${PACK_PROGRESS_STORAGE_KEY}:user:${currentUser.id}`);
  }
  return keys;
};

const getPackProgressPayload = (key) => {
  if (!storageEnabled) return { progress: {} };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { progress: {} };
    const parsed = JSON.parse(raw);
    const progress = parsed?.progress && typeof parsed.progress === "object" ? parsed.progress : {};
    return { progress };
  } catch (error) {
    return { progress: {} };
  }
};

const saveLocalPackProgressPayload = () => {
  if (!storageEnabled) return;
  const [primaryKey] = getPackProgressStorageKeys();
  try {
    localStorage.setItem(primaryKey, JSON.stringify({ progress: packProgress }));
  } catch (error) {
    // Ignore write errors (storage full, blocked, etc.).
  }
};

const mergePackProgressPayloads = (payloads) => {
  const merged = {};
  payloads.forEach((payload) => {
    Object.entries(payload.progress || {}).forEach(([slug, entry]) => {
      const current = merged[slug];
      const entryTime = entry?.updated_at ? new Date(entry.updated_at).getTime() : 0;
      const currentTime = current?.updated_at ? new Date(current.updated_at).getTime() : 0;
      if (!current || entryTime >= currentTime) {
        merged[slug] = normalizeProgressEntry(entry);
      }
    });
  });
  return merged;
};

const savePackProgress = async (slug) => {
  const entry = packProgress[slug];
  if (!entry) return;
  const updatedAt = new Date().toISOString();
  packProgress = {
    ...packProgress,
    [slug]: { ...normalizeProgressEntry(entry), updated_at: updatedAt },
  };
  saveLocalPackProgressPayload();

  const listId = getListId();
  if (supabaseEnabled && supabase && listId) {
    const { error } = await supabase.from("pack_progress").upsert(
      {
        list_id: listId,
        pack_slug: slug,
        state: stripProgressMetadata(packProgress[slug]),
        updated_at: updatedAt,
      },
      { onConflict: "list_id,pack_slug" },
    );
    if (error) {
      console.warn("Could not sync pack progress", error);
    }
  }
};

const loadPackProgress = async () => {
  const payloads = storageEnabled ? getPackProgressStorageKeys().map(getPackProgressPayload) : [];
  const listId = getListId();

  if (supabaseEnabled && supabase && listId) {
    const { data, error } = await supabase
      .from("pack_progress")
      .select("pack_slug, state, updated_at")
      .eq("list_id", listId);
    if (!error && Array.isArray(data)) {
      const progress = {};
      data.forEach((row) => {
        progress[row.pack_slug] = normalizeProgressEntry(row.state || {}, row.updated_at);
      });
      payloads.unshift({ progress });
    } else if (error) {
      console.warn("Could not load pack progress", error);
    }
  }

  packProgress = mergePackProgressPayloads(payloads);
  saveLocalPackProgressPayload();
};

const normalizePackMovie = (movie) => ({
  title: movie.title,
  year: movie.year || null,
  posterPath: movie.posterPath || movie.poster_path || null,
  tmdbId: movie.tmdbId || movie.tmdb_id || movie.id || null,
});

const normalizeSuggestionPack = (row) => ({
  slug: row.slug,
  title: row.title,
  subtitle: row.subtitle || "",
  category: row.category || "Pack",
  movies: Array.isArray(row.movies) ? row.movies.map(normalizePackMovie) : [],
  version: Number(row.version) || 1,
  provenance: row.provenance || null,
  active: row.active !== false,
  sort_order: Number(row.sort_order ?? row.sortOrder ?? 0) || 0,
  cover_path: row.cover_path || row.coverPath || null,
});

const loadFallbackSuggestionPacks = async () => {
  try {
    const response = await fetch(PACK_FALLBACK_PATH, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data.map(normalizeSuggestionPack) : [];
  } catch (error) {
    return [];
  }
};

const rebuildPackIndex = () => {
  packIndexByMovieId = new Map();
  suggestionPacks.forEach((pack) => {
    pack.movies.forEach((movie) => {
      if (!movie.tmdbId) return;
      const slugs = packIndexByMovieId.get(movie.tmdbId) || [];
      slugs.push(pack.slug);
      packIndexByMovieId.set(movie.tmdbId, slugs);
    });
  });
};

const loadSuggestionPacks = async () => {
  let packs = [];
  let loadError = null;
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("suggestion_packs")
      .select("slug,title,subtitle,category,movies,version,provenance,active,sort_order,cover_path")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true });
    if (!error && Array.isArray(data) && data.length) {
      packs = data.map(normalizeSuggestionPack);
    } else if (error) {
      loadError = error;
    }
  }
  if (!packs.length) {
    packs = await loadFallbackSuggestionPacks();
  }
  if (!packs.length && loadError) {
    console.warn("Could not load suggestion packs", loadError);
  }
  suggestionPacks = packs
    .filter((pack) => pack.active && pack.slug && pack.title && pack.movies.length)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  rebuildPackIndex();
};

const saveRanking = async () => {
  const listId = getListId();
  const updatedAt = new Date().toISOString();
  rankingUpdatedAt = updatedAt;
  if (supabaseEnabled && supabase && listId) {
    const payload = {
      list_id: listId,
      movies: ranking,
      updated_at: updatedAt,
    };
    const { error } = await supabase
      .from("rankings")
      .upsert(payload, { onConflict: "list_id" });
    if (!error) return;
  }

  saveLocalPayload(ranking, updatedAt);
};

const loadRanking = async () => {
  const listId = getListId();
  if (supabaseEnabled && supabase && listId) {
    const { data, error } = await supabase
      .from("rankings")
      .select("movies, updated_at")
      .eq("list_id", listId)
      .maybeSingle();
    if (!error && data && Array.isArray(data.movies)) {
      const local = getLocalPayload();
      const serverUpdated = data.updated_at ? new Date(data.updated_at).getTime() : 0;
      const localUpdated = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      const serverBase = serverUpdated >= localUpdated ? data.movies : local.movies;
      const other = serverUpdated >= localUpdated ? local.movies : data.movies;
      rankingUpdatedAt = serverUpdated >= localUpdated ? data.updated_at || null : local.updated_at || null;
      ranking = mergeRankings(serverBase, other);
      await saveRanking();
      return;
    }
  }

  if (!storageEnabled) return;
  try {
    const local = getLocalPayload();
    if (Array.isArray(local.movies)) {
      ranking = local.movies;
      rankingUpdatedAt = local.updated_at || null;
    }
  } catch (error) {
    // Ignore corrupt storage and continue with an empty list.
  }
};

const setComparisonMode = (active) => {
  document.body.classList.toggle("is-comparing", active);
  form.hidden = active;
  if (active) {
    hideSuggestions();
  }
};

const captureComparisonReturnScroll = () => {
  comparisonReturnScroll = {
    left: window.scrollX,
    top: window.scrollY,
  };
};

const clearComparisonReturnScroll = () => {
  comparisonReturnScroll = null;
};

const restoreComparisonReturnScroll = () => {
  const target = comparisonReturnScroll;
  clearComparisonReturnScroll();
  if (!target) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: target.left, top: target.top, behavior: "auto" });
    });
  });
};

const scrollComparisonIntoView = () => {
  // Starting a ranking can happen from anywhere on the page (a suggestion lower
  // down, or a queue item in the right-hand column on desktop), but the compare
  // panel lives at the top of the focus panel. Scroll it into view so the user
  // can actually see the comparison they need to make.
  const target = compareSection.closest(".panel--focus") || compareSection;
  const top = target.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({ left: 0, top: Math.max(0, top), behavior: "smooth" });
};

const withRankingTimestamp = (movie) => ({
  ...movie,
  rankedAt: movie.rankedAt || new Date().toISOString(),
});

const startComparison = () => {
  if (!pending) return;

  if (ranking.length === 0) {
    const rankedMovie = withRankingTimestamp(pending);
    const context = pendingPackContext;
    ranking.push(rankedMovie);
    lastAddedTmdbId = pending.tmdbId || null;
    pending = null;
    pendingPackContext = null;
    pendingOrigin = null;
    saveRanking();
    setComparisonMode(false);
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    setAddFeedback(`"${ranking[0].title}" placed as your top pick.`);
    updateSuggestionsThenHighlight(0);
    handleRankingSettled(rankedMovie, 0, context);
    titleInput.blur();
    clearComparisonReturnScroll();
    return;
  }

  searchRange = { low: 0, high: ranking.length - 1 };
  compareHistory = [];
  suggestionsRequestId += 1;
  setComparisonMode(true);
  setSuggestionsHidden(true);
  showComparison();
  scrollComparisonIntoView();
};

const showComparison = () => {
  if (!pending || !searchRange) return;

  const mid = Math.floor((searchRange.low + searchRange.high) / 2);
  const existing = ranking[mid];

  newTitle.textContent = pending.title;
  newMeta.textContent = formatMeta(pending);
  setPoster(newPoster, pending);
  existingTitle.textContent = existing.title;
  existingMeta.textContent = formatMeta(existing);
  setPoster(existingPoster, existing);

  if (isAutoPackComparison()) {
    const pack = getPackBySlug(pendingPackContext.slug);
    const stats = pack ? getPackStats(pack) : null;
    // Count skipped movies toward the position too: skipping still advances you
    // through the pack's queue, so "x of y" should climb on a skip just like it
    // does on rank/save/hide. handled + skipped are the movies already moved
    // past; +1 is the one currently on screen.
    const skippedCount = autoPackSession?.skippedKeys?.length || 0;
    compareSub.textContent = stats
      ? `${pack.title} · ${stats.handled + skippedCount + 1} of ${stats.total}`
      : `Pack auto · comparison ${pending.comparisons + 1}`;
  } else {
    compareSub.textContent = `Comparison ${pending.comparisons + 1} of ~${Math.ceil(Math.log2(ranking.length + 1))}`;
  }
  compareSection.classList.remove("panel--hidden");
  const canUndo = compareHistory.length > 0;
  undoChoiceButton.disabled = !canUndo;
  undoChoiceButton.hidden = !canUndo;
  cancelRankingButton.hidden = canUndo;
  skipPackMovieButton.hidden = !isAutoPackComparison();

  newCard.onclick = () => handleDecision(true, mid);
  existingCard.onclick = () => handleDecision(false, mid);
  newCard.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDecision(true, mid);
    }
  };
  existingCard.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDecision(false, mid);
    }
  };
};

const handleDecision = (isNewBetter, midIndex) => {
  compareHistory.push({
    low: searchRange.low,
    high: searchRange.high,
    comparisons: pending.comparisons,
  });
  pending.comparisons += 1;
  if (isNewBetter) {
    searchRange.high = midIndex - 1;
  } else {
    searchRange.low = midIndex + 1;
  }

  if (searchRange.low > searchRange.high) {
    const insertIndex = searchRange.low;
    const rankedMovie = withRankingTimestamp(pending);
    const context = pendingPackContext;
    ranking.splice(insertIndex, 0, rankedMovie);
    lastAddedTmdbId = rankedMovie.tmdbId || null;
    const leftNeighbor = ranking[insertIndex - 1];
    const rightNeighbor = ranking[insertIndex + 1];
    pending = null;
    pendingPackContext = null;
    pendingOrigin = null;
    searchRange = null;
    saveRanking();
    setComparisonMode(false);
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    const placedTitle = `"${ranking[insertIndex].title}"`;
    if (leftNeighbor && rightNeighbor) {
      setAddFeedback(
        `${placedTitle} placed at #${insertIndex + 1} between "${leftNeighbor.title}" and "${rightNeighbor.title}".`,
      );
    } else if (leftNeighbor) {
      setAddFeedback(`${placedTitle} placed at #${insertIndex + 1} below "${leftNeighbor.title}".`);
    } else if (rightNeighbor) {
      setAddFeedback(`${placedTitle} placed at #${insertIndex + 1} above "${rightNeighbor.title}".`);
    } else {
      setAddFeedback(`${placedTitle} placed at #${insertIndex + 1}.`);
    }
    updateSuggestionsThenHighlight(insertIndex);
    handleRankingSettled(rankedMovie, insertIndex, context);
    titleInput.blur();
    clearComparisonReturnScroll();
    return;
  }

  showComparison();
};

undoChoiceButton.addEventListener("click", () => {
  if (!pending || !compareHistory.length) return;
  const previous = compareHistory.pop();
  if (!previous) return;
  searchRange.low = previous.low;
  searchRange.high = previous.high;
  pending.comparisons = previous.comparisons;
  showComparison();
});

const restorePendingOrigin = () => {
  if (!pendingOrigin) return;
  if (pendingOrigin.type === "ranking") {
    const insertIndex = Math.min(pendingOrigin.index, ranking.length);
    ranking.splice(insertIndex, 0, pendingOrigin.movie);
    saveRanking();
    renderRanking();
    return;
  }
  if (pendingOrigin.type === "watch") {
    watchList.splice(Math.min(pendingOrigin.index, watchList.length), 0, pendingOrigin.movie);
    persistSuggestionQueues();
    return;
  }
  if (pendingOrigin.type === "notInterested") {
    notInterestedList.splice(
      Math.min(pendingOrigin.index, notInterestedList.length),
      0,
      pendingOrigin.movie,
    );
    persistSuggestionQueues();
  }
};

const cancelComparison = () => {
  if (!pending) return;
  const canceledTitle = pending.title;
  const context = pendingPackContext;
  restorePendingOrigin();
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  searchRange = null;
  compareHistory = [];
  suggestionsRequestId += 1;
  setComparisonMode(false);
  compareSection.classList.add("panel--hidden");
  form.reset();
  setAddFeedback(`Canceled ranking "${canceledTitle}".`, 2600);
  updateSuggestions();
  restoreComparisonReturnScroll();
  titleInput.blur();
  if (context?.type === "pack") {
    if (context.mode === "auto") {
      stopAutoPack({ openDetail: true });
    } else {
      window.setTimeout(() => openPackDetail(context.slug), 120);
    }
  } else {
    renderPackSurfaces();
  }
  updateDebugPanel();
};

cancelRankingButton.addEventListener("click", cancelComparison);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedSuggestion) {
    setStatusMessage("Select a movie from the suggestions to add.");
    return;
  }
  hideSuggestions();
  startRankingFromSelection();
});

clearButton.addEventListener("click", () => {
  if (!ranking.length) return;
  if (!window.confirm("Clear the entire ranking list?")) {
    return;
  }
  ranking = [];
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  searchRange = null;
  saveRanking();
  setComparisonMode(false);
  compareSection.classList.add("panel--hidden");
  form.reset();
  renderRanking();
  updateSuggestions();
  renderPackSurfaces();
  titleInput.focus();
  closeRankingSettings({ restoreFocus: false });
});

rankingSettingsToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleRankingSettings();
});
rankingSettingsClose.addEventListener("click", () => closeRankingSettings());
settingsSignInButton.addEventListener("click", () => handleSignIn(settingsAuthEmailInput));
settingsSignOutButton.addEventListener("click", () => handleSignOut());

shareButton.addEventListener("click", openShareStudio);
shareClose.addEventListener("click", () => closeShareStudio());
shareStudio.addEventListener("click", (event) => {
  if (event.target === shareStudio) closeShareStudio();
});

[
  shareDisplayName,
  shareIncludeTop,
  shareIncludeBottom,
  shareIncludeEras,
  shareIncludeGenres,
  shareIncludePeople,
  shareIncludeQueues,
  shareIncludeFullList,
  ...shareFullListStyleControls,
  ...document.querySelectorAll('input[name="share-theme"]'),
  ...document.querySelectorAll('input[name="share-tone"]'),
  ...document.querySelectorAll('input[name="share-format"]'),
  ...document.querySelectorAll('input[name="share-shape"]'),
].forEach((control) => {
  control.addEventListener("input", updateShareOptionsFromControls);
});

shareDownloadSvg.addEventListener("click", downloadShareSvg);
shareDownloadPng.addEventListener("click", downloadSharePng);
shareCopyMarkdown.addEventListener("click", () => copyShareExport("markdown"));
shareCopyJson.addEventListener("click", () => copyShareExport("json"));
shareCopyText.addEventListener("click", () => copyShareExport("text"));

suggestPopularMore.addEventListener("click", () => {
  suggestPopularCursor += SUGGESTION_PAGE_SIZE;
  updatePopularSuggestions();
});

suggestEssentialsMore.addEventListener("click", () => {
  suggestEssentialsCursor += SUGGESTION_PAGE_SIZE;
  updateEssentialsSuggestions();
});

suggestRelatedMore.addEventListener("click", () => {
  const currentPersonalSeed = getPersonalSuggestionSeed();
  if (currentPersonalSeed?.source === "ranking") {
    activeSuggestionSeed = null;
  } else {
    suggestRelatedCursor += SUGGESTION_PAGE_SIZE;
  }
  updateRelatedSuggestions();
});

rankingList.addEventListener("click", (event) => {
  const restackButton = event.target.closest(".ranking__restack");
  if (restackButton) {
    const item = restackButton.closest(".ranking__item");
    if (!item) return;
    const index = Number(item.dataset.index);
    if (Number.isNaN(index)) return;
    const movie = ranking[index];
    if (!movie) return;
    if (pending) {
      setStatusMessage("Finish the current comparison before re-stacking.");
      return;
    }
    captureComparisonReturnScroll();
    ranking.splice(index, 1);
    pendingOrigin = { type: "ranking", movie: { ...movie }, index };
    pending = { ...movie, comparisons: 0 };
    saveRanking();
    renderRanking();
    startComparison();
    return;
  }
  const removeButton = event.target.closest(".ranking__delete");
  if (!removeButton) return;
  const item = removeButton.closest(".ranking__item");
  if (!item) return;
  const index = Number(item.dataset.index);
  if (Number.isNaN(index)) return;
  const movie = ranking[index];
  if (!movie) return;
  if (!window.confirm(`Remove "${movie.title}" from the list?`)) return;
  ranking.splice(index, 1);
  saveRanking();
  renderRanking();
  updateSuggestions();
  renderPackSurfaces();
});

const clearDragShifts = () => {
  rankingList.querySelectorAll(".is-shifting").forEach((el) => {
    el.classList.remove("is-shifting");
    el.style.transform = "";
  });
};

const updateDragLayout = () => {
  if (!dragItem || dragIndex === null || dragPointerY === null) return;
  const items = Array.from(rankingList.querySelectorAll(".ranking__item")).filter(
    (el) => el !== dragItem,
  );
  const rects = items.map((el) => el.getBoundingClientRect());
  let nextIndex = rects.findIndex((rect) => dragPointerY < rect.top + rect.height / 2);
  if (nextIndex === -1) nextIndex = items.length;
  if (nextIndex === dragTargetIndex) return;
  dragTargetIndex = nextIndex;
  clearDragShifts();
  const originIndex = Math.min(dragIndex, items.length);
  items.forEach((el, index) => {
    const height = rects[index].height * 0.5;
    if (nextIndex > originIndex && index >= originIndex && index < nextIndex) {
      el.classList.add("is-shifting");
      el.style.transform = `translateY(${-height}px)`;
    } else if (nextIndex < originIndex && index >= nextIndex && index < originIndex) {
      el.classList.add("is-shifting");
      el.style.transform = `translateY(${height}px)`;
    }
  });
};

const updateDragGhost = (event) => {
  if (!dragGhost) return;
  dragGhost.style.left = `${event.clientX - dragOffsetX}px`;
  dragGhost.style.top = `${event.clientY - dragOffsetY}px`;
};

const onPointerMove = (event) => {
  dragPointerY = event.clientY;
  updateDragGhost(event);
  updateDragLayout();
};

const endDrag = () => {
  if (!dragItem || dragIndex === null) return;
  if (dragCaptureEl && dragCaptureEl.releasePointerCapture && dragPointerId !== null) {
    try {
      dragCaptureEl.releasePointerCapture(dragPointerId);
    } catch (error) {
      // Ignore missing pointer capture.
    }
  }
  const items = Array.from(rankingList.querySelectorAll(".ranking__item")).filter(
    (el) => el !== dragItem,
  );
  const insertIndex = dragTargetIndex ?? dragIndex;
  const currentOrder = items.map((el) => Number(el.dataset.index));
  const updated = currentOrder.map((index) => ranking[index]);
  const moved = ranking[dragIndex];
  updated.splice(insertIndex, 0, moved);
  ranking = updated;
  saveRanking();
  renderRanking();
  dragItem.classList.remove("is-dragging");
  dragItem.setAttribute("aria-grabbed", "false");
  dragItem = null;
  dragIndex = null;
  dragTargetIndex = null;
  dragPointerY = null;
  dragPointerId = null;
  dragCaptureEl = null;
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  if (dragOverRaf) {
    window.cancelAnimationFrame(dragOverRaf);
    dragOverRaf = null;
  }
  clearDragShifts();
  document.body.classList.remove("is-dragging");
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  window.removeEventListener("scroll", updateDragLayout, true);
};

rankingList.addEventListener(
  "pointerdown",
  (event) => {
    if (event.target.closest(".ranking__delete")) return;
    const item = event.target.closest(".ranking__item");
    if (!item) return;
    if (event.target.closest(".ranking__actions")) {
      return;
    }
    if (event.pointerType === "touch" && !event.target.closest(".ranking__handle")) {
      return;
    }
    event.preventDefault();
    if (item.setPointerCapture) {
      item.setPointerCapture(event.pointerId);
    }
    dragPointerId = event.pointerId;
    dragCaptureEl = item;
    dragItem = item;
    dragIndex = Number(item.dataset.index);
    dragTargetIndex = dragIndex;
    dragPointerY = event.clientY;
  const rect = item.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  dragGhost = item.cloneNode(true);
  dragGhost.classList.add("drag-ghost");
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.height = `${rect.height}px`;
  dragGhost.style.left = `${rect.left}px`;
  dragGhost.style.top = `${rect.top}px`;
  document.body.appendChild(dragGhost);
  item.classList.add("is-dragging");
  item.setAttribute("aria-grabbed", "true");
  document.body.classList.add("is-dragging");
  updateDragLayout();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("scroll", updateDragLayout, true);
  },
  { passive: false },
);

const updateStatus = () => {
  if (!supabaseEnabled) {
    apiStatus.textContent = "Add Supabase keys to enable autocomplete and sync.";
    return;
  }

  apiStatus.textContent = currentUser
    ? "Search powered by TMDB via Supabase. Syncing enabled."
    : "Search powered by TMDB via Supabase. Sign in to sync across devices.";
};

const setStatusMessage = (message, duration = 2200) => {
  apiStatus.textContent = message;
  if (statusTimeout) {
    window.clearTimeout(statusTimeout);
  }
  statusTimeout = window.setTimeout(() => {
    updateStatus();
  }, duration);
};

const hideAddFeedback = ({ immediate = false } = {}) => {
  if (highlightTimeout) {
    window.clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
  if (feedbackRemovalTimeout) {
    window.clearTimeout(feedbackRemovalTimeout);
    feedbackRemovalTimeout = null;
  }
  addFeedback.classList.remove("is-visible");
  if (immediate) {
    addFeedback.classList.remove("is-leaving");
    addFeedback.textContent = "";
    return;
  }
  addFeedback.classList.add("is-leaving");
  feedbackRemovalTimeout = window.setTimeout(() => {
    addFeedback.classList.remove("is-leaving");
    addFeedback.textContent = "";
    feedbackRemovalTimeout = null;
  }, TOAST_EXIT_MS);
};

const setAddFeedback = (message, duration = TOAST_DURATION_MS, actions = []) => {
  if (!message) {
    hideAddFeedback({ immediate: true });
    return;
  }
  if (highlightTimeout) {
    window.clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
  if (feedbackRemovalTimeout) {
    window.clearTimeout(feedbackRemovalTimeout);
    feedbackRemovalTimeout = null;
  }
  addFeedback.innerHTML = "";
  if (actions.length) {
    const toast = document.createElement("div");
    toast.className = "feedback-toast";
    const text = document.createElement("div");
    text.textContent = message;
    const actionWrap = document.createElement("div");
    actionWrap.className = "feedback-toast__actions";
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.className = `feedback-toast__action${action.muted ? " feedback-toast__action--muted" : ""}`;
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        hideAddFeedback({ immediate: true });
        action.onClick();
      });
      actionWrap.appendChild(button);
    });
    toast.append(text, actionWrap);
    addFeedback.appendChild(toast);
  } else {
    addFeedback.textContent = message;
  }
  addFeedback.classList.remove("is-leaving");
  window.requestAnimationFrame(() => {
    addFeedback.classList.add("is-visible");
  });
  if (duration !== null) {
    highlightTimeout = window.setTimeout(() => {
      hideAddFeedback();
    }, duration);
  }
};

const highlightRankingItem = (index) => {
  // Don't scroll-highlight the just-placed item if we've already swapped back
  // into a comparison (e.g. auto-pack advancing to the next movie) — the smooth
  // scroll would yank the freshly-shown comparison view.
  if (document.body.classList.contains("is-comparing")) return;
  const items = rankingList.querySelectorAll(".ranking__item");
  const item = items[index];
  if (!item) return;
  item.classList.add("is-highlight");
  item.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    item.classList.remove("is-highlight");
  }, 2000);
};

const updateSuggestionsThenHighlight = (index) => {
  void updateSuggestions();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      highlightRankingItem(index);
    });
  });
};

const setSuggestionsHidden = (hidden) => {
  suggestPanel.hidden = hidden;
  suggestPanel.classList.toggle("suggest-panel--hidden", hidden);
};

const setDetailActionsDisabled = (disabled) => {
  detailRank.disabled = disabled;
  detailSave.disabled = disabled;
  detailHide.disabled = disabled;
};

const renderDetailPane = (movie, status = "") => {
  detailTitle.textContent = movie.title || "Movie";
  const metaParts = [];
  if (movie.year) metaParts.push(String(movie.year));
  const runtime = formatRuntime(movie.runtime);
  if (runtime) metaParts.push(runtime);
  detailSub.textContent = metaParts.join(" · ") || "Details unavailable";
  detailGenres.textContent = Array.isArray(movie.genres) && movie.genres.length ? movie.genres.join(", ") : "";
  detailOverview.textContent = movie.overview || "No overview available yet.";
  detailDirector.textContent = movie.director || "Unknown";
  detailCast.textContent = Array.isArray(movie.cast) && movie.cast.length ? movie.cast.join(", ") : "Unknown";
  detailStatus.textContent = status;
  setPoster(detailPoster, movie);
};

const normalizeDetailContext = (context) => {
  if (typeof context === "string" || context === null || context === undefined) {
    return { type: "suggestion", sectionKey: context || null };
  }
  return context;
};

const configureDetailActions = (movie, context) => {
  detailActions.hidden = false;
  detailRank.hidden = false;
  detailSave.hidden = false;
  detailHide.hidden = false;
  detailRank.textContent = "Rank";
  detailRank.setAttribute("aria-label", `Rank ${movie.title}`);
  if (context.type === "ranked") {
    detailActions.hidden = true;
    detailRank.hidden = true;
    detailSave.hidden = true;
    detailHide.hidden = true;
    return;
  }
  if (context.type === "queue" && context.source === "watch") {
    detailSave.textContent = "Hide";
    detailSave.setAttribute("aria-label", `Move ${movie.title} to Not for me`);
    detailHide.textContent = "Remove from saved";
    detailHide.setAttribute("aria-label", `Remove ${movie.title} from saved`);
    return;
  }
  if (context.type === "queue" && context.source === "notInterested") {
    detailSave.textContent = "Save";
    detailSave.setAttribute("aria-label", `Move ${movie.title} to Watch next`);
    detailHide.textContent = "Remove from hidden";
    detailHide.setAttribute("aria-label", `Remove ${movie.title} from hidden`);
    return;
  }
  detailSave.textContent = "Save";
  detailSave.setAttribute("aria-label", `Add ${movie.title} to Watch next`);
  detailHide.textContent = "Hide";
  detailHide.setAttribute("aria-label", `Add ${movie.title} to Not for me`);
};

const fetchMovieDetail = async (movie) => {
  if (!tmdbProxyEnabled || !movie.tmdbId) return null;
  const cacheKey = String(movie.tmdbId);
  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey);
  const url = `${supabaseEnabled ? `${SUPABASE_URL}${TMDB_DETAIL_PATH}` : ""}?id=${encodeURIComponent(
    movie.tmdbId,
  )}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.result) return null;
    const detail = { ...movie, ...data.result };
    detailCache.set(cacheKey, detail);
    return detail;
  } catch (error) {
    return null;
  }
};

const openMovieDetail = async (movie, context = null, triggerEl = null) => {
  if (pending) {
    setStatusMessage("Finish the current comparison before opening movie details.");
    return;
  }
  const detailContext = normalizeDetailContext(context);
  const requestId = ++detailRequestId;
  currentDetail = { movie, context: detailContext };
  detailTrigger = triggerEl;
  configureDetailActions(movie, detailContext);
  renderDetailPane(movie, movie.tmdbId ? "Loading details..." : "More details unavailable.");
  setDetailActionsDisabled(false);
  detailOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
  detailClose.focus();

  const detail = await fetchMovieDetail(movie);
  if (requestId !== detailRequestId || !currentDetail) return;
  if (detail) {
    currentDetail.movie = detail;
    configureDetailActions(detail, detailContext);
    renderDetailPane(detail);
  } else if (movie.tmdbId) {
    renderDetailPane(movie, "Could not load full details.");
  }
};

const closeMovieDetail = ({ restoreFocus = true } = {}) => {
  detailRequestId += 1;
  currentDetail = null;
  detailOverlay.hidden = true;
  if (packDetailOverlay.hidden) {
    document.body.classList.remove("is-detail-open");
  }
  setDetailActionsDisabled(false);
  if (restoreFocus && detailTrigger) {
    detailTrigger.focus();
  }
  detailTrigger = null;
};

const setSuggestionList = (sectionKey, container, items = []) => {
  container.innerHTML = "";
  items.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "suggest-card";
    card.title = movie.title;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Rank ${movie.title}`);
    const poster = document.createElement("img");
    poster.className = "suggest-poster";
    if (movie.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      poster.alt = `${movie.title} poster`;
    } else {
      poster.alt = "";
    }
    const name = document.createElement("div");
    name.className = "suggest-name";
    name.textContent = movie.title;
    name.title = movie.title;
    const detailButton = document.createElement("button");
    detailButton.className = "suggest-info";
    detailButton.type = "button";
    detailButton.setAttribute("aria-label", `Show details for ${movie.title}`);
    detailButton.innerHTML = createInfoIcon();
    const meta = document.createElement("div");
    meta.className = "suggest-meta";
    meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";
    const actions = document.createElement("div");
    actions.className = "suggest-actions";
    const watchButton = document.createElement("button");
    watchButton.className = "suggest-action";
    watchButton.type = "button";
    watchButton.textContent = "Save";
    watchButton.setAttribute("aria-label", `Add ${movie.title} to Watch next`);
    const passButton = document.createElement("button");
    passButton.className = "suggest-action suggest-action--muted";
    passButton.type = "button";
    passButton.textContent = "Hide";
    passButton.setAttribute("aria-label", `Add ${movie.title} to Not for me`);
    actions.append(watchButton, passButton);

    watchButton.addEventListener("click", (event) => {
      event.stopPropagation();
      watchButton.blur();
      addSuggestionToQueue(movie, "watch", sectionKey);
    });
    passButton.addEventListener("click", (event) => {
      event.stopPropagation();
      passButton.blur();
      addSuggestionToQueue(movie, "notInterested", sectionKey);
    });
    detailButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openMovieDetail(movie, sectionKey, detailButton);
    });

    card.append(poster, name, detailButton, meta, actions);
    card.addEventListener("click", () => startRankingFromSuggestion(movie));
    card.addEventListener("keydown", (event) => {
      if (event.target.closest("button")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startRankingFromSuggestion(movie);
      }
    });
    container.appendChild(card);
  });
};

const setSuggestionSectionState = (sectionKey, all, visible) => {
  suggestionSectionState = {
    ...suggestionSectionState,
    [sectionKey]: { all, visible },
  };
};

const getSuggestionSectionConfig = (sectionKey) => {
  if (sectionKey === "popular") {
    return { container: suggestPopular, moreButton: suggestPopularMore };
  }
  if (sectionKey === "essentials") {
    return { container: suggestEssentials, moreButton: suggestEssentialsMore };
  }
  if (sectionKey === "related") {
    return {
      container: suggestRelated,
      moreButton: suggestRelatedMore,
      section: suggestRelatedSection,
    };
  }
  return null;
};

const refreshSuggestionSection = (sectionKey) => {
  const requestId = createSuggestionRequest();
  if (!requestId) return;
  if (sectionKey === "popular") {
    void updatePopularSuggestions(requestId);
  } else if (sectionKey === "essentials") {
    void updateEssentialsSuggestions(requestId);
  } else if (sectionKey === "related") {
    void updateRelatedSuggestions(requestId);
  }
};

const replaceQueuedSuggestion = (sectionKey, queuedMovie) => {
  const config = getSuggestionSectionConfig(sectionKey);
  const state = suggestionSectionState[sectionKey];
  if (!config || !state) return false;

  const queuedKey = movieKey(queuedMovie);
  const queuedIndex = state.visible.findIndex((movie) => movieKey(movie) === queuedKey);
  if (queuedIndex < 0) return false;

  const nextAll = filterUnrankedSuggestions(state.all);
  const nextVisible = [...state.visible];
  const keptKeys = new Set(
    nextVisible
      .filter((_, index) => index !== queuedIndex)
      .map(movieKey)
      .filter(Boolean),
  );
  const replacement = nextAll.find((movie) => {
    const key = movieKey(movie);
    return key !== queuedKey && !keptKeys.has(key);
  });

  if (replacement) {
    nextVisible[queuedIndex] = replacement;
  } else {
    nextVisible.splice(queuedIndex, 1);
  }

  setSuggestionSectionState(sectionKey, nextAll, nextVisible);
  setSuggestionList(sectionKey, config.container, nextVisible);
  config.moreButton.disabled = nextAll.length <= SUGGESTION_PAGE_SIZE;
  if (nextVisible.length === 0) {
    refreshSuggestionSection(sectionKey);
  } else if (sectionKey === "related" && config.section) {
    config.section.hidden = false;
  }
  return true;
};

const setSuggestionLoading = (container) => {
  container.innerHTML = "";
  for (let index = 0; index < SUGGESTION_PAGE_SIZE; index += 1) {
    const card = document.createElement("div");
    card.className = "suggest-card suggest-card--loading";
    card.setAttribute("aria-hidden", "true");

    const poster = document.createElement("div");
    poster.className = "suggest-poster suggest-skeleton";
    const name = document.createElement("div");
    name.className = "suggest-name suggest-skeleton";
    const meta = document.createElement("div");
    meta.className = "suggest-meta suggest-skeleton";

    card.append(poster, name, meta);
    container.appendChild(card);
  }
};

const fetchSuggestionList = async (type, seedId = null) => {
  if (!tmdbProxyEnabled) return [];
  const params = new URLSearchParams({ type });
  if (seedId) params.set("seed", String(seedId));
  const url = `${tmdbSuggestUrl}?${params.toString()}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    return [];
  }
};

const rankedTmdbIds = () => new Set(ranking.map((movie) => movie.tmdbId).filter(Boolean));

const queuedTmdbIds = () =>
  new Set([...watchList, ...notInterestedList].map((movie) => movie.tmdbId).filter(Boolean));

const titleYearKey = (movie) => {
  if (!movie.title) return null;
  const title = normalizeTitle(movie.title);
  return movie.year ? `${title}:${movie.year}` : title;
};

const rankedTitleYearKeys = () => new Set(ranking.map(titleYearKey).filter(Boolean));

const queuedTitleYearKeys = () =>
  new Set([...watchList, ...notInterestedList].map(titleYearKey).filter(Boolean));

const filterUnrankedSuggestions = (items) => {
  const existingIds = rankedTmdbIds();
  const hiddenIds = queuedTmdbIds();
  const existingTitleYearKeys = rankedTitleYearKeys();
  const hiddenTitleYearKeys = queuedTitleYearKeys();
  return items.filter((movie) => {
    if (movie.tmdbId && existingIds.has(movie.tmdbId)) return false;
    if (movie.tmdbId && hiddenIds.has(movie.tmdbId)) return false;
    const fallbackKey = titleYearKey(movie);
    return (
      !fallbackKey ||
      (!existingTitleYearKeys.has(fallbackKey) && !hiddenTitleYearKeys.has(fallbackKey))
    );
  });
};

const getPackBySlug = (slug) => suggestionPacks.find((pack) => pack.slug === slug) || null;

const getMovieHandledState = (movie) => {
  const key = movieKey(movie);
  const rankedIndex = ranking.findIndex((item) => movieKey(item) === key);
  if (rankedIndex >= 0) {
    return { type: "ranked", label: `Ranked #${rankedIndex + 1}`, handled: true, index: rankedIndex };
  }
  const watchIndex = watchList.findIndex((item) => movieKey(item) === key);
  if (watchIndex >= 0) {
    return { type: "watch", label: "Saved", handled: true, index: watchIndex };
  }
  const hiddenIndex = notInterestedList.findIndex((item) => movieKey(item) === key);
  if (hiddenIndex >= 0) {
    return { type: "hidden", label: "Hidden", handled: true, index: hiddenIndex };
  }
  return { type: "unhandled", label: "Ready", handled: false };
};

const getPackMovieDetailContext = (pack, movieEntry) => {
  const { state } = movieEntry;
  if (state.type === "ranked") {
    return { type: "ranked", source: "ranking", slug: pack.slug, index: state.index };
  }
  if (state.type === "watch") {
    return { type: "queue", source: "watch", slug: pack.slug };
  }
  if (state.type === "hidden") {
    return { type: "queue", source: "notInterested", slug: pack.slug };
  }
  return { type: "pack", slug: pack.slug };
};

const getPackStats = (pack) => {
  const handledMovies = [];
  const remainingMovies = [];
  pack.movies.forEach((movie, index) => {
    const state = getMovieHandledState(movie);
    const entry = { movie, index, state };
    if (state.handled) {
      handledMovies.push(entry);
    } else {
      remainingMovies.push(entry);
    }
  });
  const total = pack.movies.length;
  const handled = handledMovies.length;
  const progress = total ? handled / total : 0;
  const entry = packProgress[pack.slug] || {};
  const completed = total > 0 && handled === total;
  const resurfaced = Boolean(entry.completedAt && pack.version > Number(entry.packVersionSeen || 0) && !completed);
  const discovered = !entry.startedAt && handled > 0 && !completed && !entry.discoveryDismissedAt;
  const started = Boolean(entry.startedAt && !completed);
  return {
    total,
    handled,
    progress,
    handledMovies,
    remainingMovies,
    completed,
    resurfaced,
    discovered,
    started,
    entry,
  };
};

const packStatusRank = (pack) => {
  const stats = getPackStats(pack);
  if (stats.resurfaced) return 0;
  if (stats.started) return 1;
  if (stats.discovered) return 2;
  if (!stats.completed) return 3;
  return 4;
};

const sortedPacksForDisplay = (includeCompleted = false) =>
  [...suggestionPacks]
    .filter((pack) => includeCompleted || !getPackStats(pack).completed)
    .sort((a, b) => {
      const aStats = getPackStats(a);
      const bStats = getPackStats(b);
      const stateDiff = packStatusRank(a) - packStatusRank(b);
      if (stateDiff) return stateDiff;
      if (bStats.handled !== aStats.handled) return bStats.handled - aStats.handled;
      return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
    });

const packStatusText = (pack, stats = getPackStats(pack)) => {
  if (stats.resurfaced) return `${stats.remainingMovies.length} new to rank`;
  if (stats.completed) return "Complete";
  if (stats.handled > 0) {
    const left = stats.total - stats.handled;
    return `${stats.handled} handled, ${left} to go`;
  }
  return `${stats.total} movies to rank`;
};

const packCompactStatusText = (pack, stats = getPackStats(pack)) => packStatusText(pack, stats);

const packActionText = (pack, stats = getPackStats(pack)) => {
  if (stats.resurfaced) return "Keep going";
  if (stats.started) return "Keep going";
  if (stats.discovered) return "Pick up";
  if (stats.completed) return "View pack";
  return "Start";
};

const createPackCover = (pack, className = "pack-cover") => {
  const cover = document.createElement("div");
  cover.className = className;
  const posterMovies = pack.movies.filter((movie) => movie.posterPath).slice(0, 4);
  const coverMovies = posterMovies.length >= 2 ? posterMovies : pack.movies.slice(0, 4);
  coverMovies.forEach((movie) => {
    if (movie.posterPath) {
      const image = document.createElement("img");
      image.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      image.alt = "";
      cover.appendChild(image);
    } else {
      const tile = document.createElement("span");
      tile.className = "pack-cover__tile";
      tile.textContent = (movie.title || "?").slice(0, 1).toUpperCase();
      cover.appendChild(tile);
    }
  });
  while (cover.children.length < 4) {
    const tile = document.createElement("span");
    tile.className = "pack-cover__tile";
    tile.textContent = "SR";
    cover.appendChild(tile);
  }
  return cover;
};

const createPackCard = (pack, options = {}) => {
  const stats = getPackStats(pack);
  const card = document.createElement("button");
  card.type = "button";
  const stateClass = stats.resurfaced
    ? "pack-card--updated"
    : stats.completed
      ? "pack-card--completed"
      : stats.started
        ? "pack-card--started"
        : stats.discovered
          ? "pack-card--discovered"
          : "";
  card.className = `pack-card ${stateClass}`.trim();
  card.dataset.slug = pack.slug;
  card.setAttribute("aria-label", `Open ${pack.title}`);

  const completeBadge = document.createElement("span");
  completeBadge.className = "pack-card__complete-badge";
  completeBadge.textContent = "✓";
  completeBadge.title = "Complete";
  completeBadge.setAttribute("aria-hidden", "true");

  const title = document.createElement("div");
  title.className = "pack-card__title";
  title.textContent = pack.title;

  const subtitle = document.createElement("div");
  subtitle.className = "pack-card__subtitle";
  subtitle.textContent = pack.subtitle;

  const status = document.createElement("div");
  status.className = "pack-card__status";
  if (options.showCategory) {
    const category = document.createElement("span");
    category.className = "pack-card__category";
    category.textContent = pack.category;
    const separator = document.createElement("span");
    separator.className = "pack-card__status-separator";
    separator.textContent = " · ";
    const statusText = document.createElement("span");
    statusText.textContent = packCompactStatusText(pack, stats);
    status.append(category, separator, statusText);
  } else {
    status.textContent = packStatusText(pack, stats);
  }

  const progress = document.createElement("div");
  progress.className = "pack-card__progress";
  progress.setAttribute("aria-hidden", "true");
  const progressFill = document.createElement("span");
  progressFill.style.width = `${Math.round(stats.progress * 100)}%`;
  progress.appendChild(progressFill);

  const action = document.createElement("span");
  action.className = "pack-card__action";
  action.textContent = packActionText(pack, stats);

  const media = document.createElement("div");
  media.className = "pack-card__media";
  media.append(createPackCover(pack), action);

  const body = document.createElement("div");
  body.className = "pack-card__body";
  body.append(title, subtitle, status, progress);

  if (stats.completed) {
    card.appendChild(completeBadge);
  }
  card.append(media, body);
  card.addEventListener("click", () => openPackDetail(pack.slug, { trigger: card }));
  return card;
};

const formatPackCountsLabel = (short = false) => {
  const completed = suggestionPacks.filter((pack) => getPackStats(pack).completed).length;
  const available = suggestionPacks.length - completed;
  const noun = (count) => (count === 1 ? "pack" : "packs");
  if (available && completed) {
    // Only the both-values case shortens on mobile; the single-value cases stay
    // spelled out either way since they're already brief.
    return short
      ? `${available} available, ${completed} completed`
      : `${available} ${noun(available)} available, ${completed} ${noun(completed)} completed`;
  }
  if (completed) return `${completed} ${noun(completed)} completed`;
  return `${available} ${noun(available)} available`;
};

const renderPackPanel = () => {
  if (!packSection) return;
  packRow.innerHTML = "";
  const packs = sortedPacksForDisplay(false).slice(0, PACK_PANEL_SIZE);
  packEmpty.hidden = packs.length > 0;
  if (!suggestionPacks.length) {
    packSectionSub.textContent = "Packs to work through.";
  } else {
    // Render both the full and shortened labels; CSS shows the right one per
    // breakpoint (shortened only on mobile to save space).
    packSectionSub.innerHTML = "";
    const full = document.createElement("span");
    full.className = "pack-section-sub__full";
    full.textContent = formatPackCountsLabel(false);
    const short = document.createElement("span");
    short.className = "pack-section-sub__short";
    short.textContent = formatPackCountsLabel(true);
    packSectionSub.append(full, short);
  }
  packs.forEach((pack) => {
    packRow.appendChild(createPackCard(pack));
  });
};

const syncPackCompletion = (pack) => {
  const stats = getPackStats(pack);
  const entry = normalizeProgressEntry(packProgress[pack.slug] || {});
  let changed = false;
  if (stats.handled === 0 && (entry.startedAt || entry.completedAt || entry.lastIndex)) {
    entry.startedAt = null;
    entry.completedAt = null;
    entry.lastIndex = 0;
    changed = true;
  } else if (stats.completed && !entry.completedAt) {
    entry.completedAt = new Date().toISOString();
    entry.packVersionSeen = pack.version;
    changed = true;
  } else if (!stats.completed && entry.completedAt) {
    entry.completedAt = null;
    changed = true;
  }
  if (changed) {
    packProgress = { ...packProgress, [pack.slug]: entry };
    void savePackProgress(pack.slug);
  }
};

const markPackEngaged = (pack, updates = {}) => {
  const now = new Date().toISOString();
  const entry = normalizeProgressEntry(packProgress[pack.slug] || {});
  const next = {
    ...entry,
    startedAt: entry.startedAt || now,
    packVersionSeen: pack.version,
    ...updates,
  };
  packProgress = { ...packProgress, [pack.slug]: next };
  void savePackProgress(pack.slug);
};

const renderPackSurfaces = () => {
  suggestionPacks.forEach(syncPackCompletion);
  renderPackPanel();
  if (currentPackSlug) {
    renderPackDetail();
  }
  updateDebugPanel();
};

const closePackDetail = ({ restoreFocus = true } = {}) => {
  currentPackSlug = null;
  packDetailOverlay.hidden = true;
  document.body.classList.remove("is-detail-open");
  if (restoreFocus && packDetailTrigger) {
    packDetailTrigger.focus();
  }
  packDetailTrigger = null;
};

const openPackDetail = (slug, { trigger = null, showHandled = false } = {}) => {
  const pack = getPackBySlug(slug);
  if (!pack) return;
  packDetailOverlay.classList.remove("is-all-packs");
  currentPackSlug = slug;
  packDetailTrigger = trigger || packDetailTrigger;
  packDetailShowHandled = showHandled;
  renderPackDetail();
  packDetailOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
};

const startPackMovieRanking = (pack, movie, mode = "browse") => {
  closePackDetail({ restoreFocus: false });
  startRankingMovie(movie, { type: "pack", slug: pack.slug, mode });
};

const addPackMovieToQueue = (pack, movie, target) => {
  markPackEngaged(pack);
  addSuggestionToQueue(movie, target, null);
  syncPackCompletion(pack);
  renderPackSurfaces();
};

const addPackRemainingToQueue = (pack, target) => {
  if (pending) {
    setStatusMessage("Finish the current comparison before saving pack movies.");
    return;
  }
  const stats = getPackStats(pack);
  const movies = stats.remainingMovies.map((entry) => entry.movie).filter((movie) => !isDuplicateMovie(movie));
  if (!movies.length) return;
  const now = new Date().toISOString();
  movies.forEach((movie) => {
    const storedMovie = {
      ...toStoredMovie(movie),
      queuedAt: now,
      savedAt: target === "watch" ? now : movie.savedAt,
      hiddenAt: target === "notInterested" ? now : movie.hiddenAt,
    };
    removeMovieFromSuggestionQueues(storedMovie);
    if (target === "watch") {
      watchList.push(storedMovie);
    } else {
      notInterestedList.push(storedMovie);
    }
  });
  markPackEngaged(pack);
  syncPackCompletion(pack);
  persistSuggestionQueues();
  updateSuggestions();
  renderPackSurfaces();
  setAddFeedback(`${movies.length} ${movies.length === 1 ? "movie" : "movies"} moved to ${queueLabel(target)}.`, 3200);
};

const dismissPackDiscovery = (slug) => {
  const pack = getPackBySlug(slug);
  if (!pack) return;
  const entry = normalizeProgressEntry(packProgress[slug] || {});
  packProgress = {
    ...packProgress,
    [slug]: {
      ...entry,
      discoveryDismissedAt: new Date().toISOString(),
    },
  };
  void savePackProgress(slug);
  renderPackSurfaces();
};

const createPackMovieCard = (pack, movieEntry) => {
  const { movie, state } = movieEntry;
  const handled = state.handled;
  const card = document.createElement("div");
  card.className = `suggest-card pack-movie${handled ? " is-handled" : ""}`;
  card.title = movie.title;
  card.setAttribute("role", handled ? "group" : "button");
  if (!handled) {
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Rank ${movie.title}`);
  }

  const poster = document.createElement("img");
  poster.className = "suggest-poster";
  if (movie.posterPath) {
    poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
    poster.alt = `${movie.title} poster`;
  } else {
    poster.alt = "";
  }

  const stateBadge = handled ? document.createElement("span") : null;
  if (stateBadge) {
    stateBadge.className = "pack-movie__state";
    stateBadge.textContent = state.label;
  }

  const name = document.createElement("div");
  name.className = "suggest-name";
  name.textContent = movie.title;
  name.title = movie.title;

  const detailButton = document.createElement("button");
  detailButton.className = "suggest-info";
  detailButton.type = "button";
  detailButton.setAttribute("aria-label", `Show details for ${movie.title}`);
  detailButton.innerHTML = createInfoIcon();

  const meta = document.createElement("div");
  meta.className = "suggest-meta";
  meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";

  const actions = document.createElement("div");
  actions.className = "suggest-actions";
  if (!handled) {
    const rankButton = document.createElement("button");
    rankButton.className = "suggest-action";
    rankButton.type = "button";
    rankButton.textContent = "Rank";
    const saveButton = document.createElement("button");
    saveButton.className = "suggest-action";
    saveButton.type = "button";
    saveButton.textContent = "Save";
    const hideButton = document.createElement("button");
    hideButton.className = "suggest-action suggest-action--muted";
    hideButton.type = "button";
    hideButton.textContent = "Hide";
    rankButton.addEventListener("click", (event) => {
      event.stopPropagation();
      startPackMovieRanking(pack, movie, "browse");
    });
    saveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      addPackMovieToQueue(pack, movie, "watch");
    });
    hideButton.addEventListener("click", (event) => {
      event.stopPropagation();
      addPackMovieToQueue(pack, movie, "notInterested");
    });
    actions.append(rankButton, saveButton, hideButton);
  }

  detailButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openMovieDetail(movie, getPackMovieDetailContext(pack, movieEntry), detailButton);
  });

  const cardChildren = [poster];
  if (stateBadge) cardChildren.push(stateBadge);
  cardChildren.push(name, detailButton, meta, actions);
  card.append(...cardChildren);
  if (!handled) {
    card.addEventListener("click", () => startPackMovieRanking(pack, movie, "browse"));
    card.addEventListener("keydown", (event) => {
      if (event.target.closest("button")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startPackMovieRanking(pack, movie, "browse");
      }
    });
  }
  return card;
};

const renderPackDetail = () => {
  const pack = getPackBySlug(currentPackSlug);
  if (!pack) return;
  const stats = getPackStats(pack);
  packDetailCover.hidden = false;
  packDetailCover.innerHTML = "";
  createPackCover(pack).childNodes.forEach((child) => {
    packDetailCover.appendChild(child.cloneNode(true));
  });
  packDetailCategory.textContent = pack.category;
  packDetailTitle.textContent = pack.title;
  packDetailSub.textContent = pack.subtitle;
  packDetailProgressBar.style.width = `${Math.round(stats.progress * 100)}%`;
  packDetailStatus.textContent = `${stats.handled} handled · ${stats.remainingMovies.length} to go`;
  packAutoStart.hidden = false;
  packShowHandled.hidden = false;
  packSaveAll.hidden = false;
  packHideAll.hidden = false;
  packAutoStart.disabled = stats.remainingMovies.length === 0 || Boolean(pending);
  packSaveAll.disabled = stats.remainingMovies.length === 0 || Boolean(pending);
  packHideAll.disabled = stats.remainingMovies.length === 0 || Boolean(pending);
  packAutoStart.textContent = stats.remainingMovies.length ? "Rank all" : "Pack complete";
  packShowHandled.textContent = packDetailShowHandled ? "Hide handled" : "Show handled";

  packDetailList.innerHTML = "";
  const entries = packDetailShowHandled ? [...stats.remainingMovies, ...stats.handledMovies] : stats.remainingMovies;
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "suggest-empty";
    empty.textContent = stats.completed ? "Pack complete." : "No remaining movies to show.";
    packDetailList.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    packDetailList.appendChild(createPackMovieCard(pack, entry));
  });
};

const openAllPacks = () => {
  currentPackSlug = null;
  packDetailTrigger = packViewAll;
  packDetailOverlay.classList.add("is-all-packs");
  packDetailCover.hidden = true;
  packDetailCategory.textContent = "Packs";
  packDetailTitle.textContent = "All suggestion packs";
  packDetailSub.textContent = "Pick a set to rank, save, or hide through.";
  packDetailProgressBar.style.width = "0%";
  packDetailStatus.textContent = formatPackCountsLabel(false);
  packAutoStart.hidden = true;
  packShowHandled.hidden = true;
  packSaveAll.hidden = true;
  packHideAll.hidden = true;
  packDetailList.innerHTML = "";
  sortedPacksForDisplay(true).forEach((pack) => {
    packDetailList.appendChild(createPackCard(pack, { showCategory: true }));
  });
  packDetailOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
};

const isAutoPackComparison = () =>
  pendingPackContext?.type === "pack" &&
  pendingPackContext.mode === "auto" &&
  autoPackSession?.slug === pendingPackContext.slug;

const clearActiveComparison = () => {
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  searchRange = null;
  compareHistory = [];
  suggestionsRequestId += 1;
  setComparisonMode(false);
  compareSection.classList.add("panel--hidden");
  form.reset();
  titleInput.blur();
};

const stopAutoPack = ({ openDetail = true, message = "" } = {}) => {
  const slug = autoPackSession?.slug || pendingPackContext?.slug || currentPackSlug;
  autoPackSession = null;
  if (message) setAddFeedback(message, 2600);
  renderPackSurfaces();
  if (openDetail && slug) {
    openPackDetail(slug, { showHandled: packDetailShowHandled });
  }
};

const nextAutoPackEntry = (pack) => {
  if (!autoPackSession) return null;
  const stats = getPackStats(pack);
  const skipped = new Set(autoPackSession.skippedKeys || []);
  const remaining = stats.remainingMovies.filter((entry) => !skipped.has(movieKey(entry.movie)));
  if (!remaining.length) return null;
  const cursor = Number(autoPackSession.cursor) || 0;
  return remaining.find((entry) => entry.index >= cursor) || remaining[0];
};

const advanceAutoPack = () => {
  if (!autoPackSession) return;
  const pack = getPackBySlug(autoPackSession.slug);
  if (!pack) {
    stopAutoPack({ openDetail: false });
    return;
  }
  const nextEntry = nextAutoPackEntry(pack);
  if (!nextEntry) {
    const stats = getPackStats(pack);
    stopAutoPack({
      openDetail: true,
      message: stats.completed ? `"${pack.title}" complete.` : `"${pack.title}" paused.`,
    });
    return;
  }
  autoPackSession.cursor = nextEntry.index;
  markPackEngaged(pack, { lastIndex: nextEntry.index });
  startRankingMovie(nextEntry.movie, {
    type: "pack",
    slug: pack.slug,
    mode: "auto",
    index: nextEntry.index,
  });
};

const startAutoPack = (slug) => {
  const pack = getPackBySlug(slug);
  if (!pack || pending) return;
  const entry = normalizeProgressEntry(packProgress[slug] || {});
  autoPackSession = {
    slug,
    cursor: entry.lastIndex || 0,
    skippedKeys: [],
  };
  markPackEngaged(pack, { lastIndex: autoPackSession.cursor });
  closePackDetail({ restoreFocus: false });
  advanceAutoPack();
};

const skipCurrentPackMovie = () => {
  if (!pending || !isAutoPackComparison()) return;
  const pack = getPackBySlug(pendingPackContext.slug);
  const skippedKey = movieKey(pending);
  const nextIndex = Number(pendingPackContext.index || 0) + 1;
  autoPackSession = {
    ...autoPackSession,
    cursor: nextIndex,
    skippedKeys: [...(autoPackSession.skippedKeys || []), skippedKey],
  };
  if (pack) {
    markPackEngaged(pack, { lastIndex: nextIndex });
  }
  clearActiveComparison();
  // Same as the post-placement advance: re-enter the next comparison before
  // paint so skipping is a clean, gap-free swap.
  queueMicrotask(advanceAutoPack);
};

const maybeShowPackDiscoveryNudge = (movie) => {
  if (!movie?.tmdbId || !suggestionPacks.length) return;
  const now = Date.now();
  if (now - lastPackDiscoveryNudgeAt < PACK_DISCOVERY_NUDGE_COOLDOWN_MS) return;
  const slugs = packIndexByMovieId.get(movie.tmdbId) || [];
  const candidates = slugs
    .map(getPackBySlug)
    .filter(Boolean)
    .filter((pack) => {
      const stats = getPackStats(pack);
      return stats.discovered;
    })
    .sort((a, b) => getPackStats(b).handled - getPackStats(a).handled);
  const [pack] = candidates;
  if (!pack) return;
  lastPackDiscoveryNudgeAt = now;
  const relatedCount = candidates.length;
  setAddFeedback(
    `"${movie.title}" is in ${relatedCount === 1 ? pack.title : `${relatedCount} packs`}.`,
    8000,
    [
      {
        label: "Explore",
        onClick: () => openPackDetail(pack.slug),
      },
      {
        label: "Dismiss",
        muted: true,
        onClick: () => dismissPackDiscovery(pack.slug),
      },
    ],
  );
};

const handleRankingSettled = (rankedMovie, insertIndex, context) => {
  if (context?.type === "pack") {
    const pack = getPackBySlug(context.slug);
    if (pack) {
      markPackEngaged(pack, { lastIndex: Number(context.index || 0) + 1 });
      syncPackCompletion(pack);
      renderPackSurfaces();
      if (context.mode === "auto" && autoPackSession?.slug === pack.slug) {
        autoPackSession = {
          ...autoPackSession,
          cursor: Number(context.index || 0) + 1,
        };
        // Bring up the next comparison right away. queueMicrotask runs after
        // handleDecision fully unwinds (so its scroll-capture cleanup lands
        // first) but before the browser paints, so the panel swaps in with no
        // gap or flash. The placement toast lives on its own timer, fully
        // decoupled from the ranking flow.
        queueMicrotask(advanceAutoPack);
      } else {
        window.setTimeout(() => openPackDetail(pack.slug), 180);
      }
    }
    return;
  }
  renderPackSurfaces();
  window.setTimeout(() => maybeShowPackDiscoveryNudge(rankedMovie), 900);
};

const topRankedSeedCandidates = () => ranking.slice(0, 10).filter((movie) => movie.tmdbId);

const getPreviousInspiredSeed = () => {
  if (!storageEnabled) return null;
  try {
    const seed = Number(sessionStorage.getItem(INSPIRED_SEED_KEY));
    return Number.isFinite(seed) ? seed : null;
  } catch (error) {
    return null;
  }
};

const setPreviousInspiredSeed = (seedId) => {
  if (!storageEnabled || !seedId) return;
  try {
    sessionStorage.setItem(INSPIRED_SEED_KEY, String(seedId));
  } catch (error) {
    // Ignore blocked session storage.
  }
};

const pickRankedSuggestionSeed = () => {
  const candidates = topRankedSeedCandidates();
  if (!candidates.length) return null;
  const previousSeed = getPreviousInspiredSeed();
  const freshCandidates =
    candidates.length > 1
      ? candidates.filter(
          (movie) => movie.tmdbId !== activeSuggestionSeed && movie.tmdbId !== previousSeed,
        )
      : candidates;
  const candidatePool = freshCandidates.length ? freshCandidates : candidates;
  const index = Math.floor(Math.random() * candidatePool.length);
  const seed = candidatePool[index];
  setPreviousInspiredSeed(seed.tmdbId);
  return seed;
};

const getPersonalSuggestionSeed = () => {
  if (lastAddedTmdbId && rankedTmdbIds().has(lastAddedTmdbId)) {
    const movie = ranking.find((rankedMovie) => rankedMovie.tmdbId === lastAddedTmdbId);
    return {
      id: lastAddedTmdbId,
      source: "recent",
      label: `Because you just added ${movie?.title || "a movie"}`,
    };
  }
  const topRankedSeed =
    activeSuggestionSeed && rankedTmdbIds().has(activeSuggestionSeed)
      ? ranking.find((movie) => movie.tmdbId === activeSuggestionSeed)
      : pickRankedSuggestionSeed();
  if (!topRankedSeed) return null;
  return {
    id: topRankedSeed.tmdbId,
    source: "ranking",
    label: `Inspired by ${topRankedSeed.title}`,
  };
};

const sliceSuggestions = (items, cursor, size) => {
  if (!items.length) return [];
  const start = cursor % items.length;
  const end = start + size;
  const slice = items.slice(start, end);
  if (slice.length < size) {
    slice.push(...items.slice(0, size - slice.length));
  }
  return slice;
};

const createSuggestionRequest = () => {
  if (pending) {
    setSuggestionsHidden(true);
    return null;
  }
  const requestId = ++suggestionsRequestId;
  setSuggestionsHidden(false);
  return requestId;
};

const isStaleSuggestionRequest = (requestId) => pending || requestId !== suggestionsRequestId;

const updatePopularSuggestions = async (requestId = createSuggestionRequest()) => {
  if (!requestId) return;
  suggestPopularMore.disabled = true;
  setSuggestionLoading(suggestPopular);
  const popularAll = await fetchSuggestionList("popular");
  if (isStaleSuggestionRequest(requestId)) {
    return;
  }
  const popularFiltered = filterUnrankedSuggestions(popularAll);
  const popular = sliceSuggestions(popularFiltered, suggestPopularCursor, SUGGESTION_PAGE_SIZE);
  setSuggestionSectionState("popular", popularFiltered, popular);
  setSuggestionList("popular", suggestPopular, popular);
  suggestPopularMore.disabled = popularFiltered.length <= SUGGESTION_PAGE_SIZE;
};

const updateEssentialsSuggestions = async (requestId = createSuggestionRequest()) => {
  if (!requestId) return;
  suggestEssentialsMore.disabled = true;
  setSuggestionLoading(suggestEssentials);
  const essentialsAll = await fetchSuggestionList("essentials");
  if (isStaleSuggestionRequest(requestId)) {
    return;
  }
  const essentialsFiltered = filterUnrankedSuggestions(essentialsAll);
  const essentials = sliceSuggestions(
    essentialsFiltered,
    suggestEssentialsCursor,
    SUGGESTION_PAGE_SIZE,
  );
  setSuggestionSectionState("essentials", essentialsFiltered, essentials);
  setSuggestionList("essentials", suggestEssentials, essentials);
  suggestEssentialsMore.disabled = essentialsFiltered.length <= SUGGESTION_PAGE_SIZE;
};

const updateRelatedSuggestions = async (requestId = createSuggestionRequest()) => {
  if (!requestId) return;
  const personalSeed = getPersonalSuggestionSeed();
  if (personalSeed) {
    suggestRelatedMore.disabled = true;
    suggestRelatedSection.hidden = false;
    suggestRelatedTitle.textContent = personalSeed.label;
    suggestRelatedEmpty.style.display = "none";
    setSuggestionLoading(suggestRelated);
    if (activeSuggestionSeed !== personalSeed.id) {
      activeSuggestionSeed = personalSeed.id;
      suggestRelatedCursor = 0;
    }
    const relatedAll = await fetchSuggestionList("recommendations", personalSeed.id);
    if (isStaleSuggestionRequest(requestId)) {
      return;
    }
    const relatedFiltered = filterUnrankedSuggestions(relatedAll);
    const related = sliceSuggestions(relatedFiltered, suggestRelatedCursor, SUGGESTION_PAGE_SIZE);
    setSuggestionSectionState("related", relatedFiltered, related);
    setSuggestionList("related", suggestRelated, related);
    suggestRelatedMore.disabled = relatedFiltered.length <= SUGGESTION_PAGE_SIZE;
    suggestRelatedSection.hidden = related.length === 0;
    suggestRelatedEmpty.style.display = "none";
  } else {
    activeSuggestionSeed = null;
    setSuggestionSectionState("related", [], []);
    suggestRelatedSection.hidden = true;
    suggestRelated.innerHTML = "";
    suggestRelatedMore.disabled = true;
  }
};

const updateSuggestions = async () => {
  const requestId = createSuggestionRequest();
  if (!requestId) return;
  await Promise.all([
    updatePopularSuggestions(requestId),
    updateEssentialsSuggestions(requestId),
    updateRelatedSuggestions(requestId),
  ]);
};


const buildExportText = () => {
  if (!ranking.length) return "StackRank — Movies\n\n(No movies ranked yet.)";
  return buildShareText();
};

function getShareDisplayName(options = shareOptions) {
  return String(options.displayName || "").trim();
}

function possessiveName(name) {
  if (!name) return "";
  return `${name}${name.toLowerCase().endsWith("s") ? "'" : "'s"}`;
}

function lowercaseFirst(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "";
}

// Most-recently-added queue items first. Queue moves stamp savedAt/hiddenAt and
// push to the end, so we sort by timestamp desc and fall back to array order
// (newest last) for legacy items that predate the timestamps.
function recentQueueItems(list, timestampKey, count) {
  return [...(list || [])]
    .map((movie, index) => ({ movie, index }))
    .sort((a, b) => (Number(b.movie[timestampKey] || 0) - Number(a.movie[timestampKey] || 0)) || (b.index - a.index))
    .slice(0, count)
    .map((entry) => entry.movie);
}

function getSharePickGroups(insights) {
  const movies = insights.enrichedRanking || [];
  const bestCount = Math.min(5, Math.ceil(movies.length / 2));
  const worstCount = Math.min(5, Math.floor(movies.length / 2));
  return {
    best: movies.slice(0, bestCount),
    worst: worstCount ? movies.slice(movies.length - worstCount) : [],
    worstStartRank: worstCount ? movies.length - worstCount + 1 : 0,
  };
}

function movieExportLine(movie, rank = null) {
  const year = movie.year ? ` (${movie.year})` : "";
  return `${rank ? `${rank}. ` : ""}${movie.title}${year}`;
}

function rankedCountLabel(count) {
  return `${count} ranked`;
}

function shareRankingMetaCards(insights) {
  if (insights.perMovieRankDatesTracked) {
    return [
      { label: "First movie ranked on", value: insights.firstRankedAt ? formatShortDate(insights.firstRankedAt) : "Not tracked" },
      { label: "Most recent movie ranked", value: insights.lastRankedAt ? formatShortDate(insights.lastRankedAt) : "Not tracked" },
      { label: "Most ranked in one day", value: insights.busiestDay ? rankedCountLabel(insights.busiestDay.count) : "Not tracked" },
    ];
  }

  return [
    { label: "List last updated", value: insights.rankingUpdatedAt ? formatShortDate(insights.rankingUpdatedAt) : "Not tracked" },
    { label: "Per-movie rank dates", value: "Not tracked" },
    { label: "Most ranked in one day", value: "Not tracked" },
  ];
}

function buildShareExportTitle(options = shareOptions) {
  const tone = getShareTone(options.tone);
  const displayName = getShareDisplayName(options);
  return displayName ? `${possessiveName(displayName)} ${lowercaseFirst(tone.heroLead)}` : tone.heroLead;
}

function buildShareExportSections(insights = getRankingInsights(), options = shareOptions) {
  const tone = getShareTone(options.tone);
  const picks = getSharePickGroups(insights);
  const sections = [];

  if (options.top && picks.best.length) {
    sections.push({
      key: "top",
      title: tone.topTitle,
      subtitle: tone.topSub,
      lines: picks.best.map((movie, index) => movieExportLine(movie, index + 1)),
    });
  }

  if (options.bottom && picks.worst.length) {
    sections.push({
      key: "bottom",
      title: tone.bottomTitle,
      subtitle: tone.bottomSub,
      lines: picks.worst.map((movie, index) => movieExportLine(movie, picks.worstStartRank + index)),
    });
  }

  if (options.eras && insights.decades.length) {
    const topDecade = insights.topDecade ? decadeLabel(insights.topDecade.decade) : "Unknown";
    const oldest = insights.oldest
      ? `${insights.oldest.year} - ${insights.oldest.movie.title}`
      : "Unknown";
    const newest = insights.newest
      ? `${insights.newest.year} - ${insights.newest.movie.title}`
      : "Unknown";
    const decadeRows = insights.decades.slice(0, 6).sort((a, b) => b.decade - a.decade);
    sections.push({
      key: "eras",
      title: tone.erasTitle,
      subtitle: "Release years across your ranking",
      lines: [
        `Highest ranked decade: ${topDecade}`,
        `Average release year: ${insights.averageYear ? String(insights.averageYear) : "Unknown"}`,
        `Oldest ranked movie: ${oldest}`,
        `Newest ranked movie: ${newest}`,
        "",
        "Ranked movies by decade:",
        ...decadeRows.map((item) => `${decadeLabel(item.decade)}: ${rankedCountLabel(item.count)}`),
      ],
    });
  }

  if (options.genres) {
    const bottomPull = insights.genres.length
      ? insights.bottomGenres.find((item) => item.name !== insights.genres[0].name) || insights.bottomGenres[0]
      : null;
    const lines = insights.genres.length
      ? [
          `Highest ranked genre: ${insights.genres[0].name} (${rankedCountLabel(insights.genres[0].count)})`,
          `Lowest ranked genre: ${bottomPull?.name || "Unknown"}${
            bottomPull ? ` (${rankedCountLabel(bottomPull.count)})` : ""
          }`,
          "",
          "Ranked movies by genre:",
          ...insights.genres.slice(0, 6).map((item) => `${item.name}: ${rankedCountLabel(item.count)}`),
        ]
      : ["No genre data loaded yet."];
    sections.push({
      key: "genres",
      title: tone.genresTitle,
      subtitle: "Genres that rise to the top",
      lines,
    });
  }

  if (options.people) {
    const lines =
      insights.directors.length || insights.cast.length
        ? [
            `Highest ranked director: ${insights.directors[0]?.name || "Unknown"}${
              insights.directors[0] ? ` (${rankedCountLabel(insights.directors[0].count)})` : ""
            }`,
            `Highest ranked cast member: ${insights.cast[0]?.name || "Unknown"}${
              insights.cast[0] ? ` (${rankedCountLabel(insights.cast[0].count)})` : ""
            }`,
            "",
            "Directors by ranked appearances:",
            ...insights.directors.slice(0, 8).map((item) => `${item.name}: ${rankedCountLabel(item.count)}`),
            "",
            "Cast by ranked appearances:",
            ...insights.cast.slice(0, 8).map((item) => `${item.name}: ${rankedCountLabel(item.count)}`),
          ]
        : ["No cast or crew data loaded yet."];
    sections.push({
      key: "people",
      title: tone.peopleTitle,
      subtitle: "Directors and cast that rise to the top",
      lines,
    });
  }

  if (options.queues) {
    const watchRuntime = runtimeStatsForMovies(watchList);
    const hiddenRuntime = runtimeStatsForMovies(notInterestedList);
    const watchRuntimeDisplay = formatShareRuntimeTotal(watchRuntime, watchList.length, shareDetailsLoading);
    const hiddenRuntimeDisplay = formatShareRuntimeTotal(hiddenRuntime, notInterestedList.length, shareDetailsLoading);
    const watchTitles = watchList.slice(0, 3).map((movie) => movie.title).join(" / ") || "Nothing saved";
    const hiddenTitles = notInterestedList.slice(0, 3).map((movie) => movie.title).join(" / ") || "Nothing hidden";
    sections.push({
      key: "queues",
      title: tone.queuesTitle,
      subtitle: "Movies outside the ranked stack",
      lines: [
        `Saved for later: ${watchList.length}`,
        `Pending watch time: ${watchRuntimeDisplay.value}`,
        watchTitles,
        `Hidden from view: ${notInterestedList.length}`,
        `${hiddenRuntimeLabel(options.tone)}: ${hiddenRuntimeDisplay.value}`,
        hiddenTitles,
      ],
    });
  }

  if (options.fullList && insights.enrichedRanking.length) {
    const metaCards = shareRankingMetaCards(insights);
    sections.push({
      key: "fullList",
      title: tone.listTitle,
      subtitle: "Every movie, top to bottom",
      lines: [
        ...metaCards.map((item) => `${item.label}: ${item.value}`),
        "",
        ...insights.enrichedRanking.map((movie, index) => movieExportLine(movie, index + 1)),
      ],
    });
  }

  return sections;
}

function buildShareMarkdown() {
  const insights = getRankingInsights();
  if (!insights.count) return buildExportText();
  const sections = buildShareExportSections(insights);
  return [
    `# ${buildShareExportTitle()}`,
    "",
    `Generated ${formatShortDate(new Date().toISOString())}`,
    ...sections.flatMap((section) => [
      "",
      `## ${section.title}`,
      ...(section.subtitle ? [`_${section.subtitle}_`, ""] : []),
      ...section.lines,
    ]),
  ].join("\n");
}

function buildShareText() {
  const insights = getRankingInsights();
  if (!insights.count) return "StackRank - Movies\n\n(No movies ranked yet.)";
  const sections = buildShareExportSections(insights);
  return [
    buildShareExportTitle(),
    `Generated ${formatShortDate(new Date().toISOString())}`,
    ...sections.flatMap((section) => [
      "",
      section.title,
      ...(section.subtitle ? [section.subtitle] : []),
      ...section.lines,
    ]),
  ].join("\n");
}

function buildShareDataExport() {
  const insights = getRankingInsights();
  const watchRuntime = runtimeStatsForMovies(watchList);
  const hiddenRuntime = runtimeStatsForMovies(notInterestedList);
  return {
    generatedAt: new Date().toISOString(),
    title: buildShareExportTitle(),
    options: shareOptions,
    sections: buildShareExportSections(insights).map((section) => ({
      key: section.key,
      title: section.title,
      subtitle: section.subtitle,
      lines: section.lines,
    })),
    ranking: ranking.map((movie, index) => ({ rank: index + 1, ...movie })),
    watchList,
    notInterestedList,
    insights: {
      rankedCount: insights.count,
      watchCount: insights.watchCount,
      hiddenCount: insights.hiddenCount,
      averageYear: insights.averageYear,
      medianYear: insights.medianYear,
      yearSpan: insights.yearSpan,
      topDecade: insights.topDecade,
      firstRankedAt: insights.firstRankedAt,
      lastRankedAt: insights.lastRankedAt,
      rankingUpdatedAt: insights.rankingUpdatedAt,
      perMovieRankDatesTracked: insights.perMovieRankDatesTracked,
      busiestDay: insights.busiestDay,
      genres: insights.genres,
      bottomGenres: insights.bottomGenres,
      directors: insights.directors,
      cast: insights.cast,
      queueRuntimeMinutes: {
        saved: watchRuntime.minutes,
        hidden: hiddenRuntime.minutes,
      },
    },
  };
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value, maxChars, maxLines = 2) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.,;:!?]+$/, "")}...`;
  return clipped;
}

function estimateSvgTextWidth(value, fontSize) {
  return Array.from(String(value || "")).reduce((width, char) => {
    if (char === " ") return width + fontSize * 0.36;
    if (/[MW@#%&]/.test(char)) return width + fontSize * 0.88;
    if (/[A-Z0-9]/.test(char)) return width + fontSize * 0.7;
    if (/[ilI.,'!:;]/.test(char)) return width + fontSize * 0.34;
    return width + fontSize * 0.6;
  }, 0);
}

function trimTextToSvgWidth(value, maxWidth, fontSize) {
  const ellipsis = "...";
  const chars = Array.from(String(value || "").trim());
  while (chars.length && estimateSvgTextWidth(`${chars.join("").trimEnd()}${ellipsis}`, fontSize) > maxWidth) {
    chars.pop();
  }
  return `${chars.join("").trimEnd().replace(/[.,;:!?]+$/, "")}${ellipsis}`;
}

function wrapTextToSvgWidth(value, maxWidth, fontSize, maxLines = 2) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  const pushCurrent = () => {
    if (!current) return;
    lines.push(current);
    current = "";
  };

  words.forEach((word) => {
    let remainingWord = word;
    while (remainingWord) {
      const candidate = current ? `${current} ${remainingWord}` : remainingWord;
      if (estimateSvgTextWidth(candidate, fontSize) <= maxWidth) {
        current = candidate;
        remainingWord = "";
        continue;
      }

      if (current) {
        pushCurrent();
        continue;
      }

      let segment = "";
      for (const char of Array.from(remainingWord)) {
        const nextSegment = `${segment}${char}`;
        if (segment && estimateSvgTextWidth(nextSegment, fontSize) > maxWidth) break;
        segment = nextSegment;
      }
      lines.push(segment || remainingWord[0]);
      remainingWord = remainingWord.slice(segment.length || 1);
    }
  });

  pushCurrent();
  if (!Number.isFinite(maxLines)) return lines;
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = trimTextToSvgWidth(clipped[maxLines - 1], maxWidth, fontSize);
  return clipped;
}

function getShareTheme(themeName = shareOptions.theme) {
  const themes = {
    classic: {
      bg: "#f6f6f2",
      ink: "#111111",
      muted: "#6f6f68",
      line: "#111111",
      panel: "#ffffff",
      accent: "#2f6f73",
      accent2: "#b4432f",
      faint: "#e4e1d9",
      danger: "#b4432f",
      hero: "#111111",
      section: "#6f6f68",
      frame: "#111111",
      panelLine: "#111111",
    },
    cinema: {
      bg: "#0d0d0b",
      ink: "#fff7e6",
      muted: "#b8ad98",
      line: "#e7c65f",
      panel: "#191815",
      accent: "#e7c65f",
      accent2: "#7eb8c4",
      faint: "#2c2921",
      danger: "#d46a4c",
      hero: "#e7c65f",
      section: "#7eb8c4",
      frame: "#e7c65f",
      panelLine: "#4b4332",
    },
    marquee: {
      bg: "#170f0d",
      ink: "#fff4d4",
      muted: "#d3b77a",
      line: "#f0c866",
      panel: "#261714",
      accent: "#f0c866",
      accent2: "#c1352b",
      faint: "#3a2820",
      danger: "#f05f45",
      hero: "#fff4d4",
      section: "#f0c866",
      frame: "#f0c866",
      panelLine: "#7c2c24",
    },
    pop: {
      bg: "#141026",
      ink: "#fffaf0",
      muted: "#b9b4ff",
      line: "#ff4fb8",
      panel: "#211640",
      accent: "#18d8ff",
      accent2: "#ffd23f",
      faint: "#322050",
      danger: "#ff5b6e",
      hero: "#ffd23f",
      section: "#18d8ff",
      frame: "#ff4fb8",
      panelLine: "#8efc6c",
    },
    warm: {
      bg: "#fbf0de",
      ink: "#24150e",
      muted: "#8a5841",
      line: "#7d3a25",
      panel: "#fff9ed",
      accent: "#b34a32",
      accent2: "#26756a",
      faint: "#efd5b6",
      danger: "#9f3f35",
      hero: "#7d3a25",
      section: "#26756a",
      frame: "#7d3a25",
      panelLine: "#d49970",
    },
  };
  return themes[themeName] || themes.classic;
}

function getShareTone(toneName = shareOptions.tone) {
  const tones = {
    neutral: {
      heroLead: "Movie ranking",
      topTitle: "The best",
      topSub: "Top ranked",
      bottomTitle: "The worst",
      bottomSub: "Bottom ranked",
      erasTitle: "Movie eras",
      genresTitle: "Genre fingerprint",
      peopleTitle: "Cast + crew pull",
      queuesTitle: "Still deciding",
      listTitle: "The whole stack",
    },
    punchy: {
      heroLead: "Definitive movie stack",
      topTitle: "Certified winners",
      topSub: "No notes at the top",
      bottomTitle: "Bottom of the barrel",
      bottomSub: "A brave little danger zone",
      erasTitle: "Time machine",
      genresTitle: "Genre bias",
      peopleTitle: "Repeat offenders",
      queuesTitle: "On deck / ruled out",
      listTitle: "Complete ranking",
    },
    funny: {
      heroLead: "Movie opinions nobody asked for",
      topTitle: "Would defend these in court",
      topSub: "The beloved few",
      bottomTitle: "Questions were raised",
      bottomSub: "The emotional support villains",
      erasTitle: "Decades under review",
      genresTitle: "Genre cravings",
      peopleTitle: "Suspiciously trusted people",
      queuesTitle: "Future judgment",
      listTitle: "The entire situation",
    },
    extreme: {
      heroLead: "Movie verdicts",
      topTitle: "Masterpieces only",
      topSub: "The highest conviction picks",
      bottomTitle: "Hard passes",
      bottomSub: "The far end of the stack",
      erasTitle: "Era convictions",
      genresTitle: "Genre loyalties",
      peopleTitle: "Repeat power players",
      queuesTitle: "Still under review",
      listTitle: "Every placement",
    },
  };
  return tones[toneName] || tones.neutral;
}

function svgTextLines(lines, x, y, className, lineHeight, extra = "") {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}" ${extra}>${xmlEscape(line)}</text>`,
    )
    .join("");
}

function posterDataFor(movie, allowExternal = true, useProxy = false) {
  if (!movie?.posterPath) return null;
  if (posterDataCache.has(movie.posterPath)) return posterDataCache.get(movie.posterPath);
  if (!allowExternal) return null;
  if (useProxy && tmdbImageUrl) {
    return `${tmdbImageUrl}?path=${encodeURIComponent(movie.posterPath)}&size=w342`;
  }
  return `${TMDB_POSTER_SMALL}${movie.posterPath}`;
}

function shareSvgStyles(theme, heroFontSize, heroFill, sectionFill) {
  return `
    .brand { font: 700 32px Arial, Helvetica, sans-serif; letter-spacing: 7px; text-transform: uppercase; fill: ${theme.ink}; }
    .kicker { font: 500 24px Arial, Helvetica, sans-serif; letter-spacing: 5px; text-transform: uppercase; fill: ${theme.muted}; }
    .hero { font: 700 ${heroFontSize}px Arial, Helvetica, sans-serif; fill: ${heroFill}; }
    .section-title { font: 700 38px Arial, Helvetica, sans-serif; letter-spacing: 4px; text-transform: uppercase; fill: ${sectionFill}; }
    .section-sub { font: 500 27px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .pick-title { font: 700 36px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .pick-meta, .stat-label, .bar-label, .bar-count, .range-span, .footer { font: 500 25px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .rank-number { font: 700 27px Arial, Helvetica, sans-serif; fill: ${theme.bg}; }
    .deep-rank { font: 700 24px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-value { font: 700 54px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-value-small { font: 700 30px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-card-label { font: 700 21px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .stat-card-value { font: 700 25px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-card-value-emphasis { font: 700 30px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .chart-caption { font: 700 22px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .queue-runtime { font: 700 40px Arial, Helvetica, sans-serif; }
    .queue-runtime-small { font: 700 30px Arial, Helvetica, sans-serif; }
    .people-heading { font: 700 27px Arial, Helvetica, sans-serif; fill: ${theme.section || theme.ink}; text-transform: uppercase; letter-spacing: 4px; }
    .people-label { font: 500 21px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .range-year { font: 700 42px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .range-title { font: 700 31px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .range-title-small { font: 700 25px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .poster-title { font: 700 20px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-text-title { font: 700 22px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .poster-title-compact { font: 700 18px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-30 { font: 700 30px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-28 { font: 700 28px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-26 { font: 700 26px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-24 { font: 700 24px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-22 { font: 700 22px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-20 { font: 700 20px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .poster-rank { font: 400 20px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .poster-number-badge { font: 700 15px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
  `;
}

// Wraps composed inner content in the outer SVG frame (background + border).
// width/height are the page dimensions; the border insets 44px on every side,
// matching the original single-poster geometry (1112 = 1200 - 88).
function renderShareSvg({ width, height, theme, heroFontSize, heroFill, sectionFill, inner }) {
  const frameStroke = theme.frame || theme.line;
  const borderHeight = height - 88;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="StackRank movie list share image">
  <style>${shareSvgStyles(theme, heroFontSize, heroFill, sectionFill)}</style>
  <rect width="${width}" height="${height}" fill="${theme.bg}" />
  <rect x="44" y="44" width="${width - 88}" height="${borderHeight}" rx="38" fill="none" stroke="${frameStroke}" stroke-width="4" />
  ${inner}
</svg>`;
}

// The shared hero/brand/divider header. `kicker` defaults to "Movies" (the
// single-poster look); image-set cards pass a group label + counter instead.
// Returns the header SVG plus the geometry the page composer needs.
function buildShareHeader(width, theme, tone, options, { kicker = "Movies" } = {}) {
  const displayName = getShareDisplayName(options);
  const heroTitle = displayName ? `${possessiveName(displayName)} ${lowercaseFirst(tone.heroLead)}` : tone.heroLead;
  const topTitleLines = wrapText(heroTitle, 24, 3);
  const heroFontSize = topTitleLines.length >= 3 ? 58 : topTitleLines.length === 2 ? 68 : 78;
  const heroLineHeight = Math.round(heroFontSize * 1.08);
  const dividerY = 286 + (topTitleLines.length - 1) * heroLineHeight + 72;
  const sectionsStartY = dividerY + 96;
  const frameStroke = theme.frame || theme.line;
  const svg = `<text x="86" y="122" class="brand">StackRank</text>
  <text x="86" y="168" class="kicker">${xmlEscape(kicker)}</text>
  ${svgTextLines(topTitleLines, 86, 280, "hero", heroLineHeight)}
  <path d="M86 ${dividerY}H${width - 86}" stroke="${frameStroke}" stroke-width="4" />`;
  return {
    svg,
    heroFontSize,
    heroFill: theme.hero || theme.ink,
    sectionFill: theme.section || theme.muted,
    dividerY,
    sectionsStartY,
  };
}

// Places a single section descriptor in single-column flow at `startY`.
// This reproduces the original addSection() math exactly.
function placeSectionFlow(desc, startY, marginX = 86) {
  // Roomier offsets to suit the larger section title (38px) and subtitle (27px).
  const bodyOffset = desc.subtitle ? 88 : 64;
  const bodyY = startY + bodyOffset;
  const nextY = bodyY + desc.height + 72;
  const titleSvg = `<text x="${marginX}" y="${startY}" class="section-title">${xmlEscape(desc.title)}</text>`;
  const subSvg = desc.subtitle
    ? `<text x="${marginX}" y="${startY + 44}" class="section-sub">${xmlEscape(desc.subtitle)}</text>`
    : "";
  const svg = `${titleSvg}${subSvg}<g transform="translate(0 ${bodyY})">${desc.body}</g>`;
  return { svg, nextY };
}

function shareFooterSvg(width, height) {
  const generated = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const footerY = height - 100;
  return `<text x="86" y="${footerY}" class="footer">Generated ${xmlEscape(generated)}</text>
  <text x="${width - 86}" y="${footerY}" class="footer" text-anchor="end">stackrank movies</text>`;
}

// Width-agnostic section descriptor builders. Each returns
// { key, title, subtitle, body, height } positioned for a 1200-wide content
// column, or null when its toggle is off / there is no data. Whole sections are
// tiled by the page composers, so the internal geometry never changes between
// Portrait, Landscape and image-set cards.
function shareSectionBuilders(insights, theme, tone, options) {
  const marginX = 86;
  // Symmetric content box: left and right margins both equal marginX on the
  // 1200-wide content column, so every section lines up on the right edge
  // (1114) the same as the left (86). The 2-up cards fill it with one gap.
  const contentRight = 1200 - marginX; // 1114
  const colGap = 44;
  const cardW = Math.round((contentRight - marginX - colGap) / 2); // 492
  const colUnit = cardW + colGap; // 536 (distance between the two column lefts)
  const panelStroke = theme.panelLine || theme.line;
  const pickGroups = getSharePickGroups(insights);
  const allowExternalPosters = options.externalPosters !== false;
  const usePosterProxy = options.posterProxy === true;
  const barLabelX = 86;
  const barTrackX = 398;
  // Track + count extend to the right edge of the cards above, with the count
  // right-aligned there (like Cast & crew).
  const barCountRight = contentRight;
  const barCountPad = 64;
  const barTrackWidth = barCountRight - barCountPad - barTrackX;
  const barHeight = 28;

  const section = (key, title, subtitle, body, height) =>
    body ? { key, title, subtitle, body, height } : null;

  // Placeholder body for a section whose data is still being fetched (genres,
  // cast & crew). A caption plus a few pulsing skeleton bars so the customer
  // can see content is on the way rather than an empty / "no data" card.
  const loadingBody = (caption) => {
    const widths = [620, 520, 700, 460, 580];
    const bars = widths
      .map((w, i) => `<rect x="86" y="${64 + i * 46}" width="${w}" height="26" rx="13" fill="${theme.faint}" />`)
      .join("");
    const body =
      `<text x="86" y="30" class="people-heading">${xmlEscape(caption)}</text>` +
      `<g opacity="0.6"><animate attributeName="opacity" values="0.3;0.85;0.3" dur="1.3s" repeatCount="indefinite" />${bars}</g>`;
    return { body, height: 64 + widths.length * 46 + 6 };
  };

  const movieRow = (movie, rank, rowY, variant = "top") => {
    const titleLines = wrapTextToSvgWidth(movie.title, 930, 36, 2);
    const metaY = rowY + (titleLines.length > 1 ? 50 : 34);
    const fill = variant === "bottom" ? theme.faint : theme.ink;
    const numberClass = variant === "bottom" ? "deep-rank" : "rank-number";
    const stroke = variant === "bottom" ? `stroke="${panelStroke}" stroke-width="3"` : "";
    return `<circle cx="112" cy="${rowY - 10}" r="28" fill="${fill}" ${stroke} />
      <text x="112" y="${rowY}" class="${numberClass}" text-anchor="middle">${rank}</text>
      ${svgTextLines(titleLines, 164, rowY - (titleLines.length > 1 ? 12 : 0), "pick-title", 36)}
      <text x="164" y="${metaY}" class="pick-meta">${xmlEscape(movie.year ? `Released ${movie.year}` : "Year unknown")}</text>`;
  };

  const countBarRow = (item, index, rowY, maxCount, label) => {
    const barWidth = Math.max(60, Math.round((item.count / Math.max(1, maxCount)) * barTrackWidth));
    return `<text x="${barLabelX}" y="${rowY + 20}" class="bar-label">${xmlEscape(label)}</text>
      <rect x="${barTrackX}" y="${rowY - 4}" width="${barTrackWidth}" height="${barHeight}" rx="14" fill="${theme.faint}" />
      <rect x="${barTrackX}" y="${rowY - 4}" width="${barWidth}" height="${barHeight}" rx="14" fill="${index % 2 ? theme.accent2 : theme.accent}" />
      <text x="${barCountRight}" y="${rowY + 20}" class="bar-count" text-anchor="end">${item.count}</text>`;
  };

  // A poster + title cell (the image-set "mixed" row style), reusable across the
  // saved/hidden sections at different widths. Title font shrinks to fit two
  // lines; meta sits beneath. The whole group is vertically centered in the cell.
  const mixedMovieCell = (movie, x, y, cellW, cellH, opts = {}) => {
    const cellPad = opts.cellPad ?? 18;
    const posterW = opts.posterW ?? 88;
    const posterH = opts.posterH ?? 130;
    const titleSizes = opts.titleSizes ?? [30, 28, 26, 24];
    const posterYOffset = Math.round((cellH - posterH) / 2);
    const titleXOffset = cellPad + posterW + 22;
    const titleW = cellW - titleXOffset - cellPad;
    const titleFit = (title) => {
      for (const fontSize of titleSizes) {
        const lines = wrapTextToSvgWidth(title, titleW, fontSize, Infinity);
        if (lines.length <= 2) return { lines, fontSize, lineHeight: Math.round(fontSize * 1.16) };
      }
      const fontSize = titleSizes[titleSizes.length - 1];
      return { lines: wrapTextToSvgWidth(title, titleW, fontSize, 2), fontSize, lineHeight: Math.round(fontSize * 1.16) };
    };
    const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
    const title = titleFit(movie.title);
    const meta = movie.year ? `Released ${movie.year}` : "Year unknown";
    const metaGap = 26;
    const titleAscent = Math.round(title.fontSize * 0.76);
    const groupHeight = titleAscent + (title.lines.length - 1) * title.lineHeight + metaGap + 5;
    const titleY = y + Math.round((cellH - groupHeight) / 2) + titleAscent;
    const metaY = titleY + (title.lines.length - 1) * title.lineHeight + metaGap;
    const posterX = x + cellPad;
    const posterY = y + posterYOffset;
    const titleX = x + titleXOffset;
    let cell = `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="16" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
    if (posterData) {
      cell += `<image href="${xmlEscape(posterData)}" x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" preserveAspectRatio="xMidYMid slice" />`;
    } else {
      cell += `<rect x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" rx="10" fill="${theme.faint}" />`;
    }
    cell += svgTextLines(title.lines, titleX, titleY, `full-list-row-title-${title.fontSize}`, title.lineHeight);
    cell += `<text x="${titleX}" y="${metaY}" class="poster-rank">${xmlEscape(meta)}</text>`;
    return cell;
  };

  // Extra breathing room between the "Top ranked" / "Bottom ranked" subtitle
  // and the first row of the list.
  const pickRowTop = 46;
  const topPicks = () => {
    if (!options.top || !pickGroups.best.length) return null;
    let block = "";
    pickGroups.best.forEach((movie, index) => {
      block += movieRow(movie, index + 1, index * 86 + pickRowTop, "top");
    });
    return section("top", tone.topTitle, tone.topSub, block, pickGroups.best.length * 86 + 8 + (pickRowTop - 22));
  };

  const bottomPicks = () => {
    if (!options.bottom || !pickGroups.worst.length) return null;
    let block = "";
    pickGroups.worst.forEach((movie, index) => {
      const rank = pickGroups.worstStartRank + index;
      block += movieRow(movie, rank, index * 82 + pickRowTop, "bottom");
    });
    return section("bottom", tone.bottomTitle, tone.bottomSub, block, pickGroups.worst.length * 82 + 10 + (pickRowTop - 22));
  };

  const eras = () => {
    if (!options.eras || !insights.decades.length) return null;
    let block = "";
    const topDecade = insights.topDecade ? decadeLabel(insights.topDecade.decade) : "Unknown";
    const oldest = insights.oldest
      ? `${insights.oldest.year} · ${insights.oldest.movie.title}`
      : "Unknown";
    const newest = insights.newest
      ? `${insights.newest.year} · ${insights.newest.movie.title}`
      : "Unknown";
    const decadeRows = insights.decades.slice(0, 6).sort((a, b) => b.decade - a.decade);
    const eraMetrics = [
      { label: "Highest ranked decade", value: topDecade, emphasis: true },
      { label: "Avg. release year", value: insights.averageYear ? String(insights.averageYear) : "Unknown", emphasis: true },
      { label: "Oldest ranked movie", value: oldest },
      { label: "Newest ranked movie", value: newest },
    ];
    eraMetrics.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = marginX + col * colUnit;
      const cardY = row * 138;
      const innerX = x + 24;
      const innerWidth = cardW - 48;
      // All era values use the same value size as the genre / cast / director cards.
      const valueLines = wrapTextToSvgWidth(item.value, innerWidth, 30, 2);
      block += `<rect x="${x}" y="${cardY}" width="${cardW}" height="118" rx="20" fill="${item.emphasis ? theme.faint : theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
      block += `<text x="${innerX}" y="${cardY + 34}" class="stat-card-label">${xmlEscape(item.label)}</text>`;
      block += svgTextLines(valueLines, innerX, cardY + 80 - (valueLines.length > 1 ? 10 : 0), "stat-value-small", 30);
    });
    const chartY = 338;
    const barsY = chartY + 36;
    block += `<text x="${barLabelX}" y="${chartY}" class="people-heading">Ranked movies by decade</text>`;
    const maxDecadeCount = Math.max(1, ...decadeRows.map((item) => item.count));
    decadeRows.forEach((item, index) => {
      const rowY = barsY + index * 58 + 10;
      block += countBarRow(item, index, rowY, maxDecadeCount, decadeLabel(item.decade));
    });
    return section(
      "eras",
      tone.erasTitle,
      "Release years across your ranking",
      block,
      barsY + decadeRows.length * 58 + 28,
    );
  };

  const genres = () => {
    if (!options.genres) return null;
    if (!insights.genres.length) {
      if (shareDetailsLoading) {
        const sk = loadingBody("Loading genre data…");
        return section("genres", tone.genresTitle, "Genres that rise to the top", sk.body, sk.height);
      }
      return section(
        "genres",
        tone.genresTitle,
        "Genres that rise to the top",
        `<text x="86" y="24" class="pick-meta">No genre data loaded yet.</text>`,
        62,
      );
    }
    const favorite = insights.genres[0];
    const bottomPull = insights.bottomGenres.find((item) => item.name !== favorite.name) || insights.bottomGenres[0] || favorite;
    const maxGenreCount = Math.max(...insights.genres.map((item) => item.count));
    const genreCards = [
      { label: "Highest ranked genre", value: favorite.name, count: favorite.count },
      { label: "Lowest ranked genre", value: bottomPull.name, count: bottomPull.count },
    ];
    let block = "";
    genreCards.forEach((item, index) => {
      const x = marginX + index * colUnit;
      const valueLines = wrapTextToSvgWidth(item.value, cardW - 146, 30, 1);
      block += `<rect x="${x}" y="0" width="${cardW}" height="118" rx="24" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
      block += `<text x="${x + 26}" y="42" class="stat-card-label">${xmlEscape(item.label)}</text>`;
      block += svgTextLines(valueLines, x + 26, 86, "stat-value-small", 30);
      block += `<text x="${x + cardW - 28}" y="72" class="bar-count" text-anchor="end">${item.count} ranked</text>`;
    });
    // Match the gap above "Ranked movies by decade" (82px below the cards).
    const chartY = 200;
    const barsY = chartY + 36;
    block += `<text x="${barLabelX}" y="${chartY}" class="people-heading">Ranked movies by genre</text>`;
    // Show the 6 most-ranked genres, but list them alphabetically in the chart.
    const chartGenres = insights.genres.slice(0, 6).slice().sort((a, b) => a.name.localeCompare(b.name));
    chartGenres.forEach((item, index) => {
      const rowY = barsY + index * 58 + 10;
      block += countBarRow(item, index, rowY, maxGenreCount, item.name);
    });
    return section(
      "genres",
      tone.genresTitle,
      "Genres that rise to the top",
      block,
      barsY + insights.genres.slice(0, 6).length * 58 + 28,
    );
  };

  const people = () => {
    if (!options.people) return null;
    if (!insights.directors.length && !insights.cast.length) {
      if (shareDetailsLoading) {
        const sk = loadingBody("Loading cast & crew data…");
        return section("people", tone.peopleTitle, "Directors and cast that rise to the top", sk.body, sk.height);
      }
      return section(
        "people",
        tone.peopleTitle,
        "Directors and cast that rise to the top",
        `<text x="86" y="24" class="pick-meta">No cast or crew data loaded yet.</text>`,
        62,
      );
    }
    const favoriteDirector = insights.directors[0];
    const favoriteActor = insights.cast[0];
    const callouts = [
      { label: "Highest ranked director", value: favoriteDirector?.name || "Unknown", count: favoriteDirector?.count || 0 },
      { label: "Highest ranked cast", value: favoriteActor?.name || "Unknown", count: favoriteActor?.count || 0 },
    ];
    const calloutLineSets = callouts.map((item) => wrapTextToSvgWidth(item.value, cardW - 176, 30, Infinity));
    const calloutHeight = Math.max(118, 80 + Math.max(...calloutLineSets.map((lines) => lines.length)) * 30);
    let block = "";
    callouts.forEach((item, index) => {
      const x = marginX + index * colUnit;
      const valueLines = calloutLineSets[index];
      block += `<rect x="${x}" y="0" width="${cardW}" height="${calloutHeight}" rx="24" fill="${theme.panel}" stroke="${theme.panelLine || theme.line}" stroke-width="3" />`;
      block += `<text x="${x + 26}" y="46" class="stat-card-label">${xmlEscape(item.label)}</text>`;
      block += svgTextLines(valueLines, x + 26, 86, "stat-value-small", 30);
      if (item.count) {
        block += `<text x="${x + cardW - 28}" y="72" class="bar-count" text-anchor="end">${item.count} ranked</text>`;
      }
    });
    const peopleTrackWidth = cardW - 84;
    const renderPeopleColumn = (label, items, x, startY) => {
      const visibleItems = items.slice(0, 8);
      const maxCount = Math.max(1, ...visibleItems.map((item) => item.count));
      let column = `<text x="${x}" y="${startY}" class="people-heading">${xmlEscape(label)}</text>`;
      if (!visibleItems.length) {
        return {
          body: `${column}<text x="${x}" y="${startY + 44}" class="pick-meta">No data loaded.</text>`,
          height: 82,
        };
      }
      let cursorY = startY + 44;
      visibleItems.forEach((item, index) => {
        const trackX = x;
        const barWidth = Math.max(52, Math.round((item.count / maxCount) * peopleTrackWidth));
        const labelLines = wrapTextToSvgWidth(item.name, peopleTrackWidth, 21, Infinity);
        const textY = cursorY + 20;
        const barY = cursorY + labelLines.length * 23 + 14;
        column += svgTextLines(labelLines, x, textY, "people-label", 23);
        column += `<rect x="${trackX}" y="${barY}" width="${peopleTrackWidth}" height="20" rx="10" fill="${theme.faint}" />`;
        column += `<rect x="${trackX}" y="${barY}" width="${barWidth}" height="20" rx="10" fill="${index % 2 ? theme.accent2 : theme.accent}" />`;
        column += `<text x="${x + cardW - 28}" y="${barY + 17}" class="bar-count" text-anchor="end">${item.count}</text>`;
        cursorY = barY + 42;
      });
      return { body: column, height: cursorY - startY };
    };
    const columnsY = calloutHeight + 58;
    const directorColumn = renderPeopleColumn("Directors", insights.directors, marginX, columnsY);
    const castColumn = renderPeopleColumn("Cast", insights.cast, marginX + colUnit, columnsY);
    block += directorColumn.body;
    block += castColumn.body;
    return section(
      "people",
      tone.peopleTitle,
      "Directors and cast that rise to the top",
      block,
      columnsY + Math.max(directorColumn.height, castColumn.height) + 20,
    );
  };

  const queues = () => {
    if (!options.queues) return null;
    const watchRuntime = runtimeStatsForMovies(watchList);
    const hiddenRuntime = runtimeStatsForMovies(notInterestedList);
    const watchRuntimeDisplay = formatShareRuntimeTotal(watchRuntime, watchList.length, shareDetailsLoading);
    const hiddenRuntimeDisplay = formatShareRuntimeTotal(hiddenRuntime, notInterestedList.length, shareDetailsLoading);
    const hiddenLabel = hiddenRuntimeLabel(options.tone);
    const queueCards = [
      {
        label: "Saved for later",
        count: watchList.length,
        runtime: watchRuntimeDisplay.value,
        runtimeClass: watchRuntimeDisplay.isDuration ? "queue-runtime" : "queue-runtime-small",
        runtimeLabel: "Pending watch time",
        accent: theme.accent,
      },
      {
        label: "Hidden from view",
        count: notInterestedList.length,
        runtime: hiddenRuntimeDisplay.value,
        runtimeClass: hiddenRuntimeDisplay.isDuration ? "queue-runtime" : "queue-runtime-small",
        runtimeLabel: hiddenLabel,
        accent: theme.accent2,
      },
    ];
    let block = "";
    queueCards.forEach((item, index) => {
      const x = marginX + index * colUnit;
      block += `<rect x="${x}" y="0" width="${cardW}" height="150" rx="24" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
      block += `<text x="${x + 26}" y="44" class="stat-card-label">${xmlEscape(item.label)}</text>`;
      block += `<text x="${x + 26}" y="102" class="stat-value">${item.count}</text>`;
      block += `<text x="${x + cardW - 28}" y="94" class="${item.runtimeClass}" fill="${item.accent}" text-anchor="end">${xmlEscape(item.runtime)}</text>`;
      block += `<text x="${x + cardW - 28}" y="126" class="stat-card-label" text-anchor="end">${xmlEscape(item.runtimeLabel)}</text>`;
    });
    // Beneath each card, the 3 most-recently-added titles as poster + title
    // cells (two columns: saved on the left, hidden on the right).
    const recentBlocks = [
      { list: watchList, key: "savedAt", heading: "Recently saved", empty: "Nothing saved yet" },
      { list: notInterestedList, key: "hiddenAt", heading: "Recently hidden", empty: "Nothing hidden yet" },
    ];
    const recentCellW = cardW;
    const recentCellH = 132;
    const recentCellStride = recentCellH + 14;
    const recentCellOpts = { cellPad: 16, posterW: 76, posterH: 114, titleSizes: [24, 22, 20] };
    let bottom = 170;
    recentBlocks.forEach((group, index) => {
      const x = marginX + index * colUnit;
      const headingY = 196;
      block += `<text x="${x}" y="${headingY}" class="people-heading">${xmlEscape(group.heading)}</text>`;
      const items = recentQueueItems(group.list, group.key, 3);
      if (!items.length) {
        block += `<text x="${x}" y="${headingY + 36}" class="poster-rank">${xmlEscape(group.empty)}.</text>`;
        bottom = Math.max(bottom, headingY + 46);
        return;
      }
      let cellY = headingY + 24;
      items.forEach((movie) => {
        block += mixedMovieCell(movie, x, cellY, recentCellW, recentCellH, recentCellOpts);
        cellY += recentCellStride;
      });
      bottom = Math.max(bottom, cellY - recentCellStride + recentCellH + 8);
    });
    return section("queues", tone.queuesTitle, "Movies outside the ranked stack", block, bottom);
  };

  // Expanded saved/hidden card for the image set: up to 5 saved + 5 hidden,
  // rendered as poster + title rows (the whole-list "mixed" style).
  const savedHidden = () => {
    if (!options.queues) return null;
    if (!watchList.length && !notInterestedList.length) {
      return section(
        "saved",
        tone.queuesTitle,
        "Saved and hidden picks",
        `<text x="86" y="24" class="pick-meta">Nothing saved or hidden yet.</text>`,
        62,
      );
    }
    // Two columns of the whole-list "mixed" poster+title cell, 6 per group
    // (fits well under the 2600 page max; drop to 4 if that ever overflows).
    const perGroup = 6;
    const cols = 2;
    const cellGap = 24;
    const cellW = 502;
    const cellH = 178;
    const rowStride = cellH + 22;
    const cellOpts = { cellPad: 18, posterW: 92, posterH: 138, titleSizes: [30, 28, 26, 24] };
    const blocks = [
      { label: "Recently saved", movies: recentQueueItems(watchList, "savedAt", perGroup), total: watchList.length },
      { label: "Recently hidden", movies: recentQueueItems(notInterestedList, "hiddenAt", perGroup), total: notInterestedList.length },
    ];
    let block = "";
    let cursorY = 0;
    blocks.forEach((group, groupIndex) => {
      if (groupIndex > 0) cursorY += 32;
      const shown = group.movies.length;
      const countLabel = shown && shown < group.total ? `${shown} of ${group.total}` : String(group.total);
      block += `<text x="86" y="${cursorY + 30}" class="people-heading">${xmlEscape(`${group.label} · ${countLabel}`)}</text>`;
      cursorY += 60;
      if (!group.movies.length) {
        block += `<text x="86" y="${cursorY + 20}" class="pick-meta">Nothing here yet.</text>`;
        cursorY += 60;
        return;
      }
      group.movies.forEach((movie, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = marginX + col * (cellW + cellGap);
        block += mixedMovieCell(movie, x, cursorY + row * rowStride, cellW, cellH, cellOpts);
      });
      cursorY += Math.ceil(group.movies.length / cols) * rowStride;
    });
    return section("saved", tone.queuesTitle, "Most recently saved and hidden", block, cursorY);
  };

  const fullList = () => {
    if (!options.fullList || !ranking.length) return null;
    const listStyle = ["posters", "text", "mixed"].includes(options.fullListStyle) ? options.fullListStyle : "mixed";
    const posterStartY = 134;
    let block = "";
    shareRankingMetaCards(insights).forEach((item, index) => {
      const x = marginX + index * 356;
      block += `<rect x="${x}" y="0" width="316" height="96" rx="20" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
      block += `<text x="${x + 24}" y="42" class="stat-value-small">${xmlEscape(item.value)}</text>`;
      block += `<text x="${x + 24}" y="76" class="stat-card-label">${xmlEscape(item.label)}</text>`;
    });

    if (listStyle === "text") {
      const cols = 2;
      const colW = 493;
      const colGap = 42;
      const rankSize = 18;
      const titleXOffset = 54;
      const titleWidth = colW - titleXOffset - 8;
      const titleFontSize = 22;
      const titleLineHeight = 25;
      const titleY = 18;
      const metaGap = 25;
      const rowPad = 18;
      const rowHeights = insights.enrichedRanking.map((movie) => {
        const lines = wrapTextToSvgWidth(movie.title, titleWidth, titleFontSize, 2);
        return titleY + (lines.length - 1) * titleLineHeight + metaGap + rowPad;
      });
      const rowOffsets = [];
      let runningRowY = posterStartY;
      for (let row = 0; row < Math.ceil(insights.enrichedRanking.length / cols); row += 1) {
        const rowHeight = Math.max(...rowHeights.slice(row * cols, row * cols + cols), 0);
        rowOffsets[row] = runningRowY;
        runningRowY += rowHeight;
      }
      insights.enrichedRanking.forEach((movie, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = 86 + col * (colW + colGap);
        const rowY = rowOffsets[row];
        const titleLines = wrapTextToSvgWidth(movie.title, titleWidth, titleFontSize, 2);
        const metaY = rowY + titleY + (titleLines.length - 1) * titleLineHeight + metaGap;
        block += `<circle cx="${x + rankSize}" cy="${rowY + 18}" r="${rankSize}" fill="${theme.faint}" stroke="${panelStroke}" stroke-width="2" />`;
        block += `<text x="${x + rankSize}" y="${rowY + 26}" class="deep-rank" text-anchor="middle">${index + 1}</text>`;
        block += svgTextLines(titleLines, x + titleXOffset, rowY + titleY, "full-list-text-title", titleLineHeight);
        block += `<text x="${x + titleXOffset}" y="${metaY}" class="poster-rank">${xmlEscape(movie.year ? `Released ${movie.year}` : "Year unknown")}</text>`;
      });
      return section("list", tone.listTitle, "Every movie, top to bottom", block, runningRowY - posterStartY);
    }

    if (listStyle === "mixed") {
      const cols = 2;
      const cellGap = 24;
      const cellW = 502;
      const cellH = 178;
      const cellPad = 18;
      const posterW = 92;
      const posterH = 138;
      const posterXOffset = cellPad;
      const posterYOffset = Math.round((cellH - posterH) / 2);
      const titleXOffset = cellPad + posterW + 22;
      const titleW = cellW - titleXOffset - 24;
      const titleSizes = [30, 28, 26, 24];

      const titleFit = (title) => {
        for (const fontSize of titleSizes) {
          const lines = wrapTextToSvgWidth(title, titleW, fontSize, Infinity);
          if (lines.length <= 2) return { lines, fontSize, lineHeight: Math.round(fontSize * 1.16) };
        }
        const fontSize = titleSizes[titleSizes.length - 1];
        return {
          lines: wrapTextToSvgWidth(title, titleW, fontSize, 2),
          fontSize,
          lineHeight: Math.round(fontSize * 1.16),
        };
      };

      insights.enrichedRanking.forEach((movie, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = 86 + col * (cellW + cellGap);
        const tileY = posterStartY + row * (cellH + 22);
        const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
        const title = titleFit(`${index + 1}. ${movie.title}`);
        const meta = movie.year ? `Released ${movie.year}` : "Year unknown";
        const metaGap = 30;
        const titleAscent = Math.round(title.fontSize * 0.76);
        const metaDescent = 5;
        const groupHeight = titleAscent + (title.lines.length - 1) * title.lineHeight + metaGap + metaDescent;
        const titleY = tileY + Math.round((cellH - groupHeight) / 2) + titleAscent;
        const metaY = titleY + (title.lines.length - 1) * title.lineHeight + metaGap;
        const posterX = x + posterXOffset;
        const posterY = tileY + posterYOffset;
        const titleX = x + titleXOffset;

        block += `<rect x="${x}" y="${tileY}" width="${cellW}" height="${cellH}" rx="18" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
        if (posterData) {
          block += `<image href="${xmlEscape(posterData)}" x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" preserveAspectRatio="xMidYMid slice" />`;
        } else {
          const fallbackClipId = `full-list-row-poster-title-${index}`;
          const fallbackTextX = posterX + 10;
          block += `<rect x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" rx="10" fill="${theme.faint}" />`;
          block += `<clipPath id="${fallbackClipId}"><rect x="${fallbackTextX}" y="${posterY + 12}" width="${posterW - 20}" height="${posterH - 24}" /></clipPath>`;
          block += svgTextLines(
            wrapTextToSvgWidth(movie.title, posterW - 20, 15, 5),
            fallbackTextX,
            posterY + 30,
            "poster-title-compact",
            19,
            `clip-path="url(#${fallbackClipId})"`,
          );
        }
        block += svgTextLines(title.lines, titleX, titleY, `full-list-row-title-${title.fontSize}`, title.lineHeight);
        block += `<text x="${titleX}" y="${metaY}" class="poster-rank">${xmlEscape(meta)}</text>`;
      });

      return section(
        "list",
        tone.listTitle,
        "Every movie, top to bottom",
        block,
        posterStartY + Math.ceil(ranking.length / cols) * (cellH + 22),
      );
    }

    const cols = 5;
    const gap = 22;
    // Fill the symmetric content width (86 .. 1114) with the 5 poster cells.
    const cellW = Math.floor((contentRight - marginX - (cols - 1) * gap) / cols);
    const posterInset = 10;
    const imageH = Math.round((cellW - posterInset * 2) * 1.5);
    const cellH = imageH + posterInset * 2;
    insights.enrichedRanking.forEach((movie, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 86 + col * (cellW + gap);
      const tileY = posterStartY + row * (cellH + 24);
      const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
      const badgeLabel = String(index + 1);
      const badgeW = Math.max(34, 20 + badgeLabel.length * 10);
      const badgeX = x + cellW - posterInset - badgeW - 8;
      const badgeY = tileY + posterInset + 8;
      block += `<rect x="${x}" y="${tileY}" width="${cellW}" height="${cellH}" rx="14" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
      if (posterData) {
        block += `<image href="${xmlEscape(posterData)}" x="${x + posterInset}" y="${tileY + posterInset}" width="${cellW - posterInset * 2}" height="${imageH}" preserveAspectRatio="xMidYMid slice" />`;
      } else {
        const fallbackClipId = `full-list-poster-title-${index}`;
        const fallbackTextX = x + 18;
        const fallbackTextWidth = cellW - 36;
        block += `<rect x="${x + posterInset}" y="${tileY + posterInset}" width="${cellW - posterInset * 2}" height="${imageH}" rx="10" fill="${theme.faint}" />`;
        block += `<clipPath id="${fallbackClipId}"><rect x="${fallbackTextX}" y="${tileY + 26}" width="${fallbackTextWidth}" height="${imageH - 52}" /></clipPath>`;
        block += svgTextLines(
          wrapTextToSvgWidth(movie.title, fallbackTextWidth, 18, 6),
          fallbackTextX,
          tileY + 44,
          "poster-title-compact",
          22,
          `clip-path="url(#${fallbackClipId})"`,
        );
      }
      block += `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="28" rx="14" fill="${theme.panel}" fill-opacity="0.9" stroke="${panelStroke}" stroke-width="1.5" />`;
      block += `<text x="${badgeX + badgeW / 2}" y="${badgeY + 20}" class="poster-number-badge" text-anchor="middle">${badgeLabel}</text>`;
    });
    return section(
      "list",
      tone.listTitle,
      "Every movie, top to bottom",
      block,
      posterStartY + Math.ceil(ranking.length / cols) * (cellH + 24),
    );
  };

  return { topPicks, bottomPicks, eras, genres, people, queues, savedHidden, fullList };
}

// Single-image Portrait poster (the original output, unchanged).
function buildShareSvg(options = shareOptions) {
  const insights = getRankingInsights();
  const theme = getShareTheme(options.theme);
  const tone = getShareTone(options.tone);
  const width = 1200;
  const header = buildShareHeader(width, theme, tone, options);
  const builders = shareSectionBuilders(insights, theme, tone, options);
  const descriptors = [
    builders.topPicks(),
    builders.bottomPicks(),
    builders.eras(),
    builders.genres(),
    builders.people(),
    builders.queues(),
    builders.fullList(),
  ].filter(Boolean);

  let y = header.sectionsStartY;
  let sectionsSvg = "";
  descriptors.forEach((desc) => {
    const placed = placeSectionFlow(desc, y);
    sectionsSvg += placed.svg;
    y = placed.nextY;
  });

  const height = Math.max(1600, y + 200);
  const inner = `${header.svg}
  ${sectionsSvg}
  ${shareFooterSvg(width, height)}`;
  return renderShareSvg({
    width,
    height,
    theme,
    heroFontSize: header.heroFontSize,
    heroFill: header.heroFill,
    sectionFill: header.sectionFill,
    inner,
  });
}

// The whole-list section rendered across an arbitrary canvas width with more
// columns than the 1200 single column (used by Wide mode, below the masonry).
// Returns a section descriptor positioned for placeSectionFlow.
function buildWideFullListDescriptor(insights, theme, tone, options, totalWidth) {
  if (!options.fullList || !ranking.length) return null;
  const listStyle = ["posters", "text", "mixed"].includes(options.fullListStyle) ? options.fullListStyle : "mixed";
  const marginX = 86;
  const contentWidth = totalWidth - marginX * 2;
  const panelStroke = theme.panelLine || theme.line;
  const allowExternalPosters = options.externalPosters !== false;
  const usePosterProxy = options.posterProxy === true;
  const movies = insights.enrichedRanking;
  const posterStartY = 158;

  // Meta cards sized to match the genre / cast & crew cells (492 × 118).
  let block = "";
  const metaCardW = 492;
  const metaStride = metaCardW + 44;
  shareRankingMetaCards(insights).forEach((item, index) => {
    const x = marginX + index * metaStride;
    block += `<rect x="${x}" y="0" width="${metaCardW}" height="118" rx="20" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
    block += `<text x="${x + 26}" y="56" class="stat-value-small">${xmlEscape(item.value)}</text>`;
    block += `<text x="${x + 26}" y="92" class="stat-card-label">${xmlEscape(item.label)}</text>`;
  });

  let bodyHeight;
  if (listStyle === "text") {
    const cols = 4;
    const colGap = 42;
    const colW = Math.floor((contentWidth - (cols - 1) * colGap) / cols);
    const rankSize = 18;
    const titleXOffset = 54;
    const titleWidth = colW - titleXOffset - 8;
    const titleFontSize = 22;
    const titleLineHeight = 25;
    const titleY = 18;
    const metaGap = 25;
    const rowPad = 18;
    const rowHeights = movies.map((movie) => {
      const lines = wrapTextToSvgWidth(movie.title, titleWidth, titleFontSize, 2);
      return titleY + (lines.length - 1) * titleLineHeight + metaGap + rowPad;
    });
    const rowOffsets = [];
    let runningRowY = posterStartY;
    for (let row = 0; row < Math.ceil(movies.length / cols); row += 1) {
      const rowHeight = Math.max(...rowHeights.slice(row * cols, row * cols + cols), 0);
      rowOffsets[row] = runningRowY;
      runningRowY += rowHeight;
    }
    movies.forEach((movie, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = marginX + col * (colW + colGap);
      const rowY = rowOffsets[row];
      const titleLines = wrapTextToSvgWidth(movie.title, titleWidth, titleFontSize, 2);
      const metaY = rowY + titleY + (titleLines.length - 1) * titleLineHeight + metaGap;
      block += `<circle cx="${x + rankSize}" cy="${rowY + 18}" r="${rankSize}" fill="${theme.faint}" stroke="${panelStroke}" stroke-width="2" />`;
      block += `<text x="${x + rankSize}" y="${rowY + 26}" class="deep-rank" text-anchor="middle">${index + 1}</text>`;
      block += svgTextLines(titleLines, x + titleXOffset, rowY + titleY, "full-list-text-title", titleLineHeight);
      block += `<text x="${x + titleXOffset}" y="${metaY}" class="poster-rank">${xmlEscape(movie.year ? `Released ${movie.year}` : "Year unknown")}</text>`;
    });
    bodyHeight = runningRowY;
  } else if (listStyle === "posters") {
    const cols = 11;
    const gap = 22;
    const cellW = Math.floor((contentWidth - (cols - 1) * gap) / cols);
    const posterInset = 8;
    const imageW = cellW - posterInset * 2;
    const imageH = Math.round(imageW * 1.5);
    const cellH = imageH + posterInset * 2;
    movies.forEach((movie, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = marginX + col * (cellW + gap);
      const tileY = posterStartY + row * (cellH + 24);
      const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
      const badgeLabel = String(index + 1);
      const badgeW = Math.max(30, 16 + badgeLabel.length * 9);
      const badgeX = x + cellW - posterInset - badgeW - 6;
      const badgeY = tileY + posterInset + 6;
      block += `<rect x="${x}" y="${tileY}" width="${cellW}" height="${cellH}" rx="12" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
      if (posterData) {
        block += `<image href="${xmlEscape(posterData)}" x="${x + posterInset}" y="${tileY + posterInset}" width="${imageW}" height="${imageH}" preserveAspectRatio="xMidYMid slice" />`;
      } else {
        const fallbackClipId = `wide-poster-${index}`;
        const fallbackTextX = x + 14;
        const fallbackTextWidth = cellW - 28;
        block += `<rect x="${x + posterInset}" y="${tileY + posterInset}" width="${imageW}" height="${imageH}" rx="8" fill="${theme.faint}" />`;
        block += `<clipPath id="${fallbackClipId}"><rect x="${fallbackTextX}" y="${tileY + 22}" width="${fallbackTextWidth}" height="${imageH - 44}" /></clipPath>`;
        block += svgTextLines(
          wrapTextToSvgWidth(movie.title, fallbackTextWidth, 14, 6),
          fallbackTextX,
          tileY + 38,
          "poster-title-compact",
          17,
          `clip-path="url(#${fallbackClipId})"`,
        );
      }
      block += `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="26" rx="13" fill="${theme.panel}" fill-opacity="0.9" stroke="${panelStroke}" stroke-width="1.5" />`;
      block += `<text x="${badgeX + badgeW / 2}" y="${badgeY + 18}" class="poster-number-badge" text-anchor="middle">${badgeLabel}</text>`;
    });
    bodyHeight = posterStartY + Math.ceil(movies.length / cols) * (cellH + 24);
  } else {
    const cols = 4;
    const cellGap = 24;
    const cellW = Math.floor((contentWidth - (cols - 1) * cellGap) / cols);
    const cellH = 178;
    const cellPad = 18;
    const posterW = 92;
    const posterH = 138;
    const posterXOffset = cellPad;
    const posterYOffset = Math.round((cellH - posterH) / 2);
    const titleXOffset = cellPad + posterW + 22;
    const titleW = cellW - titleXOffset - 24;
    const titleSizes = [30, 28, 26, 24];
    const titleFit = (title) => {
      for (const fontSize of titleSizes) {
        const lines = wrapTextToSvgWidth(title, titleW, fontSize, Infinity);
        if (lines.length <= 2) return { lines, fontSize, lineHeight: Math.round(fontSize * 1.16) };
      }
      const fontSize = titleSizes[titleSizes.length - 1];
      return { lines: wrapTextToSvgWidth(title, titleW, fontSize, 2), fontSize, lineHeight: Math.round(fontSize * 1.16) };
    };
    movies.forEach((movie, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = marginX + col * (cellW + cellGap);
      const tileY = posterStartY + row * (cellH + 22);
      const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
      const title = titleFit(`${index + 1}. ${movie.title}`);
      const meta = movie.year ? `Released ${movie.year}` : "Year unknown";
      const metaGap = 30;
      const titleAscent = Math.round(title.fontSize * 0.76);
      const metaDescent = 5;
      const groupHeight = titleAscent + (title.lines.length - 1) * title.lineHeight + metaGap + metaDescent;
      const titleY = tileY + Math.round((cellH - groupHeight) / 2) + titleAscent;
      const metaY = titleY + (title.lines.length - 1) * title.lineHeight + metaGap;
      const posterX = x + posterXOffset;
      const posterY = tileY + posterYOffset;
      const titleX = x + titleXOffset;
      block += `<rect x="${x}" y="${tileY}" width="${cellW}" height="${cellH}" rx="18" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
      if (posterData) {
        block += `<image href="${xmlEscape(posterData)}" x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" preserveAspectRatio="xMidYMid slice" />`;
      } else {
        const fallbackClipId = `wide-row-poster-${index}`;
        const fallbackTextX = posterX + 10;
        block += `<rect x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" rx="10" fill="${theme.faint}" />`;
        block += `<clipPath id="${fallbackClipId}"><rect x="${fallbackTextX}" y="${posterY + 12}" width="${posterW - 20}" height="${posterH - 24}" /></clipPath>`;
        block += svgTextLines(
          wrapTextToSvgWidth(movie.title, posterW - 20, 15, 5),
          fallbackTextX,
          posterY + 30,
          "poster-title-compact",
          19,
          `clip-path="url(#${fallbackClipId})"`,
        );
      }
      block += svgTextLines(title.lines, titleX, titleY, `full-list-row-title-${title.fontSize}`, title.lineHeight);
      block += `<text x="${titleX}" y="${metaY}" class="poster-rank">${xmlEscape(meta)}</text>`;
    });
    bodyHeight = posterStartY + Math.ceil(movies.length / cols) * (cellH + 22);
  }

  return { key: "list", title: tone.listTitle, subtitle: "Every movie, top to bottom", body: block, height: bodyHeight };
}

// Single-image Wide poster: the non-list sections tile into a two-column
// masonry, then the whole list spans the full canvas width beneath them with a
// denser column count.
function buildShareWideSvg(options = shareOptions) {
  const insights = getRankingInsights();
  const theme = getShareTheme(options.theme);
  const tone = getShareTone(options.tone);
  const builders = shareSectionBuilders(insights, theme, tone, options);
  const sectionDescriptors = [
    builders.topPicks(),
    builders.bottomPicks(),
    builders.eras(),
    builders.genres(),
    builders.people(),
    builders.queues(),
  ].filter(Boolean);

  // Two columns whose internal content is the 1200 layout (86..1114). The
  // gutter between columns is set equal to the page padding (86) so all three
  // gaps — left, middle, right — match.
  const marginX = 86;
  const colContentW = 1200 - marginX * 2; // 1028
  const gutter = marginX; // 86
  const cols = 2;
  const colStride = colContentW + gutter; // 1114
  const width = marginX * 2 + cols * colContentW + (cols - 1) * gutter; // 2314
  const header = buildShareHeader(width, theme, tone, options);

  const colHeights = new Array(cols).fill(header.sectionsStartY);
  let sectionsSvg = "";
  sectionDescriptors.forEach((desc) => {
    let target = 0;
    for (let col = 1; col < cols; col += 1) {
      if (colHeights[col] < colHeights[target]) target = col;
    }
    const placed = placeSectionFlow(desc, colHeights[target]);
    sectionsSvg += `<g transform="translate(${target * colStride} 0)">${placed.svg}</g>`;
    colHeights[target] = placed.nextY;
  });

  let contentBottom = sectionDescriptors.length ? Math.max(...colHeights) : header.sectionsStartY;
  const listDescriptor = buildWideFullListDescriptor(insights, theme, tone, options, width);
  if (listDescriptor) {
    const startY = sectionDescriptors.length ? contentBottom + 24 : contentBottom;
    const placed = placeSectionFlow(listDescriptor, startY);
    sectionsSvg += placed.svg;
    contentBottom = placed.nextY;
  }

  const height = Math.max(1200, contentBottom + 200);
  const inner = `${header.svg}
  ${sectionsSvg}
  ${shareFooterSvg(width, height)}`;
  return renderShareSvg({
    width,
    height,
    theme,
    heroFontSize: header.heroFontSize,
    heroFill: header.heroFill,
    sectionFill: header.sectionFill,
    inner,
  });
}

const IMAGE_SET_WIDTH = 1200;
const IMAGE_SET_HEIGHT = 2600;

// Renders one image-set card (fixed width, target-fixed height that grows only
// if a finite group genuinely overflows) from a label and section descriptors.
function composeShareCard(theme, tone, options, label, descriptors, counter = "") {
  const width = IMAGE_SET_WIDTH;
  const kicker = counter ? `${label} ${counter}` : label;
  const header = buildShareHeader(width, theme, tone, options, { kicker });
  let y = header.sectionsStartY;
  let sectionsSvg = "";
  descriptors.forEach((desc) => {
    const placed = placeSectionFlow(desc, y);
    sectionsSvg += placed.svg;
    y = placed.nextY;
  });
  // Shrink each card to its content; the page height is a maximum, not a floor,
  // so finite groups and the final list page don't carry blank space. The +120
  // is a snug footer zone (the footer baseline sits at height - 100).
  const height = Math.min(IMAGE_SET_HEIGHT, y + 120);
  const inner = `${header.svg}
  ${sectionsSvg}
  ${shareFooterSvg(width, height)}`;
  return renderShareSvg({
    width,
    height,
    theme,
    heroFontSize: header.heroFontSize,
    heroFill: header.heroFill,
    sectionFill: header.sectionFill,
    inner,
  });
}

// Splits the whole ranking into repeatable single-page tiles for the image set.
// Returns an array of section descriptors (one per page); page counters are
// applied by the caller. Designed so every page uses the identical template and
// nothing is clipped (conservative per-page capacity).
function buildWholeListPageDescriptors(insights, theme, tone, options, availableHeight) {
  if (!options.fullList || !ranking.length) return [];
  const listStyle = ["posters", "text", "mixed"].includes(options.fullListStyle) ? options.fullListStyle : "mixed";
  const panelStroke = theme.panelLine || theme.line;
  const allowExternalPosters = options.externalPosters !== false;
  const usePosterProxy = options.posterProxy === true;
  const movies = insights.enrichedRanking;

  let cols;
  let rowStride;
  let renderPage;

  if (listStyle === "posters") {
    cols = 5;
    const gap = 22;
    // Size the 5 cells to fill the content width (86 .. 1114), matching the page
    // padding on both sides instead of leaving a gap on the right.
    const cellW = Math.floor((IMAGE_SET_WIDTH - 86 * 2 - (cols - 1) * gap) / cols);
    const posterInset = 10;
    const imageW = cellW - posterInset * 2;
    const imageH = Math.round(imageW * 1.5);
    const cellH = imageH + posterInset * 2;
    rowStride = cellH + 24;
    renderPage = (slice, startIndex) => {
      let block = "";
      slice.forEach((movie, i) => {
        const index = startIndex + i;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 86 + col * (cellW + gap);
        const tileY = row * rowStride;
        const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
        const badgeLabel = String(index + 1);
        const badgeW = Math.max(34, 20 + badgeLabel.length * 10);
        const badgeX = x + cellW - posterInset - badgeW - 8;
        const badgeY = tileY + posterInset + 8;
        block += `<rect x="${x}" y="${tileY}" width="${cellW}" height="${cellH}" rx="14" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
        if (posterData) {
          block += `<image href="${xmlEscape(posterData)}" x="${x + posterInset}" y="${tileY + posterInset}" width="${cellW - posterInset * 2}" height="${imageH}" preserveAspectRatio="xMidYMid slice" />`;
        } else {
          const fallbackClipId = `set-poster-${index}`;
          const fallbackTextX = x + 18;
          const fallbackTextWidth = cellW - 36;
          block += `<rect x="${x + posterInset}" y="${tileY + posterInset}" width="${cellW - posterInset * 2}" height="${imageH}" rx="10" fill="${theme.faint}" />`;
          block += `<clipPath id="${fallbackClipId}"><rect x="${fallbackTextX}" y="${tileY + 26}" width="${fallbackTextWidth}" height="${imageH - 52}" /></clipPath>`;
          block += svgTextLines(
            wrapTextToSvgWidth(movie.title, fallbackTextWidth, 18, 6),
            fallbackTextX,
            tileY + 44,
            "poster-title-compact",
            22,
            `clip-path="url(#${fallbackClipId})"`,
          );
        }
        block += `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="28" rx="14" fill="${theme.panel}" fill-opacity="0.9" stroke="${panelStroke}" stroke-width="1.5" />`;
        block += `<text x="${badgeX + badgeW / 2}" y="${badgeY + 20}" class="poster-number-badge" text-anchor="middle">${badgeLabel}</text>`;
      });
      const rows = Math.ceil(slice.length / cols);
      return { body: block, height: rows * rowStride };
    };
  } else if (listStyle === "text") {
    cols = 2;
    const colGap = 42;
    const colW = Math.floor((IMAGE_SET_WIDTH - 86 * 2 - (cols - 1) * colGap) / cols);
    const rankSize = 18;
    const titleXOffset = 54;
    const titleWidth = colW - titleXOffset - 8;
    const titleFontSize = 22;
    const titleLineHeight = 25;
    const titleY = 18;
    const metaGap = 25;
    const rowPad = 18;
    // Conservative fixed stride (max two-line row) so pages never overflow.
    rowStride = titleY + titleLineHeight + metaGap + rowPad;
    renderPage = (slice, startIndex) => {
      let block = "";
      const rows = Math.ceil(slice.length / cols);
      slice.forEach((movie, i) => {
        const index = startIndex + i;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 86 + col * (colW + colGap);
        const rowY = row * rowStride;
        const titleLines = wrapTextToSvgWidth(movie.title, titleWidth, titleFontSize, 2);
        const metaY = rowY + titleY + (titleLines.length - 1) * titleLineHeight + metaGap;
        block += `<circle cx="${x + rankSize}" cy="${rowY + 18}" r="${rankSize}" fill="${theme.faint}" stroke="${panelStroke}" stroke-width="2" />`;
        block += `<text x="${x + rankSize}" y="${rowY + 26}" class="deep-rank" text-anchor="middle">${index + 1}</text>`;
        block += svgTextLines(titleLines, x + titleXOffset, rowY + titleY, "full-list-text-title", titleLineHeight);
        block += `<text x="${x + titleXOffset}" y="${metaY}" class="poster-rank">${xmlEscape(movie.year ? `Released ${movie.year}` : "Year unknown")}</text>`;
      });
      return { body: block, height: rows * rowStride };
    };
  } else {
    cols = 2;
    const cellGap = 24;
    const cellW = 502;
    const cellH = 178;
    const cellPad = 18;
    const posterW = 92;
    const posterH = 138;
    const posterXOffset = cellPad;
    const posterYOffset = Math.round((cellH - posterH) / 2);
    const titleXOffset = cellPad + posterW + 22;
    const titleW = cellW - titleXOffset - 24;
    const titleSizes = [30, 28, 26, 24];
    rowStride = cellH + 22;
    const titleFit = (title) => {
      for (const fontSize of titleSizes) {
        const lines = wrapTextToSvgWidth(title, titleW, fontSize, Infinity);
        if (lines.length <= 2) return { lines, fontSize, lineHeight: Math.round(fontSize * 1.16) };
      }
      const fontSize = titleSizes[titleSizes.length - 1];
      return {
        lines: wrapTextToSvgWidth(title, titleW, fontSize, 2),
        fontSize,
        lineHeight: Math.round(fontSize * 1.16),
      };
    };
    renderPage = (slice, startIndex) => {
      let block = "";
      const rows = Math.ceil(slice.length / cols);
      slice.forEach((movie, i) => {
        const index = startIndex + i;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 86 + col * (cellW + cellGap);
        const tileY = row * rowStride;
        const posterData = posterDataFor(movie, allowExternalPosters, usePosterProxy);
        const title = titleFit(`${index + 1}. ${movie.title}`);
        const meta = movie.year ? `Released ${movie.year}` : "Year unknown";
        const metaGap = 30;
        const titleAscent = Math.round(title.fontSize * 0.76);
        const metaDescent = 5;
        const groupHeight = titleAscent + (title.lines.length - 1) * title.lineHeight + metaGap + metaDescent;
        const tY = tileY + Math.round((cellH - groupHeight) / 2) + titleAscent;
        const metaY = tY + (title.lines.length - 1) * title.lineHeight + metaGap;
        const posterX = x + posterXOffset;
        const posterY = tileY + posterYOffset;
        const titleX = x + titleXOffset;
        block += `<rect x="${x}" y="${tileY}" width="${cellW}" height="${cellH}" rx="18" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="2" />`;
        if (posterData) {
          block += `<image href="${xmlEscape(posterData)}" x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" preserveAspectRatio="xMidYMid slice" />`;
        } else {
          const fallbackClipId = `set-row-poster-${index}`;
          const fallbackTextX = posterX + 10;
          block += `<rect x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" rx="10" fill="${theme.faint}" />`;
          block += `<clipPath id="${fallbackClipId}"><rect x="${fallbackTextX}" y="${posterY + 12}" width="${posterW - 20}" height="${posterH - 24}" /></clipPath>`;
          block += svgTextLines(
            wrapTextToSvgWidth(movie.title, posterW - 20, 15, 5),
            fallbackTextX,
            posterY + 30,
            "poster-title-compact",
            19,
            `clip-path="url(#${fallbackClipId})"`,
          );
        }
        block += svgTextLines(title.lines, titleX, tY, `full-list-row-title-${title.fontSize}`, title.lineHeight);
        block += `<text x="${titleX}" y="${metaY}" class="poster-rank">${xmlEscape(meta)}</text>`;
      });
      return { body: block, height: rows * rowStride };
    };
  }

  const rowsPerPage = Math.max(1, Math.floor(availableHeight / rowStride));
  const perPage = rowsPerPage * cols;
  const descriptors = [];
  for (let start = 0; start < movies.length; start += perPage) {
    const slice = movies.slice(start, start + perPage);
    const page = renderPage(slice, start);
    // Postfix the section title with the rank range shown on this page, e.g.
    // "The whole stack, Ranks 1-18" (rendered uppercase by the title style).
    const title = `${tone.listTitle}, Ranks ${start + 1}-${start + slice.length}`;
    descriptors.push({ key: "list", title, subtitle: "Every movie, top to bottom", body: page.body, height: page.height });
  }
  return descriptors;
}

// Builds the full ordered set of image-set cards. Each entry carries a filename
// (sequential, group-named) and the card SVG. Groups whose sections are all
// toggled off are skipped.
function buildShareImageSetPages(options = shareOptions) {
  const insights = getRankingInsights();
  const theme = getShareTheme(options.theme);
  const tone = getShareTone(options.tone);
  const builders = shareSectionBuilders(insights, theme, tone, options);

  const groups = [
    { key: "picks", label: "Top & bottom picks", descriptors: [builders.topPicks(), builders.bottomPicks()] },
    { key: "eras", label: "Eras", descriptors: [builders.eras()] },
    { key: "genres", label: "Genres", descriptors: [builders.genres()] },
    { key: "people", label: "Cast & crew", descriptors: [builders.people()] },
    { key: "saved", label: "Saved & hidden", descriptors: [builders.savedHidden()] },
  ];

  const cards = [];
  groups.forEach((group) => {
    const descriptors = group.descriptors.filter(Boolean);
    if (!descriptors.length) return;
    cards.push({ key: group.key, label: group.label, svg: composeShareCard(theme, tone, options, group.label, descriptors) });
  });

  // Whole list: paginate across as many cards as needed.
  if (options.fullList && ranking.length) {
    // Approximate available body height for a list page (1 hero line, footer zone).
    const probe = buildShareHeader(IMAGE_SET_WIDTH, theme, tone, options, { kicker: "Whole list" });
    const bodyOffset = 76;
    const footerZone = 200;
    const available = IMAGE_SET_HEIGHT - probe.sectionsStartY - bodyOffset - footerZone;
    const pages = buildWholeListPageDescriptors(insights, theme, tone, options, available);
    pages.forEach((desc, index) => {
      const counter = pages.length > 1 ? `Page ${index + 1}/${pages.length}` : "";
      cards.push({
        key: "list",
        label: "Whole list",
        svg: composeShareCard(theme, tone, options, "Whole list", [desc], counter),
      });
    });
  }

  cards.forEach((card, index) => {
    card.filename = `stackrank-${index + 1}-${card.key}.png`;
    card.svgFilename = `stackrank-${index + 1}-${card.key}.svg`;
  });
  return cards;
}

// Dispatcher used by the preview and download paths. Returns either one SVG
// (single image, Portrait or Landscape) or an ordered array of image-set cards.
function buildShareImages(options = shareOptions) {
  if (options.format === "set") {
    return { mode: "set", cards: buildShareImageSetPages(options) };
  }
  const svg = options.shape === "wide" ? buildShareWideSvg(options) : buildShareSvg(options);
  return { mode: "single", svg };
}

function updateShareOptionControls() {
  shareDisplayName.value = shareOptions.displayName || "";
  shareIncludeTop.checked = shareOptions.top;
  shareIncludeBottom.checked = shareOptions.bottom;
  shareIncludeEras.checked = shareOptions.eras;
  shareIncludeGenres.checked = shareOptions.genres;
  shareIncludePeople.checked = shareOptions.people;
  shareIncludeQueues.checked = shareOptions.queues;
  shareIncludeFullList.checked = shareOptions.fullList;
  shareFullListStyleControls.forEach((input) => {
    input.checked = input.value === shareOptions.fullListStyle;
  });
  document.querySelectorAll('input[name="share-theme"]').forEach((input) => {
    input.checked = input.value === shareOptions.theme;
  });
  document.querySelectorAll('input[name="share-tone"]').forEach((input) => {
    input.checked = input.value === shareOptions.tone;
  });
  document.querySelectorAll('input[name="share-format"]').forEach((input) => {
    input.checked = input.value === shareOptions.format;
  });
  document.querySelectorAll('input[name="share-shape"]').forEach((input) => {
    input.checked = input.value === shareOptions.shape;
  });
  updateShareModeControls();
}

// In v1 the Shape control only applies to the single image; every image-set
// card is phone-portrait, so hide Shape when Format is "set".
function updateShareModeControls() {
  if (shareShapeFieldset) {
    shareShapeFieldset.hidden = shareOptions.format === "set";
  }
}

function saveShareOptions() {
  if (!storageEnabled) return;
  try {
    localStorage.setItem(SHARE_OPTIONS_KEY, JSON.stringify(shareOptions));
  } catch (error) {
    // Ignore storage failures.
  }
}

function loadShareOptions() {
  if (!storageEnabled) return;
  try {
    const raw = localStorage.getItem(SHARE_OPTIONS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const hasV2 = parsed.version >= 2;
    const hasV3 = parsed.version >= 3;
    const hasV5 = parsed.version >= 5;
    shareOptions = {
      version: SHARE_OPTIONS_VERSION,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName.slice(0, 36) : "",
      top: parsed.top !== false,
      bottom: hasV2 ? parsed.bottom !== false : true,
      eras: hasV3 ? parsed.eras !== false : parsed.decades !== false || parsed.range !== false,
      genres: hasV3 ? parsed.genres !== false : true,
      people: hasV3 ? parsed.people !== false : true,
      queues: hasV3 ? parsed.queues !== false : true,
      fullList: hasV3 ? parsed.fullList !== false : true,
      fullListStyle: hasV5 && ["posters", "text", "mixed"].includes(parsed.fullListStyle) ? parsed.fullListStyle : "mixed",
      theme: ["classic", "cinema", "warm", "marquee", "pop"].includes(parsed.theme)
        ? parsed.theme
        : "classic",
      tone: ["neutral", "punchy", "funny", "extreme"].includes(parsed.tone)
        ? parsed.tone
        : parsed.tone === "savage"
          ? "extreme"
        : "neutral",
      // v6: image exports gain a Format (single image / image set) and a Shape
      // (portrait / landscape). Existing users default to today's behavior.
      format: parsed.format === "set" ? "set" : "single",
      shape: parsed.shape === "wide" || parsed.shape === "landscape" ? "wide" : "skinny",
    };
  } catch (error) {
    // Ignore storage failures.
  }
}

// Status text + button states only — cheap, and crucially does NOT touch the
// preview, so calling it repeatedly (e.g. per enrichment batch) never flickers.
function updateShareExportControls() {
  const insights = getRankingInsights();
  const disabled = !insights.count;
  shareDownloadPng.disabled = disabled || sharePngPreparing;
  shareDownloadSvg.disabled = disabled || sharePngPreparing;
  shareCopyMarkdown.disabled = disabled;
  shareCopyJson.disabled = disabled;
  shareCopyText.disabled = disabled;
  shareExportStatus.textContent = sharePngPreparing
    ? "Preparing poster images for PNG..."
    : shareDetailsLoading
    ? "Loading genres, cast, crew, and poster wall assets..."
    : insights.detailCount
      ? `${insights.detailCount} ranked movies enriched with detail data.`
      : "";
}

function updateShareStudio() {
  const images = buildShareImages();
  if (images.mode === "set") {
    const markup = images.cards
      .map((card) => `<div class="share-preview-card">${card.svg}</div>`)
      .join("");
    if (markup !== lastSharePreviewMarkup) {
      sharePreview.innerHTML = markup;
      lastSharePreviewMarkup = markup;
    }
    const count = images.cards.length;
    shareDownloadPng.textContent = count ? `Download images (${count})` : "Download images";
    shareDownloadSvg.textContent = "SVG set";
  } else {
    if (images.svg !== lastSharePreviewMarkup) {
      sharePreview.innerHTML = images.svg;
      lastSharePreviewMarkup = images.svg;
    }
    shareDownloadPng.textContent = "Download PNG";
    shareDownloadSvg.textContent = "SVG";
  }
  updateShareExportControls();
}

function lockShareScroll() {
  shareScrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = "fixed";
  document.body.style.top = `-${shareScrollLockY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockShareScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo({ left: 0, top: shareScrollLockY, behavior: "auto" });
  shareScrollLockY = 0;
}

function openShareStudio() {
  if (!ranking.length) return;
  shareStudioTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  lastSharePreviewMarkup = "";
  // Reflect loading in the very first render so detail-backed sections (genres,
  // cast & crew) show a loading skeleton instead of an empty "no data" card.
  shareDetailsLoading = true;
  updateShareOptionControls();
  updateShareStudio();
  lockShareScroll();
  shareStudio.hidden = false;
  shareStudio.scrollTop = 0;
  const shareSheet = shareStudio.querySelector(".share-sheet");
  if (shareSheet) shareSheet.scrollTop = 0;
  document.body.classList.add("is-share-open");
  shareClose.focus({ preventScroll: true });
  void enrichShareAssets();
}

function closeShareStudio({ restoreFocus = true } = {}) {
  shareDetailRequestId += 1;
  shareDetailsLoading = false;
  shareStudio.hidden = true;
  lastSharePreviewMarkup = "";
  document.body.classList.remove("is-share-open");
  unlockShareScroll();
  if (restoreFocus && shareStudioTrigger && document.contains(shareStudioTrigger)) {
    shareStudioTrigger.focus({ preventScroll: true });
  }
  shareStudioTrigger = null;
}

function updateShareOptionsFromControls() {
  const selectedTheme = document.querySelector('input[name="share-theme"]:checked');
  const selectedTone = document.querySelector('input[name="share-tone"]:checked');
  const selectedFullListStyle = document.querySelector('input[name="share-full-list-style"]:checked');
  const selectedFormat = document.querySelector('input[name="share-format"]:checked');
  const selectedShape = document.querySelector('input[name="share-shape"]:checked');
  shareOptions = {
    version: SHARE_OPTIONS_VERSION,
    displayName: shareDisplayName.value.trim().slice(0, 36),
    top: shareIncludeTop.checked,
    bottom: shareIncludeBottom.checked,
    eras: shareIncludeEras.checked,
    genres: shareIncludeGenres.checked,
    people: shareIncludePeople.checked,
    queues: shareIncludeQueues.checked,
    fullList: shareIncludeFullList.checked,
    fullListStyle: ["posters", "text", "mixed"].includes(selectedFullListStyle?.value)
      ? selectedFullListStyle.value
      : "mixed",
    theme: selectedTheme?.value || "classic",
    tone: selectedTone?.value || "neutral",
    format: selectedFormat?.value === "set" ? "set" : "single",
    shape: selectedShape?.value === "wide" ? "wide" : "skinny",
  };
  updateShareModeControls();
  if (
    !shareOptions.top &&
    !shareOptions.bottom &&
    !shareOptions.eras &&
    !shareOptions.genres &&
    !shareOptions.people &&
    !shareOptions.queues &&
    !shareOptions.fullList
  ) {
    shareOptions.top = true;
    shareIncludeTop.checked = true;
  }
  saveShareOptions();
  updateShareStudio();
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadPosterData(movie) {
  if (!movie?.posterPath || posterDataCache.has(movie.posterPath)) return;
  try {
    const response = await fetch(`${TMDB_POSTER_SMALL}${movie.posterPath}`, { mode: "cors" });
    if (!response.ok) return;
    const blob = await response.blob();
    posterDataCache.set(movie.posterPath, await readBlobAsDataUrl(blob));
  } catch (error) {
    // Poster embedding is a best-effort enhancement.
  }
}

async function enrichShareAssets() {
  const requestId = ++shareDetailRequestId;
  shareDetailsLoading = true;
  updateShareExportControls();
  const detailMovies = [...watchList, ...notInterestedList, ...ranking].filter((movie) => movie.tmdbId);
  const seenDetailIds = new Set();
  const detailTargets = detailMovies
    .filter((movie) => {
      const id = String(movie.tmdbId);
      if (seenDetailIds.has(id) || detailCache.has(id)) return false;
      seenDetailIds.add(id);
      return true;
    })
    .slice(0, 120);
  const posterTargets = ranking.filter((movie) => movie.posterPath).slice(0, 70);

  // While batches stream in, only refresh the status line — not the preview.
  // The preview is rebuilt once per phase so it never flickers per batch.
  for (let i = 0; i < detailTargets.length; i += 4) {
    if (requestId !== shareDetailRequestId) return;
    await Promise.all(detailTargets.slice(i, i + 4).map(fetchMovieDetail));
    updateShareExportControls();
  }
  if (requestId !== shareDetailRequestId) return;
  if (detailTargets.length) updateShareStudio();

  for (let i = 0; i < posterTargets.length; i += 8) {
    if (requestId !== shareDetailRequestId) return;
    await Promise.all(posterTargets.slice(i, i + 8).map(loadPosterData));
    updateShareExportControls();
  }

  if (requestId !== shareDetailRequestId) return;
  shareDetailsLoading = false;
  updateShareStudio();
}

async function prepareSharePosterData(limit = 70) {
  const posterTargets = ranking.filter((movie) => movie.posterPath).slice(0, limit);
  for (let i = 0; i < posterTargets.length; i += 8) {
    await Promise.all(posterTargets.slice(i, i + 8).map(loadPosterData));
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadShareSvg() {
  if (!ranking.length) return;
  const images = buildShareImages({ ...shareOptions, externalPosters: true });
  if (images.mode === "set") {
    for (let i = 0; i < images.cards.length; i += 1) {
      const card = images.cards[i];
      downloadBlob(new Blob([card.svg], { type: "image/svg+xml;charset=utf-8" }), card.svgFilename);
      // Brief stagger so browsers reliably surface each download.
      if (i < images.cards.length - 1) await new Promise((resolve) => setTimeout(resolve, 350));
    }
    setAddFeedback(`Downloaded ${images.cards.length} share SVGs.`);
    return;
  }
  downloadBlob(new Blob([images.svg], { type: "image/svg+xml;charset=utf-8" }), "stackrank-movies.svg");
  setAddFeedback("Share SVG downloaded.");
}

function getSvgPosterOverlays(svg) {
  const documentSvg = new DOMParser().parseFromString(svg, "image/svg+xml");
  const transformOffset = (node) => {
    let x = 0;
    let y = 0;
    let current = node.parentElement;
    while (current && current.tagName.toLowerCase() !== "svg") {
      const transform = current.getAttribute("transform") || "";
      const match = transform.match(/translate\(\s*([-.\d]+)(?:[\s,]+([-.\d]+))?\s*\)/);
      if (match) {
        x += Number(match[1]) || 0;
        y += Number(match[2]) || 0;
      }
      current = current.parentElement;
    }
    return { x, y };
  };
  return Array.from(documentSvg.querySelectorAll("image"))
    .map((image) => {
      const offset = transformOffset(image);
      return {
        href: image.getAttribute("href") || image.getAttribute("xlink:href") || "",
        x: Number(image.getAttribute("x")) + offset.x,
        y: Number(image.getAttribute("y")) + offset.y,
        width: Number(image.getAttribute("width")),
        height: Number(image.getAttribute("height")),
      };
    })
    .filter(
      (item) =>
        item.href &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y) &&
        Number.isFinite(item.width) &&
        Number.isFinite(item.height),
    );
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(context, image, x, y, width, height) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function drawPosterOverlays(context, overlays) {
  let drawn = 0;
  for (const overlay of overlays) {
    try {
      const image = await loadCanvasImage(overlay.href);
      drawImageCover(context, image, overlay.x, overlay.y, overlay.width, overlay.height);
      drawn += 1;
    } catch (error) {
      // Keep the SVG fallback tile if an individual poster cannot be drawn.
    }
  }
  return drawn;
}

// Rasterizes one share SVG to a PNG blob. `baseSvg` is drawn onto the canvas
// (posters omitted so cross-origin images don't taint it); `posterSvg` carries
// the proxied poster <image> tags whose positions are overlaid afterward.
function renderShareSvgToPngBlob(baseSvg, posterSvg) {
  return new Promise((resolve, reject) => {
    const posterOverlays = getSvgPosterOverlays(posterSvg);
    const widthMatch = baseSvg.match(/width="(\d+)"/);
    const heightMatch = baseSvg.match(/height="(\d+)"/);
    const exportWidth = widthMatch ? Number(widthMatch[1]) : 1200;
    const exportHeight = heightMatch ? Number(heightMatch[1]) : 1600;
    const svgUrl = URL.createObjectURL(new Blob([baseSvg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const context = canvas.getContext("2d");
      try {
        context.drawImage(image, 0, 0);
        const drawnPosters = await drawPosterOverlays(context, posterOverlays);
        if (posterOverlays.length && !drawnPosters) {
          throw new Error("Could not draw poster overlays");
        }
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Could not create PNG."));
            return;
          }
          resolve(blob);
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(svgUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Could not load SVG image."));
    };
    image.src = svgUrl;
  });
}

async function downloadSharePng() {
  if (!ranking.length) return;
  sharePngPreparing = true;
  updateShareStudio();
  await prepareSharePosterData(shareOptions.format === "set" ? Math.max(70, ranking.length) : 70);
  updateShareStudio();
  try {
    if (shareOptions.format === "set") {
      const baseCards = buildShareImageSetPages({ ...shareOptions, externalPosters: false });
      const proxyCards = buildShareImageSetPages({ ...shareOptions, externalPosters: true, posterProxy: true });
      for (let i = 0; i < baseCards.length; i += 1) {
        shareExportStatus.textContent = `Preparing image ${i + 1} of ${baseCards.length}...`;
        const blob = await renderShareSvgToPngBlob(baseCards[i].svg, (proxyCards[i] || baseCards[i]).svg);
        downloadBlob(blob, baseCards[i].filename);
        // Stagger so the browser reliably surfaces each sequential download.
        if (i < baseCards.length - 1) await new Promise((resolve) => setTimeout(resolve, 400));
      }
      sharePngPreparing = false;
      setAddFeedback(`Downloaded ${baseCards.length} share images.`);
      shareExportStatus.textContent = `Downloaded ${baseCards.length} share images.`;
      updateShareStudio();
      return;
    }

    const base = buildShareImages({ ...shareOptions, externalPosters: false });
    const proxy = buildShareImages({ ...shareOptions, externalPosters: true, posterProxy: true });
    const blob = await renderShareSvgToPngBlob(base.svg, proxy.svg);
    sharePngPreparing = false;
    downloadBlob(blob, "stackrank-movies.png");
    setAddFeedback("Share PNG downloaded.");
    shareExportStatus.textContent = "Share PNG downloaded.";
    updateShareStudio();
  } catch (error) {
    sharePngPreparing = false;
    setAddFeedback("Could not create PNG.");
    shareExportStatus.textContent = "Could not create PNG.";
    updateShareStudio();
  }
}

async function copyShareExport(format) {
  if (!ranking.length) return;
  const payload =
    format === "json"
      ? JSON.stringify(buildShareDataExport(), null, 2)
      : format === "markdown"
        ? buildShareMarkdown()
        : buildExportText();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(payload);
      setAddFeedback(`Copied ${format} export.`);
      shareExportStatus.textContent = `Copied ${format} export.`;
      return;
    }
  } catch (error) {
    // Fall through to prompt.
  }
  window.prompt(`Copy ${format} export:`, payload);
}

const updateDebugPanel = (extra = {}) => {
  if (!debugEnabled) return;
  debugPanel.classList.remove("debug--hidden");
  const rankingSummary = ranking.map((movie) => ({
    title: movie.title,
    year: movie.year || null,
    tmdbId: movie.tmdbId || null,
  }));
  const payload = {
    migration: migrationStats,
    rankingCount: ranking.length,
    watchCount: watchList.length,
    notInterestedCount: notInterestedList.length,
    rankingSummary,
    selectedSuggestion: selectedSuggestion
      ? {
          title: selectedSuggestion.title,
          year: selectedSuggestion.year || null,
          tmdbId: selectedSuggestion.tmdbId || null,
        }
      : null,
    ...extra,
  };
  debugContent.textContent = JSON.stringify(payload, null, 2);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveTmdbMatch = async (movie) => {
  if (!tmdbProxyEnabled) return null;
  const query = movie.title;
  const url = `${tmdbProxyUrl}?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];
    if (!results.length) return null;
    const byYear =
      movie.year &&
      results.find((result) => result.year && Number(result.year) === Number(movie.year));
    return byYear || results[0];
  } catch (error) {
    return null;
  }
};

const migrateRanking = async () => {
  const missing = ranking.filter((movie) => !movie.tmdbId);
  migrationStats = { missing: missing.length, updated: 0, skipped: 0 };
  if (!missing.length) return;
  setStatusMessage("Updating existing items…", 2400);
  let updated = false;
  for (const movie of missing) {
    const match = await resolveTmdbMatch(movie);
    if (match && match.tmdbId) {
      movie.tmdbId = match.tmdbId;
      if (!movie.posterPath) movie.posterPath = match.posterPath;
      if (!movie.year && match.year) movie.year = match.year;
      updated = true;
      migrationStats.updated += 1;
    } else {
      migrationStats.skipped += 1;
    }
    await sleep(180);
  }
  if (updated) {
    await saveRanking();
    renderRanking();
  }
  updateDebugPanel();
};

const setAuthUI = () => {
  if (!supabaseEnabled) {
    authSignedOut.classList.add("auth__hidden");
    authSignedIn.classList.add("auth__hidden");
    authStatus.textContent = "Supabase is not configured.";
    updateRankingSettingsAuthUI();
    return;
  }

  if (currentUser) {
    authSignedOut.classList.add("auth__hidden");
    authSignedIn.classList.remove("auth__hidden");
    authUserLabel.textContent = `Signed in as ${currentUser.email || "user"}`;
    authStatus.textContent = authNotice;
  } else {
    authSignedOut.classList.remove("auth__hidden");
    authSignedIn.classList.add("auth__hidden");
    authStatus.textContent = authNotice;
  }
  updateRankingSettingsAuthUI();
};

const handleSignIn = async (sourceInput = authEmailInput) => {
  if (!supabaseEnabled || !supabase) return;
  authNotice = "";
  const email = sourceInput.value.trim();
  if (!email) {
    authStatus.textContent = "Add an email address to receive a sign-in link.";
    sourceInput.focus();
    return;
  }
  authStatus.textContent = "Sending magic link...";
  const redirectBase = window.location.hostname.includes("github.io")
    ? `${window.location.origin}/StackRank-Web/`
    : window.location.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectBase,
    },
  });
  if (error) {
    authStatus.textContent = `Sign-in failed: ${error.message}`;
    return;
  }
  authEmailInput.value = "";
  settingsAuthEmailInput.value = "";
  authStatus.textContent = "Check your email for the sign-in link.";
  closeRankingSettings({ restoreFocus: false });
};

const handleSignOut = async () => {
  if (!supabaseEnabled || !supabase) return;
  authNotice = "";
  const { error } = await supabase.auth.signOut();
  if (error) {
    authStatus.textContent = `Sign-out failed: ${error.message}`;
    return;
  }
  ranking = [];
  pending = null;
  pendingOrigin = null;
  searchRange = null;
  saveRanking();
  setComparisonMode(false);
  renderRanking();
  await loadSuggestionQueues();
  await loadPackProgress();
  renderSuggestionQueues();
  renderPackSurfaces();
  updateSuggestions();
  authStatus.textContent = "Signed out.";
  closeRankingSettings({ restoreFocus: false });
};

const initAuth = async () => {
  if (!supabaseEnabled || !supabase) return;
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_INIT_TIMEOUT_MS,
      "Supabase auth initialization timed out.",
    );
    currentUser = data.session ? data.session.user : null;
    authNotice = "";
  } catch (error) {
    currentUser = null;
    authNotice = "Could not reach Supabase. Showing local list.";
    console.warn("Could not initialize Supabase auth", error);
  }
  setAuthUI();
  updateStatus();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    authNotice = "";
    setAuthUI();
    updateStatus();
    loadRanking()
      .then(loadSuggestionQueues)
      .then(loadPackProgress)
      .then(migrateRanking)
      .then(() => {
        renderRanking();
        renderSuggestionQueues();
        renderPackSurfaces();
        updateDebugPanel();
        updateSuggestions();
      })
      .catch((error) => {
        authNotice = "Could not sync with Supabase. Showing local list.";
        setAuthUI();
        console.warn("Could not refresh synced list", error);
      });
  });

  authSignInButton.addEventListener("click", () => handleSignIn(authEmailInput));
  authSignOutButton.addEventListener("click", handleSignOut);
};

const toStoredMovie = (movie) => ({
  title: movie.title,
  year: movie.year,
  posterPath: movie.posterPath,
  tmdbId: movie.tmdbId,
  rankedAt: movie.rankedAt,
  queuedAt: movie.queuedAt,
  savedAt: movie.savedAt,
  hiddenAt: movie.hiddenAt,
  genres: movie.genres,
  director: movie.director,
  cast: movie.cast,
});

const removeMovieFromSuggestionQueues = (movie) => {
  watchList = removeMovieFromList(watchList, movie);
  notInterestedList = removeMovieFromList(notInterestedList, movie);
};

const queueLabel = (source) => (source === "watch" ? "Watch next" : "Not for me");

const persistSuggestionQueues = () => {
  void saveSuggestionQueues();
  renderSuggestionQueues();
  updateDebugPanel();
};

const addSuggestionToQueue = (movie, target, sectionKey = null) => {
  if (pending) {
    setStatusMessage("Finish the current comparison before saving suggestions.");
    return;
  }
  if (isDuplicateMovie(movie)) {
    setStatusMessage(`"${movie.title}" is already in your list. Add something else.`);
    updateDebugPanel({ duplicateBlocked: movie.tmdbId || movie.title });
    if (sectionKey) {
      replaceQueuedSuggestion(sectionKey, movie);
    }
    return;
  }
  const now = new Date().toISOString();
  const storedMovie = {
    ...toStoredMovie(movie),
    queuedAt: now,
    savedAt: target === "watch" ? now : movie.savedAt,
    hiddenAt: target === "notInterested" ? now : movie.hiddenAt,
  };
  removeMovieFromSuggestionQueues(storedMovie);
  if (target === "watch") {
    watchList.push(storedMovie);
  } else {
    notInterestedList.push(storedMovie);
  }
  persistSuggestionQueues();
  setAddFeedback(`"${movie.title}" moved to ${queueLabel(target)}.`, 2600);
  if (!sectionKey || !replaceQueuedSuggestion(sectionKey, storedMovie)) {
    updateSuggestions();
  }
  renderPackSurfaces();
};

const getQueueOrigin = (movie) => {
  const key = movieKey(movie);
  const watchIndex = watchList.findIndex((item) => movieKey(item) === key);
  if (watchIndex >= 0) {
    return { type: "watch", movie: { ...watchList[watchIndex] }, index: watchIndex };
  }
  const notInterestedIndex = notInterestedList.findIndex((item) => movieKey(item) === key);
  if (notInterestedIndex >= 0) {
    return {
      type: "notInterested",
      movie: { ...notInterestedList[notInterestedIndex] },
      index: notInterestedIndex,
    };
  }
  return null;
};

const startRankingMovie = (movie, context = null) => {
  if (pending) {
    setStatusMessage("Finish the current comparison before ranking another movie.");
    return;
  }
  if (isDuplicateMovie(movie)) {
    removeMovieFromSuggestionQueues(movie);
    persistSuggestionQueues();
    setStatusMessage(`"${movie.title}" is already in your list. Add something else.`);
    updateDebugPanel({ duplicateBlocked: movie.tmdbId || movie.title });
    updateSuggestions();
    renderPackSurfaces();
    return;
  }
  if (context?.type === "pack") {
    const pack = getPackBySlug(context.slug);
    if (pack) markPackEngaged(pack, { lastIndex: Number(context.index || 0) });
  }
  captureComparisonReturnScroll();
  pendingOrigin = getQueueOrigin(movie);
  pendingPackContext = context;
  removeMovieFromSuggestionQueues(movie);
  persistSuggestionQueues();
  pending = {
    ...movie,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    tmdbId: movie.tmdbId,
    comparisons: 0,
  };
  startComparison();
  updateDebugPanel({ addedMovie: pending?.tmdbId || pending?.title || null });
};

const moveQueueMovie = (source, index) => {
  const fromList = source === "watch" ? watchList : notInterestedList;
  const movie = fromList[index];
  if (!movie) return;
  const target = source === "watch" ? "notInterested" : "watch";
  const now = new Date().toISOString();
  const movedMovie = {
    ...movie,
    queuedAt: movie.queuedAt || now,
    savedAt: target === "watch" ? now : movie.savedAt,
    hiddenAt: target === "notInterested" ? now : movie.hiddenAt,
  };
  removeMovieFromSuggestionQueues(movie);
  if (target === "watch") {
    watchList.push(movedMovie);
  } else {
    notInterestedList.push(movedMovie);
  }
  persistSuggestionQueues();
  setAddFeedback(`"${movie.title}" moved to ${queueLabel(target)}.`, 2600);
  updateSuggestions();
  renderPackSurfaces();
};

const findQueueMovieIndex = (source, movie) => {
  const list = source === "watch" ? watchList : notInterestedList;
  const key = movieKey(movie);
  return list.findIndex((item) => movieKey(item) === key);
};

const moveQueueMovieByMovie = (source, movie) => {
  const index = findQueueMovieIndex(source, movie);
  if (index < 0) return;
  moveQueueMovie(source, index);
};

const removeQueueMovie = (source, index) => {
  const list = source === "watch" ? watchList : notInterestedList;
  const movie = list[index];
  if (!movie) return;
  if (source === "watch") {
    watchList = removeMovieFromList(watchList, movie);
  } else {
    notInterestedList = removeMovieFromList(notInterestedList, movie);
  }
  persistSuggestionQueues();
  setAddFeedback(`"${movie.title}" removed from ${queueLabel(source)}.`, 2600);
  updateSuggestions();
  renderPackSurfaces();
};

const removeQueueMovieByMovie = (source, movie) => {
  const index = findQueueMovieIndex(source, movie);
  if (index < 0) return;
  removeQueueMovie(source, index);
};

const handleQueueInteraction = (event) => {
  const item = event.target.closest(".queue-list__item");
  if (!item) return;
  const source = item.dataset.source;
  const index = Number(item.dataset.index);
  if (Number.isNaN(index)) return;

  const actionButton = event.target.closest(".queue-action");
  if (actionButton) {
    event.stopPropagation();
    const action = actionButton.dataset.action;
    if (action === "move") {
      moveQueueMovie(source, index);
    } else if (action === "remove") {
      removeQueueMovie(source, index);
    }
    return;
  }

  const list = source === "watch" ? watchList : notInterestedList;
  const movie = list[index];
  if (movie) startRankingMovie(movie);
};

const handleQueueKeydown = (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest(".queue-action, .queue-info")) return;
  const item = event.target.closest(".queue-list__item");
  if (!item) return;
  event.preventDefault();
  const source = item.dataset.source;
  const index = Number(item.dataset.index);
  const list = source === "watch" ? watchList : notInterestedList;
  const movie = list[index];
  if (movie) startRankingMovie(movie);
};

watchListEl.addEventListener("click", handleQueueInteraction);
notInterestedListEl.addEventListener("click", handleQueueInteraction);
watchListEl.addEventListener("keydown", handleQueueKeydown);
notInterestedListEl.addEventListener("keydown", handleQueueKeydown);
skipPackMovieButton.addEventListener("click", skipCurrentPackMovie);
packViewAll.addEventListener("click", openAllPacks);
packDetailClose.addEventListener("click", () => closePackDetail());
packDetailOverlay.addEventListener("click", (event) => {
  if (event.target === packDetailOverlay) {
    closePackDetail();
  }
});
packAutoStart.addEventListener("click", () => {
  if (currentPackSlug) startAutoPack(currentPackSlug);
});
packShowHandled.addEventListener("click", () => {
  packDetailShowHandled = !packDetailShowHandled;
  renderPackDetail();
});
packSaveAll.addEventListener("click", () => {
  const pack = getPackBySlug(currentPackSlug);
  if (pack) addPackRemainingToQueue(pack, "watch");
});
packHideAll.addEventListener("click", () => {
  const pack = getPackBySlug(currentPackSlug);
  if (pack) addPackRemainingToQueue(pack, "notInterested");
});

detailClose.addEventListener("click", () => closeMovieDetail());

detailOverlay.addEventListener("click", (event) => {
  if (event.target === detailOverlay) {
    closeMovieDetail();
  }
});

detailRank.addEventListener("click", () => {
  if (!currentDetail) return;
  const { movie, context } = currentDetail;
  if (context.type === "ranked") return;
  closeMovieDetail({ restoreFocus: false });
  if (context.type === "pack") {
    const pack = getPackBySlug(context.slug);
    if (pack) startPackMovieRanking(pack, movie, "browse");
  } else {
    if (context.type === "queue" && context.slug) closePackDetail({ restoreFocus: false });
    startRankingFromSuggestion(movie);
  }
});

detailSave.addEventListener("click", () => {
  if (!currentDetail) return;
  const { movie, context } = currentDetail;
  if (context.type === "ranked") return;
  closeMovieDetail({ restoreFocus: false });
  if (context.type === "queue") {
    moveQueueMovieByMovie(context.source, movie);
  } else if (context.type === "pack") {
    const pack = getPackBySlug(context.slug);
    if (pack) addPackMovieToQueue(pack, movie, "watch");
  } else {
    addSuggestionToQueue(movie, "watch", context.sectionKey);
  }
});

detailHide.addEventListener("click", () => {
  if (!currentDetail) return;
  const { movie, context } = currentDetail;
  if (context.type === "ranked") return;
  closeMovieDetail({ restoreFocus: false });
  if (context.type === "queue") {
    removeQueueMovieByMovie(context.source, movie);
  } else if (context.type === "pack") {
    const pack = getPackBySlug(context.slug);
    if (pack) addPackMovieToQueue(pack, movie, "notInterested");
  } else {
    addSuggestionToQueue(movie, "notInterested", context.sectionKey);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!rankingSettingsPanel.hidden) {
    closeRankingSettings();
    return;
  }
  if (!shareStudio.hidden) {
    closeShareStudio();
    return;
  }
  if (!detailOverlay.hidden) {
    closeMovieDetail();
    return;
  }
  if (!packDetailOverlay.hidden) {
    closePackDetail();
  }
});

const hideSuggestions = () => {
  suggestions.style.display = "none";
  suggestions.innerHTML = "";
  suggestionItems = [];
  activeSuggestionIndex = -1;
  currentSuggestions = [];
};

const setActiveSuggestion = (index) => {
  if (!suggestionItems.length) return;
  activeSuggestionIndex = index;
  suggestionItems.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add("is-active");
    } else {
      item.classList.remove("is-active");
    }
  });
};

const pickSuggestion = (movie) => {
  if (pending) return;
  selectedSuggestion = movie;
  titleInput.value = movie.title;
  hideSuggestions();
  startRankingFromSelection();
};

const startRankingFromSelection = () => {
  if (!selectedSuggestion) return;
  setAddFeedback("");
  const suggestionMatches = selectedSuggestion && selectedSuggestion.title === titleInput.value.trim();
  if (!suggestionMatches) {
    setStatusMessage("Select a movie from the suggestions to add.");
    return;
  }
  if (isDuplicateMovie(selectedSuggestion)) {
    setStatusMessage(`"${selectedSuggestion.title}" is already in your list. Add something else.`);
    updateDebugPanel({ duplicateBlocked: selectedSuggestion.tmdbId || selectedSuggestion.title });
    return;
  }
  const movie = selectedSuggestion;
  selectedSuggestion = null;
  startRankingMovie(movie);
};

const startRankingFromSuggestion = (movie) => {
  startRankingMovie(movie);
};

const renderSuggestions = (movies) => {
  suggestions.innerHTML = "";
  suggestionItems = [];
  activeSuggestionIndex = -1;
  currentSuggestions = movies;

  if (!movies.length) {
    hideSuggestions();
    return;
  }

  movies.forEach((movie, index) => {
    const item = document.createElement("div");
    item.className = "suggestions__item";
    item.setAttribute("role", "option");
    item.dataset.index = index;

    const poster = document.createElement("img");
    poster.className = "suggestions__poster";
    if (movie.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      poster.alt = `${movie.title} poster`;
      poster.style.visibility = "visible";
    } else {
      poster.alt = "";
      poster.style.visibility = "hidden";
    }

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "suggestions__title";
    title.textContent = movie.title;
    const meta = document.createElement("div");
    meta.className = "suggestions__meta";
    meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";
    text.append(title, meta);

    item.append(poster, text);
    item.addEventListener("click", () => pickSuggestion(movie));
    suggestions.appendChild(item);
    suggestionItems.push(item);
  });

  suggestions.style.display = "block";
};

const fetchSuggestions = async (query) => {
  if (!tmdbProxyEnabled) return;
  const url = `${tmdbProxyUrl}?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) {
      hideSuggestions();
      return;
    }
    const data = await response.json();
    if (titleInput.value.trim() !== query) return;
    const movies = (data.results || []).slice(0, 6);
    renderSuggestions(movies);
  } catch (error) {
    hideSuggestions();
  }
};

titleInput.addEventListener("input", (event) => {
  selectedSuggestion = null;
  const value = event.target.value.trim();

  if (!tmdbProxyEnabled || value.length < 2) {
    hideSuggestions();
    return;
  }

  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    fetchSuggestions(value);
  }, 250);
});

titleInput.addEventListener("keydown", (event) => {
  if (!suggestionItems.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = (activeSuggestionIndex + 1) % suggestionItems.length;
    setActiveSuggestion(nextIndex);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex = (activeSuggestionIndex - 1 + suggestionItems.length) % suggestionItems.length;
    setActiveSuggestion(nextIndex);
  } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    const movie = currentSuggestions[activeSuggestionIndex];
    if (movie) {
      pickSuggestion(movie);
    }
  }
});

document.addEventListener("click", (event) => {
  if (
    !rankingSettingsPanel.hidden &&
    !rankingSettingsPanel.contains(event.target) &&
    event.target !== rankingSettingsToggle
  ) {
    closeRankingSettings({ restoreFocus: false });
  }
  if (!suggestions.contains(event.target) && event.target !== titleInput) {
    hideSuggestions();
  }
});

suggestions.addEventListener("mousemove", (event) => {
  const item = event.target.closest(".suggestions__item");
  if (!item) return;
  const index = suggestionItems.indexOf(item);
  if (index >= 0) setActiveSuggestion(index);
});

// Fill the main panels with shimmer placeholders while the list/queues load on
// boot (the signed-in Supabase fetch can take a second or two). The real
// renders at the end of init() replace these.
function renderBootSkeleton() {
  const rankRow = `
    <li class="skeleton-item" aria-hidden="true">
      <span class="skeleton skeleton-handle"></span>
      <span class="skeleton skeleton-poster"></span>
      <span class="skeleton-lines">
        <span class="skeleton skeleton-line skeleton-line--title"></span>
        <span class="skeleton skeleton-line skeleton-line--meta"></span>
      </span>
    </li>`;
  if (rankingList) rankingList.innerHTML = rankRow.repeat(6);

  if (snapshotContent) {
    const card = `<span class="skeleton skeleton-card"></span>`;
    snapshotContent.innerHTML = `<div class="snapshot__skeleton" aria-hidden="true">${card.repeat(3)}</div>`;
  }

  const queueRow = `
    <li class="skeleton-queue" aria-hidden="true">
      <span class="skeleton skeleton-poster"></span>
      <span class="skeleton-lines">
        <span class="skeleton skeleton-line skeleton-line--title"></span>
        <span class="skeleton skeleton-line skeleton-line--meta"></span>
      </span>
    </li>`;
  if (watchListEl) watchListEl.innerHTML = queueRow.repeat(2);
  if (notInterestedListEl) notInterestedListEl.innerHTML = queueRow.repeat(2);
}

const init = async () => {
  startPlaceholderRotation();
  loadShareOptions();
  updateShareOptionControls();
  updateStatus();
  setAuthUI();
  renderBootSkeleton();
  try {
    await initAuth();
    await loadRanking();
    await loadSuggestionQueues();
    await loadSuggestionPacks();
    await loadPackProgress();
    await migrateRanking();
  } finally {
    // Always swap the skeletons for real content, even if a load step failed.
    renderRanking();
    renderSuggestionQueues();
    renderPackSurfaces();
    updateDebugPanel();
    suggestPopularCursor = 0;
    suggestRelatedCursor = 0;
    suggestEssentialsCursor = 0;
    updateSuggestions();
  }
};

init();
