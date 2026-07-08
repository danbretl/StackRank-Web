import { mergeRankings, movieKey } from "./movie.js?v=1";

const emptyRankingPayload = () => ({ movies: [], updated_at: null });
const emptyQueuePayload = () => ({
  watchList: [],
  notInterestedList: [],
  updated_at: null,
});

const timestampValue = (value) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseJson = (raw) => {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

export function parseRankingPayload(raw) {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    return { movies: parsed, updated_at: null };
  }
  if (parsed && Array.isArray(parsed.movies)) {
    return {
      movies: parsed.movies,
      updated_at: parsed.updated_at || null,
    };
  }
  return emptyRankingPayload();
}

export function parseQueuePayload(raw) {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return emptyQueuePayload();
  }
  return {
    watchList: Array.isArray(parsed.watchList) ? parsed.watchList : [],
    notInterestedList: Array.isArray(parsed.notInterestedList)
      ? parsed.notInterestedList
      : [],
    updated_at: parsed.updated_at || null,
  };
}

const newestFirst = (payloads) =>
  [...payloads].sort(
    (a, b) => timestampValue(b?.updated_at) - timestampValue(a?.updated_at),
  );

export function mergeRankingPayloads(payloads = []) {
  const sorted = newestFirst(
    (Array.isArray(payloads) ? payloads : []).map((payload) => ({
      movies: Array.isArray(payload?.movies) ? payload.movies : [],
      updated_at: payload?.updated_at || null,
    })),
  );
  const [newest = emptyRankingPayload(), ...older] = sorted;
  return {
    movies: older.reduce(
      (movies, payload) => mergeRankings(movies, payload.movies),
      newest.movies,
    ),
    updated_at: newest.updated_at,
  };
}

export function mergeQueuePayloads(payloads = []) {
  const sorted = newestFirst(
    (Array.isArray(payloads) ? payloads : []).map((payload) => ({
      watchList: Array.isArray(payload?.watchList) ? payload.watchList : [],
      notInterestedList: Array.isArray(payload?.notInterestedList)
        ? payload.notInterestedList
        : [],
      updated_at: payload?.updated_at || null,
    })),
  );
  const [newest = emptyQueuePayload(), ...older] = sorted;
  return older.reduce(
    (merged, payload) => ({
      watchList: mergeRankings(merged.watchList, payload.watchList),
      notInterestedList: mergeRankings(
        merged.notInterestedList,
        payload.notInterestedList,
      ),
      updated_at: merged.updated_at,
    }),
    {
      watchList: newest.watchList,
      notInterestedList: newest.notInterestedList,
      updated_at: newest.updated_at,
    },
  );
}

export function normalizeSuggestionQueueLists({
  ranking = [],
  watchList = [],
  notInterestedList = [],
} = {}) {
  const rankedKeys = new Set(ranking.map(movieKey));
  const normalizedWatchList = watchList.filter(
    (movie) => !rankedKeys.has(movieKey(movie)),
  );
  const watchKeys = new Set(normalizedWatchList.map(movieKey));
  return {
    watchList: normalizedWatchList,
    notInterestedList: notInterestedList.filter((movie) => {
      const key = movieKey(movie);
      return !rankedKeys.has(key) && !watchKeys.has(key);
    }),
  };
}
