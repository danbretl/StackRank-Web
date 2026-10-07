import test from "node:test";
import assert from "node:assert/strict";
import { localRankingCount } from "../lib/home-progress.js";

test("home counts only the active owner or genuine anonymous work", () => {
  const rawKey = "stackrank:movies:v1";
  const record = (count) => ({ raw: { [rawKey]: JSON.stringify({ movies: Array(count).fill({}) }) } });
  const safetyRaw = JSON.stringify({ version: 1, owners: { anonymous: record(1), "user:a": record(3), "user:b": record(2) } });
  const count = (authRaw) => localRankingCount({ safetyRaw, rawKey, field: "movies", authRaw, now: 1000 });
  assert.equal(count(null), 1);
  assert.equal(count(JSON.stringify({ user: { id: "a" }, expires_at: 2 })), 3);
  assert.equal(count(JSON.stringify({ user: { id: "b" }, expires_at: 2 })), 2);
  assert.equal(count(JSON.stringify({ user: { id: "a" }, expires_at: 0 })), 1);
  assert.equal(localRankingCount({ safetyRaw: '{"movies":[1,2]}', rawKey, field: "movies" }), 0);
  assert.equal(localRankingCount({ safetyRaw: '{broken', rawKey }), 0);
});
