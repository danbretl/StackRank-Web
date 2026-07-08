// The rank-weighted insight engine — the product's "taste" math.
//
// Pure and DOM-free. `computeRankingInsights` takes an already-enriched ranking
// (movies with year / genres / director / cast / rankedAt) and the queue counts,
// and returns the full insights object the share/snapshot surfaces consume. The
// app's `getRankingInsights()` is now a thin wrapper that enriches the live
// `ranking` (via the detail cache) and the queue lengths, then calls this.
//
// Weighting principle (decided in the product brief): taste signals are
// **rank-weighted** — a movie's position in the list matters more than raw
// frequency. `preferenceWeight` makes the #1 movie worth ~1.0 and the last worth
// ~1/total, so aggregates favor what sits at the top.

import { movieYear } from "./movie.js?v=1";
import { dayKey } from "./format.js?v=1";

// Simple frequency count, sorted by count desc then name asc.
export function countValues(items) {
  const counts = new Map();
  items
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Linear top-weighting: index 0 → 1.0, last index → 1/total.
export function preferenceWeight(index, total) {
  if (!total) return 0;
  return (total - index) / total;
}

// Aggregate { name, weight } entries into { name, count, score }, sorted by score
// (rank-weighted) then count then name.
export function countPreferenceValues(entries) {
  const counts = new Map();
  entries
    .filter((entry) => entry?.name)
    .forEach(({ name, weight }) => {
      const current = counts.get(name) || { name, count: 0, score: 0 };
      current.count += 1;
      current.score += weight || 0;
      counts.set(name, current);
    });
  return Array.from(counts.values()).sort(
    (a, b) => b.score - a.score || b.count - a.count || a.name.localeCompare(b.name),
  );
}

// Top-weighted aggregation over a list, where `getter` yields a name or names.
export function countPreferenceMany(items, getter) {
  const entries = [];
  const total = items.length;
  items.forEach((item, index) => {
    const weight = preferenceWeight(index, total);
    const result = getter(item);
    if (Array.isArray(result)) {
      result.filter(Boolean).forEach((name) => entries.push({ name, weight }));
    } else if (result) {
      entries.push({ name: result, weight });
    }
  });
  return countPreferenceValues(entries);
}

// Bottom-weighted aggregation (index 0 → 1/total, last → 1.0) — for "lowest
// ranked genre" style callouts.
export function countReversePreferenceMany(items, getter) {
  const entries = [];
  const total = items.length;
  items.forEach((item, index) => {
    const weight = total ? (index + 1) / total : 0;
    const result = getter(item);
    if (Array.isArray(result)) {
      result.filter(Boolean).forEach((name) => entries.push({ name, weight }));
    } else if (result) {
      entries.push({ name: result, weight });
    }
  });
  return countPreferenceValues(entries);
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// The full insights object. `enrichedRanking` is the ordered, detail-merged movie
// list; `watchCount`/`hiddenCount`/`rankingUpdatedAt` are passed through from the
// app's live state.
export function computeRankingInsights(enrichedRanking, { watchCount = 0, hiddenCount = 0, rankingUpdatedAt = null } = {}) {
  const years = enrichedRanking
    .map((movie, index) => ({ movie, index, year: movieYear(movie) }))
    .filter((item) => item.year);
  const decadeEntries = [];
  years.forEach(({ year, index }) => {
    const decade = Math.floor(year / 10) * 10;
    decadeEntries.push({ name: String(decade), weight: preferenceWeight(index, enrichedRanking.length) });
  });
  const decades = countPreferenceValues(decadeEntries).map((item) => ({
    decade: Number(item.name),
    count: item.count,
    score: item.score,
  }));
  const sortedByYear = [...years].sort((a, b) => a.year - b.year);
  const yearValues = years.map((item) => item.year);
  const averageYear = years.length
    ? Math.round(years.reduce((sum, item) => sum + item.year, 0) / years.length)
    : null;
  const rankedDates = enrichedRanking
    .map((movie) => movie.rankedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const perMovieRankDatesTracked = rankedDates.length > 0;
  const rankedByDay = countValues(rankedDates.map(dayKey));
  const genres = countPreferenceMany(enrichedRanking, (movie) => movie.genres || []);
  const bottomGenres = countReversePreferenceMany(enrichedRanking, (movie) => movie.genres || []);
  const directors = countPreferenceMany(enrichedRanking, (movie) => movie.director);
  const cast = countPreferenceMany(enrichedRanking, (movie) => (movie.cast || []).slice(0, 4));
  const detailCount = enrichedRanking.filter(
    (movie) =>
      (Array.isArray(movie.genres) && movie.genres.length) ||
      movie.director ||
      (Array.isArray(movie.cast) && movie.cast.length),
  ).length;

  return {
    count: enrichedRanking.length,
    enrichedRanking,
    yearsKnown: years.length,
    averageYear,
    medianYear: median(yearValues),
    topMovie: enrichedRanking[0] || null,
    topFive: enrichedRanking.slice(0, 5),
    bottomFive: enrichedRanking.slice(-5),
    topDecade: decades[0] || null,
    decades,
    oldest: sortedByYear[0] || null,
    newest: sortedByYear[sortedByYear.length - 1] || null,
    yearSpan:
      sortedByYear[0] && sortedByYear[sortedByYear.length - 1]
        ? sortedByYear[sortedByYear.length - 1].year - sortedByYear[0].year
        : null,
    firstRankedAt: rankedDates[0] || null,
    lastRankedAt: rankedDates[rankedDates.length - 1] || null,
    rankingUpdatedAt,
    perMovieRankDatesTracked,
    busiestDay: rankedByDay[0] || null,
    watchCount,
    hiddenCount,
    genres,
    bottomGenres,
    directors,
    cast,
    detailCount,
  };
}
