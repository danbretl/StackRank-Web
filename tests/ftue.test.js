import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STARTER_PACK_SLUGS,
  getFirstRunExperience,
  selectStarterPacks,
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
    body: "Each choice narrows the list until every movie has an exact rank.",
    showImport: true,
  });
  assert.deepEqual(getFirstRunExperience(1), {
    state: "one",
    visible: true,
    eyebrow: "First movie ranked",
    title: "Add one more to start comparing.",
    body: "Choose any movie above or pick one from a pack below.",
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
