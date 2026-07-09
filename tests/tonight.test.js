import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TONIGHT_SLATE_SIZE,
  TONIGHT_TIME_WINDOWS,
  DEFAULT_TONIGHT_WINDOW,
  normalizeTonightWindow,
  runtimeFitScore,
  tonightTasteProfile,
  tasteAffinity,
  tonightJitter,
  buildTonightReasons,
  scoreTonightCandidates,
  pickTonightSlate,
  buildTonightSlate,
  tonightMoodSummary,
} from "../lib/tonight.js";

const NOW = new Date("2026-07-08T20:00:00.000Z").getTime();

const queueMovie = (title, tmdbId, savedAt = "2026-07-01T00:00:00.000Z") => ({
  title,
  year: 2015,
  tmdbId,
  savedAt,
});

const insights = {
  genres: [
    { name: "Crime", count: 5, score: 3.4 },
    { name: "Drama", count: 4, score: 2.1 },
    { name: "Comedy", count: 2, score: 0.8 },
  ],
  directors: [{ name: "Jane Director", count: 2, score: 1.6 }],
  cast: [{ name: "Actor A", count: 3, score: 1.2 }],
};

test("time windows include the documented options and normalize unknown ids", () => {
  assert.deepEqual(
    TONIGHT_TIME_WINDOWS.map((window) => window.id),
    ["any", "short", "standard", "long"],
  );
  assert.equal(normalizeTonightWindow("standard"), "standard");
  assert.equal(normalizeTonightWindow("bogus"), DEFAULT_TONIGHT_WINDOW);
});

test("runtimeFitScore rewards fitting runtimes and decays outside the band", () => {
  assert.equal(runtimeFitScore(85, "short"), 1);
  assert.equal(runtimeFitScore(115, "standard"), 1);
  assert.equal(runtimeFitScore(170, "long"), 1);
  assert.ok(runtimeFitScore(100, "short") < 1 && runtimeFitScore(100, "short") > 0);
  assert.equal(runtimeFitScore(180, "short"), 0);
  assert.ok(runtimeFitScore(null, "standard") > 0, "unknown runtime stays neutral");
  assert.equal(runtimeFitScore(240, "any"), 0.75);
});

test("tonightTasteProfile normalizes rank-weighted scores against the top signal", () => {
  const profile = tonightTasteProfile(insights);
  assert.equal(profile.genres.get("crime"), 1);
  assert.ok(profile.genres.get("drama") < 1 && profile.genres.get("drama") > 0);
  assert.equal(profile.directors.get("jane director"), 1);
});

test("tasteAffinity surfaces the concrete matched signals", () => {
  const profile = tonightTasteProfile(insights);
  const match = tasteAffinity(
    { genres: ["Crime", "Thriller"], director: "Jane Director", cast: ["Actor A"] },
    profile,
  );
  assert.ok(match.score > 0.5);
  assert.equal(match.genre, "Crime");
  assert.equal(match.director, "Jane Director");

  const miss = tasteAffinity({ genres: ["Western"], director: "Unknown", cast: [] }, profile);
  assert.equal(miss.score, 0);
  assert.equal(miss.genre, null);
});

test("tonightJitter is deterministic, small, and varies by seed", () => {
  const a = tonightJitter(1, 42);
  assert.equal(a, tonightJitter(1, 42));
  assert.ok(Math.abs(a) <= 0.02);
  const values = [tonightJitter(1, 42), tonightJitter(2, 42), tonightJitter(3, 42)];
  assert.ok(new Set(values).size > 1, "different seeds should move the jitter");
});

test("scoreTonightCandidates blends mood, taste, and runtime fit", () => {
  const queue = [queueMovie("Crime Fit", 1), queueMovie("Long Western", 2), queueMovie("Cozy Match", 3)];
  const facts = new Map([
    [1, { runtime: 110, genres: ["Crime", "Drama"], director: "Jane Director", cast: [], moodScore: 0.1, moodMatches: null }],
    [2, { runtime: 195, genres: ["Western"], director: "", cast: [], moodScore: 0.05, moodMatches: null }],
    [
      3,
      {
        runtime: 100,
        genres: ["Comedy", "Family"],
        director: "",
        cast: [],
        moodScore: 0.9,
        moodMatches: { senses: ["cozy"], keywords: ["friendship"], era: null },
      },
    ],
  ]);

  const noMood = scoreTonightCandidates({ queue, facts, insights, windowId: "standard", moodApplied: false, now: NOW });
  assert.equal(noMood[0].movie.tmdbId, 1, "taste + runtime should lead without a mood");
  assert.equal(noMood[noMood.length - 1].movie.tmdbId, 2, "an ill-fitting runtime and cold taste should sink");

  const withMood = scoreTonightCandidates({ queue, facts, insights, windowId: "standard", moodApplied: true, now: NOW });
  assert.equal(withMood[0].movie.tmdbId, 3, "a strong mood match should take over when a vibe is applied");
  assert.match(withMood[0].reasons[0], /Matches your vibe — cozy, friendship/);
});

test("reasons cite taste signals and runtime fit without TMDB ratings", () => {
  const entry = {
    facts: { runtime: 112, genres: ["Crime"] },
    taste: { genre: "Crime", director: null, castName: null },
    runtimeScore: 1,
    moodScore: 0,
    moodMatches: null,
    savedMonths: 4,
  };
  const reasons = buildTonightReasons(entry, { windowId: "standard", moodApplied: false });
  assert.deepEqual(reasons, [
    "You rank crime high",
    "Fits your window at 1h 52m",
    "Waiting in Watch next for a while",
  ]);
  assert.ok(reasons.every((reason) => !/rating|score|\d\.\d\/10/i.test(reason)));
});

test("older saves get a freshness boost so stale queue movies resurface", () => {
  const queue = [
    queueMovie("Fresh Save", 1, "2026-07-07T00:00:00.000Z"),
    queueMovie("Old Save", 2, "2025-11-01T00:00:00.000Z"),
  ];
  const facts = new Map([
    [1, { runtime: 100, genres: ["Drama"], director: "", cast: [] }],
    [2, { runtime: 100, genres: ["Drama"], director: "", cast: [] }],
  ]);
  const entries = scoreTonightCandidates({ queue, facts, insights, windowId: "any", moodApplied: false, seed: 0, now: NOW });
  const fresh = entries.find((entry) => entry.movie.tmdbId === 1);
  const old = entries.find((entry) => entry.movie.tmdbId === 2);
  assert.ok(old.score - old.reasons.length * 0 > fresh.score - 0.05, "old save should not trail far");
  assert.ok(old.savedMonths > fresh.savedMonths);
});

test("pickTonightSlate applies the diversity guard and exclusions", () => {
  const entry = (tmdbId, score, genre) => ({
    movie: { tmdbId },
    facts: { genres: [genre] },
    score,
    reasons: [],
  });
  const entries = [
    entry(1, 0.9, "Crime"),
    entry(2, 0.88, "Crime"),
    entry(3, 0.86, "Crime"),
    entry(4, 0.82, "Comedy"),
  ];
  const slate = pickTonightSlate(entries);
  assert.equal(slate.length, TONIGHT_SLATE_SIZE);
  assert.deepEqual(
    slate.map((item) => item.movie.tmdbId),
    [1, 2, 4],
    "third straight Crime pick should yield to a close Comedy",
  );

  const excluded = pickTonightSlate(entries, { excludeIds: new Set([1, 2]) });
  assert.deepEqual(excluded.map((item) => item.movie.tmdbId).slice(0, 2), [3, 4]);
});

test("pickTonightSlate falls back to shown picks when exclusions empty the pool", () => {
  const entries = [
    { movie: { tmdbId: 1 }, facts: { genres: ["Drama"] }, score: 0.8, reasons: [] },
    { movie: { tmdbId: 2 }, facts: { genres: ["Drama"] }, score: 0.7, reasons: [] },
  ];
  const slate = pickTonightSlate(entries, { excludeIds: new Set([1, 2]) });
  assert.equal(slate.length, 2, "excluding everything should reuse the full pool");
});

test("buildTonightSlate returns both the ordered entries and the slate", () => {
  const queue = [queueMovie("A", 1), queueMovie("B", 2)];
  const facts = new Map([
    [1, { runtime: 100, genres: ["Crime"], director: "", cast: [] }],
    [2, { runtime: 100, genres: ["Western"], director: "", cast: [] }],
  ]);
  const { entries, slate } = buildTonightSlate({ queue, facts, insights, windowId: "any", now: NOW });
  assert.equal(entries.length, 2);
  assert.equal(slate.length, 2);
  assert.equal(slate[0].movie.tmdbId, 1);
  assert.ok(slate[0].reasons.length >= 1);
});

test("tonightMoodSummary phrases readable, unreadable, and unavailable vibes", () => {
  assert.equal(tonightMoodSummary(null), "");
  assert.equal(
    tonightMoodSummary({ readable: true, recognized: ["cozy", "feel-good"], era: "1990s" }),
    "Vibe read as cozy · feel-good · 1990s.",
  );
  assert.match(tonightMoodSummary({ readable: false, recognized: [] }), /Couldn’t read that vibe/);
  assert.match(tonightMoodSummary(null, { moodUnavailable: true }), /unavailable right now/);
});
