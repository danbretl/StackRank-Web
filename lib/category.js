// Shared category resolution and storage-key helpers.
//
// Keep this layer deliberately small: it defines category-safe routing and
// persistence namespaces, but it does not pretend that every ranked thing has
// the same metadata, catalog, details, or recommendation model.

const CATEGORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCategoryId(value) {
  return typeof value === "string" && CATEGORY_ID_PATTERN.test(value);
}

export function canonicalCategoryPath(category) {
  if (!category || !isValidCategoryId(category.id)) return null;
  const path = String(category.path || "");
  return path === `/${category.id}` ? path : null;
}

export function categoryForPath(pathname, registry = []) {
  const path = String(pathname || "").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return (
    (Array.isArray(registry) ? registry : []).find((category) => {
      const categoryPath = canonicalCategoryPath(category);
      return Boolean(
        categoryPath &&
          (path === categoryPath || path.startsWith(`${categoryPath}/`)),
      );
    }) || null
  );
}

// Resolve the category declared by a static document. A document marker is
// required so an unknown future path can never silently read Movies data. Root
// remains valid for the current root-based local development server.
export function resolveDocumentCategory({ marker, pathname } = {}, registry = []) {
  const category = (Array.isArray(registry) ? registry : []).find(
    (candidate) => candidate?.id === marker,
  );
  if (!category || !canonicalCategoryPath(category)) return null;
  const pathCategory = categoryForPath(pathname, registry);
  if (pathCategory) return pathCategory.id === category.id ? category : null;
  const normalizedPath = String(pathname || "").replace(/\/+$/, "") || "/";
  return (category.documentPathAliases || []).includes(normalizedPath)
    ? category
    : null;
}

export function categoryStorageKeys(category) {
  if (!category || !isValidCategoryId(category.id)) return null;
  const id = category.id;
  const overrides = category.storage || {};
  return Object.freeze({
    ranking: overrides.ranking || `stackrank:${id}:ranking:v1`,
    queues: overrides.queues || `stackrank:${id}:queues:v1`,
    packProgress: overrides.packProgress || `stackrank:${id}:pack-progress:v1`,
    backupNudge: overrides.backupNudge || `stackrank:${id}:backup-nudge:v1`,
    shareOptions: overrides.shareOptions || `stackrank:${id}:share-options:v1`,
    rankingView: overrides.rankingView || `stackrank:${id}:ranking-view:v1`,
    appDestination: overrides.appDestination || `stackrank:${id}:app-destination:v1`,
    suggestionSeed: overrides.suggestionSeed || `stackrank:${id}:suggestion-seed:v1`,
  });
}

export function userScopedStorageCandidates(storageKey, userId) {
  if (typeof storageKey !== "string" || !storageKey) return [];
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId
    ? [`${storageKey}:user:${normalizedUserId}`, storageKey]
    : [storageKey];
}
