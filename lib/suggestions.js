const GENERIC_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Romance",
  "Thriller",
]);

const cleanGenres = (movie) =>
  Array.isArray(movie?.genres)
    ? movie.genres
        .map((genre) => (typeof genre === "string" ? genre : genre?.name))
        .filter((genre) => typeof genre === "string" && genre.trim())
        .map((genre) => genre.trim())
    : [];

const pickDistinctiveGenre = (genres) =>
  genres.find((genre) => !GENERIC_GENRES.has(genre)) || genres[0] || "";

const genrePhrase = (genre) => genre.toLocaleLowerCase();

const movieDecade = (movie) => {
  const year = Number(movie?.year);
  if (!Number.isInteger(year) || year < 1880 || year > 2200) return "";
  return `${Math.floor(year / 10) * 10}s`;
};

const relatedFallback = (seed) => {
  if (!seed?.title) return "Recommended from your ranking";
  if (seed.rank) return `Recommended from ${seed.title}, your #${seed.rank}`;
  return `Recommended from ${seed.title}`;
};

export const sliceSuggestions = (items, cursor, size) => {
  if (!Array.isArray(items) || !items.length || !Number.isFinite(Number(size)) || Number(size) <= 0) {
    return [];
  }
  const pageSize = Math.floor(Number(size));
  const offset = Number.isFinite(Number(cursor)) ? Math.trunc(Number(cursor)) : 0;
  const start = ((offset % items.length) + items.length) % items.length;
  const end = start + pageSize;
  const slice = items.slice(start, end);
  if (slice.length < pageSize) {
    slice.push(...items.slice(0, Math.min(pageSize - slice.length, items.length)));
  }
  return slice;
};

export const selectRankedSuggestionSeed = (
  ranking,
  { activeSeedId = null, previousSeedId = null, random = Math.random } = {},
) => {
  const candidates = (Array.isArray(ranking) ? ranking : [])
    .slice(0, 10)
    .filter((movie) => movie?.tmdbId);
  if (!candidates.length) return null;
  const freshCandidates =
    candidates.length > 1
      ? candidates.filter(
          (movie) => movie.tmdbId !== activeSeedId && movie.tmdbId !== previousSeedId,
        )
      : candidates;
  const pool = freshCandidates.length ? freshCandidates : candidates;
  const randomValue = Number(random());
  const boundedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
    : 0;
  return pool[Math.floor(boundedRandom * pool.length)];
};

export const isSuggestionReasonReady = ({ sectionKey, movie, seed = null }) => {
  if (!Array.isArray(movie?.genres)) return false;
  if (sectionKey === "related" && !Array.isArray(seed?.genres)) return false;
  return true;
};

export const buildSuggestionReason = ({ sectionKey, movie, seed = null }) => {
  const genres = cleanGenres(movie);
  const genre = pickDistinctiveGenre(genres);

  if (sectionKey === "related") {
    const seedGenres = new Set(cleanGenres(seed));
    const sharedGenre = genres.find(
      (name) => seedGenres.has(name) && !GENERIC_GENRES.has(name),
    );
    if (sharedGenre && seed?.title) {
      return `Shares ${genrePhrase(sharedGenre)} with ${seed.title}`;
    }
    return relatedFallback(seed);
  }

  if (sectionKey === "essentials") {
    const decade = movieDecade(movie);
    if (decade && genre) return `A ${decade} ${genrePhrase(genre)} essential`;
    if (decade) return `A ${decade} essential you haven't ranked`;
    if (genre) return `A ${genrePhrase(genre)} essential you haven't ranked`;
    return "An all-time essential you haven't ranked";
  }

  if (sectionKey === "popular") {
    if (genre) return `Popular now · ${genre}`;
    return "Currently popular on TMDB";
  }

  return "Suggested for your ranking";
};

export const buildSuggestionSectionSubtitle = (sectionKey, context = {}) => {
  if (sectionKey === "related") {
    const seed = context.seed;
    if (!seed?.title) return "Recommendations connected to your highest-ranked movies.";
    if (seed.source === "recent") {
      return seed.rank
        ? `Because you just ranked it #${seed.rank}.`
        : "Because you just added it to your ranking.";
    }
    return seed.rank
      ? `Because it's #${seed.rank} on your list.`
      : "Because it's near the top of your list.";
  }
  if (sectionKey === "essentials") {
    return "Recognized favorites released before 2016.";
  }
  if (sectionKey === "popular") {
    return "Movies currently popular on TMDB.";
  }
  return "";
};
