#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildClassification, readJson, stableJson } from "./dog-catalog-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repositoryRoot, "data/dogs/sources/vbo-2026-04-15.json");
const metadataPath = path.join(repositoryRoot, "data/dogs/sources/vbo-2026-04-15.metadata.json");
const overridesPath = path.join(repositoryRoot, "data/dogs/catalog-overrides.json");
const outputPath = path.join(repositoryRoot, "data/dogs/classification.json");

const classification = buildClassification(
  readJson(sourcePath),
  readJson(metadataPath),
  readJson(overridesPath),
);
const output = stableJson(classification);

if (process.argv.includes("--write")) {
  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${classification.terms.length} explicit dispositions to ${path.relative(repositoryRoot, outputPath)}`);
} else {
  process.stdout.write(output);
}
