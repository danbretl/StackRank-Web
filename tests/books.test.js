import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BOOK_STARTER_SHELVES,
  bookCoverUrl,
  normalizeBookSearchResult,
} from "../lib/categories/books.js";
import { entityRefKey } from "../lib/entity.js";

test("Open Library search rows normalize to work-level entity summaries", () => {
  const result = normalizeBookSearchResult({
    key: "/works/OL893415W",
    title: "Dune",
    author_name: ["Frank Herbert"],
    first_publish_year: 1965,
    cover_i: 11481354,
  });
  assert.equal(entityRefKey(result), "books:work:openlibrary:OL893415W");
  assert.equal(result.snapshot.primaryText, "Dune");
  assert.equal(result.snapshot.secondaryText, "Frank Herbert");
  assert.equal(result.snapshot.year, 1965);
  assert.equal(
    result.snapshot.image.url,
    "https://covers.openlibrary.org/b/id/11481354-M.jpg?default=false",
  );
});

test("book normalization rejects editions and malformed rows", () => {
  assert.equal(normalizeBookSearchResult({ key: "/books/OL1M", title: "Edition" }), null);
  assert.equal(normalizeBookSearchResult({ key: "/works/OL1W", title: "" }), null);
  assert.equal(bookCoverUrl(null), "");
});

test("starter shelves are bounded, unique work-level discovery fixtures", () => {
  assert.equal(BOOK_STARTER_SHELVES.length, 3);
  assert.deepEqual(BOOK_STARTER_SHELVES.map((shelf) => shelf.items.length), [4, 4, 4]);
  const keys = BOOK_STARTER_SHELVES.flatMap((shelf) => shelf.items.map(entityRefKey));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((key) => key.startsWith("books:work:openlibrary:")));
});
