import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCatalogReviewModel,
  renderCatalogReviewHtml,
} from "../scripts/build-dog-catalog-review.mjs";

const root = new URL("../", import.meta.url);
const fixture = async (name) =>
  JSON.parse(await readFile(new URL(`data/dogs/${name}`, root), "utf8"));

const [review, classification, overrides, catalog, ontology] = await Promise.all([
  fixture("classification-review.json"),
  fixture("classification.json"),
  fixture("catalog-overrides.json"),
  fixture("dog-catalog.json"),
  fixture("sources/vbo-2026-04-15.json"),
]);

const model = buildCatalogReviewModel({
  review,
  classification,
  overrides,
  catalog,
  ontology,
});

test("catalog review workspace models every exact generated editorial queue entry", () => {
  assert.equal(model.summary.queueItems, 682);
  assert.deepEqual(model.summary.queueCounts, [
    { key: "aliasDecisions", label: "Alias decisions", count: 271 },
    { key: "varietyDecisions", label: "Variety decisions", count: 190 },
    { key: "crossbreedDecisions", label: "Crossbreed decisions", count: 139 },
    { key: "historicalDecisions", label: "Historical decisions", count: 36 },
    { key: "excludedDecisions", label: "Excluded decisions", count: 2 },
    {
      key: "regionalLandraceCandidates",
      label: "Regional / landrace candidates",
      count: 26,
    },
    { key: "ambiguousSearchNames", label: "Ambiguous search names", count: 18 },
  ]);
  assert.equal(new Set(model.items.map((item) => item.reviewKey)).size, 682);
  assert.equal(model.generatedFrom.catalogVersion, review.catalogVersion);
  assert.equal(model.generatedFrom.catalogVersion, catalog.catalogVersion);
  assert.equal(model.generatedFrom.source.sha256.length, 64);
});

test("catalog review rows retain exact VBO, relation, runtime, source, and override evidence", () => {
  const drentsche = model.items.find(
    (item) => item.reviewKey === "aliasDecisions:VBO:0000664",
  );
  assert.equal(drentsche.primaryLabel, "Dutch Partridge Dog");
  assert.deepEqual(drentsche.relation, {
    kind: "target",
    id: "VBO:0200453",
    label: "Drentsche Patrijshond",
  });
  assert.equal(drentsche.source.synonyms.includes("Drentse Patrijshond"), true);
  assert.equal(drentsche.source.xrefs.includes("VeNom:13970"), true);
  assert.equal(
    drentsche.source.sources.includes("https://venomcoding.org/venom-codes/"),
    true,
  );
  assert.deepEqual(drentsche.overrideContext.classificationDecisions["VBO:0000664"], {
    disposition: "alias",
    targetId: "VBO:0200453",
    reasonCode: "curated_registry_synonym",
  });
  assert.equal(
    drentsche.runtimeEntities.some(
      (entity) =>
        entity.id === "VBO:0200453" &&
        entity.displayName === "Drentsche Patrijshond",
    ),
    true,
  );
});

test("ambiguous search review rows expose every retained canonical owner", () => {
  const aussie = model.items.find(
    (item) => item.reviewKey === "ambiguousSearchNames:aussie",
  );
  assert.deepEqual(aussie.subjectIds, ["VBO:0200095", "VBO:0200098"]);
  assert.deepEqual(
    aussie.runtimeEntities.map((entity) => entity.displayName),
    ["Australian Shepherd", "Australian Terrier"],
  );
  assert.equal(
    aussie.relatedSources.every((source) => source.synonyms.includes("Aussie")),
    true,
  );
  assert.match(aussie.searchText, /australian shepherd/u);
  assert.match(aussie.searchText, /australian terrier/u);
});

test("catalog review HTML is noindex, browser-local, export-only, and cannot mutate catalog files", () => {
  const html = renderCatalogReviewHtml(model);
  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/u);
  assert.match(html, /Browser-local drafts only/u);
  assert.match(html, /No source files are changed/u);
  assert.match(html, /Export review notes/u);
  assert.match(html, /stackrank:dogs-catalog-review:v1/u);
  assert.match(html, /stackrank-dogs-catalog-review-draft/u);
  assert.match(html, /catalog-overrides\.json/u);
  assert.doesNotMatch(html, /showOpenFilePicker|showSaveFilePicker|FileSystemFileHandle/u);
  assert.doesNotMatch(html, /\bfetch\s*\(/u);
  assert.doesNotMatch(html, />\s*(?:Apply|Approve|Build catalog)\s*</iu);
});
