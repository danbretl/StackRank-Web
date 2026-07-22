import {
  applyComparison,
  comparisonMidIndex,
  firstComparisonIndex,
  isSearchSettled,
} from "./ranking.js?v=2";

// A DOM-free binary-insertion session for new category surfaces. The existing
// Movies flow stays untouched until this state machine has proven itself in a
// second category and can be migrated with browser regressions around undo,
// cancel, queues, and scroll restoration.

export function createRankSession({
  item,
  rankingLength,
  randomFn = Math.random,
} = {}) {
  const count = Math.max(0, Number(rankingLength) || 0);
  if (!item) return null;
  if (count === 0) {
    return {
      status: "settled",
      item,
      rankingLength: 0,
      comparisons: 0,
      insertionIndex: 0,
    };
  }
  return {
    status: "comparing",
    item,
    rankingLength: count,
    comparisons: 0,
    range: { low: 0, high: count - 1 },
    comparisonIndex: firstComparisonIndex(count, randomFn),
  };
}

export function advanceRankSession(session, newItemWins) {
  if (!session || session.status !== "comparing") return session;
  const comparisons = session.comparisons + 1;
  const range = applyComparison(
    session.range,
    Boolean(newItemWins),
    session.comparisonIndex,
  );
  if (isSearchSettled(range)) {
    return {
      status: "settled",
      item: session.item,
      rankingLength: session.rankingLength,
      comparisons,
      insertionIndex: range.low,
    };
  }
  return {
    ...session,
    comparisons,
    range,
    comparisonIndex: comparisonMidIndex(range),
  };
}

export function insertSettledRankSession(ranking, session, mapItem = (item) => item) {
  if (!session || session.status !== "settled") return null;
  const items = Array.isArray(ranking) ? ranking : [];
  if (items.length !== session.rankingLength) return null;
  const next = [...items];
  next.splice(
    session.insertionIndex,
    0,
    mapItem(session.item, {
      comparisons: session.comparisons,
      insertionIndex: session.insertionIndex,
    }),
  );
  return next;
}
