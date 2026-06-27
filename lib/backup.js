import { movieKey, normalizeTitle } from "./movie.js";

export const STACKRANK_BACKUP_KIND = "stackrank-backup";
export const STACKRANK_BACKUP_VERSION = 1;

const BULLET_PREFIX = /^\s*(?:\d+[\s.)-]+|[-*•–—]\s+|\[\s*[x ]?\s*\]\s*)/i;
const TRAILING_YEAR = /(?:\s*[\[(]\s*((?:18|19|20)\d{2})\s*[\])]\s*|\s+[-–—]\s*((?:18|19|20)\d{2})\s*)$/;

const validYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null;
};

// Strip leading list markers repeatedly so stacked prefixes collapse, e.g.
// "- [ ] Title" (bullet + task-list checkbox) or "1. - Title". A single pass
// would only remove the outermost marker and leave the rest in the title.
const cleanLine = (line) => {
  let cleaned = String(line || "").trim();
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(BULLET_PREFIX, "").trim();
  } while (cleaned && cleaned !== prev);
  return cleaned;
};

export function parseRankedTitleList(text) {
  const entries = [];
  const seen = new Set();
  let duplicateCount = 0;
  let ignoredCount = 0;

  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const cleaned = cleanLine(line);
      if (!cleaned) {
        if (String(line || "").trim()) ignoredCount += 1;
        return;
      }

      const yearMatch = cleaned.match(TRAILING_YEAR);
      const year = validYear(yearMatch?.[1] || yearMatch?.[2]);
      const title = (yearMatch ? cleaned.slice(0, yearMatch.index) : cleaned).trim();
      if (!title) {
        ignoredCount += 1;
        return;
      }

      const dedupeKey = `${normalizeTitle(title)}:${year || ""}`;
      if (seen.has(dedupeKey)) {
        duplicateCount += 1;
        return;
      }
      seen.add(dedupeKey);
      entries.push({
        source: cleaned,
        title,
        year,
      });
    });

  return { entries, duplicateCount, ignoredCount };
}

// A forgiving title key for matching imported titles to TMDB results. Unlike the
// identity normalizer (used for dedup), this also drops articles (the/a/an),
// apostrophes, and all punctuation, unifies "&"/"and", and collapses whitespace —
// so "Death of Stalin" matches "The Death of Stalin" and "Spider-Man" matches
// "Spider Man". Applied symmetrically to both sides, so dropping articles anywhere
// (not just leading) is safe.
const matchableTitle = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchableTokens = (value) => matchableTitle(value).split(" ").filter(Boolean);

const candidateTitleVariants = (movie) => [
  matchableTitle(movie?.title || ""),
  matchableTitle(movie?.originalTitle || movie?.original_title || ""),
].filter(Boolean);

// Resolve an imported title line to a TMDB candidate. Returns { movie, confidence }
// where confidence is:
//   "exact" — a single normalized title (and year, if supplied) match — safe to auto-apply.
//   "guess" — disambiguated by popularity (TMDB returns most-popular first) or matched
//             loosely (article/punctuation differences, or all typed words appear in a
//             result's title) — pre-selected but flagged for the user to review.
//   null    — no reasonable candidate; the row stays unresolved/skipped.
// `results` must keep TMDB's popularity order so index 0 is the most popular.
export function chooseAutomaticTmdbMatch(entry, results) {
  const candidates = Array.isArray(results)
    ? results.filter((movie) => movie && movie.tmdbId && movie.title)
    : [];
  if (!candidates.length) return { movie: null, confidence: null };

  const target = matchableTitle(entry?.title);
  const titleMatches = target
    ? candidates.filter((movie) => candidateTitleVariants(movie).includes(target))
    : [];
  const wantYear = validYear(entry?.year);

  if (wantYear) {
    const yearMatches = titleMatches.filter((movie) => validYear(movie.year) === wantYear);
    if (yearMatches.length) {
      return { movie: yearMatches[0], confidence: yearMatches.length === 1 ? "exact" : "guess" };
    }
    // Year given but nothing matched it: fall back to the most-popular title match.
    if (titleMatches.length) return { movie: titleMatches[0], confidence: "guess" };
  } else if (titleMatches.length === 1) {
    return { movie: titleMatches[0], confidence: "exact" };
  } else if (titleMatches.length > 1) {
    return { movie: titleMatches[0], confidence: "guess" };
  }

  // Loose fallback for multi-word titles where the typed words are all present in a
  // result (e.g. "Sonic 3" → "Sonic the Hedgehog 3"). Restricted to 2+ words so a
  // single common word ("Up", "Heat") can't latch onto an unrelated film.
  const targetTokens = matchableTokens(entry?.title);
  if (targetTokens.length >= 2) {
    const subset = candidates.find((movie) =>
      candidateTitleVariants(movie).some((variant) => {
        const tokens = new Set(variant.split(" ").filter(Boolean));
        return targetTokens.every((token) => tokens.has(token));
      }),
    );
    if (subset) {
      if (wantYear) {
        const sameYear = candidates.find(
          (movie) =>
            validYear(movie.year) === wantYear &&
            candidateTitleVariants(movie).some((variant) => {
              const tokens = new Set(variant.split(" ").filter(Boolean));
              return targetTokens.every((token) => tokens.has(token));
            }),
        );
        return { movie: sameYear || subset, confidence: "guess" };
      }
      return { movie: subset, confidence: "guess" };
    }
  }

  return { movie: null, confidence: null };
}

const safeString = (value, maxLength = 500) =>
  typeof value === "string" ? value.slice(0, maxLength) : undefined;

export function normalizeBackupMovie(movie) {
  if (!movie || typeof movie !== "object") return null;
  const title = safeString(movie.title, 300)?.trim();
  if (!title) return null;

  const tmdbId = Number(movie.tmdbId);
  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((genre) => safeString(genre, 100)?.trim()).filter(Boolean).slice(0, 20)
    : undefined;
  const cast = Array.isArray(movie.cast)
    ? movie.cast.map((name) => safeString(name, 150)?.trim()).filter(Boolean).slice(0, 30)
    : undefined;

  return {
    title,
    year: validYear(movie.year),
    posterPath: safeString(movie.posterPath, 500) || null,
    tmdbId: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : null,
    rankedAt: safeString(movie.rankedAt, 60),
    queuedAt: safeString(movie.queuedAt, 60),
    savedAt: safeString(movie.savedAt, 60),
    hiddenAt: safeString(movie.hiddenAt, 60),
    genres,
    director: safeString(movie.director, 200),
    cast,
  };
}

const normalizeMovieList = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.reduce((movies, rawMovie) => {
    const movie = normalizeBackupMovie(rawMovie);
    if (!movie) return movies;
    const key = movieKey(movie);
    if (seen.has(key)) return movies;
    seen.add(key);
    movies.push(movie);
    return movies;
  }, []);
};

const normalizePackProgress = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([slug, entry]) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && entry && typeof entry === "object")
      .map(([slug, entry]) => [
        slug,
        {
          startedAt: safeString(entry.startedAt, 60) || null,
          packVersionSeen: Number.isFinite(Number(entry.packVersionSeen))
            ? Number(entry.packVersionSeen)
            : null,
          lastIndex: Number.isFinite(Number(entry.lastIndex)) ? Math.max(0, Number(entry.lastIndex)) : 0,
          completedAt: safeString(entry.completedAt, 60) || null,
          discoveryDismissedAt: safeString(entry.discoveryDismissedAt, 60) || null,
          updated_at: safeString(entry.updated_at, 60) || null,
        },
      ]),
  );
};

export function buildStackRankBackup({
  ranking = [],
  watchList = [],
  notInterestedList = [],
  packProgress = {},
  shareOptions = {},
  exportedAt = new Date().toISOString(),
} = {}) {
  return {
    kind: STACKRANK_BACKUP_KIND,
    version: STACKRANK_BACKUP_VERSION,
    exportedAt,
    ranking,
    queues: {
      watch: watchList,
      notInterested: notInterestedList,
    },
    packProgress,
    shareOptions,
  };
}

export function parseStackRankBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch (_error) {
    throw new Error("This is not valid JSON.");
  }

  if (!parsed || parsed.kind !== STACKRANK_BACKUP_KIND) {
    throw new Error("This is not a StackRank backup file.");
  }
  if (Number(parsed.version) !== STACKRANK_BACKUP_VERSION) {
    throw new Error(`Backup version ${parsed.version ?? "unknown"} is not supported.`);
  }
  if (!Array.isArray(parsed.ranking)) {
    throw new Error("The backup does not contain a ranked list.");
  }

  const ranking = normalizeMovieList(parsed.ranking);
  const rankedKeys = new Set(ranking.map(movieKey));
  const watchList = normalizeMovieList(parsed.queues?.watch).filter(
    (movie) => !rankedKeys.has(movieKey(movie)),
  );
  const watchKeys = new Set(watchList.map(movieKey));
  const notInterestedList = normalizeMovieList(parsed.queues?.notInterested).filter((movie) => {
    const key = movieKey(movie);
    return !rankedKeys.has(key) && !watchKeys.has(key);
  });

  return {
    ranking,
    watchList,
    notInterestedList,
    packProgress: normalizePackProgress(parsed.packProgress),
    shareOptions:
      parsed.shareOptions && typeof parsed.shareOptions === "object" && !Array.isArray(parsed.shareOptions)
        ? parsed.shareOptions
        : {},
    exportedAt: safeString(parsed.exportedAt, 60) || null,
  };
}

export function buildImportedRanking(rows, rankedAt = new Date().toISOString()) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).reduce((movies, row) => {
    const movie = normalizeBackupMovie(row?.selectedMovie);
    if (!movie) return movies;
    const key = movieKey(movie);
    if (seen.has(key)) return movies;
    seen.add(key);
    movies.push({
      ...movie,
      rankedAt,
      queuedAt: undefined,
      savedAt: undefined,
      hiddenAt: undefined,
    });
    return movies;
  }, []);
}
