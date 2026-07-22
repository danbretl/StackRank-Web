import { createClient } from "./vendor/supabase-js-2.108.2.js?v=1";
import {
  categoryStorageKeys,
  resolveDocumentCategory,
} from "./lib/category.js?v=2";
import {
  DOGS_CATEGORY,
  DOG_LIST_TYPES,
  canonicalizeDogStoredState,
  dogArtworkObjectUrl,
  dogDragAutoScrollDelta,
  dogEntityToCandidate,
  dogStatusLabel,
  normalizeDogCatalogEntity,
} from "./lib/categories/dogs.js?v=9";
import {
  buildCatalogIndex,
  catalogFacetValues,
  normalizeCatalog,
  searchCatalog,
} from "./lib/catalog.js?v=1";
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
  normalizeCategoryListState,
  transitionCategoryEntity,
} from "./lib/category-lists.js?v=1";
import {
  categoryRankingStats,
  moveRankedEntity,
  recentRankedEntities,
  removeRankedEntity,
} from "./lib/category-ranking.js?v=1";
import {
  PROVIDER_PURPOSES,
  canProviderPurpose,
} from "./lib/provider-policy.js?v=1";
import {
  buildCategoryListRow,
  buildCategoryPackProgressRow,
  buildCategoryRankingRow,
  buildCategorySharedListRow,
  categoryItemPayloadFromRow,
  categoryListUpdatedAtState,
  categoryRemoteWriteSurfaces,
  categorySharedListUrl,
  categoryStatePayloadFromRow,
  categoryUserListId,
  generateCategoryShareSlug,
  mergeCategoryPlacementPayloads,
  mergeCategoryStatePayloads,
  normalizeCategorySharedPayload,
} from "./lib/category-remote-persistence.js?v=4";
import {
  AUTH_PROVIDERS,
  SIGN_OUT_LOCAL_DATA_MESSAGE,
  enabledOAuthProviders,
  isLikelyEmail,
  normalizeAuthEmail,
  signInRedirectUrl,
} from "./lib/auth.js?v=4";
import {
  buildDogTasteSignals,
  buildDogsBackup,
  dogsExportText,
  parseDogNameImport,
  parseDogsBackup,
} from "./lib/dogs.js?v=2";
import { buildReviewQueue } from "./lib/review.js?v=1";
import { createUndoController } from "./lib/undo.js?v=1";
import {
  createAppDestinationMemory,
  parseAppDestinationMemory,
} from "./lib/app-shell.js?v=4";

const ACTIVE_CATEGORY = resolveDocumentCategory(
  {
    marker: document.documentElement.dataset.stackrankCategory,
    pathname: window.location.pathname,
  },
  [DOGS_CATEGORY],
);
if (!ACTIVE_CATEGORY) throw new Error("Unknown or mismatched StackRank Dogs category");

const STORAGE_KEYS = categoryStorageKeys(ACTIVE_CATEGORY);
const CATALOG_URL = "data/dogs/dog-catalog.json?v=3";
const PACKS_URL = "data/dogs/packs.json?v=2";
const RIGHTS_URL = "data/dogs/image-rights.json?v=4";
const RIGHTS_POLICY_URL = "data/dogs/artwork-license-policy.json?v=1";
const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7GOGG6iSHMfax2YpOtqVqg_JIvcrBwl";
const AUTH_INIT_TIMEOUT_MS = 3200;
const TOAST_MS = 4200;
const UNDO_MS = 8000;
const STORAGE_FAILURE_MESSAGE = "Browser storage is unavailable. Your Dogs changes may be temporary; download a backup before leaving this page.";
const SEARCH_LIMIT = 14;
const LIST_OPTIONS = Object.freeze({ domain: "dogs", listTypes: DOG_LIST_TYPES });
const ALL_REMOTE_SURFACES = Object.freeze(["ranking", ...DOG_LIST_TYPES, "packProgress"]);
const localRemoteFixture =
  window.__STACKRANK_DOGS_REMOTE_FIXTURE__ === true &&
  ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) &&
  new URLSearchParams(window.location.search).get("e2e") === "dogs-remote-sync";
const DOGS_RUNTIME_POLICY = localRemoteFixture
  ? Object.freeze({
      ...DOGS_CATEGORY,
      capabilities: Object.freeze({
        ...DOGS_CATEGORY.capabilities,
        accountSync: true,
        publicSnapshots: true,
      }),
    })
  : DOGS_CATEGORY;
const accountSyncEnabled = canProviderPurpose(
  DOGS_RUNTIME_POLICY,
  PROVIDER_PURPOSES.ACCOUNT_SYNC,
);
const publicSnapshotsEnabled = canProviderPurpose(
  DOGS_RUNTIME_POLICY,
  PROVIDER_PURPOSES.PUBLIC_SNAPSHOT,
);
const supabase = accountSyncEnabled || publicSnapshotsEnabled
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clone = (value) => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const cleanText = (value) => String(value || "").trim();

const searchForm = $("#dogs-search-form");
const searchInput = $("#dogs-search");
const suggestionsEl = $("#dogs-suggestions");
const catalogStatus = $("#dogs-catalog-status");
const recentSection = $("#dogs-recent-section");
const recentEl = $("#dogs-recent");
const featuredPacksEl = $("#dogs-featured-packs");
const discoveryFallback = $("#dogs-discovery-fallback");
const browseSection = $("#dogs-browse-section");
const browseRail = $("#dogs-browse-rail");
const rankingEl = $("#dogs-ranking");
const rankingEmpty = $("#dogs-ranking-empty");
const rankingSubtitle = $("#dogs-ranking-subtitle");
const comparisonEl = $("#dogs-comparison");
const comparisonProgress = $("#dogs-comparison-progress");
const newChoiceEl = $("#dogs-new-choice");
const existingChoiceEl = $("#dogs-existing-choice");
const undoChoiceButton = $("#dogs-undo-choice");
const reviewEl = $("#dogs-review");
const reviewProgress = $("#dogs-review-progress");
const reviewFirst = $("#dogs-review-first");
const reviewSecond = $("#dogs-review-second");
const settings = $("#dogs-settings");
const settingsToggle = $("#dogs-settings-toggle");
const toast = $("#dogs-toast");
const toastMessage = $("#dogs-toast-message");
const toastAction = $("#dogs-toast-action");
const liveRegion = $("#dogs-live-region");
const detailDialog = $("#dogs-detail");
const detailContent = $("#dogs-detail-content");
const packsDialog = $("#dogs-packs-dialog");
const hiddenDialog = $("#dogs-hidden-dialog");
const backupDialog = $("#dogs-backup-dialog");
const exportDialog = $("#dogs-export-dialog");
const signInDialog = $("#dogs-signin-dialog");
const accountState = $("#dogs-account-state");
const signInButton = $("#dogs-sign-in");
const signOutButton = $("#dogs-sign-out");
const remoteGateNote = $("#dogs-remote-gate-note");
const signInProviders = $("#dogs-signin-providers");
const signInGoogle = $("#dogs-signin-google");
const signInApple = $("#dogs-signin-apple");
const signInEmail = $("#dogs-signin-email");
const signInEmailForm = $("#dogs-signin-email-form");
const signInSend = $("#dogs-signin-send");
const signInStatus = $("#dogs-signin-status");
const publicShare = $("#dogs-public-share");
const sharePublish = $("#dogs-share-publish");
const shareUpdate = $("#dogs-share-update");
const shareCopy = $("#dogs-share-copy");
const shareRevoke = $("#dogs-share-revoke");
const shareLinkCard = $("#dogs-share-link-card");
const shareLinkUrl = $("#dogs-share-link-url");
const shareStatus = $("#dogs-share-status");

let ranking = [];
let lists = { curious: [], not_for_me: [] };
let packProgress = {};
let preferences = {
  rankingView: "detailed",
  statusFilter: "",
  regionFilter: "",
  imageOnly: false,
};
let storageAvailable = true;
let stateUpdatedAt = {
  ranking: null,
  lists: { curious: null, not_for_me: null },
  packProgress: null,
};
let currentUser = null;
let authNotice = "";
let authSubscription = null;
let signInProviderPromise = null;
let remoteWriteChain = Promise.resolve();
let remoteLoadPromise = null;
let remoteLoadListId = "";
let remoteReadyListId = "";
let deferredRemoteSave = null;
let catalogReadyPromise = null;
let remoteSyncUnavailable = false;
const emptyShareLinkState = () => ({
  loaded: false,
  loading: false,
  busy: false,
  slug: "",
  updatedAt: null,
  revoked: false,
});
let shareLinkState = emptyShareLinkState();

let catalogDocument = null;
let normalizedCatalog = null;
let catalogIndex = null;
let catalogById = new Map();
let catalogItemById = new Map();
let catalogLoadError = null;
let packs = [];
let rightsPolicy = null;
let rightsLedger = null;
let rightsAssets = [];
let rightsByAssetId = new Map();
let rightsByCatalogId = new Map();

let searchResults = [];
let activeSuggestionIndex = -1;
let browseOffset = 0;
let rankSession = null;
let rankHistory = [];
let rankOrigin = null;
let reviewSession = null;
let toastTimer = null;
let toastUndoToken = null;
let importMatches = [];
let activeDetailId = "";
let dragState = null;
const undoController = createUndoController();

const DOG_CATALOG_ADAPTER = Object.freeze({
  domain: "dogs",
  entityType: "breed",
  source: "vbo",
  getSnapshot(record) {
    const entity = normalizeDogCatalogEntity(record);
    if (!entity) return null;
    return {
      primaryText: entity.displayName,
      secondaryText: [entity.originRegions[0], dogStatusLabel(entity.status)].filter(Boolean).join(" · "),
      year: null,
      image: { url: "", alt: `${entity.displayName} dog`, assetId: "" },
    };
  },
  getFacets(record) {
    const refs = Array.isArray(record?.registryRefs) ? record.registryRefs : [];
    return {
      status: [record?.status],
      region: record?.originRegions || [],
      registry: refs.map((ref) => typeof ref === "string"
        ? ref.split(":", 1)[0]
        : ref?.scheme),
    };
  },
});

const stateSnapshot = () => clone({ ranking, lists, packProgress, preferences });
const sameEntityOrder = (left, right) =>
  left.length === right.length &&
  left.every((item, index) => entityRefKey(item) === entityRefKey(right[index]));
const changedEntitySurfaces = (before, after) => {
  const changed = [];
  if (!sameEntityOrder(before.ranking, after.ranking)) changed.push("ranking");
  DOG_LIST_TYPES.forEach((listType) => {
    if (!sameEntityOrder(before.lists[listType], after.lists[listType])) changed.push(listType);
  });
  return changed;
};
const changedPersistedSurfaces = (before, after) => {
  const changed = changedEntitySurfaces(before, after);
  if (JSON.stringify(before.packProgress) !== JSON.stringify(after.packProgress)) {
    changed.push("packProgress");
  }
  return changed;
};

const showToast = (message, { undoSnapshot = null, duration = TOAST_MS } = {}) => {
  if (!storageAvailable && message !== STORAGE_FAILURE_MESSAGE) {
    message = STORAGE_FAILURE_MESSAGE;
    duration = Math.max(duration, 6500);
  }
  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toastAction.hidden = true;
  toastUndoToken = null;
  if (undoSnapshot) {
    toastUndoToken = undoController.set({
      label: message,
      ttlMs: UNDO_MS,
      restore: () => {
        const beforeUndo = stateSnapshot();
        ranking = undoSnapshot.ranking;
        lists = undoSnapshot.lists;
        packProgress = undoSnapshot.packProgress;
        preferences = undoSnapshot.preferences;
        saveAll({
          changedSurfaces: changedPersistedSurfaces(beforeUndo, undoSnapshot),
        });
        renderAll();
      },
    });
    toastAction.hidden = false;
    duration = UNDO_MS;
  }
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toastAction.hidden = true;
  }, duration);
};

const dismissToast = () => {
  window.clearTimeout(toastTimer);
  toast.hidden = true;
  toastAction.hidden = true;
  toastUndoToken = null;
  undoController.clear();
};

const announce = (message) => {
  liveRegion.textContent = "";
  requestAnimationFrame(() => { liveRegion.textContent = message; });
};

const storageError = () => {
  storageAvailable = false;
  showToast(STORAGE_FAILURE_MESSAGE, { duration: 6500 });
};

const normalizeStoredRanking = (items) => {
  const result = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = createRankedEntity(item);
    const key = entityRefKey(normalized);
    if (!normalized || normalized.entityRef.domain !== "dogs" || seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
};

const loadJsonStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
};

const loadState = () => {
  try {
    const rankedPayload = parseRankedListPayload(localStorage.getItem(STORAGE_KEYS.ranking));
    const queuesPayload = loadJsonStorage(STORAGE_KEYS.queues, {});
    const normalized = normalizeCategoryListState({
      ranking: normalizeStoredRanking(rankedPayload.items),
      lists: {
        curious: normalizeStoredRanking(queuesPayload.curious),
        not_for_me: normalizeStoredRanking(queuesPayload.not_for_me),
      },
    }, LIST_OPTIONS);
    ranking = normalized.ranking;
    lists = normalized.lists;
    stateUpdatedAt.ranking = rankedPayload.updated_at || null;
    stateUpdatedAt.lists = categoryListUpdatedAtState(queuesPayload, {
      listTypes: DOG_LIST_TYPES,
    });
    const progressPayload = loadJsonStorage(STORAGE_KEYS.packProgress, {});
    packProgress = progressPayload.state && typeof progressPayload.state === "object"
      ? progressPayload.state
      : {};
    stateUpdatedAt.packProgress = typeof progressPayload.updated_at === "string"
      ? progressPayload.updated_at
      : null;
    const viewPayload = loadJsonStorage(STORAGE_KEYS.rankingView, {});
    preferences = {
      rankingView: ["detailed", "photos", "compact"].includes(viewPayload.rankingView)
        ? viewPayload.rankingView
        : "detailed",
      statusFilter: cleanText(viewPayload.statusFilter),
      regionFilter: cleanText(viewPayload.regionFilter),
      imageOnly: viewPayload.imageOnly === true,
    };
  } catch (_error) {
    ranking = [];
    lists = { curious: [], not_for_me: [] };
    packProgress = {};
    storageError();
  }
};

const persist = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    storageError();
    return false;
  }
};

const localPayloadSnapshot = () => ({
  ranking: { items: clone(ranking), updated_at: stateUpdatedAt.ranking },
  lists: {
    curious: { items: clone(lists.curious), updated_at: stateUpdatedAt.lists.curious },
    not_for_me: { items: clone(lists.not_for_me), updated_at: stateUpdatedAt.lists.not_for_me },
  },
  packProgress: { state: clone(packProgress), updated_at: stateUpdatedAt.packProgress },
});

const saveAll = ({
  syncRemote = true,
  mergeRemote = false,
  updatedAt = new Date().toISOString(),
  changedSurfaces = ["ranking", "queues", "packProgress"],
} = {}) => {
  const changed = new Set(changedSurfaces);
  const nextListUpdatedAt = Object.fromEntries(DOG_LIST_TYPES.map((listType) => [
    listType,
    changed.has("queues") || changed.has(listType)
      ? updatedAt
      : stateUpdatedAt.lists[listType],
  ]));
  stateUpdatedAt = {
    ranking: changed.has("ranking") ? updatedAt : stateUpdatedAt.ranking,
    lists: nextListUpdatedAt,
    packProgress: changed.has("packProgress") ? updatedAt : stateUpdatedAt.packProgress,
  };
  const queuesUpdatedAt = Object.values(stateUpdatedAt.lists).filter(Boolean).sort().at(-1) || null;
  const results = [
    persist(STORAGE_KEYS.ranking, serializeRankedListPayload(ranking, stateUpdatedAt.ranking)),
    persist(STORAGE_KEYS.queues, JSON.stringify({
      ...lists,
      updated_at: queuesUpdatedAt,
      list_updated_at: stateUpdatedAt.lists,
    })),
    persist(STORAGE_KEYS.packProgress, JSON.stringify({
      state: packProgress,
      updated_at: stateUpdatedAt.packProgress,
    })),
    persist(STORAGE_KEYS.rankingView, JSON.stringify(preferences)),
  ];
  if (syncRemote && changed.size && accountSyncEnabled && currentUser && supabase) {
    queueRemoteSave(localPayloadSnapshot(), {
      mergeRemote,
      changedSurfaces: categoryRemoteWriteSurfaces([...changed], { listTypes: DOG_LIST_TYPES }),
    });
  }
  return results.every(Boolean);
};

const savePreferences = () =>
  persist(STORAGE_KEYS.rankingView, JSON.stringify(preferences));

const withTimeout = (promise, timeoutMs, message) => {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timer));
};

const setRemoteUnavailable = (message, error) => {
  if (!remoteSyncUnavailable) showToast(message, { duration: 6500 });
  remoteSyncUnavailable = true;
  authNotice = "Account sync is temporarily unavailable. This device copy is still current.";
  if (error) console.warn(message, error);
  updateAccountUi();
};

const readRemoteStateRows = (listId) => Promise.all([
  supabase
    .from("category_rankings")
    .select("list_id,category,items,updated_at")
    .eq("list_id", listId)
    .eq("category", ACTIVE_CATEGORY.id)
    .maybeSingle(),
  supabase
    .from("category_lists")
    .select("list_id,category,list_type,items,updated_at")
    .eq("list_id", listId)
    .eq("category", ACTIVE_CATEGORY.id)
    .in("list_type", DOG_LIST_TYPES),
  supabase
    .from("category_pack_progress")
    .select("list_id,category,state,updated_at")
    .eq("list_id", listId)
    .eq("category", ACTIVE_CATEGORY.id)
    .maybeSingle(),
]);

const payloadsFromRemoteRows = (results, listId, local) => {
  const rankingPayload = categoryItemPayloadFromRow(results[0].data, {
    category: ACTIVE_CATEGORY.id,
    listId,
  });
  const remoteLists = Array.isArray(results[1].data) ? results[1].data : [];
  const remoteListPayloads = Object.fromEntries(DOG_LIST_TYPES.map((listType) => {
    const row = remoteLists.find((candidate) => candidate?.list_type === listType);
    return [listType, categoryItemPayloadFromRow(row, {
      category: ACTIVE_CATEGORY.id,
      listId,
      listType,
    })];
  }));
  const mergedPlacements = mergeCategoryPlacementPayloads({
    ranking: [local.ranking, rankingPayload],
    lists: Object.fromEntries(DOG_LIST_TYPES.map((listType) => [listType, [
      local.lists[listType],
      remoteListPayloads[listType],
    ]])),
  }, { category: ACTIVE_CATEGORY.id, listTypes: DOG_LIST_TYPES });
  const mergedRanking = mergedPlacements.ranking;
  const mergedLists = mergedPlacements.lists;
  const remoteProgress = categoryStatePayloadFromRow(results[2].data, {
    category: ACTIVE_CATEGORY.id,
    listId,
  });
  const mergedProgress = mergeCategoryStatePayloads([
    local.packProgress,
    remoteProgress,
  ], { category: ACTIVE_CATEGORY.id });
  const normalized = normalizeCategoryListState({
    ranking: mergedRanking.items,
    lists: {
      curious: mergedLists.curious.items,
      not_for_me: mergedLists.not_for_me.items,
    },
  }, LIST_OPTIONS);
  const canonical = catalogDocument?.entities?.length
    ? canonicalizeDogStoredState(normalized, catalogDocument.entities)
    : normalized;
  return {
    ranking: { ...mergedRanking, items: canonical.ranking },
    lists: {
      curious: { ...mergedLists.curious, items: canonical.lists.curious },
      not_for_me: { ...mergedLists.not_for_me, items: canonical.lists.not_for_me },
    },
    packProgress: mergedProgress,
    remapped: canonical.remapped || 0,
  };
};

const syncRemoteSnapshot = async (
  snapshot,
  expectedListId,
  { mergeRemote = true, changedSurfaces = ALL_REMOTE_SURFACES } = {},
) => {
  const listId = categoryUserListId(currentUser?.id);
  if (
    !accountSyncEnabled ||
    !supabase ||
    !listId ||
    !expectedListId ||
    listId !== expectedListId
  ) return;
  const writeSurfaces = new Set(categoryRemoteWriteSurfaces(changedSurfaces, {
    listTypes: DOG_LIST_TYPES,
  }));
  if (!writeSurfaces.size) return;
  let merged = snapshot;
  if (mergeRemote) {
    let remoteResults;
    try {
      remoteResults = await readRemoteStateRows(listId);
    } catch (error) {
      if (categoryUserListId(currentUser?.id) !== expectedListId) return;
      setRemoteUnavailable("Could not reconcile Dogs before syncing. Your device copy is still saved.", error);
      return;
    }
    if (categoryUserListId(currentUser?.id) !== expectedListId) return;
    const remoteError = remoteResults.find((result) => result?.error)?.error;
    if (remoteError) {
      setRemoteUnavailable(
        "Could not reconcile Dogs before syncing. Your device copy is still saved.",
        remoteError,
      );
      return;
    }
    merged = payloadsFromRemoteRows(remoteResults, listId, snapshot);
  }
  const updatedAt = new Date().toISOString();
  const rankingRow = writeSurfaces.has("ranking")
    ? buildCategoryRankingRow({
        listId,
        category: ACTIVE_CATEGORY.id,
        items: merged.ranking.items,
        updatedAt,
      })
    : null;
  const listRows = DOG_LIST_TYPES.filter((listType) => writeSurfaces.has(listType))
    .map((listType) => buildCategoryListRow({
    listId,
    category: ACTIVE_CATEGORY.id,
    listType,
    items: merged.lists[listType]?.items,
    updatedAt,
  }));
  const packRow = writeSurfaces.has("packProgress")
    ? buildCategoryPackProgressRow({
        listId,
        category: ACTIVE_CATEGORY.id,
        state: merged.packProgress.state,
        updatedAt,
      })
    : null;
  if (
    (writeSurfaces.has("ranking") && !rankingRow) ||
    listRows.some((row) => !row) ||
    (writeSurfaces.has("packProgress") && !packRow)
  ) {
    setRemoteUnavailable(
      "This Dogs snapshot is too large or malformed to sync. Your device copy is still saved.",
    );
    return;
  }
  let results;
  try {
    const operations = [];
    if (rankingRow) operations.push(supabase.from("category_rankings").upsert(rankingRow, {
        onConflict: "list_id,category",
      }));
    if (listRows.length) operations.push(supabase.from("category_lists").upsert(listRows, {
        onConflict: "list_id,category,list_type",
      }));
    if (packRow) operations.push(supabase.from("category_pack_progress").upsert(packRow, {
        onConflict: "list_id,category",
      }));
    results = await Promise.all(operations);
  } catch (error) {
    if (categoryUserListId(currentUser?.id) !== expectedListId) return;
    setRemoteUnavailable("Could not sync Dogs right now. Your device copy is still saved.", error);
    return;
  }
  if (categoryUserListId(currentUser?.id) !== expectedListId) return;
  const error = results.find((result) => result?.error)?.error;
  if (error) {
    setRemoteUnavailable("Could not sync Dogs right now. Your device copy is still saved.", error);
    return;
  }
  remoteSyncUnavailable = false;
  authNotice = "";
  updateAccountUi();
};

const queueRemoteSave = (snapshot, options = {}) => {
  const expectedListId = categoryUserListId(currentUser?.id);
  if (
    expectedListId &&
    remoteReadyListId !== expectedListId &&
    options.initialReconciliation !== true
  ) {
    const previousSurfaces = deferredRemoteSave?.listId === expectedListId
      ? deferredRemoteSave.options.changedSurfaces || []
      : [];
    deferredRemoteSave = {
      listId: expectedListId,
      snapshot,
      options: {
        ...options,
        changedSurfaces: [...new Set([
          ...previousSurfaces,
          ...(options.changedSurfaces || []),
        ])],
      },
    };
    return Promise.resolve();
  }
  remoteWriteChain = remoteWriteChain
    .catch(() => undefined)
    .then(() => syncRemoteSnapshot(snapshot, expectedListId, options));
  return remoteWriteChain;
};

const canonicalizeCurrentCatalogState = ({ announceUpgrade = false, persistUpgrade = true } = {}) => {
  if (!catalogDocument?.entities?.length) return { changed: false, remapped: 0, deduplicated: 0 };
  const upgraded = canonicalizeDogStoredState({ ranking, lists }, catalogDocument.entities);
  ranking = upgraded.ranking;
  lists = upgraded.lists;
  if (upgraded.changed && persistUpgrade) {
    saveAll({ syncRemote: false, changedSurfaces: [] });
  }
  if (announceUpgrade && upgraded.remapped) {
    showToast(
      `Updated ${upgraded.remapped} saved breed reference${upgraded.remapped === 1 ? "" : "s"} to the current catalog.`,
    );
  }
  return upgraded;
};

const performRemoteStateLoad = async () => {
  const listId = categoryUserListId(currentUser?.id);
  if (!accountSyncEnabled || !supabase || !listId) return;
  let results;
  try {
    results = await readRemoteStateRows(listId);
  } catch (error) {
    setRemoteUnavailable("Could not load synced Dogs. Showing this device copy.", error);
    return;
  }
  const error = results.find((result) => result?.error)?.error;
  if (error) {
    setRemoteUnavailable("Could not load synced Dogs. Showing this device copy.", error);
    return;
  }
  if (categoryUserListId(currentUser?.id) !== listId) return;
  const local = localPayloadSnapshot();

  const merged = payloadsFromRemoteRows(results, listId, local);
  if (categoryUserListId(currentUser?.id) !== listId) return;
  ranking = merged.ranking.items;
  lists = {
    curious: merged.lists.curious.items,
    not_for_me: merged.lists.not_for_me.items,
  };
  packProgress = merged.packProgress.state;
  stateUpdatedAt = {
    ranking: merged.ranking.updated_at || stateUpdatedAt.ranking,
    lists: Object.fromEntries(DOG_LIST_TYPES.map((listType) => [
      listType,
      merged.lists[listType].updated_at || stateUpdatedAt.lists[listType],
    ])),
    packProgress: merged.packProgress.updated_at || stateUpdatedAt.packProgress,
  };
  saveAll({ syncRemote: false, changedSurfaces: [] });
  await queueRemoteSave(localPayloadSnapshot(), {
    mergeRemote: false,
    changedSurfaces: ALL_REMOTE_SURFACES,
    initialReconciliation: true,
  });
  if (categoryUserListId(currentUser?.id) !== listId) return;
  remoteReadyListId = listId;
  if (deferredRemoteSave?.listId === listId) {
    const pending = deferredRemoteSave;
    deferredRemoteSave = null;
    await queueRemoteSave(localPayloadSnapshot(), pending.options);
  }
  if (categoryUserListId(currentUser?.id) !== listId) return;
  renderAll();
  const appended = merged.ranking.appendedItems.length + merged.remapped;
  if (appended) {
    showToast(
      `${appended} breed${appended === 1 ? "" : "s"} merged from another saved copy ${appended === 1 ? "was" : "were"} kept in your ranking. Review the order when convenient.`,
      { duration: 8000 },
    );
  }
};

const loadRemoteState = () => {
  const requestedListId = categoryUserListId(currentUser?.id);
  if (!requestedListId) return Promise.resolve();
  if (remoteLoadPromise) {
    if (remoteLoadListId === requestedListId) return remoteLoadPromise;
    return remoteLoadPromise.catch(() => undefined).then(() =>
      categoryUserListId(currentUser?.id) === requestedListId
        ? loadRemoteState()
        : undefined);
  }
  remoteLoadListId = requestedListId;
  const wrapped = performRemoteStateLoad().finally(() => {
    if (remoteLoadPromise !== wrapped) return;
    remoteLoadPromise = null;
    remoteLoadListId = "";
  });
  remoteLoadPromise = wrapped;
  return wrapped;
};

const closeSettings = () => {
  settings.hidden = true;
  settingsToggle.setAttribute("aria-expanded", "false");
};

const showDialog = (dialog) => {
  closeSettings();
  if (typeof dialog?.showModal === "function" && !dialog.open) dialog.showModal();
};

const activeDestination = () => $(".dogs-view:not([hidden])")?.dataset.view || "rank";

const showDestination = (destination, { restoreScroll = true } = {}) => {
  const next = ["rank", "ranking", "you"].includes(destination) ? destination : "rank";
  $$(".dogs-view").forEach((view) => { view.hidden = view.dataset.view !== next; });
  $$("[data-destination]").forEach((button) => {
    if (!button.closest(".dogs-nav")) return;
    if (button.dataset.destination === next) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  try {
    sessionStorage.setItem(STORAGE_KEYS.appDestination, JSON.stringify(createAppDestinationMemory(next)));
  } catch (_error) {
    // Destination memory is convenience only.
  }
  closeSettings();
  if (restoreScroll) window.scrollTo({ top: 0, behavior: "instant" });
};

const assetObjectUrl = (asset, role = "card") => {
  const variants = Array.isArray(asset?.delivery?.variants) ? asset.delivery.variants : [];
  const variant = variants.find((entry) => entry.role === role) || variants[0];
  return dogArtworkObjectUrl(variant?.objectPath, {
    publicBaseUrl: rightsLedger?.publicAssetBaseUrl,
    storagePrefix: rightsLedger?.storagePrefix,
  });
};

const approvedImageForCatalogId = (
  catalogId,
  role = "card",
  purpose = PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY,
) => {
  const candidates = rightsByCatalogId.get(catalogId) || [];
  const asset = candidates.find((entry) => canProviderPurpose(
    DOGS_RUNTIME_POLICY,
    purpose,
    { asset: entry, rightsPolicy },
  ) && assetObjectUrl(entry, role));
  if (!asset) return null;
  return {
    assetId: asset.assetId,
    url: assetObjectUrl(asset, role),
    alt: `${catalogById.get(catalogId)?.displayName || "Dog breed"} dog`,
    asset,
  };
};

const candidateForCatalogId = (catalogId, role = "card") => {
  const entity = catalogById.get(catalogId);
  if (!entity) return null;
  return dogEntityToCandidate(entity, approvedImageForCatalogId(catalogId, role));
};

const displayItem = (item, role = "card") => {
  const current = candidateForCatalogId(item?.entityRef?.id, role);
  const safeStoredItem = {
    ...item,
    snapshot: {
      ...item?.snapshot,
      image: {
        url: "",
        alt: cleanText(item?.snapshot?.image?.alt),
        assetId: "",
      },
    },
  };
  if (!current) return safeStoredItem;
  return {
    ...safeStoredItem,
    snapshot: {
      ...safeStoredItem.snapshot,
      secondaryText: current.snapshot.secondaryText || safeStoredItem.snapshot.secondaryText,
      image: current.snapshot.image,
    },
    catalog: current.catalog,
  };
};

const createDogMedia = (item, role = "card") => {
  const shown = displayItem(item, role);
  const wrapper = document.createElement("span");
  wrapper.className = "dog-media is-missing";
  const fallback = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  fallback.setAttribute("viewBox", "0 0 96 82");
  fallback.setAttribute("aria-hidden", "true");
  fallback.innerHTML = '<path d="M27 61c-2-14 1-29 10-40L30 9c-2-3 0-7 4-6l16 6c7-2 15-2 22 1L85 5c4-1 6 3 4 7l-8 13c6 10 8 22 5 35-2 10-10 17-21 18H47c-11-1-18-7-20-17Z"/><path d="M42 43h.1M70 43h.1M48 58c5 4 11 4 16 0"/>';
  wrapper.appendChild(fallback);
  const url = cleanText(shown?.snapshot?.image?.url);
  if (url) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = shown.snapshot.image.alt || `${shown.snapshot.primaryText} dog`;
    image.loading = role === "detail" ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => wrapper.classList.remove("is-missing"), { once: true });
    image.addEventListener("error", () => image.remove(), { once: true });
    wrapper.appendChild(image);
  }
  return wrapper;
};

const appendArtworkCredit = (container, asset, displayName = "") => {
  const name = cleanText(displayName) || catalogById.get(asset?.catalogId)?.displayName || "Dog breed";
  const credit = document.createElement("span");
  credit.textContent = `Photo for ${name}: ${asset?.attribution || asset?.creator || "Creator recorded"}`;
  const source = document.createElement("a");
  source.href = asset.sourcePage;
  source.target = "_blank";
  source.rel = "noreferrer";
  source.textContent = "Source";
  const license = document.createElement("a");
  license.href = asset.licenseUrl;
  license.target = "_blank";
  license.rel = "noreferrer";
  license.textContent = asset.license || "License";
  const modifications = (Array.isArray(asset?.modifications) ? asset.modifications : [])
    .filter((value) => value !== "none")
    .join(", ");
  container.append(credit, " · ", source, " · ", license);
  if (modifications) container.append(` · Modified: ${modifications}.`);
};

const handledLocation = (id) => {
  const key = `dogs:breed:vbo:${id}`;
  if (ranking.some((item) => entityRefKey(item) === key)) return "ranking";
  if (lists.curious.some((item) => entityRefKey(item) === key)) return "curious";
  if (lists.not_for_me.some((item) => entityRefKey(item) === key)) return "not_for_me";
  return "";
};

const packItems = (pack) => (Array.isArray(pack?.items) ? pack.items : [])
  .map((id) => candidateForCatalogId(id))
  .filter(Boolean);

const packStats = (pack) => {
  const items = packItems(pack);
  const handled = items.filter((item) => handledLocation(item.entityRef.id)).length;
  return { total: items.length, handled, remaining: items.length - handled, complete: items.length > 0 && handled === items.length };
};

const reconcilePackProgress = () => {
  packs.forEach((pack) => {
    const stats = packStats(pack);
    const entry = packProgress[pack.id] || {};
    if (stats.complete && !entry.completedAt) {
      packProgress[pack.id] = { ...entry, completedAt: new Date().toISOString(), versionSeen: 1 };
    } else if (!stats.complete && entry.completedAt) {
      packProgress[pack.id] = { ...entry, completedAt: null };
    }
  });
};

const createBreedTile = (item, { showContext = true } = {}) => {
  const candidate = displayItem(item);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "breed-tile";
  const location = handledLocation(candidate.entityRef.id);
  button.disabled = location === "ranking";
  button.setAttribute("aria-label", location === "ranking"
    ? `${candidate.snapshot.primaryText} is already ranked`
    : `Rank ${candidate.snapshot.primaryText}`);
  const title = document.createElement("strong");
  title.textContent = candidate.snapshot.primaryText;
  const context = document.createElement("span");
  context.textContent = location
    ? location === "curious" ? "Curious about" : location === "not_for_me" ? "Not for me" : "Ranked"
    : candidate.snapshot.secondaryText;
  button.append(createDogMedia(candidate), title);
  if (showContext) button.append(context);
  button.addEventListener("click", () => beginRanking(candidate));
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openDetail(candidate.entityRef.id);
  });
  return button;
};

const renderRecent = () => {
  const recent = recentRankedEntities(ranking, 3);
  recentEl.replaceChildren();
  recentSection.hidden = recent.length === 0;
  recent.forEach(({ item, rank }) => {
    const shown = displayItem(item);
    const article = document.createElement("article");
    article.className = "recent-item";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "recent-item__copy";
    const name = document.createElement("strong");
    name.textContent = shown.snapshot.primaryText;
    const meta = document.createElement("span");
    meta.textContent = shown.snapshot.secondaryText || "Breed or type";
    copy.append(name, meta);
    copy.addEventListener("click", () => openDetail(shown.entityRef.id));
    const rankLabel = document.createElement("b");
    rankLabel.textContent = `#${rank}`;
    article.append(createDogMedia(shown), copy, rankLabel);
    recentEl.appendChild(article);
  });
};

const featuredPackSelection = () => {
  const starters = packs.filter((pack) => pack.placements?.includes("starter"));
  if (starters.length >= 3) return starters.slice(0, 3);
  return [...starters, ...packs.filter((pack) => !starters.includes(pack) && pack.placements?.includes("featured"))].slice(0, 3);
};

const renderFeaturedPacks = () => {
  featuredPacksEl.replaceChildren();
  const selected = featuredPackSelection();
  if (!selected.length) {
    if (!catalogLoadError && catalogIndex) {
      const samples = searchCatalog(catalogIndex, "", { limit: 9 }).map((result) => candidateForCatalogId(result.item.entityRef.id)).filter(Boolean);
      if (samples.length) {
        selected.push({ id: "catalog-gateway", title: "Catalog gateway", subtitle: "A varied place to begin", family: "gateway", items: samples.map((item) => item.entityRef.id), placements: ["starter"] });
      }
    }
  }
  selected.forEach((pack) => {
    const section = document.createElement("section");
    section.className = "featured-pack";
    const heading = document.createElement("div");
    heading.className = "featured-pack__heading";
    const title = document.createElement("h3");
    title.textContent = pack.title;
    const family = document.createElement("span");
    family.textContent = cleanText(pack.subtitle || pack.family);
    heading.append(title, family);
    const rail = document.createElement("div");
    rail.className = "featured-pack__rail";
    packItems(pack).slice(0, 3).forEach((item) => rail.append(createBreedTile(item)));
    const stats = packStats(pack);
    const footer = document.createElement("div");
    footer.className = "featured-pack__footer";
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = stats.handled ? `Continue ${pack.title} →` : `Explore ${pack.title} →`;
    action.addEventListener("click", () => startPack(pack.id));
    const progress = document.createElement("span");
    progress.className = "featured-pack__progress";
    progress.textContent = stats.complete ? "Complete" : stats.handled ? `${stats.handled}/${stats.total} handled` : `${stats.total} breeds`;
    footer.append(action, progress);
    section.append(heading, rail, footer);
    featuredPacksEl.appendChild(section);
  });
  discoveryFallback.hidden = !catalogLoadError;
};

const renderBrowse = () => {
  browseRail.replaceChildren();
  if (!catalogIndex) {
    browseSection.hidden = true;
    return;
  }
  const editorialIds = [...new Set(packs.flatMap((pack) => pack.items || []))];
  const available = editorialIds
    .map((id) => candidateForCatalogId(id))
    .filter((item) => item && !handledLocation(item.entityRef.id));
  browseSection.hidden = available.length === 0;
  if (!available.length) return;
  const count = Math.min(8, available.length);
  for (let offset = 0; offset < count; offset += 1) {
    browseRail.append(createBreedTile(available[(browseOffset + offset) % available.length]));
  }
};

const renderSearchResults = (results) => {
  searchResults = results
    .map((result) => ({ ...result, candidate: candidateForCatalogId(result.item.entityRef.id) }))
    .filter((result) => result.candidate);
  suggestionsEl.replaceChildren();
  if (!searchResults.length) {
    suggestionsEl.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-activedescendant", "");
    activeSuggestionIndex = -1;
    return;
  }
  searchResults.forEach((result, index) => {
    const option = document.createElement("li");
    option.id = `dogs-suggestion-${index}`;
    option.className = "search-option";
    option.role = "option";
    option.tabIndex = -1;
    option.setAttribute("aria-selected", "false");
    const media = createDogMedia(result.candidate);
    media.classList.add("search-option__media");
    const copy = document.createElement("span");
    copy.className = "search-option__copy";
    const name = document.createElement("strong");
    name.textContent = result.candidate.snapshot.primaryText;
    const context = document.createElement("span");
    context.textContent = result.candidate.snapshot.secondaryText || "Breed or type";
    copy.append(name, context);
    if (result.matchedOn === "alias") {
      const alias = document.createElement("span");
      alias.className = "search-option__alias";
      alias.textContent = `Alias: ${result.matchedText}`;
      copy.append(alias);
    }
    const meta = document.createElement("span");
    meta.className = "search-option__meta";
    meta.textContent = handledLocation(result.candidate.entityRef.id)
      ? "Already handled"
      : dogStatusLabel(result.candidate.catalog.status);
    option.append(media, copy, meta);
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => beginRanking(result.candidate));
    suggestionsEl.appendChild(option);
  });
  suggestionsEl.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  selectSearchResult(0);
};

const closeSearchResults = () => {
  suggestionsEl.hidden = true;
  suggestionsEl.replaceChildren();
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.setAttribute("aria-activedescendant", "");
  searchResults = [];
  activeSuggestionIndex = -1;
};

const selectSearchResult = (index) => {
  if (!searchResults.length) return;
  activeSuggestionIndex = Math.max(0, Math.min(searchResults.length - 1, index));
  $$(".search-option", suggestionsEl).forEach((option, optionIndex) =>
    option.setAttribute("aria-selected", String(optionIndex === activeSuggestionIndex)));
  const active = $$(".search-option", suggestionsEl)[activeSuggestionIndex];
  searchInput.setAttribute("aria-activedescendant", active?.id || "");
  active?.scrollIntoView({ block: "nearest" });
};

const runLocalSearch = () => {
  const query = searchInput.value.trim();
  if (!catalogIndex || query.length < 2) {
    closeSearchResults();
    return;
  }
  renderSearchResults(searchCatalog(catalogIndex, query, { limit: SEARCH_LIMIT }));
};

const rankingFilterActive = () => Boolean(preferences.statusFilter || preferences.regionFilter || preferences.imageOnly);

const filteredRanking = () => ranking
  .map((item, index) => ({ item, index, entity: catalogById.get(item.entityRef.id) }))
  .filter(({ item, entity }) => {
    if (preferences.statusFilter && entity?.status !== preferences.statusFilter) return false;
    if (preferences.regionFilter && !(entity?.originRegions || []).includes(preferences.regionFilter)) return false;
    if (preferences.imageOnly && !approvedImageForCatalogId(item.entityRef.id)) return false;
    return true;
  });

const rankingActionButton = (label, action, text, disabled = false, className = "") => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.disabled = disabled;
  if (className) button.className = className;
  return button;
};

const renderRanking = () => {
  rankingEl.replaceChildren();
  rankingEl.dataset.rankingView = preferences.rankingView;
  rankingEmpty.hidden = ranking.length > 0;
  rankingEl.hidden = ranking.length === 0;
  const visible = filteredRanking();
  rankingSubtitle.textContent = ranking.length
    ? `${ranking.length} breed${ranking.length === 1 ? "" : "s"} and type${ranking.length === 1 ? "" : "s"}, in your exact order${visible.length !== ranking.length ? ` · ${visible.length} shown` : ""}.`
    : "No breeds ranked yet.";
  $("#dogs-review-order").disabled = ranking.length < 2;
  rankingEl.classList.toggle("is-filtered", rankingFilterActive());
  $("#dogs-filter-note").hidden = !rankingFilterActive();

  visible.forEach(({ item, index }) => {
    const shown = displayItem(item);
    const row = document.createElement("li");
    row.className = "ranking-row";
    row.dataset.key = entityRefKey(item);
    row.dataset.index = String(index);
    const rank = document.createElement("span");
    rank.className = "ranking-row__rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("span");
    copy.className = "ranking-row__copy";
    const name = document.createElement("strong");
    name.textContent = shown.snapshot.primaryText;
    const context = document.createElement("span");
    context.textContent = shown.snapshot.secondaryText || "Breed or type";
    const aliases = document.createElement("span");
    aliases.className = "ranking-row__aliases";
    const raw = catalogById.get(item.entityRef.id);
    aliases.textContent = raw?.aliases?.length ? `Also: ${raw.aliases.slice(0, 3).join(", ")}` : `VBO ${item.entityRef.id.replace("VBO:", "")}`;
    copy.append(name, context, aliases);
    const actions = document.createElement("div");
    actions.className = "ranking-row__actions";
    actions.append(
      rankingActionButton(`Move ${shown.snapshot.primaryText}`, "move", "↕", rankingFilterActive(), "move-handle"),
      rankingActionButton(`Details for ${shown.snapshot.primaryText}`, "detail", "i"),
      rankingActionButton(`Move ${shown.snapshot.primaryText} up`, "up", "↑", index === 0 || rankingFilterActive()),
      rankingActionButton(`Move ${shown.snapshot.primaryText} down`, "down", "↓", index === ranking.length - 1 || rankingFilterActive()),
      rankingActionButton(`Remove ${shown.snapshot.primaryText}`, "remove", "×"),
    );
    row.append(rank, createDogMedia(shown), copy, actions);
    rankingEl.appendChild(row);
  });
};

const fillFilterOptions = () => {
  const statusSelect = $("#dogs-status-filter");
  const regionSelect = $("#dogs-region-filter");
  const selectedStatus = preferences.statusFilter;
  const selectedRegion = preferences.regionFilter;
  statusSelect.replaceChildren(new Option("All statuses", ""));
  catalogFacetValues(catalogIndex, "status").forEach(({ value, count }) =>
    statusSelect.append(new Option(`${dogStatusLabel(value)} (${count})`, value)));
  regionSelect.replaceChildren(new Option("All regions", ""));
  catalogFacetValues(catalogIndex, "region").forEach(({ value, count }) =>
    regionSelect.append(new Option(`${value} (${count})`, value)));
  statusSelect.value = selectedStatus;
  regionSelect.value = selectedRegion;
  regionSelect.disabled = regionSelect.options.length === 1;
  $("#dogs-image-filter").checked = preferences.imageOnly;
};

const createSecondaryItem = (item, listType) => {
  const shown = displayItem(item);
  const row = document.createElement("article");
  row.className = "secondary-item";
  const copy = document.createElement("span");
  copy.className = "secondary-item__copy";
  const name = document.createElement("strong");
  name.textContent = shown.snapshot.primaryText;
  const context = document.createElement("span");
  context.textContent = shown.snapshot.secondaryText;
  copy.append(name, context);
  const actions = document.createElement("div");
  actions.className = "secondary-item__actions";
  const rankButton = document.createElement("button");
  rankButton.type = "button";
  rankButton.textContent = "Rank";
  rankButton.addEventListener("click", () => beginRanking(shown));
  const otherButton = document.createElement("button");
  otherButton.type = "button";
  otherButton.textContent = listType === "curious" ? "Not for me" : "Curious";
  otherButton.addEventListener("click", () => transitionItem(shown, listType === "curious" ? "not_for_me" : "curious"));
  const infoButton = document.createElement("button");
  infoButton.type = "button";
  infoButton.textContent = "Info";
  infoButton.addEventListener("click", () => openDetail(shown.entityRef.id));
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => transitionItem(shown, null));
  actions.append(rankButton, otherButton, infoButton, removeButton);
  row.append(createDogMedia(shown), copy, actions);
  return row;
};

const renderLists = () => {
  const curiousEl = $("#dogs-curious-list");
  const hiddenEl = $("#dogs-hidden-list");
  curiousEl.replaceChildren(...lists.curious.map((item) => createSecondaryItem(item, "curious")));
  hiddenEl.replaceChildren(...lists.not_for_me.map((item) => createSecondaryItem(item, "not_for_me")));
  $("#dogs-curious-empty").hidden = lists.curious.length > 0;
  $("#dogs-hidden-empty").hidden = lists.not_for_me.length > 0;
};

const catalogWithPackTags = () => {
  const map = new Map([...catalogById].map(([id, entity]) => [id, { ...entity, tags: [...(entity.tags || [])] }]));
  packs.forEach((pack) => {
    const signal = cleanText(pack.tasteTag || (pack.family && !["gateway", "registry-group"].includes(pack.family) ? pack.family.replace(/-/g, " ") : ""));
    if (!signal) return;
    (pack.items || []).forEach((id) => {
      const entity = map.get(id);
      if (entity && !entity.tags.includes(signal)) entity.tags.push(signal);
    });
  });
  return map;
};

const renderYou = () => {
  const stats = categoryRankingStats(ranking);
  $("#dogs-stat-count").textContent = String(stats.count);
  $("#dogs-stat-top").textContent = stats.top?.snapshot?.primaryText || "—";
  $("#dogs-stat-comparisons").textContent = String(stats.totalComparisons);
  $("#dogs-stat-curious").textContent = String(lists.curious.length);
  const signals = ranking.length >= 5 ? buildDogTasteSignals(ranking, catalogWithPackTags()) : [];
  const signalsEl = $("#dogs-taste-signals");
  signalsEl.replaceChildren();
  signals.forEach((signal) => {
    const article = document.createElement("article");
    article.className = "taste-signal";
    const kind = document.createElement("span");
    kind.textContent = signal.kind === "registry" ? "Named registry scheme" : signal.kind === "region" ? "Catalog region" : "Curated catalog family";
    const value = document.createElement("strong");
    value.textContent = signal.value;
    const evidence = document.createElement("p");
    evidence.textContent = `Seen in ${signal.items.length} ranked entries, weighted toward the top of your list.`;
    article.append(kind, value, evidence);
    signalsEl.appendChild(article);
  });
  $("#dogs-taste-empty").hidden = signals.length > 0;
  renderLists();
};

const renderAll = () => {
  reconcilePackProgress();
  renderRecent();
  renderFeaturedPacks();
  renderBrowse();
  renderRanking();
  renderYou();
};

const transitionItem = (item, destination) => {
  const before = stateSnapshot();
  const transition = transitionCategoryEntity(
    { ranking, lists },
    { entity: item, to: destination },
    LIST_OPTIONS,
  );
  if (!transition.changed) return;
  ranking = transition.state.ranking;
  lists = transition.state.lists;
  saveAll({ changedSurfaces: changedEntitySurfaces(before, { ranking, lists }) });
  renderAll();
  const label = destination === "curious"
    ? `${item.snapshot.primaryText} saved to Curious about.`
    : destination === "not_for_me"
      ? `${item.snapshot.primaryText} moved to Not for me.`
      : `${item.snapshot.primaryText} removed.`;
  showToast(label, { undoSnapshot: before });
  detailDialog.close();
};

const comparisonCardContent = (item) => {
  const shown = displayItem(item, "detail");
  const fragment = document.createDocumentFragment();
  fragment.append(createDogMedia(shown, "detail"));
  const copy = document.createElement("span");
  copy.className = "comparison-card__copy";
  const name = document.createElement("strong");
  name.textContent = shown.snapshot.primaryText;
  const context = document.createElement("span");
  context.textContent = shown.snapshot.secondaryText || "Breed or type";
  const indicator = document.createElement("b");
  indicator.textContent = "Choose";
  copy.append(name, context, indicator);
  fragment.append(copy);
  return fragment;
};

const renderComparison = () => {
  if (!rankSession || rankSession.status !== "comparing") return;
  const existing = ranking[rankSession.comparisonIndex];
  if (!existing) {
    cancelRanking();
    return;
  }
  const estimated = Math.ceil(Math.log2(ranking.length + 1)) + 1;
  comparisonProgress.textContent = `Choice ${rankSession.comparisons + 1} of about ${estimated}`;
  newChoiceEl.replaceChildren(comparisonCardContent(rankSession.item));
  existingChoiceEl.replaceChildren(comparisonCardContent(existing));
  newChoiceEl.setAttribute("aria-label", `Rank ${rankSession.item.snapshot.primaryText} higher`);
  existingChoiceEl.setAttribute("aria-label", `Rank ${existing.snapshot.primaryText} higher`);
  undoChoiceButton.hidden = rankHistory.length === 0;
  comparisonEl.hidden = false;
  document.body.classList.add("is-comparing");
};

const settleRanking = (session) => {
  const before = stateSnapshot();
  const inserted = insertSettledRankSession(ranking, session, (item, meta) => createRankedEntity({
    entityRef: item.entityRef,
    snapshot: item.snapshot,
    rankedAt: new Date().toISOString(),
    comparisons: meta.comparisons,
  }));
  if (!inserted) {
    cancelRanking();
    showToast("The ranking changed before this breed could be placed. Try again.");
    return;
  }
  const normalized = normalizeCategoryListState({ ranking: inserted, lists }, LIST_OPTIONS);
  ranking = normalized.ranking;
  lists = normalized.lists;
  const placed = session.item.snapshot.primaryText;
  const placedRank = session.insertionIndex + 1;
  const origin = rankOrigin;
  rankSession = null;
  rankHistory = [];
  rankOrigin = null;
  comparisonEl.hidden = true;
  document.body.classList.remove("is-comparing");
  searchInput.value = "";
  searchInput.blur();
  closeSearchResults();
  saveAll({ changedSurfaces: changedEntitySurfaces(before, { ranking, lists }) });
  renderAll();
  showToast(`${placed} is #${placedRank}.`, { undoSnapshot: before });
  if (origin) {
    showDestination(origin.destination, { restoreScroll: false });
    requestAnimationFrame(() => window.scrollTo({ top: origin.scrollY, behavior: "instant" }));
  }
};

function beginRanking(item) {
  const candidate = candidateForCatalogId(item?.entityRef?.id) || item;
  const normalized = createRankedEntity(candidate);
  if (!normalized) return;
  if (isDuplicateEntity(ranking, normalized)) {
    showToast(`${normalized.snapshot.primaryText} is already in your ranking.`);
    showDestination("ranking");
    return;
  }
  dismissToast();
  closeSearchResults();
  searchInput.blur();
  rankOrigin = { destination: activeDestination(), scrollY: window.scrollY };
  rankHistory = [];
  rankSession = createRankSession({ item: normalized, rankingLength: ranking.length });
  if (rankSession.status === "settled") settleRanking(rankSession);
  else renderComparison();
}

const handleChoice = (newItemWins) => {
  if (!rankSession || rankSession.status !== "comparing") return;
  rankHistory.push(clone(rankSession));
  rankSession = advanceRankSession(rankSession, newItemWins);
  if (rankSession.status === "settled") settleRanking(rankSession);
  else renderComparison();
};

const undoLastChoice = () => {
  const previous = rankHistory.pop();
  if (!previous) return;
  rankSession = previous;
  renderComparison();
  announce("Last comparison choice undone.");
};

function cancelRanking() {
  const origin = rankOrigin;
  rankSession = null;
  rankHistory = [];
  rankOrigin = null;
  comparisonEl.hidden = true;
  document.body.classList.remove("is-comparing");
  searchInput.blur();
  if (origin) {
    showDestination(origin.destination, { restoreScroll: false });
    requestAnimationFrame(() => window.scrollTo({ top: origin.scrollY, behavior: "instant" }));
  }
  showToast("Ranking canceled. Your lists were not changed.");
}

const startReview = () => {
  if (ranking.length < 2) return;
  reviewSession = {
    queue: buildReviewQueue(ranking, { max: 8 }),
    cursor: 0,
    before: stateSnapshot(),
    changed: false,
  };
  document.body.classList.add("is-reviewing");
  reviewEl.hidden = false;
  renderReview();
};

const renderReview = () => {
  if (!reviewSession) return;
  if (reviewSession.cursor >= reviewSession.queue.length) {
    endReview();
    return;
  }
  const pairIndex = reviewSession.queue[reviewSession.cursor];
  reviewProgress.textContent = `Pair ${reviewSession.cursor + 1} of ${reviewSession.queue.length}`;
  reviewFirst.replaceChildren(comparisonCardContent(ranking[pairIndex]));
  reviewSecond.replaceChildren(comparisonCardContent(ranking[pairIndex + 1]));
};

const advanceReview = (swap) => {
  if (!reviewSession) return;
  const pairIndex = reviewSession.queue[reviewSession.cursor];
  if (swap) {
    [ranking[pairIndex], ranking[pairIndex + 1]] = [ranking[pairIndex + 1], ranking[pairIndex]];
    reviewSession.changed = true;
    saveAll({ changedSurfaces: ["ranking"] });
  }
  reviewSession.cursor += 1;
  renderReview();
};

function endReview() {
  if (!reviewSession) return;
  const session = reviewSession;
  reviewSession = null;
  reviewEl.hidden = true;
  document.body.classList.remove("is-reviewing");
  renderAll();
  showToast(session.changed ? "Review complete. Your swaps were saved." : "Review ended with no changes.", {
    undoSnapshot: session.changed ? session.before : null,
  });
}

const performRankingMove = (key, toIndex, label) => {
  if (rankingFilterActive()) return;
  const before = stateSnapshot();
  const result = moveRankedEntity(ranking, key, toIndex);
  if (!result.changed) return;
  ranking = result.items;
  saveAll({ changedSurfaces: ["ranking"] });
  renderAll();
  announce(`${result.item.snapshot.primaryText} moved to rank ${result.toIndex + 1}.`);
  showToast(label || `${result.item.snapshot.primaryText} moved.`, { undoSnapshot: before });
};

const removeFromRanking = (key) => {
  const result = removeRankedEntity(ranking, key);
  if (!result.changed) return;
  if (!window.confirm(`Remove ${result.item.snapshot.primaryText} from your Dogs ranking?`)) return;
  const before = stateSnapshot();
  ranking = result.items;
  saveAll({ changedSurfaces: ["ranking"] });
  renderAll();
  showToast(`${result.item.snapshot.primaryText} removed from the ranking.`, { undoSnapshot: before });
};

function openDetail(catalogId) {
  const entity = catalogById.get(catalogId);
  const fallbackItem = [...ranking, ...lists.curious, ...lists.not_for_me].find((item) => item.entityRef.id === catalogId);
  const candidate = candidateForCatalogId(catalogId, "detail") || fallbackItem;
  if (!candidate) return;
  activeDetailId = catalogId;
  const shown = displayItem(candidate, "detail");
  detailContent.replaceChildren();
  const layout = document.createElement("div");
  layout.className = "detail-layout";
  const copy = document.createElement("div");
  copy.className = "detail-copy";
  const title = document.createElement("h1");
  title.textContent = shown.snapshot.primaryText;
  const status = document.createElement("p");
  status.className = "detail-copy__status";
  status.textContent = entity ? dogStatusLabel(entity.status) : "Saved breed or type";
  const note = document.createElement("p");
  note.textContent = "Rank this by personal affection or interest—not as a prediction about an individual dog or household fit.";
  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const location = handledLocation(catalogId);
  const addAction = (text, handler, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener("click", handler);
    actions.appendChild(button);
  };
  addAction(location === "ranking" ? "Ranked" : "Rank this breed", () => {
    detailDialog.close();
    beginRanking(shown);
  }, location === "ranking");
  addAction(location === "curious" ? "Saved to Curious" : "Curious about", () => transitionItem(shown, "curious"), location === "curious");
  addAction(location === "not_for_me" ? "In Not for me" : "Not for me", () => transitionItem(shown, "not_for_me"), location === "not_for_me");
  const facts = document.createElement("div");
  facts.className = "detail-facts";
  const addFact = (label, value) => {
    if (!cleanText(value)) return;
    const fact = document.createElement("div");
    fact.className = "detail-fact";
    const key = document.createElement("span");
    key.textContent = label;
    const content = document.createElement("strong");
    content.textContent = value;
    fact.append(key, content);
    facts.appendChild(fact);
  };
  addFact("Catalog identity", catalogId);
  addFact("Catalog version", catalogDocument?.catalogVersion || "Unavailable");
  addFact("Aliases", entity?.aliases?.slice(0, 12).join(", "));
  addFact("Registry references", entity?.registryRefs?.slice(0, 12).map((ref) => typeof ref === "string" ? ref : `${ref.scheme}: ${ref.group}`).join(", "));
  addFact("Origin regions", entity?.originRegions?.join(", "));
  addFact("Parent concept", entity?.relationships?.parentId);
  const image = approvedImageForCatalogId(catalogId, "detail");
  const attribution = document.createElement("p");
  attribution.className = "detail-attribution";
  if (image?.asset) {
    appendArtworkCredit(attribution, image.asset, shown.snapshot.primaryText);
  } else {
    attribution.textContent = "No rights-approved display photo is available yet. Catalog inclusion never depends on image availability.";
  }
  copy.append(title, status, note, actions, facts, attribution);
  layout.append(createDogMedia(shown, "detail"), copy);
  detailContent.appendChild(layout);
  showDialog(detailDialog);
}

const renderCredits = () => {
  activeDetailId = "";
  const approvedAssets = rightsAssets.filter((asset) => canProviderPurpose(
    DOGS_CATEGORY,
    PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY,
    { asset, rightsPolicy },
  ) && assetObjectUrl(asset, "detail"));
  const approved = approvedAssets.length;
  detailContent.innerHTML = "";
  const heading = document.createElement("div");
  heading.className = "dialog-heading";
  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = "Catalog & photo credits";
  const title = document.createElement("h1");
  title.textContent = "Dogs sources";
  const summary = document.createElement("p");
  summary.textContent = `${catalogDocument?.entities?.length || 0} selectable concepts from the pinned VBO ${catalogDocument?.source?.release || "release"}. ${approved} rights-approved display photo${approved === 1 ? "" : "s"} currently delivered; missing imagery uses a neutral fallback.`;
  const source = document.createElement("p");
  source.className = "detail-attribution";
  source.innerHTML = "Catalog: Vertebrate Breed Ontology, CC BY 4.0. Every source descendant has an auditable disposition in the generated coverage report. Photo credits appear on each detail view; public and raster sharing remain disabled unless their separate rights gates pass.";
  heading.append(label, title, summary, source);
  detailContent.appendChild(heading);
  if (approvedAssets.length) {
    const photoHeading = document.createElement("h2");
    photoHeading.textContent = "Delivered photo credits";
    const credits = document.createElement("ul");
    credits.className = "artwork-credit-list";
    approvedAssets
      .sort((left, right) =>
        (catalogById.get(left.catalogId)?.displayName || left.catalogId)
          .localeCompare(catalogById.get(right.catalogId)?.displayName || right.catalogId))
      .forEach((asset) => {
        const item = document.createElement("li");
        appendArtworkCredit(item, asset);
        credits.appendChild(item);
      });
    detailContent.append(photoHeading, credits);
  }
  showDialog(detailDialog);
};

const startPack = (packId) => {
  const pack = packs.find((entry) => entry.id === packId);
  if (!pack) return;
  const before = stateSnapshot();
  packProgress[pack.id] = {
    ...(packProgress[pack.id] || {}),
    startedAt: packProgress[pack.id]?.startedAt || new Date().toISOString(),
    versionSeen: 1,
  };
  const next = packItems(pack).find((item) => !handledLocation(item.entityRef.id));
  saveAll({ changedSurfaces: ["packProgress"] });
  renderAll();
  if (packsDialog.open) packsDialog.close();
  if (next) beginRanking(next);
  else showToast(`${pack.title} is complete.`, { undoSnapshot: before });
};

const renderPackBrowser = () => {
  const query = cleanText($("#dogs-pack-search").value).toLocaleLowerCase();
  const family = $("#dogs-pack-family").value;
  const visible = packs.filter((pack) => {
    if (family && pack.family !== family) return false;
    if (!query) return true;
    const names = packItems(pack).map((item) => item.snapshot.primaryText).join(" ");
    return [pack.title, pack.subtitle, pack.description, names].join(" ").toLocaleLowerCase().includes(query);
  });
  const browser = $("#dogs-pack-browser");
  browser.replaceChildren();
  visible.forEach((pack) => {
    const card = document.createElement("article");
    card.className = "pack-card";
    const title = document.createElement("h2");
    title.textContent = pack.title;
    const description = document.createElement("p");
    description.textContent = pack.description || pack.subtitle;
    const rail = document.createElement("div");
    rail.className = "pack-card__rail";
    packItems(pack).slice(0, 4).forEach((item) => rail.append(createBreedTile(item, { showContext: false })));
    const stats = packStats(pack);
    const actions = document.createElement("div");
    actions.className = "pack-card__actions";
    const status = document.createElement("span");
    status.textContent = stats.complete ? "Complete" : `${stats.handled}/${stats.total} handled`;
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = stats.complete ? "Review breeds" : stats.handled ? "Continue" : "Start pack";
    start.addEventListener("click", () => startPack(pack.id));
    actions.append(status, start);
    card.append(title, description, rail, actions);
    browser.appendChild(card);
  });
};

const openPackBrowser = () => {
  const familySelect = $("#dogs-pack-family");
  const selected = familySelect.value;
  familySelect.replaceChildren(new Option("All families", ""));
  [...new Set(packs.map((pack) => pack.family).filter(Boolean))].sort()
    .forEach((family) => familySelect.append(new Option(family.replace(/-/g, " "), family)));
  familySelect.value = selected;
  renderPackBrowser();
  showDialog(packsDialog);
};

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const downloadBackup = () => {
  const backup = buildDogsBackup({ ranking, lists, packProgress, preferences });
  downloadBlob(`${JSON.stringify(backup, null, 2)}\n`, `stackrank-dogs-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  showToast("Dogs backup downloaded.");
};

const restoreBackup = async (file) => {
  try {
    const backup = parseDogsBackup(await file.text());
    if (!backup) throw new Error("invalid Dogs backup");
    const restoredRanking = normalizeStoredRanking(backup.ranking);
    const restoredLists = {
      curious: normalizeStoredRanking(backup.lists.curious),
      not_for_me: normalizeStoredRanking(backup.lists.not_for_me),
    };
    if (restoredRanking.length !== backup.ranking.length) throw new Error("invalid ranking entities");
    const restoreScope = currentUser
      ? "Replace your synced Dogs ranking, lists, and pack progress—and this device copy—with the backup?"
      : "Replace this device’s Dogs ranking, lists, and pack progress with the backup?";
    if (!window.confirm(restoreScope)) return;
    const before = stateSnapshot();
    const normalized = normalizeCategoryListState({ ranking: restoredRanking, lists: restoredLists }, LIST_OPTIONS);
    ranking = normalized.ranking;
    lists = normalized.lists;
    packProgress = backup.packProgress || {};
    preferences = { ...preferences, ...(backup.preferences || {}) };
    canonicalizeCurrentCatalogState({ persistUpgrade: false });
    saveAll({ mergeRemote: false });
    renderAll();
    backupDialog.close();
    showToast(`Restored ${ranking.length} ranked breed${ranking.length === 1 ? "" : "s"}.`, { undoSnapshot: before });
  } catch (_error) {
    showToast("That file is not a valid StackRank Dogs backup.");
  } finally {
    $("#dogs-restore-file").value = "";
  }
};

const reviewImport = () => {
  const lines = parseDogNameImport($("#dogs-import-text").value);
  importMatches = lines.map((line) => {
    const exact = searchCatalog(catalogIndex, line, { limit: 8 })
      .filter((result) => result.score <= 1);
    return {
      line,
      result: exact.length === 1 ? exact[0] : null,
      ambiguous: exact.length > 1,
    };
  });
  const review = $("#dogs-import-review");
  review.replaceChildren();
  const summary = document.createElement("p");
  const matched = importMatches.filter((entry) => entry.result).length;
  summary.textContent = `${matched} of ${importMatches.length} names matched one canonical catalog entity.`;
  const list = document.createElement("ul");
  importMatches.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry.result
      ? `${entry.line} → ${entry.result.item.snapshot.primaryText}${entry.result.matchedOn === "alias" ? ` (alias: ${entry.result.matchedText})` : ""}`
      : `${entry.line} — ${entry.ambiguous ? "ambiguous; not selected" : "no exact catalog or alias match"}`;
    list.appendChild(li);
  });
  const apply = document.createElement("button");
  apply.type = "button";
  apply.textContent = ranking.length ? "Replace ranking with matched names" : "Import matched names in this order";
  apply.disabled = matched === 0;
  apply.addEventListener("click", applyImport);
  review.append(summary, list, apply);
  review.hidden = false;
};

const applyImport = () => {
  const candidates = [];
  const seen = new Set();
  importMatches.forEach((entry) => {
    const id = entry.result?.item?.entityRef?.id;
    const candidate = id ? candidateForCatalogId(id) : null;
    if (!candidate || seen.has(id)) return;
    seen.add(id);
    candidates.push(createRankedEntity({
      entityRef: candidate.entityRef,
      snapshot: candidate.snapshot,
      rankedAt: new Date().toISOString(),
      comparisons: 0,
    }));
  });
  if (!candidates.length) return;
  if (ranking.length && !window.confirm("Replace your current Dogs ranking with these matched names in the shown order?")) return;
  const before = stateSnapshot();
  ranking = candidates;
  const normalized = normalizeCategoryListState({ ranking, lists }, LIST_OPTIONS);
  ranking = normalized.ranking;
  lists = normalized.lists;
  saveAll({
    changedSurfaces: changedEntitySurfaces(before, { ranking, lists }),
    mergeRemote: false,
  });
  renderAll();
  backupDialog.close();
  showDestination("ranking");
  showToast(`Imported ${ranking.length} breed${ranking.length === 1 ? "" : "s"} in the reviewed order.`, { undoSnapshot: before });
};

const updateAccountUi = () => {
  const available = Boolean(supabase && (accountSyncEnabled || publicSnapshotsEnabled));
  signInButton.hidden = !available || Boolean(currentUser);
  signOutButton.hidden = !available || !currentUser;
  if (!available) {
    accountState.textContent = "Dogs on this device";
    remoteGateNote.textContent =
      "Account sync and public links stay off until the additive Dogs RLS contract is approved.";
  } else if (currentUser) {
    accountState.textContent = currentUser.email
      ? `Signed in as ${currentUser.email}`
      : "Signed in";
    remoteGateNote.textContent = remoteSyncUnavailable
      ? authNotice
      : "This Dogs ranking is backed up to your StackRank account.";
  } else {
    accountState.textContent = "Dogs on this device";
    remoteGateNote.textContent = authNotice || "Sign in to sync this Dogs ranking across devices.";
  }
  publicShare.hidden = !publicSnapshotsEnabled;
  updateShareLinkUi();
};

const setSignInStatus = (message, error = false) => {
  signInStatus.textContent = message;
  signInStatus.classList.toggle("is-error", error);
};

const setSignInBusy = (busy) => {
  signInGoogle.disabled = busy;
  signInApple.disabled = busy;
  signInEmail.disabled = busy;
  signInSend.disabled = busy;
};

const loadSignInProviderAvailability = async () => {
  if (signInProviderPromise) return signInProviderPromise;
  signInProviderPromise = fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Auth settings returned ${response.status}.`);
      return response.json();
    })
    .then((settingsPayload) => {
      const enabled = new Set(enabledOAuthProviders(settingsPayload).map(({ provider }) => provider));
      signInGoogle.hidden = !enabled.has("google");
      signInApple.hidden = !enabled.has("apple");
      signInProviders.hidden = enabled.size === 0;
    })
    .catch((error) => {
      signInProviderPromise = null;
      signInProviders.hidden = true;
      console.warn("Could not load Supabase OAuth provider settings", error);
    });
  return signInProviderPromise;
};

const openSignIn = () => {
  if (!supabase) return;
  setSignInBusy(false);
  setSignInStatus("");
  showDialog(signInDialog);
  signInEmail.focus({ preventScroll: true });
  void loadSignInProviderAvailability();
};

const handleMagicLinkSignIn = async () => {
  if (!supabase) return;
  const email = normalizeAuthEmail(signInEmail.value);
  if (!isLikelyEmail(email)) {
    setSignInStatus("Enter a valid email address to receive a sign-in link.", true);
    signInEmail.focus();
    return;
  }
  setSignInBusy(true);
  setSignInStatus("Sending your sign-in link…");
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: signInRedirectUrl(window.location, ACTIVE_CATEGORY.path),
      },
    });
    if (error) throw error;
    signInEmail.value = "";
    setSignInStatus(`Check ${email} for your sign-in link.`);
  } catch (error) {
    setSignInStatus(`Sign-in failed: ${error?.message || "Could not reach the sign-in service."}`, true);
  } finally {
    setSignInBusy(false);
  }
};

const handleOAuthSignIn = async (provider) => {
  if (!supabase) return;
  const config = AUTH_PROVIDERS.find((entry) => entry.provider === provider);
  const button = provider === "google" ? signInGoogle : provider === "apple" ? signInApple : null;
  if (!config || !button || button.hidden) return;
  setSignInBusy(true);
  setSignInStatus(`Redirecting to ${config.label.replace(/^Continue with /, "")}…`);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: signInRedirectUrl(window.location, ACTIVE_CATEGORY.path),
      },
    });
    if (error) throw error;
  } catch (error) {
    setSignInBusy(false);
    setSignInStatus(`Sign-in failed: ${error?.message || "Could not reach the sign-in service."}`, true);
  }
};

const clearDeviceStateAfterSignOut = () => {
  ranking = [];
  lists = { curious: [], not_for_me: [] };
  packProgress = {};
  shareLinkState = emptyShareLinkState();
  saveAll({ syncRemote: false });
  renderAll();
};

const handleSignOut = async () => {
  if (!supabase || !currentUser || !window.confirm(SIGN_OUT_LOCAL_DATA_MESSAGE)) return;
  let error;
  try {
    ({ error } = await supabase.auth.signOut());
  } catch (caughtError) {
    error = caughtError;
  }
  if (error) {
    authNotice = `Sign-out failed: ${error.message || "Could not reach the sign-in service."}`;
    updateAccountUi();
    return;
  }
  if (currentUser) {
    currentUser = null;
    clearDeviceStateAfterSignOut();
  }
  authNotice = "Signed out.";
  updateAccountUi();
  closeSettings();
};

const initAuth = async () => {
  updateAccountUi();
  if (!supabase) return;
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_INIT_TIMEOUT_MS,
      "Supabase auth initialization timed out.",
    );
    if (error) throw error;
    currentUser = data?.session?.user || null;
    authNotice = "";
  } catch (error) {
    currentUser = null;
    authNotice = "Could not reach Supabase. Showing this device copy.";
    console.warn("Could not initialize Dogs auth", error);
  }
  updateAccountUi();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const incomingListId = categoryUserListId(session?.user?.id);
    if (
      event === "INITIAL_SESSION" &&
      incomingListId === categoryUserListId(currentUser?.id)
    ) return;
    const previousListId = categoryUserListId(currentUser?.id);
    const wasSignedIn = Boolean(currentUser);
    currentUser = session?.user || null;
    const nextListId = categoryUserListId(currentUser?.id);
    const switchedAccounts = Boolean(
      previousListId && nextListId && previousListId !== nextListId,
    );
    if (previousListId !== nextListId) {
      shareLinkState = emptyShareLinkState();
      remoteReadyListId = "";
      deferredRemoteSave = null;
    }
    authNotice = "";
    if (currentUser) {
      if (switchedAccounts) clearDeviceStateAfterSignOut();
      if (signInDialog.open) signInDialog.close();
      const requestedListId = nextListId;
      void (catalogReadyPromise || Promise.resolve()).then(async () => {
        if (remoteLoadPromise) await remoteLoadPromise;
        if (categoryUserListId(currentUser?.id) === requestedListId) {
          await loadRemoteState();
        }
      });
    } else if (wasSignedIn) {
      clearDeviceStateAfterSignOut();
    }
    updateAccountUi();
  });
  authSubscription = data?.subscription || null;
};

const sharedSnapshotPayload = () => normalizeCategorySharedPayload({
  catalogVersion: catalogDocument?.catalogVersion || "",
  items: ranking.map((item) => {
    const current = candidateForCatalogId(item.entityRef.id) || item;
    const publicImage = approvedImageForCatalogId(
      item.entityRef.id,
      "card",
      PROVIDER_PURPOSES.ARTWORK_PUBLIC_SNAPSHOT,
    );
    return {
      entityRef: current.entityRef,
      snapshot: {
        ...current.snapshot,
        image: publicImage
          ? {
              url: publicImage.url,
              alt: publicImage.alt,
              assetId: publicImage.assetId,
            }
          : { url: "", alt: "", assetId: "" },
      },
    };
  }),
}, { category: ACTIVE_CATEGORY.id });

const updateShareLinkUi = () => {
  if (!publicShare) return;
  const available = publicSnapshotsEnabled && Boolean(currentUser && supabase);
  const active = available && Boolean(shareLinkState.slug && !shareLinkState.revoked);
  const busy = shareLinkState.loading || shareLinkState.busy;
  sharePublish.hidden = !available || active;
  shareUpdate.hidden = !active;
  shareCopy.hidden = !active;
  shareRevoke.hidden = !active;
  shareLinkCard.hidden = !active;
  sharePublish.disabled = busy || !ranking.length;
  shareUpdate.disabled = busy || !ranking.length;
  shareCopy.disabled = busy;
  shareRevoke.disabled = busy;
  if (!available) {
    shareStatus.textContent = currentUser
      ? "Public Dogs links are not enabled on this build."
      : "Sign in to publish a read-only Dogs ranking snapshot.";
    return;
  }
  if (active) {
    const url = categorySharedListUrl(window.location.origin, ACTIVE_CATEGORY.id, shareLinkState.slug);
    shareLinkUrl.href = url;
    shareLinkUrl.textContent = url;
    shareStatus.textContent = "This link changes only when you choose Update snapshot.";
  } else if (shareLinkState.loading) {
    shareStatus.textContent = "Checking your current link…";
  } else if (shareLinkState.revoked) {
    shareStatus.textContent = "The previous link is revoked. Publishing again creates a new address.";
  } else {
    shareStatus.textContent = "Publish a read-only snapshot. Later ranking changes stay private.";
  }
};

const loadShareLinkState = async ({ force = false } = {}) => {
  const listId = categoryUserListId(currentUser?.id);
  if (!publicSnapshotsEnabled || !supabase || !listId) {
    updateShareLinkUi();
    return;
  }
  if (shareLinkState.loading || (shareLinkState.loaded && !force)) return;
  shareLinkState = { ...shareLinkState, loading: true };
  updateShareLinkUi();
  const { data, error } = await supabase
    .from("category_shared_lists")
    .select("slug,updated_at,revoked_at")
    .eq("list_id", listId)
    .eq("category", ACTIVE_CATEGORY.id)
    .maybeSingle();
  if (categoryUserListId(currentUser?.id) !== listId) return;
  if (error) {
    shareLinkState = { ...shareLinkState, loaded: false, loading: false };
    updateShareLinkUi();
    shareStatus.textContent = "Could not check your current link. Try again in a moment.";
    return;
  }
  shareLinkState = {
    loaded: true,
    loading: false,
    busy: false,
    slug: cleanText(data?.slug),
    updatedAt: data?.updated_at || null,
    revoked: Boolean(data?.revoked_at),
  };
  updateShareLinkUi();
};

const saveSharedSnapshot = async ({ updateExisting = false } = {}) => {
  const listId = categoryUserListId(currentUser?.id);
  const payload = sharedSnapshotPayload();
  if (!publicSnapshotsEnabled || !supabase || !listId || !payload?.items?.length) return;
  shareLinkState = { ...shareLinkState, busy: true };
  shareStatus.textContent = updateExisting ? "Updating snapshot…" : "Publishing snapshot…";
  updateShareLinkUi();
  const now = new Date().toISOString();
  let result = null;
  let lastError = null;
  if (updateExisting && shareLinkState.slug && !shareLinkState.revoked) {
    result = await supabase
      .from("category_shared_lists")
      .update({ payload, updated_at: now, revoked_at: null })
      .eq("slug", shareLinkState.slug)
      .eq("list_id", listId)
      .eq("category", ACTIVE_CATEGORY.id)
      .is("revoked_at", null)
      .select("slug,updated_at,revoked_at")
      .maybeSingle();
  } else {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const slug = generateCategoryShareSlug();
      if (shareLinkState.slug) {
        result = await supabase
          .from("category_shared_lists")
          .update({ slug, payload, updated_at: now, revoked_at: null })
          .eq("slug", shareLinkState.slug)
          .eq("list_id", listId)
          .eq("category", ACTIVE_CATEGORY.id)
          .select("slug,updated_at,revoked_at")
          .maybeSingle();
      } else {
        const row = buildCategorySharedListRow({
          slug,
          listId,
          category: ACTIVE_CATEGORY.id,
          payload,
          createdAt: now,
          updatedAt: now,
        });
        result = row
          ? await supabase
              .from("category_shared_lists")
              .insert(row)
              .select("slug,updated_at,revoked_at")
              .maybeSingle()
          : { data: null, error: new Error("Snapshot payload is invalid.") };
      }
      if (!result.error && result.data?.slug) {
        lastError = null;
        break;
      }
      lastError = result.error;
      if (!String(result.error?.code || result.error?.message || "").includes("23505")) break;
    }
  }
  const error = result?.error || lastError;
  if (categoryUserListId(currentUser?.id) !== listId) return;
  if (error || !result?.data?.slug) {
    shareLinkState = { ...shareLinkState, busy: false };
    shareStatus.textContent = "Could not save this public snapshot. Try again in a moment.";
    console.warn("Could not save Dogs public snapshot", error);
    updateShareLinkUi();
    return;
  }
  shareLinkState = {
    loaded: true,
    loading: false,
    busy: false,
    slug: result.data.slug,
    updatedAt: result.data.updated_at || now,
    revoked: false,
  };
  updateShareLinkUi();
  showToast(updateExisting ? "Public Dogs snapshot updated." : "Public Dogs snapshot published.");
};

const copyShareLink = async () => {
  if (!shareLinkState.slug || shareLinkState.revoked) return;
  const url = categorySharedListUrl(window.location.origin, ACTIVE_CATEGORY.id, shareLinkState.slug);
  try {
    await navigator.clipboard.writeText(url);
  } catch (_error) {
    const input = document.createElement("textarea");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast("Public Dogs link copied.");
};

const revokeShareLink = async () => {
  const listId = categoryUserListId(currentUser?.id);
  if (!supabase || !listId || !shareLinkState.slug) return;
  const revokedAt = new Date().toISOString();
  shareLinkState = { ...shareLinkState, busy: true };
  updateShareLinkUi();
  const { data, error } = await supabase
    .from("category_shared_lists")
    .update({ revoked_at: revokedAt, updated_at: revokedAt })
    .eq("slug", shareLinkState.slug)
    .eq("list_id", listId)
    .eq("category", ACTIVE_CATEGORY.id)
    .select("slug,updated_at,revoked_at")
    .maybeSingle();
  if (categoryUserListId(currentUser?.id) !== listId) return;
  if (error || !data?.slug) {
    shareLinkState = { ...shareLinkState, busy: false };
    shareStatus.textContent = "Could not revoke this link. Try again in a moment.";
    updateShareLinkUi();
    return;
  }
  shareLinkState = { ...shareLinkState, busy: false, revoked: true };
  updateShareLinkUi();
  showToast("Public Dogs link revoked.");
};

const openExport = () => {
  if (!canProviderPurpose(DOGS_CATEGORY, PROVIDER_PURPOSES.TEXT_EXPORT)) {
    showToast("Text export is disabled by category policy.");
    return;
  }
  $("#dogs-export-preview").textContent = dogsExportText(ranking, catalogDocument?.catalogVersion, "text");
  showDialog(exportDialog);
  void loadShareLinkState();
};

const exportRanking = (format) => {
  const extension = format === "markdown" ? "md" : format === "json" ? "json" : "txt";
  const mime = format === "json" ? "application/json" : "text/plain";
  const content = dogsExportText(ranking, catalogDocument?.catalogVersion, format);
  downloadBlob(content, `stackrank-dogs-ranking-${new Date().toISOString().slice(0, 10)}.${extension}`, mime);
  $("#dogs-export-preview").textContent = content;
  showToast(`${format === "markdown" ? "Markdown" : format.toUpperCase()} ranking downloaded.`);
};

const clearAllDogsData = () => {
  if (!ranking.length && !lists.curious.length && !lists.not_for_me.length) return;
  const scope = currentUser ? "your synced Dogs data and this device copy" : "this device’s Dogs data";
  if (!window.confirm(`Clear ${scope}? Movies and Books will not be touched.`)) return;
  const before = stateSnapshot();
  ranking = [];
  lists = { curious: [], not_for_me: [] };
  packProgress = {};
  saveAll({ mergeRemote: false });
  renderAll();
  closeSettings();
  showToast("Dogs data cleared from this device.", { undoSnapshot: before });
};

const loadCatalog = async () => {
  catalogLoadError = null;
  catalogStatus.classList.remove("is-error");
  catalogStatus.textContent = "Loading the breed catalog…";
  try {
    const [catalogResponse, packsResponse, rightsResponse, policyResponse] = await Promise.all([
      fetch(CATALOG_URL, { cache: "force-cache" }),
      fetch(PACKS_URL, { cache: "force-cache" }),
      fetch(RIGHTS_URL, { cache: "force-cache" }),
      fetch(RIGHTS_POLICY_URL, { cache: "force-cache" }),
    ]);
    if (!catalogResponse.ok) throw new Error(`catalog ${catalogResponse.status}`);
    catalogDocument = await catalogResponse.json();
    normalizedCatalog = normalizeCatalog(catalogDocument, DOG_CATALOG_ADAPTER, {
      supportedSchemaVersions: [1],
      expectedCatalogId: "stackrank-dogs",
    });
    if (!normalizedCatalog.valid || normalizedCatalog.rejectedCount) {
      throw new Error(`invalid catalog: ${normalizedCatalog.reason || `${normalizedCatalog.rejectedCount} rejected`}`);
    }
    catalogIndex = buildCatalogIndex(normalizedCatalog);
    catalogById = new Map(catalogDocument.entities.map((entity) => [entity.id, normalizeDogCatalogEntity(entity)]).filter(([, entity]) => entity));
    catalogItemById = new Map(normalizedCatalog.items.map((item) => [item.entityRef.id, item]));
    const packsPayload = packsResponse.ok ? await packsResponse.json() : { packs: [] };
    packs = (Array.isArray(packsPayload?.packs) ? packsPayload.packs : []).filter((pack) =>
      cleanText(pack?.id) && Array.isArray(pack?.items) && pack.items.every((id) => catalogById.get(id)?.selectable));
    const rightsPayload = rightsResponse.ok ? await rightsResponse.json() : { assets: [] };
    rightsLedger = rightsPayload && typeof rightsPayload === "object" ? rightsPayload : null;
    rightsAssets = Array.isArray(rightsLedger?.assets) ? rightsLedger.assets : [];
    rightsPolicy = policyResponse.ok ? await policyResponse.json() : null;
    rightsByAssetId = new Map(rightsAssets.map((asset) => [asset.assetId, asset]));
    rightsByCatalogId = new Map();
    rightsAssets.forEach((asset) => {
      if (!rightsByCatalogId.has(asset.catalogId)) rightsByCatalogId.set(asset.catalogId, []);
      rightsByCatalogId.get(asset.catalogId).push(asset);
    });
    const approvedCount = rightsAssets.filter((asset) => canProviderPurpose(
      DOGS_CATEGORY,
      PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY,
      { asset, rightsPolicy },
    )).length;
    catalogStatus.textContent = `${catalogDocument.entities.length.toLocaleString()} selectable breeds and types · VBO ${catalogDocument.source.release} · photography appears only after rights review${approvedCount ? ` (${approvedCount} available)` : ""}`;
    fillFilterOptions();
    canonicalizeCurrentCatalogState({ announceUpgrade: true });
  } catch (error) {
    catalogLoadError = error;
    catalogDocument = null;
    normalizedCatalog = null;
    catalogIndex = null;
    catalogById = new Map();
    catalogItemById = new Map();
    packs = [];
    rightsLedger = null;
    rightsAssets = [];
    rightsByAssetId = new Map();
    rightsByCatalogId = new Map();
    catalogStatus.textContent = "The catalog could not be verified. Your saved ranking remains available.";
    catalogStatus.classList.add("is-error");
  }
  renderAll();
};

const onRankingPointerDown = (event) => {
  if (rankingFilterActive() || event.button !== 0) return;
  const row = event.target.closest(".ranking-row");
  if (!row || event.target.closest("button:not(.move-handle)")) return;
  const coarse = event.pointerType !== "mouse";
  if (coarse && !event.target.closest(".move-handle")) return;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    sourceKey: row.dataset.key,
    targetKey: row.dataset.key,
    dragging: false,
  };
  row.setPointerCapture?.(event.pointerId);
};

const onRankingPointerMove = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (!dragState.dragging && distance < 7) return;
  dragState.dragging = true;
  document.body.classList.add("is-dragging");
  const sourceRow = $(`.ranking-row[data-key="${CSS.escape(dragState.sourceKey)}"]`);
  sourceRow?.classList.add("is-dragging");
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".ranking-row");
  if (target) dragState.targetKey = target.dataset.key;
  const scrollDelta = dogDragAutoScrollDelta(event.clientY, window.innerHeight);
  if (scrollDelta) window.scrollBy({ top: scrollDelta, behavior: "instant" });
  event.preventDefault();
};

const clearRankingDrag = () => {
  const current = dragState;
  dragState = null;
  document.body.classList.remove("is-dragging");
  $$(".ranking-row.is-dragging").forEach((row) => row.classList.remove("is-dragging"));
  const sourceRow = current
    ? $(`.ranking-row[data-key="${CSS.escape(current.sourceKey)}"]`)
    : null;
  try {
    if (current && sourceRow?.hasPointerCapture?.(current.pointerId)) {
      sourceRow.releasePointerCapture(current.pointerId);
    }
  } catch (_error) {
    // Capture may already have been released by the browser.
  }
  return current;
};

const cancelRankingDrag = (event) => {
  if (!dragState) return false;
  if (Number.isInteger(event?.pointerId) && event.pointerId !== dragState.pointerId) return false;
  clearRankingDrag();
  return true;
};

const finishRankingDrag = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const current = clearRankingDrag();
  if (!current.dragging || current.sourceKey === current.targetKey) return;
  const targetIndex = ranking.findIndex((item) => entityRefKey(item) === current.targetKey);
  performRankingMove(current.sourceKey, targetIndex);
};

$$('[data-destination]').forEach((button) => {
  button.addEventListener("click", () => showDestination(button.dataset.destination));
});
searchInput.addEventListener("input", runLocalSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && !suggestionsEl.hidden) {
    event.preventDefault();
    selectSearchResult(activeSuggestionIndex + 1);
  } else if (event.key === "ArrowUp" && !suggestionsEl.hidden) {
    event.preventDefault();
    selectSearchResult(activeSuggestionIndex - 1);
  } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    beginRanking(searchResults[activeSuggestionIndex].candidate);
  } else if (event.key === "Escape") {
    closeSearchResults();
  }
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeSuggestionIndex >= 0) beginRanking(searchResults[activeSuggestionIndex].candidate);
});
document.addEventListener("pointerdown", (event) => {
  if (!searchForm.contains(event.target)) closeSearchResults();
  if (!settings.hidden && !settings.contains(event.target) && !settingsToggle.contains(event.target)) closeSettings();
});

settingsToggle.addEventListener("click", () => {
  settings.hidden = !settings.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settings.hidden));
});
newChoiceEl.addEventListener("click", () => handleChoice(true));
existingChoiceEl.addEventListener("click", () => handleChoice(false));
$("#dogs-cancel-comparison").addEventListener("click", cancelRanking);
undoChoiceButton.addEventListener("click", undoLastChoice);
$("#dogs-review-order").addEventListener("click", startReview);
$("#dogs-review-keep").addEventListener("click", () => advanceReview(false));
$("#dogs-review-swap").addEventListener("click", () => advanceReview(true));
$("#dogs-end-review").addEventListener("click", endReview);

rankingEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = event.target.closest(".ranking-row");
  if (!button || !row) return;
  const index = ranking.findIndex((item) => entityRefKey(item) === row.dataset.key);
  if (index < 0) return;
  if (button.dataset.action === "detail") openDetail(ranking[index].entityRef.id);
  else if (button.dataset.action === "up") performRankingMove(row.dataset.key, index - 1);
  else if (button.dataset.action === "down") performRankingMove(row.dataset.key, index + 1);
  else if (button.dataset.action === "remove") removeFromRanking(row.dataset.key);
});
rankingEl.addEventListener("keydown", (event) => {
  const handle = event.target.closest(".move-handle");
  const row = event.target.closest(".ranking-row");
  if (!handle || !row || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const index = ranking.findIndex((item) => entityRefKey(item) === row.dataset.key);
  performRankingMove(row.dataset.key, event.key === "ArrowUp" ? index - 1 : index + 1);
});
rankingEl.addEventListener("pointerdown", onRankingPointerDown);
rankingEl.addEventListener("pointermove", onRankingPointerMove);
rankingEl.addEventListener("pointerup", finishRankingDrag);
rankingEl.addEventListener("pointercancel", cancelRankingDrag);
rankingEl.addEventListener("lostpointercapture", cancelRankingDrag);
window.addEventListener("blur", cancelRankingDrag);

$$('[data-ranking-view]').forEach((button) => {
  button.addEventListener("click", () => {
    preferences.rankingView = button.dataset.rankingView;
    $$('[data-ranking-view]').forEach((candidate) =>
      candidate.setAttribute("aria-pressed", String(candidate === button)));
    savePreferences();
    renderRanking();
  });
});
$("#dogs-filter-toggle").addEventListener("click", (event) => {
  const panel = $("#dogs-filters");
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
});
$("#dogs-status-filter").addEventListener("change", (event) => {
  preferences.statusFilter = event.target.value;
  savePreferences();
  renderRanking();
});
$("#dogs-region-filter").addEventListener("change", (event) => {
  preferences.regionFilter = event.target.value;
  savePreferences();
  renderRanking();
});
$("#dogs-image-filter").addEventListener("change", (event) => {
  preferences.imageOnly = event.target.checked;
  savePreferences();
  renderRanking();
});
$("#dogs-clear-filters").addEventListener("click", () => {
  preferences.statusFilter = "";
  preferences.regionFilter = "";
  preferences.imageOnly = false;
  fillFilterOptions();
  savePreferences();
  renderRanking();
});
$("#dogs-move-mode").addEventListener("click", (event) => {
  const pressed = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(pressed));
  document.body.classList.toggle("is-move-mode", pressed);
});

$("#dogs-view-all-packs").addEventListener("click", openPackBrowser);
$("#dogs-pack-search").addEventListener("input", renderPackBrowser);
$("#dogs-pack-family").addEventListener("change", renderPackBrowser);
$("#dogs-refresh-browse").addEventListener("click", () => {
  browseOffset += 8;
  renderBrowse();
});
$("#dogs-retry-catalog").addEventListener("click", loadCatalog);
$("#dogs-open-credits").addEventListener("click", renderCredits);

$("#dogs-open-backup").addEventListener("click", () => showDialog(backupDialog));
$("#dogs-open-export").addEventListener("click", openExport);
signInButton.addEventListener("click", openSignIn);
signOutButton.addEventListener("click", () => void handleSignOut());
signInEmailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleMagicLinkSignIn();
});
signInGoogle.addEventListener("click", () => void handleOAuthSignIn("google"));
signInApple.addEventListener("click", () => void handleOAuthSignIn("apple"));
sharePublish.addEventListener("click", () => void saveSharedSnapshot());
shareUpdate.addEventListener("click", () => void saveSharedSnapshot({ updateExisting: true }));
shareCopy.addEventListener("click", () => void copyShareLink());
shareRevoke.addEventListener("click", () => void revokeShareLink());
$("#dogs-open-hidden").addEventListener("click", () => {
  renderLists();
  showDialog(hiddenDialog);
});
$("#dogs-clear").addEventListener("click", clearAllDogsData);
$("#dogs-download-backup").addEventListener("click", downloadBackup);
$("#dogs-restore-backup").addEventListener("click", () => $("#dogs-restore-file").click());
$("#dogs-restore-file").addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file) restoreBackup(file);
});
$("#dogs-import-form").addEventListener("submit", (event) => {
  event.preventDefault();
  reviewImport();
});
$$('[data-export-format]').forEach((button) =>
  button.addEventListener("click", () => exportRanking(button.dataset.exportFormat)));
toastAction.addEventListener("click", () => {
  const restore = undoController.consume(toastUndoToken);
  if (!restore) return;
  restore();
  toast.hidden = true;
  announce("Last change undone.");
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (cancelRankingDrag()) event.preventDefault();
  else if (!comparisonEl.hidden) cancelRanking();
  else if (!reviewEl.hidden) endReview();
  else if (!settings.hidden) closeSettings();
});

const init = async () => {
  loadState();
  updateAccountUi();
  $$('[data-ranking-view]').forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.rankingView === preferences.rankingView)));
  let initialDestination = "rank";
  try {
    initialDestination = parseAppDestinationMemory(sessionStorage.getItem(STORAGE_KEYS.appDestination));
  } catch (_error) {
    // Convenience state only.
  }
  showDestination(initialDestination, { restoreScroll: false });
  renderAll();
  catalogReadyPromise = loadCatalog();
  await Promise.all([catalogReadyPromise, initAuth()]);
  canonicalizeCurrentCatalogState({ persistUpgrade: true });
  if (currentUser) await loadRemoteState();
  if (!storageAvailable) storageError();
  console.info("StackRank Dogs", {
    catalogVersion: catalogDocument?.catalogVersion || null,
    catalogCount: catalogDocument?.entities?.length || 0,
    rankingCount: ranking.length,
    approvedDisplayArtwork: rightsAssets.filter((asset) => canProviderPurpose(
      DOGS_CATEGORY,
      PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY,
      { asset, rightsPolicy },
    )).length,
  });
};

init();
