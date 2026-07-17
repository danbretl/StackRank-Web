import assert from "node:assert/strict";
import test from "node:test";

import {
  DOGS_CATEGORY,
  dogArtworkObjectUrl,
  dogDragAutoScrollDelta,
  dogEntityToCandidate,
  normalizeDogCatalogEntity,
} from "../lib/categories/dogs.js";
import {
  buildDogTasteSignals,
  buildDogsBackup,
  dogsExportText,
  normalizeDogPackProgress,
  normalizeDogPreferences,
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
    registryRefs: ["FCI:255", { scheme: "iDog", group: "4" }],
  }));
  assert.equal(normalized.displayName, "Akita");
  assert.deepEqual(normalized.aliases, ["Akita Inu"]);
  assert.deepEqual(normalized.tags, ["spitz"]);
  assert.deepEqual(normalized.registryRefs, [
    { scheme: "FCI", group: "255" },
    { scheme: "iDog", group: "4" },
  ]);
  assert.equal(normalizeDogCatalogEntity(entity("not-vbo", "Akita")), null);
});

test("Dogs artwork object paths resolve only through an explicit safe public base", () => {
  const objectPath = "dogs-catalog/vbo-2026-04-15-r1/example-320.webp";
  assert.equal(
    dogArtworkObjectUrl(objectPath, {
      publicBaseUrl: "https://hrfhakrxsllrqmscxxpb.supabase.co/storage/v1/object/public/",
      storagePrefix: "dogs-catalog/vbo-2026-04-15-r1/",
    }),
    "https://hrfhakrxsllrqmscxxpb.supabase.co/storage/v1/object/public/dogs-catalog/vbo-2026-04-15-r1/example-320.webp",
  );
  assert.equal(dogArtworkObjectUrl(objectPath), "");
  assert.equal(dogArtworkObjectUrl("https://unapproved.example/dog.webp", {
    publicBaseUrl: "https://hrfhakrxsllrqmscxxpb.supabase.co/storage/v1/object/public/",
    storagePrefix: "dogs-catalog/vbo-2026-04-15-r1/",
  }), "");
  assert.equal(dogArtworkObjectUrl("/assets/dog.webp", {
    publicBaseUrl: "https://hrfhakrxsllrqmscxxpb.supabase.co/storage/v1/object/public/",
    storagePrefix: "dogs-catalog/vbo-2026-04-15-r1/",
  }), "");
  assert.equal(dogArtworkObjectUrl("../secret.webp", {
    publicBaseUrl: "https://example.com/public/",
    storagePrefix: "dogs-catalog/",
  }), "");
  assert.equal(dogArtworkObjectUrl("other/example.webp", {
    publicBaseUrl: "https://example.com/public/",
    storagePrefix: "dogs-catalog/",
  }), "");
  assert.equal(dogArtworkObjectUrl(objectPath, {
    publicBaseUrl: "https://example.com/not-storage/",
    storagePrefix: "dogs-catalog/vbo-2026-04-15-r1/",
  }), "");
  assert.equal(
    dogArtworkObjectUrl("dogs-catalog/e2e/example.webp", {
      publicBaseUrl: "http://127.0.0.1:8000/",
      storagePrefix: "dogs-catalog/e2e/",
    }),
    "http://127.0.0.1:8000/dogs-catalog/e2e/example.webp",
  );
});

test("Dogs drag auto-scroll activates only near viewport edges", () => {
  assert.equal(dogDragAutoScrollDelta(36, 800), -11);
  assert.equal(dogDragAutoScrollDelta(400, 800), 0);
  assert.equal(dogDragAutoScrollDelta(764, 800), 11);
  assert.equal(dogDragAutoScrollDelta(900, 800), 22);
  assert.equal(dogDragAutoScrollDelta("bad", 800), 0);
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

test("Dogs backup rejects normalization loss in secondary lists and unsafe settings", () => {
  const valid = buildDogsBackup({
    ranking: [ranked("VBO:0000661", "Akita")],
    lists: { curious: [ranked("VBO:0001150", "Saluki")], not_for_me: [] },
    packProgress: { gateway: { startedAt: "2026-07-16T00:00:00.000Z", versionSeen: 1 } },
    preferences: {
      rankingView: "photos",
      statusFilter: "canonical",
      regionFilter: "Japan",
      imageOnly: true,
    },
  });
  assert.ok(parseDogsBackup(valid));

  const crossDomain = structuredClone(valid);
  crossDomain.lists.curious[0].entityRef.domain = "movies";
  assert.equal(parseDogsBackup(crossDomain), null);

  const duplicate = structuredClone(valid);
  duplicate.lists.not_for_me.push(duplicate.lists.curious[0]);
  assert.equal(parseDogsBackup(duplicate), null);

  assert.equal(parseDogsBackup({ ...valid, preferences: { ...valid.preferences, unsafe: true } }), null);
  assert.equal(parseDogsBackup({
    ...valid,
    packProgress: { gateway: { ...valid.packProgress.gateway, lastIndex: 2 } },
  }), null);
});

test("Dogs backup settings and pack progress have bounded schemas", () => {
  assert.deepEqual(normalizeDogPreferences({}), {
    rankingView: "detailed",
    statusFilter: "",
    regionFilter: "",
    imageOnly: false,
  });
  assert.equal(normalizeDogPreferences({ rankingView: "poster-wall" }), null);
  assert.equal(normalizeDogPreferences({ regionFilter: "x".repeat(81) }), null);
  assert.deepEqual(normalizeDogPackProgress({
    gateway: {
      startedAt: "2026-07-16T00:00:00.000Z",
      completedAt: null,
      versionSeen: 1,
    },
  }), {
    gateway: {
      startedAt: "2026-07-16T00:00:00.000Z",
      versionSeen: 1,
    },
  });
  assert.equal(normalizeDogPackProgress({ "../escape": {} }), null);
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
