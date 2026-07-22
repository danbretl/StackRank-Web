import {
  createRankedEntity,
  entityRefKey,
  normalizeEntityRef,
  normalizeEntitySnapshot,
} from "./entity.js?v=1";
import { mergeRankedListPayloads } from "./ranked-list.js?v=1";

export const CATEGORY_REMOTE_ITEMS_LIMIT_BYTES = 1024 * 1024;
export const CATEGORY_REMOTE_ITEMS_LIMIT_COUNT = 5000;
export const CATEGORY_REMOTE_PACK_PROGRESS_LIMIT_BYTES = 8 * 1024;
export const CATEGORY_REMOTE_SHARED_LIMIT_BYTES = 1024 * 1024;
export const CATEGORY_REMOTE_SHARED_LIMIT_COUNT = 2000;
export const CATEGORY_REMOTE_ID_LIMIT_BYTES = 64;
export const CATEGORY_REMOTE_LIST_TYPE_LIMIT_BYTES = 64;

const CATEGORY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIST_TYPE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const STATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHARED_SLUG_PATTERN = /^[a-z0-9]{12}$/;
const USER_LIST_ID_PATTERN = /^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const utf8Encoder = new TextEncoder();

const cleanText = (value) => String(value || "").trim();
const isObjectRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function categoryRemoteJsonBytes(value) {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string"
      ? utf8Encoder.encode(serialized).length
      : Infinity;
  } catch (_error) {
    return Infinity;
  }
}

export function categoryRemoteWriteSurfaces(
  changedSurfaces,
  { listTypes = [] } = {},
) {
  const normalizedListTypes = [...new Set((Array.isArray(listTypes) ? listTypes : [])
    .map((value) => cleanText(value))
    .filter(isCategoryRemoteListType))];
  const requested = new Set(Array.isArray(changedSurfaces) ? changedSurfaces : []);
  if (requested.has("all") || requested.has("queues")) {
    normalizedListTypes.forEach((listType) => requested.add(listType));
  }
  const ordered = ["ranking", ...normalizedListTypes, "packProgress"];
  return ordered.filter((surface) => requested.has(surface));
}

export function categoryListUpdatedAtState(value, { listTypes = [] } = {}) {
  const legacy = normalizedTimestamp(value?.updated_at);
  return Object.fromEntries((Array.isArray(listTypes) ? listTypes : [])
    .map((listType) => cleanText(listType))
    .filter(isCategoryRemoteListType)
    .map((listType) => [
      listType,
      normalizedTimestamp(value?.list_updated_at?.[listType], legacy),
    ]));
}

export function isCategoryRemoteId(value) {
  const id = cleanText(value);
  return id.length <= CATEGORY_REMOTE_ID_LIMIT_BYTES && CATEGORY_PATTERN.test(id);
}

export function isCategoryRemoteListType(value) {
  const listType = cleanText(value);
  return (
    listType.length <= CATEGORY_REMOTE_LIST_TYPE_LIMIT_BYTES &&
    LIST_TYPE_PATTERN.test(listType)
  );
}

export function categoryUserListId(userId) {
  const id = cleanText(userId);
  const listId = id.startsWith("user:") ? id : `user:${id}`;
  return USER_LIST_ID_PATTERN.test(listId) ? listId.toLowerCase() : "";
}

export function generateCategoryShareSlug(randomBytes = null) {
  const bytes = randomBytes || (
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint8Array(12))
      : null
  );
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) {
    throw new Error("Secure randomness is required to create a shared-list link.");
  }
  return Array.from(bytes.slice(0, 12), (byte) => (byte % 36).toString(36)).join("");
}

export function categorySharedListUrl(origin, category, slug) {
  const normalizedCategory = cleanText(category);
  const normalizedSlug = cleanText(slug);
  if (!isCategoryRemoteId(normalizedCategory) || !SHARED_SLUG_PATTERN.test(normalizedSlug)) {
    throw new Error("Invalid category shared-list path.");
  }
  const url = new URL(`/s/${normalizedCategory}/${normalizedSlug}`, origin);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Invalid shared-list origin.");
  return url.href;
}

export function categorySharedSlugFromPath(pathname, { category } = {}) {
  const normalizedCategory = cleanText(category);
  if (!isCategoryRemoteId(normalizedCategory)) return "";
  const escapedCategory = normalizedCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(pathname || "").match(
    new RegExp(`^/s/${escapedCategory}/([a-z0-9]{12})/?$`),
  );
  return match?.[1] || "";
}

const normalizedTimestamp = (value, fallback = null) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? value : fallback;
};

const validateCategoryItems = (
  items,
  category,
  {
    maxBytes = CATEGORY_REMOTE_ITEMS_LIMIT_BYTES,
    maxItems = CATEGORY_REMOTE_ITEMS_LIMIT_COUNT,
  } = {},
) => {
  if (!Array.isArray(items) || items.length > maxItems) return null;
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    if (typeof item?.snapshot?.primaryText !== "string") return null;
    const ranked = createRankedEntity(item);
    const ref = ranked?.entityRef;
    const key = entityRefKey(ranked);
    if (!ranked || ref.domain !== category || !key || seen.has(key)) return null;
    seen.add(key);
    normalized.push(ranked);
  }
  return categoryRemoteJsonBytes(normalized) <= maxBytes ? normalized : null;
};

const normalizeItemPayload = (value, category, options) => {
  if (
    !isObjectRecord(value) ||
    !isCategoryRemoteId(category) ||
    (value.category && value.category !== category)
  ) {
    return null;
  }
  const items = validateCategoryItems(value.items, category, options);
  if (!items) return null;
  return {
    items,
    updated_at: normalizedTimestamp(value.updated_at),
  };
};

export function buildCategoryRankingRow({
  listId,
  category,
  items,
  updatedAt = new Date().toISOString(),
} = {}) {
  const normalizedCategory = cleanText(category);
  const normalizedListId = categoryUserListId(listId);
  const normalizedItems = validateCategoryItems(items, normalizedCategory);
  const timestamp = normalizedTimestamp(updatedAt);
  if (!normalizedListId || !isCategoryRemoteId(normalizedCategory) || !normalizedItems || !timestamp) {
    return null;
  }
  return {
    list_id: normalizedListId,
    category: normalizedCategory,
    items: normalizedItems,
    updated_at: timestamp,
  };
}

export function buildCategoryListRow({
  listId,
  category,
  listType,
  items,
  updatedAt = new Date().toISOString(),
} = {}) {
  const row = buildCategoryRankingRow({ listId, category, items, updatedAt });
  const normalizedListType = cleanText(listType);
  return row && isCategoryRemoteListType(normalizedListType)
    ? { ...row, list_type: normalizedListType }
    : null;
}

export function categoryItemPayloadFromRow(
  row,
  { category, listId = null, listType = null } = {},
) {
  const normalizedCategory = cleanText(category);
  const expectedListId = listId === null ? null : categoryUserListId(listId);
  if (
    !isObjectRecord(row) ||
    !isCategoryRemoteId(normalizedCategory) ||
    row.category !== normalizedCategory ||
    (expectedListId !== null && (!expectedListId || row.list_id !== expectedListId)) ||
    (listType !== null && row.list_type !== listType)
  ) {
    return null;
  }
  return normalizeItemPayload(row, normalizedCategory);
}

export function mergeCategoryItemPayloads(payloads, { category } = {}) {
  const normalizedCategory = cleanText(category);
  if (!isCategoryRemoteId(normalizedCategory)) {
    return { items: [], updated_at: null, appendedItems: [], acceptedPayloads: 0 };
  }
  const validPayloads = (Array.isArray(payloads) ? payloads : [])
    .map((payload) => normalizeItemPayload(payload, normalizedCategory))
    .filter(Boolean);
  return {
    ...mergeRankedListPayloads(validPayloads),
    acceptedPayloads: validPayloads.length,
  };
}

export function mergeCategoryPlacementPayloads(
  { ranking = [], lists = {} } = {},
  { category, listTypes = [] } = {},
) {
  const normalizedListTypes = [...new Set((Array.isArray(listTypes) ? listTypes : [])
    .map((value) => cleanText(value))
    .filter(isCategoryRemoteListType))];
  const surfaces = ["ranking", ...normalizedListTypes];
  const payloadsBySurface = Object.fromEntries(surfaces.map((surface) => [
    surface,
    Array.isArray(surface === "ranking" ? ranking : lists?.[surface])
      ? (surface === "ranking" ? ranking : lists[surface])
      : [],
  ]));
  const newestPlacement = new Map();
  surfaces.forEach((surface) => {
    payloadsBySurface[surface].forEach((payload) => {
      const normalized = normalizeItemPayload(payload, cleanText(category));
      if (!normalized) return;
      const timestamp = Date.parse(normalized.updated_at || "") || 0;
      normalized.items.forEach((entry) => {
        const key = entityRefKey(entry);
        const previous = newestPlacement.get(key);
        if (key && (!previous || timestamp >= previous.timestamp)) {
          newestPlacement.set(key, { surface, timestamp });
        }
      });
    });
  });
  const merged = Object.fromEntries(surfaces.map((surface) => {
    const payload = mergeCategoryItemPayloads(payloadsBySurface[surface], { category });
    return [surface, {
      ...payload,
      items: payload.items.filter((entry) =>
        newestPlacement.get(entityRefKey(entry))?.surface === surface),
    }];
  }));
  return {
    ranking: merged.ranking,
    lists: Object.fromEntries(normalizedListTypes.map((listType) => [listType, merged[listType]])),
  };
}

const validateCategoryState = (
  state,
  maxBytes = CATEGORY_REMOTE_PACK_PROGRESS_LIMIT_BYTES,
) => {
  if (
    !isObjectRecord(state) ||
    Object.entries(state).some(([key, value]) =>
      !STATE_KEY_PATTERN.test(key) || !isObjectRecord(value))
  ) {
    return null;
  }
  return categoryRemoteJsonBytes(state) <= maxBytes ? state : null;
};

export function buildCategoryPackProgressRow({
  listId,
  category,
  state,
  updatedAt = new Date().toISOString(),
} = {}) {
  const normalizedCategory = cleanText(category);
  const normalizedListId = categoryUserListId(listId);
  const normalizedState = validateCategoryState(state);
  const timestamp = normalizedTimestamp(updatedAt);
  if (!normalizedListId || !isCategoryRemoteId(normalizedCategory) || !normalizedState || !timestamp) {
    return null;
  }
  return {
    list_id: normalizedListId,
    category: normalizedCategory,
    state: normalizedState,
    updated_at: timestamp,
  };
}

export function categoryStatePayloadFromRow(
  row,
  { category, listId = null } = {},
) {
  const normalizedCategory = cleanText(category);
  const expectedListId = listId === null ? null : categoryUserListId(listId);
  if (
    !isObjectRecord(row) ||
    !isCategoryRemoteId(normalizedCategory) ||
    row.category !== normalizedCategory ||
    (expectedListId !== null && (!expectedListId || row.list_id !== expectedListId))
  ) {
    return null;
  }
  const state = validateCategoryState(row.state);
  return state
    ? { state, updated_at: normalizedTimestamp(row.updated_at) }
    : null;
}

export function mergeCategoryStatePayloads(payloads, { category } = {}) {
  const normalizedCategory = cleanText(category);
  if (!isCategoryRemoteId(normalizedCategory)) {
    return { state: {}, updated_at: null, appendedKeys: [], acceptedPayloads: 0 };
  }
  const valid = (Array.isArray(payloads) ? payloads : [])
    .filter((payload) =>
      isObjectRecord(payload) &&
      (!payload.category || payload.category === normalizedCategory) &&
      validateCategoryState(payload.state))
    .map((payload, order) => ({
      state: payload.state,
      updated_at: normalizedTimestamp(payload.updated_at),
      timestamp: normalizedTimestamp(payload.updated_at)
        ? Date.parse(payload.updated_at)
        : 0,
      order,
    }))
    .sort((a, b) => b.timestamp - a.timestamp || a.order - b.order);
  const [newest = { state: {}, updated_at: null }, ...older] = valid;
  const state = Object.assign(Object.create(null), newest.state);
  const appendedKeys = [];
  older.forEach((payload) => {
    Object.entries(payload.state).forEach(([key, value]) => {
      if (!key || Object.hasOwn(state, key)) return;
      state[key] = value;
      appendedKeys.push(key);
    });
  });
  return {
    state: { ...state },
    updated_at: newest.updated_at,
    appendedKeys,
    acceptedPayloads: valid.length,
  };
}

export function normalizeCategorySharedPayload(value, { category } = {}) {
  const normalizedCategory = cleanText(category);
  if (!isObjectRecord(value) || !isCategoryRemoteId(normalizedCategory)) return null;
  const allowed = new Set(["displayName", "items", "catalogVersion"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  if (!Array.isArray(value.items) || value.items.length > CATEGORY_REMOTE_SHARED_LIMIT_COUNT) {
    return null;
  }
  if (
    (Object.hasOwn(value, "displayName") && typeof value.displayName !== "string") ||
    (Object.hasOwn(value, "catalogVersion") && typeof value.catalogVersion !== "string")
  ) {
    return null;
  }
  const seen = new Set();
  const items = [];
  for (const item of value.items) {
    if (typeof item?.snapshot?.primaryText !== "string") return null;
    const entityRef = normalizeEntityRef(item?.entityRef);
    const snapshot = normalizeEntitySnapshot(item?.snapshot);
    const key = entityRefKey(entityRef);
    if (
      !entityRef ||
      entityRef.domain !== normalizedCategory ||
      !snapshot ||
      !key ||
      seen.has(key)
    ) {
      return null;
    }
    seen.add(key);
    items.push({ entityRef, snapshot });
  }
  const displayName = cleanText(value.displayName);
  const catalogVersion = cleanText(value.catalogVersion);
  if (
    utf8Encoder.encode(displayName).length > 160 ||
    utf8Encoder.encode(catalogVersion).length > 128
  ) {
    return null;
  }
  const payload = {
    ...(displayName ? { displayName } : {}),
    items,
    ...(catalogVersion ? { catalogVersion } : {}),
  };
  return categoryRemoteJsonBytes(payload) <= CATEGORY_REMOTE_SHARED_LIMIT_BYTES
    ? payload
    : null;
}

export function buildCategorySharedListRow({
  slug,
  listId,
  category,
  payload,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  revokedAt = null,
} = {}) {
  const normalizedSlug = cleanText(slug);
  const normalizedCategory = cleanText(category);
  const normalizedListId = categoryUserListId(listId);
  const normalizedPayload = normalizeCategorySharedPayload(payload, {
    category: normalizedCategory,
  });
  const created = normalizedTimestamp(createdAt);
  const updated = normalizedTimestamp(updatedAt);
  const revoked = revokedAt === null ? null : normalizedTimestamp(revokedAt);
  if (
    !SHARED_SLUG_PATTERN.test(normalizedSlug) ||
    !normalizedListId ||
    !isCategoryRemoteId(normalizedCategory) ||
    !normalizedPayload ||
    !created ||
    !updated ||
    (revokedAt !== null && !revoked)
  ) {
    return null;
  }
  return {
    slug: normalizedSlug,
    list_id: normalizedListId,
    category: normalizedCategory,
    payload: normalizedPayload,
    created_at: created,
    updated_at: updated,
    revoked_at: revoked,
  };
}

export function categorySharedPayloadFromPublicRow(row, { category } = {}) {
  const normalizedCategory = cleanText(category);
  if (
    !isObjectRecord(row) ||
    !isCategoryRemoteId(normalizedCategory) ||
    row.category !== normalizedCategory ||
    (Object.hasOwn(row, "list_id") || Object.hasOwn(row, "revoked_at"))
  ) {
    return null;
  }
  const payload = normalizeCategorySharedPayload(row.payload, {
    category: normalizedCategory,
  });
  if (!payload) return null;
  return {
    slug: SHARED_SLUG_PATTERN.test(cleanText(row.slug)) ? cleanText(row.slug) : "",
    category: normalizedCategory,
    payload,
    created_at: normalizedTimestamp(row.created_at),
    updated_at: normalizedTimestamp(row.updated_at),
  };
}
