import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preferenceWeight,
  countValues,
  countPreferenceValues,
  countPreferenceMany,
  countReversePreferenceMany,
  median,
  computeRankingInsights,
} from "../lib/insights.js";

test("preferenceWeight: #1 is worth ~1, last is worth 1/total, empty is 0", () => {
  assert.equal(preferenceWeight(0, 4), 1);
  assert.equal(preferenceWeight(3, 4), 0.25);
  assert.equal(preferenceWeight(0, 0), 0);
  assert.ok(preferenceWeight(0, 10) > preferenceWeight(9, 10), "monotonically decreasing down the list");
});

test("countValues counts frequency and sorts by count then name", () => {
  assert.deepEqual(countValues(["a", "b", "a", null, "c", "b", "a"]), [
    { name: "a", count: 3 },
    { name: "b", count: 2 },
    { name: "c", count: 1 },
  ]);
});

test("countPreferenceValues sums score and ranks by score", () => {
  const out = countPreferenceValues([
    { name: "x", weight: 0.2 },
    { name: "y", weight: 1.0 },
    { name: "x", weight: 0.2 },
  ]);
  assert.equal(out[0].name, "y");
  assert.equal(out[1].name, "x");
  assert.equal(out[1].count, 2);
  assert.ok(Math.abs(out[1].score - 0.4) < 1e-9);
});

test("median handles odd, even, and empty", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3); // round((2+3)/2) = 3 (rounds half up)
  assert.equal(median([]), null);
});

// A compact, fully-known ranking used by the golden assertions below.
// Order is the ranking order (index 0 = #1 / most preferred).
const fixture = [
  { title: "Top", year: 1999, genres: ["Elite", "Drama"], director: "Auteur", cast: ["Star A", "Star B"], rankedAt: "2026-06-01T00:00:00Z" },
  { title: "Second", year: 1994, genres: ["Drama"], director: "Auteur", cast: ["Star A"], rankedAt: "2026-06-02T00:00:00Z" },
  { title: "Third", year: 2007, genres: ["Common"], director: "Other", cast: ["Star C"], rankedAt: "2026-06-02T00:00:00Z" },
  { title: "Bottom", year: 1985, genres: ["Common", "Bottom"], director: "Other", cast: ["Star C"], rankedAt: "2026-06-03T00:00:00Z" },
];

test("computeRankingInsights: era math (decades, average, median, span, oldest/newest)", () => {
  const i = computeRankingInsights(fixture, { watchCount: 2, hiddenCount: 1, rankingUpdatedAt: "2026-06-03T00:00:00Z" });
  assert.equal(i.count, 4);
  assert.equal(i.yearsKnown, 4);
  assert.equal(i.averageYear, 1996); // round((1999+1994+2007+1985)/4)
  assert.equal(i.medianYear, 1997); // round((1994+1999)/2)
  assert.equal(i.topDecade.decade, 1990); // two top-ranked 90s movies dominate
  assert.equal(i.oldest.year, 1985);
  assert.equal(i.newest.year, 2007);
  assert.equal(i.yearSpan, 22);
  assert.equal(i.watchCount, 2);
  assert.equal(i.hiddenCount, 1);
  assert.equal(i.rankingUpdatedAt, "2026-06-03T00:00:00Z");
});

test("computeRankingInsights: rank beats frequency in genre scoring", () => {
  // Scores: Drama 1.0+0.75 = 1.75 (top two), Elite 1.0 (#1 only),
  // Common 0.5+0.25 = 0.75 (bottom two), Bottom 0.25 (#4).
  const i = computeRankingInsights(fixture, {});
  assert.equal(i.genres[0].name, "Drama", "genre on the top two movies leads");
  const elite = i.genres.find((g) => g.name === "Elite");
  const common = i.genres.find((g) => g.name === "Common");
  assert.equal(elite.count, 1);
  assert.equal(common.count, 2);
  // The key invariant: a single top-ranked appearance outscores two bottom ones.
  assert.ok(elite.score > common.score, "rank-weighting lets one #1 appearance beat two low ones");
});

test("computeRankingInsights: bottomGenres reverse-weights toward the foot of the list", () => {
  const i = computeRankingInsights(fixture, {});
  // Reverse weights (last → 1.0): Common 0.75+1.0 = 1.75, Bottom 1.0,
  // Drama 0.25+0.5 = 0.75, Elite 0.25. Common leads, Bottom second.
  assert.equal(i.bottomGenres[0].name, "Common");
  assert.equal(i.bottomGenres[1].name, "Bottom");
});

test("computeRankingInsights: directors/cast are rank-weighted", () => {
  const i = computeRankingInsights(fixture, {});
  // "Auteur" directs the top two; "Other" the bottom two. Auteur should lead.
  assert.equal(i.directors[0].name, "Auteur");
  assert.equal(i.directors[0].count, 2);
  // Star A appears on #1 and #2 (high weight) → leads the cast.
  assert.equal(i.cast[0].name, "Star A");
});

test("computeRankingInsights: detailCount counts enriched movies; busiest day", () => {
  const i = computeRankingInsights(fixture, {});
  assert.equal(i.detailCount, 4, "all fixture movies have genres/director/cast");
  // Two movies were rankedAt 2026-06-02 → that's the busiest day with count 2.
  assert.equal(i.busiestDay.name, "2026-06-02");
  assert.equal(i.busiestDay.count, 2);
  assert.equal(i.firstRankedAt, "2026-06-01T00:00:00Z");
  assert.equal(i.lastRankedAt, "2026-06-03T00:00:00Z");
});

test("computeRankingInsights: empty ranking yields safe zeros/nulls", () => {
  const i = computeRankingInsights([], {});
  assert.equal(i.count, 0);
  assert.equal(i.averageYear, null);
  assert.equal(i.medianYear, null);
  assert.equal(i.topMovie, null);
  assert.equal(i.topDecade, null);
  assert.equal(i.oldest, null);
  assert.equal(i.newest, null);
  assert.equal(i.yearSpan, null);
  assert.equal(i.busiestDay, null);
  assert.deepEqual(i.genres, []);
  assert.equal(i.detailCount, 0);
  assert.equal(i.perMovieRankDatesTracked, false);
});

test("computeRankingInsights: movies without year are excluded from era math only", () => {
  const i = computeRankingInsights(
    [
      { title: "No Year", genres: ["X"] },
      { title: "Has Year", year: 2000, genres: ["X"] },
    ],
    {},
  );
  assert.equal(i.count, 2);
  assert.equal(i.yearsKnown, 1);
  assert.equal(i.averageYear, 2000);
  assert.equal(i.genres[0].name, "X");
  assert.equal(i.genres[0].count, 2, "both movies still count toward genres");
});
