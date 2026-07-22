import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createRankedEntity,
  entityRefKey,
  isDuplicateEntity,
  mergeEntityRankings,
  normalizeEntityRef,
} from "../lib/entity.js";

const rankedBook = (id, title = id) =>
  createRankedEntity({
    entityRef: { domain: "books", type: "work", source: "openlibrary", id },
    snapshot: { primaryText: title, secondaryText: "Author" },
  });

test("provider-qualified entity refs prevent cross-domain and cross-type collisions", () => {
  const book = { domain: "books", type: "work", source: "openlibrary", id: "OL1W" };
  assert.equal(entityRefKey(book), "books:work:openlibrary:OL1W");
  assert.equal(
    entityRefKey({ ...book, domain: "movies", source: "tmdb" }),
    "movies:work:tmdb:OL1W",
  );
  assert.equal(normalizeEntityRef({ ...book, domain: "Books" })?.domain, "books");
  assert.equal(normalizeEntityRef({ ...book, id: "" }), null);
});

test("ranked entity snapshots keep only the durable display contract", () => {
  const item = createRankedEntity({
    entityRef: { domain: "books", type: "work", source: "openlibrary", id: "OL1W" },
    snapshot: {
      primaryText: "Dune",
      secondaryText: "Frank Herbert",
      year: "1965",
      image: { url: "https://example.com/dune.jpg", alt: "Dune cover", ignored: true },
      ignored: true,
    },
    comparisons: 2,
    rankedAt: "2026-07-13T12:00:00.000Z",
  });
  assert.deepEqual(item, {
    entityRef: { domain: "books", type: "work", source: "openlibrary", id: "OL1W" },
    snapshot: {
      primaryText: "Dune",
      secondaryText: "Frank Herbert",
      year: 1965,
      image: { url: "https://example.com/dune.jpg", alt: "Dune cover", assetId: "" },
    },
    rankedAt: "2026-07-13T12:00:00.000Z",
    comparisons: 2,
  });
});

test("entity dedup and merge preserve base order without losing unique items", () => {
  const one = rankedBook("OL1W", "One");
  const two = rankedBook("OL2W", "Two");
  const three = rankedBook("OL3W", "Three");
  assert.equal(isDuplicateEntity([one], rankedBook("OL1W", "Renamed")), true);
  assert.deepEqual(
    mergeEntityRankings([one, two], [rankedBook("OL2W"), three]).map(entityRefKey),
    [entityRefKey(one), entityRefKey(two), entityRefKey(three)],
  );
});
