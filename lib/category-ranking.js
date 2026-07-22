import { entityRefKey } from "./entity.js?v=1";

const validDateValue = (value) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveIndex = (ranking, entityOrKey) => {
  const key = typeof entityOrKey === "string"
    ? entityOrKey
    : entityRefKey(entityOrKey);
  if (!key) return -1;
  return ranking.findIndex((item) => entityRefKey(item) === key);
};

export function moveRankedEntity(ranking, entityOrKey, toIndex) {
  const items = Array.isArray(ranking) ? [...ranking] : [];
  const fromIndex = resolveIndex(items, entityOrKey);
  if (
    fromIndex < 0 ||
    !Number.isInteger(toIndex) ||
    toIndex < 0 ||
    toIndex >= items.length ||
    toIndex === fromIndex
  ) {
    return { items, changed: false, fromIndex, toIndex: fromIndex };
  }
  const [item] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, item);
  return { items, changed: true, item, fromIndex, toIndex };
}

export function removeRankedEntity(ranking, entityOrKey) {
  const items = Array.isArray(ranking) ? [...ranking] : [];
  const index = resolveIndex(items, entityOrKey);
  if (index < 0) return { items, changed: false, index };
  const [item] = items.splice(index, 1);
  return { items, changed: true, item, index };
}

export function recentRankedEntities(ranking, limit = 3) {
  const count = Number.isInteger(limit) && limit > 0 ? limit : 0;
  if (!count) return [];
  return (Array.isArray(ranking) ? ranking : [])
    .map((item, index) => ({ item, index, timestamp: validDateValue(item?.rankedAt) }))
    .filter(({ timestamp }) => timestamp !== null)
    .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index)
    .slice(0, count)
    .map(({ item, index }) => ({ item, rank: index + 1 }));
}

export function categoryRankingStats(ranking) {
  const items = Array.isArray(ranking) ? ranking : [];
  const dated = items
    .map((item) => ({ item, timestamp: validDateValue(item?.rankedAt) }))
    .filter(({ timestamp }) => timestamp !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
  return {
    count: items.length,
    top: items[0] || null,
    totalComparisons: items.reduce((sum, item) => {
      const comparisons = Number(item?.comparisons);
      return sum + (Number.isInteger(comparisons) && comparisons >= 0 ? comparisons : 0);
    }, 0),
    latestRankedAt: dated[0]?.item?.rankedAt || null,
  };
}
