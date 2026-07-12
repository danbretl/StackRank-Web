import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRankingViewMode,
  rankingViewLabel,
  filterFullscreenRanking,
  gridDropIndex,
  gridNavigationTarget,
  moveRankingItem,
} from "../lib/fullscreen-ranking.js";

test("ranking view modes normalize to the three approved presentation presets", () => {
  assert.equal(normalizeRankingViewMode("detailed"), "detailed");
  assert.equal(normalizeRankingViewMode("posters"), "posters");
  assert.equal(normalizeRankingViewMode("compact"), "compact");
  assert.equal(normalizeRankingViewMode("fullscreen"), "detailed");
  assert.equal(rankingViewLabel("detailed"), "Detailed");
  assert.equal(rankingViewLabel("posters"), "Posters");
  assert.equal(rankingViewLabel("compact"), "Compact");
});

test("fullscreen filtering retains original ranking indexes", () => {
  const ranking = [
    { title: "Alien", year: 1979 },
    { title: "Aliens", year: 1986 },
    { title: "Arrival", year: 2016 },
  ];
  assert.deepEqual(
    filterFullscreenRanking(ranking, "1986"),
    [{ movie: ranking[1], index: 1 }],
  );
  assert.deepEqual(
    filterFullscreenRanking(ranking, "ali"),
    [
      { movie: ranking[0], index: 0 },
      { movie: ranking[1], index: 1 },
    ],
  );
});

test("grid keyboard navigation follows rows and clamps at the ends", () => {
  const base = { columnCount: 4, itemCount: 10 };
  assert.equal(gridNavigationTarget({ ...base, currentIndex: 5, key: "ArrowUp" }), 1);
  assert.equal(gridNavigationTarget({ ...base, currentIndex: 5, key: "ArrowDown" }), 9);
  assert.equal(gridNavigationTarget({ ...base, currentIndex: 9, key: "ArrowDown" }), 9);
  assert.equal(gridNavigationTarget({ ...base, currentIndex: 0, key: "ArrowLeft" }), 0);
  assert.equal(gridNavigationTarget({ ...base, currentIndex: 5, key: "Home" }), 0);
  assert.equal(gridNavigationTarget({ ...base, currentIndex: 5, key: "End" }), 9);
});

test("moving a ranked movie uses the requested final index without mutation", () => {
  const ranking = ["A", "B", "C", "D"];
  assert.deepEqual(moveRankingItem(ranking, 1, 3), ["A", "C", "D", "B"]);
  assert.deepEqual(moveRankingItem(ranking, 3, 0), ["D", "A", "B", "C"]);
  assert.deepEqual(ranking, ["A", "B", "C", "D"]);
});

test("grid drop index chooses the nearest card edge in two dimensions", () => {
  const rects = [
    { left: 0, top: 0, width: 100, height: 150 },
    { left: 120, top: 0, width: 100, height: 150 },
    { left: 0, top: 180, width: 100, height: 150 },
  ];
  assert.equal(gridDropIndex(rects, 10, 50), 0);
  assert.equal(gridDropIndex(rects, 210, 50), 2);
  assert.equal(gridDropIndex(rects, 90, 300), 3);
});
