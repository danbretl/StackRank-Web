import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_NUDGE_COOLDOWN_MS,
  STARTER_PACK_SLUGS,
  getFirstRunExperience,
  nextBackupNudgeState,
  parseBackupNudgeState,
  selectStarterPacks,
  shouldShowBackupNudge,
} from "../lib/ftue.js";

const pack = (slug, sortOrder = 0, overrides = {}) => ({
  slug,
  title: slug,
  active: true,
  sort_order: sortOrder,
  movies: [{ title: `${slug} movie` }],
  ...overrides,
});

test("first-run experience progressively reveals only the next useful instruction", () => {
  assert.deepEqual(getFirstRunExperience(0), {
    state: "empty",
    visible: true,
    eyebrow: "How StackRank works",
    title: "Add two movies. Pick the one you prefer.",
    body: "Search above, start a pack below, or import an ordered list.",
    showImport: true,
  });
  assert.deepEqual(getFirstRunExperience(1), {
    state: "one",
    visible: true,
    eyebrow: "First movie ranked",
    title: "Add one more to start comparing.",
    body: "Search above or pick one from a pack below.",
    showImport: false,
  });
  assert.equal(getFirstRunExperience(2).visible, false);
  assert.equal(getFirstRunExperience(100).state, "established");
});

test("starter packs use the curated order without mutating the full library", () => {
  const library = [
    pack("fallback-b", 20),
    pack(STARTER_PACK_SLUGS[2], 30),
    pack(STARTER_PACK_SLUGS[0], 10),
    pack(STARTER_PACK_SLUGS[1], 20),
    pack("fallback-a", 5),
  ];
  const originalOrder = library.map(({ slug }) => slug);

  assert.deepEqual(
    selectStarterPacks(library).map(({ slug }) => slug),
    STARTER_PACK_SLUGS,
  );
  assert.deepEqual(library.map(({ slug }) => slug), originalOrder);
});

test("starter packs fall back deterministically when curated entries are unavailable", () => {
  const library = [
    pack("later", 20),
    pack("inactive", 1, { active: false }),
    pack("empty", 2, { movies: [] }),
    pack("first", 5),
    pack("middle", 10),
  ];

  assert.deepEqual(
    selectStarterPacks(library).map(({ slug }) => slug),
    ["first", "middle", "later"],
  );
  assert.deepEqual(selectStarterPacks(library, { limit: 0 }), []);
  assert.deepEqual(selectStarterPacks(null), []);
});

test("backup nudge appears for signed-out users at new 25-movie thresholds", () => {
  assert.equal(shouldShowBackupNudge({ rankingLength: 24 }).show, false);

  const first = shouldShowBackupNudge({ rankingLength: 25, now: 1000 });
  assert.deepEqual(first, {
    show: true,
    reason: "ranking_count",
    rankingCount: 25,
  });

  const state = nextBackupNudgeState({ decision: first, now: 1000 });
  assert.equal(shouldShowBackupNudge({ rankingLength: 25, state, now: 1000 }).show, false);
  assert.equal(
    shouldShowBackupNudge({
      rankingLength: 50,
      state,
      now: 1000 + BACKUP_NUDGE_COOLDOWN_MS - 1,
    }).show,
    false,
  );
  assert.deepEqual(
    shouldShowBackupNudge({
      rankingLength: 50,
      state,
      now: 1000 + BACKUP_NUDGE_COOLDOWN_MS,
    }),
    {
      show: true,
      reason: "ranking_count",
      rankingCount: 50,
    },
  );
});

test("backup nudge is suppressed for signed-in users", () => {
  assert.equal(
    shouldShowBackupNudge({
      rankingLength: 100,
      signedIn: true,
      localPersistenceUnavailable: true,
    }).show,
    false,
  );
});

test("backup nudge can surface a signed-out browser-storage failure after cooldown", () => {
  const state = { lastShownAt: 1000, lastRankingCount: 25 };
  assert.equal(
    shouldShowBackupNudge({
      rankingLength: 26,
      localPersistenceUnavailable: true,
      state,
      now: 1000 + BACKUP_NUDGE_COOLDOWN_MS - 1,
    }).show,
    false,
  );
  assert.deepEqual(
    shouldShowBackupNudge({
      rankingLength: 26,
      localPersistenceUnavailable: true,
      state,
      now: 1000 + BACKUP_NUDGE_COOLDOWN_MS,
    }),
    {
      show: true,
      reason: "storage_unavailable",
      rankingCount: 26,
    },
  );
});

test("backup nudge state parsing is defensive and monotonic", () => {
  assert.deepEqual(parseBackupNudgeState("{"), { lastShownAt: 0, lastRankingCount: 0 });
  assert.deepEqual(parseBackupNudgeState(JSON.stringify({ lastShownAt: "7", lastRankingCount: 25.9 })), {
    lastShownAt: 7,
    lastRankingCount: 25,
  });
  assert.deepEqual(
    nextBackupNudgeState({
      state: { lastShownAt: 100, lastRankingCount: 50 },
      decision: { rankingCount: 25 },
      now: 200,
    }),
    { lastShownAt: 200, lastRankingCount: 50 },
  );
});
