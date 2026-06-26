// The binary-insertion search at the heart of ranking.
//
// Adding a movie runs a binary search over the existing (sorted-by-preference)
// list: repeatedly compare the new movie against the midpoint and narrow a
// [low, high] range until it collapses, then insert at `low`. These pure helpers
// own that arithmetic so the most important correctness property in the app —
// "a new movie lands in exactly the right slot" — is unit-testable, while app.js
// keeps the DOM/comparison-card wiring around them.

// The index to show next, given the current search range.
export function comparisonMidIndex(range) {
  return Math.floor((range.low + range.high) / 2);
}

// Narrow the range after a decision. `isNewBetter` true means the new movie
// outranks the midpoint, so it belongs above it (search the upper half).
export function applyComparison(range, isNewBetter, midIndex) {
  return isNewBetter
    ? { low: range.low, high: midIndex - 1 }
    : { low: midIndex + 1, high: range.high };
}

// The search is done once the range collapses; the insertion index is `low`.
export function isSearchSettled(range) {
  return range.low > range.high;
}

// Convenience used by tests (and any non-interactive caller): run the whole
// search against a comparator. `isNewBetterThan(midIndex)` returns true when the
// new item should sit above the item at `midIndex`. Returns the final insertion
// index and how many comparisons it took.
export function resolveInsertionIndex(count, isNewBetterThan) {
  let range = { low: 0, high: count - 1 };
  let comparisons = 0;
  while (!isSearchSettled(range)) {
    const mid = comparisonMidIndex(range);
    const better = isNewBetterThan(mid);
    comparisons += 1;
    range = applyComparison(range, better, mid);
  }
  return { index: range.low, comparisons };
}
