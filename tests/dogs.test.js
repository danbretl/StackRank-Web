import assert from "node:assert/strict";
import test from "node:test";

import {
  DOGS_CATEGORY,
  canonicalizeDogStoredState,
  dogArtworkObjectUrl,
  dogDisplayAliases,
  dogPublicSnapshotArtworkUrl,
  dogDragAutoScrollDelta,
  dogEditorialDisplayText,
  dogEntityToCandidate,
  dogRegistryCoverageLabel,
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
import { createRankedEntity } from "../lib/entity.js";

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

test("Dogs descriptor enables additive account sync and public snapshots without raster export", () => {
  assert.equal(DOGS_CATEGORY.path, "/dogs");
  assert.equal(DOGS_CATEGORY.labels.savedList, "Curious about");
  assert.equal(DOGS_CATEGORY.artwork.aspectRatio, 3 / 2, "runtime presentation matches the reviewed artwork crop");
  assert.deepEqual(DOGS_CATEGORY.capabilities, {
    accountSync: true,
    publicSnapshots: true,
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

test("Dogs presents concise alternate names without leaking catalog annotations or codes", () => {
  const greatDane = entity("VBO:0200623", "Great Dane", {
    aliases: [
      "Apollo of Dogs",
      "Deutsche Dogge",
      "Gentle Giant",
      "German Mastiff",
      "Немецкий дог",
      "Great Dane (Mastiff - German) (Deutsche Dogge)",
      "Mastiff - German",
      "FCI:235",
      "https://example.com/raw-record",
    ],
  });
  assert.deepEqual(dogDisplayAliases(greatDane), [
    "Apollo of Dogs",
    "Deutsche Dogge",
    "Gentle Giant",
    "German Mastiff",
  ]);
  assert.deepEqual(dogDisplayAliases(greatDane, { limit: 5 }).at(-1), "Немецкий дог");
  assert.deepEqual(dogDisplayAliases(greatDane, { limit: 0 }), []);
  assert.deepEqual(dogDisplayAliases(entity("VBO:0000661", "Broholmer", {
    aliases: ["Broholmer", "Broholmeren, Denmark", "Danish Broholmer"],
  })), ["Danish Broholmer"]);
});

test("Dogs humanizes registry editorial copy and summarizes provenance without database codes", () => {
  assert.equal(
    dogEditorialDisplayText("FCI Group 1 sampler"),
    "International registry · Group 1 sampler",
  );
  assert.equal(
    dogEditorialDisplayText("Sheepdogs in the FCI scheme"),
    "Sheepdogs in the international registry scheme",
  );
  assert.equal(dogEditorialDisplayText("iDog and VeNom"), "");
  assert.equal(dogEditorialDisplayText("VBO:0200623"), "");
  assert.equal(dogEditorialDisplayText("vbo-2026-04-15.2"), "");
  assert.equal(dogRegistryCoverageLabel(entity("VBO:0200623", "Great Dane", {
    registryRefs: ["FCI:235", "iDog:119", "VeNom:14037"],
  })), "Cross-referenced across 3 source catalog systems");
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

test("public Dogs snapshots accept only immutable project WebP object URLs", () => {
  const safe = "https://hrfhakrxsllrqmscxxpb.supabase.co/storage/v1/object/public/dogs-catalog/vbo-2026-04-15-r1/akita-320.webp";
  assert.equal(dogPublicSnapshotArtworkUrl(safe), safe);
  assert.equal(dogPublicSnapshotArtworkUrl(`${safe}?download=1`), "");
  assert.equal(dogPublicSnapshotArtworkUrl(`${safe}#crop`), "");
  assert.equal(dogPublicSnapshotArtworkUrl(safe.replace("https://", "https://user:pass@")), "");
  assert.equal(dogPublicSnapshotArtworkUrl(safe.replace("akita-320.webp", "../secret.webp")), "");
  assert.equal(dogPublicSnapshotArtworkUrl(safe.replace(".webp", ".jpg")), "");
  assert.equal(dogPublicSnapshotArtworkUrl(safe.replace("hrfhakrxsllrqmscxxpb", "other-project")), "");
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

test("stored preview identities canonicalize through source ids without losing order or timestamps", () => {
  const legacyAkita = createRankedEntity({
    ...ranked("VBO:0000661", "Old Akita preview"),
    entityRef: {
      domain: "dogs",
      type: "breed",
      source: "vbo",
      id: "VBO:0999999",
    },
    rankedAt: "2026-07-16T00:00:00.000Z",
    comparisons: 3,
  });
  const canonicalAkita = ranked("VBO:0000661", "Akita");
  const saluki = ranked("VBO:0001150", "Saluki");
  const result = canonicalizeDogStoredState({
    ranking: [legacyAkita, saluki],
    lists: {
      curious: [canonicalAkita],
      not_for_me: [legacyAkita],
    },
  }, [
    entity("VBO:0000661", "Akita", {
      sourceIds: ["VBO:0000661", "VBO:0999999"],
      originRegions: ["Japan"],
    }),
    entity("VBO:0001150", "Saluki"),
  ]);

  assert.deepEqual(result.ranking.map((item) => item.entityRef.id), [
    "VBO:0000661",
    "VBO:0001150",
  ]);
  assert.equal(result.ranking[0].snapshot.primaryText, "Akita");
  assert.equal(result.ranking[0].snapshot.secondaryText, "Japan · Breed or type");
  assert.equal(result.ranking[0].rankedAt, "2026-07-16T00:00:00.000Z");
  assert.equal(result.ranking[0].comparisons, 3);
  assert.deepEqual(result.lists.curious, [], "ranking owns the canonical duplicate");
  assert.deepEqual(result.lists.not_for_me, [], "an old alias cannot survive in another list");
  assert.equal(result.remapped, 2);
  assert.equal(result.deduplicated, 2);
  assert.equal(result.changed, true);
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
    ["VBO:0000661", entity("VBO:0000661", "Akita", { originRegions: ["Japan"], tags: ["spitz"], registryRefs: ["FCI:255"] })],
    ["VBO:0001234", entity("VBO:0001234", "Shiba Inu", { originRegions: ["Japan"], tags: ["spitz"], registryRefs: ["FCI:257"] })],
    ["VBO:0001150", entity("VBO:0001150", "Saluki", { originRegions: ["Middle East"], tags: ["sighthound"] })],
  ]);
  const signals = buildDogTasteSignals(list, catalog);
  assert.deepEqual(signals.map((signal) => signal.value), ["Japan", "spitz"]);
  assert.equal(signals.some((signal) => signal.kind === "registry"), false);
  assert.equal(signals[0].items.length, 2);
});

test("Dogs exports are text-first and preserve canonical ids in JSON", () => {
  const list = [ranked("VBO:0000661", "Akita")];
  const markdown = dogsExportText(list, "vbo-2026-04-15.1", "markdown");
  const text = dogsExportText(list, "vbo-2026-04-15.1", "text");
  assert.match(markdown, /\*\*Akita\*\*/);
  assert.match(markdown, /Source: Vertebrate Breed Ontology/);
  assert.doesNotMatch(`${markdown}\n${text}`, /VBO:|vbo-|FCI|iDog|VeNom/);
  const json = JSON.parse(dogsExportText(list, "vbo-2026-04-15.1", "json"));
  assert.equal(json.ranking[0].id, "VBO:0000661");
  assert.equal(json.catalogVersion, "vbo-2026-04-15.1");
});
