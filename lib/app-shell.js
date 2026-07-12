export const APP_DESTINATIONS = Object.freeze(["rank", "ranking", "you"]);

export const DEFAULT_APP_DESTINATION = "rank";

export const APP_DESTINATION_MEMORY_TTL_MS = 30 * 60 * 1000;

export function normalizeAppDestination(destination, fallback = DEFAULT_APP_DESTINATION) {
  return APP_DESTINATIONS.includes(destination) ? destination : fallback;
}

export function createAppDestinationMemory(destination, updatedAt = Date.now()) {
  return {
    destination: normalizeAppDestination(destination),
    updatedAt: Number(updatedAt),
  };
}

export function parseAppDestinationMemory(
  value,
  now = Date.now(),
  ttlMs = APP_DESTINATION_MEMORY_TTL_MS,
) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const updatedAt = Number(parsed?.updatedAt);
    const currentTime = Number(now);
    const maxAge = Math.max(0, Number(ttlMs) || 0);
    const age = currentTime - updatedAt;
    if (!Number.isFinite(updatedAt) || !Number.isFinite(currentTime) || age < 0 || age > maxAge) {
      return DEFAULT_APP_DESTINATION;
    }
    return normalizeAppDestination(parsed?.destination);
  } catch (_error) {
    return DEFAULT_APP_DESTINATION;
  }
}

export function createAppShellState({ destination = DEFAULT_APP_DESTINATION, scrollPositions = {} } = {}) {
  const normalizedDestination = normalizeAppDestination(destination);
  return {
    destination: normalizedDestination,
    scrollPositions: APP_DESTINATIONS.reduce((positions, key) => {
      positions[key] = Math.max(0, Number(scrollPositions[key]) || 0);
      return positions;
    }, {}),
  };
}

export function switchAppDestination(state, nextDestination, currentScrollY = 0) {
  const current = createAppShellState(state);
  const next = normalizeAppDestination(nextDestination, current.destination);
  const scrollPositions = {
    ...current.scrollPositions,
    [current.destination]: Math.max(0, Number(currentScrollY) || 0),
  };
  return {
    state: {
      destination: next,
      scrollPositions,
    },
    scrollY: scrollPositions[next] || 0,
    changed: next !== current.destination,
  };
}
