import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePackStats,
  packStatusRank,
  packStatusText,
  packActionText,
  sharePackCardStatus,
  summarizePacks,
  featuredPacks,
} from "../lib/packs.js";

const pack = (slug, movieIds, extra = {}) => ({
  slug,
  title: extra.title || slug,
  category: extra.category || "Director",
  version: extra.version ?? 1,
  sort_order: extra.sort_order ?? 0,
  movies: movieIds.map((id) => ({ tmdbId: id, title: `Movie ${id}` })),
});

// Build a handled-state function from explicit id buckets.
const handledFrom = ({ ranked = [], watch = [], hidden = [] }) => (movie) => {
  if (ranked.includes(movie.tmdbId)) return { type: "ranked", handled: true };
  if (watch.includes(movie.tmdbId)) return { type: "watch", handled: true };
  if (hidden.includes(movie.tmdbId)) return { type: "hidden", handled: true };
  return { type: "unhandled", handled: false };
};

test("computePackStats: progress fraction and handled/remaining split", () => {
  const p = pack("a", [1, 2, 3, 4]);
  const stats = computePackStats(p, handledFrom({ ranked: [1, 2], hidden: [3] }), {});
  assert.equal(stats.total, 4);
  assert.equal(stats.handled, 3);
  assert.equal(stats.remainingMovies.length, 1);
  assert.equal(stats.remainingMovies[0].movie.tmdbId, 4);
  assert.equal(stats.progress, 0.75);
});

test("computePackStats status: completed when every movie handled", () => {
  const p = pack("a", [1, 2]);
  const stats = computePackStats(p, handledFrom({ ranked: [1, 2] }), { startedAt: "2026-06-01" });
  assert.equal(stats.completed, true);
  assert.equal(stats.started, false, "completed takes precedence over started");
  assert.equal(packStatusRank(stats), 4);
});

test("computePackStats status: started when engaged and incomplete", () => {
  const p = pack("a", [1, 2, 3]);
  const stats = computePackStats(p, handledFrom({ ranked: [1] }), { startedAt: "2026-06-01" });
  assert.equal(stats.started, true);
  assert.equal(stats.discovered, false);
  assert.equal(packStatusRank(stats), 1);
});

test("computePackStats status: discovered when handled organically (no startedAt)", () => {
  const p = pack("a", [1, 2, 3]);
  const stats = computePackStats(p, handledFrom({ ranked: [1] }), {});
  assert.equal(stats.discovered, true);
  assert.equal(stats.started, false);
  assert.equal(packStatusRank(stats), 2);
});

test("computePackStats status: a dismissed discovery is not discovered", () => {
  const p = pack("a", [1, 2, 3]);
  const stats = computePackStats(p, handledFrom({ ranked: [1] }), { discoveryDismissedAt: "2026-06-02" });
  assert.equal(stats.discovered, false);
});

test("computePackStats status: resurfaced when version outruns the seen version", () => {
  const p = pack("a", [1, 2, 3], { version: 2 });
  // Previously completed at version 1; pack is now version 2 with an unhandled
  // movie → it resurfaces.
  const stats = computePackStats(p, handledFrom({ ranked: [1, 2] }), {
    completedAt: "2026-05-01",
    packVersionSeen: 1,
  });
  assert.equal(stats.resurfaced, true);
  assert.equal(stats.completed, false);
  assert.equal(packStatusRank(stats), 0);
});

test("not_started pack: nothing handled, no progress entry", () => {
  const stats = computePackStats(pack("a", [1, 2]), handledFrom({}), {});
  assert.equal(stats.handled, 0);
  assert.equal(stats.started, false);
  assert.equal(stats.discovered, false);
  assert.equal(stats.completed, false);
  assert.equal(packStatusRank(stats), 3);
});

test("status / action / card text per state", () => {
  const completed = computePackStats(pack("a", [1]), handledFrom({ ranked: [1] }), {});
  assert.equal(packStatusText(completed), "Complete");
  assert.equal(packActionText(completed), "View pack");
  assert.equal(sharePackCardStatus(completed), "Complete");

  const started = computePackStats(pack("b", [1, 2, 3]), handledFrom({ ranked: [1] }), { startedAt: "x" });
  assert.equal(packStatusText(started), "1 handled, 2 to go");
  assert.equal(packActionText(started), "Keep going");
  assert.equal(sharePackCardStatus(started), "1 / 3 ranked");

  const fresh = computePackStats(pack("c", [1, 2]), handledFrom({}), {});
  assert.equal(packStatusText(fresh), "2 movies to rank");
  assert.equal(packActionText(fresh), "Start");

  const resurfaced = computePackStats(pack("d", [1, 2, 3], { version: 2 }), handledFrom({ ranked: [1, 2] }), {
    completedAt: "x",
    packVersionSeen: 1,
  });
  assert.equal(packStatusText(resurfaced), "1 new to rank");
  assert.equal(packActionText(resurfaced), "Keep going");
  assert.equal(sharePackCardStatus(resurfaced), "1 new to rank");
});

test("summarizePacks: counts, distinct ids, top category, engaged", () => {
  const entries = [
    { pack: pack("p1", [1, 2], { category: "Director" }), stats: null },
    { pack: pack("p2", [3, 4, 5], { category: "Director" }), stats: null },
    { pack: pack("p3", [1, 6], { category: "Year" }), stats: null }, // shares movie 1 with p1
  ].map(({ pack: p }) => {
    let h;
    if (p.slug === "p1") h = handledFrom({ ranked: [1, 2] }); // completed (Director)
    else if (p.slug === "p2") h = handledFrom({ ranked: [3], watch: [4] }); // started (Director)
    else h = handledFrom({ ranked: [1] }); // discovered (Year)
    const progress = p.slug === "p2" ? { startedAt: "x" } : {};
    return { pack: p, stats: computePackStats(p, h, progress) };
  });
  const s = summarizePacks(entries);
  assert.equal(s.totalPacks, 3);
  assert.equal(s.completed, 1, "p1 completed");
  assert.equal(s.inProgress, 1, "p2 started");
  // Distinct ranked ids: 1 (p1+p3), 2 (p1), 3 (p2) → 3. (4 is watch, not ranked.)
  assert.equal(s.rankedCount, 3);
  // Distinct handled ids: 1,2,3,4 → 4.
  assert.equal(s.handledCount, 4);
  // Director handled: p1(2) + p2(2) = 4 vs Year handled: p3(1) = 1 → Director.
  assert.equal(s.topCategory, "Director");
  assert.equal(s.engaged, true);
});

test("summarizePacks: empty engagement returns engaged=false", () => {
  const entries = [{ pack: pack("p1", [1, 2]), stats: computePackStats(pack("p1", [1, 2]), handledFrom({}), {}) }];
  const s = summarizePacks(entries);
  assert.equal(s.completed, 0);
  assert.equal(s.inProgress, 0);
  assert.equal(s.handledCount, 0);
  assert.equal(s.engaged, false);
});

test("featuredPacks: in-progress before completed; untouched excluded; limit honored", () => {
  const mk = (slug, h, progress, opts) => {
    const p = pack(slug, [1, 2, 3, 4], opts);
    return { pack: p, stats: computePackStats(p, h, progress) };
  };
  const entries = [
    mk("done-old", handledFrom({ ranked: [1, 2, 3, 4] }), { completedAt: "2026-01-01" }),
    mk("done-new", handledFrom({ ranked: [1, 2, 3, 4] }), { completedAt: "2026-06-01" }),
    mk("in-progress-low", handledFrom({ ranked: [1] }), { startedAt: "x" }),
    mk("in-progress-high", handledFrom({ ranked: [1, 2, 3] }), { startedAt: "x" }),
    mk("untouched", handledFrom({}), {}),
  ];
  const featured = featuredPacks(entries, 4);
  const slugs = featured.map((f) => f.pack.slug);
  assert.ok(!slugs.includes("untouched"), "untouched pack excluded");
  // In-progress first (higher progress first), then completed (most recent first).
  assert.deepEqual(slugs, ["in-progress-high", "in-progress-low", "done-new", "done-old"]);
  assert.equal(featuredPacks(entries, 2).length, 2, "limit honored");
});
