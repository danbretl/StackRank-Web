import test from "node:test";
import assert from "node:assert/strict";
import { buildDogsBackup, parseDogsBackup } from "../lib/dogs.js";

test("one unfamiliar progress entry cannot erase supported progress from a backup", () => {
  const timestamp = "2026-10-07T00:00:00.000Z";
  const backup = buildDogsBackup({ ranking: [], lists: { curious: [], not_for_me: [] }, preferences: {},
    packProgress: { known: { startedAt: timestamp }, future: { startedAt: timestamp, lastIndex: 3 }, malformed: { versionSeen: "bad" } },
  });
  assert.deepEqual(backup.packProgress, { known: { startedAt: timestamp }, future: { startedAt: timestamp } });
  assert.equal(backup.warnings[0].affectedEntries, 2);
  assert.deepEqual(parseDogsBackup(JSON.stringify(backup)).packProgress, backup.packProgress);
  assert.equal(parseDogsBackup(JSON.stringify({ ...backup, packProgress: { future: { lastIndex: 3 } } })), null);
});
