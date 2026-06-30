import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_DESTINATIONS,
  createAppShellState,
  normalizeAppDestination,
  switchAppDestination,
} from "../lib/app-shell.js";

test("normalizeAppDestination accepts only stable app destinations", () => {
  assert.deepEqual(APP_DESTINATIONS, ["rank", "discover", "lists"]);
  assert.equal(normalizeAppDestination("rank"), "rank");
  assert.equal(normalizeAppDestination("discover"), "discover");
  assert.equal(normalizeAppDestination("lists"), "lists");
  assert.equal(normalizeAppDestination("bogus"), "rank");
  assert.equal(normalizeAppDestination("bogus", "lists"), "lists");
});

test("createAppShellState normalizes destination and scroll positions", () => {
  assert.deepEqual(createAppShellState({ destination: "discover", scrollPositions: { rank: 120, lists: -5 } }), {
    destination: "discover",
    scrollPositions: {
      rank: 120,
      discover: 0,
      lists: 0,
    },
  });
});

test("switchAppDestination records current scroll and restores destination scroll", () => {
  const initial = createAppShellState({
    destination: "rank",
    scrollPositions: { discover: 320 },
  });
  const switched = switchAppDestination(initial, "discover", 180);

  assert.equal(switched.changed, true);
  assert.equal(switched.scrollY, 320);
  assert.deepEqual(switched.state, {
    destination: "discover",
    scrollPositions: {
      rank: 180,
      discover: 320,
      lists: 0,
    },
  });

  const back = switchAppDestination(switched.state, "rank", 520);
  assert.equal(back.scrollY, 180);
  assert.equal(back.state.scrollPositions.discover, 520);
});

test("switchAppDestination ignores invalid destinations without losing scroll", () => {
  const result = switchAppDestination({ destination: "lists" }, "unknown", 44);
  assert.equal(result.changed, false);
  assert.equal(result.state.destination, "lists");
  assert.equal(result.state.scrollPositions.lists, 44);
  assert.equal(result.scrollY, 44);
});
