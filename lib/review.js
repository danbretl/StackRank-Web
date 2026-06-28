// Review-mode pair selection — the queue behind "Review ranking".
//
// Ranking review is an audit pass over an existing list: the app surfaces a
// short series of adjacent pairs (movie #N vs #N+1) and asks whether each order
// still holds, swapping neighbors in place. This module owns the one piece of
// real logic — which pairs to ask about, in what order — so the product rule
// ("favor pairs near recent additions, then spread for coverage, capped") is
// unit-testable. It is DOM-free; app.js binds it to live ranking state and the
// comparison-card UI.
//
// A "pair" is identified by its lower index `i` (comparing ranking[i] vs
// ranking[i+1]). For a list of length n the valid pair indices are 0..n-2.

// Parse a movie's rankedAt timestamp to a number, or null when missing/invalid.
function rankedTime(movie) {
  if (!movie || !movie.rankedAt) return null;
  const t = Date.parse(movie.rankedAt);
  return Number.isNaN(t) ? null : t;
}

// Build an ordered, de-duplicated queue of adjacent-pair indices to review.
//
// Order of priority:
//   1. Pairs touching the focus movie (the just-added title), if present.
//   2. Pairs touching the most-recently-ranked movies (by `rankedAt`).
//   3. An even spread across the remaining pairs, for coverage.
//
// `max` caps the queue; it is also clamped to the number of available pairs.
// Returns [] when there are fewer than two movies to compare.
export function buildReviewQueue(ranking, { focusTmdbId = null, max = 8 } = {}) {
  const list = Array.isArray(ranking) ? ranking : [];
  const n = list.length;
  if (n < 2) return [];

  const maxPairs = n - 1; // pair indices 0..n-2
  const cap = Math.max(1, Math.min(max, maxPairs));

  const queue = [];
  const seen = new Set();
  const push = (i) => {
    if (i < 0 || i > n - 2) return;
    if (seen.has(i)) return;
    seen.add(i);
    queue.push(i);
  };

  // 1. The pairs on either side of the focus (just-added) movie come first.
  if (focusTmdbId != null) {
    const fi = list.findIndex((m) => m && m.tmdbId != null && m.tmdbId === focusTmdbId);
    if (fi !== -1) {
      push(fi - 1);
      push(fi);
    }
  }

  // 2. Pairs near the most-recently-ranked movies. Movies without a timestamp
  //    are left to the spread pass below.
  const byRecency = list
    .map((movie, i) => ({ i, t: rankedTime(movie) }))
    .filter((entry) => entry.t != null)
    .sort((a, b) => b.t - a.t || a.i - b.i);
  for (const { i } of byRecency) {
    if (queue.length >= cap) break;
    push(i - 1);
    push(i);
  }

  // 3. Even spread across all pairs for coverage of the rest of the list.
  if (queue.length < cap) {
    const remaining = cap - queue.length;
    const stride = Math.max(1, Math.floor(maxPairs / remaining));
    for (let i = 0; i < maxPairs && queue.length < cap; i += stride) push(i);
    // Backfill any gaps the strided pass skipped.
    for (let i = 0; i < maxPairs && queue.length < cap; i += 1) push(i);
  }

  return queue.slice(0, cap);
}
