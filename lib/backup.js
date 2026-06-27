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

const normalizedCandidateTitle = (movie) =>
  normalizeTitle(movie?.title || movie?.originalTitle || movie?.original_title || "");

export function chooseAutomaticTmdbMatch(entry, results) {
  const candidates = Array.isArray(results)
    ? results.filter((movie) => movie && movie.tmdbId && movie.title)
    : [];
  const exactTitle = candidates.filter(
    (movie) => normalizedCandidateTitle(movie) === normalizeTitle(entry?.title),
  );

  if (entry?.year) {
    const exactYear = exactTitle.filter((movie) => validYear(movie.year) === validYear(entry.year));
    return exactYear.length === 1 ? exactYear[0] : null;
  }

  return exactTitle.length === 1 ? exactTitle[0] : null;
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
