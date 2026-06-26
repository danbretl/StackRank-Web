// Suggestion-pack progress + share aggregation.
//
// Progress is *derived*, not stored: a pack movie is "handled" iff it's already
// in the user's ranking / watch / not-interested lists. These functions take the
// per-movie handled state and the pack's persisted progress entry as inputs, so
// they're pure and testable. The app supplies `getMovieHandledState` and
// `packProgress[slug]`; the test suite supplies fakes.

import { movieKey } from "./movie.js";

// `handledStateFor(movie)` → { type: "ranked"|"watch"|"hidden"|"unhandled",
// handled: boolean, ... }. `progressEntry` is the persisted
// { startedAt, packVersionSeen, completedAt, discoveryDismissedAt } (or {}).
export function computePackStats(pack, handledStateFor, progressEntry = {}) {
  const handledMovies = [];
  const remainingMovies = [];
  pack.movies.forEach((movie, index) => {
    const state = handledStateFor(movie);
    const entry = { movie, index, state };
    if (state.handled) {
      handledMovies.push(entry);
    } else {
      remainingMovies.push(entry);
    }
  });
  const total = pack.movies.length;
  const handled = handledMovies.length;
  const progress = total ? handled / total : 0;
  const completed = total > 0 && handled === total;
  const resurfaced = Boolean(
    progressEntry.completedAt && pack.version > Number(progressEntry.packVersionSeen || 0) && !completed,
  );
  const discovered = !progressEntry.startedAt && handled > 0 && !completed && !progressEntry.discoveryDismissedAt;
  const started = Boolean(progressEntry.startedAt && !completed);
  return {
    total,
    handled,
    progress,
    handledMovies,
    remainingMovies,
    completed,
    resurfaced,
    discovered,
    started,
    entry: progressEntry,
  };
}

// Ordering rank for the in-app panel: resurfaced → started → discovered →
// not-completed → completed.
export function packStatusRank(stats) {
  if (stats.resurfaced) return 0;
  if (stats.started) return 1;
  if (stats.discovered) return 2;
  if (!stats.completed) return 3;
  return 4;
}

export function packStatusText(stats) {
  if (stats.resurfaced) return `${stats.remainingMovies.length} new to rank`;
  if (stats.completed) return "Complete";
  if (stats.handled > 0) {
    const left = stats.total - stats.handled;
    return `${stats.handled} handled, ${left} to go`;
  }
  return `${stats.total} movies to rank`;
}

export function packActionText(stats) {
  if (stats.resurfaced) return "Keep going";
  if (stats.started) return "Keep going";
  if (stats.discovered) return "Pick up";
  if (stats.completed) return "View pack";
  return "Start";
}

// Terser status for the share-poster pack cards.
export function sharePackCardStatus(stats) {
  if (stats.completed) return "Complete";
  if (stats.resurfaced) return `${stats.remainingMovies.length} new to rank`;
  return `${stats.handled} / ${stats.total} ranked`;
}

// Aggregate pack engagement for the Share Suite. `packEntries` is
// [{ pack, stats }]. `rankedCount` counts distinct pack movies that landed in the
// ranking; `handledCount` counts distinct pack movies handled in any way;
// `topCategory` is the most-engaged category (by handled count) — an engagement
// signal, labelled "Most explored", not a rank-weighted taste claim.
export function summarizePacks(packEntries) {
  let completed = 0;
  let inProgress = 0;
  const rankedIds = new Set();
  const handledIds = new Set();
  const categoryHandled = new Map();
  packEntries.forEach(({ pack, stats }) => {
    if (stats.completed) completed += 1;
    else if (stats.started || stats.resurfaced) inProgress += 1;
    stats.handledMovies.forEach((entry) => {
      const id = entry.movie.tmdbId != null ? `id:${entry.movie.tmdbId}` : movieKey(entry.movie);
      handledIds.add(id);
      if (entry.state.type === "ranked") rankedIds.add(id);
    });
    if (stats.handled > 0 || stats.started || stats.completed) {
      const cat = (pack.category || "").trim();
      if (cat) categoryHandled.set(cat, (categoryHandled.get(cat) || 0) + stats.handled);
    }
  });
  let topCategory = "";
  let topCategoryCount = 0;
  categoryHandled.forEach((count, cat) => {
    if (count > topCategoryCount) {
      topCategoryCount = count;
      topCategory = cat;
    }
  });
  const engaged = completed + inProgress > 0 || handledIds.size > 0;
  return {
    totalPacks: packEntries.length,
    completed,
    inProgress,
    rankedCount: rankedIds.size,
    handledCount: handledIds.size,
    topCategory,
    topCategoryCount,
    engaged,
  };
}

// Packs to feature visually in the Share Suite (up to `limit`). In-progress packs
// lead by progress; completed packs follow as trophies by most-recent completion.
// `packEntries` is [{ pack, stats }]; returns the same shape, filtered + sorted.
export function featuredPacks(packEntries, limit = 4) {
  return packEntries
    .filter(({ stats }) => stats.completed || stats.started || stats.resurfaced || stats.handled > 0)
    .slice()
    .sort((a, b) => {
      const aActive = a.stats.completed ? 0 : 1;
      const bActive = b.stats.completed ? 0 : 1;
      if (aActive !== bActive) return bActive - aActive; // in-progress before completed
      if (a.stats.completed && b.stats.completed) {
        const aDone = Date.parse(a.stats.entry.completedAt || "") || 0;
        const bDone = Date.parse(b.stats.entry.completedAt || "") || 0;
        return bDone - aDone;
      }
      if (b.stats.progress !== a.stats.progress) return b.stats.progress - a.stats.progress;
      if (b.stats.handled !== a.stats.handled) return b.stats.handled - a.stats.handled;
      return a.pack.sort_order - b.pack.sort_order || a.pack.title.localeCompare(b.pack.title);
    })
    .slice(0, limit);
}
