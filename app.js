import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm";
import { createStoredZipBlob } from "./lib/zip.js";
import {
  mergeQueuePayloads,
  mergeRankingPayloads,
  normalizeSuggestionQueueLists,
  parseQueuePayload,
  parseRankingPayload,
} from "./lib/persistence.js?v=1";
import {
  xmlEscape,
  estimateSvgTextWidth,
  trimTextToSvgWidth,
  wrapTextToSvgWidth,
  svgTextLines,
} from "./lib/text.js";
import {
  formatRuntime,
  formatRuntimeTotal,
  formatShareRuntimeTotal,
  decadeLabel,
  rankedCountLabel,
  dayKey,
  formatShortDate,
} from "./lib/format.js";
import {
  normalizeTitle,
  movieKey,
  movieYear,
  isDuplicateMovie as isDuplicateInList,
} from "./lib/movie.js";
import { computeRankingInsights } from "./lib/insights.js";
import {
  mergePackLibraries,
  computePackStats,
  packStatusRank as libPackStatusRank,
  packStatusText as libPackStatusText,
  packActionText as libPackActionText,
  filterPacks,
  countPackFilterStates,
  sharePackCardStatus,
  summarizePacks,
  featuredPacks,
} from "./lib/packs.js?v=2";
import {
  getSharePickGroups,
  movieExportLine,
  buildNativeImageShareData,
  shareRankingMetaCards,
  buildShareExportSections as libBuildShareExportSections,
  sectionsToMarkdown,
  sectionsToText,
} from "./lib/share-export.js?v=1";
import {
  getShareDisplayName,
  possessiveName,
  lowercaseFirst,
  IMAGE_SET_WIDTH,
  IMAGE_SET_HEIGHT,
  buildShareHeader,
  composeShareSingleSvg,
  composeShareWideSvg,
  composeShareCard,
} from "./lib/share-svg.js";
import { comparisonMidIndex, firstComparisonIndex, applyComparison, isSearchSettled } from "./lib/ranking.js?v=2";
import { buildReviewQueue } from "./lib/review.js?v=1";
import { createUndoController } from "./lib/undo.js";
import {
  buildImportedRanking,
  buildStackRankBackup,
  chooseAutomaticTmdbMatch,
  parseRankedTitleList,
  parseStackRankBackup,
} from "./lib/backup.js?v=2";
import {
  buildSuggestionReason,
  buildSuggestionSectionSubtitle,
  isSuggestionReasonReady,
} from "./lib/suggestions.js?v=4";
import {
  filterFullscreenRanking,
  gridDropIndex,
  gridNavigationTarget,
  moveRankingItem,
} from "./lib/fullscreen-ranking.js?v=1";
import {
  buildProductEvent,
  countBucket,
  shouldCollectProductTelemetry,
} from "./lib/telemetry.js?v=3";
import {
  getFirstRunExperience,
  selectStarterPacks,
} from "./lib/ftue.js?v=1";
import {
  TASTE_EXPLORER_MIN_MOVIES,
  buildTasteSignals,
  tasteMatchingPacks,
  tasteSignalEntries,
  tasteSignalPackQuery,
} from "./lib/taste.js?v=3";
import {
  AUTH_PROVIDERS,
  enabledOAuthProviders,
  signInRedirectUrl,
  isLikelyEmail,
  normalizeAuthEmail,
} from "./lib/auth.js?v=1";

console.info("StackRank build", "taste-explorer-v1");

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
const reviewKeepButton = document.getElementById("review-keep");
const reviewSwapButton = document.getElementById("review-swap");
const reviewEndButton = document.getElementById("review-end");
const rankingReviewButton = document.getElementById("ranking-review");
const compareHeading = compareSection.querySelector(".panel__header h2");
const rankingList = document.getElementById("ranking");
const rankingFilter = document.getElementById("ranking-filter");
const rankingFilterToggle = document.getElementById("ranking-filter-toggle");
const rankingFilterInput = document.getElementById("ranking-filter-input");
const rankingFilterClear = document.getElementById("ranking-filter-clear");
const rankingFilterCount = document.getElementById("ranking-filter-count");
const rankingExpand = document.getElementById("ranking-expand");
const fullscreenOverlay = document.getElementById("ranking-fullscreen");
const fullscreenClose = document.getElementById("fullscreen-close");
const fullscreenTitle = document.getElementById("fullscreen-title");
const fullscreenGrid = document.getElementById("fullscreen-grid");
const fullscreenSub = document.getElementById("fullscreen-sub");
const fullscreenSearch = document.getElementById("fullscreen-search");
const fullscreenSearchClear = document.getElementById("fullscreen-search-clear");
const fullscreenJump = document.getElementById("fullscreen-jump");
const fullscreenJumpForm = document.getElementById("fullscreen-jump-form");
const fullscreenDensity = document.getElementById("fullscreen-density");
const watchListEl = document.getElementById("watch-list");
const notInterestedListEl = document.getElementById("not-interested-list");
const watchListSub = document.getElementById("watch-list-sub");
const notInterestedSub = document.getElementById("not-interested-sub");
const rankingSettingsToggle = document.getElementById("ranking-settings-toggle");
const rankingSettingsPanel = document.getElementById("ranking-settings-panel");
const rankingSettingsClose = document.getElementById("ranking-settings-close");
const settingsAuthState = document.getElementById("settings-auth-state");
const settingsAuthSignedOut = document.getElementById("settings-auth-signed-out");
const settingsSignInButton = document.getElementById("settings-sign-in");
const settingsSignOutButton = document.getElementById("settings-sign-out");
const signinOverlay = document.getElementById("signin-overlay");
const signinClose = document.getElementById("signin-close");
const signinProviders = document.getElementById("signin-providers");
const signinGoogleButton = document.getElementById("signin-google");
const signinAppleButton = document.getElementById("signin-apple");
const signinDivider = document.getElementById("signin-divider");
const signinMagicForm = document.getElementById("signin-magic-form");
const signinEmailInput = document.getElementById("signin-email");
const signinMagicSend = document.getElementById("signin-magic-send");
const signinStatus = document.getElementById("signin-status");
const downloadBackupButton = document.getElementById("download-backup");
const restoreBackupButton = document.getElementById("restore-backup");
const backupFileInput = document.getElementById("backup-file-input");
const backupStatus = document.getElementById("backup-status");
const openTitleImportButton = document.getElementById("open-title-import");
const firstRun = document.getElementById("first-run");
const firstRunEyebrow = document.getElementById("first-run-eyebrow");
const firstRunTitle = document.getElementById("first-run-title");
const firstRunBody = document.getElementById("first-run-body");
const quickStartImportButton = document.getElementById("quick-start-import");
const clearButton = document.getElementById("clear-list");
const shareButton = document.getElementById("share-list");
const snapshotSub = document.getElementById("snapshot-sub");
const snapshotContent = document.getElementById("snapshot-content");
const tasteExplorer = document.getElementById("taste-explorer");
const tasteToggle = document.getElementById("taste-toggle");
const tasteContent = document.getElementById("taste-content");
const tasteIntro = document.getElementById("taste-intro");
const tasteSignals = document.getElementById("taste-signals");
const tasteStatus = document.getElementById("taste-status");
const tasteDetail = document.getElementById("taste-detail");
const shareStudio = document.getElementById("share-studio");
const shareClose = document.getElementById("share-close");
const sharePreview = document.getElementById("share-preview");
const shareLightbox = document.getElementById("share-lightbox");
const shareLightboxImage = document.getElementById("share-lightbox-image");
const shareLightboxClose = document.getElementById("share-lightbox-close");
const shareLightboxStage = document.getElementById("share-lightbox-stage");
const shareLightboxPrev = document.getElementById("share-lightbox-prev");
const shareLightboxNext = document.getElementById("share-lightbox-next");
const shareLightboxBar = document.getElementById("share-lightbox-bar");
const shareLightboxCaption = document.getElementById("share-lightbox-caption");
const shareLightboxDownload = document.getElementById("share-lightbox-download");
const shareLightboxShare = document.getElementById("share-lightbox-share");
const shareDisplayName = document.getElementById("share-display-name");
const shareIncludeTop = document.getElementById("share-include-top");
const shareIncludeBottom = document.getElementById("share-include-bottom");
const shareIncludeEras = document.getElementById("share-include-eras");
const shareIncludeGenres = document.getElementById("share-include-genres");
const shareIncludePeople = document.getElementById("share-include-people");
const shareIncludeQueues = document.getElementById("share-include-queues");
const shareIncludePacks = document.getElementById("share-include-packs");
const shareIncludeFullList = document.getElementById("share-include-full-list");
const shareFullListStyleControls = document.querySelectorAll('input[name="share-full-list-style"]');
const shareShapeFieldset = document.getElementById("share-shape-fieldset");
const shareDownloadPng = document.getElementById("share-download-png");
const shareNativeShare = document.getElementById("share-native-share");
const shareDownloadSvg = document.getElementById("share-download-svg");
const shareCopyMarkdown = document.getElementById("share-copy-markdown");
const shareCopyJson = document.getElementById("share-copy-json");
const shareCopyText = document.getElementById("share-copy-text");
const shareExportStatus = document.getElementById("share-export-status");
// The header now exposes only a "Sign in" affordance (signed-out) and the
// settings gear; account details and Sign out live inside the settings popover.
const authSignInButton = document.getElementById("auth-sign-in");
const authStatus = document.getElementById("auth-status");
const debugPanel = document.getElementById("debug-panel");
const debugContent = document.getElementById("debug-content");
const addFeedback = document.getElementById("add-feedback");
const suggestPanel = document.getElementById("suggest-panel");
const suggestRelatedSection = document.getElementById("suggest-related-section");
const suggestRelatedTitle = document.getElementById("suggest-related-title");
const suggestRelatedSub = document.getElementById("suggest-related-sub");
const suggestRelated = document.getElementById("suggest-related");
const suggestRelatedEmpty = document.getElementById("suggest-related-empty");
const suggestPopular = document.getElementById("suggest-popular");
const suggestEssentials = document.getElementById("suggest-essentials");
const suggestRelatedMore = document.getElementById("suggest-related-more");
const suggestPopularMore = document.getElementById("suggest-popular-more");
const suggestEssentialsMore = document.getElementById("suggest-essentials-more");
const packSection = document.getElementById("pack-section");
const packSectionTitle = document.getElementById("pack-section-title");
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
const packDetailSheet = packDetailOverlay.querySelector(".pack-sheet");
const packDetailClose = document.getElementById("pack-detail-close");
const packDetailCover = document.getElementById("pack-detail-cover");
const packDetailPager = document.getElementById("pack-detail-pager");
const packDetailPrev = document.getElementById("pack-detail-prev");
const packDetailNext = document.getElementById("pack-detail-next");
const packDetailPagerCount = document.getElementById("pack-detail-pager-count");
const packDetailCategory = document.getElementById("pack-detail-category");
const packDetailTitle = document.getElementById("pack-detail-title");
const packDetailSub = document.getElementById("pack-detail-sub");
const packDetailProgressBar = document.getElementById("pack-detail-progress-bar");
const packDetailStatus = document.getElementById("pack-detail-status");
const packAutoStart = document.getElementById("pack-auto-start");
const packShowHandled = document.getElementById("pack-show-handled");
const packSaveAll = document.getElementById("pack-save-all");
const packHideAll = document.getElementById("pack-hide-all");
const packBrowserFilters = document.getElementById("pack-browser-filters");
const packBrowserFilterToggle = document.getElementById("pack-browser-filter-toggle");
const packBrowserFilterBadge = document.getElementById("pack-browser-filter-badge");
const packBrowserFilterControls = document.getElementById("pack-browser-filter-controls");
const packBrowserSearch = document.getElementById("pack-browser-search");
const packBrowserSearchClear = document.getElementById("pack-browser-search-clear");
const packBrowserCategory = document.getElementById("pack-browser-category");
const packBrowserReset = document.getElementById("pack-browser-reset");
const packBrowserStateOptions = document.getElementById("pack-browser-state-options");
const packBrowserResults = document.getElementById("pack-browser-results");
const packDetailList = document.getElementById("pack-detail-list");
const titleImportOverlay = document.getElementById("title-import");
const titleImportClose = document.getElementById("title-import-close");
const titleImportEntry = document.getElementById("title-import-entry");
const titleImportReview = document.getElementById("title-import-review");
const titleImportInput = document.getElementById("title-import-input");
const titleImportStatus = document.getElementById("title-import-status");
const titleImportCancel = document.getElementById("title-import-cancel");
const titleImportMatch = document.getElementById("title-import-match");
const titleImportSummary = document.getElementById("title-import-summary");
const titleImportMatches = document.getElementById("title-import-matches");
const titleImportConfirmWrap = document.getElementById("title-import-confirm-wrap");
const titleImportConfirm = document.getElementById("title-import-confirm");
const titleImportConfirmText = document.getElementById("title-import-confirm-text");
const titleImportReviewStatus = document.getElementById("title-import-review-status");
const titleImportBack = document.getElementById("title-import-back");
const titleImportApply = document.getElementById("title-import-apply");

const TMDB_PROXY_PATH = "/functions/v1/tmdb-search";
const TMDB_SUGGEST_PATH = "/functions/v1/tmdb-suggest";
const TMDB_DETAIL_PATH = "/functions/v1/tmdb-detail";
const TMDB_IMAGE_PATH = "/functions/v1/tmdb-image";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const TMDB_POSTER_SMALL = "https://image.tmdb.org/t/p/w92";
const TMDB_POSTER_ORIGINAL = "https://image.tmdb.org/t/p/original";
const STORAGE_KEY = "stackrank:movies:v1";
const QUEUE_STORAGE_KEY = "stackrank:suggestion-queues:v1";
const PACK_PROGRESS_STORAGE_KEY = "stackrank:pack-progress:v1";
const PACK_FALLBACK_PATH = "data/suggestion-packs.json?v=5";
const SHARE_OPTIONS_KEY = "stackrank:share-options:v1";
const SHARE_OPTIONS_VERSION = 7;
const WATCH_LIST_TYPE = "watch";
const NOT_INTERESTED_LIST_TYPE = "not_interested";
const INSPIRED_SEED_KEY = "stackrank:inspired-seed:v1";
const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7GOGG6iSHMfax2YpOtqVqg_JIvcrBwl";

let ranking = [];
let rankingUpdatedAt = null;
let watchList = [];
let notInterestedList = [];
let pending = null;
let pendingOrigin = null;
let pendingTelemetry = null;
// Snapshot of all three lists taken when a ranking starts, so a completed
// ranking can be undone back to exactly the pre-ranking state (movie removed
// from the ranking and, if it came from a queue/restack, returned to its
// origin). Captured at the ranking entry points, consumed at settle.
let pendingRankingSnapshot = null;
let searchRange = null;
// The jittered index the first comparison opens on (see firstComparisonIndex).
// Set whenever a search starts from the full list range; reused for the opening
// turn even after an undo back to it, so the starter movie stays stable.
let firstComparisonMid = null;
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
  popular: { all: [], visible: [], reasonContext: null },
  essentials: { all: [], visible: [], reasonContext: null },
  related: { all: [], visible: [], reasonContext: null },
};
let suggestionPacks = [];
let packProgress = {};
let packIndexByMovieId = new Map();
let currentPackSlug = null;
let packDetailTrigger = null;
let packDetailShowHandled = false;
// Whether the current pack detail was opened from the "All packs" browser, so
// closing it should return there instead of dismissing the whole overlay.
let packDetailFromAllPacks = false;
let packBrowserScrollTop = 0;
// Slugs in the order currently shown by the "All packs" browser (current filters
// + sort), so pack detail prev/next can step through that same sequence.
let packBrowserOrder = [];
let packBrowserFilterValues = { query: "", category: "all", state: "all" };
let packBrowserFiltersExpanded = false;
let pendingPackContext = null;
let autoPackSession = null;
let rankingFilterQuery = "";
let rankingFilterExpanded = false;
let fullscreenTrigger = null;
let fullscreenFilterQuery = "";
let fullscreenDensityMode = "comfortable";
let fullscreenDrag = null;
let fullscreenTasteSignal = null;
let lastPackDiscoveryNudgeAt = 0;
let currentPlaceholderTitle = "";
let placeholderTimer = null;
let placeholderFadeTimer = null;
let currentDetail = null;
let detailRequestId = 0;
let detailTrigger = null;
const detailCache = new Map();
const detailRequests = new Map();
let tasteExplorerExpanded = false;
let tasteExplorerLoading = false;
let tasteExplorerRequestId = 0;
let activeTasteSignalId = null;
const tasteDetailAttemptedIds = new Set();
let tasteExplorerEnrichmentQueued = false;
let comparisonReturnScroll = null;
// When a ranking settles, decide whether to scroll the page to the freshly
// placed item (true — used for homepage ingresses like the add form / restack)
// or to restore the scroll position the ranking was started from (false — used
// when ranking from an overlay, suggestion, or queue, so closing it returns the
// user to where they were rather than yanking them to the ranking list).
let scrollToPlacementOnSettle = true;
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
  packs: true,
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
let shareSetPageIndex = 0;
let shareSetScrollSyncTimer = null;
// Last preview markup written to the DOM; lets us skip redundant innerHTML
// rewrites (which reload poster <image>s and cause a visible flicker).
let lastSharePreviewMarkup = "";
let shareScrollLockY = 0;
const posterDataCache = new Map();
let titleImportRows = [];
let titleImportMeta = { duplicateCount: 0, ignoredCount: 0 };
let titleImportTrigger = null;
let titleImportMatching = false;

const storageEnabled = typeof window !== "undefined" && "localStorage" in window;
const supabaseEnabled =
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_PUBLISHABLE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY";
const supabase = supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
const productTelemetryEnabled =
  supabaseEnabled &&
  shouldCollectProductTelemetry({
    hostname: window.location.hostname,
    doNotTrack: navigator.doNotTrack || window.doNotTrack || "",
    globalPrivacyControl: navigator.globalPrivacyControl === true,
  });
const productTelemetrySessionId =
  productTelemetryEnabled && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : null;
let productTelemetryEventCount = 0;

const trackProductEvent = (eventName, properties = {}) => {
  if (!productTelemetryEnabled || !supabase || !productTelemetrySessionId) return;
  if (productTelemetryEventCount >= 80) return;
  const payload = buildProductEvent({
    eventName,
    sessionId: productTelemetrySessionId,
    properties: {
      ...properties,
      signed_in: Boolean(currentUser),
    },
  });
  if (!payload) return;
  productTelemetryEventCount += 1;
  void supabase
    .from("product_events")
    .insert(payload)
    .then(({ error }) => {
      if (error && debugEnabled) console.warn("Could not record product event", eventName, error);
    });
};

const initVercelWebAnalytics = () => {
  if (!productTelemetryEnabled || document.querySelector('script[data-stackrank-analytics="vercel"]')) return;
  window.va =
    window.va ||
    function queueVercelAnalytics() {
      (window.vaq = window.vaq || []).push(arguments);
    };
  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  script.dataset.stackrankAnalytics = "vercel";
  document.head.appendChild(script);
};

const tmdbProxyEnabled = supabaseEnabled;
const tmdbProxyUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_PROXY_PATH}` : "";
const tmdbSuggestUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_SUGGEST_PATH}` : "";
const tmdbImageUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_IMAGE_PATH}` : "";
const SUGGESTION_PAGE_SIZE = 3;
const PACK_PANEL_SIZE = 3;
const PACK_DISCOVERY_NUDGE_COOLDOWN_MS = 1000 * 60 * 30;
const PACK_BROWSER_STATES = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "head_start", label: "Head start" },
  { value: "completed", label: "Complete" },
  { value: "updated", label: "Updated" },
];
const TOAST_DURATION_MS = 3200;
const TOAST_EXIT_MS = 240;
const AUTH_INIT_TIMEOUT_MS = 3200;
// One-time gather (2026-06-28) of ~300 widely-seen, recognizable movies from
// 1995–2025 — popular blockbusters, acclaimed dramas, animation, and
// international hits, each verified against TMDB. Deliberately broad across
// eras, genres, and audiences. Static is fine: `pickPlaceholderTitle()` chooses
// randomly each rotation and skips anything the customer has already ranked, so
// it always feels fresh.
const PLACEHOLDER_TITLES = [
  "Se7en",
  "Toy Story",
  "Heat",
  "Braveheart",
  "Casino",
  "Twelve Monkeys",
  "GoldenEye",
  "Jumanji",
  "Apollo 13",
  "Before Sunrise",
  "The Usual Suspects",
  "Independence Day",
  "Mission: Impossible",
  "Scream",
  "Fargo",
  "The Rock",
  "Trainspotting",
  "Jerry Maguire",
  "Twister",
  "Space Jam",
  "Titanic",
  "Men in Black",
  "The Fifth Element",
  "Good Will Hunting",
  "Face/Off",
  "Boogie Nights",
  "Jackie Brown",
  "Life Is Beautiful",
  "Princess Mononoke",
  "Air Force One",
  "The Big Lebowski",
  "There's Something About Mary",
  "Rush Hour",
  "The Truman Show",
  "Mulan",
  "A Bug's Life",
  "Saving Private Ryan",
  "American History X",
  "Armageddon",
  "The Matrix",
  "The Sixth Sense",
  "Fight Club",
  "Toy Story 2",
  "American Beauty",
  "The Mummy",
  "Office Space",
  "Being John Malkovich",
  "The Iron Giant",
  "American Pie",
  "The Green Mile",
  "Magnolia",
  "Gladiator",
  "Cast Away",
  "Crouching Tiger, Hidden Dragon",
  "X-Men",
  "Memento",
  "Almost Famous",
  "Snatch",
  "Requiem for a Dream",
  "In the Mood for Love",
  "Amores Perros",
  "Shrek",
  "Harry Potter and the Philosopher's Stone",
  "The Lord of the Rings: The Fellowship of the Ring",
  "Monsters, Inc.",
  "Ocean's Eleven",
  "A Beautiful Mind",
  "Donnie Darko",
  "Spirited Away",
  "Amélie",
  "Mulholland Drive",
  "Spider-Man",
  "The Lord of the Rings: The Two Towers",
  "Minority Report",
  "Catch Me If You Can",
  "28 Days Later",
  "City of God",
  "The Pianist",
  "Chicago",
  "Ice Age",
  "Finding Nemo",
  "The Lord of the Rings: The Return of the King",
  "Pirates of the Caribbean: The Curse of the Black Pearl",
  "Kill Bill: Vol. 1",
  "Lost in Translation",
  "Oldboy",
  "Elf",
  "Big Fish",
  "Mystic River",
  "The Incredibles",
  "Eternal Sunshine of the Spotless Mind",
  "Shaun of the Dead",
  "Mean Girls",
  "Spider-Man 2",
  "Hotel Rwanda",
  "Anchorman: The Legend of Ron Burgundy",
  "Million Dollar Baby",
  "Collateral",
  "The Notebook",
  "Batman Begins",
  "Pride & Prejudice",
  "Sin City",
  "King Kong",
  "Brokeback Mountain",
  "Walk the Line",
  "The 40 Year Old Virgin",
  "Munich",
  "V for Vendetta",
  "The Departed",
  "The Prestige",
  "Casino Royale",
  "Pan's Labyrinth",
  "Children of Men",
  "Little Miss Sunshine",
  "The Devil Wears Prada",
  "Cars",
  "No Country for Old Men",
  "There Will Be Blood",
  "Ratatouille",
  "Superbad",
  "Juno",
  "Atonement",
  "300",
  "Zodiac",
  "Hot Fuzz",
  "Into the Wild",
  "The Dark Knight",
  "WALL·E",
  "Slumdog Millionaire",
  "Iron Man",
  "Gran Torino",
  "The Wrestler",
  "Tropic Thunder",
  "In Bruges",
  "Up",
  "Avatar",
  "Inglourious Basterds",
  "District 9",
  "The Hangover",
  "Star Trek",
  "Up in the Air",
  "(500) Days of Summer",
  "Coraline",
  "Watchmen",
  "Inception",
  "Toy Story 3",
  "The Social Network",
  "Black Swan",
  "Shutter Island",
  "How to Train Your Dragon",
  "The King's Speech",
  "Scott Pilgrim vs. the World",
  "True Grit",
  "Harry Potter and the Deathly Hallows: Part 2",
  "Drive",
  "The Tree of Life",
  "Bridesmaids",
  "Moneyball",
  "The Artist",
  "Rango",
  "Midnight in Paris",
  "X-Men: First Class",
  "The Avengers",
  "Django Unchained",
  "The Dark Knight Rises",
  "Skyfall",
  "Life of Pi",
  "Argo",
  "Looper",
  "Moonrise Kingdom",
  "Silver Linings Playbook",
  "Wreck-It Ralph",
  "12 Years a Slave",
  "Gravity",
  "The Wolf of Wall Street",
  "Her",
  "Frozen",
  "Pacific Rim",
  "The Great Gatsby",
  "Prisoners",
  "Rush",
  "Before Midnight",
  "Interstellar",
  "Whiplash",
  "Guardians of the Galaxy",
  "The Grand Budapest Hotel",
  "Gone Girl",
  "Birdman",
  "Nightcrawler",
  "Boyhood",
  "The Imitation Game",
  "Edge of Tomorrow",
  "John Wick",
  "Mad Max: Fury Road",
  "Inside Out",
  "The Martian",
  "Star Wars: The Force Awakens",
  "The Revenant",
  "Spotlight",
  "Room",
  "Ex Machina",
  "Sicario",
  "Creed",
  "The Hateful Eight",
  "Moonlight",
  "La La Land",
  "Arrival",
  "Zootopia",
  "Deadpool",
  "Rogue One: A Star Wars Story",
  "Hacksaw Ridge",
  "Hell or High Water",
  "Manchester by the Sea",
  "Hidden Figures",
  "Your Name.",
  "Lion",
  "Get Out",
  "Coco",
  "Dunkirk",
  "Blade Runner 2049",
  "Lady Bird",
  "Call Me by Your Name",
  "Logan",
  "Thor: Ragnarok",
  "The Shape of Water",
  "Three Billboards Outside Ebbing, Missouri",
  "Baby Driver",
  "Wonder Woman",
  "Black Panther",
  "Spider-Man: Into the Spider-Verse",
  "Avengers: Infinity War",
  "A Star Is Born",
  "Roma",
  "Hereditary",
  "A Quiet Place",
  "BlacKkKlansman",
  "Bohemian Rhapsody",
  "Mission: Impossible - Fallout",
  "If Beale Street Could Talk",
  "Parasite",
  "Avengers: Endgame",
  "Joker",
  "Once Upon a Time... in Hollywood",
  "Knives Out",
  "1917",
  "Marriage Story",
  "Little Women",
  "Jojo Rabbit",
  "Uncut Gems",
  "Portrait of a Lady on Fire",
  "Midsommar",
  "Ford v Ferrari",
  "The Irishman",
  "Soul",
  "Tenet",
  "Nomadland",
  "Sound of Metal",
  "Promising Young Woman",
  "The Trial of the Chicago 7",
  "Dune",
  "Spider-Man: No Way Home",
  "Encanto",
  "The Power of the Dog",
  "CODA",
  "No Time to Die",
  "The Green Knight",
  "Shang-Chi and the Legend of the Ten Rings",
  "Everything Everywhere All at Once",
  "Top Gun: Maverick",
  "The Banshees of Inisherin",
  "RRR",
  "The Batman",
  "Avatar: The Way of Water",
  "Nope",
  "TÁR",
  "Glass Onion: A Knives Out Mystery",
  "The Whale",
  "Oppenheimer",
  "Barbie",
  "Past Lives",
  "Spider-Man: Across the Spider-Verse",
  "Killers of the Flower Moon",
  "Poor Things",
  "The Holdovers",
  "Anatomy of a Fall",
  "John Wick: Chapter 4",
  "Guardians of the Galaxy Vol. 3",
  "The Zone of Interest",
  "Dune: Part Two",
  "The Wild Robot",
  "Anora",
  "The Substance",
  "Wicked",
  "Challengers",
  "Inside Out 2",
  "Sinners",
];
const PLACEHOLDER_ROTATION_MS = 3600;
const PLACEHOLDER_FADE_MS = 180;

const formatMeta = (movie) => {
  if (!movie.year) return "Year unknown";
  return `Released ${movie.year}`;
};

// Pick a random placeholder, skipping titles the customer has already ranked
// (never tease a movie they've placed) and avoiding an immediate repeat. Falls
// back gracefully if the pool empties out.
const pickPlaceholderTitle = () => {
  const ranked = new Set(ranking.map((movie) => normalizeTitle(movie.title)));
  const unranked = PLACEHOLDER_TITLES.filter((title) => !ranked.has(normalizeTitle(title)));
  const base = unranked.length ? unranked : PLACEHOLDER_TITLES;
  const fresh = base.filter((title) => title !== currentPlaceholderTitle);
  const pool = fresh.length ? fresh : base;
  currentPlaceholderTitle = pool[Math.floor(Math.random() * pool.length)];
  return currentPlaceholderTitle;
};

const rotateTitlePlaceholder = () => {
  if (titleInput.value.trim()) return;
  titleInput.classList.add("is-placeholder-fading");
  placeholderFadeTimer = window.setTimeout(() => {
    titleInput.placeholder = pickPlaceholderTitle();
    titleInput.classList.remove("is-placeholder-fading");
    placeholderFadeTimer = null;
  }, PLACEHOLDER_FADE_MS);
};

const stopPlaceholderRotation = () => {
  if (placeholderTimer) window.clearInterval(placeholderTimer);
  if (placeholderFadeTimer) window.clearTimeout(placeholderFadeTimer);
  placeholderTimer = null;
  placeholderFadeTimer = null;
  titleInput.classList.remove("is-placeholder-fading");
};

const startPlaceholderRotation = () => {
  stopPlaceholderRotation();
  titleInput.placeholder = pickPlaceholderTitle();
  placeholderTimer = window.setInterval(rotateTitlePlaceholder, PLACEHOLDER_ROTATION_MS);
};

// normalizeTitle, movieKey, movieYear, isDuplicateMovie (as isDuplicateInList),
// and mergeRankings now live in lib/movie.js. This thin wrapper keeps the
// single-arg call sites (which all dedup against the live `ranking`) unchanged.
const isDuplicateMovie = (movie) => isDuplicateInList(ranking, movie);

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

// formatRuntime, formatRuntimeTotal, formatShareRuntimeTotal now live in
// lib/format.js, imported at the top.

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

const renderFirstRunExperience = () => {
  if (!firstRun) return;
  const experience = getFirstRunExperience(ranking.length);
  firstRun.hidden = !experience.visible;
  firstRun.dataset.state = experience.state;
  firstRunEyebrow.textContent = experience.eyebrow;
  firstRunTitle.textContent = experience.title;
  firstRunBody.textContent = experience.body;
  quickStartImportButton.hidden = !experience.showImport;
};

const renderRanking = () => {
  rankingList.innerHTML = "";
  const hasRankedMovies = ranking.length > 0;
  renderFirstRunExperience();
  shareButton.disabled = !hasRankedMovies;
  clearButton.disabled = !hasRankedMovies;
  if (rankingFilterToggle) rankingFilterToggle.disabled = !hasRankedMovies;
  if (rankingExpand) rankingExpand.disabled = !hasRankedMovies;
  if (rankingReviewButton) rankingReviewButton.disabled = ranking.length < 2;

  if (!hasRankedMovies) {
    if (rankingFilterExpanded) setRankingFilterExpanded(false);
    const empty = document.createElement("li");
    empty.className = "ranking__empty";
    empty.textContent = "No movies yet. Add one to begin.";
    rankingList.appendChild(empty);
    renderListSnapshot();
    renderTasteExplorer();
    if (!shareStudio.hidden) updateShareStudio();
    return;
  }

  const query = rankingFilterQuery.trim().toLowerCase();
  rankingList.classList.toggle("ranking--filtered", Boolean(query));
  let visibleCount = 0;
  ranking.forEach((movie, index) => {
    if (query) {
      const haystack = `${movie.title} ${movie.year || ""}`.toLowerCase();
      if (!haystack.includes(query)) return;
    }
    visibleCount += 1;
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

  if (query && visibleCount === 0) {
    const empty = document.createElement("li");
    empty.className = "ranking__empty";
    empty.textContent = "No movies match that filter.";
    rankingList.appendChild(empty);
  }
  if (rankingFilterCount) {
    rankingFilterCount.textContent = query ? `${visibleCount} of ${ranking.length}` : "";
  }

  renderListSnapshot();
  renderTasteExplorer();
  if (!shareStudio.hidden) updateShareStudio();
};

function setRankingFilterExpanded(expanded) {
  rankingFilterExpanded = expanded;
  if (rankingFilter) rankingFilter.hidden = !expanded;
  if (rankingFilterToggle) {
    rankingFilterToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    rankingFilterToggle.classList.toggle("is-active", expanded);
  }
  if (!expanded && rankingFilterQuery) {
    // Collapsing clears the filter so the full list is never hidden behind a
    // closed control.
    rankingFilterQuery = "";
    if (rankingFilterInput) rankingFilterInput.value = "";
    if (rankingFilterClear) rankingFilterClear.hidden = true;
    renderRanking();
  }
  if (expanded && rankingFilterInput) rankingFilterInput.focus();
}

if (rankingFilterToggle) {
  rankingFilterToggle.addEventListener("click", () => {
    setRankingFilterExpanded(!rankingFilterExpanded);
  });
}
if (rankingFilterInput) {
  rankingFilterInput.addEventListener("input", () => {
    rankingFilterQuery = rankingFilterInput.value;
    if (rankingFilterClear) rankingFilterClear.hidden = !rankingFilterQuery;
    renderRanking();
  });
  rankingFilterInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && rankingFilterQuery) {
      event.stopPropagation();
      rankingFilterQuery = "";
      rankingFilterInput.value = "";
      if (rankingFilterClear) rankingFilterClear.hidden = true;
      renderRanking();
    }
  });
}
if (rankingFilterClear) {
  rankingFilterClear.addEventListener("click", () => {
    rankingFilterQuery = "";
    rankingFilterInput.value = "";
    rankingFilterClear.hidden = true;
    rankingFilterInput.focus();
    renderRanking();
  });
}

// movieYear, decadeLabel, dayKey, formatShortDate now live in lib/movie.js and
// lib/format.js, imported at the top.

function movieWithDetail(movie) {
  if (!movie?.tmdbId) return movie;
  return detailCache.get(String(movie.tmdbId)) || movie;
}

// The rank-weighted insight engine now lives in lib/insights.js. This wrapper
// gathers the live state — the detail-enriched ranking plus queue counts — and
// hands it to the pure `computeRankingInsights`.
function getRankingInsights() {
  const enrichedRanking = ranking.map(movieWithDetail);
  return computeRankingInsights(enrichedRanking, {
    watchCount: watchList.length,
    hiddenCount: notInterestedList.length,
    rankingUpdatedAt,
  });
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

const getTasteMatchingPacks = (signal) => {
  return tasteMatchingPacks(suggestionPacks, signal);
};

const createTasteMovieRow = ({ movie, index }) => {
  const button = document.createElement("button");
  button.className = "taste__movie";
  button.type = "button";
  button.setAttribute("aria-label", `Open details for #${index + 1}, ${movie.title}`);

  const rank = document.createElement("span");
  rank.className = "taste__movie-rank";
  rank.textContent = `#${index + 1}`;

  const poster = document.createElement("span");
  poster.className = "taste__movie-poster";
  if (movie.posterPath) {
    const image = document.createElement("img");
    image.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
    image.alt = "";
    image.loading = "lazy";
    poster.appendChild(image);
  }

  const copy = document.createElement("span");
  copy.className = "taste__movie-copy";
  const title = document.createElement("strong");
  title.textContent = movie.title;
  const meta = document.createElement("span");
  meta.textContent = movie.year ? String(movie.year) : "Year unknown";
  copy.append(title, meta);

  const arrow = document.createElement("span");
  arrow.className = "taste__movie-arrow";
  arrow.textContent = "›";
  arrow.setAttribute("aria-hidden", "true");

  button.append(rank, poster, copy, arrow);
  button.addEventListener("click", () => {
    openMovieDetail(ranking[index], { type: "ranked", source: "taste" }, button);
  });
  return button;
};

const renderTasteDetail = (signal, insights) => {
  tasteDetail.innerHTML = "";
  if (!signal) return;

  const entries = tasteSignalEntries(insights.enrichedRanking, signal);
  const header = document.createElement("div");
  header.className = "taste__detail-header";
  const heading = document.createElement("h3");
  heading.textContent = `${signal.value} in your ranking`;
  const count = document.createElement("span");
  count.textContent = `${entries.length} ${entries.length === 1 ? "movie" : "movies"}`;
  header.append(heading, count);

  const movies = document.createElement("div");
  movies.className = "taste__movies";
  entries.slice(0, 5).forEach((entry) => movies.appendChild(createTasteMovieRow(entry)));

  const actions = document.createElement("div");
  actions.className = "taste__actions";
  const lensButton = document.createElement("button");
  lensButton.className = "taste__action";
  lensButton.type = "button";
  lensButton.textContent = entries.length > 5 ? `See all ${entries.length} ranked movies` : "Open this ranking lens";
  lensButton.disabled = !entries.length;
  lensButton.addEventListener("click", () => {
    fullscreenTasteSignal = signal;
    fullscreenFilterQuery = "";
    trackProductEvent("taste_lens_opened", {
      source: "home",
      list_size: countBucket(ranking.length),
    });
    openFullscreenRanking({ trigger: lensButton });
  });
  actions.appendChild(lensButton);

  const matchingPacks = getTasteMatchingPacks(signal);
  if (matchingPacks.length) {
    const packsButton = document.createElement("button");
    packsButton.className = "taste__action taste__action--muted";
    packsButton.type = "button";
    packsButton.textContent = `Explore ${matchingPacks.length} matching ${matchingPacks.length === 1 ? "pack" : "packs"}`;
    packsButton.addEventListener("click", () => {
      packBrowserFilterValues = {
        query: tasteSignalPackQuery(signal),
        category: "all",
        state: "all",
      };
      packBrowserFiltersExpanded = true;
      openAllPacks({ trigger: packsButton, source: "taste" });
    });
    actions.appendChild(packsButton);
  }

  tasteDetail.append(header, movies, actions);
};

const renderTasteExplorer = () => {
  if (!tasteExplorer) return;
  const available = ranking.length >= TASTE_EXPLORER_MIN_MOVIES;
  tasteExplorer.hidden = !available;
  if (!available) {
    tasteExplorerExpanded = false;
    activeTasteSignalId = null;
    return;
  }

  tasteToggle.setAttribute("aria-expanded", String(tasteExplorerExpanded));
  tasteToggle.classList.toggle("is-expanded", tasteExplorerExpanded);
  tasteToggle.firstChild.textContent = tasteExplorerExpanded ? "Close " : "Explore ";
  tasteContent.hidden = !tasteExplorerExpanded;
  tasteIntro.hidden = tasteExplorerExpanded;
  if (!tasteExplorerExpanded) return;

  const insights = getRankingInsights();
  const signals = buildTasteSignals(insights);
  if (!signals.some((signal) => signal.id === activeTasteSignalId)) {
    activeTasteSignalId = signals[0]?.id || null;
  }
  tasteSignals.innerHTML = "";

  signals.forEach((signal) => {
    const button = document.createElement("button");
    button.className = "taste__signal";
    button.type = "button";
    button.setAttribute("aria-pressed", String(signal.id === activeTasteSignalId));
    const eyebrow = document.createElement("span");
    eyebrow.className = "taste__signal-eyebrow";
    eyebrow.textContent = signal.eyebrow;
    const value = document.createElement("strong");
    value.textContent = signal.value;
    const detail = document.createElement("span");
    detail.className = "taste__signal-detail";
    detail.textContent = signal.description;
    button.append(eyebrow, value, detail);
    button.addEventListener("click", () => {
      activeTasteSignalId = signal.id;
      renderTasteExplorer();
    });
    tasteSignals.appendChild(button);
  });

  if (tasteExplorerLoading) {
    const placeholders = Math.max(1, 3 - signals.length);
    for (let index = 0; index < placeholders; index += 1) {
      const skeleton = document.createElement("div");
      skeleton.className = "taste__signal taste__signal--loading";
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.innerHTML = `
        <span class="skeleton taste__skeleton-label"></span>
        <span class="skeleton taste__skeleton-value"></span>
        <span class="skeleton taste__skeleton-detail"></span>`;
      tasteSignals.appendChild(skeleton);
    }
  }

  if (tasteExplorerLoading) {
    tasteStatus.textContent = "Analyzing movie details…";
  } else if (insights.detailCount < Math.min(ranking.length, 120)) {
    tasteStatus.textContent = insights.detailCount
      ? `Based on details available for ${insights.detailCount} of ${ranking.length} ranked movies.`
      : "Genre and people signals are unavailable right now.";
  } else {
    tasteStatus.textContent = "";
  }

  const activeSignal = signals.find((signal) => signal.id === activeTasteSignalId) || null;
  if (activeSignal) {
    renderTasteDetail(activeSignal, insights);
  } else {
    tasteDetail.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "taste__empty";
    empty.textContent = tasteExplorerLoading
      ? "Looking for repeated patterns near the top of your list."
      : "No repeated patterns yet. Rank a few more varied movies and check back.";
    tasteDetail.appendChild(empty);
  }

  const hasUnattemptedDetails = ranking.slice(0, 120).some((movie) => {
    if (!movie.tmdbId) return false;
    const id = String(movie.tmdbId);
    return !detailCache.has(id) && !tasteDetailAttemptedIds.has(id);
  });
  if (!tasteExplorerLoading && !tasteExplorerEnrichmentQueued && hasUnattemptedDetails) {
    tasteExplorerEnrichmentQueued = true;
    window.queueMicrotask(() => {
      tasteExplorerEnrichmentQueued = false;
      void enrichTasteExplorer();
    });
  }
};

const enrichTasteExplorer = async () => {
  const targets = ranking
    .slice(0, 120)
    .filter((movie) => movie.tmdbId)
    .filter((movie) => {
      const id = String(movie.tmdbId);
      return !detailCache.has(id) && !tasteDetailAttemptedIds.has(id);
    });
  if (!targets.length) return;
  const requestId = ++tasteExplorerRequestId;
  targets.forEach((movie) => tasteDetailAttemptedIds.add(String(movie.tmdbId)));
  tasteExplorerLoading = true;
  renderTasteExplorer();
  for (let index = 0; index < targets.length; index += 4) {
    await Promise.all(targets.slice(index, index + 4).map(fetchMovieDetail));
    if (requestId !== tasteExplorerRequestId) return;
  }
  tasteExplorerLoading = false;
  renderTasteExplorer();
};

if (tasteToggle) {
  tasteToggle.addEventListener("click", () => {
    tasteExplorerExpanded = !tasteExplorerExpanded;
    if (tasteExplorerExpanded) {
      trackProductEvent("taste_explorer_opened", {
        source: "home",
        list_size: countBucket(ranking.length),
      });
    }
    renderTasteExplorer();
  });
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

const createSuggestionReasonIcon = () => `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3 3v4a3 3 0 0 0 3 3h7"></path>
    <path d="m10.5 7.5 2.5 2.5-2.5 2.5"></path>
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

const getLocalPayload = () => {
  if (!storageEnabled) return { movies: [], updated_at: null };
  try {
    return parseRankingPayload(localStorage.getItem(STORAGE_KEY));
  } catch (_error) {
    return { movies: [], updated_at: null };
  }
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
    return parseQueuePayload(localStorage.getItem(key));
  } catch (_error) {
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

const normalizeSuggestionQueues = () => {
  const normalized = normalizeSuggestionQueueLists({
    ranking,
    watchList,
    notInterestedList,
  });
  watchList = normalized.watchList;
  notInterestedList = normalized.notInterestedList;
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

  const merged = mergeQueuePayloads(payloads);
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

const savePackProgressSnapshot = async () => {
  saveLocalPackProgressPayload();
  const listId = getListId();
  if (!supabaseEnabled || !supabase || !listId) return;

  const { error: deleteError } = await supabase
    .from("pack_progress")
    .delete()
    .eq("list_id", listId);
  if (deleteError) {
    console.warn("Could not replace synced pack progress", deleteError);
    return;
  }

  const knownSlugs = new Set(suggestionPacks.map((pack) => pack.slug));
  const rows = Object.entries(packProgress)
    .filter(([slug]) => knownSlugs.has(slug))
    .map(([slug, entry]) => ({
      list_id: listId,
      pack_slug: slug,
      state: stripProgressMetadata(entry),
      updated_at: entry.updated_at || new Date().toISOString(),
    }));
  if (!rows.length) return;
  const { error } = await supabase
    .from("pack_progress")
    .upsert(rows, { onConflict: "list_id,pack_slug" });
  if (error) {
    console.warn("Could not restore synced pack progress", error);
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
  let remotePacks = [];
  let loadError = null;
  if (supabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("suggestion_packs")
      .select("slug,title,subtitle,category,movies,version,provenance,active,sort_order,cover_path")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true });
    if (!error && Array.isArray(data) && data.length) {
      remotePacks = data.map(normalizeSuggestionPack);
    } else if (error) {
      loadError = error;
    }
  }
  const fallbackPacks = await loadFallbackSuggestionPacks();
  const packs = mergePackLibraries(fallbackPacks, remotePacks);
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
  // Keep the local snapshot current even when the remote write succeeds.
  // Exact replacement flows (clear/import/restore) must not leave an older
  // local list behind for merge-on-load to resurrect.
  saveLocalPayload(ranking, updatedAt);
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
      const merged = mergeRankingPayloads([
        { movies: data.movies, updated_at: data.updated_at || null },
        local,
      ]);
      ranking = merged.movies;
      rankingUpdatedAt = merged.updated_at;
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

const settleRankingScroll = (insertIndex) => {
  if (scrollToPlacementOnSettle) {
    // Homepage ingress (add form / restack): surface where the movie landed.
    updateSuggestionsThenHighlight(insertIndex);
    clearComparisonReturnScroll();
  } else {
    // Off-homepage ingress (overlay / suggestion / queue): refresh suggestions
    // but leave the page where the user was so closing the ingress returns there.
    void updateSuggestions();
    restoreComparisonReturnScroll();
  }
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

const rankingTelemetrySource = (context, origin) => {
  if (context?.type === "pack") return context.mode === "auto" ? "pack_auto" : "pack_browse";
  if (context?.type === "suggestion") return `suggestion_${context.section || "unknown"}`;
  if (context?.type === "queue") return context.source === "watch" ? "watch_queue" : "hidden_queue";
  if (context?.type === "search") return "search";
  if (origin?.type === "ranking") return "restack";
  if (origin?.type === "watch") return "watch_queue";
  if (origin?.type === "notInterested") return "hidden_queue";
  return "unknown";
};

const startComparison = () => {
  if (!pending) return;

  if (ranking.length === 0) {
    const rankedMovie = withRankingTimestamp(pending);
    const telemetry = pendingTelemetry;
    const context = pendingPackContext;
    const origin = pendingOrigin;
    ranking.push(rankedMovie);
    lastAddedTmdbId = pending.tmdbId || null;
    pending = null;
    pendingPackContext = null;
    pendingOrigin = null;
    pendingTelemetry = null;
    saveRanking();
    setComparisonMode(false);
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    announcePlacement(`"${ranking[0].title}" placed as your top pick.`, context, rankedMovie, origin);
    settleRankingScroll(0);
    handleRankingSettled(rankedMovie, 0, context);
    trackProductEvent("ranking_completed", {
      source: telemetry?.source || "unknown",
      list_size: countBucket(ranking.length),
      count: countBucket(0),
    });
    titleInput.blur();
    return;
  }

  searchRange = { low: 0, high: ranking.length - 1 };
  firstComparisonMid = firstComparisonIndex(ranking.length);
  compareHistory = [];
  suggestionsRequestId += 1;
  setComparisonMode(true);
  setSuggestionsHidden(true);
  showComparison();
  scrollComparisonIntoView();
};

const showComparison = () => {
  if (!pending || !searchRange) return;

  // Opening turn (full list range, incl. after undoing back to it): use the
  // jittered starter so consecutive rankings don't always lead with the middle
  // movie. Every narrowed range falls back to the exact midpoint.
  const atFullRange = searchRange.low === 0 && searchRange.high === ranking.length - 1;
  const mid = atFullRange && firstComparisonMid !== null
    ? firstComparisonMid
    : comparisonMidIndex(searchRange);
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
  const narrowed = applyComparison(searchRange, isNewBetter, midIndex);
  searchRange.low = narrowed.low;
  searchRange.high = narrowed.high;

  if (isSearchSettled(searchRange)) {
    const insertIndex = searchRange.low;
    const rankedMovie = withRankingTimestamp(pending);
    const comparisonCount = pending.comparisons;
    const telemetry = pendingTelemetry;
    const context = pendingPackContext;
    const origin = pendingOrigin;
    ranking.splice(insertIndex, 0, rankedMovie);
    lastAddedTmdbId = rankedMovie.tmdbId || null;
    const leftNeighbor = ranking[insertIndex - 1];
    const rightNeighbor = ranking[insertIndex + 1];
    pending = null;
    pendingPackContext = null;
    pendingOrigin = null;
    pendingTelemetry = null;
    searchRange = null;
    saveRanking();
    setComparisonMode(false);
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    const placedTitle = `"${ranking[insertIndex].title}"`;
    let placementMessage;
    if (leftNeighbor && rightNeighbor) {
      placementMessage = `${placedTitle} placed at #${insertIndex + 1} between "${leftNeighbor.title}" and "${rightNeighbor.title}".`;
    } else if (leftNeighbor) {
      placementMessage = `${placedTitle} placed at #${insertIndex + 1} below "${leftNeighbor.title}".`;
    } else if (rightNeighbor) {
      placementMessage = `${placedTitle} placed at #${insertIndex + 1} above "${rightNeighbor.title}".`;
    } else {
      placementMessage = `${placedTitle} placed at #${insertIndex + 1}.`;
    }
    announcePlacement(placementMessage, context, rankedMovie, origin);
    settleRankingScroll(insertIndex);
    handleRankingSettled(rankedMovie, insertIndex, context);
    trackProductEvent("ranking_completed", {
      source: telemetry?.source || "unknown",
      list_size: countBucket(ranking.length),
      count: countBucket(comparisonCount),
    });
    titleInput.blur();
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
  const comparisonCount = pending.comparisons;
  const telemetry = pendingTelemetry;
  const context = pendingPackContext;
  restorePendingOrigin();
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  pendingTelemetry = null;
  pendingRankingSnapshot = null;
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
  trackProductEvent("ranking_canceled", {
    source: telemetry?.source || "unknown",
    list_size: countBucket(ranking.length),
    count: countBucket(comparisonCount),
  });
  if (context?.type === "pack") {
    if (context.mode === "auto") {
      stopAutoPack({ openDetail: true, outcome: "canceled" });
    } else {
      window.setTimeout(() => openPackDetail(context.slug, { fromAllPacks: context.fromAllPacks }), 120);
    }
  } else {
    renderPackSurfaces();
  }
  updateDebugPanel();
};

cancelRankingButton.addEventListener("click", cancelComparison);

// --- Ranking review mode --------------------------------------------------
// A lightweight audit pass over an existing ranking: surface adjacent pairs
// (favoring recent additions, via lib/review.js) and ask whether each order
// still holds, swapping neighbors in place. Distinct from the binary-insertion
// comparison flow — it never inserts a `pending` movie. It reuses the comparison
// panel's cards and the `is-comparing` layout so portrait/landscape parity comes
// for free; `is-reviewing` only swaps which controls and copy are shown.
const REVIEW_PAIR_LIMIT = 8;
const COMPARE_HEADING = compareHeading ? compareHeading.textContent : "Pick your favorite";
let reviewQueue = null; // remaining pair indices (incl. the current one)
let reviewPairIndex = null; // current pair's lower index, or null when idle
let reviewTotal = 0; // pairs in the session, for "Pair x of y"
let reviewStats = null; // { reviewed, changed }
let reviewSnapshot = null; // ranking snapshot at session start, for undo

const isReviewing = () => reviewPairIndex != null;

const setReviewCardLabel = (card, text) => {
  const label = card.querySelector(".card__label");
  if (label) label.textContent = text;
};

const setReviewMode = (active) => {
  document.body.classList.toggle("is-comparing", active);
  document.body.classList.toggle("is-reviewing", active);
  form.hidden = active;
  reviewKeepButton.hidden = !active;
  reviewSwapButton.hidden = !active;
  reviewEndButton.hidden = !active;
  if (compareHeading) {
    compareHeading.textContent = active ? "Review your ranking" : COMPARE_HEADING;
  }
  if (active) {
    undoChoiceButton.hidden = true;
    cancelRankingButton.hidden = true;
    skipPackMovieButton.hidden = true;
    hideSuggestions();
    setSuggestionsHidden(true);
  } else {
    // Restore the insertion-flow card labels so the next comparison reads right.
    setReviewCardLabel(newCard, "New entry");
    setReviewCardLabel(existingCard, "Existing");
    setSuggestionsHidden(false);
  }
};

const showReviewPair = () => {
  if (reviewPairIndex == null) return;
  const i = reviewPairIndex;
  const higher = ranking[i];
  const lower = ranking[i + 1];
  if (!higher || !lower) {
    advanceReview();
    return;
  }

  setReviewCardLabel(newCard, `Currently #${i + 1}`);
  setReviewCardLabel(existingCard, `Currently #${i + 2}`);
  newTitle.textContent = higher.title;
  newMeta.textContent = formatMeta(higher);
  setPoster(newPoster, higher);
  existingTitle.textContent = lower.title;
  existingMeta.textContent = formatMeta(lower);
  setPoster(existingPoster, lower);

  const position = reviewTotal - reviewQueue.length + 1;
  compareSub.textContent = `Still prefer #${i + 1} over #${i + 2}? · Pair ${position} of ${reviewTotal}`;
  compareSection.classList.remove("panel--hidden");

  // Tapping a card keeps the established "pick the one you like more" gesture:
  // the higher card keeps the order, the lower card swaps (promotes it).
  newCard.onclick = () => reviewDecision(false);
  existingCard.onclick = () => reviewDecision(true);
  newCard.onkeydown = reviewCardKey(false);
  existingCard.onkeydown = reviewCardKey(true);
};

const reviewCardKey = (swap) => (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    reviewDecision(swap);
  }
};

const advanceReview = () => {
  if (!reviewQueue) return;
  reviewQueue.shift();
  if (!reviewQueue.length) {
    finishReview(true);
    return;
  }
  reviewPairIndex = reviewQueue[0];
  showReviewPair();
};

const reviewDecision = (swap) => {
  if (reviewPairIndex == null) return;
  const i = reviewPairIndex;
  reviewStats.reviewed += 1;
  if (swap && ranking[i] && ranking[i + 1]) {
    const temp = ranking[i];
    ranking[i] = ranking[i + 1];
    ranking[i + 1] = temp;
    reviewStats.changed += 1;
    saveRanking();
    renderRanking();
    if (fullscreenOverlay && !fullscreenOverlay.hidden) renderFullscreenRanking();
  }
  advanceReview();
};

const startReview = () => {
  if (pending || isReviewing()) return;
  if (ranking.length < 2) {
    setAddFeedback("Add at least two movies to review your ranking.", 2600);
    return;
  }
  const queue = buildReviewQueue(ranking, { focusTmdbId: lastAddedTmdbId, max: REVIEW_PAIR_LIMIT });
  if (!queue.length) {
    setAddFeedback("Nothing to review right now.", 2600);
    return;
  }
  reviewQueue = queue;
  reviewTotal = queue.length;
  reviewStats = { reviewed: 0, changed: 0 };
  reviewSnapshot = snapshotRanking();
  reviewPairIndex = reviewQueue[0];
  trackProductEvent("review_started", {
    list_size: countBucket(ranking.length),
    count: countBucket(reviewTotal),
  });
  captureComparisonReturnScroll();
  setReviewMode(true);
  showReviewPair();
  scrollComparisonIntoView();
};

const finishReview = (completed) => {
  const stats = reviewStats || { reviewed: 0, changed: 0 };
  const snapshot = reviewSnapshot;
  reviewQueue = null;
  reviewPairIndex = null;
  reviewTotal = 0;
  reviewStats = null;
  reviewSnapshot = null;
  setReviewMode(false);
  compareSection.classList.add("panel--hidden");
  renderRanking();
  restoreComparisonReturnScroll();
  titleInput.blur();
  trackProductEvent("review_completed", {
    list_size: countBucket(ranking.length),
    count: countBucket(stats.changed),
    outcome: completed ? "completed" : "ended",
  });
  if (stats.changed > 0) {
    const label = completed ? "Review complete" : "Review ended";
    const message = `${label} · ${stats.changed} swap${stats.changed === 1 ? "" : "s"}.`;
    setUndoableFeedback(message, () => {
      if (snapshot) restoreRankingTo(snapshot);
    });
  } else {
    setAddFeedback(`${completed ? "Review complete" : "Review ended"} · no changes.`, 2600);
  }
  updateSuggestions();
  renderPackSurfaces();
};

reviewKeepButton.addEventListener("click", () => reviewDecision(false));
reviewSwapButton.addEventListener("click", () => reviewDecision(true));
reviewEndButton.addEventListener("click", () => finishReview(false));
if (rankingReviewButton) rankingReviewButton.addEventListener("click", startReview);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedSuggestion) {
    setStatusMessage("Select a movie from the suggestions to add.");
    return;
  }
  hideSuggestions();
  startRankingFromSelection();
});

const snapshotAllData = () => ({
  ranking: ranking.map((movie) => ({ ...movie })),
  watchList: watchList.map((movie) => ({ ...movie })),
  notInterestedList: notInterestedList.map((movie) => ({ ...movie })),
  packProgress: JSON.parse(JSON.stringify(packProgress)),
  shareOptions: { ...shareOptions },
});

const setStoredShareOptions = (options) => {
  if (storageEnabled) {
    try {
      localStorage.setItem(SHARE_OPTIONS_KEY, JSON.stringify(options || {}));
      loadShareOptions();
      updateShareOptionControls();
      return;
    } catch (error) {
      // Fall through to the in-memory defaults.
    }
  }
  shareOptions = { ...shareOptions, ...(options || {}), version: SHARE_OPTIONS_VERSION };
  updateShareOptionControls();
};

const applyExactDataSnapshot = async (snapshot) => {
  ranking = snapshot.ranking.map((movie) => ({ ...movie }));
  watchList = snapshot.watchList.map((movie) => ({ ...movie }));
  notInterestedList = snapshot.notInterestedList.map((movie) => ({ ...movie }));
  packProgress = JSON.parse(JSON.stringify(snapshot.packProgress || {}));
  setStoredShareOptions(snapshot.shareOptions || {});
  normalizeSuggestionQueues();
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  pendingTelemetry = null;
  pendingRankingSnapshot = null;
  searchRange = null;
  compareHistory = [];
  setComparisonMode(false);
  compareSection.classList.add("panel--hidden");
  form.reset();

  await Promise.all([
    saveRanking(),
    saveSuggestionQueues(),
    savePackProgressSnapshot(),
  ]);
  renderRanking();
  renderSuggestionQueues();
  renderPackSurfaces();
  updateSuggestions();
  updateDebugPanel();
  titleInput.blur();
};

const downloadStackRankBackup = () => {
  const backup = buildStackRankBackup({
    ranking,
    watchList,
    notInterestedList,
    packProgress,
    shareOptions,
  });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json;charset=utf-8" }),
    `stackrank-backup-${date}.json`,
  );
  backupStatus.textContent = `Backup downloaded: ${ranking.length} ranked movie${ranking.length === 1 ? "" : "s"}.`;
  setAddFeedback("StackRank backup downloaded.", 2400);
};

const restoreStackRankBackup = async (file) => {
  backupStatus.textContent = "Reading backup…";
  try {
    const restored = parseStackRankBackup(await file.text());
    const summary = [
      `${restored.ranking.length} ranked`,
      `${restored.watchList.length} saved`,
      `${restored.notInterestedList.length} hidden`,
    ].join(", ");
    const confirmed = window.confirm(
      `Restore this StackRank backup (${summary})?\n\nThis replaces your current ranking, queues, pack progress, and Share Studio settings.`,
    );
    if (!confirmed) {
      backupStatus.textContent = "Restore canceled.";
      return;
    }
    const beforeRestore = snapshotAllData();
    await applyExactDataSnapshot(restored);
    closeRankingSettings({ restoreFocus: false });
    backupStatus.textContent = "";
    setUndoableFeedback(
      `Backup restored: ${restored.ranking.length} ranked movie${restored.ranking.length === 1 ? "" : "s"}.`,
      () => {
        void applyExactDataSnapshot(beforeRestore).then(() => {
          setAddFeedback("Backup restore undone.", 2200);
        });
      },
      7000,
    );
  } catch (error) {
    backupStatus.textContent = error?.message || "Could not restore this backup.";
  } finally {
    backupFileInput.value = "";
  }
};

const importDuplicateSelectionCount = () => {
  const counts = new Map();
  titleImportRows.forEach((row) => {
    if (!row.selectedMovie) return;
    const key = movieKey(row.selectedMovie);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
};

const updateTitleImportApplyState = () => {
  const unresolved = titleImportRows.filter((row) => !row.skipped && !row.selectedMovie).length;
  const duplicateSelections = importDuplicateSelectionCount();
  const selectedCount = titleImportRows.filter((row) => row.selectedMovie).length;
  const replacementConfirmed = !ranking.length || titleImportConfirm.checked;
  titleImportApply.disabled =
    titleImportMatching ||
    unresolved > 0 ||
    duplicateSelections > 0 ||
    selectedCount === 0 ||
    !replacementConfirmed;

  if (unresolved) {
    titleImportReviewStatus.textContent = `Choose or skip ${unresolved} unresolved title${unresolved === 1 ? "" : "s"}.`;
  } else if (duplicateSelections) {
    titleImportReviewStatus.textContent =
      `Choose different matches for ${duplicateSelections} duplicate selection${duplicateSelections === 1 ? "" : "s"}.`;
  } else if (!selectedCount) {
    titleImportReviewStatus.textContent = "Choose at least one movie to import.";
  } else if (!replacementConfirmed) {
    titleImportReviewStatus.textContent = "Confirm that this import will replace your current ranking.";
  } else {
    const skipped = titleImportRows.filter((row) => row.skipped).length;
    const guesses = titleImportRows.filter((row) => row.guessed && row.selectedMovie).length;
    titleImportReviewStatus.textContent = guesses
      ? `${selectedCount} ready to import — double-check ${guesses} best guess${guesses === 1 ? "" : "es"}` +
        (skipped ? `; ${skipped} skipped.` : ".")
      : `${selectedCount} movie${selectedCount === 1 ? "" : "s"} ready to import` +
        (skipped ? `; ${skipped} skipped.` : ".");
  }
  titleImportApply.textContent = selectedCount
    ? `Import ${selectedCount} movie${selectedCount === 1 ? "" : "s"}`
    : "Import ranking";
};

const renderTitleImportMatches = () => {
  titleImportMatches.innerHTML = "";
  const selectedCounts = new Map();
  titleImportRows.forEach((row) => {
    if (!row.selectedMovie) return;
    const key = movieKey(row.selectedMovie);
    selectedCounts.set(key, (selectedCounts.get(key) || 0) + 1);
  });

  titleImportRows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "import-match";

    const rank = document.createElement("div");
    rank.className = "import-match__rank";
    rank.textContent = `${index + 1}.`;

    const poster = document.createElement("img");
    poster.className = "import-match__poster";
    if (row.selectedMovie?.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${row.selectedMovie.posterPath}`;
      poster.alt = `${row.selectedMovie.title} poster`;
    } else {
      poster.alt = "";
      poster.style.visibility = "hidden";
    }

    const copy = document.createElement("div");
    copy.className = "import-match__copy";
    const source = document.createElement("div");
    source.className = "import-match__source";
    source.textContent = row.entry.source;
    source.title = row.entry.source;
    const state = document.createElement("div");
    state.className = "import-match__state";
    const selectedIsDuplicate =
      row.selectedMovie && (selectedCounts.get(movieKey(row.selectedMovie)) || 0) > 1;
    if (selectedIsDuplicate) {
      state.textContent = "Duplicate selection";
      state.classList.add("is-review");
    } else if (row.skipped && row.searchFailed) {
      state.textContent = "TMDB search failed — skipped";
      state.classList.add("is-review");
    } else if (row.searchFailed) {
      state.textContent = "TMDB search failed — go back to retry or skip";
      state.classList.add("is-review");
    } else if (row.skipped) {
      state.textContent = row.candidates.length ? "Skipped" : "No TMDB match found — skipped";
    } else if (row.autoMatched) {
      state.textContent = "Exact match";
    } else if (row.guessed) {
      state.textContent = "Best guess — review";
      state.classList.add("is-review");
    } else if (row.selectedMovie) {
      state.textContent = "Match selected";
    } else {
      state.textContent = "Choose a match";
      state.classList.add("is-review");
    }
    copy.append(source, state);

    const select = document.createElement("select");
    select.className = "import-match-select";
    select.setAttribute("aria-label", `TMDB match for ${row.entry.title}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = row.candidates.length ? "Choose a match…" : "No match found";
    placeholder.disabled = true;
    placeholder.selected = !row.selectedMovie && !row.skipped;
    select.appendChild(placeholder);
    row.candidates.forEach((candidate) => {
      const option = document.createElement("option");
      option.value = String(candidate.tmdbId);
      option.textContent = `${candidate.title}${candidate.year ? ` (${candidate.year})` : ""}`;
      option.selected = row.selectedMovie?.tmdbId === candidate.tmdbId;
      select.appendChild(option);
    });
    const skip = document.createElement("option");
    skip.value = "__skip";
    skip.textContent = "Skip this title";
    skip.selected = row.skipped;
    select.appendChild(skip);
    select.classList.toggle("is-unresolved", !row.skipped && !row.selectedMovie);
    select.addEventListener("change", () => {
      if (select.value === "__skip") {
        row.selectedMovie = null;
        row.skipped = true;
        row.autoMatched = false;
        row.guessed = false;
      } else {
        row.selectedMovie =
          row.candidates.find((candidate) => String(candidate.tmdbId) === select.value) || null;
        row.skipped = false;
        row.autoMatched = false;
        row.guessed = false;
      }
      renderTitleImportMatches();
    });

    item.append(rank, poster, copy, select);
    titleImportMatches.appendChild(item);
  });

  const exact = titleImportRows.filter((row) => row.autoMatched).length;
  const guesses = titleImportRows.filter((row) => row.guessed && row.selectedMovie).length;
  const reviewed = titleImportRows.filter(
    (row) => !row.autoMatched && !row.guessed && !row.skipped && row.selectedMovie,
  ).length;
  const unresolved = titleImportRows.filter(
    (row) => !row.skipped && !row.selectedMovie,
  ).length;
  const skipped = titleImportRows.filter((row) => row.skipped).length;
  const extras = [];
  if (titleImportMeta.duplicateCount) extras.push(`${titleImportMeta.duplicateCount} duplicate line ignored`);
  if (titleImportMeta.ignoredCount) extras.push(`${titleImportMeta.ignoredCount} invalid line ignored`);
  titleImportSummary.textContent =
    `${titleImportRows.length} titles · ${exact} exact` +
    (guesses ? ` · ${guesses} best guess${guesses === 1 ? "" : "es"}` : "") +
    (reviewed ? ` · ${reviewed} reviewed` : "") +
    (unresolved ? ` · ${unresolved} to review` : "") +
    ` · ${skipped} skipped` +
    (extras.length ? ` · ${extras.join(" · ")}` : "");
  titleImportConfirmWrap.hidden = !ranking.length;
  titleImportConfirmText.textContent =
    `Replace my current ranking of ${ranking.length} movie${ranking.length === 1 ? "" : "s"}.`;
  updateTitleImportApplyState();
};

const fetchTmdbImportCandidates = async (entry) => {
  const url = `${tmdbProxyUrl}?q=${encodeURIComponent(entry.title)}`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) throw new Error(`TMDB search returned ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data.results) ? data.results : [])
    .filter((movie) => movie?.tmdbId && movie?.title);
};

const matchTitleImportEntries = async (entries) => {
  const rows = new Array(entries.length);
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      const entry = entries[index];
      try {
        const results = await fetchTmdbImportCandidates(entry);
        const { movie: automatic, confidence } = chooseAutomaticTmdbMatch(entry, results);
        const candidates = results.slice(0, 8);
        if (automatic && !candidates.some((movie) => movie.tmdbId === automatic.tmdbId)) {
          candidates.push(automatic);
        }
        rows[index] = {
          entry,
          candidates,
          selectedMovie: automatic,
          skipped: candidates.length === 0 && !automatic,
          autoMatched: confidence === "exact",
          guessed: confidence === "guess",
          searchFailed: false,
        };
      } catch (error) {
        rows[index] = {
          entry,
          candidates: [],
          selectedMovie: null,
          skipped: false,
          autoMatched: false,
          guessed: false,
          searchFailed: true,
        };
      }
      completed += 1;
      titleImportStatus.textContent = `Matching ${completed} of ${entries.length}…`;
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, () => worker()));
  return rows;
};

// The import overlay is the only modal with a text field, so it's the only one
// that opens the on-screen keyboard. On iOS the keyboard shrinks the visual
// viewport but not the fixed full-screen overlay, which would push the action
// buttons (anchored to the overlay bottom on mobile) behind the keyboard. Pin
// the overlay to the visual viewport while it's open so the buttons stay above
// the keyboard and reachable.
let titleImportViewportSyncing = false;
const syncTitleImportViewport = () => {
  const vv = window.visualViewport;
  if (!vv || titleImportOverlay.hidden) return;
  titleImportOverlay.style.top = `${vv.offsetTop}px`;
  titleImportOverlay.style.bottom = "auto";
  titleImportOverlay.style.height = `${vv.height}px`;
  titleImportOverlay.style.setProperty("--import-vvh", `${vv.height}px`);
};
const startTitleImportViewportSync = () => {
  if (!window.visualViewport || titleImportViewportSyncing) return;
  titleImportViewportSyncing = true;
  window.visualViewport.addEventListener("resize", syncTitleImportViewport);
  window.visualViewport.addEventListener("scroll", syncTitleImportViewport);
  syncTitleImportViewport();
};
const stopTitleImportViewportSync = () => {
  if (window.visualViewport && titleImportViewportSyncing) {
    window.visualViewport.removeEventListener("resize", syncTitleImportViewport);
    window.visualViewport.removeEventListener("scroll", syncTitleImportViewport);
  }
  titleImportViewportSyncing = false;
  titleImportOverlay.style.top = "";
  titleImportOverlay.style.bottom = "";
  titleImportOverlay.style.height = "";
  titleImportOverlay.style.removeProperty("--import-vvh");
};

const showTitleImportEntryStep = () => {
  titleImportReview.hidden = true;
  titleImportEntry.hidden = false;
  titleImportStatus.textContent = "";
  titleImportInput.disabled = false;
  titleImportMatch.disabled = false;
  titleImportInput.focus({ preventScroll: true });
};

const openTitleImport = ({ trigger = openTitleImportButton, source = "settings" } = {}) => {
  if (pending) {
    setStatusMessage("Finish the current comparison before importing a ranking.");
    closeRankingSettings({ restoreFocus: false });
    return;
  }
  titleImportTrigger = trigger;
  closeRankingSettings({ restoreFocus: false });
  titleImportOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
  trackProductEvent("import_opened", {
    list_size: countBucket(ranking.length),
    source,
  });
  if (source === "quick_start") {
    trackProductEvent("quick_start_import_opened", {
      list_size: countBucket(ranking.length),
      source,
    });
  }
  showTitleImportEntryStep();
  startTitleImportViewportSync();
};

const closeTitleImport = ({ restoreFocus = true, reset = false } = {}) => {
  stopTitleImportViewportSync();
  titleImportOverlay.hidden = true;
  document.body.classList.remove("is-detail-open");
  titleImportMatching = false;
  titleImportInput.disabled = false;
  titleImportMatch.disabled = false;
  if (reset) {
    titleImportInput.value = "";
    titleImportRows = [];
    titleImportMeta = { duplicateCount: 0, ignoredCount: 0 };
    titleImportConfirm.checked = false;
  }
  if (restoreFocus && titleImportTrigger && document.contains(titleImportTrigger)) {
    titleImportTrigger.focus({ preventScroll: true });
  }
  titleImportTrigger = null;
};

const beginTitleImportMatching = async () => {
  if (!tmdbProxyEnabled) {
    titleImportStatus.textContent = "TMDB matching is not configured.";
    return;
  }
  const parsed = parseRankedTitleList(titleImportInput.value);
  if (!parsed.entries.length) {
    titleImportStatus.textContent = "Add at least one movie title.";
    titleImportInput.focus();
    return;
  }
  if (parsed.entries.length > 100) {
    titleImportStatus.textContent = "Import up to 100 movie titles at a time.";
    return;
  }

  titleImportMatching = true;
  titleImportMeta = {
    duplicateCount: parsed.duplicateCount,
    ignoredCount: parsed.ignoredCount,
  };
  titleImportInput.disabled = true;
  titleImportMatch.disabled = true;
  titleImportMatch.textContent = "Matching…";
  titleImportStatus.textContent = `Matching 0 of ${parsed.entries.length}…`;
  try {
    titleImportRows = await matchTitleImportEntries(parsed.entries);
    titleImportConfirm.checked = false;
    titleImportEntry.hidden = true;
    titleImportReview.hidden = false;
    renderTitleImportMatches();
    titleImportReview.scrollIntoView({ block: "start" });
    titleImportBack.focus({ preventScroll: true });
  } finally {
    titleImportMatching = false;
    titleImportInput.disabled = false;
    titleImportMatch.disabled = false;
    titleImportMatch.textContent = "Match titles";
    if (!titleImportReview.hidden) updateTitleImportApplyState();
  }
};

const applyTitleImport = async () => {
  updateTitleImportApplyState();
  if (titleImportApply.disabled) return;
  const importedRanking = buildImportedRanking(titleImportRows);
  if (!importedRanking.length) return;
  const beforeImport = snapshotLists();
  ranking = importedRanking;
  normalizeSuggestionQueues();
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  pendingTelemetry = null;
  pendingRankingSnapshot = null;
  searchRange = null;
  compareHistory = [];
  titleImportApply.disabled = true;
  titleImportApply.textContent = "Importing…";
  await Promise.all([saveRanking(), saveSuggestionQueues()]);
  setComparisonMode(false);
  compareSection.classList.add("panel--hidden");
  form.reset();
  renderRanking();
  renderSuggestionQueues();
  renderPackSurfaces();
  updateSuggestions();
  updateDebugPanel();
  titleInput.blur();
  closeTitleImport({ restoreFocus: false, reset: true });
  setUndoableFeedback(
    `Imported ${ranking.length} ranked movie${ranking.length === 1 ? "" : "s"}.`,
    () => restoreListsTo(beforeImport),
    7000,
  );
  trackProductEvent("import_completed", {
    list_size: countBucket(ranking.length),
    count: countBucket(ranking.length),
    outcome: "completed",
  });
};

clearButton.addEventListener("click", () => {
  if (!ranking.length) return;
  if (!window.confirm("Clear the entire ranking list?")) {
    return;
  }
  const beforeRanking = snapshotRanking();
  ranking = [];
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  pendingTelemetry = null;
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
  setUndoableFeedback("Ranking cleared.", () => restoreRankingTo(beforeRanking));
});

rankingSettingsToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleRankingSettings();
});
rankingSettingsClose.addEventListener("click", () => closeRankingSettings());
settingsSignInButton.addEventListener("click", () => openSignIn({ trigger: rankingSettingsToggle }));
settingsSignOutButton.addEventListener("click", () => handleSignOut());
downloadBackupButton.addEventListener("click", downloadStackRankBackup);
restoreBackupButton.addEventListener("click", () => backupFileInput.click());
backupFileInput.addEventListener("change", () => {
  const [file] = backupFileInput.files || [];
  if (file) void restoreStackRankBackup(file);
});
openTitleImportButton.addEventListener("click", () => openTitleImport());
quickStartImportButton.addEventListener("click", () =>
  openTitleImport({ trigger: quickStartImportButton, source: "quick_start" }),
);
titleImportClose.addEventListener("click", () => closeTitleImport());
titleImportCancel.addEventListener("click", () => closeTitleImport());
titleImportMatch.addEventListener("click", () => void beginTitleImportMatching());
titleImportBack.addEventListener("click", showTitleImportEntryStep);
titleImportConfirm.addEventListener("change", updateTitleImportApplyState);
titleImportApply.addEventListener("click", () => void applyTitleImport());
titleImportOverlay.addEventListener("click", (event) => {
  if (event.target === titleImportOverlay) closeTitleImport();
});

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
  shareIncludePacks,
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
shareNativeShare.addEventListener("click", () => shareNativePng());
sharePreview.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const stepButton = event.target.closest("[data-share-page-step]");
  if (stepButton) {
    event.preventDefault();
    setShareSetPage(shareSetPageIndex + Number(stepButton.dataset.sharePageStep || 0));
    return;
  }
  const downloadButton = event.target.closest("[data-share-page-download]");
  if (downloadButton) {
    event.preventDefault();
    void downloadCurrentShareSetPage();
    return;
  }
  const shareButton = event.target.closest("[data-share-page-share]");
  if (shareButton) {
    event.preventDefault();
    void shareNativePng({ currentPageOnly: true });
    return;
  }
  // Any remaining click on a preview image (single-image SVG, or an image-set
  // card) opens the full-res lightbox in share mode. Nav/action buttons were
  // handled and returned above, so reaching here means an image was tapped.
  const cardFigure = event.target.closest(".share-preview-card");
  if (cardFigure) {
    const idx = Number(cardFigure.dataset.pageIndex);
    if (!Number.isNaN(idx)) shareSetPageIndex = idx;
    openShareLightbox(cardFigure);
    return;
  }
  const svgEl = event.target.closest("svg");
  if (svgEl && !svgEl.closest("button")) openShareLightbox(svgEl);
});

// Shared full-res lightbox. Two flavors:
//   - "poster": the movie-detail artwork — just × + image, no chrome.
//   - "share":  the Share Studio preview — adds a Download/Share action bar and,
//     for image sets, prev/next nav + an "i/total CAPTION" counter + swipe.
// `lightboxTrigger` is the element to return focus to on close.
let lightboxTrigger = null;
let lightboxKind = "poster"; // "poster" | "share"
let lightboxSwiped = false; // suppress the tap-to-zoom click after a swipe-nav

function showLightbox(trigger) {
  shareLightbox.classList.remove("is-zoomed");
  shareLightbox.hidden = false;
  lightboxTrigger = trigger || null;
  shareLightboxClose.focus();
}

function closeLightbox({ restoreFocus = true } = {}) {
  if (shareLightbox.hidden) return;
  shareLightbox.hidden = true;
  shareLightbox.classList.remove("is-zoomed");
  shareLightboxImage.innerHTML = "";
  // Keep the preview deck aligned with wherever the user navigated in the set.
  if (lightboxKind === "share" && !shareStudio.hidden) {
    scrollToShareSetPage({ instant: true });
    updateShareSetPageChrome();
  }
  const trigger = lightboxTrigger;
  lightboxTrigger = null;
  if (restoreFocus && trigger && document.contains(trigger)) trigger.focus?.();
}

// Set the image wrapper's aspect ratio from the current content so CSS can scale
// it to fill the stage (up or down) without distortion. SVG → viewBox/attrs;
// <img> → natural size once known (with a 2:3 poster default until it loads).
function setLightboxAspect() {
  const svg = shareLightboxImage.querySelector("svg");
  const img = shareLightboxImage.querySelector("img");
  let ratio = "2 / 3";
  if (svg) {
    const vb = svg.viewBox?.baseVal;
    const w = (vb && vb.width) || parseFloat(svg.getAttribute("width")) || 0;
    const h = (vb && vb.height) || parseFloat(svg.getAttribute("height")) || 0;
    if (w && h) ratio = `${w} / ${h}`;
  } else if (img) {
    if (img.naturalWidth && img.naturalHeight) {
      ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    } else {
      img.addEventListener(
        "load",
        () => {
          if (img.naturalWidth && img.naturalHeight) {
            shareLightboxImage.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          }
        },
        { once: true },
      );
    }
  }
  shareLightboxImage.style.aspectRatio = ratio;
}

// Open the detail-pane poster at full TMDB resolution (chrome-free).
function openPosterLightbox(movie, trigger = null) {
  if (!movie?.posterPath) return;
  lightboxKind = "poster";
  shareLightbox.classList.remove("is-share", "is-set");
  const src = `${TMDB_POSTER_ORIGINAL}${movie.posterPath}`;
  const alt = xmlEscape(`${movie.title || "Movie"} poster`);
  shareLightboxImage.innerHTML = `<img src="${xmlEscape(src)}" alt="${alt}" />`;
  setLightboxAspect();
  showLightbox(trigger);
}

// Open the share preview at full size, with the action bar (and set chrome).
function openShareLightbox(trigger = null) {
  if (!ranking.length) return;
  lightboxKind = "share";
  shareLightbox.classList.add("is-share");
  renderShareLightbox();
  showLightbox(trigger);
}

// (Re)render the share lightbox image + chrome from the current options/page.
function renderShareLightbox() {
  if (lightboxKind !== "share") return;
  const images = buildShareImages();
  const isSet = images.mode === "set";
  shareLightbox.classList.toggle("is-set", isSet);
  if (isSet) {
    const total = images.cards.length;
    shareSetPageIndex = Math.min(Math.max(shareSetPageIndex, 0), Math.max(0, total - 1));
    const card = images.cards[shareSetPageIndex];
    shareLightboxImage.innerHTML = card?.svg || "";
    shareLightboxCaption.textContent = `${shareSetPageIndex + 1}/${Math.max(1, total)}  ${(card?.caption || card?.label || "").toUpperCase()}`;
    shareLightboxPrev.disabled = shareSetPageIndex <= 0;
    shareLightboxNext.disabled = shareSetPageIndex >= total - 1;
  } else {
    shareLightboxImage.innerHTML = images.svg;
    shareLightboxCaption.textContent = "";
  }
  setLightboxAspect();
  const canShare = canNativeSharePngFiles(1);
  shareLightboxDownload.disabled = sharePngPreparing;
  // Native file-share is mobile-mostly; on desktop (no Web Share for files) just
  // show Download rather than a perpetually-disabled Share button.
  shareLightboxShare.hidden = !canShare;
  shareLightboxShare.disabled = sharePngPreparing;
}

function lightboxStep(step) {
  if (lightboxKind !== "share" || !shareLightbox.classList.contains("is-set")) return;
  shareSetPageIndex += step;
  shareLightbox.classList.remove("is-zoomed");
  renderShareLightbox();
}

shareLightboxClose.addEventListener("click", () => closeLightbox());
shareLightboxPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  lightboxStep(-1);
});
shareLightboxNext.addEventListener("click", (event) => {
  event.stopPropagation();
  lightboxStep(1);
});
shareLightboxDownload.addEventListener("click", async (event) => {
  event.stopPropagation();
  if (shareLightboxDownload.disabled) return;
  if (shareOptions.format === "set") await downloadCurrentShareSetPage();
  else await downloadSharePng();
  renderShareLightbox();
});
shareLightboxShare.addEventListener("click", async (event) => {
  event.stopPropagation();
  if (shareLightboxShare.disabled) return;
  if (shareOptions.format === "set") await shareNativePng({ currentPageOnly: true });
  else await shareNativePng();
  renderShareLightbox();
});

shareLightbox.addEventListener("click", (event) => {
  // Tapping the image toggles an enlarged (pannable) view — unless that "click"
  // was actually the tail of a swipe-nav. Taps on chrome (bar/nav/close) do
  // nothing here; taps on the backdrop dismiss.
  if (event.target.closest(".share-lightbox__image")) {
    if (lightboxSwiped) {
      lightboxSwiped = false;
      return;
    }
    shareLightbox.classList.toggle("is-zoomed");
    return;
  }
  if (event.target.closest(".share-lightbox__bar, .share-lightbox__nav, .share-lightbox__close")) {
    return;
  }
  closeLightbox();
});

// Horizontal swipe pages an image set — but only when not zoomed (zoomed = pan).
let lightboxPointer = null;
shareLightboxStage.addEventListener("pointerdown", (event) => {
  lightboxSwiped = false;
  if (shareLightbox.classList.contains("is-zoomed")) {
    lightboxPointer = null;
    return;
  }
  lightboxPointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
shareLightboxStage.addEventListener("pointerup", (event) => {
  const start = lightboxPointer;
  lightboxPointer = null;
  if (!start || start.id !== event.pointerId) return;
  if (lightboxKind !== "share" || !shareLightbox.classList.contains("is-set")) return;
  if (shareLightbox.classList.contains("is-zoomed")) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    lightboxSwiped = true;
    lightboxStep(dx < 0 ? 1 : -1);
  }
});

sharePreview.addEventListener(
  "scroll",
  (event) => {
    const viewport = event.target.closest?.(".share-preview-deck__viewport");
    if (!viewport) return;
    scheduleShareSetScrollSync(viewport);
  },
  true,
);
window.addEventListener("resize", updateShareSetPageChrome);
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

const beginRankingRestack = (index, { fromFullscreen = false } = {}) => {
  const movie = ranking[index];
  if (!movie) return false;
  if (pending) {
    setStatusMessage("Finish the current comparison before re-stacking.");
    return false;
  }
  pendingRankingSnapshot = snapshotLists();
  captureComparisonReturnScroll();
  // Full-screen is an overlay ingress, so completing or cancelling should
  // restore the page instead of scrolling the underlying ranking panel.
  scrollToPlacementOnSettle = !fromFullscreen;
  pendingTelemetry = { source: fromFullscreen ? "fullscreen_restack" : "restack" };
  trackProductEvent("ranking_started", {
    source: pendingTelemetry.source,
    list_size: countBucket(ranking.length),
  });
  ranking.splice(index, 1);
  pendingOrigin = { type: "ranking", movie: { ...movie }, index };
  pending = { ...movie, comparisons: 0 };
  if (fromFullscreen) closeFullscreenRanking({ restoreFocus: false });
  saveRanking();
  renderRanking();
  startComparison();
  return true;
};

const removeRankedMovie = (index, { fromFullscreen = false } = {}) => {
  const movie = ranking[index];
  if (!movie) return false;
  if (!window.confirm(`Remove "${movie.title}" from the list?`)) return false;
  const beforeRanking = snapshotRanking();
  ranking.splice(index, 1);
  saveRanking();
  renderRanking();
  if (fromFullscreen) {
    if (ranking.length) {
      renderFullscreenRanking({ focusRankingIndex: Math.min(index, ranking.length - 1) });
    } else {
      closeFullscreenRanking({ restoreFocus: false });
    }
  }
  updateSuggestions();
  renderPackSurfaces();
  setUndoableFeedback(`"${movie.title}" removed.`, () => restoreRankingTo(beforeRanking));
  return true;
};

rankingList.addEventListener("click", (event) => {
  const restackButton = event.target.closest(".ranking__restack");
  if (restackButton) {
    const item = restackButton.closest(".ranking__item");
    if (!item) return;
    const index = Number(item.dataset.index);
    if (Number.isNaN(index)) return;
    beginRankingRestack(index);
    return;
  }
  const removeButton = event.target.closest(".ranking__delete");
  if (!removeButton) return;
  const item = removeButton.closest(".ranking__item");
  if (!item) return;
  const index = Number(item.dataset.index);
  if (Number.isNaN(index)) return;
  removeRankedMovie(index);
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
    // Reordering a filtered subset is ambiguous (hidden items break the drop
    // math), so dragging is disabled while a filter is active.
    if (rankingFilterQuery.trim()) return;
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

// --- Single-level undo for list changes -----------------------------------
// Short-lived undo hung off the action-toast: snapshot the affected list(s)
// before a mutation, then offer "Undo" to swap them back. Only one undo is live
// at a time (a newer action replaces it); the controller in lib/undo.js owns
// that lifecycle, while the restore closures here reassign the live arrays.
const undoController = createUndoController();
const UNDO_TOAST_MS = 5000;

// Show a toast whose "Undo" button reverses the action via `restore`.
const setUndoableFeedback = (message, restore, duration = UNDO_TOAST_MS) => {
  const token = undoController.set({ label: message, restore, ttlMs: duration });
  setAddFeedback(message, duration, [
    {
      label: "Undo",
      onClick: () => {
        const run = undoController.consume(token);
        if (run) run();
      },
    },
  ]);
};

const snapshotQueues = () => ({
  watch: watchList.map((movie) => ({ ...movie })),
  notInterested: notInterestedList.map((movie) => ({ ...movie })),
});

const restoreQueuesTo = (snap) => {
  watchList = snap.watch.map((movie) => ({ ...movie }));
  notInterestedList = snap.notInterested.map((movie) => ({ ...movie }));
  persistSuggestionQueues();
  updateSuggestions();
  renderPackSurfaces();
  setAddFeedback("Change undone.", 2000);
};

const snapshotRanking = () => ranking.map((movie) => ({ ...movie }));

const restoreRankingTo = (snap) => {
  ranking = snap.map((movie) => ({ ...movie }));
  saveRanking();
  renderRanking();
  if (fullscreenOverlay && !fullscreenOverlay.hidden) {
    renderFullscreenRanking();
  }
  updateSuggestions();
  renderPackSurfaces();
  setAddFeedback("Change undone.", 2000);
};

// Whole-state snapshot (ranking + both queues) for undoing a completed ranking,
// where the movie may leave one list and rejoin another.
const snapshotLists = () => ({
  ranking: ranking.map((movie) => ({ ...movie })),
  watch: watchList.map((movie) => ({ ...movie })),
  notInterested: notInterestedList.map((movie) => ({ ...movie })),
});

const restoreListsTo = (snap) => {
  ranking = snap.ranking.map((movie) => ({ ...movie }));
  watchList = snap.watch.map((movie) => ({ ...movie }));
  notInterestedList = snap.notInterested.map((movie) => ({ ...movie }));
  saveRanking();
  persistSuggestionQueues();
  renderRanking();
  updateSuggestions();
  renderPackSurfaces();
  setAddFeedback("Change undone.", 2000);
};

// Undo a placement made during an auto-pack ("rank all") run. The flow has
// already advanced to the NEXT movie's comparison, so we can't restore a
// whole-list snapshot (it would clobber that in-progress movie, which may have
// been pulled from a queue). Instead we surgically unrank just this movie and
// return it to its origin queue if it had one, leaving the auto-pack session and
// the current comparison intact. Because removing a movie shifts the ranking the
// in-progress comparison is searching, we restart that movie's binary search
// against the corrected list (a no-op cost when undo is tapped right after a
// placement, before any new comparisons are answered). Pack completion state
// self-heals via syncPackCompletion on the re-render below.
const undoAutoPackPlacement = (movie, origin) => {
  const key = movieKey(movie);
  const ri = ranking.findIndex((item) => movieKey(item) === key);
  if (ri >= 0) ranking.splice(ri, 1);
  if (origin?.type === "watch") {
    watchList.splice(Math.min(origin.index, watchList.length), 0, { ...origin.movie });
  } else if (origin?.type === "notInterested") {
    notInterestedList.splice(Math.min(origin.index, notInterestedList.length), 0, { ...origin.movie });
  }
  saveRanking();
  persistSuggestionQueues();
  renderRanking();
  updateSuggestions();
  renderPackSurfaces();
  if (pending && searchRange) {
    compareHistory = [];
    if (ranking.length === 0) {
      // The list emptied under the in-progress movie — let the empty-list path
      // re-place it (it becomes the new top pick); that flow owns its messaging.
      searchRange = null;
      startComparison();
      return;
    }
    searchRange = { low: 0, high: ranking.length - 1 };
    firstComparisonMid = firstComparisonIndex(ranking.length);
    showComparison();
  }
  setAddFeedback(`"${movie.title}" unranked.`, 2000);
};

// Announce where a movie landed after ranking, with an Undo. During an auto-pack
// run undo unranks just this movie (the flow has moved on); otherwise it
// restores the whole pre-ranking snapshot (handles the queue/restack origins).
const announcePlacement = (message, context, rankedMovie, origin) => {
  const snap = pendingRankingSnapshot;
  pendingRankingSnapshot = null;
  const isAutoPack = context?.type === "pack" && context.mode === "auto";
  if (isAutoPack) {
    const movieRef = { ...rankedMovie };
    const originRef = origin ? { ...origin, movie: { ...origin.movie } } : null;
    setUndoableFeedback(message, () => undoAutoPackPlacement(movieRef, originRef));
  } else if (snap) {
    setUndoableFeedback(message, () => restoreListsTo(snap));
  } else {
    setAddFeedback(message);
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
  if (detailRequests.has(cacheKey)) return detailRequests.get(cacheKey);
  const request = (async () => {
    const url = `${supabaseEnabled ? `${SUPABASE_URL}${TMDB_DETAIL_PATH}` : ""}?id=${encodeURIComponent(
      movie.tmdbId,
    )}`;
    try {
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
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
    } finally {
      detailRequests.delete(cacheKey);
    }
  })();
  detailRequests.set(cacheKey, request);
  return request;
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

const setSuggestionReasonText = (element, text) => {
  if (!element || !text) return;
  const textElement = element.querySelector(".suggest-reason__text");
  if (!textElement) return;
  textElement.textContent = text;
  element.classList.remove("is-pending");
  element.removeAttribute("aria-hidden");
  element.setAttribute("aria-label", `Why this pick: ${text}`);
  element.title = text;
};

const setSuggestionReasonPending = (element) => {
  if (!element) return;
  const textElement = element.querySelector(".suggest-reason__text");
  if (textElement) textElement.textContent = "";
  element.classList.add("is-pending");
  element.setAttribute("aria-hidden", "true");
  element.removeAttribute("aria-label");
  element.removeAttribute("title");
};

const suggestionReasonSeed = (reasonContext) => {
  const seed = reasonContext?.seed || null;
  return seed ? { ...(seed.movie || {}), ...seed } : null;
};

const hydrateSuggestionReasons = async (sectionKey, entries, reasonContext = null) => {
  const seed = reasonContext?.seed || null;
  const seedMovie = seed?.movie || seed;
  const seedDetailPromise =
    sectionKey === "related" && seedMovie?.tmdbId && !Array.isArray(seedMovie.genres)
      ? fetchMovieDetail(seedMovie)
      : Promise.resolve(seedMovie);
  const detailPromises = entries.map(({ movie }) =>
    movie?.tmdbId && !Array.isArray(movie.genres) ? fetchMovieDetail(movie) : Promise.resolve(movie),
  );
  const [seedDetail, details] = await Promise.all([
    seedDetailPromise,
    Promise.all(detailPromises),
  ]);
  const enrichedSeed = seed ? { ...seed, ...(seedDetail || {}) } : null;

  entries.forEach(({ movie, reasonElement }, index) => {
    if (!reasonElement.isConnected) return;
    const enrichedMovie = details[index] || movie;
    if (!isSuggestionReasonReady({ sectionKey, movie: enrichedMovie, seed: enrichedSeed })) {
      return;
    }
    const reason = buildSuggestionReason({
      sectionKey,
      movie: enrichedMovie,
      seed: enrichedSeed,
    });
    setSuggestionReasonText(reasonElement, reason);
  });
};

const setSuggestionList = (sectionKey, container, items = [], reasonContext = null) => {
  container.innerHTML = "";
  const reasonEntries = [];
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
    const reason = document.createElement("div");
    reason.className = "suggest-reason";
    reason.innerHTML = `${createSuggestionReasonIcon()}<span class="suggest-reason__text"></span>`;
    const seed = suggestionReasonSeed(reasonContext);
    if (isSuggestionReasonReady({ sectionKey, movie, seed })) {
      setSuggestionReasonText(
        reason,
        buildSuggestionReason({
          sectionKey,
          movie,
          seed,
        }),
      );
    } else {
      setSuggestionReasonPending(reason);
    }
    reasonEntries.push({ movie, reasonElement: reason });
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

    card.append(poster, name, detailButton, meta, reason, actions);
    card.addEventListener("click", () => startRankingFromSuggestion(movie, sectionKey));
    card.addEventListener("keydown", (event) => {
      if (event.target.closest("button")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startRankingFromSuggestion(movie, sectionKey);
      }
    });
    container.appendChild(card);
  });
  void hydrateSuggestionReasons(sectionKey, reasonEntries, reasonContext);
};

const setSuggestionSectionState = (sectionKey, all, visible, reasonContext = null) => {
  suggestionSectionState = {
    ...suggestionSectionState,
    [sectionKey]: { all, visible, reasonContext },
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

  setSuggestionSectionState(sectionKey, nextAll, nextVisible, state.reasonContext);
  setSuggestionList(sectionKey, config.container, nextVisible, state.reasonContext);
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
        apikey: SUPABASE_PUBLISHABLE_KEY,
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

// Pack progress + share aggregation now live in lib/packs.js. These wrappers
// bind the live state — the derived per-movie handled state and the persisted
// `packProgress` entry — so the rest of app.js calls them unchanged.
const getPackStats = (pack) => computePackStats(pack, getMovieHandledState, packProgress[pack.slug] || {});

const packStatusRank = (pack) => libPackStatusRank(getPackStats(pack));

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

const packStatusText = (pack, stats = getPackStats(pack)) => libPackStatusText(stats);

const packCompactStatusText = (pack, stats = getPackStats(pack)) => packStatusText(pack, stats);

const packActionText = (pack, stats = getPackStats(pack)) => libPackActionText(stats);

// Aggregate pack engagement / featured picks for the Share Suite — pure helpers
// in lib/packs.js fed the live pack list + derived stats.
const sharePackEntries = () => suggestionPacks.map((pack) => ({ pack, stats: getPackStats(pack) }));
const getSharePackSummary = () => summarizePacks(sharePackEntries());
const getSharePackFeatured = (limit = 4) => featuredPacks(sharePackEntries(), limit);

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
  card.addEventListener("click", () => {
    trackProductEvent("pack_opened", {
      source: options.quickStart ? "quick_start" : "pack_card",
      list_size: countBucket(ranking.length),
    });
    if (options.quickStart) {
      trackProductEvent("quick_start_pack_opened", {
        source: "quick_start",
        list_size: countBucket(ranking.length),
      });
    }
    openPackDetail(pack.slug, { trigger: card });
  });
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
  const isEmptyFirstRun = getFirstRunExperience(ranking.length).state === "empty";
  const packs = isEmptyFirstRun
    ? selectStarterPacks(suggestionPacks, { limit: PACK_PANEL_SIZE })
    : sortedPacksForDisplay(false).slice(0, PACK_PANEL_SIZE);
  packEmpty.hidden = packs.length > 0;
  packSection.classList.toggle("is-first-run", isEmptyFirstRun);
  packSectionTitle.textContent = isEmptyFirstRun ? "Start with a movie pack" : "Suggested movie packs";
  if (!suggestionPacks.length) {
    packSectionSub.textContent = isEmptyFirstRun
      ? "Starter packs will appear here after they load."
      : "Packs to work through.";
  } else if (isEmptyFirstRun) {
    packSectionSub.textContent = "Pick a ready-made set and rank only the movies you know.";
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
    packRow.appendChild(createPackCard(pack, { quickStart: isEmptyFirstRun }));
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
  if (!packDetailOverlay.hidden && packDetailOverlay.classList.contains("is-all-packs")) {
    renderPackBrowser();
  } else if (currentPackSlug) {
    renderPackDetail();
  }
  updateDebugPanel();
};

const closePackDetail = ({ restoreFocus = true } = {}) => {
  currentPackSlug = null;
  packDetailFromAllPacks = false;
  packDetailOverlay.hidden = true;
  document.body.classList.remove("is-detail-open");
  if (restoreFocus && packDetailTrigger) {
    packDetailTrigger.focus();
  }
  packDetailTrigger = null;
};

const updatePackDetailPager = () => {
  const index = packDetailFromAllPacks ? packBrowserOrder.indexOf(currentPackSlug) : -1;
  const show = index >= 0 && packBrowserOrder.length > 1;
  packDetailPager.hidden = !show;
  if (!show) return;
  packDetailPrev.disabled = index <= 0;
  packDetailNext.disabled = index >= packBrowserOrder.length - 1;
  packDetailPagerCount.textContent = `Pack ${index + 1} of ${packBrowserOrder.length}`;
};

const navigatePackDetail = (delta) => {
  if (!packDetailFromAllPacks) return;
  const index = packBrowserOrder.indexOf(currentPackSlug);
  if (index < 0) return;
  const nextSlug = packBrowserOrder[index + delta];
  if (!nextSlug) return;
  openPackDetail(nextSlug, { fromAllPacks: true });
};

const openPackDetail = (slug, { trigger = null, showHandled = false, fromAllPacks } = {}) => {
  const pack = getPackBySlug(slug);
  if (!pack) return;
  // Remember if we're drilling in from the "All packs" browser so the close
  // button can return there, and stash its scroll position to restore later.
  // Pager prev/next passes fromAllPacks explicitly to preserve that context as it
  // hops between packs (the overlay is no longer in the browser view by then).
  const browserViewOpen =
    !packDetailOverlay.hidden && packDetailOverlay.classList.contains("is-all-packs");
  const cameFromAllPacks = fromAllPacks ?? browserViewOpen;
  if (browserViewOpen) packBrowserScrollTop = packDetailSheet ? packDetailSheet.scrollTop : 0;
  packDetailFromAllPacks = cameFromAllPacks;
  packDetailOverlay.classList.remove("is-all-packs");
  packBrowserFilters.hidden = true;
  currentPackSlug = slug;
  packDetailTrigger = trigger || packDetailTrigger;
  packDetailShowHandled = showHandled;
  renderPackDetail();
  packDetailOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
  // A specific pack detail should always open scrolled to the top, even when
  // reusing the overlay that the browser list just scrolled down.
  if (packDetailSheet) packDetailSheet.scrollTop = 0;
};

const startPackMovieRanking = (pack, movie, mode = "browse") => {
  // Capture whether we drilled in from "All packs" before closePackDetail clears
  // it, so reopening the detail after this ranking can return there (not home).
  const fromAllPacks = packDetailFromAllPacks;
  closePackDetail({ restoreFocus: false });
  startRankingMovie(movie, { type: "pack", slug: pack.slug, mode, fromAllPacks });
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
  // Snapshot before the bulk move so a single Undo reverts every save/hide this
  // action made — back to exactly the prior queue state, however many moved.
  const beforeLists = snapshotLists();
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
  setUndoableFeedback(
    `${movies.length} ${movies.length === 1 ? "movie" : "movies"} moved to ${queueLabel(target)}.`,
    () => restoreListsTo(beforeLists),
  );
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
  updatePackDetailPager();
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

const renderPackBrowserCategories = () => {
  const counts = new Map();
  suggestionPacks.forEach((pack) => {
    counts.set(pack.category, (counts.get(pack.category) || 0) + 1);
  });
  const categories = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  packBrowserCategory.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = `All categories (${suggestionPacks.length})`;
  packBrowserCategory.appendChild(all);
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = `${category} (${counts.get(category)})`;
    packBrowserCategory.appendChild(option);
  });
  if (counts.has(packBrowserFilterValues.category)) {
    packBrowserCategory.value = packBrowserFilterValues.category;
  } else {
    packBrowserFilterValues.category = "all";
    packBrowserCategory.value = "all";
  }
};

const setPackBrowserFiltersExpanded = (expanded) => {
  packBrowserFiltersExpanded = Boolean(expanded);
  packBrowserFilterToggle.setAttribute("aria-expanded", String(packBrowserFiltersExpanded));
  packBrowserFilterControls.hidden = !packBrowserFiltersExpanded;
};

const renderPackBrowser = () => {
  const entries = sortedPacksForDisplay(true).map((pack) => ({ pack, stats: getPackStats(pack) }));
  const stateCountEntries = filterPacks(entries, {
    query: packBrowserFilterValues.query,
    category: packBrowserFilterValues.category,
    state: "all",
  });
  const counts = countPackFilterStates(stateCountEntries);
  const filtered = filterPacks(entries, packBrowserFilterValues);
  packBrowserOrder = filtered.map(({ pack }) => pack.slug);

  packBrowserStateOptions.innerHTML = "";
  PACK_BROWSER_STATES.forEach(({ value, label }) => {
    const button = document.createElement("button");
    button.className = "pack-browser-state-button";
    button.type = "button";
    button.dataset.state = value;
    button.setAttribute("aria-pressed", String(packBrowserFilterValues.state === value));
    button.disabled = value !== "all" && counts[value] === 0;
    const text = document.createElement("span");
    text.textContent = label;
    const count = document.createElement("span");
    count.className = "pack-browser-state-count";
    count.textContent = counts[value];
    button.append(text, count);
    packBrowserStateOptions.appendChild(button);
  });

  const hasFilters =
    Boolean(packBrowserFilterValues.query.trim()) ||
    packBrowserFilterValues.category !== "all" ||
    packBrowserFilterValues.state !== "all";
  const activeFilterCount =
    Number(Boolean(packBrowserFilterValues.query.trim())) +
    Number(packBrowserFilterValues.category !== "all") +
    Number(packBrowserFilterValues.state !== "all");
  packBrowserSearchClear.hidden = !packBrowserFilterValues.query;
  packBrowserFilterBadge.hidden = activeFilterCount === 0;
  packBrowserFilterBadge.textContent = `${activeFilterCount} active`;
  packBrowserReset.hidden = !hasFilters;
  packBrowserResults.textContent = hasFilters
    ? `Showing ${filtered.length} of ${entries.length} packs.`
    : `Showing all ${entries.length} packs.`;

  packDetailList.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "pack-browser-empty";
    const message = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "No packs match those filters.";
    const detail = document.createElement("span");
    detail.textContent = "Try another search, category, or progress state.";
    message.append(title, detail);
    empty.appendChild(message);
    packDetailList.appendChild(empty);
    return;
  }
  filtered.forEach(({ pack }) => {
    packDetailList.appendChild(createPackCard(pack, { showCategory: true }));
  });
};

const openAllPacks = ({ restoreScroll = false, trigger = null, source = "home" } = {}) => {
  if (!restoreScroll) {
    trackProductEvent("pack_browser_opened", {
      list_size: countBucket(ranking.length),
      source,
    });
  }
  currentPackSlug = null;
  packDetailFromAllPacks = false;
  if (!restoreScroll || !packDetailTrigger) packDetailTrigger = trigger || packViewAll;
  packDetailPager.hidden = true;
  packDetailOverlay.classList.add("is-all-packs");
  packBrowserFilters.hidden = false;
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
  packBrowserSearch.value = packBrowserFilterValues.query;
  setPackBrowserFiltersExpanded(packBrowserFiltersExpanded);
  renderPackBrowserCategories();
  renderPackBrowser();
  packDetailOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
  // Returning from a pack detail restores where the user was in the list;
  // opening fresh from the homepage starts at the top.
  if (packDetailSheet) packDetailSheet.scrollTop = restoreScroll ? packBrowserScrollTop : 0;
};

// The pack overlay is reused for both the "All packs" browser and a single
// pack's detail. Closing a pack that was opened from the browser should step
// back to the browser rather than dismissing the whole overlay to the homepage.
const handlePackDetailClose = () => {
  if (packDetailFromAllPacks && currentPackSlug) {
    openAllPacks({ restoreScroll: true });
    return;
  }
  closePackDetail();
};

const isAutoPackComparison = () =>
  pendingPackContext?.type === "pack" &&
  pendingPackContext.mode === "auto" &&
  autoPackSession?.slug === pendingPackContext.slug;

const clearActiveComparison = () => {
  pending = null;
  pendingPackContext = null;
  pendingOrigin = null;
  pendingTelemetry = null;
  searchRange = null;
  compareHistory = [];
  suggestionsRequestId += 1;
  setComparisonMode(false);
  compareSection.classList.add("panel--hidden");
  form.reset();
  titleInput.blur();
};

const stopAutoPack = ({ openDetail = true, message = "", outcome = "ended" } = {}) => {
  const slug = autoPackSession?.slug || pendingPackContext?.slug || currentPackSlug;
  const fromAllPacks = autoPackSession?.fromAllPacks ?? pendingPackContext?.fromAllPacks;
  const hadSession = Boolean(autoPackSession);
  autoPackSession = null;
  if (hadSession) {
    trackProductEvent("pack_rank_all_stopped", {
      outcome,
      list_size: countBucket(ranking.length),
    });
  }
  if (message) setAddFeedback(message, 2600);
  renderPackSurfaces();
  if (openDetail && slug) {
    openPackDetail(slug, { showHandled: packDetailShowHandled, fromAllPacks });
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
    stopAutoPack({ openDetail: false, outcome: "failed" });
    return;
  }
  const nextEntry = nextAutoPackEntry(pack);
  if (!nextEntry) {
    const stats = getPackStats(pack);
    stopAutoPack({
      openDetail: true,
      message: stats.completed ? `"${pack.title}" complete.` : `"${pack.title}" paused.`,
      outcome: stats.completed ? "completed" : "ended",
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
    fromAllPacks: packDetailFromAllPacks,
  };
  markPackEngaged(pack, { lastIndex: autoPackSession.cursor });
  trackProductEvent("pack_rank_all_started", {
    list_size: countBucket(ranking.length),
    count: countBucket(getPackStats(pack).remainingMovies.length),
  });
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
        onClick: () => {
          trackProductEvent("pack_opened", {
            source: "discovery",
            list_size: countBucket(ranking.length),
          });
          openPackDetail(pack.slug);
        },
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
        window.setTimeout(() => openPackDetail(pack.slug, { fromAllPacks: context.fromAllPacks }), 180);
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
    const rankIndex = ranking.findIndex((rankedMovie) => rankedMovie.tmdbId === lastAddedTmdbId);
    const movie = ranking[rankIndex];
    return {
      id: lastAddedTmdbId,
      source: "recent",
      label: `Inspired by ${movie?.title || "your latest movie"}`,
      title: movie?.title || "your latest movie",
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      movie,
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
    title: topRankedSeed.title,
    rank: ranking.indexOf(topRankedSeed) + 1,
    movie: topRankedSeed,
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
  setSuggestionSectionState("popular", popularFiltered, popular, null);
  setSuggestionList("popular", suggestPopular, popular, null);
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
  setSuggestionSectionState("essentials", essentialsFiltered, essentials, null);
  setSuggestionList("essentials", suggestEssentials, essentials, null);
  suggestEssentialsMore.disabled = essentialsFiltered.length <= SUGGESTION_PAGE_SIZE;
};

const updateRelatedSuggestions = async (requestId = createSuggestionRequest()) => {
  if (!requestId) return;
  const personalSeed = getPersonalSuggestionSeed();
  if (personalSeed) {
    suggestRelatedMore.disabled = true;
    suggestRelatedSection.hidden = false;
    suggestRelatedTitle.textContent = personalSeed.label;
    const reasonContext = { seed: personalSeed };
    suggestRelatedSub.textContent = buildSuggestionSectionSubtitle("related", reasonContext);
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
    setSuggestionSectionState("related", relatedFiltered, related, reasonContext);
    setSuggestionList("related", suggestRelated, related, reasonContext);
    suggestRelatedMore.disabled = relatedFiltered.length <= SUGGESTION_PAGE_SIZE;
    suggestRelatedSection.hidden = related.length === 0;
    suggestRelatedEmpty.style.display = "none";
  } else {
    activeSuggestionSeed = null;
    setSuggestionSectionState("related", [], [], null);
    suggestRelatedSection.hidden = true;
    suggestRelated.innerHTML = "";
    suggestRelatedSub.textContent = buildSuggestionSectionSubtitle("related");
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

// getSharePickGroups, movieExportLine, shareRankingMetaCards now live in
// lib/share-export.js, imported at the top.

function buildShareExportTitle(options = shareOptions) {
  const tone = getShareTone(options.tone);
  const displayName = getShareDisplayName(options);
  return displayName ? `${possessiveName(displayName)} ${lowercaseFirst(tone.heroLead)}` : tone.heroLead;
}

// The pure section builder lives in lib/share-export.js. This wrapper gathers the
// state-coupled context (resolved tone, queue lists + runtime displays, pack
// summary/featured) and calls it.
function buildShareExportSections(insights = getRankingInsights(), options = shareOptions) {
  const watchRuntime = runtimeStatsForMovies(watchList);
  const hiddenRuntime = runtimeStatsForMovies(notInterestedList);
  return libBuildShareExportSections(insights, options, {
    tone: getShareTone(options.tone),
    watchList,
    notInterestedList,
    watchRuntimeDisplay: formatShareRuntimeTotal(watchRuntime, watchList.length, shareDetailsLoading),
    hiddenRuntimeDisplay: formatShareRuntimeTotal(hiddenRuntime, notInterestedList.length, shareDetailsLoading),
    hiddenRuntimeLabel: hiddenRuntimeLabel(options.tone),
    packSummary: getSharePackSummary(),
    packFeatured: getSharePackFeatured(4),
  });
}

function buildShareMarkdown() {
  const insights = getRankingInsights();
  if (!insights.count) return buildExportText();
  const sections = buildShareExportSections(insights);
  return sectionsToMarkdown(buildShareExportTitle(), formatShortDate(new Date().toISOString()), sections);
}

function buildShareText() {
  const insights = getRankingInsights();
  if (!insights.count) return "StackRank - Movies\n\n(No movies ranked yet.)";
  const sections = buildShareExportSections(insights);
  return sectionsToText(buildShareExportTitle(), formatShortDate(new Date().toISOString()), sections);
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

// Text helpers (xmlEscape, estimateSvgTextWidth, trimTextToSvgWidth,
// wrapTextToSvgWidth) now live in lib/text.js, imported at the top.

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
      packsTitle: "Pack progress",
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
      packsTitle: "Packs conquered",
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
      packsTitle: "Side quests cleared",
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
      packsTitle: "Pack campaigns",
      listTitle: "Every placement",
    },
  };
  return tones[toneName] || tones.neutral;
}

// svgTextLines now lives in lib/text.js, imported at the top.

function posterDataFor(movie, allowExternal = true, useProxy = false) {
  if (!movie?.posterPath) return null;
  if (posterDataCache.has(movie.posterPath)) return posterDataCache.get(movie.posterPath);
  if (!allowExternal) return null;
  if (useProxy && tmdbImageUrl) {
    return `${tmdbImageUrl}?path=${encodeURIComponent(movie.posterPath)}&size=w342`;
  }
  return `${TMDB_POSTER_SMALL}${movie.posterPath}`;
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
      // Loading settled with no genre data — hide the section entirely.
      return null;
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
      // Loading settled with no cast/crew data — hide the section entirely.
      return null;
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
    // Nothing saved or hidden — hide the section entirely.
    if (!watchList.length && !notInterestedList.length) return null;
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
    // Nothing saved or hidden — hide the section entirely.
    if (!watchList.length && !notInterestedList.length) return null;
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

  // Packs section: a 4-up meta strip (completed / in progress / movies ranked /
  // most-explored category) above up to four pack cards rendered roughly like
  // the in-app pack cards — a 2x2 poster collage cover, title, subtitle, status
  // and a progress bar. Self-hides when the user has no pack engagement.
  const packs = () => {
    if (!options.packs) return null;
    const summary = getSharePackSummary();
    if (!summary.engaged) return null;
    const featured = getSharePackFeatured(4);

    // Meta strip — four compact stat cards across the content width.
    const metaCols = 4;
    const metaGap = 22;
    const metaCardW = Math.floor((contentRight - marginX - (metaCols - 1) * metaGap) / metaCols);
    const metaCardH = 132;
    const metaCards = [
      { value: String(summary.completed), label: "Packs completed", big: true },
      { value: String(summary.inProgress), label: "In progress", big: true },
      { value: String(summary.rankedCount), label: "Movies ranked", big: true },
      summary.topCategory
        ? { value: summary.topCategory, label: "Most explored", big: false }
        : { value: String(summary.totalPacks), label: "Packs available", big: true },
    ];
    let block = "";
    metaCards.forEach((card, index) => {
      const x = marginX + index * (metaCardW + metaGap);
      block += `<rect x="${x}" y="0" width="${metaCardW}" height="${metaCardH}" rx="22" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
      if (card.big) {
        block += `<text x="${x + 24}" y="78" class="stat-value">${xmlEscape(card.value)}</text>`;
      } else {
        const valueLines = wrapTextToSvgWidth(card.value, metaCardW - 44, 28, 2);
        block += svgTextLines(valueLines, x + 24, 54, "stat-value-small", 32);
      }
      const labelLines = wrapTextToSvgWidth(card.label, metaCardW - 44, 21, 2);
      block += svgTextLines(
        labelLines,
        x + 24,
        metaCardH - 22 - (labelLines.length - 1) * 24,
        "stat-card-label",
        24,
      );
    });

    if (!featured.length) {
      return section("packs", tone.packsTitle, "Curated sets you're working through", block, metaCardH);
    }

    // Featured pack cards — two columns aligned with the other 2-up sections.
    const packCardW = cardW;
    const packCardH = 224;
    const rowStride = packCardH + 28;
    const cardsTop = metaCardH + 40;
    const pad = 22;
    const tileGap = 6;
    const tileW = 62;
    const tileH = 93;
    const coverW = tileW * 2 + tileGap;
    const coverH = tileH * 2 + tileGap;

    const packCardCell = (pack, stats, x, y) => {
      let cell = `<rect x="${x}" y="${y}" width="${packCardW}" height="${packCardH}" rx="22" fill="${theme.panel}" stroke="${panelStroke}" stroke-width="3" />`;
      const coverX = x + pad;
      const coverY = y + Math.round((packCardH - coverH) / 2);
      const posterMovies = pack.movies.filter((m) => m.posterPath).slice(0, 4);
      const coverMovies = posterMovies.length >= 2 ? posterMovies : pack.movies.slice(0, 4);
      for (let i = 0; i < 4; i += 1) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const tx = coverX + col * (tileW + tileGap);
        const ty = coverY + row * (tileH + tileGap);
        const movie = coverMovies[i];
        const posterData = movie ? posterDataFor(movie, allowExternalPosters, usePosterProxy) : null;
        if (posterData) {
          cell += `<image href="${xmlEscape(posterData)}" x="${tx}" y="${ty}" width="${tileW}" height="${tileH}" preserveAspectRatio="xMidYMid slice" />`;
        } else {
          cell += `<rect x="${tx}" y="${ty}" width="${tileW}" height="${tileH}" rx="8" fill="${theme.faint}" />`;
          const initial = (movie?.title || "SR").slice(0, 1).toUpperCase();
          cell += `<text x="${tx + tileW / 2}" y="${ty + Math.round(tileH / 2) + 8}" class="deep-rank" text-anchor="middle">${xmlEscape(initial)}</text>`;
        }
      }

      // Text column to the right of the collage.
      const textX = coverX + coverW + 24;
      const textW = x + packCardW - pad - textX;
      const titleSizes = [30, 28, 26, 24];
      let title = { lines: [pack.title], fontSize: 24, lineHeight: 27 };
      for (const fs of titleSizes) {
        const lines = wrapTextToSvgWidth(pack.title, textW, fs, Infinity);
        if (lines.length <= 2) {
          title = { lines, fontSize: fs, lineHeight: Math.round(fs * 1.12) };
          break;
        }
        title = { lines: wrapTextToSvgWidth(pack.title, textW, fs, 2), fontSize: fs, lineHeight: Math.round(fs * 1.12) };
      }
      const titleTop = y + 50;
      cell += svgTextLines(title.lines, textX, titleTop, `full-list-row-title-${title.fontSize}`, title.lineHeight);
      if (pack.subtitle) {
        const subLines = wrapTextToSvgWidth(pack.subtitle, textW, 21, 2).slice(0, 2);
        const subTop = titleTop + (title.lines.length - 1) * title.lineHeight + 32;
        cell += svgTextLines(subLines, textX, subTop, "poster-rank", 26);
      }

      // Status + progress bar anchored to the bottom of the card.
      const barY = y + packCardH - 42;
      const statusY = barY - 16;
      cell += `<text x="${textX}" y="${statusY}" class="stat-card-label">${xmlEscape(sharePackCardStatus(stats))}</text>`;
      const barW = textW;
      const fillW = stats.progress > 0 ? Math.max(16, Math.round(stats.progress * barW)) : 0;
      const accent = stats.completed ? theme.accent2 : theme.accent;
      cell += `<rect x="${textX}" y="${barY}" width="${barW}" height="16" rx="8" fill="${theme.faint}" />`;
      if (fillW > 0) cell += `<rect x="${textX}" y="${barY}" width="${fillW}" height="16" rx="8" fill="${accent}" />`;

      // Completion check over the collage corner (mirrors the in-app badge).
      if (stats.completed) {
        const bx = coverX + 4;
        const by = coverY + 4;
        cell += `<circle cx="${bx + 16}" cy="${by + 16}" r="18" fill="${theme.accent2}" stroke="${theme.panel}" stroke-width="3" />`;
        cell += `<text x="${bx + 16}" y="${by + 24}" class="rank-number" text-anchor="middle">✓</text>`;
      }
      return cell;
    };

    featured.forEach(({ pack, stats }, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = marginX + col * colUnit;
      const y = cardsTop + row * rowStride;
      block += packCardCell(pack, stats, x, y);
    });

    const rows = Math.ceil(featured.length / 2);
    const height = cardsTop + (rows - 1) * rowStride + packCardH + 8;
    return section("packs", tone.packsTitle, "Curated sets you're working through", block, height);
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
      block += shareRankBadgeSvg(badgeLabel, {
        x: badgeX, y: badgeY, w: badgeW, h: 28, rx: 14,
        textX: badgeX + badgeW / 2, textY: badgeY + 20, fontSize: 15,
        fill: theme.panel, fillOpacity: 0.9, stroke: panelStroke, textFill: theme.muted,
      });
    });
    return section(
      "list",
      tone.listTitle,
      "Every movie, top to bottom",
      block,
      posterStartY + Math.ceil(ranking.length / cols) * (cellH + 24),
    );
  };

  return { topPicks, bottomPicks, eras, genres, people, queues, savedHidden, packs, fullList };
}

// A rank badge that overlays a poster in the whole-list "posters" style. The
// rect+text render in the SVG (and the studio preview), and the data-* metadata
// lets the PNG export redraw the badge on the canvas *after* the poster overlays
// are painted — otherwise the poster image is drawn on top and hides it. See
// getSvgBadgeOverlays / drawBadgeOverlays.
function shareRankBadgeSvg(label, geo) {
  const { x, y, w, h, rx, textX, textY, fontSize, fill, fillOpacity, stroke, textFill } = geo;
  return (
    `<g class="share-rank-badge" data-bx="${x}" data-by="${y}" data-bw="${w}" data-bh="${h}" data-brx="${rx}"` +
    ` data-tx="${textX}" data-ty="${textY}" data-fs="${fontSize}" data-fill="${fill}" data-fo="${fillOpacity}"` +
    ` data-stroke="${stroke}" data-text="${textFill}" data-label="${xmlEscape(label)}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1.5" />` +
    `<text x="${textX}" y="${textY}" class="poster-number-badge" text-anchor="middle">${xmlEscape(label)}</text></g>`
  );
}

// Single-image Portrait poster (the original output, unchanged).
function buildShareSvg(options = shareOptions) {
  const insights = getRankingInsights();
  const theme = getShareTheme(options.theme);
  const tone = getShareTone(options.tone);
  const builders = shareSectionBuilders(insights, theme, tone, options);
  const descriptors = [
    builders.topPicks(),
    builders.bottomPicks(),
    builders.eras(),
    builders.genres(),
    builders.people(),
    builders.queues(),
    builders.packs(),
    builders.fullList(),
  ].filter(Boolean);
  return composeShareSingleSvg({ theme, tone, options, descriptors });
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
      block += shareRankBadgeSvg(badgeLabel, {
        x: badgeX, y: badgeY, w: badgeW, h: 26, rx: 13,
        textX: badgeX + badgeW / 2, textY: badgeY + 18, fontSize: 15,
        fill: theme.panel, fillOpacity: 0.9, stroke: panelStroke, textFill: theme.muted,
      });
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
    builders.packs(),
  ].filter(Boolean);

  const listDescriptor = buildWideFullListDescriptor(insights, theme, tone, options, 2314);
  return composeShareWideSvg({ theme, tone, options, sectionDescriptors, listDescriptor });
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
        block += shareRankBadgeSvg(badgeLabel, {
          x: badgeX, y: badgeY, w: badgeW, h: 28, rx: 14,
          textX: badgeX + badgeW / 2, textY: badgeY + 20, fontSize: 15,
          fill: theme.panel, fillOpacity: 0.9, stroke: panelStroke, textFill: theme.muted,
        });
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
    { key: "packs", label: "Packs", descriptors: [builders.packs()] },
  ];

  const cards = [];
  groups.forEach((group) => {
    const descriptors = group.descriptors.filter(Boolean);
    if (!descriptors.length) return;
    cards.push({
      key: group.key,
      label: group.label,
      caption: group.label,
      svg: composeShareCard(theme, tone, options, group.label, descriptors),
    });
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
        caption: pages.length > 1 ? `Whole list · ${index + 1}/${pages.length}` : "Whole list",
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
  shareIncludePacks.checked = shareOptions.packs;
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
      // v7: packs section. Defaults on for everyone (older saves lack the key).
      packs: parsed.packs !== false,
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

// Per-section content availability for the Share Studio. A section with no
// content to show (once any async detail loading has settled) is hidden from the
// exports and its Include toggle is disabled. genres / cast+crew depend on async
// TMDB detail data, so they stay "available" while that data is still loading
// (they render a skeleton) and only fall to empty once loading has settled.
function shareSectionAvailability(insights = getRankingInsights()) {
  const picks = getSharePickGroups(insights);
  const detailPending = shareDetailsLoading;
  return {
    top: picks.best.length > 0,
    bottom: picks.worst.length > 0,
    eras: insights.decades.length > 0,
    genres: insights.genres.length > 0 || detailPending,
    people: insights.directors.length > 0 || insights.cast.length > 0 || detailPending,
    queues: watchList.length > 0 || notInterestedList.length > 0,
    packs: getSharePackSummary().engaged,
    fullList: insights.enrichedRanking.length > 0,
  };
}

const SHARE_INCLUDE_META = [
  { key: "top", input: shareIncludeTop, label: "Top picks" },
  { key: "bottom", input: shareIncludeBottom, label: "Bottom picks" },
  { key: "eras", input: shareIncludeEras, label: "Movie eras" },
  { key: "genres", input: shareIncludeGenres, label: "Genres" },
  { key: "people", input: shareIncludePeople, label: "Cast + crew" },
  { key: "queues", input: shareIncludeQueues, label: "Saved / hidden" },
  { key: "packs", input: shareIncludePacks, label: "Movie packs" },
  { key: "fullList", input: shareIncludeFullList, label: "Whole list" },
];

// Disables the Include toggle for any section with no content and annotates its
// label with "(empty)"; re-enables (and restores the plain label) when content
// appears. Cheap DOM-only work, safe to call on every preview refresh.
function updateShareIncludeAvailability(insights = getRankingInsights()) {
  const availability = shareSectionAvailability(insights);
  SHARE_INCLUDE_META.forEach(({ key, input, label }) => {
    if (!input) return;
    const available = availability[key] !== false;
    input.disabled = !available;
    const toggle = input.closest(".share-toggle");
    if (toggle) toggle.classList.toggle("share-toggle--empty", !available);
    const text = input.nextElementSibling;
    if (text) text.textContent = available ? label : `${label} (empty)`;
  });
}

// Status text + button states only — cheap, and crucially does NOT touch the
// preview, so calling it repeatedly (e.g. per enrichment batch) never flickers.
function updateShareExportControls() {
  const insights = getRankingInsights();
  updateShareIncludeAvailability(insights);
  const disabled = !insights.count;
  const nativeShareAvailable = shareNativeShare.dataset.available === "true";
  shareDownloadPng.disabled = disabled || sharePngPreparing;
  shareNativeShare.disabled = disabled || sharePngPreparing || !nativeShareAvailable;
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

const NATIVE_SHARE_UNAVAILABLE_MESSAGE =
  "Native image sharing needs HTTPS and browser file-sharing support.";

function canNativeSharePngFiles(fileCount = 1) {
  if (!navigator.share || typeof File === "undefined") return false;
  try {
    const files = Array.from(
      { length: Math.max(1, fileCount) },
      (_, index) => new File(["x"], `stackrank-${index + 1}.png`, { type: "image/png" }),
    );
    return !navigator.canShare || navigator.canShare({ files });
  } catch (error) {
    return false;
  }
}

function scrollToShareSetPage({ instant = false } = {}) {
  const viewport = sharePreview.querySelector(".share-preview-deck__viewport");
  if (!viewport) return;
  const left = shareSetPageIndex * viewport.clientWidth;
  if (instant) {
    const previousScrollBehavior = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = "auto";
    viewport.scrollLeft = left;
    viewport.style.scrollBehavior = previousScrollBehavior;
  } else {
    viewport.scrollTo({ left, behavior: "smooth" });
  }
  updateShareSetPageChrome();
}

function clearShareSetScrollSync() {
  if (shareSetScrollSyncTimer) window.clearTimeout(shareSetScrollSyncTimer);
  shareSetScrollSyncTimer = null;
}

function scheduleShareSetScrollSync(viewport) {
  clearShareSetScrollSync();
  shareSetScrollSyncTimer = window.setTimeout(() => {
    shareSetScrollSyncTimer = null;
    if (!viewport.isConnected) return;
    const nextIndex = Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth));
    if (nextIndex !== shareSetPageIndex) {
      shareSetPageIndex = nextIndex;
      updateShareSetPageChrome();
    }
  }, 120);
}

function updateShareSetPageChrome() {
  const deck = sharePreview.querySelector(".share-preview-deck");
  if (!deck) return;
  const total = Number(deck.dataset.total || 0);
  const current = Math.min(Math.max(shareSetPageIndex, 0), Math.max(0, total - 1));
  shareSetPageIndex = current;
  const label = deck.querySelector("[data-share-page-label]");
  if (label) label.textContent = `${current + 1}/${Math.max(1, total)}`;
  const activeCaption = deck.querySelectorAll(".share-preview-card")[current]?.dataset.caption || "";
  const activeName = deck.querySelector("[data-share-active-name]");
  if (activeName) activeName.textContent = activeCaption;
  deck.querySelectorAll("[data-share-page-step]").forEach((button) => {
    const step = Number(button.dataset.sharePageStep || 0);
    button.disabled = (step < 0 && current <= 0) || (step > 0 && current >= total - 1);
  });
}

function setShareSetPage(index) {
  const deck = sharePreview.querySelector(".share-preview-deck");
  const total = Number(deck?.dataset.total || 0);
  if (!total) return;
  clearShareSetScrollSync();
  shareSetPageIndex = Math.min(Math.max(index, 0), total - 1);
  scrollToShareSetPage();
}

function updateShareStudio() {
  const images = buildShareImages();
  if (images.mode === "set") {
    const total = images.cards.length;
    shareSetPageIndex = Math.min(Math.max(shareSetPageIndex, 0), Math.max(0, total - 1));
    const canSharePage = canNativeSharePngFiles(1);
    const sharePageUnavailable = canSharePage
      ? ""
      : ` title="${NATIVE_SHARE_UNAVAILABLE_MESSAGE}" aria-label="Share page unavailable. ${NATIVE_SHARE_UNAVAILABLE_MESSAGE}"`;
    const figures = images.cards
      .map(
        (card, index) =>
          `<figure class="share-preview-card" data-page-index="${index}" data-caption="${xmlEscape(card.caption || card.label || "")}">` +
          `<div class="share-preview-card__media">${card.svg}</div>` +
          `</figure>`,
      )
      .join("");
    const markup =
      `<div class="share-preview-deck" data-total="${total}">` +
      `<div class="share-preview-deck__stage">` +
      `<button class="share-preview-nav share-preview-nav--prev" type="button" data-share-page-step="-1" aria-label="Previous image page">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>` +
      `</button>` +
      `<div class="share-preview-deck__viewport" tabindex="0" role="region" aria-label="Image set pages">` +
      `<div class="share-preview-deck__track">${figures}</div>` +
      `</div>` +
      `<button class="share-preview-nav share-preview-nav--next" type="button" data-share-page-step="1" aria-label="Next image page">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>` +
      `</button>` +
      `</div>` +
      `<div class="share-preview-deck__footer">` +
      `<div class="share-preview-card__label share-preview-card__label--active">` +
      `<span class="share-preview-card__num" data-share-page-label>${shareSetPageIndex + 1}/${Math.max(1, total)}</span>` +
      `<span class="share-preview-card__name" data-share-active-name>${xmlEscape(images.cards[shareSetPageIndex]?.caption || "Image set")}</span>` +
      `</div>` +
      `<div class="share-preview-page-actions">` +
      `<button class="detail-action detail-action--muted" type="button" data-share-page-download ${sharePngPreparing ? "disabled" : ""}>Download this page</button>` +
      `<button class="detail-action detail-action--muted" type="button" data-share-page-share ${sharePngPreparing || !canSharePage ? "disabled" : ""}${sharePageUnavailable}>Share page</button>` +
      `</div>` +
      `</div>` +
      `</div>`;
    if (markup !== lastSharePreviewMarkup) {
      clearShareSetScrollSync();
      sharePreview.innerHTML = markup;
      lastSharePreviewMarkup = markup;
      if (shareStudio.hidden) {
        requestAnimationFrame(() => scrollToShareSetPage({ instant: true }));
      } else {
        scrollToShareSetPage({ instant: true });
      }
    } else {
      updateShareSetPageChrome();
    }
    const count = images.cards.length;
    const canShareSet = canNativeSharePngFiles(count);
    // 2+ cards ship as a single .zip; a 1-card set is just one plain file.
    shareDownloadPng.textContent =
      count > 1 ? `Download zip (${count})` : count ? "Download image" : "Download images";
    shareNativeShare.hidden = false;
    if (canShareSet) {
      shareNativeShare.textContent = count > 1 ? `Share set (${count})` : "Save / Share";
    } else if (canSharePage) {
      shareNativeShare.textContent = "Share page";
    } else {
      shareNativeShare.textContent = count > 1 ? `Share set (${count})` : "Save / Share";
    }
    shareNativeShare.dataset.available = String(canShareSet || canSharePage);
    shareNativeShare.title = canShareSet || canSharePage ? "" : NATIVE_SHARE_UNAVAILABLE_MESSAGE;
    shareDownloadSvg.textContent = count > 1 ? "SVG zip" : "SVG";
  } else {
    if (images.svg !== lastSharePreviewMarkup) {
      sharePreview.innerHTML = images.svg;
      lastSharePreviewMarkup = images.svg;
    }
    shareDownloadPng.textContent = "Download PNG";
    const canShareImage = canNativeSharePngFiles(1);
    shareNativeShare.hidden = false;
    shareNativeShare.dataset.available = String(canShareImage);
    shareNativeShare.title = canShareImage ? "" : NATIVE_SHARE_UNAVAILABLE_MESSAGE;
    shareNativeShare.textContent = "Save / Share";
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
  trackProductEvent("share_opened", {
    list_size: countBucket(ranking.length),
    format: shareOptions.format,
  });
  stopPlaceholderRotation();
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
  clearShareSetScrollSync();
  closeLightbox({ restoreFocus: false });
  shareDetailsLoading = false;
  shareStudio.hidden = true;
  lastSharePreviewMarkup = "";
  document.body.classList.remove("is-share-open");
  unlockShareScroll();
  startPlaceholderRotation();
  if (restoreFocus && shareStudioTrigger && document.contains(shareStudioTrigger)) {
    shareStudioTrigger.focus({ preventScroll: true });
  }
  shareStudioTrigger = null;
}

const fullscreenCards = () =>
  Array.from(fullscreenGrid?.querySelectorAll(".fullscreen-card") || []);

const fullscreenColumnCount = () => {
  if (!fullscreenGrid) return 1;
  const template = window.getComputedStyle(fullscreenGrid).gridTemplateColumns;
  return Math.max(1, template.split(" ").filter(Boolean).length);
};

function renderFullscreenRanking({ focusRankingIndex = null } = {}) {
  if (!fullscreenGrid) return;
  fullscreenGrid.innerHTML = "";
  const count = ranking.length;
  const lensEntries = fullscreenTasteSignal
    ? tasteSignalEntries(ranking.map(movieWithDetail), fullscreenTasteSignal)
    : null;
  const query = fullscreenFilterQuery.trim().toLocaleLowerCase();
  const entries = (lensEntries || filterFullscreenRanking(ranking)).filter(({ movie }) => {
    if (!query) return true;
    return `${movie?.title || ""} ${movie?.year || ""}`.toLocaleLowerCase().includes(query);
  });
  const isFiltered = Boolean(query || fullscreenTasteSignal);
  fullscreenGrid.classList.toggle("is-compact", fullscreenDensityMode === "compact");
  fullscreenGrid.classList.toggle("is-filtered", isFiltered);
  if (fullscreenTitle) {
    fullscreenTitle.textContent = fullscreenTasteSignal
      ? `${fullscreenTasteSignal.value} in your ranking`
      : "Current ranking";
  }
  if (fullscreenSearch) {
    fullscreenSearch.placeholder = fullscreenTasteSignal
      ? `Filter within ${fullscreenTasteSignal.value}`
      : "Filter titles or years";
  }
  if (fullscreenJumpForm) fullscreenJumpForm.hidden = Boolean(fullscreenTasteSignal);
  if (fullscreenSub) {
    fullscreenSub.textContent = fullscreenTasteSignal
      ? `${entries.length} ${entries.length === 1 ? "movie" : "movies"}, preserving your overall order`
      : isFiltered
        ? `${entries.length} of ${count} ${count === 1 ? "movie" : "movies"}`
      : count
        ? `${count} ${count === 1 ? "movie" : "movies"}, top to bottom`
        : "No movies yet.";
  }
  if (fullscreenJump) {
    fullscreenJump.max = String(Math.max(1, count));
  }
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "fullscreen-empty";
    empty.textContent = isFiltered
      ? fullscreenTasteSignal
        ? "No movies in this lens match that filter."
        : "No movies match that filter."
      : "No movies yet.";
    fullscreenGrid.appendChild(empty);
    return;
  }
  entries.forEach(({ movie, index }) => {
    const card = document.createElement("div");
    card.className = "fullscreen-card";
    card.dataset.index = String(index);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open details for #${index + 1}, ${movie.title}`);
    card.setAttribute("aria-grabbed", "false");
    const poster = document.createElement("div");
    poster.className = "fullscreen-card__poster";
    if (movie.posterPath) {
      const img = document.createElement("img");
      img.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      img.alt = `${movie.title} poster`;
      img.loading = "lazy";
      poster.appendChild(img);
    } else {
      poster.classList.add("fullscreen-card__poster--empty");
      const label = document.createElement("span");
      label.textContent = movie.title;
      poster.appendChild(label);
    }
    const rank = document.createElement("span");
    rank.className = "fullscreen-card__rank";
    rank.textContent = String(index + 1);
    poster.appendChild(rank);
    const handle = document.createElement("span");
    handle.className = "fullscreen-card__drag-handle";
    handle.textContent = "≡";
    handle.setAttribute("aria-hidden", "true");
    poster.appendChild(handle);
    const title = document.createElement("div");
    title.className = "fullscreen-card__title";
    title.textContent = movie.title;
    const meta = document.createElement("div");
    meta.className = "fullscreen-card__meta";
    meta.textContent = movie.year ? String(movie.year) : "Year unknown";
    const actions = document.createElement("div");
    actions.className = "fullscreen-card__actions";
    const restack = document.createElement("button");
    restack.className = "fullscreen-card__action";
    restack.type = "button";
    restack.dataset.action = "restack";
    restack.textContent = "Re-rank";
    restack.setAttribute("aria-label", `Re-rank ${movie.title}`);
    const remove = document.createElement("button");
    remove.className = "fullscreen-card__action fullscreen-card__action--muted";
    remove.type = "button";
    remove.dataset.action = "remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${movie.title}`);
    actions.append(restack, remove);
    card.append(poster, title, meta, actions);
    fullscreenGrid.appendChild(card);
  });
  if (focusRankingIndex !== null) {
    const focusCard = fullscreenGrid.querySelector(
      `.fullscreen-card[data-index="${focusRankingIndex}"]`,
    );
    if (focusCard) {
      focusCard.focus({ preventScroll: true });
      focusCard.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
}

function openFullscreenRanking({ trigger = null } = {}) {
  if (!ranking.length || !fullscreenOverlay) return;
  fullscreenTrigger =
    trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  renderFullscreenRanking();
  lockShareScroll();
  fullscreenOverlay.hidden = false;
  if (fullscreenGrid) fullscreenGrid.scrollTop = 0;
  if (fullscreenSearch) fullscreenSearch.value = fullscreenFilterQuery;
  if (fullscreenSearchClear) fullscreenSearchClear.hidden = !fullscreenFilterQuery;
  if (fullscreenDensity) fullscreenDensity.value = fullscreenDensityMode;
  if (fullscreenClose) fullscreenClose.focus({ preventScroll: true });
}

function closeFullscreenRanking({ restoreFocus = true } = {}) {
  if (!fullscreenOverlay || fullscreenOverlay.hidden) return;
  cancelFullscreenDrag();
  fullscreenOverlay.hidden = true;
  unlockShareScroll();
  if (restoreFocus && fullscreenTrigger && document.contains(fullscreenTrigger)) {
    fullscreenTrigger.focus({ preventScroll: true });
  }
  fullscreenTrigger = null;
  fullscreenTasteSignal = null;
}

if (rankingExpand) {
  rankingExpand.addEventListener("click", () => {
    fullscreenTasteSignal = null;
    openFullscreenRanking({ trigger: rankingExpand });
  });
}
if (fullscreenClose) fullscreenClose.addEventListener("click", () => closeFullscreenRanking());
if (fullscreenOverlay) {
  fullscreenOverlay.addEventListener("click", (event) => {
    if (event.target === fullscreenOverlay) closeFullscreenRanking();
  });
}

if (fullscreenSearch) {
  fullscreenSearch.addEventListener("input", () => {
    fullscreenFilterQuery = fullscreenSearch.value;
    fullscreenSearchClear.hidden = !fullscreenFilterQuery;
    renderFullscreenRanking();
  });
  fullscreenSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !fullscreenFilterQuery) return;
    event.preventDefault();
    event.stopPropagation();
    fullscreenFilterQuery = "";
    fullscreenSearch.value = "";
    fullscreenSearchClear.hidden = true;
    renderFullscreenRanking();
  });
}

if (fullscreenSearchClear) {
  fullscreenSearchClear.addEventListener("click", () => {
    fullscreenFilterQuery = "";
    fullscreenSearch.value = "";
    fullscreenSearchClear.hidden = true;
    renderFullscreenRanking();
    fullscreenSearch.focus();
  });
}

if (fullscreenDensity) {
  fullscreenDensity.addEventListener("change", () => {
    fullscreenDensityMode = fullscreenDensity.value === "compact" ? "compact" : "comfortable";
    renderFullscreenRanking();
  });
}

if (fullscreenJumpForm) {
  fullscreenJumpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const rank = Number(fullscreenJump.value);
    if (!Number.isInteger(rank) || rank < 1 || rank > ranking.length) {
      fullscreenJump.setCustomValidity(`Enter a rank from 1 to ${ranking.length}.`);
      fullscreenJump.reportValidity();
      return;
    }
    fullscreenJump.setCustomValidity("");
    if (fullscreenFilterQuery) {
      fullscreenFilterQuery = "";
      fullscreenSearch.value = "";
      fullscreenSearchClear.hidden = true;
      renderFullscreenRanking();
    }
    const card = fullscreenGrid.querySelector(`.fullscreen-card[data-index="${rank - 1}"]`);
    if (card) {
      card.focus({ preventScroll: true });
      card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  });
}

if (fullscreenJump) {
  fullscreenJump.addEventListener("input", () => fullscreenJump.setCustomValidity(""));
}

const clearFullscreenDropMarker = () => {
  fullscreenCards().forEach((card) => {
    card.classList.remove("is-drop-before", "is-drop-after");
  });
};

function cancelFullscreenDrag() {
  const drag = fullscreenDrag;
  if (!drag) return;
  if (drag.captureEl?.releasePointerCapture && drag.pointerId !== null) {
    try {
      drag.captureEl.releasePointerCapture(drag.pointerId);
    } catch (error) {
      // Ignore missing pointer capture.
    }
  }
  drag.card?.classList.remove("is-dragging");
  drag.card?.setAttribute("aria-grabbed", "false");
  drag.ghost?.remove();
  clearFullscreenDropMarker();
  document.body.classList.remove("is-fullscreen-dragging");
  fullscreenDrag = null;
}

const startFullscreenDrag = (event) => {
  const drag = fullscreenDrag;
  if (!drag || drag.started) return;
  drag.started = true;
  const rect = drag.card.getBoundingClientRect();
  drag.offsetX = event.clientX - rect.left;
  drag.offsetY = event.clientY - rect.top;
  drag.ghost = drag.card.cloneNode(true);
  drag.ghost.classList.add("fullscreen-drag-ghost");
  drag.ghost.removeAttribute("tabindex");
  drag.ghost.style.width = `${rect.width}px`;
  drag.ghost.style.height = `${rect.height}px`;
  document.body.appendChild(drag.ghost);
  drag.card.classList.add("is-dragging");
  drag.card.setAttribute("aria-grabbed", "true");
  document.body.classList.add("is-fullscreen-dragging");
};

const updateFullscreenDrag = (event) => {
  const drag = fullscreenDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (!drag.started && distance < 6) return;
  event.preventDefault();
  startFullscreenDrag(event);
  drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
  drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;

  const cards = fullscreenCards().filter((card) => card !== drag.card);
  const rects = cards.map((card) => card.getBoundingClientRect());
  drag.targetIndex = gridDropIndex(rects, event.clientX, event.clientY);
  clearFullscreenDropMarker();
  if (cards.length) {
    if (drag.targetIndex <= 0) cards[0].classList.add("is-drop-before");
    else if (drag.targetIndex >= cards.length) cards.at(-1).classList.add("is-drop-after");
    else cards[drag.targetIndex].classList.add("is-drop-before");
  }

  const gridRect = fullscreenGrid.getBoundingClientRect();
  if (event.clientY < gridRect.top + 50) fullscreenGrid.scrollBy({ top: -16 });
  else if (event.clientY > gridRect.bottom - 50) fullscreenGrid.scrollBy({ top: 16 });
};

const finishFullscreenDrag = (event) => {
  const drag = fullscreenDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const wasStarted = drag.started;
  const fromIndex = drag.fromIndex;
  const targetIndex = drag.targetIndex;
  const movedMovie = ranking[fromIndex];
  if (wasStarted) {
    drag.card.dataset.dragged = "true";
    window.requestAnimationFrame(() => delete drag.card.dataset.dragged);
  }
  cancelFullscreenDrag();
  if (!wasStarted || !movedMovie || targetIndex === fromIndex) return;
  const beforeRanking = snapshotRanking();
  ranking = moveRankingItem(ranking, fromIndex, targetIndex);
  const nextIndex = ranking.findIndex((movie) => movieKey(movie) === movieKey(movedMovie));
  saveRanking();
  renderRanking();
  renderFullscreenRanking({ focusRankingIndex: nextIndex });
  updateSuggestions();
  renderPackSurfaces();
  setUndoableFeedback(`"${movedMovie.title}" moved to #${nextIndex + 1}.`, () =>
    restoreRankingTo(beforeRanking),
  );
};

if (fullscreenGrid) {
  fullscreenGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".fullscreen-card");
    if (!card || card.dataset.dragged === "true") return;
    const index = Number(card.dataset.index);
    if (!Number.isInteger(index) || !ranking[index]) return;
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "restack") {
      beginRankingRestack(index, { fromFullscreen: true });
      return;
    }
    if (action === "remove") {
      removeRankedMovie(index, { fromFullscreen: true });
      return;
    }
    openMovieDetail(ranking[index], { type: "ranked" }, card);
  });

  fullscreenGrid.addEventListener("keydown", (event) => {
    const card = event.target.closest(".fullscreen-card");
    if (!card || event.target.closest("button")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const index = Number(card.dataset.index);
      if (ranking[index]) openMovieDetail(ranking[index], { type: "ranked" }, card);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const cards = fullscreenCards();
    const currentIndex = cards.indexOf(card);
    const targetIndex = gridNavigationTarget({
      currentIndex,
      key: event.key,
      columnCount: fullscreenColumnCount(),
      itemCount: cards.length,
    });
    cards[targetIndex]?.focus({ preventScroll: true });
    cards[targetIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  fullscreenGrid.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || fullscreenFilterQuery.trim() || fullscreenTasteSignal) return;
    if (event.target.closest("button")) return;
    const card = event.target.closest(".fullscreen-card");
    if (!card) return;
    if (event.pointerType === "touch" && !event.target.closest(".fullscreen-card__drag-handle")) {
      return;
    }
    if (event.target.closest(".fullscreen-card__drag-handle")) event.preventDefault();
    card.setPointerCapture?.(event.pointerId);
    fullscreenDrag = {
      pointerId: event.pointerId,
      captureEl: card,
      card,
      fromIndex: Number(card.dataset.index),
      targetIndex: Number(card.dataset.index),
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      ghost: null,
    };
  });
  fullscreenGrid.addEventListener("pointermove", updateFullscreenDrag, { passive: false });
  fullscreenGrid.addEventListener("pointerup", finishFullscreenDrag);
  fullscreenGrid.addEventListener("pointercancel", cancelFullscreenDrag);
}

if (fullscreenOverlay) {
  fullscreenOverlay.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !detailOverlay.hidden) return;
    const focusable = Array.from(
      fullscreenOverlay.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ),
    ).filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
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
    packs: shareIncludePacks.checked,
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
    !shareOptions.packs &&
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

// The stored-ZIP writer (`createStoredZipBlob`) now lives in lib/zip.js, imported
// at the top so both the app and the Node test suite share one implementation.

const trackShareExport = (format) => {
  trackProductEvent("share_exported", {
    format,
    list_size: countBucket(ranking.length),
  });
};

async function downloadShareSvg() {
  if (!ranking.length) return;
  const images = buildShareImages({ ...shareOptions, externalPosters: true });
  if (images.mode === "set") {
    if (!images.cards.length) return;
    if (images.cards.length === 1) {
      const only = images.cards[0];
      downloadBlob(new Blob([only.svg], { type: "image/svg+xml;charset=utf-8" }), only.svgFilename);
      setAddFeedback("Share SVG downloaded.");
      trackShareExport("svg_single");
      return;
    }
    const encoder = new TextEncoder();
    const files = images.cards.map((card) => ({ name: card.svgFilename, bytes: encoder.encode(card.svg) }));
    downloadBlob(createStoredZipBlob(files), "stackrank-share-svg.zip");
    setAddFeedback(`Downloaded ${images.cards.length} share SVGs (zip).`);
    trackShareExport("svg_zip");
    return;
  }
  downloadBlob(new Blob([images.svg], { type: "image/svg+xml;charset=utf-8" }), "stackrank-movies.svg");
  setAddFeedback("Share SVG downloaded.");
  trackShareExport("svg");
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

// Whole-list "posters" rank badges are part of the base SVG, but the poster
// overlays are painted onto the canvas afterward and would cover them. Extract
// the badge geometry (translated by any ancestor <g transform>) so the PNG
// export can redraw them on top of the posters. Mirrors getSvgPosterOverlays.
function getSvgBadgeOverlays(svg) {
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
  return Array.from(documentSvg.querySelectorAll(".share-rank-badge"))
    .map((node) => {
      const offset = transformOffset(node);
      const num = (name) => Number(node.getAttribute(name));
      return {
        x: num("data-bx") + offset.x,
        y: num("data-by") + offset.y,
        width: num("data-bw"),
        height: num("data-bh"),
        rx: num("data-brx"),
        textX: num("data-tx") + offset.x,
        textY: num("data-ty") + offset.y,
        fontSize: num("data-fs"),
        fill: node.getAttribute("data-fill") || "#ffffff",
        fillOpacity: Number(node.getAttribute("data-fo")) || 1,
        stroke: node.getAttribute("data-stroke") || "#111111",
        textFill: node.getAttribute("data-text") || "#6b6b6b",
        label: node.getAttribute("data-label") || "",
      };
    })
    .filter((item) => item.label && Number.isFinite(item.x) && Number.isFinite(item.y));
}

function drawRoundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawBadgeOverlays(context, badges) {
  badges.forEach((badge) => {
    context.save();
    drawRoundedRectPath(context, badge.x, badge.y, badge.width, badge.height, badge.rx);
    context.globalAlpha = badge.fillOpacity;
    context.fillStyle = badge.fill;
    context.fill();
    context.globalAlpha = 1;
    context.lineWidth = 1.5;
    context.strokeStyle = badge.stroke;
    context.stroke();
    context.fillStyle = badge.textFill;
    context.font = `700 ${badge.fontSize}px Arial, Helvetica, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText(badge.label, badge.textX, badge.textY);
    context.restore();
  });
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
        // Redraw whole-list rank badges on top of the posters we just painted.
        drawBadgeOverlays(context, getSvgBadgeOverlays(baseSvg));
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

function pngFileFromBlob(blob, filename) {
  if (typeof File !== "undefined") {
    return new File([blob], filename, { type: "image/png" });
  }
  return blob;
}

async function renderShareSinglePngBlob({ preparePosters = true } = {}) {
  if (preparePosters) {
    await prepareSharePosterData(70);
  }
  const base = buildShareImages({ ...shareOptions, externalPosters: false });
  const proxy = buildShareImages({ ...shareOptions, externalPosters: true, posterProxy: true });
  return {
    blob: await renderShareSvgToPngBlob(base.svg, proxy.svg),
    filename: "stackrank-movies.png",
  };
}

async function renderShareSetPagePngBlob(index, { preparePosters = true } = {}) {
  if (preparePosters) {
    await prepareSharePosterData(Math.max(70, ranking.length));
  }
  const baseCards = buildShareImageSetPages({ ...shareOptions, externalPosters: false });
  const proxyCards = buildShareImageSetPages({ ...shareOptions, externalPosters: true, posterProxy: true });
  if (!baseCards.length) return null;
  const pageIndex = Math.min(Math.max(index, 0), baseCards.length - 1);
  shareExportStatus.textContent = `Preparing image ${pageIndex + 1} of ${baseCards.length}...`;
  return {
    blob: await renderShareSvgToPngBlob(baseCards[pageIndex].svg, (proxyCards[pageIndex] || baseCards[pageIndex]).svg),
    filename: baseCards[pageIndex].filename,
    pageIndex,
    total: baseCards.length,
  };
}

async function downloadCurrentShareSetPage() {
  if (!ranking.length || shareOptions.format !== "set") return;
  sharePngPreparing = true;
  updateShareStudio();
  try {
    const page = await renderShareSetPagePngBlob(shareSetPageIndex);
    sharePngPreparing = false;
    if (!page) return;
    downloadBlob(page.blob, page.filename);
    setAddFeedback(`Downloaded page ${page.pageIndex + 1}.`);
    shareExportStatus.textContent = `Downloaded page ${page.pageIndex + 1} of ${page.total}.`;
    trackShareExport("png_page");
    updateShareStudio();
  } catch (error) {
    sharePngPreparing = false;
    setAddFeedback("Could not create PNG.");
    shareExportStatus.textContent = "Could not create PNG.";
    updateShareStudio();
  }
}

async function shareNativePng({ currentPageOnly = false } = {}) {
  if (!ranking.length || !navigator.share) return;
  sharePngPreparing = true;
  updateShareStudio();
  try {
    let files = [];
    if (shareOptions.format === "set") {
      const cards = buildShareImageSetPages({ ...shareOptions, externalPosters: false });
      const shareAll = !currentPageOnly && cards.length > 1 && canNativeSharePngFiles(cards.length);
      const indexes = shareAll ? cards.map((_, index) => index) : [shareSetPageIndex];
      await prepareSharePosterData(Math.max(70, ranking.length));
      for (const index of indexes) {
        const page = await renderShareSetPagePngBlob(index, { preparePosters: false });
        if (page) files.push(pngFileFromBlob(page.blob, page.filename));
      }
    } else {
      const image = await renderShareSinglePngBlob();
      files = [pngFileFromBlob(image.blob, image.filename)];
    }

    if (!files.length || (navigator.canShare && !navigator.canShare({ files }))) {
      throw new Error("Native file sharing is not available for these images.");
    }
    await navigator.share(buildNativeImageShareData(files));
    sharePngPreparing = false;
    setAddFeedback(files.length > 1 ? "Share set opened." : "Share image opened.");
    shareExportStatus.textContent = files.length > 1 ? "Share set opened." : "Share image opened.";
    trackShareExport(files.length > 1 ? "native_set" : "native_single");
    updateShareStudio();
  } catch (error) {
    sharePngPreparing = false;
    if (error?.name === "AbortError") {
      shareExportStatus.textContent = "Share canceled.";
    } else {
      setAddFeedback("Could not open native share.");
      shareExportStatus.textContent = "Native share is not available here.";
    }
    updateShareStudio();
  }
}

async function downloadSharePng() {
  if (!ranking.length) return;
  sharePngPreparing = true;
  updateShareStudio();
  try {
    if (shareOptions.format === "set") {
      const baseCards = buildShareImageSetPages({ ...shareOptions, externalPosters: false });
      const pngFiles = [];
      await prepareSharePosterData(Math.max(70, ranking.length));
      for (let i = 0; i < baseCards.length; i += 1) {
        const page = await renderShareSetPagePngBlob(i, { preparePosters: false });
        if (page) {
          pngFiles.push({ name: page.filename, bytes: new Uint8Array(await page.blob.arrayBuffer()) });
        }
      }
      sharePngPreparing = false;
      if (pngFiles.length === 1) {
        // A single-card set is just one image — no point zipping it.
        downloadBlob(new Blob([pngFiles[0].bytes], { type: "image/png" }), pngFiles[0].name);
        setAddFeedback("Share image downloaded.");
        shareExportStatus.textContent = "Share image downloaded.";
      } else {
        shareExportStatus.textContent = "Packaging images into a zip...";
        downloadBlob(createStoredZipBlob(pngFiles), "stackrank-share-images.zip");
        setAddFeedback(`Downloaded ${pngFiles.length} share images (zip).`);
        shareExportStatus.textContent = `Downloaded ${pngFiles.length} share images (zip).`;
      }
      trackShareExport(pngFiles.length > 1 ? "png_zip" : "png_single");
      updateShareStudio();
      return;
    }

    const { blob } = await renderShareSinglePngBlob();
    sharePngPreparing = false;
    downloadBlob(blob, "stackrank-movies.png");
    setAddFeedback("Share PNG downloaded.");
    shareExportStatus.textContent = "Share PNG downloaded.";
    trackShareExport("png");
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
      trackShareExport(format);
      return;
    }
  } catch (error) {
    // Fall through to prompt.
  }
  window.prompt(`Copy ${format} export:`, payload);
  trackShareExport(format);
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
        apikey: SUPABASE_PUBLISHABLE_KEY,
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
    authSignInButton.hidden = true;
    authStatus.textContent = "Supabase is not configured.";
    updateRankingSettingsAuthUI();
    return;
  }

  // The only top-level auth control is "Sign in" when signed out; signed-in
  // account state and Sign out live in the settings popover.
  authSignInButton.hidden = Boolean(currentUser);
  authStatus.textContent = authNotice;
  // A fresh session means a sign-in just completed — dismiss the sign-in view.
  if (currentUser && signinOverlay && !signinOverlay.hidden) {
    closeSignIn({ restoreFocus: false });
  }
  updateRankingSettingsAuthUI();
};

// The element to refocus when the sign-in view closes (header or settings
// button), so keyboard users land back where they opened it from.
let signinReturnFocus = null;
let signinProviderSettingsPromise = null;

const setSignInStatus = (message, tone = "") => {
  signinStatus.textContent = message;
  signinStatus.classList.toggle("is-error", tone === "error");
};

const setSignInBusy = (busy) => {
  signinGoogleButton.disabled = busy;
  signinAppleButton.disabled = busy;
  signinMagicSend.disabled = busy;
  signinEmailInput.disabled = busy;
};

const setSignInProviderAvailability = (enabledProviders) => {
  const enabledIds = new Set(enabledProviders.map(({ provider }) => provider));
  signinGoogleButton.hidden = !enabledIds.has("google");
  signinAppleButton.hidden = !enabledIds.has("apple");
  const hasOAuthProvider = enabledIds.size > 0;
  signinProviders.hidden = !hasOAuthProvider;
  signinDivider.hidden = !hasOAuthProvider;
};

const loadSignInProviderAvailability = async () => {
  if (signinProviderSettingsPromise) return signinProviderSettingsPromise;
  signinProviderSettingsPromise = fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Supabase Auth settings returned ${response.status}.`);
      return response.json();
    })
    .then((settings) => {
      setSignInProviderAvailability(enabledOAuthProviders(settings));
    })
    .catch((error) => {
      // Magic-link sign-in remains fully usable if this optional discovery
      // request fails. Retry the next time the view opens.
      signinProviderSettingsPromise = null;
      setSignInProviderAvailability([]);
      console.warn("Could not load Supabase OAuth provider settings", error);
    });
  return signinProviderSettingsPromise;
};

function openSignIn({ trigger = authSignInButton } = {}) {
  if (!supabaseEnabled || !supabase) return;
  signinReturnFocus = trigger || authSignInButton;
  // Opening from the settings popover would otherwise leave it dangling behind
  // the modal.
  closeRankingSettings({ restoreFocus: false });
  setSignInStatus("");
  setSignInBusy(false);
  signinOverlay.hidden = false;
  document.body.classList.add("is-detail-open");
  const initialFocus = signinGoogleButton.hidden ? signinClose : signinGoogleButton;
  initialFocus.focus({ preventScroll: true });
  void loadSignInProviderAvailability();
}

function closeSignIn({ restoreFocus = true } = {}) {
  if (signinOverlay.hidden) return;
  signinOverlay.hidden = true;
  document.body.classList.remove("is-detail-open");
  setSignInBusy(false);
  if (restoreFocus && signinReturnFocus && !signinReturnFocus.hidden) {
    signinReturnFocus.focus({ preventScroll: true });
  }
  signinReturnFocus = null;
}

const handleMagicLinkSignIn = async () => {
  if (!supabaseEnabled || !supabase) return;
  authNotice = "";
  const email = normalizeAuthEmail(signinEmailInput.value);
  if (!isLikelyEmail(email)) {
    setSignInStatus("Enter a valid email address to receive a sign-in link.", "error");
    signinEmailInput.focus();
    return;
  }
  setSignInBusy(true);
  setSignInStatus("Sending your sign-in link...");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: signInRedirectUrl(window.location),
    },
  });
  if (error) {
    setSignInBusy(false);
    setSignInStatus(`Sign-in failed: ${error.message}`, "error");
    return;
  }
  signinEmailInput.value = "";
  setSignInBusy(false);
  setSignInStatus(`Check ${email} for your sign-in link.`);
};

const handleOAuthSignIn = async (provider) => {
  if (!supabaseEnabled || !supabase) return;
  authNotice = "";
  const config = AUTH_PROVIDERS.find((entry) => entry.provider === provider);
  const providerButton =
    provider === "google" ? signinGoogleButton : provider === "apple" ? signinAppleButton : null;
  if (!config || !providerButton || providerButton.hidden) return;
  setSignInBusy(true);
  setSignInStatus(`Redirecting to ${config.label.replace(/^Continue with /, "")}...`);
  // signInWithOAuth navigates the whole page to the provider, so a resolved
  // promise without an error simply means the redirect is underway. Only a
  // pre-redirect failure (misconfigured provider, network) comes back here.
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: signInRedirectUrl(window.location),
    },
  });
  if (error) {
    setSignInBusy(false);
    setSignInStatus(`Sign-in failed: ${error.message}`, "error");
  }
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
  pendingTelemetry = null;
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

  // The header "Sign in" opens the dedicated sign-in view (OAuth + magic link).
  authSignInButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openSignIn({ trigger: authSignInButton });
  });
};

// Sign-in view controls.
signinClose.addEventListener("click", () => closeSignIn());
signinOverlay.addEventListener("click", (event) => {
  // Click on the dimmed backdrop (not the sheet) dismisses the view.
  if (event.target === signinOverlay) closeSignIn();
});
signinOverlay.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = [...signinOverlay.querySelectorAll("button:not([hidden]):not(:disabled), input:not(:disabled)")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
signinGoogleButton.addEventListener("click", () => handleOAuthSignIn("google"));
signinAppleButton.addEventListener("click", () => handleOAuthSignIn("apple"));
signinMagicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleMagicLinkSignIn();
});

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
  const beforeQueues = snapshotQueues();
  removeMovieFromSuggestionQueues(storedMovie);
  if (target === "watch") {
    watchList.push(storedMovie);
  } else {
    notInterestedList.push(storedMovie);
  }
  persistSuggestionQueues();
  setUndoableFeedback(
    `"${movie.title}" moved to ${queueLabel(target)}.`,
    () => restoreQueuesTo(beforeQueues),
  );
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

const startRankingMovie = (movie, context = null, { scrollToPlacement } = {}) => {
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
  // Snapshot before the movie is pulled from its origin queue, so undo can put
  // it back exactly where it was.
  pendingRankingSnapshot = snapshotLists();
  captureComparisonReturnScroll();
  // Default to restoring the ingress scroll on settle; only an auto-pack run
  // (which immediately advances to the next comparison) or an explicit
  // scrollToPlacement caller (the homepage add form) wants the placement view.
  const isAutoPack = context?.type === "pack" && context.mode === "auto";
  scrollToPlacementOnSettle = scrollToPlacement ?? isAutoPack;
  pendingOrigin = getQueueOrigin(movie);
  pendingTelemetry = {
    source: rankingTelemetrySource(context, pendingOrigin),
  };
  trackProductEvent("ranking_started", {
    source: pendingTelemetry.source,
    list_size: countBucket(ranking.length),
  });
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
  const beforeQueues = snapshotQueues();
  removeMovieFromSuggestionQueues(movie);
  if (target === "watch") {
    watchList.push(movedMovie);
  } else {
    notInterestedList.push(movedMovie);
  }
  persistSuggestionQueues();
  setUndoableFeedback(
    `"${movie.title}" moved to ${queueLabel(target)}.`,
    () => restoreQueuesTo(beforeQueues),
  );
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
  const beforeQueues = snapshotQueues();
  if (source === "watch") {
    watchList = removeMovieFromList(watchList, movie);
  } else {
    notInterestedList = removeMovieFromList(notInterestedList, movie);
  }
  persistSuggestionQueues();
  setUndoableFeedback(
    `"${movie.title}" removed from ${queueLabel(source)}.`,
    () => restoreQueuesTo(beforeQueues),
  );
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
  if (movie) startRankingMovie(movie, { type: "queue", source });
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
  if (movie) startRankingMovie(movie, { type: "queue", source });
};

watchListEl.addEventListener("click", handleQueueInteraction);
notInterestedListEl.addEventListener("click", handleQueueInteraction);
watchListEl.addEventListener("keydown", handleQueueKeydown);
notInterestedListEl.addEventListener("keydown", handleQueueKeydown);
skipPackMovieButton.addEventListener("click", skipCurrentPackMovie);
packViewAll.addEventListener("click", () => openAllPacks());
packBrowserFilterToggle.addEventListener("click", () => {
  setPackBrowserFiltersExpanded(!packBrowserFiltersExpanded);
});
packBrowserSearch.addEventListener("input", () => {
  packBrowserFilterValues.query = packBrowserSearch.value;
  renderPackBrowser();
});
packBrowserSearchClear.addEventListener("click", () => {
  packBrowserFilterValues.query = "";
  packBrowserSearch.value = "";
  renderPackBrowser();
  packBrowserSearch.focus();
});
packBrowserCategory.addEventListener("change", () => {
  packBrowserFilterValues.category = packBrowserCategory.value;
  renderPackBrowser();
});
packBrowserStateOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-state]");
  if (!button || button.disabled) return;
  packBrowserFilterValues.state = button.dataset.state;
  renderPackBrowser();
});
packBrowserReset.addEventListener("click", () => {
  packBrowserSearch.blur();
  packBrowserFilterValues = { query: "", category: "all", state: "all" };
  packBrowserSearch.value = "";
  packBrowserCategory.value = "all";
  renderPackBrowser();
});
packDetailClose.addEventListener("click", () => handlePackDetailClose());
packDetailPrev.addEventListener("click", () => navigatePackDetail(-1));
packDetailNext.addEventListener("click", () => navigatePackDetail(1));
// Left/right arrows step through packs while viewing a pack detail opened from the
// All packs browser (mirrors the prev/next buttons).
document.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (packDetailOverlay.hidden || !packDetailFromAllPacks) return;
  if (packDetailOverlay.classList.contains("is-all-packs")) return;
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  event.preventDefault();
  navigatePackDetail(event.key === "ArrowRight" ? 1 : -1);
});
packDetailOverlay.addEventListener("click", (event) => {
  if (event.target === packDetailOverlay) {
    handlePackDetailClose();
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

// Tap the detail-pane poster to view the artwork full-res in the shared lightbox.
detailPoster.addEventListener("click", () => {
  if (currentDetail?.movie?.posterPath) openPosterLightbox(currentDetail.movie, detailPoster);
});

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
    if (context.type === "queue") {
      startRankingMovie(movie, { type: "queue", source: context.source });
    } else {
      startRankingFromSuggestion(movie, context.sectionKey || "unknown");
    }
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
  // The lightbox is modal while open: Escape closes it, arrows page an image set.
  if (!shareLightbox.hidden) {
    if (event.key === "Escape") {
      closeLightbox();
      return;
    }
    if (shareLightbox.classList.contains("is-set")) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        lightboxStep(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        lightboxStep(1);
        return;
      }
    }
    return;
  }
  if (event.key !== "Escape") return;
  if (!signinOverlay.hidden) {
    closeSignIn();
    return;
  }
  if (isReviewing()) {
    finishReview(false);
    return;
  }
  if (!titleImportOverlay.hidden) {
    closeTitleImport();
    return;
  }
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
  if (fullscreenOverlay && !fullscreenOverlay.hidden) {
    closeFullscreenRanking();
    return;
  }
  if (!packDetailOverlay.hidden) {
    handlePackDetailClose();
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
  // Release the autocomplete field before ranking starts. Waiting until the
  // placement handler is too late on some mobile/browser click sequences: the
  // suggestion activation can leave the field focused and reopen the keyboard.
  titleInput.blur();
  window.setTimeout(() => titleInput.blur(), 0);
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
  // Adding from the homepage form: scroll to where the movie lands in the list.
  startRankingMovie(movie, { type: "search" }, { scrollToPlacement: true });
};

const startRankingFromSuggestion = (movie, section = "unknown") => {
  startRankingMovie(movie, { type: "suggestion", section });
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
        apikey: SUPABASE_PUBLISHABLE_KEY,
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
    if (!ranking.length) {
      trackProductEvent("quick_start_shown", {
        list_size: countBucket(ranking.length),
        source: "quick_start",
      });
    }
    trackProductEvent("session_started", {
      list_size: countBucket(ranking.length),
      source: ranking.length ? "returning" : "empty",
    });
  }
};

initVercelWebAnalytics();
init();
