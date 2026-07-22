import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canonicalCategoryPath,
  categoryForPath,
  categoryStorageKeys,
  isValidCategoryId,
  resolveDocumentCategory,
  userScopedStorageCandidates,
} from "../lib/category.js";
import { MOVIES_CATEGORY } from "../lib/categories/movies.js";
import { BOOKS_CATEGORY } from "../lib/categories/books.js";
import { DOGS_CATEGORY } from "../lib/categories/dogs.js";

const REGISTRY = [MOVIES_CATEGORY, BOOKS_CATEGORY, DOGS_CATEGORY];

test("category ids and canonical paths fail closed", () => {
  assert.equal(isValidCategoryId("tv-shows"), true);
  assert.equal(isValidCategoryId("TV Shows"), false);
  assert.equal(canonicalCategoryPath(MOVIES_CATEGORY), "/movies");
  assert.equal(canonicalCategoryPath(DOGS_CATEGORY), "/dogs");
  assert.equal(canonicalCategoryPath({ id: "books", path: "/library" }), null);
});

test("categoryForPath resolves category roots and descendants only", () => {
  assert.equal(categoryForPath("/movies", REGISTRY)?.id, "movies");
  assert.equal(categoryForPath("/books/", REGISTRY)?.id, "books");
  assert.equal(categoryForPath("/books/lists/abc?view=1", REGISTRY)?.id, "books");
  assert.equal(categoryForPath("/bookshop", REGISTRY), null);
  assert.equal(categoryForPath("/unknown", REGISTRY), null);
});

test("document category requires a known marker and rejects route mismatches", () => {
  assert.equal(
    resolveDocumentCategory({ marker: "movies", pathname: "/movies" }, REGISTRY)?.id,
    "movies",
  );
  assert.equal(
    resolveDocumentCategory({ marker: "movies", pathname: "/" }, REGISTRY)?.id,
    "movies",
    "root-based local development uses the static Movies marker",
  );
  assert.equal(
    resolveDocumentCategory(
      { marker: "movies", pathname: "/StackRank-Web/" },
      REGISTRY,
    )?.id,
    "movies",
  );
  assert.equal(resolveDocumentCategory({ marker: "movies", pathname: "/books" }, REGISTRY), null);
  assert.equal(resolveDocumentCategory({ marker: "movies", pathname: "/privacy" }, REGISTRY), null);
  assert.equal(
    resolveDocumentCategory({ marker: "books", pathname: "/books.html" }, REGISTRY)?.id,
    "books",
    "the extensionful path supports the simple local development server",
  );
  assert.equal(resolveDocumentCategory({ marker: "unknown", pathname: "/unknown" }, REGISTRY), null);
  assert.equal(resolveDocumentCategory({ pathname: "/movies" }, REGISTRY), null);
});

test("Dogs route and browser keys remain isolated from Movies and Books", () => {
  assert.equal(
    resolveDocumentCategory({ marker: "dogs", pathname: "/dogs" }, REGISTRY)?.id,
    "dogs",
  );
  assert.equal(resolveDocumentCategory({ marker: "dogs", pathname: "/movies" }, REGISTRY), null);
  assert.deepEqual(categoryStorageKeys(DOGS_CATEGORY), {
    ranking: "stackrank:dogs:ranking:v1",
    queues: "stackrank:dogs:queues:v1",
    packProgress: "stackrank:dogs:pack-progress:v1",
    backupNudge: "stackrank:dogs:backup-nudge:v1",
    shareOptions: "stackrank:dogs:share-options:v1",
    rankingView: "stackrank:dogs:ranking-view:v1",
    appDestination: "stackrank:dogs:app-destination:v1",
    suggestionSeed: "stackrank:dogs:suggestion-seed:v1",
  });
});

test("Movies storage keys remain byte-for-byte compatible", () => {
  assert.deepEqual(categoryStorageKeys(MOVIES_CATEGORY), {
    ranking: "stackrank:movies:v1",
    queues: "stackrank:suggestion-queues:v1",
    packProgress: "stackrank:pack-progress:v1",
    backupNudge: "stackrank:backup-nudge:v1",
    shareOptions: "stackrank:share-options:v1",
    rankingView: "stackrank:ranking-view:v1",
    appDestination: "stackrank:app-destination:v1",
    suggestionSeed: "stackrank:inspired-seed:v1",
  });
});

test("new categories receive isolated storage namespaces", () => {
  assert.deepEqual(categoryStorageKeys(BOOKS_CATEGORY), {
    ranking: "stackrank:books:ranking:v1",
    queues: "stackrank:books:queues:v1",
    packProgress: "stackrank:books:pack-progress:v1",
    backupNudge: "stackrank:books:backup-nudge:v1",
    shareOptions: "stackrank:books:share-options:v1",
    rankingView: "stackrank:books:ranking-view:v1",
    appDestination: "stackrank:books:app-destination:v1",
    suggestionSeed: "stackrank:books:suggestion-seed:v1",
  });
});

test("user-scoped candidate keys preserve current merge order", () => {
  assert.deepEqual(
    userScopedStorageCandidates("stackrank:suggestion-queues:v1", "user-123"),
    [
      "stackrank:suggestion-queues:v1:user:user-123",
      "stackrank:suggestion-queues:v1",
    ],
  );
  assert.deepEqual(userScopedStorageCandidates("stackrank:books:queues:v1", ""), [
    "stackrank:books:queues:v1",
  ]);
});
