import { test } from "node:test";
import assert from "node:assert/strict";
import { createUndoController } from "../lib/undo.js";

// A controllable clock so expiry is deterministic.
function fakeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("set then consume returns the restore function once", () => {
  const c = createUndoController();
  let restored = 0;
  const token = c.set({ label: "x", restore: () => { restored += 1; }, ttlMs: 5000 });
  const fn = c.consume(token);
  assert.equal(typeof fn, "function");
  fn();
  assert.equal(restored, 1);
  // Second consume is a no-op: the entry was cleared.
  assert.equal(c.consume(token), null);
});

test("set requires a restore function", () => {
  const c = createUndoController();
  assert.throws(() => c.set({ label: "x", restore: null, ttlMs: 5000 }), TypeError);
});

test("a newer set invalidates the previous token", () => {
  const c = createUndoController();
  const first = c.set({ label: "a", restore: () => {}, ttlMs: 5000 });
  const second = c.set({ label: "b", restore: () => "b", ttlMs: 5000 });
  // The stale (replaced) toast button can no longer undo.
  assert.equal(c.consume(first), null);
  // The current one still can.
  assert.equal(c.consume(second)(), "b");
});

test("expired entries are not consumable", () => {
  const clock = fakeClock();
  const c = createUndoController({ now: clock.now });
  const token = c.set({ label: "x", restore: () => "v", ttlMs: 5000 });
  clock.advance(5000); // expiresAt is exclusive: expiresAt <= now() ⇒ expired
  assert.equal(c.isActive(), false);
  assert.equal(c.consume(token), null);
});

test("entry stays live until its ttl elapses", () => {
  const clock = fakeClock();
  const c = createUndoController({ now: clock.now });
  const token = c.set({ label: "x", restore: () => "v", ttlMs: 5000 });
  clock.advance(4999);
  assert.equal(c.isActive(), true);
  assert.deepEqual(c.peek(), { label: "x", token });
  assert.equal(c.consume(token)(), "v");
});

test("peek is non-destructive and reflects expiry", () => {
  const clock = fakeClock();
  const c = createUndoController({ now: clock.now });
  c.set({ label: "x", restore: () => {}, ttlMs: 1000 });
  assert.ok(c.peek());
  assert.ok(c.peek(), "peek does not consume");
  clock.advance(1000);
  assert.equal(c.peek(), null);
});

test("consume with no token still works for the current entry", () => {
  const c = createUndoController();
  c.set({ label: "x", restore: () => "v", ttlMs: 5000 });
  // Passing no/undefined token consumes whatever is current.
  assert.equal(c.consume()(), "v");
});

test("clear drops the pending entry", () => {
  const c = createUndoController();
  const token = c.set({ label: "x", restore: () => {}, ttlMs: 5000 });
  c.clear();
  assert.equal(c.isActive(), false);
  assert.equal(c.consume(token), null);
});
