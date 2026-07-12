import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_DESTINATION_MEMORY_TTL_MS,
  APP_DESTINATIONS,
  createAppDestinationMemory,
  createAppShellState,
  normalizeAppDestination,
  parseAppDestinationMemory,
  switchAppDestination,
} from "../lib/app-shell.js";

test("normalizeAppDestination accepts only stable app destinations", () => {
  assert.deepEqual(APP_DESTINATIONS, ["rank", "ranking", "you"]);
  assert.equal(normalizeAppDestination("rank"), "rank");
  assert.equal(normalizeAppDestination("ranking"), "ranking");
  assert.equal(normalizeAppDestination("you"), "you");
  assert.equal(normalizeAppDestination("bogus"), "rank");
  assert.equal(normalizeAppDestination("bogus", "you"), "you");
});

test("createAppShellState normalizes destination and scroll positions", () => {
  assert.deepEqual(createAppShellState({ destination: "ranking", scrollPositions: { rank: 120, you: -5 } }), {
    destination: "ranking",
    scrollPositions: {
      rank: 120,
      ranking: 0,
      you: 0,
    },
  });
});

test("app destination memory keeps a valid destination for 30 minutes", () => {
  const now = Date.parse("2026-07-12T16:00:00.000Z");
  const memory = createAppDestinationMemory("ranking", now - APP_DESTINATION_MEMORY_TTL_MS);

  assert.deepEqual(memory, {
    destination: "ranking",
    updatedAt: now - APP_DESTINATION_MEMORY_TTL_MS,
  });
  assert.equal(parseAppDestinationMemory(JSON.stringify(memory), now), "ranking");
});

test("app destination memory defaults to Rank after inactivity or invalid data", () => {
  const now = Date.parse("2026-07-12T16:00:00.000Z");
  const expired = createAppDestinationMemory("you", now - APP_DESTINATION_MEMORY_TTL_MS - 1);

  assert.equal(parseAppDestinationMemory(JSON.stringify(expired), now), "rank");
  assert.equal(parseAppDestinationMemory({ destination: "ranking", updatedAt: now + 1 }, now), "rank");
  assert.equal(parseAppDestinationMemory({ destination: "unknown", updatedAt: now }, now), "rank");
  assert.equal(parseAppDestinationMemory("not json", now), "rank");
});

test("switchAppDestination records current scroll and restores destination scroll", () => {
  const initial = createAppShellState({
    destination: "rank",
    scrollPositions: { ranking: 320 },
  });
  const switched = switchAppDestination(initial, "ranking", 180);

  assert.equal(switched.changed, true);
  assert.equal(switched.scrollY, 320);
  assert.deepEqual(switched.state, {
    destination: "ranking",
    scrollPositions: {
      rank: 180,
      ranking: 320,
      you: 0,
    },
  });

  const back = switchAppDestination(switched.state, "rank", 520);
  assert.equal(back.scrollY, 180);
  assert.equal(back.state.scrollPositions.ranking, 520);
});

test("switchAppDestination ignores invalid destinations without losing scroll", () => {
  const result = switchAppDestination({ destination: "you" }, "unknown", 44);
  assert.equal(result.changed, false);
  assert.equal(result.state.destination, "you");
  assert.equal(result.state.scrollPositions.you, 44);
  assert.equal(result.scrollY, 44);
});
