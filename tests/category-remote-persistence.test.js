import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryListRow,
  buildCategoryPackProgressRow,
  buildCategoryRankingRow,
  buildCategorySharedListRow,
  categorySharedListUrl,
  categorySharedPayloadFromPublicRow,
  categorySharedSlugFromPath,
  categoryItemPayloadFromRow,
  categoryListUpdatedAtState,
  categoryRemoteJsonBytes,
  categoryRemoteWriteSurfaces,
  categoryStatePayloadFromRow,
  categoryUserListId,
  generateCategoryShareSlug,
  isCategoryRemoteId,
  isCategoryRemoteListType,
  mergeCategoryItemPayloads,
  mergeCategoryPlacementPayloads,
  mergeCategoryStatePayloads,
  normalizeCategorySharedPayload,
} from "../lib/category-remote-persistence.js";
import { createRankedEntity, entityRefKey } from "../lib/entity.js";

const USER_ID = "71d17419-151b-4cf7-9301-189323e6c701";
const NOW = "2026-07-16T08:00:00.000Z";

const item = (id, domain = "dogs", label = id) => createRankedEntity({
  entityRef: {
    domain,
    type: domain === "dogs" ? "breed" : "work",
    source: domain === "dogs" ? "vbo" : "openlibrary",
    id,
  },
  snapshot: { primaryText: label },
});

test("category user list ids accept only Supabase UUID identities", () => {
  assert.equal(categoryUserListId(USER_ID), `user:${USER_ID}`);
  assert.equal(categoryUserListId(`user:${USER_ID}`), `user:${USER_ID}`);
  assert.equal(categoryUserListId("mock-user"), "");
});

test("category and list-type identifiers are format and byte bounded", () => {
  assert.equal(isCategoryRemoteId("dogs"), true);
  assert.equal(isCategoryRemoteId("rare-dogs"), true);
  assert.equal(isCategoryRemoteId("d".repeat(64)), true);
  assert.equal(isCategoryRemoteId("d".repeat(65)), false);
  assert.equal(isCategoryRemoteId("Dogs"), false);
  assert.equal(isCategoryRemoteListType("not_for_me"), true);
  assert.equal(isCategoryRemoteListType("n".repeat(64)), true);
  assert.equal(isCategoryRemoteListType("n".repeat(65)), false);
  assert.equal(isCategoryRemoteListType("not-for-me"), false);
});

test("remote write plans isolate ranking, individual queues, pack progress, and full saves", () => {
  const options = { listTypes: ["curious", "not_for_me"] };
  assert.deepEqual(categoryRemoteWriteSurfaces(["ranking"], options), ["ranking"]);
  assert.deepEqual(categoryRemoteWriteSurfaces(["curious"], options), ["curious"]);
  assert.deepEqual(categoryRemoteWriteSurfaces(["packProgress"], options), ["packProgress"]);
  assert.deepEqual(categoryRemoteWriteSurfaces(["not_for_me"], options), ["not_for_me"]);
  assert.deepEqual(
    categoryRemoteWriteSurfaces(["ranking", "queues", "packProgress"], options),
    ["ranking", "curious", "not_for_me", "packProgress"],
  );
});

test("per-list queue timestamps migrate from the legacy shared timestamp without coupling rows", () => {
  const listTypes = ["curious", "not_for_me"];
  assert.deepEqual(categoryListUpdatedAtState({ updated_at: NOW }, { listTypes }), {
    curious: NOW,
    not_for_me: NOW,
  });
  const curiousUpdated = "2026-07-17T08:00:00.000Z";
  assert.deepEqual(categoryListUpdatedAtState({
    updated_at: NOW,
    list_updated_at: { curious: curiousUpdated },
  }, { listTypes }), {
    curious: curiousUpdated,
    not_for_me: NOW,
  });
});

test("cross-surface merge keeps the newest placement instead of ranking precedence", () => {
  const akita = item("VBO:0200010", "dogs", "Akita");
  const monday = "2026-07-20T08:00:00.000Z";
  const tuesday = "2026-07-21T08:00:00.000Z";
  const movedToHidden = mergeCategoryPlacementPayloads({
    ranking: [
      { items: [akita], updated_at: monday },
      { items: [], updated_at: tuesday },
    ],
    lists: {
      curious: [],
      not_for_me: [{ items: [akita], updated_at: tuesday }],
    },
  }, { category: "dogs", listTypes: ["curious", "not_for_me"] });
  assert.deepEqual(movedToHidden.ranking.items, []);
  assert.deepEqual(movedToHidden.lists.not_for_me.items.map(entityRefKey), [entityRefKey(akita)]);

  const movedToRanking = mergeCategoryPlacementPayloads({
    ranking: [{ items: [akita], updated_at: tuesday }],
    lists: {
      curious: [{ items: [akita], updated_at: monday }, { items: [], updated_at: tuesday }],
      not_for_me: [],
    },
  }, { category: "dogs", listTypes: ["curious", "not_for_me"] });
  assert.deepEqual(movedToRanking.ranking.items.map(entityRefKey), [entityRefKey(akita)]);
  assert.deepEqual(movedToRanking.lists.curious.items, []);
});

test("ranking and list row builders bind category, identity, and bounded items", () => {
  const itemWithProviderData = {
    ...item("VBO:0000661"),
    providerBlob: { shouldNotPersist: true },
  };
  const ranking = buildCategoryRankingRow({
    listId: USER_ID,
    category: "dogs",
    items: [itemWithProviderData],
    updatedAt: NOW,
  });
  assert.deepEqual(ranking, {
    list_id: `user:${USER_ID}`,
    category: "dogs",
    items: [item("VBO:0000661")],
    updated_at: NOW,
  });
  assert.equal("providerBlob" in ranking.items[0], false);
  assert.equal(buildCategoryRankingRow({
    listId: USER_ID,
    category: "dogs",
    items: [item("OL1W", "books")],
    updatedAt: NOW,
  }), null);
  assert.equal(buildCategoryRankingRow({
    listId: USER_ID,
    category: "dogs",
    items: [item("VBO:1"), item("VBO:1")],
    updatedAt: NOW,
  }), null);

  const list = buildCategoryListRow({
    listId: USER_ID,
    category: "dogs",
    listType: "not_for_me",
    items: [],
    updatedAt: NOW,
  });
  assert.equal(list.list_type, "not_for_me");
  assert.equal(buildCategoryListRow({ ...list, listId: USER_ID, listType: "Not for me" }), null);
});

test("remote rows parse only inside the expected category, list, and owner", () => {
  const row = buildCategoryListRow({
    listId: USER_ID,
    category: "dogs",
    listType: "curious",
    items: [item("VBO:0000661")],
    updatedAt: NOW,
  });
  assert.deepEqual(categoryItemPayloadFromRow(row, {
    category: "dogs",
    listId: USER_ID,
    listType: "curious",
  }), { items: row.items, updated_at: NOW });
  assert.equal(categoryItemPayloadFromRow(row, { category: "books" }), null);
  assert.equal(categoryItemPayloadFromRow(row, { category: "dogs", listType: "not_for_me" }), null);
  assert.equal(categoryItemPayloadFromRow(row, {
    category: "dogs",
    listId: "78485258-2d1b-4c25-a024-67dfdbad8e4f",
  }), null);
});

test("category ranking merge keeps newest order and appends older-only entities", () => {
  const one = item("VBO:1");
  const two = item("VBO:2");
  const three = item("VBO:3");
  const merged = mergeCategoryItemPayloads([
    { items: [one, two, three], updated_at: "2026-07-15T08:00:00.000Z" },
    { items: [two, one], updated_at: NOW },
    { items: [item("OL1W", "books")], updated_at: "2026-07-14T08:00:00.000Z" },
    { category: "books", items: [item("VBO:4")], updated_at: NOW },
  ], { category: "dogs" });
  assert.deepEqual(merged.items.map(entityRefKey), [
    entityRefKey(two),
    entityRefKey(one),
    entityRefKey(three),
  ]);
  assert.deepEqual(merged.appendedItems.map(entityRefKey), [entityRefKey(three)]);
  assert.equal(merged.updated_at, NOW);
  assert.equal(merged.acceptedPayloads, 2, "the cross-category snapshot is rejected as a unit");
});

test("pack-progress rows are bounded and no-loss merges append older-only packs", () => {
  const row = buildCategoryPackProgressRow({
    listId: USER_ID,
    category: "dogs",
    state: { gateway: { lastIndex: 2 } },
    updatedAt: NOW,
  });
  assert.equal(row.category, "dogs");
  assert.deepEqual(categoryStatePayloadFromRow(row, {
    category: "dogs",
    listId: USER_ID,
  }), { state: row.state, updated_at: NOW });
  assert.equal(categoryStatePayloadFromRow(row, { category: "books" }), null);
  assert.equal(categoryStatePayloadFromRow(row, {
    category: "dogs",
    listId: "78485258-2d1b-4c25-a024-67dfdbad8e4f",
  }), null);
  assert.equal(buildCategoryPackProgressRow({
    listId: USER_ID,
    category: "dogs",
    state: { oversized: "x".repeat(9000) },
    updatedAt: NOW,
  }), null);
  assert.equal(buildCategoryPackProgressRow({
    listId: USER_ID,
    category: "dogs",
    state: JSON.parse('{"__proto__": {"polluted": true}}'),
    updatedAt: NOW,
  }), null);
  const merged = mergeCategoryStatePayloads([
    { category: "dogs", state: { gateway: { lastIndex: 1 }, region: {} }, updated_at: "2026-07-15T08:00:00.000Z" },
    { category: "dogs", state: { gateway: { lastIndex: 2 } }, updated_at: NOW },
    { category: "books", state: { reading: {} }, updated_at: NOW },
  ], { category: "dogs" });
  assert.deepEqual(merged.state, { gateway: { lastIndex: 2 }, region: {} });
  assert.deepEqual(merged.appendedKeys, ["region"]);
  assert.equal(merged.acceptedPayloads, 2);
});

test("shared-list rows expose only the bounded generic snapshot envelope", () => {
  const payload = normalizeCategorySharedPayload({
    displayName: "Dan",
    catalogVersion: "vbo-2026-04-15.1",
    items: [{ ...item("VBO:0000661"), catalog: { unsafe: true } }],
  }, { category: "dogs" });
  const row = buildCategorySharedListRow({
    slug: "abc123def456",
    listId: USER_ID,
    category: "dogs",
    payload,
    createdAt: NOW,
  });
  assert.equal(row.slug, "abc123def456");
  assert.equal(row.revoked_at, null);
  assert.deepEqual(Object.keys(row.payload.items[0]), ["entityRef", "snapshot"]);
  assert.equal(normalizeCategorySharedPayload({ ...payload, listId: "secret" }, { category: "dogs" }), null);
  assert.equal(normalizeCategorySharedPayload(payload, { category: "books" }), null);
  assert.equal(buildCategorySharedListRow({ ...row, slug: "short", listId: USER_ID }), null);
  assert.equal(categoryRemoteJsonBytes({ emoji: "🐕" }), 16, "bounds use UTF-8 bytes");
});

test("category shared paths stay separate from legacy Movies links", () => {
  const slug = generateCategoryShareSlug(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  assert.equal(slug, "0123456789ab");
  assert.equal(slug.length, 12);
  assert.equal(
    categorySharedListUrl("https://www.stackrankapp.com", "dogs", slug),
    `https://www.stackrankapp.com/s/dogs/${slug}`,
  );
  assert.equal(categorySharedSlugFromPath(`/s/dogs/${slug}`, { category: "dogs" }), slug);
  assert.equal(categorySharedSlugFromPath(`/s/${slug}`, { category: "dogs" }), "");
  assert.equal(categorySharedSlugFromPath(`/s/books/${slug}`, { category: "dogs" }), "");
});

test("anonymous category shared rows reject owner-only columns and cross-category payloads", () => {
  const payload = normalizeCategorySharedPayload({
    items: [item("VBO:0000661")],
    catalogVersion: "vbo-2026-04-15.1",
  }, { category: "dogs" });
  const publicRow = {
    slug: "abc123def456",
    category: "dogs",
    payload,
    created_at: NOW,
    updated_at: NOW,
  };
  assert.deepEqual(categorySharedPayloadFromPublicRow(publicRow, { category: "dogs" }), publicRow);
  assert.equal(categorySharedPayloadFromPublicRow({
    ...publicRow,
    list_id: `user:${USER_ID}`,
  }, { category: "dogs" }), null);
  assert.equal(categorySharedPayloadFromPublicRow({
    ...publicRow,
    category: "books",
  }, { category: "dogs" }), null);
});
