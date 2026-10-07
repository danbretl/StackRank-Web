"use strict";
// Synthetic users and items only. Dog IDs are real public catalog identities
// (checked against the released Dogs catalog); user state is invented.
const USER_A = "aaaaaaaa-1111-4111-8111-111111111111";
const USER_B = "bbbbbbbb-2222-4222-8222-222222222222";

const movie = (title, year, tmdbId, extra = {}) => ({
  title, year, posterPath: `/audit-${tmdbId}.jpg`, tmdbId,
  rankedAt: "2026-09-01T00:00:00.000Z", genres: ["Drama"], director: "Audit Director", cast: ["Audit Actor"], ...extra,
});
const queued = (title, year, tmdbId, list = "watch") => ({
  title, year, posterPath: `/audit-${tmdbId}.jpg`, tmdbId,
  queuedAt: "2026-09-02T00:00:00.000Z",
  ...(list === "watch" ? { savedAt: "2026-09-02T00:00:00.000Z" } : { hiddenAt: "2026-09-02T00:00:00.000Z" }),
});

const MOVIES = {
  m1: movie("Audit One", 1991, 900001),
  m2: movie("Audit Two", 1992, 900002),
  m3: movie("Audit Three", 1993, 900003),
  m4: movie("Audit Four", 1994, 900004),
  m5: movie("Audit Five", 1995, 900005),
  r1: movie("Remote Only", 2001, 900101),
  b1: movie("Bee Private One", 2011, 900201),
  b2: movie("Bee Private Two", 2012, 900202),
  a1: movie("Aye Private One", 2021, 900301),
  a2: movie("Aye Private Two", 2022, 900302),
};

const dog = (id, name, secondary = "") => ({
  entityRef: { domain: "dogs", type: "breed", source: "vbo", id },
  snapshot: { primaryText: name, secondaryText: secondary, year: null, image: { url: "", alt: `${name} dog`, assetId: "" } },
  rankedAt: "2026-09-03T00:00:00.000Z",
  comparisons: 2,
});

module.exports = { USER_A, USER_B, movie, queued, MOVIES, dog };
