import test from "node:test";
import assert from "node:assert/strict";

import {
  mergePackProgressPayloads,
  normalizePackProgressEntry,
  parsePackProgressPayload,
  stripPackProgressMetadata,
} from "../lib/pack-progress.js";

test("pack progress metadata keeps only the persisted state contract", () => {
  assert.deepEqual(
    stripPackProgressMetadata({
      startedAt: "2026-06-01T00:00:00.000Z",
      packVersionSeen: 3,
      lastIndex: "7",
      completedAt: null,
      discoveryDismissedAt: "2026-06-02T00:00:00.000Z",
      updated_at: "2026-06-03T00:00:00.000Z",
      unexpected: "drop me",
    }),
    {
      startedAt: "2026-06-01T00:00:00.000Z",
      packVersionSeen: 3,
      lastIndex: 7,
      completedAt: null,
      discoveryDismissedAt: "2026-06-02T00:00:00.000Z",
    },
  );
});

test("pack progress normalization supplies safe defaults and an outer timestamp", () => {
  assert.deepEqual(
    normalizePackProgressEntry(
      { lastIndex: "not-a-number", unexpected: true },
      "2026-06-03T00:00:00.000Z",
    ),
    {
      startedAt: null,
      packVersionSeen: null,
      lastIndex: 0,
      completedAt: null,
      discoveryDismissedAt: null,
      updated_at: "2026-06-03T00:00:00.000Z",
    },
  );
  assert.deepEqual(normalizePackProgressEntry(null), {
    startedAt: null,
    packVersionSeen: null,
    lastIndex: 0,
    completedAt: null,
    discoveryDismissedAt: null,
    updated_at: null,
  });
});

test("pack progress payload parsing accepts the storage envelope and rejects array state", () => {
  const progress = {
    "director-test": { startedAt: "2026-06-01T00:00:00.000Z" },
  };
  assert.deepEqual(
    parsePackProgressPayload(JSON.stringify({ progress })),
    { progress },
  );
  assert.deepEqual(parsePackProgressPayload(JSON.stringify({ progress: [] })), {
    progress: {},
  });
  assert.deepEqual(parsePackProgressPayload(null), { progress: {} });
  assert.throws(() => parsePackProgressPayload("{"));
});

test("pack progress merge keeps the newest entry per slug without mutating inputs", () => {
  const older = {
    progress: {
      shared: {
        startedAt: "2026-06-01T00:00:00.000Z",
        lastIndex: 2,
        updated_at: "2026-06-01T00:00:00.000Z",
      },
      "older-only": {
        lastIndex: 1,
        updated_at: "2026-06-01T00:00:00.000Z",
      },
    },
  };
  const newer = {
    progress: {
      shared: {
        startedAt: "2026-06-02T00:00:00.000Z",
        lastIndex: 5,
        updated_at: "2026-06-02T00:00:00.000Z",
      },
    },
  };

  const merged = mergePackProgressPayloads([older, newer]);

  assert.equal(merged.shared.lastIndex, 5);
  assert.equal(merged["older-only"].lastIndex, 1);
  assert.equal(older.progress.shared.lastIndex, 2);
});

test("pack progress merge treats invalid timestamps as oldest and later ties as authoritative", () => {
  const merged = mergePackProgressPayloads([
    {
      progress: {
        pack: { lastIndex: 1, updated_at: "not-a-date" },
      },
    },
    {
      progress: {
        pack: { lastIndex: 2, updated_at: "2026-06-02T00:00:00.000Z" },
      },
    },
  ]);
  assert.equal(merged.pack.lastIndex, 2);

  const tied = mergePackProgressPayloads([
    {
      progress: {
        pack: { lastIndex: 3, updated_at: "2026-06-02T00:00:00.000Z" },
      },
    },
    {
      progress: {
        pack: { lastIndex: 4, updated_at: "2026-06-02T00:00:00.000Z" },
      },
    },
  ]);
  assert.equal(tied.pack.lastIndex, 4);
});

test("pack progress merge ignores malformed payloads and entries", () => {
  assert.deepEqual(
    mergePackProgressPayloads([
      null,
      { progress: [] },
      { progress: { bad: null, alsoBad: [] } },
    ]),
    {},
  );
});
