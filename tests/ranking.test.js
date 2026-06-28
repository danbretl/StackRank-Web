import { test } from "node:test";
import assert from "node:assert/strict";
import { comparisonMidIndex, firstComparisonIndex, applyComparison, isSearchSettled, resolveInsertionIndex } from "../lib/ranking.js";

test("comparisonMidIndex floors the midpoint", () => {
  assert.equal(comparisonMidIndex({ low: 0, high: 0 }), 0);
  assert.equal(comparisonMidIndex({ low: 0, high: 9 }), 4);
  assert.equal(comparisonMidIndex({ low: 3, high: 6 }), 4);
});

test("firstComparisonIndex degenerate cases collapse to the midpoint", () => {
  assert.equal(firstComparisonIndex(0), 0);
  assert.equal(firstComparisonIndex(1), 0);
  // count=2 → spread = round(0.36) = 0, so no jitter possible.
  assert.equal(firstComparisonIndex(2), comparisonMidIndex({ low: 0, high: 1 }));
});

test("firstComparisonIndex centers on the midpoint and clamps to bounds", () => {
  const count = 20;
  const mid = comparisonMidIndex({ low: 0, high: count - 1 });
  // randomFn 0 → most-negative offset, 1-eps → most-positive offset.
  assert.equal(firstComparisonIndex(count, () => 0.5), mid, "centered random → midpoint");
  const low = firstComparisonIndex(count, () => 0);
  const high = firstComparisonIndex(count, () => 0.999999);
  assert.ok(low < mid && low >= 0, "min random sits below the midpoint, in bounds");
  assert.ok(high > mid && high <= count - 1, "max random sits above the midpoint, in bounds");
});

test("firstComparisonIndex spread grows with list size and stays in bounds", () => {
  for (const count of [5, 10, 50, 200]) {
    const mid = comparisonMidIndex({ low: 0, high: count - 1 });
    const expectedSpread = Math.round(count * 0.18);
    let min = Infinity;
    let max = -Infinity;
    // Sweep the random domain so every reachable index is observed.
    for (let r = 0; r < 1; r += 0.001) {
      const idx = firstComparisonIndex(count, () => r);
      assert.ok(idx >= 0 && idx <= count - 1, `in bounds count=${count} r=${r}`);
      min = Math.min(min, idx);
      max = Math.max(max, idx);
    }
    assert.equal(max - mid, expectedSpread, `+spread reachable for count=${count}`);
    assert.equal(mid - min, expectedSpread, `-spread reachable for count=${count}`);
  }
});

test("applyComparison narrows to the correct half", () => {
  assert.deepEqual(applyComparison({ low: 0, high: 9 }, true, 4), { low: 0, high: 3 }, "better → upper half");
  assert.deepEqual(applyComparison({ low: 0, high: 9 }, false, 4), { low: 5, high: 9 }, "worse → lower half");
});

test("isSearchSettled fires when the range collapses", () => {
  assert.equal(isSearchSettled({ low: 2, high: 1 }), true);
  assert.equal(isSearchSettled({ low: 2, high: 2 }), false);
  assert.equal(isSearchSettled({ low: 0, high: 0 }), false);
});

// The defining correctness property: against a fully-ordered list, inserting a
// value lands at the index that keeps the list sorted — for EVERY target slot
// and every list size.
test("resolveInsertionIndex lands at the sorted position for every slot", () => {
  for (let count = 0; count <= 30; count += 1) {
    // The existing list holds values [0, 2, 4, ... ] (even numbers), already
    // ranked best→worst as ascending values. Insert an odd value `target*2 - 1`
    // so the correct index is unambiguous (never equal to an existing value).
    const existing = Array.from({ length: count }, (_, i) => i * 2);
    for (let slot = 0; slot <= count; slot += 1) {
      const newValue = slot * 2 - 1; // sits just before existing[slot]
      // "new is better than mid" === new sorts before existing[mid] (smaller).
      const { index, comparisons } = resolveInsertionIndex(count, (mid) => newValue < existing[mid]);
      assert.equal(index, slot, `count=${count} slot=${slot}`);
      // Inserting there keeps the array sorted ascending.
      const after = [...existing.slice(0, index), newValue, ...existing.slice(index)];
      assert.deepEqual(after, [...after].sort((a, b) => a - b), `sorted after insert (count=${count} slot=${slot})`);
      // Binary search never exceeds ceil(log2(count+1)) comparisons.
      if (count > 0) {
        assert.ok(comparisons <= Math.ceil(Math.log2(count + 1)), `comparisons ${comparisons} bounded for count=${count}`);
      }
    }
  }
});

test("resolveInsertionIndex: empty list inserts at 0 with no comparisons", () => {
  const { index, comparisons } = resolveInsertionIndex(0, () => true);
  assert.equal(index, 0);
  assert.equal(comparisons, 0);
});

test("resolveInsertionIndex: always-better goes to the top, always-worse to the bottom", () => {
  assert.equal(resolveInsertionIndex(7, () => true).index, 0);
  assert.equal(resolveInsertionIndex(7, () => false).index, 7);
});

test("a full search reproduces by hand for a size-3 list", () => {
  // List [A,B,C] ranked 0,1,2. New item beats B, loses to A → lands at index 1.
  // mid of [0,2] = 1 (B). better → range [0,0]. mid 0 (A). worse → range [1,0] → settle at 1.
  let range = { low: 0, high: 2 };
  let mid = comparisonMidIndex(range);
  assert.equal(mid, 1);
  range = applyComparison(range, true, mid); // beats B
  assert.deepEqual(range, { low: 0, high: 0 });
  mid = comparisonMidIndex(range);
  assert.equal(mid, 0);
  range = applyComparison(range, false, mid); // loses to A
  assert.ok(isSearchSettled(range));
  assert.equal(range.low, 1);
});
