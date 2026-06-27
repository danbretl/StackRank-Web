import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildImportedRanking,
  buildStackRankBackup,
  chooseAutomaticTmdbMatch,
  parseRankedTitleList,
  parseStackRankBackup,
} from "../lib/backup.js";

test("parseRankedTitleList preserves order and strips common list prefixes", () => {
  const parsed = parseRankedTitleList(`
    1. The Godfather (1972)
    2) Spirited Away - 2001
    - Parasite [2019]
    • Heat
  `);
  assert.deepEqual(
    parsed.entries.map(({ title, year }) => ({ title, year })),
    [
      { title: "The Godfather", year: 1972 },
      { title: "Spirited Away", year: 2001 },
      { title: "Parasite", year: 2019 },
      { title: "Heat", year: null },
    ],
  );
});

test("parseRankedTitleList strips stacked list markers like bullet + task-list checkbox", () => {
  const parsed = parseRankedTitleList(`
    - [ ] Lost Highway
    - [x] Mulholland Drive (2001)
    1. - [ ] Dune (2021)
    [ ] Parasite [2019]
  `);
  assert.deepEqual(
    parsed.entries.map(({ title, year }) => ({ title, year })),
    [
      { title: "Lost Highway", year: null },
      { title: "Mulholland Drive", year: 2001 },
      { title: "Dune", year: 2021 },
      { title: "Parasite", year: 2019 },
    ],
  );
});

test("parseRankedTitleList does not strip bracketed titles that aren't checkboxes", () => {
  const parsed = parseRankedTitleList("- [REC] (2007)");
  assert.deepEqual(parsed.entries[0], {
    source: "[REC] (2007)",
    title: "[REC]",
    year: 2007,
  });
});

test("parseRankedTitleList ignores exact duplicate title/year lines", () => {
  const parsed = parseRankedTitleList("1. Heat (1995)\nHeat (1995)\nHeat (1986)");
  assert.equal(parsed.duplicateCount, 1);
  assert.deepEqual(parsed.entries.map((entry) => entry.year), [1995, 1986]);
});

test("parseRankedTitleList does not mistake a title's leading initial for a list marker", () => {
  const parsed = parseRankedTitleList("A.I. Artificial Intelligence (2001)");
  assert.deepEqual(parsed.entries[0], {
    source: "A.I. Artificial Intelligence (2001)",
    title: "A.I. Artificial Intelligence",
    year: 2001,
  });
});

test("chooseAutomaticTmdbMatch honors a supplied year and reports confidence", () => {
  const results = [
    { tmdbId: 1, title: "Heat", year: 1995 },
    { tmdbId: 2, title: "Heat", year: 1986 },
    { tmdbId: 3, title: "The Heat", year: 2013 },
  ];
  // Note: "The Heat" normalizes to "heat", so all three are title matches.
  const byYear = chooseAutomaticTmdbMatch({ title: "Heat", year: 1995 }, results);
  assert.equal(byYear.movie.tmdbId, 1);
  assert.equal(byYear.confidence, "exact");
});

test("chooseAutomaticTmdbMatch picks the most popular when several titles match and no year", () => {
  const results = [
    { tmdbId: 10, title: "Total Recall", year: 1990 },
    { tmdbId: 11, title: "Total Recall", year: 2012 },
  ];
  const chosen = chooseAutomaticTmdbMatch({ title: "Total recall", year: null }, results);
  assert.equal(chosen.movie.tmdbId, 10); // TMDB returns most popular first
  assert.equal(chosen.confidence, "guess");
});

test("chooseAutomaticTmdbMatch ignores leading articles and punctuation", () => {
  const results = [{ tmdbId: 20, title: "The Death of Stalin", year: 2017 }];
  const stalin = chooseAutomaticTmdbMatch({ title: "Death of Stalin", year: null }, results);
  assert.equal(stalin.movie.tmdbId, 20);
  assert.equal(stalin.confidence, "exact");

  const spider = chooseAutomaticTmdbMatch(
    { title: "Spider Man", year: null },
    [{ tmdbId: 21, title: "Spider-Man", year: 2002 }],
  );
  assert.equal(spider.movie.tmdbId, 21);
});

test("chooseAutomaticTmdbMatch falls back to a multi-word subset as a guess", () => {
  const results = [
    { tmdbId: 30, title: "Sonic the Hedgehog 3", year: 2024 },
    { tmdbId: 31, title: "Sonic the Hedgehog", year: 2020 },
  ];
  const sonic = chooseAutomaticTmdbMatch({ title: "Sonic 3", year: null }, results);
  assert.equal(sonic.movie.tmdbId, 30);
  assert.equal(sonic.confidence, "guess");
});

test("chooseAutomaticTmdbMatch will not subset-match a single common word", () => {
  const results = [{ tmdbId: 40, title: "Iron Man", year: 2008 }];
  const man = chooseAutomaticTmdbMatch({ title: "Man", year: null }, results);
  assert.equal(man.movie, null);
  assert.equal(man.confidence, null);
});

test("chooseAutomaticTmdbMatch returns nulls when nothing is close", () => {
  const none = chooseAutomaticTmdbMatch({ title: "Godfather of Harlem", year: null }, []);
  assert.equal(none.movie, null);
  assert.equal(none.confidence, null);
});

test("backup round-trip keeps list order and removes cross-list duplicates", () => {
  const backup = buildStackRankBackup({
    ranking: [{ tmdbId: 1, title: "Alpha", year: 1990 }],
    watchList: [
      { tmdbId: 1, title: "Alpha", year: 1990 },
      { tmdbId: 2, title: "Beta", year: 2000 },
    ],
    notInterestedList: [
      { tmdbId: 2, title: "Beta", year: 2000 },
      { tmdbId: 3, title: "Gamma", year: 2010 },
    ],
    packProgress: { "starter-pack": { lastIndex: 3, packVersionSeen: 2 } },
    shareOptions: { version: 7, theme: "cinema" },
    exportedAt: "2026-06-27T12:00:00.000Z",
  });
  const restored = parseStackRankBackup(JSON.stringify(backup));
  assert.deepEqual(restored.ranking.map((movie) => movie.title), ["Alpha"]);
  assert.deepEqual(restored.watchList.map((movie) => movie.title), ["Beta"]);
  assert.deepEqual(restored.notInterestedList.map((movie) => movie.title), ["Gamma"]);
  assert.equal(restored.packProgress["starter-pack"].lastIndex, 3);
  assert.equal(restored.shareOptions.theme, "cinema");
});

test("parseStackRankBackup rejects unrelated or unsupported JSON", () => {
  assert.throws(() => parseStackRankBackup("{"), /valid JSON/);
  assert.throws(() => parseStackRankBackup('{"kind":"other","version":1}'), /not a StackRank/);
  assert.throws(
    () => parseStackRankBackup('{"kind":"stackrank-backup","version":2,"ranking":[]}'),
    /not supported/,
  );
});

test("buildImportedRanking preserves selected order and deduplicates TMDB ids", () => {
  const imported = buildImportedRanking(
    [
      { selectedMovie: { tmdbId: 2, title: "Second", year: 2002, savedAt: "old" } },
      { selectedMovie: { tmdbId: 1, title: "First", year: 2001 } },
      { selectedMovie: { tmdbId: 2, title: "Second duplicate", year: 2002 } },
      { selectedMovie: null },
    ],
    "2026-06-27T12:00:00.000Z",
  );
  assert.deepEqual(imported.map((movie) => movie.tmdbId), [2, 1]);
  assert.ok(imported.every((movie) => movie.rankedAt === "2026-06-27T12:00:00.000Z"));
  assert.ok(imported.every((movie) => movie.savedAt === undefined));
});
