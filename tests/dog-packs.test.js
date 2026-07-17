import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_PACK_ITEMS,
  MIN_PACK_ITEMS,
  PACK_FAMILIES,
  analyzePackOverlaps,
  validateDogPacks,
} from "../scripts/validate-dog-packs.mjs";

const [packLibrary, catalog] = await Promise.all([
  readFile(new URL("../data/dogs/packs.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/dogs/dog-catalog.json", import.meta.url), "utf8").then(JSON.parse),
]);

const copyLibrary = () => structuredClone(packLibrary);

test("Dogs editorial pack library passes its public-quality contract", () => {
  const result = validateDogPacks(packLibrary, catalog);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.packs, 46);
  assert.equal(result.summary.itemReferences, 448);
  assert.equal(result.summary.uniqueCatalogItems, 251);
  assert.equal(result.summary.starterPacks, 3);
  assert.equal(result.summary.promotedPacks, 3);
  assert.equal(result.summary.registrySchemePacks, 10);
  assert.equal(result.summary.maxItemAppearances, 6);
  assert.ok(result.summary.maxPairwiseJaccard < 0.55);
  assert.deepEqual(Object.keys(result.summary.families).sort(), [...PACK_FAMILIES].sort());
});

test("Dogs packs keep exactly three diverse, nonoverlapping promoted gateways", () => {
  const starters = packLibrary.packs.filter((pack) => pack.placements.includes("starter"));
  assert.deepEqual(starters.map((pack) => pack.id), [
    "gateway-around-the-world",
    "gateway-shapes-and-coats",
    "gateway-familiar-and-beyond",
  ]);
  assert.ok(starters.every((pack) => pack.promoted && pack.family === "gateway"));
  assert.ok(starters.every((pack) => new Set(pack.diversityRegions).size >= 4));
  assert.equal(new Set(starters.flatMap((pack) => pack.items)).size, 27);
  assert.ok(analyzePackOverlaps(starters).every((overlap) => overlap.jaccard <= 0.25));
});

test("Dogs packs use selectable stable catalog ids within the size bounds", () => {
  const catalogById = new Map(catalog.entities.map((entity) => [entity.id, entity]));
  for (const pack of packLibrary.packs) {
    assert.ok(pack.items.length >= MIN_PACK_ITEMS && pack.items.length <= MAX_PACK_ITEMS, pack.id);
    assert.equal(new Set(pack.items).size, pack.items.length, pack.id);
    for (const catalogId of pack.items) {
      assert.equal(catalogById.get(catalogId)?.selectable, true, `${pack.id}: ${catalogId}`);
    }
  }
});

test("registry packs name their source scheme and crossbreed packs disclose status", () => {
  const registryPacks = packLibrary.packs.filter((pack) => pack.schemeAttribution);
  assert.equal(registryPacks.length, 10);
  assert.ok(registryPacks.every((pack) => /^(American Kennel Club|FCI) — /.test(pack.schemeAttribution.label)));
  assert.ok(registryPacks.every((pack) => /registry-specific/i.test(pack.schemeAttribution.note)));

  const catalogById = new Map(catalog.entities.map((entity) => [entity.id, entity]));
  const crossbreedPacks = packLibrary.packs.filter((pack) => pack.family === "crossbreed");
  assert.equal(crossbreedPacks.length, 3);
  for (const pack of crossbreedPacks) {
    assert.match(pack.title, /^Crossbreeds:/);
    assert.match(pack.crossbreedDisclosure, /crossbreed/i);
    assert.ok(pack.items.every((catalogId) => catalogById.get(catalogId)?.status === "crossbreed"));
  }
});

test("historical pack contains only catalog concepts labeled historical", () => {
  const catalogById = new Map(catalog.entities.map((entity) => [entity.id, entity]));
  const pack = packLibrary.packs.find((candidate) => candidate.id === "historical-catalog-concepts");
  assert.ok(pack);
  assert.match(pack.subtitle, /historical/i);
  assert.ok(pack.items.every((catalogId) => catalogById.get(catalogId)?.status === "historical"));
});

test("validator rejects missing, duplicate, and nonselectable references", () => {
  const missing = copyLibrary();
  missing.packs[0].items[0] = "VBO:not-present";
  assert.ok(validateDogPacks(missing, catalog).errors.some((error) => /missing catalog id VBO:not-present/.test(error)));

  const duplicate = copyLibrary();
  duplicate.packs[0].items[1] = duplicate.packs[0].items[0];
  assert.ok(validateDogPacks(duplicate, catalog).errors.some((error) => /contains duplicate catalog ids/.test(error)));

  const alteredCatalog = structuredClone(catalog);
  alteredCatalog.entities.find((entity) => entity.id === packLibrary.packs[0].items[0]).selectable = false;
  assert.ok(validateDogPacks(packLibrary, alteredCatalog).errors.some((error) => /nonselectable catalog id/.test(error)));
});

test("validator rejects duplicated titles and overly overlapping packs", () => {
  const duplicatedTitle = copyLibrary();
  duplicatedTitle.packs[4].title = `  ${duplicatedTitle.packs[3].title.toUpperCase()}!!! `;
  assert.ok(validateDogPacks(duplicatedTitle, catalog).errors.some((error) => /duplicates another normalized title/.test(error)));

  const overlap = copyLibrary();
  overlap.packs[14].items = [...overlap.packs[13].items];
  assert.ok(validateDogPacks(overlap, catalog).errors.some((error) => /overlap too heavily/.test(error)));
});

test("validator enforces starter diversity and crossbreed labeling", () => {
  const starter = copyLibrary();
  starter.packs[0].diversityRegions = ["Europe", "Asia", "Africa"];
  assert.ok(validateDogPacks(starter, catalog).errors.some((error) => /at least four represented world regions/.test(error)));

  const crossbreed = copyLibrary();
  const pack = crossbreed.packs.find((candidate) => candidate.family === "crossbreed");
  pack.crossbreedDisclosure = "";
  assert.ok(validateDogPacks(crossbreed, catalog).errors.some((error) => /must explicitly frame the pack as crossbreeds/.test(error)));

  const mislabeled = copyLibrary();
  const crossbreedPack = mislabeled.packs.find((candidate) => candidate.family === "crossbreed");
  crossbreedPack.items[0] = "VBO:0200800";
  assert.ok(validateDogPacks(mislabeled, catalog).errors.some((error) => /must have catalog status crossbreed/.test(error)));
});

test("validator rejects suitability and behavior claims in editorial copy", () => {
  const unsafe = copyLibrary();
  unsafe.packs[20].description = "The best dog breeds for children and apartment-friendly homes.";
  const errors = validateDogPacks(unsafe, catalog).errors;
  assert.ok(errors.some((error) => /unsupported suitability\/behavior copy/.test(error)));
});
