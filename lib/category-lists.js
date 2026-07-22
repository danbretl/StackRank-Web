import { entityRefKey, normalizeEntityRef } from "./entity.js?v=1";

const LIST_TYPE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const normalizeListTypes = (listTypes) =>
  [...new Set((Array.isArray(listTypes) ? listTypes : [])
    .map((type) => String(type || "").trim())
    .filter((type) => LIST_TYPE_PATTERN.test(type) && type !== "ranking"))];

const matchesDomain = (item, domain) => {
  const ref = normalizeEntityRef(item?.entityRef || item);
  return Boolean(ref && (!domain || ref.domain === domain));
};

const uniqueItems = (items, seen, domain) => {
  const result = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = entityRefKey(item);
    if (!key || seen.has(key) || !matchesDomain(item, domain)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
};

export function normalizeCategoryListState(
  state,
  { domain = "", listTypes = [] } = {},
) {
  const types = normalizeListTypes(listTypes);
  const normalizedDomain = String(domain || "").trim().toLowerCase();
  const seen = new Set();
  const ranking = uniqueItems(state?.ranking, seen, normalizedDomain);
  const lists = Object.fromEntries(
    types.map((type) => [type, uniqueItems(state?.lists?.[type], seen, normalizedDomain)]),
  );
  return { ranking, lists };
}

export function transitionCategoryEntity(
  state,
  { entity, to = null, index = null } = {},
  options = {},
) {
  const normalized = normalizeCategoryListState(state, options);
  const types = normalizeListTypes(options.listTypes);
  const key = entityRefKey(entity);
  if (!key || !matchesDomain(entity, String(options.domain || "").toLowerCase())) {
    return { state: normalized, changed: false, reason: "invalid-entity" };
  }
  if (to !== null && to !== "ranking" && !types.includes(to)) {
    return { state: normalized, changed: false, reason: "invalid-destination" };
  }
  if (to === "ranking" && !Number.isInteger(index)) {
    return { state: normalized, changed: false, reason: "ranking-index-required" };
  }
  if (
    to !== null &&
    to !== "ranking" &&
    !Number.isInteger(index) &&
    normalized.lists[to].some((item) => entityRefKey(item) === key)
  ) {
    return {
      state: normalized,
      changed: false,
      reason: "unchanged",
      removedFrom: [to],
      addedTo: to,
    };
  }

  let existing = null;
  const removedFrom = [];
  let ranking = normalized.ranking.filter((item) => {
    if (entityRefKey(item) !== key) return true;
    existing ||= item;
    removedFrom.push("ranking");
    return false;
  });
  const lists = Object.fromEntries(types.map((type) => {
    const items = normalized.lists[type].filter((item) => {
      if (entityRefKey(item) !== key) return true;
      existing ||= item;
      removedFrom.push(type);
      return false;
    });
    return [type, items];
  }));

  const nextEntity = existing || entity;
  if (to === "ranking") {
    const insertionIndex = Math.max(0, Math.min(ranking.length, index));
    ranking.splice(insertionIndex, 0, nextEntity);
  } else if (to !== null) {
    const insertionIndex = Number.isInteger(index)
      ? Math.max(0, Math.min(lists[to].length, index))
      : lists[to].length;
    lists[to].splice(insertionIndex, 0, nextEntity);
  }

  const sameItems = (left, right) =>
    left.length === right.length &&
    left.every((item, itemIndex) => entityRefKey(item) === entityRefKey(right[itemIndex]));
  const changed =
    !sameItems(normalized.ranking, ranking) ||
    types.some((type) => !sameItems(normalized.lists[type], lists[type]));
  return {
    state: { ranking, lists },
    changed,
    reason: changed ? "transitioned" : "unchanged",
    removedFrom,
    addedTo: to,
  };
}

export function removeCategoryEntity(state, entity, options = {}) {
  return transitionCategoryEntity(state, { entity, to: null }, options);
}
