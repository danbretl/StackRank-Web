import { createRankedEntity, entityRefKey } from "./entity.js?v=1";
import { normalizeCategoryListState } from "./category-lists.js?v=1";

export const DOGS_BACKUP_KIND = "stackrank-dogs-backup";
export const DOGS_BACKUP_VERSION = 1;

const cleanText = (value) => String(value || "").trim();

const DOG_PROFILE_SIZE_LABELS = Object.freeze({
  toy: "Toy",
  small: "Small",
  medium: "Medium",
  large: "Large",
  giant: "Giant",
  varies: "Size varies",
});

export function normalizeDogProfile(value) {
  if (!isPlainRecord(value)) return null;
  const summary = cleanText(value.summary);
  const interestingFact = cleanText(value.interestingFact);
  const sizeBand = cleanText(value.sizeBand).toLowerCase();
  const cleanList = (items, limit) => [...new Set((Array.isArray(items) ? items : [])
    .map(cleanText)
    .filter(Boolean))].slice(0, limit);
  if (
    summary.length < 20 ||
    summary.length > 700 ||
    interestingFact.length < 10 ||
    interestingFact.length > 360 ||
    !["toy", "small", "medium", "large", "giant", "varies", "unknown"].includes(sizeBand)
  ) return null;
  const registryGroups = (Array.isArray(value.registryGroups) ? value.registryGroups : [])
    .map((group) => ({
      scheme: cleanText(group?.scheme),
      label: cleanText(group?.label),
      sourceId: cleanText(group?.sourceId),
    }))
    .filter((group) => group.scheme && group.label && group.sourceId)
    .slice(0, 12);
  const popularity = isPlainRecord(value.popularity) &&
    cleanText(value.popularity.geography) &&
    Number.isInteger(value.popularity.year) &&
    Number.isInteger(value.popularity.rank) &&
    Number.isInteger(value.popularity.total) &&
    value.popularity.rank > 0 &&
    value.popularity.rank <= value.popularity.total
    ? {
        geography: cleanText(value.popularity.geography),
        year: value.popularity.year,
        rank: value.popularity.rank,
        total: value.popularity.total,
        sourceId: cleanText(value.popularity.sourceId),
      }
    : null;
  return {
    summary,
    interestingFact,
    sizeBand,
    sizeLabel: DOG_PROFILE_SIZE_LABELS[sizeBand] || "",
    typeLabel: cleanText(value.typeLabel).slice(0, 80),
    typeBasis: ["registry", "editorial", "catalog"].includes(value.typeBasis) ? value.typeBasis : "catalog",
    originRegions: cleanList(value.originRegions, 8),
    historicalRoots: cleanText(value.historicalRoots).slice(0, 300),
    editorialFamilies: cleanList(value.editorialFamilies, 12),
    registryGroups,
    popularity,
    sourceIds: cleanList(value.sourceIds, 20),
    reviewStatus: ["generated", "source-reviewed", "editor-reviewed"].includes(value.reviewStatus)
      ? value.reviewStatus
      : "generated",
  };
}

export function dogProfileChips(profile, { limit = 3 } = {}) {
  const normalized = normalizeDogProfile(profile);
  if (!normalized) return [];
  return [
    normalized.sizeLabel,
    normalized.originRegions[0],
    normalized.typeLabel,
  ].filter(Boolean).slice(0, Math.max(0, Number(limit) || 0));
}

const jsonBytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
const PREFERENCE_KEYS = new Set([
  "rankingView",
  "statusFilter",
  "regionFilter",
  "imageOnly",
]);
const PACK_PROGRESS_KEYS = new Set([
  "startedAt",
  "completedAt",
  "versionSeen",
]);
const PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DOG_STATUS_FILTERS = new Set(["", "canonical", "variety", "crossbreed", "historical"]);

const isPlainRecord = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

const isTimestampOrNull = (value) =>
  value === null ||
  (typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)));

const normalizeDogBackupItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => createRankedEntity(item))
    .filter((item) =>
      item?.entityRef?.domain === "dogs" &&
      item.entityRef.type === "breed" &&
      item.entityRef.source === "vbo" &&
      /^VBO:\d{7}$/u.test(item.entityRef.id));

export function normalizeDogPreferences(value) {
  if (!isPlainRecord(value)) return null;
  if (Object.keys(value).some((key) => !PREFERENCE_KEYS.has(key))) return null;
  const rankingView = value.rankingView ?? "detailed";
  const statusFilter = cleanText(value.statusFilter);
  const regionFilter = cleanText(value.regionFilter);
  if (
    !["detailed", "photos", "compact"].includes(rankingView) ||
    !DOG_STATUS_FILTERS.has(statusFilter) ||
    regionFilter.length > 80 ||
    (value.imageOnly !== undefined && typeof value.imageOnly !== "boolean")
  ) {
    return null;
  }
  return {
    rankingView,
    statusFilter,
    regionFilter,
    imageOnly: value.imageOnly === true,
  };
}

export function normalizeDogPackProgress(value) {
  if (!isPlainRecord(value) || Object.keys(value).length > 200) return null;
  const progress = {};
  for (const [packId, rawEntry] of Object.entries(value)) {
    if (
      packId.length > 80 ||
      !PACK_ID_PATTERN.test(packId) ||
      !isPlainRecord(rawEntry) ||
      Object.keys(rawEntry).some((key) => !PACK_PROGRESS_KEYS.has(key))
    ) {
      return null;
    }
    const startedAt = rawEntry.startedAt ?? null;
    const completedAt = rawEntry.completedAt ?? null;
    const versionSeen = rawEntry.versionSeen ?? null;
    if (
      !isTimestampOrNull(startedAt) ||
      !isTimestampOrNull(completedAt) ||
      (
        versionSeen !== null &&
        (!Number.isInteger(versionSeen) || versionSeen < 1 || versionSeen > 1_000)
      )
    ) {
      return null;
    }
    progress[packId] = {
      ...(startedAt ? { startedAt } : {}),
      ...(completedAt !== null ? { completedAt } : {}),
      ...(versionSeen !== null ? { versionSeen } : {}),
    };
  }
  return progress;
}

export function normalizeDogListState(value, listTypes = ["curious", "not_for_me"]) {
  return normalizeCategoryListState(value, { domain: "dogs", listTypes });
}

export function buildDogsBackup({ ranking, lists, packProgress, preferences } = {}, exportedAt = new Date().toISOString()) {
  const state = normalizeDogListState({
    ranking: normalizeDogBackupItems(ranking),
    lists: {
      curious: normalizeDogBackupItems(lists?.curious),
      not_for_me: normalizeDogBackupItems(lists?.not_for_me),
    },
  });
  return {
    kind: DOGS_BACKUP_KIND,
    version: DOGS_BACKUP_VERSION,
    category: "dogs",
    exportedAt,
    ranking: state.ranking,
    lists: state.lists,
    packProgress: normalizeDogPackProgress(packProgress) || {},
    preferences: normalizeDogPreferences(preferences) || normalizeDogPreferences({}),
  };
}

export function parseDogsBackup(raw, { maxBytes = 1_500_000 } = {}) {
  try {
    if (typeof raw === "string" && new TextEncoder().encode(raw).length > maxBytes) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      !parsed ||
      parsed.kind !== DOGS_BACKUP_KIND ||
      parsed.version !== DOGS_BACKUP_VERSION ||
      parsed.category !== "dogs" ||
      !Array.isArray(parsed.ranking) ||
      !parsed.lists ||
      !Array.isArray(parsed.lists.curious) ||
      !Array.isArray(parsed.lists.not_for_me)
    ) return null;
    const strictItems = {
      ranking: normalizeDogBackupItems(parsed.ranking),
      curious: normalizeDogBackupItems(parsed.lists.curious),
      not_for_me: normalizeDogBackupItems(parsed.lists.not_for_me),
    };
    if (
      strictItems.ranking.length !== parsed.ranking.length ||
      strictItems.curious.length !== parsed.lists.curious.length ||
      strictItems.not_for_me.length !== parsed.lists.not_for_me.length
    ) {
      return null;
    }
    const normalized = normalizeDogListState({
      ranking: strictItems.ranking,
      lists: {
        curious: strictItems.curious,
        not_for_me: strictItems.not_for_me,
      },
    });
    if (
      normalized.ranking.length !== strictItems.ranking.length ||
      normalized.lists.curious.length !== strictItems.curious.length ||
      normalized.lists.not_for_me.length !== strictItems.not_for_me.length
    ) {
      return null;
    }
    const packProgress = normalizeDogPackProgress(parsed.packProgress);
    const preferences = normalizeDogPreferences(parsed.preferences);
    if (!packProgress || !preferences) return null;
    const backup = buildDogsBackup({
      ...normalized,
      packProgress,
      preferences,
    }, typeof parsed.exportedAt === "string" ? parsed.exportedAt : null);
    return jsonBytes(backup) <= maxBytes ? backup : null;
  } catch (_error) {
    return null;
  }
}

export function parseDogNameImport(value, limit = 500) {
  const seen = new Set();
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]\])\s*/, "")
      .trim())
    .filter((line) => {
      const key = line.toLocaleLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(0, Number(limit) || 0));
}

const rankWeight = (index, total) => (total > 0 ? (total - index) / total : 0);

export function buildDogTasteSignals(ranking, catalogById, { limit = 3, minMatches = 2 } = {}) {
  const list = Array.isArray(ranking) ? ranking : [];
  const buckets = new Map();
  const add = (kind, value, item, index) => {
    const text = cleanText(value);
    if (!text) return;
    const key = `${kind}:${text.toLocaleLowerCase()}`;
    const bucket = buckets.get(key) || { kind, value: text, score: 0, items: [] };
    bucket.score += rankWeight(index, list.length);
    bucket.items.push(item);
    buckets.set(key, bucket);
  };
  list.forEach((item, index) => {
    const id = item?.entityRef?.id;
    const entity = catalogById instanceof Map ? catalogById.get(id) : catalogById?.[id];
    if (!entity) return;
    (entity.originRegions || []).slice(0, 2).forEach((value) => add("region", value, item, index));
    (entity.tags || []).slice(0, 5).forEach((value) => add("family", value, item, index));
  });
  return [...buckets.values()]
    .filter((bucket) => bucket.items.length >= minMatches)
    .sort((a, b) => b.score - a.score || b.items.length - a.items.length || a.value.localeCompare(b.value))
    .slice(0, Math.max(0, Number(limit) || 0));
}

export function dogsExportSections(ranking, catalogVersion) {
  const list = Array.isArray(ranking) ? ranking : [];
  return {
    generatedAt: new Date().toISOString(),
    category: "dogs",
    catalogVersion: cleanText(catalogVersion),
    ranking: list.map((item, index) => ({
      rank: index + 1,
      id: item?.entityRef?.id || "",
      name: item?.snapshot?.primaryText || "Unknown breed or type",
      context: item?.snapshot?.secondaryText || "",
    })),
  };
}

export function dogsExportText(ranking, catalogVersion, format = "text") {
  const payload = dogsExportSections(ranking, catalogVersion);
  if (format === "json") return `${JSON.stringify(payload, null, 2)}\n`;
  if (format === "markdown") {
    return [
      "# My StackRank Dogs ranking",
      "",
      ...payload.ranking.map((item) => `${item.rank}. **${item.name}**${item.context ? ` — ${item.context}` : ""}`),
      "",
      "_Source: Vertebrate Breed Ontology_",
      "",
    ].join("\n");
  }
  return [
    "MY STACKRANK DOGS RANKING",
    "",
    ...payload.ranking.map((item) => `${item.rank}. ${item.name}${item.context ? ` — ${item.context}` : ""}`),
    "",
    "Source: Vertebrate Breed Ontology",
    "",
  ].join("\n");
}
