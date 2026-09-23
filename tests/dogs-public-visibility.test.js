import test from "node:test";
import assert from "node:assert/strict";
import {
  completedDogCatalogIds,
  insertPublicDogRanking,
  projectPublicDogRanking,
  reorderPublicDogRanking,
} from "../lib/dogs-public-visibility.js";

const A = "VBO:0000001";
const B = "VBO:0000002";
const C = "VBO:0000003";
const D = "VBO:0000004";
const H = "VBO:0000009";
const variant = (role) => ({
  role,
  mime: "image/webp",
  width: role === "card" ? 320 : 960,
  height: role === "card" ? 213 : 640,
  url: `assets/dogs/generated/${role}.webp`,
});
const asset = (catalogId) => ({
  catalogId,
  sourceType: "ai-generated",
  review: { status: "approved" },
  uiDisplayAllowed: true,
  publicSnapshotAllowed: false,
  rasterExportAllowed: false,
  variants: [variant("card"), variant("detail")],
});
const documents = () => ({
  entities: [{ id: A, selectable: true }, { id: B, selectable: true }],
  profiles: { profiles: {
    [A]: { reviewStatus: "editor-reviewed", summary: "A substantive field note." },
    [B]: { reviewStatus: "editor-reviewed", summary: "Another substantive field note." },
  } },
  artwork: { assets: [asset(A), asset(B)] },
});
const item = (id) => Object.freeze({ entityRef: Object.freeze({ id }), snapshot: Object.freeze({ primaryText: id }) });

test("completed Dogs IDs require exact selectable catalog, reviewed copy and approved UI-only generated card/detail art", () => {
  const source = documents();
  assert.deepEqual([...completedDogCatalogIds(source)], [A, B]);
  assert.deepEqual([...completedDogCatalogIds({ ...source, artwork: null })], []);
  assert.deepEqual([...completedDogCatalogIds({ ...source, profiles: null })], []);

  const cases = [
    (x) => { x.entities[0].selectable = false; },
    (x) => { x.profiles.profiles[A].reviewStatus = "generated"; },
    (x) => { x.profiles.profiles[A].summary = "   "; },
    (x) => { x.profiles.profiles[A].catalogId = B; },
    (x) => { x.artwork.assets[0].catalogId = H; },
    (x) => { x.artwork.assets[0].sourceType = "photo"; },
    (x) => { x.artwork.assets[0].review.status = "pending"; },
    (x) => { x.artwork.assets[0].uiDisplayAllowed = false; },
    (x) => { x.artwork.assets[0].publicSnapshotAllowed = true; },
    (x) => { x.artwork.assets[0].rasterExportAllowed = true; },
    (x) => { x.artwork.assets[0].variants.pop(); },
    (x) => { x.artwork.assets[0].variants[0].mime = "image/jpeg"; },
    (x) => { x.artwork.assets[0].variants[0].url = "https://example.com/card.webp"; },
    (x) => { x.artwork.assets.push(asset(A)); },
  ];
  for (const spoil of cases) {
    const input = documents();
    spoil(input);
    assert.deepEqual([...completedDogCatalogIds(input)], [B]);
  }
  assert.deepEqual([...completedDogCatalogIds({
    ...source,
    entities: [...source.entities, { id: H, selectable: true }],
  })], [A, B], "unknown unreviewed identity never becomes public");
});

test("public ranking projection carries original indices and leaves inputs untouched", () => {
  const entries = Object.freeze([item(H), item(A), item(B), item(H), item(C)]);
  const ids = new Set([A, B, C]);
  assert.deepEqual(projectPublicDogRanking(entries, ids), [
    { item: entries[1], index: 1, publicIndex: 0 },
    { item: entries[2], index: 2, publicIndex: 1 },
    { item: entries[4], index: 4, publicIndex: 2 },
  ]);
  assert.deepEqual(projectPublicDogRanking(entries, new Set([D])), []);
  assert.equal(entries.length, 5);
});

test("public insertion before a visible successor or after last visible preserves hidden entries", () => {
  const h1 = item(H);
  const h2 = item(H);
  const a = item(A);
  const c = item(C);
  const b = item(B);
  const entries = Object.freeze([h1, a, h2, c, h1]);
  const ids = new Set([A, B, C]);
  assert.deepEqual(insertPublicDogRanking(entries, ids, b, 0), [h1, b, a, h2, c, h1]);
  assert.deepEqual(insertPublicDogRanking(entries, ids, b, 1), [h1, a, h2, b, c, h1]);
  assert.deepEqual(insertPublicDogRanking(entries, ids, b, 2), [h1, a, h2, c, b, h1]);
  assert.deepEqual(insertPublicDogRanking([h1, h2], ids, b, 0), [h1, h2, b]);
  assert.equal(insertPublicDogRanking(entries, ids, item(D), 0), null);
  assert.equal(insertPublicDogRanking(entries, ids, a, 0), null);
  assert.equal(insertPublicDogRanking(entries, ids, b, 3), null);
  assert.deepEqual(entries, [h1, a, h2, c, h1]);
});

test("public reorder replaces only visible slots, validates exact identity set and preserves original objects", () => {
  const h1 = item(H);
  const h2 = item(H);
  const a = item(A);
  const b = item(B);
  const c = item(C);
  const entries = Object.freeze([h1, a, h2, b, c, h1]);
  const ids = new Set([A, B, C]);
  const reordered = reorderPublicDogRanking(entries, ids, [c, a, b]);
  assert.deepEqual(reordered, [h1, c, h2, a, b, h1]);
  assert.equal(reordered[0], h1);
  assert.equal(reordered[2], h2);
  assert.equal(reordered[3], a);
  assert.deepEqual(entries, [h1, a, h2, b, c, h1]);
  assert.equal(reorderPublicDogRanking(entries, ids, [c, a]), null);
  assert.equal(reorderPublicDogRanking(entries, ids, [c, a, a]), null);
  assert.equal(reorderPublicDogRanking(entries, ids, [c, a, item(D)]), null);
  assert.deepEqual(reorderPublicDogRanking([h1, h2], ids, []), [h1, h2]);
});
