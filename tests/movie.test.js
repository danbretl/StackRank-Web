import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTitle, movieKey, movieYear, isDuplicateMovie, mergeRankings } from "../lib/movie.js";

test("normalizeTitle trims and lowercases; tolerates non-strings", () => {
  assert.equal(normalizeTitle("  The Matrix  "), "the matrix");
  assert.equal(normalizeTitle("PARASITE"), "parasite");
  assert.equal(normalizeTitle(null), "");
  assert.equal(normalizeTitle(undefined), "");
});

test("movieKey prefers tmdbId, falls back to title(+year)", () => {
  assert.equal(movieKey({ tmdbId: 603, title: "The Matrix", year: 1999 }), "tmdb:603");
  assert.equal(movieKey({ title: "The Matrix", year: 1999 }), "title:the matrix:1999");
  assert.equal(movieKey({ title: "Untitled" }), "title:untitled");
});

test("movieYear validates and rejects garbage", () => {
  assert.equal(movieYear({ year: 1999 }), 1999);
  assert.equal(movieYear({ year: "2007" }), 2007);
  assert.equal(movieYear({ year: 0 }), null);
  assert.equal(movieYear({ year: 1700 }), null);
  assert.equal(movieYear({ year: "nope" }), null);
  assert.equal(movieYear({}), null);
  assert.equal(movieYear(null), null);
});

test("isDuplicateMovie matches on tmdbId regardless of title", () => {
  const list = [{ tmdbId: 603, title: "The Matrix", year: 1999 }];
  assert.ok(isDuplicateMovie(list, { tmdbId: 603, title: "Different label", year: 2020 }));
  assert.equal(isDuplicateMovie(list, { tmdbId: 999, title: "Other" }), false);
});

test("isDuplicateMovie: different ids but same title+year still collide", () => {
  // The id check requires equality; when ids differ it falls through to the
  // title(+year) path, which matches. Documents that title+year wins even with
  // mismatched ids (rare, but it's the real behavior).
  const list = [{ tmdbId: 603, title: "The Matrix", year: 1999 }];
  assert.ok(isDuplicateMovie(list, { tmdbId: 604, title: "The Matrix", year: 1999 }));
});

test("isDuplicateMovie matches legacy title(+year) entries case-insensitively", () => {
  const list = [{ title: "The Matrix", year: 1999 }];
  assert.ok(isDuplicateMovie(list, { title: "the matrix", year: 1999 }));
  assert.ok(isDuplicateMovie(list, { title: "THE MATRIX" }), "title-only incoming matches when no year to disagree");
  assert.equal(isDuplicateMovie(list, { title: "The Matrix", year: 2003 }), false, "different year is not a dup");
  assert.equal(isDuplicateMovie(list, { title: "The Matrix Reloaded", year: 2003 }), false);
});

test("isDuplicateMovie bridges a legacy title entry and a later id-bearing one", () => {
  // Same film, one with id and one without, same title — treated as duplicate.
  const list = [{ title: "Parasite", year: 2019 }];
  assert.ok(isDuplicateMovie(list, { tmdbId: 496243, title: "Parasite", year: 2019 }));
});

test("mergeRankings appends only new keys and preserves base order", () => {
  const base = [
    { tmdbId: 1, title: "A" },
    { tmdbId: 2, title: "B" },
  ];
  const incoming = [
    { tmdbId: 2, title: "B (dupe)" },
    { tmdbId: 3, title: "C" },
  ];
  const merged = mergeRankings(base, incoming);
  assert.deepEqual(merged.map((m) => m.title), ["A", "B", "C"]);
  // Base entries are kept verbatim (the dupe from incoming is ignored).
  assert.equal(merged[1].title, "B");
});

test("mergeRankings never shrinks the base list", () => {
  const base = [{ tmdbId: 1 }, { tmdbId: 2 }, { tmdbId: 3 }];
  // Even a smaller, fully-overlapping incoming list cannot drop base entries.
  const merged = mergeRankings(base, [{ tmdbId: 1 }]);
  assert.equal(merged.length, 3);
});

test("mergeRankings dedups across the title/id identity boundary", () => {
  const base = [{ tmdbId: 603, title: "The Matrix", year: 1999 }];
  // A title-only incoming with no id has a different key, so it WILL be appended
  // (merge dedups by key; cross-identity bridging is isDuplicateMovie's job at
  // add-time). This documents the boundary explicitly.
  const merged = mergeRankings(base, [{ title: "The Matrix", year: 1999 }]);
  assert.equal(merged.length, 2);
});

test("mergeRankings on empty inputs", () => {
  assert.deepEqual(mergeRankings([], []), []);
  assert.deepEqual(mergeRankings([{ tmdbId: 1 }], []).length, 1);
  assert.deepEqual(mergeRankings([], [{ tmdbId: 1 }]).length, 1);
});
