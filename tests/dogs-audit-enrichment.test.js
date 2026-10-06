import assert from "node:assert/strict";
import test from "node:test";
import { buildDogProfiles, dogProfileOrigins, normalizeDogOrigins } from "../scripts/dog-profiles-lib.mjs";
import { enrichDogCatalogEntity, normalizeDogProfile, buildDogTasteSignals } from "../lib/dogs.js";
import { normalizeDogCatalogEntity, dogEntityToCandidate, dogDisplayAliases } from "../lib/categories/dogs.js";
import { normalizeCatalog, buildCatalogIndex, searchCatalog, catalogFacetValues } from "../lib/catalog.js";
import { filterDogGallery } from "../lib/dogs-explore.js";

const A = "VBO:0200833", B = "VBO:0200834";
const entity = (id = A) => ({ id, displayName: "Long-Haired Whippet", status: "canonical", selectable: true,
  aliases: ["LonghairedWhippet"], displayAliases: ["Windsprite"], originRegions: ["Old inferred origin"],
  tags: ["coat silhouette", "giant", "non sporting"] });
const profile = () => normalizeDogProfile({ summary: "An individually reviewed description of this exact dog type.",
  sizeBand: "medium", originRegions: [], editorialFamilies: ["sighthound"] });
const adapter = { domain: "dogs", entityType: "breed", source: "vbo",
  getSnapshot: record => dogEntityToCandidate(record)?.snapshot,
  getFacets: record => ({ region: record.originRegions, family: record.tags }) };
const document = entities => ({ schemaVersion: 1, catalogId: "stackrank-dogs", catalogVersion: "test", entities });

test("profile enrichment preserves deliberate absence through candidates, facets and Taste", () => {
  const entities = [A, B].map(id => enrichDogCatalogEntity(entity(id), profile()));
  const catalog = new Map(entities.map(e => [e.id, normalizeDogCatalogEntity(e)]));
  const ranking = entities.map(dogEntityToCandidate);
  assert.ok(ranking.every(item => !item.snapshot.secondaryText.includes("Old inferred origin")));
  const index = buildCatalogIndex(normalizeCatalog(document(entities), adapter));
  assert.deepEqual(catalogFacetValues(index, "region"), []);
  assert.deepEqual(catalogFacetValues(index, "family"), [{ value: "sighthound", count: 2 }]);
  assert.deepEqual(buildDogTasteSignals(ranking, catalog).map(({ kind, value }) => ({ kind, value })),
    [{ kind: "family", value: "sighthound" }]);
  assert.deepEqual(enrichDogCatalogEntity(entity(), null).originRegions, ["Old inferred origin"]);
  assert.deepEqual(entity().tags, ["coat silhouette", "giant", "non sporting"], "source record is not mutated");
});

test("new presentation aliases and retained source synonyms work in search and the gallery", () => {
  // Generic indexing also handles an un-enriched catalog, retaining custom adapter aliases.
  const index = buildCatalogIndex(normalizeCatalog(document([entity()]), {
    ...adapter, getAliases: record => [...record.aliases, "Legacy lookup"],
  }));
  for (const query of ["Windsprite", "LonghairedWhippet", "Legacy lookup"]) {
    assert.equal(searchCatalog(index, query)[0]?.item.entityRef.id, A);
  }
  const enriched = normalizeDogCatalogEntity(enrichDogCatalogEntity(entity(), profile()));
  assert.deepEqual(dogDisplayAliases(enriched), ["Windsprite"]);
  const entries = [{ id: A, name: enriched.displayName, aliases: enriched.aliases }];
  for (const query of ["Windsprite", "LonghairedWhippet"]) {
    assert.equal(filterDogGallery(entries, { query })[0]?.id, A);
  }
  assert.deepEqual(entity().aliases, ["LonghairedWhippet"], "source aliases are not overwritten");
});

test("origin equivalence handles FCI casing and rejects malformed authored origin metadata", () => {
  for (const [country, expected] of [["UNITED STATES OF AMERICA", "United States"],
    ["PEOPLE'S REPUBLIC OF CHINA", "China"], ["KOREA (REPUBLIC OF)", "South Korea"]]) {
    assert.deepEqual(dogProfileOrigins({ entity: entity(), fciRecord: { country } }), { regions: [expected], basis: "registry" });
  }
  assert.deepEqual(normalizeDogOrigins(["USA", "usa", "GERMAN EMPIRE", "europe", {}, 2]), ["United States"]);
  for (const originRegions of [{}, "France", [null], [{}], [2], [" "]]) {
    assert.throws(() => dogProfileOrigins({ entity: entity(), override: { originRegions } }), /Invalid authored origins/);
  }
  for (const originBasis of [null, "unknown", {}, "structured"]) {
    assert.throws(() => dogProfileOrigins({ entity: entity(), override: { originRegions: [], originBasis } }), /Invalid authored origin basis/);
  }
  assert.deepEqual(dogProfileOrigins({ entity: entity(), override: { originRegions: ["Historical region"] } }),
    { regions: ["Historical region"], basis: "editorial" });
});

test("individual review dates take precedence for override and refresh provenance", () => {
  const authored = { summary: "A reviewed account of this breed's history and distinctive traits.",
    sizeBand: "medium", originRegions: [], reviewedAt: "2026-10-06",
    sources: [{ title: "Breed standard", url: "https://example.test/breed", evidence: "Exact breed evidence." }] };
  const input = { catalog: { source: {}, entities: [entity()] }, packs: { packs: [] },
    wikidata: { source: {}, records: [] }, fci: { source: {}, records: [] }, overrides: { profiles: {} } };
  for (const kind of ["override", "refresh"]) {
    const build = value => buildDogProfiles({ ...input,
      ...(kind === "override" ? { overrides: { reviewedAt: "2026-09-22", profiles: { [A]: value } } }
        : { refreshes: [{ schemaVersion: 1, reviewedAt: "2026-09-22", profiles: { [A]: value } }] }),
    });
    const artifact = build(authored);
    assert.ok(artifact.profiles[A].sourceIds.includes("stackrank-editorial-review-2026-10-06"));
    assert.equal(artifact.sources.find(source => source.kind === "breed-reference").retrievedAt, "2026-10-06T00:00:00.000Z");
    const { reviewedAt, ...undated } = authored;
    assert.ok(build(undated).profiles[A].sourceIds.includes("stackrank-editorial-review-2026-09-22"));
    for (const invalid of [null, "", "2026-02-30", "bad-date"]) {
      assert.throws(() => build({ ...authored, reviewedAt: invalid }), /Invalid profile review date/);
    }
  }
});
