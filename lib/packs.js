// Suggestion-pack progress + share aggregation.
//
// Progress is *derived*, not stored: a pack movie is "handled" iff it's already
// in the user's ranking / watch / not-interested lists. These functions take the
// per-movie handled state and the pack's persisted progress entry as inputs, so
// they're pure and testable. The app supplies `getMovieHandledState` and
// `packProgress[slug]`; the test suite supplies fakes.

import { movieKey } from "./movie.js?v=1";

// The bundled library is the complete offline baseline. Remote rows can update
// or add packs without making a partially populated Supabase table shrink the
// customer-visible library.
export function mergePackLibraries(fallbackPacks = [], remotePacks = []) {
  const merged = new Map();
  fallbackPacks.forEach((pack) => {
    if (pack?.slug) merged.set(pack.slug, pack);
  });
  remotePacks.forEach((pack) => {
    if (pack?.slug) merged.set(pack.slug, pack);
  });
  return [...merged.values()];
}

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
  if (stats.resurfaced) return "Updated";
  if (stats.started || stats.discovered) return "Continue";
  if (stats.completed) return "Complete";
  return "Start";
}

export function packFilterState(stats) {
  if (stats.resurfaced) return "updated";
  if (stats.completed) return "completed";
  if (stats.started) return "in_progress";
  // A dismissed discovery is still a real customer head start even though it
  // should no longer trigger discovery UI.
  if (stats.handled > 0) return "head_start";
  return "not_started";
}

const normalizePackFilterText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

const packMovieSearchTerms = (movie) => {
  const year = Number(movie.year);
  if (!Number.isInteger(year) || year < 1880 || year > 2200) {
    return [movie.title];
  }
  const decade = Math.floor(year / 10) * 10;
  return [movie.title, year, `${decade}s`, `${String(decade).slice(-2)}s`];
};

const packSearchText = (pack) =>
  normalizePackFilterText(
    [
      pack.title,
      pack.subtitle,
      pack.category,
      ...(pack.movies || []).flatMap(packMovieSearchTerms),
    ].join(" "),
  );

// Filter entries shaped as { pack, stats }. Query terms are ANDed so searches
// such as "horror 1980" stay useful across title/category/movie metadata.
export function filterPacks(packEntries, filters = {}) {
  const queryTerms = normalizePackFilterText(filters.query).split(/\s+/).filter(Boolean);
  const category = filters.category || "all";
  const state = filters.state || "all";
  return packEntries.filter(({ pack, stats }) => {
    if (category !== "all" && pack.category !== category) return false;
    if (state !== "all" && packFilterState(stats) !== state) return false;
    if (queryTerms.length) {
      const searchable = packSearchText(pack);
      if (!queryTerms.every((term) => searchable.includes(term))) return false;
    }
    return true;
  });
}

export function countPackFilterStates(packEntries) {
  const counts = {
    all: packEntries.length,
    not_started: 0,
    in_progress: 0,
    head_start: 0,
    completed: 0,
    updated: 0,
  };
  packEntries.forEach(({ stats }) => {
    counts[packFilterState(stats)] += 1;
  });
  return counts;
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
