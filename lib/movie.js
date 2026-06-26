// Movie identity, de-duplication, and list merging — the "never lose data" core.
//
// Identity is the TMDB id when present, with a normalized title+year fallback for
// legacy items that predate id tracking. These functions are pure (state passed
// in), so the merge/dedup logic that protects a user's ranking can be tested
// exhaustively without a browser.

export const normalizeTitle = (value) => String(value || "").trim().toLowerCase();

export const movieKey = (movie) => {
  if (movie.tmdbId) return `tmdb:${movie.tmdbId}`;
  const title = normalizeTitle(movie.title || "");
  return movie.year ? `title:${title}:${movie.year}` : `title:${title}`;
};

// A parsed, validated release year (or null). Guards against garbage / 0 / NaN.
export function movieYear(movie) {
  const year = Number(movie?.year);
  return Number.isFinite(year) && year > 1800 ? year : null;
}

// Is `movie` already present in `list`? Matches on tmdbId first, then on
// normalized title (+ year when both have one). This is intentionally lenient on
// the title path so a legacy title-only entry and a later id-bearing one for the
// same film are treated as the same movie.
export function isDuplicateMovie(list, movie) {
  const title = normalizeTitle(movie.title);
  return list.some((existing) => {
    if (movie.tmdbId && existing.tmdbId && existing.tmdbId === movie.tmdbId) {
      return true;
    }
    const existingTitle = normalizeTitle(existing.title);
    if (existingTitle !== title) return false;
    if (movie.year && existing.year) {
      return existing.year === movie.year;
    }
    return true;
  });
}

// Merge `incomingList` into `baseList`, keeping base order and appending only
// movies whose key isn't already present. Never drops or reorders base entries —
// the guarantee the merge-on-load path relies on so a stale snapshot can't shrink
// a larger list.
export const mergeRankings = (baseList, incomingList) => {
  const baseKeys = new Set(baseList.map(movieKey));
  const merged = [...baseList];
  incomingList.forEach((movie) => {
    const key = movieKey(movie);
    if (baseKeys.has(key)) return;
    merged.push(movie);
    baseKeys.add(key);
  });
  return merged;
};
