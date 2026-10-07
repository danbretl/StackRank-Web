import { movieKey } from './movie.js?v=1';

// Comparisons are drafts. Every durable snapshot retains the origin until the
// placement commits, including incidental saves from an auto-pack undo.
export function durableMovieLists({ ranking = [], watchList = [], notInterestedList = [], pendingOrigin = null } = {}) {
  const result = { ranking: [...ranking], watchList: [...watchList], notInterestedList: [...notInterestedList] };
  const field = { ranking: 'ranking', watch: 'watchList', notInterested: 'notInterestedList' }[pendingOrigin?.type];
  if (field && pendingOrigin.movie) {
    const list = result[field];
    if (!list.some((movie) => movieKey(movie) === movieKey(pendingOrigin.movie))) {
      list.splice(Math.min(Math.max(0, pendingOrigin.index), list.length), 0, { ...pendingOrigin.movie });
    }
  }
  return result;
}

export function appendRecoveredMovies(current, recovered) {
  const seen = new Set(current.map(movieKey));
  return [...current, ...recovered.filter((movie) => {
    const key = movieKey(movie);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

export function validRemoteMovies(value) {
  return Array.isArray(value) && value.every((movie) => movie && typeof movie === 'object' &&
    typeof movie.title === 'string' && movie.title.trim().length > 0);
}

export function validMovieStoredPayload(kind, value) {
  const object = (entry) => entry && typeof entry === 'object' && !Array.isArray(entry);
  if (kind === 'ranking') return validRemoteMovies(Array.isArray(value) ? value : value?.movies);
  if (kind === 'queues') return object(value) && validRemoteMovies(value.watchList) && validRemoteMovies(value.notInterestedList);
  if (kind === 'packs') return object(value) && object(value.progress) && Object.values(value.progress).every(object);
  return false;
}
