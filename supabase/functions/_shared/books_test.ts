import {
  normalizeOpenLibraryBook,
  normalizeOpenLibraryBooks,
} from "./books.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("normalizes a work-level Open Library result", () => {
  const book = normalizeOpenLibraryBook({
    key: "/works/ol893415w",
    title: " Dune ",
    author_name: ["Frank Herbert", ""],
    first_publish_year: 1965,
    cover_i: 11481354,
    description: "must not leak",
  });
  assert(book?.key === "/works/OL893415W", "work id should be canonicalized");
  assert(book?.title === "Dune", "title should be trimmed");
  assert(book?.authors.join("|") === "Frank Herbert", "authors should be normalized");
  assert(book?.year === 1965, "year should be retained");
  assert(book?.coverId === 11481354, "cover id should be retained");
  assert(!("description" in (book || {})), "unneeded source prose must not be returned");
});

Deno.test("rejects editions and deduplicates work results", () => {
  assert(
    normalizeOpenLibraryBook({ key: "/books/OL1M", title: "Edition" }) === null,
    "edition ids must not become ranked work ids",
  );
  const results = normalizeOpenLibraryBooks([
    { key: "/works/OL1W", title: "One" },
    { key: "/works/OL1W", title: "Duplicate" },
    { key: "/works/OL2W", title: "Two" },
  ]);
  assert(results.length === 2, "duplicate works should be removed");
  assert(results[0].title === "One", "first provider result should win");
});

Deno.test("result limits are enforced after malformed rows are skipped", () => {
  const results = normalizeOpenLibraryBooks([
    null,
    { key: "/works/OL1W", title: "One" },
    { key: "/works/OL2W", title: "Two" },
  ], 1);
  assert(results.length === 1 && results[0].key === "/works/OL1W", "limit should be enforced");
});
