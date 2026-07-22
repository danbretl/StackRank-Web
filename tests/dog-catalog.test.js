import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DOG_ROOT_ID,
  MAX_RECORD_BYTES,
  MAX_RUNTIME_BYTES,
  MIXED_BREED_ID,
  buildClassification,
  buildClassificationReview,
  buildCoverageReport,
  buildRuntimeCatalog,
  duplicateJsonObjectKeys,
  extractDogUniverse,
  normalizeCatalogName,
  readJson,
  sha256,
  stableJson,
  sourceDisplayName,
  validateCatalogSystem,
} from "../scripts/dog-catalog-lib.mjs";

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
const universe = extractDogUniverse(ontology, DOG_ROOT_ID);
const classificationsById = new Map(classification.terms.map((term) => [term.vboId, term]));
const entitiesById = new Map(catalog.entities.map((entity) => [entity.id, entity]));

function clone(value) {
  return structuredClone(value);
}

function validationErrors(changes = {}) {
  return validateCatalogSystem({
    sourceBuffer,
    ontology,
    metadata,
    overrides,
    classification,
    catalog,
    coverage,
    review,
    ...changes,
  });
}

function assertError(errors, pattern) {
  assert.match(errors.join("\n"), pattern);
}

function findBySearchName(query) {
  const normalizedQuery = normalizeCatalogName(query);
  return catalog.entities.filter((entity) =>
    [entity.displayName, ...entity.aliases].some((name) =>
      normalizeCatalogName(name).includes(normalizedQuery),
    ),
  );
}

test("pins and verifies the exact VBO 2026-04-15 artifact", () => {
  assert.equal(metadata.release, "2026-04-15");
  assert.equal(metadata.rootId, "VBO:0400024");
  assert.equal(sourceBuffer.length, 40_044_828);
  assert.equal(
    sha256(sourceBuffer),
    "511bb27d7581bfb8bccf69583c8ac0e3c12de4fdecaf0a8649abfcbfc5ed4da1",
  );
  assert.equal(metadata.license, "CC BY 4.0");
});

test("rejects duplicate raw JSON keys before JSON.parse can silently overwrite them", () => {
  assert.deepEqual(
    duplicateJsonObjectKeys('{"classification":{"decisions":{"VBO:0201370":{},"VBO:0201370":{}}}}'),
    ["$.classification.decisions.VBO:0201370"],
  );
  assert.deepEqual(duplicateJsonObjectKeys('{"left":{"id":1},"right":{"id":2}}'), []);
});

test("extracts all 1,537 labeled Dog breed descendants transitively", () => {
  assert.equal(universe.entries.length, 1_537);
  assert.equal(new Set(universe.entries.map((entry) => entry.id)).size, 1_537);
  assert.equal(universe.entries.every((entry) => entry.node.lbl), true);
  assert.deepEqual(
    Object.fromEntries(
      [...Map.groupBy(universe.entries, (entry) => entry.depth)].map(([depth, entries]) => [
        depth,
        entries.length,
      ]),
    ),
    { 1: 1_210, 2: 319, 3: 8 },
  );
});

test("assigns exactly one explicit disposition to every source term", () => {
  assert.equal(classification.terms.length, 1_537);
  assert.equal(new Set(classification.terms.map((term) => term.vboId)).size, 1_537);
  assert.equal(coverage.unclassifiedTermCount, 0);
  assert.deepEqual(coverage.dispositionCounts, {
    alias: 294,
    canonical: 877,
    crossbreed: 139,
    excluded: 4,
    historical: 36,
    variety: 187,
  });
  assert.equal(
    Object.values(coverage.dispositionCounts).reduce((sum, count) => sum + count, 0),
    1_537,
  );
});

test("rebuilds classification, runtime catalog, and coverage byte-for-byte", () => {
  const rebuiltClassification = buildClassification(ontology, metadata, overrides);
  const rebuiltCatalog = buildRuntimeCatalog(ontology, metadata, overrides, rebuiltClassification);
  const rebuiltCoverage = buildCoverageReport(metadata, rebuiltClassification, rebuiltCatalog, true);
  const rebuiltReview = buildClassificationReview(metadata, rebuiltClassification, rebuiltCatalog);

  assert.equal(stableJson(rebuiltClassification), stableJson(classification));
  assert.equal(stableJson(rebuiltCatalog), stableJson(catalog));
  assert.equal(stableJson(rebuiltCoverage), stableJson(coverage));
  assert.equal(stableJson(rebuiltReview), stableJson(review));
  assert.equal(validationErrors().length, 0);
});

test("keeps the comprehensive runtime artifact bounded without a canonical cap", () => {
  assert.equal(catalog.entities.length, 1_239);
  assert.equal(catalog.entities.length, coverage.runtimeEntityCount);
  assert.ok(catalog.entities.length > 1_000);
  assert.ok(Buffer.byteLength(stableJson(catalog)) < MAX_RUNTIME_BYTES);
  assert.ok(
    Math.max(...catalog.entities.map((entity) => Buffer.byteLength(JSON.stringify(entity)))) <
      MAX_RECORD_BYTES,
  );
});

test("removes upstream placeholder synonyms from public catalog search names", () => {
  assert.deepEqual(entitiesById.get("VBO:0201347").aliases, ["Bangkaew"]);
  assert.equal(
    entitiesById.get("VBO:0008049").aliases.some((name) => /[\u0080-\u009f]/u.test(name)),
    false,
  );
  assert.equal(
    catalog.entities.some((entity) =>
      [entity.displayName, ...entity.aliases].some((name) =>
        /^(?:n\/?a|none|not applicable|tbd|unknown|unspecified)$/iu.test(name.trim()),
      ),
    ),
    false,
  );
});

test("preserves every alias source id and resolves its search names to one stored identity", () => {
  for (const term of classification.terms.filter((row) => row.disposition === "alias")) {
    const target = entitiesById.get(term.targetId);
    const source = universe.byId.get(term.vboId);
    assert.ok(target, `${term.vboId} target ${term.targetId} exists`);
    assert.ok(target.sourceIds.includes(term.vboId), `${term.vboId} provenance is preserved`);
    const searchableNames = [target.displayName, ...target.aliases].map(normalizeCatalogName);
    assert.ok(
      searchableNames.includes(normalizeCatalogName(sourceDisplayName(source.node))),
      `${term.vboId} source name remains searchable through ${term.targetId}`,
    );
  }
});

test("models Akita variants without collapsing their selectable identities", () => {
  assert.equal(classificationsById.get("VBO:0200010").disposition, "canonical");
  assert.deepEqual(
    ["VBO:0200027", "VBO:0200734"].map((id) => ({
      id,
      disposition: classificationsById.get(id).disposition,
      parentId: classificationsById.get(id).parentId,
    })),
    [
      { id: "VBO:0200027", disposition: "variety", parentId: "VBO:0200010" },
      { id: "VBO:0200734", disposition: "variety", parentId: "VBO:0200010" },
    ],
  );
  assert.equal(classificationsById.get("VBO:0200628").targetId, "VBO:0200027");
  assert.ok(entitiesById.get("VBO:0200027").aliases.includes("Great Japanese Dog"));
});

test("keeps similarly named shepherd concepts separate while nesting explicit varieties", () => {
  for (const id of ["VBO:0200144", "VBO:0200577", "VBO:0200062", "VBO:0200473"]) {
    assert.ok(entitiesById.has(id), `${id} remains a distinct runtime identity`);
  }
  assert.notEqual(
    normalizeCatalogName(entitiesById.get("VBO:0200144").displayName),
    normalizeCatalogName(entitiesById.get("VBO:0200577").displayName),
  );
  for (const id of ["VBO:0200145", "VBO:0200146", "VBO:0200147", "VBO:0200148"]) {
    assert.equal(entitiesById.get(id).status, "variety");
    assert.equal(entitiesById.get(id).relationships.parentId, "VBO:0200144");
  }
});

test("models all VBO Xoloitzcuintli size concepts as selectable varieties", () => {
  for (const id of ["VBO:0201437", "VBO:0201438", "VBO:0201439", "VBO:0201440"]) {
    const entity = entitiesById.get(id);
    assert.equal(entity.status, "variety");
    assert.equal(entity.relationships.parentId, "VBO:0201436");
  }
});

test("collapses reviewed regional and country duplicates to canonical provenance", () => {
  assert.equal(classificationsById.get("VBO:0007996").targetId, "VBO:0200193");
  assert.ok(entitiesById.get("VBO:0200193").sourceIds.includes("VBO:0007996"));
  for (const id of ["VBO:0000669", "VBO:0007993", "VBO:0008043"]) {
    assert.equal(classificationsById.get(id).targetId, "VBO:0200447");
  }
  assert.equal(findBySearchName("Dogo Guatemalteco").length, 1);
  for (const id of ["VBO:0008001", "VBO:0008002"]) {
    assert.equal(classificationsById.get(id).targetId, "VBO:0200577");
  }
  assert.equal(classificationsById.get("VBO:0008051").targetId, "VBO:0200679");
  assert.equal(classificationsById.get("VBO:0008085").targetId, "VBO:0200757");
  assert.equal(classificationsById.get("VBO:0008087").targetId, "VBO:0201464");
  assert.equal(classificationsById.get("VBO:0008055").reasonCode, "organization_name_not_breed");
  assert.equal(entitiesById.has("VBO:0008055"), false);
});

test("collapses registry-language duplicates and malformed registry rows to one identity", () => {
  const expectedAliases = {
    "VBO:0200155": "VBO:0200136",
    "VBO:0200198": "VBO:0200117",
    "VBO:0200200": "VBO:0200117",
    "VBO:0200296": "VBO:0200285",
    "VBO:0200546": "VBO:0200226",
    "VBO:0201313": "VBO:0200733",
    "VBO:0201369": "VBO:0200286",
    "VBO:0201370": "VBO:0200679",
    "VBO:0200723": "VBO:0201390",
    "VBO:0201243": "VBO:0201246",
    "VBO:0200498": "VBO:0200765",
    "VBO:0200682": "VBO:0201102",
    "VBO:0200485": "VBO:0200258",
    "VBO:0200462": "VBO:0201181",
    "VBO:0200539": "VBO:0201455",
  };
  for (const [sourceId, targetId] of Object.entries(expectedAliases)) {
    assert.equal(classificationsById.get(sourceId).disposition, "alias", sourceId);
    assert.equal(classificationsById.get(sourceId).targetId, targetId, sourceId);
    assert.equal(entitiesById.has(sourceId), false, sourceId);
    assert.equal(entitiesById.get(targetId).sourceIds.includes(sourceId), true, sourceId);
  }
  assert.equal(entitiesById.get("VBO:0200679").displayName, "Transylvanian Hound");
  assert.equal(entitiesById.get("VBO:0201455").aliases.includes("French Bulldog, Group 9 : Companion and Toy Dogs"), true);
});

test("keeps legacy source-format labels searchable without exposing them as separate breeds", () => {
  const expectedAliases = {
    "VBO:0200412": "VBO:0200406",
    "VBO:0200863": "VBO:0200862",
    "VBO:0201062": "VBO:0201061",
    "VBO:0201407": "VBO:0201406",
  };
  for (const [sourceId, targetId] of Object.entries(expectedAliases)) {
    assert.equal(classificationsById.get(sourceId).reasonCode, "curated_legacy_format_synonym");
    assert.equal(classificationsById.get(sourceId).targetId, targetId);
    assert.equal(entitiesById.has(sourceId), false);
    assert.equal(entitiesById.get(targetId).sourceIds.includes(sourceId), true);
  }
  assert.equal(catalog.entities.some((entity) => /old format/iu.test(entity.displayName)), false);
});

test("labels historical concepts, crossbreeds, mixed breed, and non-dog exclusions explicitly", () => {
  assert.equal(classificationsById.get("VBO:0201377").disposition, "historical");
  assert.equal(entitiesById.get("VBO:0201377").displayName, "Turnspit Dog");
  assert.equal(classificationsById.get("VBO:0200798").disposition, "crossbreed");
  assert.equal(entitiesById.get("VBO:0200798").relationships.parentId, MIXED_BREED_ID);
  assert.equal(classificationsById.get(MIXED_BREED_ID).disposition, "canonical");
  assert.equal(classificationsById.get("VBO:0200729").reasonCode, "non_domestic_canid");
  assert.equal(entitiesById.has("VBO:0200729"), false);
  assert.equal(classificationsById.get("VBO:0201429").reasonCode, "non_domestic_canid");
  assert.equal(entitiesById.has("VBO:0201429"), false);
  assert.equal(classificationsById.get("VBO:0201430").disposition, "crossbreed");
  assert.equal(entitiesById.get("VBO:0201430").relationships.parentId, MIXED_BREED_ID);
  assert.equal(classificationsById.get("VBO:0200609").disposition, "canonical");
  assert.equal(classificationsById.get("VBO:0200685").targetId, "VBO:0201233");
});

test("publishes explicit review queues for every non-canonical and ambiguous decision class", () => {
  assert.deepEqual(review.summary, {
    aliasDecisions: 294,
    varietyDecisions: 187,
    crossbreedDecisions: 139,
    historicalDecisions: 36,
    excludedDecisions: 4,
    regionalLandraceCandidates: 20,
    ambiguousSearchNamesRetained: 18,
  });
  assert.equal(review.aliasDecisions.some((term) => term.vboId === "VBO:0007996"), true);
  assert.equal(review.crossbreedDecisions.some((term) => term.vboId === "VBO:0200798"), true);
  assert.equal(review.historicalDecisions.some((term) => term.vboId === "VBO:0201377"), true);
  assert.equal(review.excludedDecisions.some((term) => term.vboId === "VBO:0200729"), true);
  assert.equal(
    review.ambiguousSearchNames.some((entry) => entry.normalizedName === "aussie"),
    true,
  );
  assert.equal(
    review.ambiguousSearchNames.some((entry) => entry.normalizedName === "japanese akita"),
    false,
  );
});

test("every editorial review row is traceable to pinned VBO structure or an explicit override", () => {
  const explicitDecisions = overrides.classification.decisions;
  const exactNames = (id) => {
    const node = universe.byId.get(id)?.node;
    return new Set(
      [sourceDisplayName(node), ...(node?.meta?.synonyms || []).map((synonym) => synonym.val)]
        .map(normalizeCatalogName)
        .filter(Boolean),
    );
  };
  const descendsFrom = (id, ancestorId, seen = new Set()) => {
    if (id === ancestorId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (universe.byId.get(id)?.parents || []).some((parentId) =>
      descendsFrom(parentId, ancestorId, seen),
    );
  };
  const resolveAlias = (id) => {
    const row = classificationsById.get(id);
    return row?.disposition === "alias" ? resolveAlias(row.targetId) : id;
  };

  for (const row of review.aliasDecisions) {
    if (row.reasonCode !== "vbo_exact_synonym_cluster") {
      assert.ok(explicitDecisions[row.vboId], row.vboId);
      continue;
    }
    const sourceNames = exactNames(row.vboId);
    const targetNames = exactNames(row.targetId);
    assert.equal([...sourceNames].some((name) => targetNames.has(name)), true, row.vboId);
  }
  for (const row of review.varietyDecisions) {
    if (row.reasonCode !== "vbo_nested_breed_concept") {
      assert.ok(explicitDecisions[row.vboId], row.vboId);
      continue;
    }
    assert.equal(
      universe.byId.get(row.vboId).parents.some((parentId) => resolveAlias(parentId) === row.parentId),
      true,
      row.vboId,
    );
  }
  for (const row of review.crossbreedDecisions) {
    if (row.reasonCode === "vbo_mixed_breed_descendant") {
      assert.equal(descendsFrom(row.vboId, MIXED_BREED_ID), true, row.vboId);
    } else {
      assert.ok(explicitDecisions[row.vboId], row.vboId);
    }
  }
  for (const row of [...review.historicalDecisions, ...review.excludedDecisions]) {
    assert.ok(explicitDecisions[row.vboId], row.vboId);
  }
  for (const row of review.regionalLandraceCandidates) {
    assert.match(row.vboId, /^VBO:000\d{4}$/u);
    assert.match(row.sourceLabel, /, .+ \(Dog\)$/u);
    assert.equal(classificationsById.get(row.vboId).selectable, true);
  }
});

test("rejects an unclassified descendant", () => {
  const broken = clone(classification);
  broken.terms.pop();
  assertError(validationErrors({ classification: broken }), /Unclassified VBO descendant/u);
});

test("rejects an alias pointing nowhere", () => {
  const broken = clone(classification);
  broken.terms.find((term) => term.disposition === "alias").targetId = "VBO:9999999";
  assertError(validationErrors({ classification: broken }), /points to missing/u);
});

test("rejects relationship cycles", () => {
  const broken = clone(classification);
  const akita = broken.terms.find((term) => term.vboId === "VBO:0200010");
  const americanAkita = broken.terms.find((term) => term.vboId === "VBO:0200027");
  akita.parentId = americanAkita.vboId;
  assertError(validationErrors({ classification: broken }), /Parent relationship cycle/u);
});

test("rejects duplicate normalized display names without an explicit exception", () => {
  const broken = clone(catalog);
  broken.entities[1].displayName = broken.entities[0].displayName.toUpperCase();
  assertError(validationErrors({ catalog: broken }), /Duplicate normalized display name/u);
});

test("rejects unsupported metadata and oversized records", () => {
  const unsafeOverrides = clone(overrides);
  unsafeOverrides.entities["VBO:0200010"].temperament = "friendly";
  assertError(validationErrors({ overrides: unsafeOverrides }), /unsupported fields: temperament/u);

  const oversizedCatalog = clone(catalog);
  oversizedCatalog.entities[0].aliases.push("x".repeat(MAX_RECORD_BYTES));
  assertError(validationErrors({ catalog: oversizedCatalog }), /exceeds 16384 bytes/u);

  const placeholderCatalog = clone(catalog);
  placeholderCatalog.entities[0].aliases.push("TBD");
  assertError(validationErrors({ catalog: placeholderCatalog }), /placeholder alias TBD/u);
});

test("rejects runtime ordering or content that was not emitted by the deterministic compiler", () => {
  const reordered = clone(catalog);
  [reordered.entities[0], reordered.entities[1]] = [reordered.entities[1], reordered.entities[0]];
  assertError(validationErrors({ catalog: reordered }), /does not match deterministic compiler output/u);
});
