import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [audit, review, coverage] = await Promise.all([
  readFile(new URL("notes/testing/dogs-catalog-editorial-audit-2026-07-21.md", root), "utf8"),
  readFile(new URL("data/dogs/classification-review.json", root), "utf8").then(JSON.parse),
  readFile(new URL("data/dogs/coverage-report.json", root), "utf8").then(JSON.parse),
]);

const changedOverridePaths = [
  "classification.decisions.VBO:0008001",
  "classification.decisions.VBO:0008002",
  "classification.decisions.VBO:0008051",
  "classification.decisions.VBO:0008055",
  "classification.decisions.VBO:0008059.targetId",
  "classification.decisions.VBO:0008085",
  "classification.decisions.VBO:0008087",
  "classification.decisions.VBO:0200155",
  "classification.decisions.VBO:0200198",
  "classification.decisions.VBO:0200200",
  "classification.decisions.VBO:0200236.targetId",
  "classification.decisions.VBO:0200296",
  "classification.decisions.VBO:0200412",
  "classification.decisions.VBO:0200462",
  "classification.decisions.VBO:0200485",
  "classification.decisions.VBO:0200498",
  "classification.decisions.VBO:0200539",
  "classification.decisions.VBO:0200546",
  "classification.decisions.VBO:0200682",
  "classification.decisions.VBO:0200723",
  "classification.decisions.VBO:0200863",
  "classification.decisions.VBO:0201062",
  "classification.decisions.VBO:0201243",
  "classification.decisions.VBO:0201313",
  "classification.decisions.VBO:0201369",
  "classification.decisions.VBO:0201390",
  "classification.decisions.VBO:0201407",
  "classification.decisions.VBO:0201429",
  "classification.decisions.VBO:0201430",
  "entities.VBO:0008003",
  "entities.VBO:0008005",
  "entities.VBO:0008049",
  "entities.VBO:0008093",
  "entities.VBO:0200679",
];

test("editorial evidence artifact maps every override changed in the 2026-07-21 audit", () => {
  for (const path of changedOverridePaths) {
    assert.match(audit, new RegExp(`\\b${path.replaceAll(".", "\\.")}\\b`, "u"), path);
  }
  assert.match(audit, /https:\/\/www\.fci\.be\//u);
  assert.match(audit, /https:\/\/www\.akc\.org\//u);
  assert.match(audit, /https:\/\/www\.fao\.org\/dad-is/u);
});

test("editorial audit counts stay synchronized with deterministic catalog artifacts", () => {
  assert.deepEqual(review.summary, {
    aliasDecisions: 294,
    varietyDecisions: 187,
    crossbreedDecisions: 139,
    historicalDecisions: 36,
    excludedDecisions: 4,
    regionalLandraceCandidates: 20,
    ambiguousSearchNamesRetained: 18,
  });
  assert.deepEqual(coverage.dispositionCounts, {
    alias: 294,
    canonical: 877,
    crossbreed: 139,
    excluded: 4,
    historical: 36,
    variety: 187,
  });
  assert.equal(coverage.runtimeEntityCount, 1_239);
});
