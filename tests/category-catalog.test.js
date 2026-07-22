import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { BOOK_STARTER_SHELVES } from "../lib/categories/books.js";
import { dogEntityToCandidate } from "../lib/categories/dogs.js";
import {
  buildCatalogIndex,
  catalogFacetValues,
  normalizeCatalog,
  normalizeCatalogSearchText,
  searchCatalog,
  validateCatalogVersion,
} from "../lib/catalog.js";
import { entityRefKey } from "../lib/entity.js";

const DOG_CATALOG = {
  schemaVersion: 1,
  catalogId: "stackrank-dogs",
  catalogVersion: "vbo-2026-04-15.1",
  entities: [
    {
      id: "VBO:0000001",
      displayName: "German Shepherd Dog",
      entityType: "dog",
      status: "canonical",
      selectable: true,
      aliases: ["Alsatian", "German Shepherd"],
      registryRefs: ["FCI:1", "AKC:Herding"],
    },
    {
      id: "VBO:0000002",
      displayName: "Xoloitzcuintli",
      entityType: "dog",
      status: "variety",
      selectable: true,
      aliases: ["Mexican Hairless Dog", "Xolo"],
      registryRefs: ["FCI:5"],
    },
    {
      id: "VBO:0000003",
      displayName: "Old example",
      entityType: "dog",
      status: "historical",
      selectable: false,
      aliases: [],
      registryRefs: [],
    },
  ],
};

const DOG_ADAPTER = {
  domain: "dogs",
  entityType: "breed",
  source: "vbo",
  getFacets: (record) => ({
    status: record.status,
    registry: record.registryRefs.map((ref) =>
      typeof ref === "string" ? ref : `${ref.scheme}: ${ref.group}`),
  }),
};

const runtimeDogCatalog = () => JSON.parse(readFileSync(
  new URL("../data/dogs/dog-catalog.json", import.meta.url),
  "utf8",
));

test("catalog version checks fail closed on unknown or mismatched artifacts", () => {
  assert.deepEqual(validateCatalogVersion(DOG_CATALOG, {
    expectedCatalogId: "stackrank-dogs",
    supportedSchemaVersions: [1],
  }), {
    valid: true,
    reason: "valid",
    schemaVersion: 1,
    catalogId: "stackrank-dogs",
    catalogVersion: "vbo-2026-04-15.1",
  });
  assert.equal(validateCatalogVersion({ ...DOG_CATALOG, schemaVersion: 2 }).reason, "unsupported-schema-version");
  assert.equal(validateCatalogVersion({ ...DOG_CATALOG, schemaVersion: "1" }).reason, "unsupported-schema-version");
  assert.equal(validateCatalogVersion({ ...DOG_CATALOG, catalogVersion: 1 }).reason, "missing-catalog-identity");
  assert.equal(validateCatalogVersion(DOG_CATALOG, { expectedCatalogId: "books" }).reason, "catalog-id-mismatch");
  assert.equal(validateCatalogVersion(DOG_CATALOG, { expectedCatalogVersion: "newer" }).reason, "catalog-version-mismatch");
  assert.equal(normalizeCatalog({ ...DOG_CATALOG, schemaVersion: 2 }, DOG_ADAPTER).items.length, 0);
});

test("dog aliases search to one canonical provider-qualified identity", () => {
  const normalized = normalizeCatalog(DOG_CATALOG, DOG_ADAPTER, {
    expectedCatalogId: "stackrank-dogs",
  });
  assert.equal(normalized.valid, true);
  assert.equal(normalized.items.length, 3);
  const index = buildCatalogIndex(normalized);
  const [result] = searchCatalog(index, "Alsatian");
  assert.equal(entityRefKey(result.item), "dogs:breed:vbo:VBO:0000001");
  assert.equal(result.item.snapshot.primaryText, "German Shepherd Dog");
  assert.equal(result.matchedOn, "alias");
  assert.equal(result.matchedText, "Alsatian");
  assert.equal(
    entityRefKey(result.item),
    entityRefKey(dogEntityToCandidate(DOG_CATALOG.entities[0])),
    "catalog search and Dogs storage adapters share one canonical reference",
  );
  const [exactAlias] = searchCatalog(index, "German Shepherd");
  assert.equal(exactAlias.matchedOn, "alias", "an exact alias outranks a longer primary-name prefix");
  assert.equal(searchCatalog(index, "old example").length, 0, "nonselectable records do not leak into search");
  assert.equal(searchCatalog(index, "old example", { selectableOnly: false }).length, 1);
});

test("the generated Dogs runtime artifact satisfies the shared search and storage contract", () => {
  const catalog = runtimeDogCatalog();
  const normalized = normalizeCatalog(catalog, DOG_ADAPTER, {
    expectedCatalogId: "stackrank-dogs",
  });
  assert.equal(normalized.valid, true);
  assert.equal(normalized.rejectedCount, 0);
  assert.equal(normalized.items.length, catalog.entities.length);

  const source = catalog.entities.find((entity) => entity.selectable && entity.aliases.length);
  assert.ok(source, "the comprehensive catalog carries searchable aliases");
  const [result] = searchCatalog(buildCatalogIndex(normalized), source.aliases[0]);
  assert.equal(result.item.entityRef.id, source.id);
  assert.equal(result.item.snapshot.primaryText, source.displayName);
  assert.equal(entityRefKey(result.item), entityRefKey(dogEntityToCandidate(source)));
});

test("catalog search normalizes punctuation, accents, facets, and bounded browse results", () => {
  assert.equal(normalizeCatalogSearchText("  Chien-d’eau  "), "chien d eau");
  const index = buildCatalogIndex(normalizeCatalog(DOG_CATALOG, DOG_ADAPTER));
  assert.equal(searchCatalog(index, "mexican-hairless", { facets: { status: "variety" } })[0].item.snapshot.primaryText, "Xoloitzcuintli");
  assert.equal(searchCatalog(index, "xolo", { facets: { status: "canonical" } }).length, 0);
  assert.deepEqual(catalogFacetValues(index, "status"), [
    { value: "canonical", count: 1 },
    { value: "historical", count: 1 },
    { value: "variety", count: 1 },
  ]);
  assert.equal(searchCatalog(index, "", { limit: 1 }).length, 1);
  assert.equal(searchCatalog(index, "", { limit: 1 })[0].matchedOn, "browse");
});

test("the current Books entity envelope satisfies the shared catalog contract through an adapter", () => {
  const catalog = {
    schemaVersion: 1,
    catalogId: "stackrank-books-preview",
    catalogVersion: "starter-shelves.1",
    entities: BOOK_STARTER_SHELVES.flatMap((shelf) => shelf.items),
  };
  const normalized = normalizeCatalog(catalog, {
    getEntityRef: (record) => record.entityRef,
    getSnapshot: (record) => record.snapshot,
    getStatus: () => "canonical",
    isSelectable: () => true,
    getAliases: () => [],
    getFacets: () => ({ status: "canonical" }),
  });
  const [result] = searchCatalog(buildCatalogIndex(normalized), "Frank Herbert");
  assert.equal(result, undefined, "authors are secondary text, not identity aliases");
  const [dune] = searchCatalog(buildCatalogIndex(normalized), "Dune");
  assert.equal(entityRefKey(dune.item), "books:work:openlibrary:OL893415W");
  assert.equal(dune.item.snapshot.primaryText, "Dune");
});

test("catalog normalization rejects duplicate identity and malformed records explicitly", () => {
  const normalized = normalizeCatalog({
    ...DOG_CATALOG,
    entities: [
      DOG_CATALOG.entities[0],
      DOG_CATALOG.entities[0],
      { id: "", displayName: "Broken" },
      {
        ...DOG_CATALOG.entities[1],
        entityRef: { domain: "books", type: "work", source: "openlibrary", id: "OL1W" },
      },
    ],
  }, DOG_ADAPTER);
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.rejectedCount, 3);
});
