import { test } from "node:test";
import assert from "node:assert/strict";

import {
  categoryRankingStats,
  moveRankedEntity,
  recentRankedEntities,
  removeRankedEntity,
} from "../lib/category-ranking.js";
import { createRankedEntity, entityRefKey } from "../lib/entity.js";

const item = (domain, id, rankedAt, comparisons = 0) => createRankedEntity({
  entityRef: { domain, type: domain === "dogs" ? "dog" : "work", source: domain === "dogs" ? "vbo" : "openlibrary", id },
  snapshot: { primaryText: id },
  rankedAt,
  comparisons,
});

test("category ranking movement and removal use canonical entity identity immutably", () => {
  const one = item("dogs", "VBO:1", "2026-07-13T10:00:00.000Z", 2);
  const two = item("dogs", "VBO:2", "2026-07-14T10:00:00.000Z", 1);
  const three = item("dogs", "VBO:3", "2026-07-15T10:00:00.000Z", 3);
  const ranking = [one, two, three];
  const moved = moveRankedEntity(ranking, { entityRef: two.entityRef }, 0);
  assert.equal(moved.changed, true);
  assert.deepEqual(moved.items.map(entityRefKey), [entityRefKey(two), entityRefKey(one), entityRefKey(three)]);
  assert.deepEqual(ranking, [one, two, three]);
  const removed = removeRankedEntity(moved.items, entityRefKey(one));
  assert.equal(removed.index, 1);
  assert.deepEqual(removed.items.map(entityRefKey), [entityRefKey(two), entityRefKey(three)]);
});

test("invalid and no-op ranking operations report unchanged state", () => {
  const ranking = [item("books", "OL1W", null)];
  assert.equal(moveRankedEntity(ranking, ranking[0], 0).changed, false);
  assert.equal(moveRankedEntity(ranking, ranking[0], 3).changed, false);
  assert.equal(removeRankedEntity(ranking, "missing").changed, false);
});

test("recent rankings retain actual ranks and stats ignore malformed counters", () => {
  const ranking = [
    item("dogs", "VBO:1", "2026-07-13T10:00:00.000Z", 2),
    item("dogs", "VBO:2", "bad-date", 100),
    item("dogs", "VBO:3", "2026-07-15T10:00:00.000Z", 3),
  ];
  ranking[1].comparisons = -1;
  const recent = recentRankedEntities(ranking, 2);
  assert.deepEqual(recent.map(({ item: ranked, rank }) => [entityRefKey(ranked), rank]), [
    [entityRefKey(ranking[2]), 3],
    [entityRefKey(ranking[0]), 1],
  ]);
  assert.deepEqual(categoryRankingStats(ranking), {
    count: 3,
    top: ranking[0],
    totalComparisons: 5,
    latestRankedAt: "2026-07-15T10:00:00.000Z",
  });
});
