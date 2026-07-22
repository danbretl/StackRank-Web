import { createRankedEntity, entityRefKey } from "../entity.js?v=1";

export const DOGS_CATEGORY = Object.freeze({
  id: "dogs",
  path: "/dogs",
  documentPathAliases: Object.freeze(["/dogs.html"]),
  labels: Object.freeze({
    singular: "dog breed",
    plural: "dog breeds",
    savedList: "Curious about",
    hiddenList: "Not for me",
    artwork: "photo",
  }),
  provider: Object.freeze({
    id: "vbo",
    name: "Vertebrate Breed Ontology",
  }),
  artwork: Object.freeze({ aspectRatio: 3 / 2 }),
  exportFilePrefix: "stackrank-dogs",
  capabilities: Object.freeze({
    accountSync: true,
    publicSnapshots: true,
    rasterArtworkExport: false,
    liveSuggestions: false,
    textExport: true,
    artworkDisplay: true,
  }),
});

export const DOG_LIST_TYPES = Object.freeze(["curious", "not_for_me"]);

const cleanText = (value) => String(value || "").trim();

const displayNameKey = (value) => cleanText(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const INTERNAL_CATALOG_TOKEN_PATTERN = /\b(?:VBO|FCI|iDog|VeNom)\s*(?::|#|[-–—]\s*\d)/iu;
const RAW_ALIAS_ANNOTATION_PATTERN = /(?:\bunspecified\b|\bformerly\b|\bcolloquially\b|\bcalled\b|\bvariant spellings?\b|\bgroup\s+\d+\b)/iu;
const PLAIN_ALIAS_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'’&-]*$/u;

export function dogDisplayAliases(entity, { limit = 4 } = {}) {
  const maxAliases = Math.max(0, Number(limit) || 0);
  if (!maxAliases) return [];
  const canonicalKey = displayNameKey(entity?.displayName);
  const seen = new Set(canonicalKey ? [canonicalKey] : []);
  const aliases = [];
  for (const rawAlias of Array.isArray(entity?.aliases) ? entity.aliases : []) {
    const alias = cleanText(rawAlias).replace(/\s+/g, " ");
    const key = displayNameKey(alias);
    if (
      !alias ||
      alias.length > 80 ||
      /^https?:\/\//iu.test(alias) ||
      INTERNAL_CATALOG_TOKEN_PATTERN.test(alias) ||
      RAW_ALIAS_ANNOTATION_PATTERN.test(alias) ||
      /[()[\]{},:;/]/u.test(alias) ||
      /\s[-–—]\s/u.test(alias) ||
      !PLAIN_ALIAS_PATTERN.test(alias) ||
      !key ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    aliases.push(alias);
    if (aliases.length >= maxAliases) break;
  }
  return aliases;
}

export function dogEditorialDisplayText(value) {
  const text = cleanText(value);
  if (/(?:\bVBO\s*:|\bvbo-|\biDog\b|\bVeNom\b)/iu.test(text)) return "";
  return text
    .replace(/\bFCI\s+Group\s+(\d+)\b/giu, "International registry · Group $1")
    .replace(/\bFCI\s*[—–-]\s*Group\s+(\d+)\b/giu, "International registry · Group $1")
    .replace(/\bFCI\s+scheme\b/giu, "international registry scheme")
    .replace(/\bFCI\b/giu, "international breed registry");
}

export function dogRegistryCoverageLabel(entity) {
  const count = new Set((Array.isArray(entity?.registryRefs) ? entity.registryRefs : [])
    .map((ref) => cleanText(typeof ref === "string" ? ref.split(":", 1)[0] : ref?.scheme))
    .filter(Boolean)).size;
  if (!count) return "";
  return count === 1
    ? "Cross-referenced in a source catalog system"
    : `Cross-referenced across ${count} source catalog systems`;
}

export function dogArtworkObjectUrl(
  objectPath,
  {
    publicBaseUrl = "",
    storagePrefix = "dogs-catalog/",
  } = {},
) {
  const path = cleanText(objectPath);
  if (!path || path.includes("..")) return "";
  const prefix = cleanText(storagePrefix);
  if (!prefix || !path.startsWith(prefix)) return "";
  try {
    const base = new URL(cleanText(publicBaseUrl));
    const localDevelopmentBase =
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (
      (base.protocol !== "https:" && !localDevelopmentBase) ||
      (base.protocol === "https:" &&
        base.pathname !== "/storage/v1/object/public/") ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !base.pathname.endsWith("/")
    ) {
      return "";
    }
    return new URL(path, base).href;
  } catch {
    return "";
  }
}

export function dogPublicSnapshotArtworkUrl(value, {
  supabaseOrigin = "https://hrfhakrxsllrqmscxxpb.supabase.co",
} = {}) {
  try {
    const raw = cleanText(value);
    if (!raw || raw.includes("..") || raw.includes("%")) return "";
    const url = new URL(raw);
    const expectedOrigin = new URL(cleanText(supabaseOrigin));
    if (
      url.origin !== expectedOrigin.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/storage\/v1\/object\/public\/dogs-catalog\/[a-z0-9][a-z0-9./-]*\.webp$/.test(url.pathname) ||
      url.pathname.includes("..")
    ) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

export function dogDragAutoScrollDelta(pointerY, viewportHeight, {
  edge = 72,
  maxDelta = 22,
} = {}) {
  const y = Number(pointerY);
  const height = Number(viewportHeight);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(height) ||
    height <= 0 ||
    edge <= 0 ||
    maxDelta <= 0
  ) {
    return 0;
  }
  if (y < edge) return -Math.ceil(maxDelta * Math.min(1, (edge - y) / edge));
  if (y > height - edge) {
    return Math.ceil(maxDelta * Math.min(1, (y - (height - edge)) / edge));
  }
  return 0;
}

export function dogStatusLabel(status) {
  const labels = {
    canonical: "Breed or type",
    variety: "Variety",
    crossbreed: "Crossbreed or type",
    historical: "Historical breed or type",
  };
  return labels[status] || "Breed or type";
}

export function normalizeDogCatalogEntity(value) {
  const id = cleanText(value?.id);
  const displayName = cleanText(value?.displayName);
  const status = cleanText(value?.status).toLowerCase();
  if (
    !/^VBO:\d{7}$/.test(id) ||
    !displayName ||
    !["canonical", "variety", "crossbreed", "historical"].includes(status)
  ) {
    return null;
  }
  const cleanList = (items, limit = 24) =>
    [...new Set((Array.isArray(items) ? items : []).map(cleanText).filter(Boolean))].slice(0, limit);
  const relationships = value?.relationships && typeof value.relationships === "object"
    ? value.relationships
    : {};
  return {
    id,
    displayName,
    entityType: "dog",
    status,
    selectable: value?.selectable !== false,
    promoted: value?.promoted === true,
    aliases: cleanList(value?.aliases, 60),
    sourceIds: cleanList(value?.sourceIds, 60),
    registryRefs: (Array.isArray(value?.registryRefs) ? value.registryRefs : [])
      .map((ref) => {
        if (typeof ref === "string") {
          const separator = ref.indexOf(":");
          return separator > 0
            ? {
                scheme: cleanText(ref.slice(0, separator)),
                group: cleanText(ref.slice(separator + 1)),
              }
            : { scheme: "", group: "" };
        }
        return {
          scheme: cleanText(ref?.scheme),
          group: cleanText(ref?.group),
        };
      })
      .filter((ref) => ref.scheme && ref.group)
      .slice(0, 24),
    originRegions: cleanList(value?.originRegions, 12),
    tags: cleanList(value?.tags, 24),
    relationships: {
      parentId: /^VBO:\d{7}$/.test(cleanText(relationships.parentId))
        ? cleanText(relationships.parentId)
        : "",
      relatedIds: cleanList(relationships.relatedIds, 24).filter((relatedId) =>
        /^VBO:\d{7}$/.test(relatedId)),
    },
    primaryImageAssetId: cleanText(value?.primaryImageAssetId),
  };
}

export function dogEntityToCandidate(entity, image = null) {
  const normalized = normalizeDogCatalogEntity(entity);
  if (!normalized || !normalized.selectable) return null;
  const context = [
    normalized.originRegions[0],
    dogStatusLabel(normalized.status),
  ].filter(Boolean).join(" · ");
  return {
    entityRef: {
      domain: "dogs",
      type: "breed",
      source: "vbo",
      id: normalized.id,
    },
    snapshot: {
      primaryText: normalized.displayName,
      secondaryText: context,
      year: null,
      image: {
        url: cleanText(image?.url),
        alt: cleanText(image?.alt) || `${normalized.displayName} dog`,
        assetId: cleanText(image?.assetId),
      },
    },
    catalog: normalized,
  };
}

export function canonicalizeDogStoredState(
  value,
  catalogEntities,
) {
  const canonicalBySourceId = new Map();
  const ambiguousSourceIds = new Set();
  (Array.isArray(catalogEntities) ? catalogEntities : []).forEach((record) => {
    const entity = normalizeDogCatalogEntity(record);
    if (!entity || !entity.selectable) return;
    [entity.id, ...entity.sourceIds].forEach((sourceId) => {
      if (!/^VBO:\d{7}$/.test(sourceId) || ambiguousSourceIds.has(sourceId)) return;
      const existing = canonicalBySourceId.get(sourceId);
      if (existing && existing.id !== entity.id) {
        canonicalBySourceId.delete(sourceId);
        ambiguousSourceIds.add(sourceId);
        return;
      }
      canonicalBySourceId.set(sourceId, entity);
    });
  });

  let remapped = 0;
  let refreshed = 0;
  let deduplicated = 0;
  const claimed = new Set();
  const normalizeList = (items) => {
    const normalized = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      const oldId = String(item?.entityRef?.id || "").trim();
      const entity = canonicalBySourceId.get(oldId);
      let next = createRankedEntity(item);
      if (entity) {
        const candidate = dogEntityToCandidate(entity);
        next = createRankedEntity({
          ...candidate,
          rankedAt: item?.rankedAt,
          comparisons: item?.comparisons,
        });
        if (oldId !== entity.id) remapped += 1;
        if (
          next &&
          (item?.snapshot?.primaryText !== next.snapshot.primaryText ||
            item?.snapshot?.secondaryText !== next.snapshot.secondaryText ||
            item?.snapshot?.image?.url)
        ) {
          refreshed += 1;
        }
      }
      const key = entityRefKey(next);
      if (!next || next.entityRef.domain !== "dogs" || !key) return;
      if (claimed.has(key)) {
        deduplicated += 1;
        return;
      }
      claimed.add(key);
      normalized.push(next);
    });
    return normalized;
  };

  const ranking = normalizeList(value?.ranking);
  const curious = normalizeList(value?.lists?.curious);
  const notForMe = normalizeList(value?.lists?.not_for_me);
  return {
    ranking,
    lists: { curious, not_for_me: notForMe },
    remapped,
    refreshed,
    deduplicated,
    changed: remapped > 0 || refreshed > 0 || deduplicated > 0,
  };
}
