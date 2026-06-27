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

test("chooseAutomaticTmdbMatch requires one exact title and honors a supplied year", () => {
  const results = [
    { tmdbId: 1, title: "Heat", year: 1995 },
    { tmdbId: 2, title: "Heat", year: 1986 },
    { tmdbId: 3, title: "The Heat", year: 2013 },
  ];
  assert.equal(chooseAutomaticTmdbMatch({ title: "Heat", year: 1995 }, results)?.tmdbId, 1);
  assert.equal(chooseAutomaticTmdbMatch({ title: "Heat", year: null }, results), null);
  assert.equal(
    chooseAutomaticTmdbMatch({ title: "The Heat", year: null }, results)?.tmdbId,
    3,
  );
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
