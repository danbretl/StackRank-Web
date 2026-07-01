export const LIST_DESTINATIONS = Object.freeze(["watch", "hidden"]);

export const DEFAULT_LIST_DESTINATION = "watch";

export function normalizeListDestination(destination, fallback = DEFAULT_LIST_DESTINATION) {
  return LIST_DESTINATIONS.includes(destination) ? destination : fallback;
}

export function createListDestinationState(destination = DEFAULT_LIST_DESTINATION) {
  return {
    destination: normalizeListDestination(destination),
  };
}

export function switchListDestination(state, nextDestination) {
  const current = createListDestinationState(state?.destination);
  const next = normalizeListDestination(nextDestination, current.destination);
  return {
    state: {
      destination: next,
    },
    changed: next !== current.destination,
  };
}
