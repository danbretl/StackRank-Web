const CATALOG_ID = /^VBO:\d{7}$/u;
const WEBP_URL = /^assets\/dogs\/generated\/[a-zA-Z0-9._/-]+\.webp$/u;

const itemId = (item) => item?.entityRef?.id;

const validVariant = (variant, role) =>
  variant?.role === role &&
  variant.mime === "image/webp" &&
  Number.isInteger(variant.width) && variant.width > 0 &&
  Number.isInteger(variant.height) && variant.height > 0 &&
  typeof variant.url === "string" && WEBP_URL.test(variant.url) &&
  !variant.url.includes("..");

/** IDs fully ready for discovery on the main Dogs site. The source documents remain intact. */
export function completedDogCatalogIds({ entities, profiles, artwork } = {}) {
  const result = new Set();
  const profileById = profiles?.profiles;
  const assets = artwork?.assets;
  if (!Array.isArray(entities) || !profileById || typeof profileById !== "object" || !Array.isArray(assets)) return result;

  const validAssets = new Map();
  const duplicateAssetIds = new Set();
  for (const asset of assets) {
    const id = asset?.catalogId;
    if (typeof id !== "string" || !CATALOG_ID.test(id)) continue;
    if (validAssets.has(id)) duplicateAssetIds.add(id);
    validAssets.set(id, asset);
  }

  for (const entity of entities) {
    const id = entity?.id;
    if (typeof id !== "string" || !CATALOG_ID.test(id) || entity.selectable !== true || duplicateAssetIds.has(id)) continue;
    const profile = Object.hasOwn(profileById, id) ? profileById[id] : null;
    if (profile?.reviewStatus !== "editor-reviewed" || typeof profile.summary !== "string" || !profile.summary.trim()) continue;
    if (profile.catalogId && profile.catalogId !== id) continue;
    const asset = validAssets.get(id);
    if (
      asset?.sourceType !== "ai-generated" ||
      asset.review?.status !== "approved" ||
      asset.uiDisplayAllowed !== true ||
      asset.publicSnapshotAllowed !== false ||
      asset.rasterExportAllowed !== false ||
      !Array.isArray(asset.variants) ||
      !asset.variants.some((variant) => validVariant(variant, "card")) ||
      !asset.variants.some((variant) => validVariant(variant, "detail"))
    ) continue;
    result.add(id);
  }
  return result;
}

/** View of completed items that preserves each item's index in the stored ranking. */
export function projectPublicDogRanking(items, ids) {
  if (!Array.isArray(items) || !(ids instanceof Set)) return [];
  const visible = [];
  items.forEach((item, index) => {
    if (ids.has(itemId(item))) visible.push({ item, index, publicIndex: visible.length });
  });
  return visible;
}

/** Insert at a public rank while retaining every hidden item in its original relative order. */
export function insertPublicDogRanking(items, ids, item, publicInsertionIndex) {
  if (!Array.isArray(items) || !(ids instanceof Set) || !ids.has(itemId(item))) return null;
  if (items.some((existing) => itemId(existing) === itemId(item))) return null;
  const visible = projectPublicDogRanking(items, ids);
  if (!Number.isInteger(publicInsertionIndex) || publicInsertionIndex < 0 || publicInsertionIndex > visible.length) return null;
  const fullIndex = publicInsertionIndex < visible.length
    ? visible[publicInsertionIndex].index
    : visible.length ? visible.at(-1).index + 1 : items.length;
  const next = [...items];
  next.splice(fullIndex, 0, item);
  return next;
}

/** Reorder only public slots; hidden entries and their positions remain untouched. */
export function reorderPublicDogRanking(items, ids, reorderedVisibleItems) {
  if (!Array.isArray(items) || !(ids instanceof Set) || !Array.isArray(reorderedVisibleItems)) return null;
  const visible = projectPublicDogRanking(items, ids);
  if (reorderedVisibleItems.length !== visible.length) return null;
  const originalById = new Map();
  for (const { item } of visible) {
    const id = itemId(item);
    if (!id || originalById.has(id)) return null;
    originalById.set(id, item);
  }
  const seen = new Set();
  const replacement = [];
  for (const candidate of reorderedVisibleItems) {
    const id = itemId(candidate);
    if (!originalById.has(id) || seen.has(id)) return null;
    seen.add(id);
    replacement.push(originalById.get(id));
  }
  const next = [...items];
  visible.forEach(({ index }, publicIndex) => { next[index] = replacement[publicIndex]; });
  return next;
}
