import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReviewQueue } from "../lib/review.js";

// Helper: a ranking of `n` movies with sequential tmdbIds and optional rankedAt.
const makeRanking = (n, times = {}) =>
  Array.from({ length: n }, (_, i) => ({
    tmdbId: i + 1,
    title: `Movie ${i + 1}`,
    ...(times[i] ? { rankedAt: times[i] } : {}),
  }));

test("returns no pairs for lists shorter than two", () => {
  assert.deepEqual(buildReviewQueue([]), []);
  assert.deepEqual(buildReviewQueue([{ tmdbId: 1 }]), []);
  assert.deepEqual(buildReviewQueue(null), []);
});

test("pair indices are always valid (0..n-2) and unique", () => {
  const ranking = makeRanking(10);
  const queue = buildReviewQueue(ranking, { max: 8 });
  assert.ok(queue.length > 0);
  assert.equal(new Set(queue).size, queue.length, "no duplicate pairs");
  for (const i of queue) {
    assert.ok(i >= 0 && i <= ranking.length - 2, `pair index ${i} in range`);
  }
});

test("queue is capped by max and by the number of available pairs", () => {
  assert.equal(buildReviewQueue(makeRanking(20), { max: 5 }).length, 5);
  // 3 movies → only 2 adjacent pairs exist, so max can't exceed 2.
  assert.equal(buildReviewQueue(makeRanking(3), { max: 8 }).length, 2);
});

test("focus movie's adjacent pairs come first", () => {
  const ranking = makeRanking(10);
  // Focus on the movie at index 5 (tmdbId 6): its pairs are 4 (5↔6) and 5 (6↔7).
  const queue = buildReviewQueue(ranking, { focusTmdbId: 6, max: 6 });
  assert.deepEqual(queue.slice(0, 2), [4, 5]);
});

test("a focus movie at the top contributes only its one valid pair first", () => {
  const ranking = makeRanking(6);
  // index 0 → pair (-1 invalid) and (0). Only pair 0 is valid.
  const queue = buildReviewQueue(ranking, { focusTmdbId: 1, max: 4 });
  assert.equal(queue[0], 0);
});

test("recently-ranked movies are prioritized after focus", () => {
  // Movie at index 7 is the newest by rankedAt; with no focus, its pairs lead.
  const ranking = makeRanking(10, {
    7: "2026-06-28T12:00:00.000Z",
    2: "2026-06-20T12:00:00.000Z",
  });
  const queue = buildReviewQueue(ranking, { max: 6 });
  // Pairs touching index 7 are 6 and 7; they should appear before index-2 pairs.
  assert.ok(queue.indexOf(6) !== -1 && queue.indexOf(7) !== -1);
  assert.ok(Math.min(queue.indexOf(6), queue.indexOf(7)) < queue.indexOf(1));
});

test("falls back to a spread when there is no recency or focus signal", () => {
  const ranking = makeRanking(12); // no rankedAt anywhere
  const queue = buildReviewQueue(ranking, { max: 4 });
  assert.equal(queue.length, 4);
  assert.equal(new Set(queue).size, 4);
  // Spread should not be four pairs bunched at the very top.
  assert.ok(Math.max(...queue) >= 3, "spread reaches past the first few pairs");
});

test("is deterministic for the same input", () => {
  const ranking = makeRanking(15, { 3: "2026-06-27T00:00:00.000Z" });
  const a = buildReviewQueue(ranking, { focusTmdbId: 9, max: 7 });
  const b = buildReviewQueue(ranking, { focusTmdbId: 9, max: 7 });
  assert.deepEqual(a, b);
});
