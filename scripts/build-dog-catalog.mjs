#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCoverageReport,
  buildClassificationReview,
  buildRuntimeCatalog,
  readJson,
  sha256,
  stableJson,
} from "./dog-catalog-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repositoryRoot, "data/dogs/sources/vbo-2026-04-15.json");
const metadataPath = path.join(repositoryRoot, "data/dogs/sources/vbo-2026-04-15.metadata.json");
const overridesPath = path.join(repositoryRoot, "data/dogs/catalog-overrides.json");
const classificationPath = path.join(repositoryRoot, "data/dogs/classification.json");
const catalogPath = path.join(repositoryRoot, "data/dogs/dog-catalog.json");
const coveragePath = path.join(repositoryRoot, "data/dogs/coverage-report.json");
const reviewPath = path.join(repositoryRoot, "data/dogs/classification-review.json");

const sourceBuffer = fs.readFileSync(sourcePath);
const ontology = JSON.parse(sourceBuffer.toString("utf8"));
const metadata = readJson(metadataPath);
const overrides = readJson(overridesPath);
const classification = readJson(classificationPath);
const catalog = buildRuntimeCatalog(ontology, metadata, overrides, classification);
const coverage = buildCoverageReport(
  metadata,
  classification,
  catalog,
  sha256(sourceBuffer) === metadata.sha256,
);
const review = buildClassificationReview(metadata, classification, catalog);

fs.writeFileSync(catalogPath, stableJson(catalog));
fs.writeFileSync(coveragePath, stableJson(coverage));
fs.writeFileSync(reviewPath, stableJson(review));

console.log(
  `Built ${catalog.entities.length} runtime entities from ${classification.terms.length} classified VBO terms`,
);
console.log(`Catalog: ${path.relative(repositoryRoot, catalogPath)}`);
console.log(`Coverage: ${path.relative(repositoryRoot, coveragePath)}`);
console.log(`Review: ${path.relative(repositoryRoot, reviewPath)}`);
