import { entityRefKey } from "./entity.js?v=1";
import { normalizeCategoryListState } from "./category-lists.js?v=1";

export const DOGS_BACKUP_KIND = "stackrank-dogs-backup";
export const DOGS_BACKUP_VERSION = 1;

const cleanText = (value) => String(value || "").trim();

const jsonBytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

export function normalizeDogListState(value, listTypes = ["curious", "not_for_me"]) {
  return normalizeCategoryListState(value, { domain: "dogs", listTypes });
}

export function buildDogsBackup({ ranking, lists, packProgress, preferences } = {}, exportedAt = new Date().toISOString()) {
  const state = normalizeDogListState({ ranking, lists });
  return {
    kind: DOGS_BACKUP_KIND,
    version: DOGS_BACKUP_VERSION,
    category: "dogs",
    exportedAt,
    ranking: state.ranking,
    lists: state.lists,
    packProgress: packProgress && typeof packProgress === "object" && !Array.isArray(packProgress)
      ? packProgress
      : {},
    preferences: preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {},
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
    const normalized = normalizeDogListState(parsed);
    if (normalized.ranking.length !== parsed.ranking.length) return null;
    const backup = buildDogsBackup({
      ...normalized,
      packProgress: parsed.packProgress,
      preferences: parsed.preferences,
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
    (entity.registryRefs || []).slice(0, 3).forEach((ref) =>
      add("registry", `${ref.scheme}: ${ref.group}`, item, index));
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
      `_Catalog ${payload.catalogVersion || "version unavailable"}_`,
      "",
    ].join("\n");
  }
  return [
    "MY STACKRANK DOGS RANKING",
    "",
    ...payload.ranking.map((item) => `${item.rank}. ${item.name}${item.context ? ` — ${item.context}` : ""}`),
    "",
    `Catalog: ${payload.catalogVersion || "version unavailable"}`,
    "",
  ].join("\n");
}
