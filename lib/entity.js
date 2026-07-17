// Minimal, provider-qualified identity and display snapshots for new StackRank
// categories. Movies intentionally keeps its proven legacy record shape until a
// real migration is justified; new categories can use this envelope without
// teaching ranking mechanics about books, games, or dog breeds.

const ID_PART_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const DOMAIN_PART_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cleanText = (value) => String(value || "").trim();

export function normalizeEntityRef(value) {
  const domain = cleanText(value?.domain).toLowerCase();
  const type = cleanText(value?.type).toLowerCase();
  const source = cleanText(value?.source).toLowerCase();
  const id = cleanText(value?.id);
  if (
    !DOMAIN_PART_PATTERN.test(domain) ||
    !DOMAIN_PART_PATTERN.test(type) ||
    !DOMAIN_PART_PATTERN.test(source) ||
    !ID_PART_PATTERN.test(id)
  ) {
    return null;
  }
  return { domain, type, source, id };
}

export function entityRefKey(value) {
  const ref = normalizeEntityRef(value?.entityRef || value);
  return ref ? `${ref.domain}:${ref.type}:${ref.source}:${ref.id}` : "";
}

export function normalizeEntitySnapshot(value) {
  const primaryText = cleanText(value?.primaryText);
  if (!primaryText) return null;
  const year = Number(value?.year);
  const image = value?.image && typeof value.image === "object"
    ? {
        url: cleanText(value.image.url),
        alt: cleanText(value.image.alt),
        assetId: cleanText(value.image.assetId),
      }
    : { url: "", alt: "", assetId: "" };
  return {
    primaryText,
    secondaryText: cleanText(value?.secondaryText),
    year: Number.isInteger(year) && year > 0 ? year : null,
    image,
  };
}

export function createRankedEntity({
  entityRef,
  snapshot,
  rankedAt = null,
  comparisons = 0,
} = {}) {
  const normalizedRef = normalizeEntityRef(entityRef);
  const normalizedSnapshot = normalizeEntitySnapshot(snapshot);
  if (!normalizedRef || !normalizedSnapshot) return null;
  const comparisonCount = Number(comparisons);
  return {
    entityRef: normalizedRef,
    snapshot: normalizedSnapshot,
    rankedAt: typeof rankedAt === "string" && rankedAt ? rankedAt : null,
    comparisons:
      Number.isInteger(comparisonCount) && comparisonCount >= 0
        ? comparisonCount
        : 0,
  };
}

export function isDuplicateEntity(list, candidate) {
  const key = entityRefKey(candidate);
  if (!key) return false;
  return (Array.isArray(list) ? list : []).some((item) => entityRefKey(item) === key);
}

export function mergeEntityRankings(baseList, incomingList) {
  const merged = [...(Array.isArray(baseList) ? baseList : [])];
  const seen = new Set(merged.map(entityRefKey).filter(Boolean));
  (Array.isArray(incomingList) ? incomingList : []).forEach((item) => {
    const key = entityRefKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged;
}
