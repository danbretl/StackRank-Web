import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mergeQueuePayloads,
  mergeRankingPayloads,
  normalizeSuggestionQueueLists,
  parseQueuePayload,
  parseRankingPayload,
} from "../lib/persistence.js";

const movie = (tmdbId, title = `Movie ${tmdbId}`) => ({ tmdbId, title });

test("parseRankingPayload accepts legacy arrays and current timestamped payloads", () => {
  assert.deepEqual(parseRankingPayload(JSON.stringify([movie(1)])), {
    movies: [movie(1)],
    updated_at: null,
  });
  assert.deepEqual(
    parseRankingPayload(
      JSON.stringify({
        movies: [movie(2)],
        updated_at: "2026-06-27T12:00:00.000Z",
      }),
    ),
    {
      movies: [movie(2)],
      updated_at: "2026-06-27T12:00:00.000Z",
    },
  );
});

test("payload parsers fail closed on missing, corrupt, and wrong-shaped storage", () => {
  const emptyRanking = { movies: [], updated_at: null };
  const emptyQueues = {
    watchList: [],
    notInterestedList: [],
    updated_at: null,
  };

  for (const raw of [null, "", "{", "42", "{}", '{"movies":"nope"}']) {
    assert.deepEqual(parseRankingPayload(raw), emptyRanking);
  }
  for (const raw of [null, "", "{", "42", "[]"]) {
    assert.deepEqual(parseQueuePayload(raw), emptyQueues);
  }
});

test("parseQueuePayload independently normalizes malformed queue fields", () => {
  assert.deepEqual(
    parseQueuePayload(
      JSON.stringify({
        watchList: [movie(1)],
        notInterestedList: "nope",
        updated_at: "2026-06-27T12:00:00.000Z",
      }),
    ),
    {
      watchList: [movie(1)],
      notInterestedList: [],
      updated_at: "2026-06-27T12:00:00.000Z",
    },
  );
});

test("mergeRankingPayloads keeps newest order and appends movies only older snapshots contain", () => {
  const older = {
    movies: [movie(1), movie(2), movie(3)],
    updated_at: "2026-06-26T12:00:00.000Z",
  };
  const newer = {
    movies: [movie(2), movie(1)],
    updated_at: "2026-06-27T12:00:00.000Z",
  };
  const payloads = [older, newer];

  const merged = mergeRankingPayloads(payloads);

  assert.deepEqual(merged.movies.map(({ tmdbId }) => tmdbId), [2, 1, 3]);
  assert.equal(merged.updated_at, newer.updated_at);
  assert.deepEqual(payloads, [older, newer], "caller-owned payload order is not mutated");
});

test("mergeRankingPayloads treats invalid timestamps as oldest and preserves first input on ties", () => {
  const valid = {
    movies: [movie(2)],
    updated_at: "2026-06-27T12:00:00.000Z",
  };
  const invalid = { movies: [movie(1)], updated_at: "not-a-date" };
  assert.deepEqual(
    mergeRankingPayloads([invalid, valid]).movies.map(({ tmdbId }) => tmdbId),
    [2, 1],
  );

  const tied = mergeRankingPayloads([
    { movies: [movie(3)], updated_at: valid.updated_at },
    { movies: [movie(4)], updated_at: valid.updated_at },
  ]);
  assert.deepEqual(tied.movies.map(({ tmdbId }) => tmdbId), [3, 4]);
});

test("ranking merge never loses a unique movie across snapshot permutations", () => {
  const snapshots = [
    {
      movies: [movie(1), movie(2), movie(3)],
      updated_at: "2026-06-25T12:00:00.000Z",
    },
    {
      movies: [movie(3), movie(4)],
      updated_at: "2026-06-27T12:00:00.000Z",
    },
    {
      movies: [movie(5), movie(2)],
      updated_at: "2026-06-26T12:00:00.000Z",
    },
  ];
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];

  for (const order of permutations) {
    const merged = mergeRankingPayloads(order.map((index) => snapshots[index]));
    assert.deepEqual(
      new Set(merged.movies.map(({ tmdbId }) => tmdbId)),
      new Set([1, 2, 3, 4, 5]),
    );
    assert.deepEqual(
      merged.movies.slice(0, 2).map(({ tmdbId }) => tmdbId),
      [3, 4],
      "the newest snapshot remains the ordering base",
    );
  }
});

test("mergeQueuePayloads applies the same newest-base, never-shrink rule to both queues", () => {
  const older = {
    watchList: [movie(1), movie(2)],
    notInterestedList: [movie(8), movie(9)],
    updated_at: "2026-06-26T12:00:00.000Z",
  };
  const newer = {
    watchList: [movie(2), movie(3)],
    notInterestedList: [movie(9), movie(10)],
    updated_at: "2026-06-27T12:00:00.000Z",
  };

  const merged = mergeQueuePayloads([older, newer]);

  assert.deepEqual(merged.watchList.map(({ tmdbId }) => tmdbId), [2, 3, 1]);
  assert.deepEqual(
    merged.notInterestedList.map(({ tmdbId }) => tmdbId),
    [9, 10, 8],
  );
  assert.equal(merged.updated_at, newer.updated_at);
});

test("normalizeSuggestionQueueLists removes ranked movies and lets Watch next win conflicts", () => {
  const ranking = [movie(1)];
  const watchList = [movie(1), movie(2), movie(3)];
  const notInterestedList = [movie(1), movie(2), movie(4)];

  const normalized = normalizeSuggestionQueueLists({
    ranking,
    watchList,
    notInterestedList,
  });

  assert.deepEqual(normalized.watchList.map(({ tmdbId }) => tmdbId), [2, 3]);
  assert.deepEqual(
    normalized.notInterestedList.map(({ tmdbId }) => tmdbId),
    [4],
  );
  assert.deepEqual(watchList.map(({ tmdbId }) => tmdbId), [1, 2, 3]);
  assert.deepEqual(notInterestedList.map(({ tmdbId }) => tmdbId), [1, 2, 4]);
});
