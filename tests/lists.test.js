import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LIST_DESTINATION,
  LIST_DESTINATIONS,
  createListDestinationState,
  normalizeListDestination,
  switchListDestination,
} from "../lib/lists.js";

test("normalizeListDestination accepts only stable list destinations", () => {
  assert.deepEqual(LIST_DESTINATIONS, ["watch", "hidden"]);
  assert.equal(DEFAULT_LIST_DESTINATION, "watch");
  assert.equal(normalizeListDestination("watch"), "watch");
  assert.equal(normalizeListDestination("hidden"), "hidden");
  assert.equal(normalizeListDestination("bogus"), "watch");
  assert.equal(normalizeListDestination("bogus", "hidden"), "hidden");
});

test("createListDestinationState normalizes the active destination", () => {
  assert.deepEqual(createListDestinationState("hidden"), { destination: "hidden" });
  assert.deepEqual(createListDestinationState("unknown"), { destination: "watch" });
});

test("switchListDestination reports changed state and ignores invalid targets", () => {
  const switched = switchListDestination({ destination: "watch" }, "hidden");
  assert.equal(switched.changed, true);
  assert.deepEqual(switched.state, { destination: "hidden" });

  const ignored = switchListDestination(switched.state, "nope");
  assert.equal(ignored.changed, false);
  assert.deepEqual(ignored.state, { destination: "hidden" });
});
