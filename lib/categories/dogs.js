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
    accountSync: false,
    publicSnapshots: false,
    rasterArtworkExport: false,
    liveSuggestions: false,
    textExport: true,
    artworkDisplay: true,
  }),
});

export const DOG_LIST_TYPES = Object.freeze(["curious", "not_for_me"]);

const cleanText = (value) => String(value || "").trim();

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
      .map((ref) => ({ scheme: cleanText(ref?.scheme), group: cleanText(ref?.group) }))
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
