import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { assertArtworkCropRecipeContract } from "../scripts/prepare-dog-artwork-batch.mjs";

const root = new URL("../", import.meta.url);
const readJson = async (filename) => JSON.parse(await readFile(new URL(filename, root), "utf8"));

test("tracked crop recipes cover every exact pending Dogs ledger asset once", async () => {
  const [ledger, recipes] = await Promise.all([
    readJson("data/dogs/image-rights.json"),
    readJson("data/dogs/artwork-crop-recipes.json"),
  ]);

  assert.doesNotThrow(() => assertArtworkCropRecipeContract({ ledger, recipes }));
  assert.equal(recipes.recipes.length, 28);
  assert.equal(new Set(recipes.recipes.map((recipe) => recipe.assetId)).size, 28);
  assert.deepEqual(new Set(ledger.assets.map((asset) => asset.review.status)), new Set(["pending"]));
  for (const asset of ledger.assets) {
    assert.equal(asset.delivery.status, "not_ready");
    assert.deepEqual(asset.delivery.variants, []);
    assert.equal(asset.uiDisplayAllowed, false);
    assert.equal(asset.publicSnapshotAllowed, false);
    assert.equal(asset.rasterExportAllowed, false);
  }
});

test("crop recipes are source-bound preparation data without approval or delivery grants", async () => {
  const [ledger, recipes] = await Promise.all([
    readJson("data/dogs/image-rights.json"),
    readJson("data/dogs/artwork-crop-recipes.json"),
  ]);
  const assets = new Map(ledger.assets.map((asset) => [asset.assetId, asset]));

  for (const recipe of recipes.recipes) {
    const asset = assets.get(recipe.assetId);
    assert.equal(recipe.catalogId, asset.catalogId);
    assert.equal(recipe.sourceSha256, asset.sourceSha256);
    assert.ok(recipe.rationale.length >= 40);
    assert.ok(Math.abs(recipe.crop.width / recipe.crop.height - 3 / 2) / (3 / 2) <= 0.005);
    for (const forbidden of [
      "review",
      "delivery",
      "reviewedBy",
      "uiDisplayAllowed",
      "publicSnapshotAllowed",
      "rasterExportAllowed",
    ]) {
      assert.equal(Object.hasOwn(recipe, forbidden), false, `${recipe.assetId} must not include ${forbidden}`);
    }
  }
});

test("crop recipe contract rejects stale, duplicated, and ratio-invalid preparation data", async () => {
  const [ledger, recipes] = await Promise.all([
    readJson("data/dogs/image-rights.json"),
    readJson("data/dogs/artwork-crop-recipes.json"),
  ]);
  const clone = () => structuredClone(recipes);

  const stale = clone();
  stale.recipes[0].sourceSha256 = "0".repeat(64);
  assert.throws(() => assertArtworkCropRecipeContract({ ledger, recipes: stale }), /source hash mismatch/);

  const duplicate = clone();
  duplicate.recipes[1].assetId = duplicate.recipes[0].assetId;
  assert.throws(() => assertArtworkCropRecipeContract({ ledger, recipes: duplicate }), /Duplicate crop recipe/);

  const square = clone();
  square.recipes[0].crop.height = square.recipes[0].crop.width;
  assert.throws(() => assertArtworkCropRecipeContract({ ledger, recipes: square }), /3:2 aspect ratio/);
});
