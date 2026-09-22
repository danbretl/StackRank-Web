#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
const [manifest, policy, catalog] = await Promise.all([
  readJson("data/dogs/generated-artwork.json"),
  readJson("data/dogs/generated-artwork-policy.json"),
  readJson("data/dogs/dog-catalog.json"),
]);
const catalogIds = new Set(catalog.entities.map((entity) => entity.id));
const errors = [];
const seen = new Set();
if (manifest.policyVersion !== policy.policyVersion) errors.push("Generated manifest policy version mismatch");
for (const asset of manifest.assets || []) {
  if (seen.has(asset.catalogId)) errors.push(`${asset.catalogId}: duplicate asset`);
  seen.add(asset.catalogId);
  if (!catalogIds.has(asset.catalogId)) errors.push(`${asset.catalogId}: missing catalog entity`);
  if (asset.sourceType !== "ai-generated" || asset.review?.status !== "approved") errors.push(`${asset.catalogId}: generated asset not approved`);
  if (!asset.uiDisplayAllowed || asset.publicSnapshotAllowed || asset.rasterExportAllowed) errors.push(`${asset.catalogId}: unsafe purpose gates`);
  for (const variant of asset.variants || []) {
    const filename = path.join(root, variant.url || "");
    const stat = await fs.stat(filename).catch(() => null);
    if (!stat || stat.size !== variant.bytes) errors.push(`${asset.catalogId}: missing or mismatched ${variant.role} variant`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${seen.size} generated Dog portraits with fail-closed sharing gates.`);
}
