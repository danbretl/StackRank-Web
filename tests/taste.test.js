import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TASTE_EXPLORER_MIN_MOVIES,
  buildTasteSignals,
  movieMatchesTasteSignal,
  tasteMatchingPacks,
  tasteSignalEntries,
  tasteSignalPackQuery,
} from "../lib/taste.js";

test("buildTasteSignals returns meaningful repeated, rank-weighted patterns", () => {
  const signals = buildTasteSignals({
    topDecade: { decade: 1990, count: 3, score: 2.2 },
    decades: [{ decade: 1990, count: 3, score: 2.2 }],
    genres: [
      { name: "Drama", count: 4, score: 3.1 },
      { name: "Comedy", count: 1, score: 1 },
    ],
    directors: [{ name: "Jane Director", count: 2, score: 1.5 }],
    cast: [{ name: "Actor A", count: 3, score: 1.4 }],
  });

  assert.equal(TASTE_EXPLORER_MIN_MOVIES, 5);
  assert.deepEqual(
    signals.map(({ type, value }) => ({ type, value })),
    [
      { type: "genre", value: "Drama" },
      { type: "decade", value: "1990s" },
      { type: "director", value: "Jane Director" },
    ],
  );
  assert.match(signals[0].description, /strongest near the top/);
});

test("buildTasteSignals omits one-off coincidences and picks the stronger recurring person", () => {
  const signals = buildTasteSignals({
    topDecade: { decade: 2010, count: 1, score: 1 },
    genres: [{ name: "Drama", count: 1, score: 1 }],
    directors: [{ name: "Director", count: 2, score: 1.1 }],
    cast: [{ name: "Actor", count: 2, score: 1.8 }],
  });

  assert.deepEqual(signals.map(({ type, value }) => ({ type, value })), [
    { type: "cast", value: "Actor" },
  ]);
});

test("buildTasteSignals skips a one-off top era for the strongest recurring era", () => {
  const signals = buildTasteSignals({
    topDecade: { decade: 1960, count: 1, score: 1 },
    decades: [
      { decade: 1960, count: 1, score: 1 },
      { decade: 2010, count: 2, score: 0.8 },
    ],
    genres: [],
    directors: [],
    cast: [],
  });

  assert.deepEqual(signals.map(({ type, value }) => ({ type, value })), [
    { type: "decade", value: "2010s" },
  ]);
});

test("movieMatchesTasteSignal supports decade, genre, director, and cast lenses", () => {
  const movie = {
    title: "Example",
    year: 1997,
    genres: ["Drama", "Mystery"],
    director: "Jane Director",
    cast: ["Actor A", "Actor B"],
  };

  assert.equal(movieMatchesTasteSignal(movie, { type: "decade", value: "1990s" }), true);
  assert.equal(movieMatchesTasteSignal(movie, { type: "genre", value: "drama" }), true);
  assert.equal(movieMatchesTasteSignal(movie, { type: "director", value: "JANE DIRECTOR" }), true);
  assert.equal(movieMatchesTasteSignal(movie, { type: "cast", value: "Actor B" }), true);
  assert.equal(movieMatchesTasteSignal(movie, { type: "genre", value: "Comedy" }), false);
});

test("tasteSignalEntries preserves master ranks and pack query uses the visible value", () => {
  const ranking = [
    { title: "A", year: 1989, genres: ["Comedy"] },
    { title: "B", year: 1992, genres: ["Drama"] },
    { title: "C", year: 1998, genres: ["Drama"] },
  ];
  const signal = { type: "decade", value: "1990s" };

  assert.deepEqual(
    tasteSignalEntries(ranking, signal).map(({ movie, index }) => [movie.title, index]),
    [
      ["B", 1],
      ["C", 2],
    ],
  );
  assert.equal(tasteSignalPackQuery(signal), "1990s");
});

test("tasteMatchingPacks uses pack themes, not incidental movie membership", () => {
  const packs = [
    {
      title: "1990s Essentials",
      subtitle: "A decade-defining set",
      category: "Year",
      movies: [{ title: "Example", year: 1995 }],
    },
    {
      title: "Crime Around the World",
      subtitle: "International crime stories",
      category: "Genre",
      movies: [{ title: "Another 1990s Movie", year: 1998 }],
    },
  ];

  assert.deepEqual(
    tasteMatchingPacks(packs, { type: "decade", value: "1990s" }).map((pack) => pack.title),
    ["1990s Essentials"],
  );
  assert.deepEqual(
    tasteMatchingPacks(packs, { type: "genre", value: "crime" }).map((pack) => pack.title),
    ["Crime Around the World"],
  );
});
