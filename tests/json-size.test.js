import test from "node:test";
import assert from "node:assert/strict";
import { postgresJsonByteLength } from "../lib/json-size.js";
import { jsonByteLength, isRemoteJsonPayloadWithinByteLimit } from "../lib/persistence.js";
import { buildCategoryPackProgressRow } from "../lib/category-remote-persistence.js";

test("database byte measure includes jsonb separators, UTF-8, and numeric expansion", () => {
  assert.equal(postgresJsonByteLength({ a: 1, b: ["é", true] }), Buffer.byteLength('{"a": 1, "b": ["é", true]}'));
  assert.equal(postgresJsonByteLength(1e21), 22);
  assert.equal(postgresJsonByteLength(-1.2e-7), 11);
  assert.equal(postgresJsonByteLength({ a: undefined, b: NaN }), 11);
  assert.equal(postgresJsonByteLength("\0"), Infinity);
  assert.equal(postgresJsonByteLength("\ud800"), Infinity);
  assert.equal(postgresJsonByteLength("🐕"), 6);
});

test("115 progress entries cross actual PostgreSQL 17.11 8 KiB boundary", () => {
  const state = Object.fromEntries(Array.from({ length: 115 }, (_, i) => [`pack-${i}`, {
    startedAt: "2026-09-02T00:00:00.000Z", versionSeen: 1,
  }]));
  assert.equal(jsonByteLength(state), 7711);
  assert.equal(postgresJsonByteLength(state), 8285);
  assert.equal(isRemoteJsonPayloadWithinByteLimit(state, 8192), false);
  assert.equal(buildCategoryPackProgressRow({ listId: "user:11111111-1111-4111-8111-111111111111", category: "dogs", state }), null);
});
