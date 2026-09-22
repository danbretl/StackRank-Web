export const ARTWORK_REVIEW_STORAGE_KEY = "stackrank:dogs:artwork-review:v1";
export const ARTWORK_REVIEW_PAGE_SIZE = 24;

export const ARTWORK_REVIEW_CONCERNS = Object.freeze([
  { id: "breedIdentity", label: "Breed identity" },
  { id: "anatomy", label: "Anatomy" },
  { id: "framing", label: "Framing" },
  { id: "scene", label: "Scene" },
  { id: "other", label: "Other" },
]);

const VALID_CONCERNS = new Set(ARTWORK_REVIEW_CONCERNS.map(({ id }) => id));
const cleanText = (value, maxLength = 2000) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export function normalizeArtworkReviewState(value) {
  const reviews = {};
  if (value && typeof value === "object" && value.reviews && typeof value.reviews === "object") {
    for (const [assetId, review] of Object.entries(value.reviews)) {
      if (!assetId || !review || typeof review !== "object") continue;
      const concerns = [...new Set(Array.isArray(review.concerns) ? review.concerns : [])]
        .filter((concern) => VALID_CONCERNS.has(concern));
      const note = cleanText(review.note);
      if (!concerns.length && !note) continue;
      reviews[assetId] = {
        concerns,
        note,
        updatedAt: cleanText(review.updatedAt, 80) || null,
        masterSha256: cleanText(review.masterSha256, 80) || null,
        generatedAt: cleanText(review.generatedAt, 80) || null,
      };
    }
  }
  return { schemaVersion: 1, reviews };
}

export function isArtworkFlagged(review) {
  return Boolean(review && (review.concerns?.length || cleanText(review.note)));
}

export function setArtworkReview(state, assetId, review, updatedAt = new Date().toISOString()) {
  const next = normalizeArtworkReviewState(state);
  const concerns = [...new Set(Array.isArray(review?.concerns) ? review.concerns : [])]
    .filter((concern) => VALID_CONCERNS.has(concern));
  const note = cleanText(review?.note);
  if (!concerns.length && !note) delete next.reviews[assetId];
  else next.reviews[assetId] = {
    concerns,
    note,
    updatedAt,
    masterSha256: cleanText(review?.masterSha256, 80) || null,
    generatedAt: cleanText(review?.generatedAt, 80) || null,
  };
  return next;
}

export function clearArtworkReview(state, assetId) {
  const next = normalizeArtworkReviewState(state);
  delete next.reviews[assetId];
  return next;
}

export function filterArtworkAssets(assets, { query = "", flaggedOnly = false, reviews = {} } = {}) {
  const needle = cleanText(query, 200).toLocaleLowerCase();
  return assets.filter((asset) => {
    if (flaggedOnly && !isArtworkFlagged(reviews[asset.assetId])) return false;
    if (!needle) return true;
    const haystack = [asset.name, asset.catalogId, ...(asset.aliases || [])]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function paginateArtworkAssets(assets, page, pageSize = ARTWORK_REVIEW_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(assets.length / pageSize));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: assets.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    totalPages,
    totalItems: assets.length,
    start: assets.length ? start + 1 : 0,
    end: Math.min(start + pageSize, assets.length),
  };
}

export function preferredArtworkVariant(asset, role = "detail") {
  const variants = Array.isArray(asset?.variants) ? asset.variants : [];
  return variants.find((variant) => variant.role === role)
    || variants.find((variant) => variant.role === "detail")
    || variants.find((variant) => variant.role === "card")
    || null;
}

export function isArtworkReviewStale(review, asset) {
  if (!review || !asset) return false;
  return Boolean(
    (review.masterSha256 && asset.masterSha256 && review.masterSha256 !== asset.masterSha256)
    || (review.generatedAt && asset.generatedAt && review.generatedAt !== asset.generatedAt)
  );
}

export function buildArtworkReviewExport({ state, assets, manifestVersion, exportedAt = new Date().toISOString() }) {
  const normalized = normalizeArtworkReviewState(state);
  const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
  const reviews = Object.entries(normalized.reviews)
    .map(([assetId, review]) => {
      const asset = byId.get(assetId);
      if (!asset) return null;
      return {
        assetId,
        catalogId: asset.catalogId,
        name: asset.name,
        masterSha256: review.masterSha256 || asset.masterSha256 || null,
        generatedAt: review.generatedAt || asset.generatedAt || null,
        currentMasterSha256: asset.masterSha256 || null,
        currentGeneratedAt: asset.generatedAt || null,
        stale: isArtworkReviewStale(review, asset),
        concerns: [...review.concerns],
        note: review.note,
        reviewedAt: review.updatedAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name) || left.assetId.localeCompare(right.assetId));
  return {
    schemaVersion: 1,
    type: "stackrank-dogs-artwork-review",
    manifestVersion: manifestVersion || null,
    exportedAt,
    reviewCount: reviews.length,
    reviews,
  };
}
