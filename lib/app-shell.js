export const APP_DESTINATIONS = Object.freeze(["rank", "discover", "lists"]);

export const DEFAULT_APP_DESTINATION = "rank";

export function normalizeAppDestination(destination, fallback = DEFAULT_APP_DESTINATION) {
  return APP_DESTINATIONS.includes(destination) ? destination : fallback;
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
