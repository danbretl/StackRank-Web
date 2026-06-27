import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRankingInsights } from "../lib/insights.js";
import {
  getSharePickGroups,
  movieExportLine,
  buildNativeImageShareData,
  shareRankingMetaCards,
  buildShareExportSections,
  sectionsToMarkdown,
  sectionsToText,
} from "../lib/share-export.js";

const TONE = {
  topTitle: "The best",
  topSub: "Top ranked",
  bottomTitle: "The worst",
  bottomSub: "Bottom ranked",
  erasTitle: "Movie eras",
  genresTitle: "Genre fingerprint",
  peopleTitle: "Cast + crew pull",
  queuesTitle: "Still deciding",
  packsTitle: "Pack progress",
  listTitle: "The whole stack",
};

const RANKING = [
  { title: "Alpha", year: 1999, genres: ["Drama"], director: "Dir A", cast: ["Star A"], rankedAt: "2026-06-01T00:00:00Z" },
  { title: "Beta", year: 1994, genres: ["Drama"], director: "Dir A", cast: ["Star B"], rankedAt: "2026-06-02T00:00:00Z" },
  { title: "Gamma", year: 2007, genres: ["Comedy"], director: "Dir B", cast: ["Star C"], rankedAt: "2026-06-03T00:00:00Z" },
  { title: "Delta", year: 1985, genres: ["Comedy"], director: "Dir B", cast: ["Star C"], rankedAt: "2026-06-04T00:00:00Z" },
];

const insightsFor = (ranking = RANKING) => computeRankingInsights(ranking, { watchCount: 0, hiddenCount: 0 });

const ALL_ON = {
  top: true, bottom: true, eras: true, genres: true, people: true, queues: true, packs: true, fullList: true,
};

// Default ctx with no queue/pack engagement.
const baseCtx = (over = {}) => ({
  tone: TONE,
  watchList: [],
  notInterestedList: [],
  watchRuntimeDisplay: { value: "--", isDuration: false },
  hiddenRuntimeDisplay: { value: "--", isDuration: false },
  hiddenRuntimeLabel: "Time out of queue",
  packSummary: { engaged: false },
  packFeatured: [],
  ...over,
});

test("getSharePickGroups splits top/bottom without overlap", () => {
  const i = insightsFor();
  const g = getSharePickGroups(i);
  assert.deepEqual(g.best.map((m) => m.title), ["Alpha", "Beta"]);
  assert.deepEqual(g.worst.map((m) => m.title), ["Gamma", "Delta"]);
  assert.equal(g.worstStartRank, 3);
});

test("movieExportLine formats rank + year", () => {
  assert.equal(movieExportLine({ title: "X", year: 2000 }, 1), "1. X (2000)");
  assert.equal(movieExportLine({ title: "X" }), "X");
});

test("buildNativeImageShareData shares only the image files", () => {
  const files = [{ name: "page-1.png" }, { name: "page-2.png" }];
  const shareData = buildNativeImageShareData(files);
  assert.deepEqual(Object.keys(shareData), ["files"]);
  assert.equal(shareData.files, files);
});

test("buildShareExportSections: all-on yields sections in canonical order", () => {
  const sections = buildShareExportSections(insightsFor(), ALL_ON, baseCtx());
  // queues + packs are empty here, so they self-omit.
  assert.deepEqual(sections.map((s) => s.key), ["top", "bottom", "eras", "genres", "people", "fullList"]);
});

test("buildShareExportSections: tone titles are applied", () => {
  const sections = buildShareExportSections(insightsFor(), ALL_ON, baseCtx());
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s.title]));
  assert.equal(byKey.top, "The best");
  assert.equal(byKey.fullList, "The whole stack");
});

test("buildShareExportSections: empty queues are omitted, populated ones included", () => {
  const empty = buildShareExportSections(insightsFor(), ALL_ON, baseCtx());
  assert.ok(!empty.some((s) => s.key === "queues"), "no queues section when nothing saved/hidden");

  const withQueues = buildShareExportSections(
    insightsFor(),
    ALL_ON,
    baseCtx({
      watchList: [{ title: "Saved One" }],
      notInterestedList: [{ title: "Hidden One" }],
      watchRuntimeDisplay: { value: "1h 30m", isDuration: true },
      hiddenRuntimeDisplay: { value: "2h", isDuration: true },
    }),
  );
  const queues = withQueues.find((s) => s.key === "queues");
  assert.ok(queues, "queues section present when populated");
  assert.ok(queues.lines.includes("Saved for later: 1"));
  assert.ok(queues.lines.includes("Time out of queue: 2h"));
});

test("buildShareExportSections: empty genres/people are omitted", () => {
  const bare = insightsFor([
    { title: "NoDetail", year: 2000 }, // no genres/director/cast
  ]);
  const sections = buildShareExportSections(bare, ALL_ON, baseCtx());
  assert.ok(!sections.some((s) => s.key === "genres"), "no genres section without genre data");
  assert.ok(!sections.some((s) => s.key === "people"), "no people section without cast/crew");
  // eras still present (it has a year), and fullList present.
  assert.ok(sections.some((s) => s.key === "eras"));
  assert.ok(sections.some((s) => s.key === "fullList"));
});

test("buildShareExportSections: toggles off omit their section", () => {
  const sections = buildShareExportSections(insightsFor(), { ...ALL_ON, top: false, eras: false }, baseCtx());
  assert.ok(!sections.some((s) => s.key === "top"));
  assert.ok(!sections.some((s) => s.key === "eras"));
  assert.ok(sections.some((s) => s.key === "bottom"));
});

test("buildShareExportSections: packs block appears only when engaged, before fullList", () => {
  const notEngaged = buildShareExportSections(insightsFor(), ALL_ON, baseCtx());
  assert.ok(!notEngaged.some((s) => s.key === "packs"));

  const engaged = buildShareExportSections(
    insightsFor(),
    ALL_ON,
    baseCtx({
      packSummary: { engaged: true, completed: 1, inProgress: 2, rankedCount: 7, topCategory: "Director" },
      packFeatured: [
        { pack: { title: "Wes Anderson" }, stats: { completed: false, resurfaced: false, handled: 4, total: 11 } },
        { pack: { title: "Marvel Phase One" }, stats: { completed: true } },
      ],
    }),
  );
  const keys = engaged.map((s) => s.key);
  assert.ok(keys.includes("packs"));
  assert.ok(keys.indexOf("packs") < keys.indexOf("fullList"), "packs sits before the whole list");
  const packs = engaged.find((s) => s.key === "packs");
  assert.ok(packs.lines.includes("Packs completed: 1"));
  assert.ok(packs.lines.includes("Most explored category: Director"));
  assert.ok(packs.lines.includes("Wes Anderson - 4 / 11 ranked"));
  assert.ok(packs.lines.includes("Marvel Phase One - Complete"));
});

test("shareRankingMetaCards: date provenance vs fallback", () => {
  const tracked = shareRankingMetaCards(insightsFor());
  assert.equal(tracked[0].label, "First movie ranked on");
  assert.notEqual(tracked[0].value, "Not tracked");

  const untracked = shareRankingMetaCards(insightsFor([{ title: "X", year: 2000 }]));
  assert.equal(untracked[0].label, "List last updated");
});

test("sectionsToMarkdown renders H1, generated line, and ## headings with italic subs", () => {
  const sections = [{ key: "top", title: "The best", subtitle: "Top ranked", lines: ["1. Alpha (1999)"] }];
  const md = sectionsToMarkdown("My ranking", "Jun 26, 2026", sections);
  assert.match(md, /^# My ranking\n/);
  assert.match(md, /\nGenerated Jun 26, 2026\n/);
  assert.match(md, /\n## The best\n_Top ranked_\n\n1\. Alpha \(1999\)$/);
});

test("sectionsToText renders title, generated, and plain headings", () => {
  const sections = [{ key: "top", title: "The best", subtitle: "Top ranked", lines: ["1. Alpha (1999)"] }];
  const txt = sectionsToText("My ranking", "Jun 26, 2026", sections);
  const lines = txt.split("\n");
  assert.equal(lines[0], "My ranking");
  assert.equal(lines[1], "Generated Jun 26, 2026");
  assert.ok(lines.includes("The best"));
  assert.ok(lines.includes("Top ranked"));
  assert.ok(!txt.includes("##"), "text export has no markdown headings");
});
