import assert from "node:assert/strict";
import test from "node:test";

import {
  DOGS_CATEGORY,
  dogEntityToCandidate,
  normalizeDogCatalogEntity,
} from "../lib/categories/dogs.js";
import {
  buildDogTasteSignals,
  buildDogsBackup,
  dogsExportText,
  normalizeDogListState,
  parseDogNameImport,
  parseDogsBackup,
} from "../lib/dogs.js";

const entity = (id, name, overrides = {}) => ({
  id,
  displayName: name,
  entityType: "dog",
  status: "canonical",
  selectable: true,
  aliases: [],
  sourceIds: [id],
  registryRefs: [],
  relationships: { relatedIds: [] },
  ...overrides,
});

const ranked = (id, name) => dogEntityToCandidate(entity(id, name));

test("Dogs descriptor is local-first and fails closed for sharing capabilities", () => {
  assert.equal(DOGS_CATEGORY.path, "/dogs");
  assert.equal(DOGS_CATEGORY.labels.savedList, "Curious about");
  assert.equal(DOGS_CATEGORY.artwork.aspectRatio, 3 / 2, "runtime presentation matches the reviewed artwork crop");
  assert.deepEqual(DOGS_CATEGORY.capabilities, {
    accountSync: false,
    publicSnapshots: false,
    rasterArtworkExport: false,
    liveSuggestions: false,
    textExport: true,
    artworkDisplay: true,
  });
});

test("dog catalog normalization keeps safe taxonomy fields and rejects unsafe identities", () => {
  const normalized = normalizeDogCatalogEntity(entity("VBO:0000661", "Akita", {
    aliases: ["Akita Inu", "Akita Inu"],
    originRegions: ["Japan"],
    tags: ["spitz"],
  }));
  assert.equal(normalized.displayName, "Akita");
  assert.deepEqual(normalized.aliases, ["Akita Inu"]);
  assert.deepEqual(normalized.tags, ["spitz"]);
  assert.equal(normalizeDogCatalogEntity(entity("not-vbo", "Akita")), null);
});

test("dog candidates always store canonical VBO identity", () => {
  const candidate = dogEntityToCandidate(entity("VBO:0000661", "Akita", {
    aliases: ["Akita Inu"],
    originRegions: ["Japan"],
  }));
  assert.deepEqual(candidate.entityRef, {
    domain: "dogs",
    type: "breed",
    source: "vbo",
    id: "VBO:0000661",
  });
  assert.equal(candidate.snapshot.secondaryText, "Japan · Breed or type");
});

test("Dogs list normalization deduplicates canonically across ranking and secondary lists", () => {
  const akita = ranked("VBO:0000661", "Akita");
  const saluki = ranked("VBO:0001150", "Saluki");
  const state = normalizeDogListState({
    ranking: [akita],
    lists: { curious: [akita, saluki], not_for_me: [saluki] },
  });
  assert.deepEqual(state.lists.curious.map((item) => item.snapshot.primaryText), ["Saluki"]);
  assert.deepEqual(state.lists.not_for_me, []);
});

test("Dogs backup round-trips all local product surfaces and rejects other categories", () => {
  const backup = buildDogsBackup({
    ranking: [ranked("VBO:0000661", "Akita")],
    lists: { curious: [ranked("VBO:0001150", "Saluki")], not_for_me: [] },
    packProgress: { gateway: { startedAt: "2026-07-16T00:00:00.000Z" } },
    preferences: { rankingView: "detailed" },
  }, "2026-07-16T00:00:00.000Z");
  assert.deepEqual(parseDogsBackup(JSON.stringify(backup)), backup);
  assert.equal(parseDogsBackup({ ...backup, category: "books" }), null);
  assert.equal(parseDogsBackup("{"), null);
});

test("Dog name import keeps order, strips list markers, and removes duplicates", () => {
  assert.deepEqual(parseDogNameImport("1. Akita\n- Saluki\n[x] akita\n\nXoloitzcuintli"), [
    "Akita",
    "Saluki",
    "Xoloitzcuintli",
  ]);
});

test("Dogs Taste signals are recurring and rank weighted", () => {
  const list = [
    ranked("VBO:0000661", "Akita"),
    ranked("VBO:0001234", "Shiba Inu"),
    ranked("VBO:0001150", "Saluki"),
  ];
  const catalog = new Map([
    ["VBO:0000661", entity("VBO:0000661", "Akita", { originRegions: ["Japan"], tags: ["spitz"] })],
    ["VBO:0001234", entity("VBO:0001234", "Shiba Inu", { originRegions: ["Japan"], tags: ["spitz"] })],
    ["VBO:0001150", entity("VBO:0001150", "Saluki", { originRegions: ["Middle East"], tags: ["sighthound"] })],
  ]);
  const signals = buildDogTasteSignals(list, catalog);
  assert.deepEqual(signals.map((signal) => signal.value), ["Japan", "spitz"]);
  assert.equal(signals[0].items.length, 2);
});

test("Dogs exports are text-first and preserve canonical ids in JSON", () => {
  const list = [ranked("VBO:0000661", "Akita")];
  assert.match(dogsExportText(list, "vbo-2026-04-15.1", "markdown"), /\*\*Akita\*\*/);
  const json = JSON.parse(dogsExportText(list, "vbo-2026-04-15.1", "json"));
  assert.equal(json.ranking[0].id, "VBO:0000661");
});
