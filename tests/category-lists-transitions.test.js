import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCategoryListState,
  removeCategoryEntity,
  transitionCategoryEntity,
} from "../lib/category-lists.js";
import { createRankedEntity, entityRefKey } from "../lib/entity.js";

const dog = (id, label = id) => createRankedEntity({
  entityRef: { domain: "dogs", type: "dog", source: "vbo", id },
  snapshot: { primaryText: label },
});
const book = (id) => createRankedEntity({
  entityRef: { domain: "books", type: "work", source: "openlibrary", id },
  snapshot: { primaryText: id },
});
const OPTIONS = { domain: "dogs", listTypes: ["curious", "not_for_me"] };

test("list state normalization gives ranking canonical-identity priority and rejects other domains", () => {
  const one = dog("VBO:1", "German Shepherd Dog");
  const sameIdentityViaAlias = dog("VBO:1", "Alsatian");
  const two = dog("VBO:2");
  const normalized = normalizeCategoryListState({
    ranking: [one, book("OL1W")],
    lists: {
      curious: [sameIdentityViaAlias, two, book("OL2W")],
      not_for_me: [two],
      invented: [dog("VBO:3")],
    },
  }, OPTIONS);
  assert.deepEqual(normalized.ranking.map(entityRefKey), [entityRefKey(one)]);
  assert.deepEqual(normalized.lists.curious.map(entityRefKey), [entityRefKey(two)]);
  assert.deepEqual(normalized.lists.not_for_me, []);
  assert.equal("invented" in normalized.lists, false);
});

test("entities move exclusively between Dogs secondary lists", () => {
  const one = dog("VBO:1");
  const state = { ranking: [], lists: { curious: [one], not_for_me: [] } };
  const moved = transitionCategoryEntity(state, { entity: one, to: "not_for_me" }, OPTIONS);
  assert.equal(moved.changed, true);
  assert.deepEqual(moved.removedFrom, ["curious"]);
  assert.deepEqual(moved.state.lists.curious, []);
  assert.deepEqual(moved.state.lists.not_for_me, [one]);
  assert.deepEqual(state.lists.curious, [one], "the source state remains untouched");
});

test("a transition to the current surface without an index is a no-op", () => {
  const one = dog("VBO:1");
  const two = dog("VBO:2");
  const state = { ranking: [], lists: { curious: [one, two], not_for_me: [] } };
  const result = transitionCategoryEntity(state, { entity: one, to: "curious" }, OPTIONS);
  assert.equal(result.changed, false);
  assert.deepEqual(result.state.lists.curious, [one, two]);
});

test("transitioning into a ranking requires the exact insertion index", () => {
  const one = dog("VBO:1");
  const two = dog("VBO:2");
  const state = { ranking: [one], lists: { curious: [two], not_for_me: [] } };
  assert.equal(
    transitionCategoryEntity(state, { entity: two, to: "ranking" }, OPTIONS).reason,
    "ranking-index-required",
  );
  const moved = transitionCategoryEntity(state, { entity: two, to: "ranking", index: 0 }, OPTIONS);
  assert.deepEqual(moved.state.ranking.map(entityRefKey), [entityRefKey(two), entityRefKey(one)]);
  assert.deepEqual(moved.state.lists.curious, []);
});

test("invalid destinations and cross-category entities fail closed", () => {
  const state = { ranking: [], lists: { curious: [], not_for_me: [] } };
  assert.equal(transitionCategoryEntity(state, { entity: dog("VBO:1"), to: "watch" }, OPTIONS).reason, "invalid-destination");
  assert.equal(transitionCategoryEntity(state, { entity: book("OL1W"), to: "curious" }, OPTIONS).reason, "invalid-entity");
});

test("removal reports unchanged when canonical identity is absent", () => {
  const one = dog("VBO:1");
  const state = { ranking: [one], lists: { curious: [], not_for_me: [] } };
  assert.equal(removeCategoryEntity(state, dog("VBO:2"), OPTIONS).changed, false);
  const removed = removeCategoryEntity(state, one, OPTIONS);
  assert.equal(removed.changed, true);
  assert.deepEqual(removed.state.ranking, []);
});
