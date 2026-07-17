#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClassification,
  readJson,
  stableJson,
  validateCatalogSystem,
} from "./dog-catalog-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(repositoryRoot, "data/dogs");
const sourcePath = path.join(dataRoot, "sources/vbo-2026-04-15.json");
const sourceBuffer = fs.readFileSync(sourcePath);
const ontology = JSON.parse(sourceBuffer.toString("utf8"));
const metadata = readJson(path.join(dataRoot, "sources/vbo-2026-04-15.metadata.json"));
const overrides = readJson(path.join(dataRoot, "catalog-overrides.json"));
const classification = readJson(path.join(dataRoot, "classification.json"));
const catalog = readJson(path.join(dataRoot, "dog-catalog.json"));
const coverage = readJson(path.join(dataRoot, "coverage-report.json"));
const review = readJson(path.join(dataRoot, "classification-review.json"));

const errors = validateCatalogSystem({
  sourceBuffer,
  ontology,
  metadata,
  overrides,
  classification,
  catalog,
  coverage,
  review,
});
const expectedClassification = buildClassification(ontology, metadata, overrides);
if (stableJson(expectedClassification) !== stableJson(classification)) {
  errors.push("classification.json does not match deterministic source/override decisions");
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  console.error(`Dog catalog validation failed with ${errors.length} error(s)`);
  process.exitCode = 1;
} else {
  const counts = coverage.dispositionCounts;
  console.log(
    `Dog catalog valid: ${coverage.classifiedTermCount}/${coverage.sourceTermCount} terms; ` +
      `${coverage.runtimeEntityCount} runtime entities; ` +
      `canonical ${counts.canonical || 0}, alias ${counts.alias || 0}, variety ${counts.variety || 0}, ` +
      `crossbreed ${counts.crossbreed || 0}, historical ${counts.historical || 0}, excluded ${counts.excluded || 0}`,
  );
}
