export const SHARE_SLUG_LENGTH = 10;
export const SHARE_SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SHARE_SLUG_PATTERN = /^[a-z0-9]{10}$/;
export const SHARED_LIST_DISPLAY_NAME_MAX = 36;
export const SHARED_LIST_TITLE_MAX = 180;

const normalizeWhitespace = (value) => String(value || "").trim().replace(/\s+/g, " ");

export const isValidShareSlug = (slug) => SHARE_SLUG_PATTERN.test(String(slug || ""));

export const shareSlugFromBytes = (bytes, length = SHARE_SLUG_LENGTH) => {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (source.length < length) {
    throw new Error(`Need at least ${length} random bytes to build a share slug.`);
  }
  let slug = "";
  for (let index = 0; index < length; index += 1) {
    slug += SHARE_SLUG_ALPHABET[source[index] % SHARE_SLUG_ALPHABET.length];
  }
  return slug;
};

export const generateShareSlug = (randomSource = globalThis.crypto) => {
  if (!randomSource || typeof randomSource.getRandomValues !== "function") {
    throw new Error("Secure random values are not available.");
  }
  const bytes = new Uint8Array(SHARE_SLUG_LENGTH);
  randomSource.getRandomValues(bytes);
  return shareSlugFromBytes(bytes);
};

export const sharedListUrl = (origin, slug) => {
  if (!isValidShareSlug(slug)) {
    throw new Error("Invalid shared-list slug.");
  }
  return new URL(`/s/${slug}`, origin || "https://www.stackrankapp.com").toString();
};

export const sharedListSlugFromPath = (pathname = "") => {
  const match = String(pathname || "").match(/^\/s\/([a-z0-9]{10})\/?$/);
  return match ? match[1] : "";
};

const normalizeYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1870 || year > 2100) return null;
  return year;
};

const normalizeTmdbId = (value) => {
  const tmdbId = Number(value);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  return tmdbId;
};

const normalizePosterPath = (value) => {
  const path = normalizeWhitespace(value).slice(0, 160);
  if (!path || !path.startsWith("/") || /[\s<>"']/.test(path)) return null;
  return path;
};

export const normalizeSharedMovie = (movie = {}) => {
  const title = normalizeWhitespace(movie.title).slice(0, SHARED_LIST_TITLE_MAX);
  if (!title) return null;
  return {
    title,
    year: normalizeYear(movie.year),
    posterPath: normalizePosterPath(movie.posterPath || movie.poster_path),
    tmdbId: normalizeTmdbId(movie.tmdbId || movie.tmdb_id || movie.id),
  };
};

export const normalizeSharedListPayload = (payload = {}) => {
  const movies = Array.isArray(payload?.movies)
    ? payload.movies.map(normalizeSharedMovie).filter(Boolean)
    : [];
  return {
    displayName: normalizeWhitespace(payload?.displayName).slice(0, SHARED_LIST_DISPLAY_NAME_MAX),
    movies,
  };
};

export const buildSharedListPayload = ({ displayName = "", movies = [] } = {}) =>
  normalizeSharedListPayload({ displayName, movies });
