import { createHash } from "node:crypto";
import fs from "node:fs";

export const DOG_ROOT_ID = "VBO:0400024";
export const MIXED_BREED_ID = "VBO:0200902";
export const CLASSIFICATION_SCHEMA_VERSION = 1;
export const CATALOG_SCHEMA_VERSION = 1;
export const CATALOG_ID = "stackrank-dogs";
export const CATALOG_VERSION = "vbo-2026-04-15.2";
export const MAX_RUNTIME_BYTES = 2_000_000;
export const MAX_RECORD_BYTES = 16_384;

export const DISPOSITIONS = Object.freeze([
  "canonical",
  "alias",
  "variety",
  "crossbreed",
  "historical",
  "excluded",
]);

const SELECTABLE_DISPOSITIONS = new Set([
  "canonical",
  "variety",
  "crossbreed",
  "historical",
]);

const CURIE_PATTERN = /^VBO:\d{7}$/u;
const VBO_IRI_PREFIX = "http://purl.obolibrary.org/obo/VBO_";
const SOURCE_PREDICATE = "http://purl.org/dc/terms/source";
const MOST_COMMON_NAME_SUFFIX = "#most_common_name";
const PLACEHOLDER_CATALOG_NAMES = new Set([
  "n a",
  "none",
  "not applicable",
  "tbd",
  "unknown",
  "unspecified",
]);

export function duplicateJsonObjectKeys(text) {
  let index = 0;
  const duplicates = [];
  const skipWhitespace = () => {
    while (/\s/u.test(text[index] || "")) index += 1;
  };
  const parseString = () => {
    const start = index;
    if (text[index] !== '"') throw new Error(`Expected JSON string at byte ${index}`);
    index += 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === '"') {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      index += 1;
    }
    throw new Error(`Unterminated JSON string at byte ${start}`);
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseString();
        const keyPath = `${path}.${key}`;
        if (keys.has(key)) duplicates.push(keyPath);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") throw new Error(`Expected JSON colon at byte ${index}`);
        index += 1;
        parseValue(keyPath);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") throw new Error(`Expected JSON comma at byte ${index}`);
        index += 1;
      }
      throw new Error(`Unterminated JSON object at ${path}`);
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let itemIndex = 0;
      while (index < text.length) {
        parseValue(`${path}[${itemIndex}]`);
        itemIndex += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") throw new Error(`Expected JSON comma at byte ${index}`);
        index += 1;
      }
      throw new Error(`Unterminated JSON array at ${path}`);
    }
    if (text[index] === '"') {
      parseString();
      return;
    }
    const start = index;
    while (index < text.length && !/[\s,}\]]/u.test(text[index])) index += 1;
    if (start === index) throw new Error(`Expected JSON value at byte ${index}`);
  };

  skipWhitespace();
  parseValue("$");
  skipWhitespace();
  if (index !== text.length) throw new Error(`Unexpected JSON content at byte ${index}`);
  return duplicates;
}

export function readJson(path) {
  const text = fs.readFileSync(path, "utf8");
  const duplicates = duplicateJsonObjectKeys(text);
  if (duplicates.length) {
    throw new Error(`${path} contains duplicate JSON object keys: ${duplicates.join(", ")}`);
  }
  return JSON.parse(text);
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function toCurie(value) {
  if (CURIE_PATTERN.test(value || "")) return value;
  const match = String(value || "").match(/\/VBO_(\d{7})$/u);
  return match ? `VBO:${match[1]}` : null;
}

export function toIri(curie) {
  if (!CURIE_PATTERN.test(curie || "")) return null;
  return `${VBO_IRI_PREFIX}${curie.slice(4)}`;
}

export function compareVboIds(left, right) {
  return left.localeCompare(right, "en", { numeric: true });
}

export function normalizeCatalogName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en")
    .replace(/\bdog\b/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function isUsableCatalogName(value) {
  const text = String(value || "").trim();
  if (!text || /[\u0080-\u009f]/u.test(text)) return false;
  const normalized = normalizeCatalogName(value);
  return !PLACEHOLDER_CATALOG_NAMES.has(normalized);
}

export function sourceDisplayName(node) {
  const preferred = (node?.meta?.synonyms || []).find(
    (synonym) => synonym.synonymType?.endsWith(MOST_COMMON_NAME_SUFFIX),
  )?.val;
  return String(isUsableCatalogName(preferred) ? preferred : node?.lbl || "")
    .replace(/ \(Dog\)$/u, "")
    .trim();
}

export function extractDogUniverse(ontology, rootId = DOG_ROOT_ID) {
  const graph = ontology?.graphs?.[0];
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("VBO artifact must contain one OBO Graph JSON graph with nodes and edges");
  }

  const rootIri = toIri(rootId);
  const nodesByIri = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodesByIri.has(rootIri)) throw new Error(`VBO root ${rootId} is missing`);

  const childrenByParent = new Map();
  const parentsByChild = new Map();
  for (const edge of graph.edges) {
    if (edge.pred !== "is_a") continue;
    if (!childrenByParent.has(edge.obj)) childrenByParent.set(edge.obj, []);
    childrenByParent.get(edge.obj).push(edge.sub);
    if (!parentsByChild.has(edge.sub)) parentsByChild.set(edge.sub, []);
    parentsByChild.get(edge.sub).push(edge.obj);
  }

  const depthByIri = new Map([[rootIri, 0]]);
  const descendants = new Set();
  const queue = [rootIri];
  while (queue.length) {
    const parent = queue.shift();
    const nextDepth = depthByIri.get(parent) + 1;
    for (const child of childrenByParent.get(parent) || []) {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
      if (!depthByIri.has(child) || depthByIri.get(child) > nextDepth) {
        depthByIri.set(child, nextDepth);
      }
    }
  }

  const entries = [...descendants]
    .map((iri) => {
      const node = nodesByIri.get(iri);
      const id = toCurie(iri);
      if (!id) throw new Error(`Dog descendant has a non-VBO id: ${iri}`);
      if (!node?.lbl) throw new Error(`Dog descendant ${id} is unlabeled`);
      return {
        id,
        iri,
        node,
        depth: depthByIri.get(iri),
        parents: (parentsByChild.get(iri) || [])
          .map(toCurie)
          .filter(Boolean)
          .filter((parentId) => parentId === rootId || descendants.has(toIri(parentId)))
          .sort(compareVboIds),
      };
    })
    .sort((left, right) => compareVboIds(left.id, right.id));

  return {
    rootId,
    entries,
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    childrenByParent,
  };
}

function exactSynonymNames(node) {
  return (node?.meta?.synonyms || [])
    .filter((synonym) => synonym.pred === "hasExactSynonym")
    .map((synonym) => String(synonym.val || "").trim())
    .filter(Boolean);
}

function sourceScore(entry) {
  const node = entry.node;
  const sourceCount = (node.meta?.basicPropertyValues || []).filter(
    (property) => property.pred === SOURCE_PREDICATE,
  ).length;
  const xrefCount = node.meta?.xrefs?.length || 0;
  const synonymCount = node.meta?.synonyms?.length || 0;
  const consolidatedNamespaceBonus = entry.id.startsWith("VBO:020") ? 5 : 0;
  return xrefCount * 1_000 + sourceCount * 100 + synonymCount * 10 + consolidatedNamespaceBonus;
}

function pairKey(left, right) {
  return [left, right].sort(compareVboIds).join("|");
}

class DisjointSet {
  constructor(ids) {
    this.parents = new Map(ids.map((id) => [id, id]));
  }

  find(id) {
    const parent = this.parents.get(id);
    if (parent === id) return id;
    const root = this.find(parent);
    this.parents.set(id, root);
    return root;
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parents.set(rightRoot, leftRoot);
  }
}

function buildAliasComponents(universe, overrides) {
  const ids = universe.entries.map((entry) => entry.id);
  const disjoint = new DisjointSet(ids);
  const exclusions = new Set(
    (overrides.classification?.reciprocalAliasExclusions || []).map(([left, right]) =>
      pairKey(left, right),
    ),
  );
  const byNormalizedName = new Map();
  const synonymsById = new Map();

  for (const entry of universe.entries) {
    const normalized = normalizeCatalogName(sourceDisplayName(entry.node));
    if (!byNormalizedName.has(normalized)) byNormalizedName.set(normalized, []);
    byNormalizedName.get(normalized).push(entry.id);
    synonymsById.set(
      entry.id,
      new Set(exactSynonymNames(entry.node).map(normalizeCatalogName).filter(Boolean)),
    );
  }

  for (const group of byNormalizedName.values()) {
    if (group.length < 2) continue;
    for (const id of group.slice(1)) disjoint.union(group[0], id);
  }

  for (let leftIndex = 0; leftIndex < universe.entries.length; leftIndex += 1) {
    const left = universe.entries[leftIndex];
    const leftName = normalizeCatalogName(sourceDisplayName(left.node));
    for (let rightIndex = leftIndex + 1; rightIndex < universe.entries.length; rightIndex += 1) {
      const right = universe.entries[rightIndex];
      if (exclusions.has(pairKey(left.id, right.id))) continue;
      const rightName = normalizeCatalogName(sourceDisplayName(right.node));
      if (
        synonymsById.get(left.id).has(rightName) &&
        synonymsById.get(right.id).has(leftName)
      ) {
        disjoint.union(left.id, right.id);
      }
    }
  }

  const components = new Map();
  for (const id of ids) {
    const root = disjoint.find(id);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(id);
  }

  const aliasTargetById = new Map();
  const decisions = overrides.classification?.decisions || {};
  const explicitlyReferencedTargets = new Set(
    Object.values(decisions)
      .filter((decision) => decision.disposition === "alias" && decision.targetId)
      .map((decision) => decision.targetId),
  );
  for (const component of components.values()) {
    if (component.length < 2) continue;
    const explicitAnchors = component.filter((id) => {
      const disposition = decisions[id]?.disposition;
      return disposition && disposition !== "alias" && disposition !== "excluded";
    });
    const referencedAnchors = component.filter(
      (id) =>
        explicitlyReferencedTargets.has(id) &&
        decisions[id]?.disposition !== "alias" &&
        decisions[id]?.disposition !== "excluded",
    );
    const candidates =
      explicitAnchors.length === 1
        ? explicitAnchors
        : referencedAnchors.length
          ? referencedAnchors
          : component;
    const targetId = [...candidates].sort((left, right) => {
      const scoreDifference = sourceScore(universe.byId.get(right)) - sourceScore(universe.byId.get(left));
      return scoreDifference || compareVboIds(left, right);
    })[0];
    for (const id of component) {
      if (id !== targetId) aliasTargetById.set(id, targetId);
    }
  }
  return aliasTargetById;
}

function descendantIds(universe, ancestorId) {
  const ancestorIri = toIri(ancestorId);
  const descendants = new Set();
  const queue = [ancestorIri];
  while (queue.length) {
    for (const childIri of universe.childrenByParent.get(queue.shift()) || []) {
      const childId = toCurie(childIri);
      if (!universe.byId.has(childId) || descendants.has(childId)) continue;
      descendants.add(childId);
      queue.push(childIri);
    }
  }
  return descendants;
}

function explicitDecisionRow(entry, decision, reviewedAt) {
  const disposition = decision.disposition;
  return {
    vboId: entry.id,
    sourceLabel: entry.node.lbl,
    sourceDepth: entry.depth,
    sourceParents: entry.parents,
    disposition,
    ...(decision.targetId ? { targetId: decision.targetId } : {}),
    ...(decision.parentId ? { parentId: decision.parentId } : {}),
    selectable:
      typeof decision.selectable === "boolean"
        ? decision.selectable
        : SELECTABLE_DISPOSITIONS.has(disposition),
    reasonCode: decision.reasonCode,
    reviewedAt,
  };
}

export function buildClassification(ontology, metadata, overrides) {
  const universe = extractDogUniverse(ontology, metadata.rootId);
  const decisions = overrides.classification?.decisions || {};
  const aliasTargetById = buildAliasComponents(universe, overrides);
  const mixedBreedDescendants = descendantIds(universe, MIXED_BREED_ID);
  const rows = [];

  for (const entry of universe.entries) {
    const explicit = decisions[entry.id];
    if (explicit) {
      rows.push(explicitDecisionRow(entry, explicit, metadata.verifiedAt));
      continue;
    }

    const aliasTargetId = aliasTargetById.get(entry.id);
    if (aliasTargetId) {
      rows.push(
        explicitDecisionRow(
          entry,
          {
            disposition: "alias",
            targetId: aliasTargetId,
            reasonCode: "vbo_exact_synonym_cluster",
          },
          metadata.verifiedAt,
        ),
      );
      continue;
    }

    if (mixedBreedDescendants.has(entry.id)) {
      rows.push(
        explicitDecisionRow(
          entry,
          {
            disposition: "crossbreed",
            parentId: MIXED_BREED_ID,
            reasonCode: "vbo_mixed_breed_descendant",
          },
          metadata.verifiedAt,
        ),
      );
      continue;
    }

    if (entry.depth > 1) {
      rows.push(
        explicitDecisionRow(
          entry,
          {
            disposition: "variety",
            parentId: entry.parents[0],
            reasonCode: "vbo_nested_breed_concept",
          },
          metadata.verifiedAt,
        ),
      );
      continue;
    }

    rows.push(
      explicitDecisionRow(
        entry,
        { disposition: "canonical", reasonCode: "vbo_direct_dog_breed" },
        metadata.verifiedAt,
      ),
    );
  }

  const rowsById = new Map(rows.map((row) => [row.vboId, row]));
  const resolveAlias = (id, seen = new Set()) => {
    const row = rowsById.get(id);
    if (row?.disposition !== "alias") return id;
    if (seen.has(id)) return id;
    seen.add(id);
    return resolveAlias(row.targetId, seen);
  };
  for (const row of rows) {
    if (row.disposition === "alias") row.targetId = resolveAlias(row.targetId);
    if (row.parentId) row.parentId = resolveAlias(row.parentId);
  }

  return {
    schemaVersion: CLASSIFICATION_SCHEMA_VERSION,
    source: {
      release: metadata.release,
      rootId: metadata.rootId,
      sha256: metadata.sha256,
      expectedLabeledDescendants: metadata.expectedLabeledDescendants,
    },
    reviewedAt: metadata.verifiedAt,
    terms: rows,
  };
}

function uniqueSortedStrings(values) {
  const byNormalized = new Map();
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed) continue;
    const key = normalizeCatalogName(trimmed) || trimmed.toLocaleLowerCase("en");
    if (!byNormalized.has(key)) byNormalized.set(key, trimmed);
  }
  return [...byNormalized.values()].sort((left, right) => left.localeCompare(right, "en"));
}

function registryRefsForEntries(entries) {
  return uniqueSortedStrings(
    entries.flatMap((entry) => (entry.node.meta?.xrefs || []).map((xref) => xref.val)),
  );
}

function aliasesForEntries(entries, displayName, entityId, preferredOwnerByName) {
  const displayKey = normalizeCatalogName(displayName);
  return uniqueSortedStrings(
    entries.flatMap((entry) => [
      sourceDisplayName(entry.node),
      entry.node.lbl.replace(/ \(Dog\)$/u, ""),
      ...exactSynonymNames(entry.node),
    ]),
  ).filter((alias) => {
    const normalized = normalizeCatalogName(alias);
    const preferredOwner = preferredOwnerByName.get(normalized);
    return (
      isUsableCatalogName(alias) &&
      normalized !== displayKey &&
      (!preferredOwner || preferredOwner === entityId)
    );
  });
}

export function buildRuntimeCatalog(ontology, metadata, overrides, classification) {
  const universe = extractDogUniverse(ontology, metadata.rootId);
  const sourceIdsByTarget = new Map();

  for (const row of classification.terms) {
    if (row.disposition !== "alias") continue;
    if (!sourceIdsByTarget.has(row.targetId)) sourceIdsByTarget.set(row.targetId, []);
    sourceIdsByTarget.get(row.targetId).push(row.vboId);
  }

  const selectableRows = classification.terms.filter(
    (row) => row.selectable && SELECTABLE_DISPOSITIONS.has(row.disposition),
  );
  const displayNameById = new Map(
    selectableRows.map((row) => {
      const override = overrides.entities?.[row.vboId] || {};
      const ownEntry = universe.byId.get(row.vboId);
      return [row.vboId, override.displayName || sourceDisplayName(ownEntry.node)];
    }),
  );
  const preferredOwnerByName = new Map();
  for (const [id, displayName] of displayNameById) {
    preferredOwnerByName.set(normalizeCatalogName(displayName), id);
  }
  for (const row of classification.terms.filter((term) => term.disposition === "alias")) {
    const source = universe.byId.get(row.vboId);
    for (const name of [sourceDisplayName(source.node), source.node.lbl.replace(/ \(Dog\)$/u, "")]) {
      const normalized = normalizeCatalogName(name);
      if (!preferredOwnerByName.has(normalized)) preferredOwnerByName.set(normalized, row.targetId);
    }
  }
  for (const [name, ownerId] of Object.entries(overrides.searchAliasOwners || {})) {
    preferredOwnerByName.set(normalizeCatalogName(name), ownerId);
  }

  const entities = selectableRows
    .map((row) => {
      const override = overrides.entities?.[row.vboId] || {};
      const sourceIds = [row.vboId, ...(sourceIdsByTarget.get(row.vboId) || [])].sort(compareVboIds);
      const sourceEntries = sourceIds.map((id) => universe.byId.get(id)).filter(Boolean);
      const ownEntry = universe.byId.get(row.vboId);
      const displayName = displayNameById.get(row.vboId);
      return {
        id: row.vboId,
        displayName,
        entityType: "dog",
        status: row.disposition,
        selectable: true,
        promoted: override.promoted === true,
        aliases: aliasesForEntries(
          sourceEntries,
          displayName,
          row.vboId,
          preferredOwnerByName,
        ),
        sourceIds,
        registryRefs: registryRefsForEntries(sourceEntries),
        relationships: {
          ...(row.parentId ? { parentId: row.parentId } : {}),
          relatedIds: uniqueSortedStrings(override.relatedIds || []).sort(compareVboIds),
        },
        originRegions: uniqueSortedStrings(override.originRegions || []),
        tags: uniqueSortedStrings(override.tags || []),
        primaryImageAssetId: override.primaryImageAssetId || null,
      };
    })
    .sort((left, right) => compareVboIds(left.id, right.id));

  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    catalogId: CATALOG_ID,
    catalogVersion: CATALOG_VERSION,
    source: {
      name: metadata.name,
      release: metadata.release,
      artifactUrl: metadata.artifactUrl,
      sha256: metadata.sha256,
      license: metadata.license,
      licenseUrl: metadata.licenseUrl,
      retrievedAt: metadata.retrievedAt,
      rootId: metadata.rootId,
      descendantCount: metadata.expectedLabeledDescendants,
    },
    entities,
  };
}

function countBy(values, keyForValue) {
  const counts = {};
  for (const value of values) {
    const key = keyForValue(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function buildCoverageReport(metadata, classification, catalog, sourceHashVerified) {
  const catalogJson = stableJson(catalog);
  const recordBytes = catalog.entities.map((entity) => Buffer.byteLength(JSON.stringify(entity)));
  const excludedTerms = classification.terms
    .filter((term) => term.disposition === "excluded")
    .map(({ vboId, sourceLabel, reasonCode }) => ({ vboId, sourceLabel, reasonCode }));
  const historicalTerms = classification.terms
    .filter((term) => term.disposition === "historical")
    .map(({ vboId, sourceLabel }) => ({ vboId, sourceLabel }));

  return {
    schemaVersion: 1,
    catalogVersion: catalog.catalogVersion,
    source: {
      release: metadata.release,
      rootId: metadata.rootId,
      sha256: metadata.sha256,
      hashVerified: sourceHashVerified,
    },
    sourceTermCount: metadata.expectedLabeledDescendants,
    classifiedTermCount: classification.terms.length,
    unclassifiedTermCount: metadata.expectedLabeledDescendants - classification.terms.length,
    dispositionCounts: countBy(classification.terms, (term) => term.disposition),
    reasonCodeCounts: countBy(classification.terms, (term) => term.reasonCode),
    sourceDepthCounts: countBy(classification.terms, (term) => String(term.sourceDepth)),
    selectableEntityCount: catalog.entities.filter((entity) => entity.selectable).length,
    runtimeEntityCount: catalog.entities.length,
    runtimeBytes: Buffer.byteLength(catalogJson),
    largestRecordBytes: Math.max(...recordBytes),
    payloadLimits: {
      runtimeBytes: MAX_RUNTIME_BYTES,
      recordBytes: MAX_RECORD_BYTES,
    },
    excludedTerms,
    historicalTerms,
    checks: {
      allSourceTermsClassified:
        classification.terms.length === metadata.expectedLabeledDescendants,
      exactlyOneDispositionPerSourceTerm: true,
      aliasTargetsResolved: true,
      relationshipCyclesAbsent: true,
      generatedDeterministically: true,
    },
  };
}

export function buildClassificationReview(metadata, classification, catalog) {
  const termsById = new Map(classification.terms.map((term) => [term.vboId, term]));
  const sourceName = (id) =>
    String(termsById.get(id)?.sourceLabel || "")
      .replace(/ \(Dog\)$/u, "")
      .trim();
  const aliasDecisions = classification.terms
    .filter((term) => term.disposition === "alias")
    .map((term) => ({
      vboId: term.vboId,
      sourceLabel: term.sourceLabel,
      targetId: term.targetId,
      targetLabel: sourceName(term.targetId),
      reasonCode: term.reasonCode,
    }));
  const varietyDecisions = classification.terms
    .filter((term) => term.disposition === "variety")
    .map((term) => ({
      vboId: term.vboId,
      sourceLabel: term.sourceLabel,
      parentId: term.parentId,
      parentLabel: sourceName(term.parentId),
      reasonCode: term.reasonCode,
    }));
  const crossbreedDecisions = classification.terms
    .filter((term) => term.disposition === "crossbreed")
    .map(({ vboId, sourceLabel, parentId, reasonCode }) => ({
      vboId,
      sourceLabel,
      parentId,
      reasonCode,
    }));
  const historicalDecisions = classification.terms
    .filter((term) => term.disposition === "historical")
    .map(({ vboId, sourceLabel, reasonCode }) => ({ vboId, sourceLabel, reasonCode }));
  const excludedDecisions = classification.terms
    .filter((term) => term.disposition === "excluded")
    .map(({ vboId, sourceLabel, reasonCode }) => ({ vboId, sourceLabel, reasonCode }));
  const regionalLandraceCandidates = classification.terms
    .filter(
      (term) =>
        term.selectable &&
        /^VBO:000\d{4}$/u.test(term.vboId) &&
        /, .+ \(Dog\)$/u.test(term.sourceLabel),
    )
    .map(({ vboId, sourceLabel, disposition, reasonCode }) => ({
      vboId,
      sourceLabel,
      disposition,
      reasonCode,
    }));

  const searchNames = new Map();
  for (const entity of catalog.entities) {
    for (const name of [entity.displayName, ...entity.aliases]) {
      const normalized = normalizeCatalogName(name);
      if (normalized.length < 3) continue;
      if (!searchNames.has(normalized)) {
        searchNames.set(normalized, { names: new Set(), entityIds: new Set() });
      }
      searchNames.get(normalized).names.add(name);
      searchNames.get(normalized).entityIds.add(entity.id);
    }
  }
  const ambiguousSearchNames = [...searchNames.entries()]
    .filter(([, value]) => value.entityIds.size > 1)
    .map(([normalizedName, value]) => ({
      normalizedName,
      names: [...value.names].sort((left, right) => left.localeCompare(right, "en")),
      entityIds: [...value.entityIds].sort(compareVboIds),
      reasonCode: "retained_shared_or_ambiguous_synonym",
    }))
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName, "en"));

  return {
    schemaVersion: 1,
    catalogVersion: CATALOG_VERSION,
    source: {
      release: metadata.release,
      rootId: metadata.rootId,
      sha256: metadata.sha256,
    },
    reviewedAt: classification.reviewedAt,
    summary: {
      aliasDecisions: aliasDecisions.length,
      varietyDecisions: varietyDecisions.length,
      crossbreedDecisions: crossbreedDecisions.length,
      historicalDecisions: historicalDecisions.length,
      excludedDecisions: excludedDecisions.length,
      regionalLandraceCandidates: regionalLandraceCandidates.length,
      ambiguousSearchNamesRetained: ambiguousSearchNames.length,
    },
    aliasDecisions,
    varietyDecisions,
    crossbreedDecisions,
    historicalDecisions,
    excludedDecisions,
    regionalLandraceCandidates,
    ambiguousSearchNames,
  };
}

function unexpectedKeys(value, allowedKeys) {
  return Object.keys(value || {}).filter((key) => !allowedKeys.has(key));
}

function pushUnexpectedKeys(errors, value, allowedKeys, context) {
  const unexpected = unexpectedKeys(value, allowedKeys);
  if (unexpected.length) errors.push(`${context} has unsupported fields: ${unexpected.join(", ")}`);
}

function validateOverrides(overrides, universe, errors) {
  pushUnexpectedKeys(
    errors,
    overrides,
    new Set([
      "schemaVersion",
      "classification",
      "entities",
      "searchAliasOwners",
      "normalizedDisplayNameExceptions",
    ]),
    "catalog-overrides.json",
  );
  if (overrides.schemaVersion !== 1) errors.push("catalog-overrides.json schemaVersion must be 1");
  pushUnexpectedKeys(
    errors,
    overrides.classification || {},
    new Set(["reciprocalAliasExclusions", "decisions"]),
    "catalog-overrides.json classification",
  );
  for (const [id, decision] of Object.entries(overrides.classification?.decisions || {})) {
    if (!universe.byId.has(id)) errors.push(`Classification override references unknown ${id}`);
    pushUnexpectedKeys(
      errors,
      decision,
      new Set(["disposition", "targetId", "parentId", "selectable", "reasonCode"]),
      `Classification override ${id}`,
    );
  }
  for (const [id, override] of Object.entries(overrides.entities || {})) {
    if (!universe.byId.has(id)) errors.push(`Entity override references unknown ${id}`);
    pushUnexpectedKeys(
      errors,
      override,
      new Set([
        "displayName",
        "promoted",
        "primaryImageAssetId",
        "originRegions",
        "tags",
        "relatedIds",
      ]),
      `Entity override ${id}`,
    );
  }
  for (const [name, ownerId] of Object.entries(overrides.searchAliasOwners || {})) {
    if (!name.trim()) errors.push("searchAliasOwners contains an empty search name");
    if (!universe.byId.has(ownerId)) {
      errors.push(`searchAliasOwners references unknown ${ownerId}`);
    }
  }
}

function detectDirectedCycle(ids, nextIdsForId) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (id, path) => {
    if (visiting.has(id)) return [...path, id];
    if (visited.has(id)) return null;
    visiting.add(id);
    for (const nextId of nextIdsForId(id)) {
      const cycle = visit(nextId, [...path, id]);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  };
  for (const id of ids) {
    const cycle = visit(id, []);
    if (cycle) return cycle;
  }
  return null;
}

export function validateCatalogSystem({
  sourceBuffer,
  ontology,
  metadata,
  overrides,
  classification,
  catalog,
  coverage,
  review,
}) {
  const errors = [];
  const sourceHash = sha256(sourceBuffer);
  if (sourceHash !== metadata.sha256) {
    errors.push(`VBO SHA-256 mismatch: expected ${metadata.sha256}, got ${sourceHash}`);
  }
  if (sourceBuffer.length !== metadata.byteLength) {
    errors.push(`VBO byte length mismatch: expected ${metadata.byteLength}, got ${sourceBuffer.length}`);
  }

  let universe;
  try {
    universe = extractDogUniverse(ontology, metadata.rootId);
  } catch (error) {
    errors.push(error.message);
    return errors;
  }
  if (universe.entries.length !== metadata.expectedLabeledDescendants) {
    errors.push(
      `VBO descendant count mismatch: expected ${metadata.expectedLabeledDescendants}, got ${universe.entries.length}`,
    );
  }
  validateOverrides(overrides, universe, errors);

  pushUnexpectedKeys(
    errors,
    classification,
    new Set(["schemaVersion", "source", "reviewedAt", "terms"]),
    "classification.json",
  );
  if (classification.schemaVersion !== CLASSIFICATION_SCHEMA_VERSION) {
    errors.push(`classification.json schemaVersion must be ${CLASSIFICATION_SCHEMA_VERSION}`);
  }
  const terms = Array.isArray(classification.terms) ? classification.terms : [];
  const termsById = new Map();
  for (const term of terms) {
    pushUnexpectedKeys(
      errors,
      term,
      new Set([
        "vboId",
        "sourceLabel",
        "sourceDepth",
        "sourceParents",
        "disposition",
        "targetId",
        "parentId",
        "selectable",
        "reasonCode",
        "reviewedAt",
      ]),
      `Classification ${term.vboId || "<missing id>"}`,
    );
    if (termsById.has(term.vboId)) errors.push(`Duplicate classification for ${term.vboId}`);
    termsById.set(term.vboId, term);
    const source = universe.byId.get(term.vboId);
    if (!source) {
      errors.push(`Classification includes non-descendant ${term.vboId}`);
      continue;
    }
    if (term.sourceLabel !== source.node.lbl) errors.push(`Source label drift for ${term.vboId}`);
    if (term.sourceDepth !== source.depth) errors.push(`Source depth drift for ${term.vboId}`);
    if (JSON.stringify(term.sourceParents) !== JSON.stringify(source.parents)) {
      errors.push(`Source parents drift for ${term.vboId}`);
    }
    if (!DISPOSITIONS.includes(term.disposition)) {
      errors.push(`Invalid disposition ${term.disposition} for ${term.vboId}`);
    }
    if (!term.reasonCode || !/^[a-z0-9_]+$/u.test(term.reasonCode)) {
      errors.push(`Invalid reasonCode for ${term.vboId}`);
    }
    if (term.reviewedAt !== classification.reviewedAt) {
      errors.push(`Review date drift for ${term.vboId}`);
    }
    if (term.disposition === "alias") {
      if (!CURIE_PATTERN.test(term.targetId || "")) errors.push(`Alias ${term.vboId} has no valid targetId`);
      if (term.parentId) errors.push(`Alias ${term.vboId} must not have parentId`);
      if (term.selectable) errors.push(`Alias ${term.vboId} must not be selectable`);
    } else if (term.targetId) {
      errors.push(`${term.vboId} has targetId but is not an alias`);
    }
    if (["variety", "crossbreed"].includes(term.disposition) && !term.parentId) {
      errors.push(`${term.disposition} ${term.vboId} requires parentId`);
    }
    if (["excluded", "alias"].includes(term.disposition) && term.selectable) {
      errors.push(`${term.disposition} ${term.vboId} must not be selectable`);
    }
    if (SELECTABLE_DISPOSITIONS.has(term.disposition) && !term.selectable) {
      errors.push(`${term.disposition} ${term.vboId} must be selectable`);
    }
  }
  for (const source of universe.entries) {
    if (!termsById.has(source.id)) errors.push(`Unclassified VBO descendant ${source.id}`);
  }
  if (terms.length !== universe.entries.length) {
    errors.push(`Classification has ${terms.length} rows for ${universe.entries.length} descendants`);
  }
  for (const [name, ownerId] of Object.entries(overrides.searchAliasOwners || {})) {
    if (!termsById.get(ownerId)?.selectable) {
      errors.push(`searchAliasOwners maps ${JSON.stringify(name)} to nonselectable ${ownerId}`);
    }
  }

  for (const term of terms) {
    if (term.targetId) {
      const target = termsById.get(term.targetId);
      if (!target) errors.push(`Alias ${term.vboId} points to missing ${term.targetId}`);
      else if (target.disposition === "alias") errors.push(`Alias ${term.vboId} points to alias ${term.targetId}`);
      else if (!target.selectable) errors.push(`Alias ${term.vboId} points to nonselectable ${term.targetId}`);
    }
    if (term.parentId) {
      const parent = termsById.get(term.parentId);
      if (!parent) errors.push(`${term.vboId} points to missing parent ${term.parentId}`);
      else if (!parent.selectable) errors.push(`${term.vboId} points to nonselectable parent ${term.parentId}`);
    }
  }

  const aliasCycle = detectDirectedCycle(
    terms.filter((term) => term.disposition === "alias").map((term) => term.vboId),
    (id) => {
      const target = termsById.get(id)?.targetId;
      return target && termsById.get(target)?.disposition === "alias" ? [target] : [];
    },
  );
  if (aliasCycle) errors.push(`Alias cycle: ${aliasCycle.join(" -> ")}`);
  const parentCycle = detectDirectedCycle(
    terms.filter((term) => term.selectable).map((term) => term.vboId),
    (id) => {
      const parentId = termsById.get(id)?.parentId;
      return parentId ? [parentId] : [];
    },
  );
  if (parentCycle) errors.push(`Parent relationship cycle: ${parentCycle.join(" -> ")}`);

  pushUnexpectedKeys(
    errors,
    catalog,
    new Set(["schemaVersion", "catalogId", "catalogVersion", "source", "entities"]),
    "dog-catalog.json",
  );
  if (catalog.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    errors.push(`dog-catalog.json schemaVersion must be ${CATALOG_SCHEMA_VERSION}`);
  }
  if (catalog.catalogId !== CATALOG_ID) errors.push(`dog-catalog.json catalogId must be ${CATALOG_ID}`);
  if (catalog.catalogVersion !== CATALOG_VERSION) {
    errors.push(`dog-catalog.json catalogVersion must be ${CATALOG_VERSION}`);
  }
  const entities = Array.isArray(catalog.entities) ? catalog.entities : [];
  const entitiesById = new Map();
  const namesByNormalized = new Map();
  const duplicateExceptions = new Set(
    (overrides.normalizedDisplayNameExceptions || []).map(([left, right]) => pairKey(left, right)),
  );
  for (const entity of entities) {
    pushUnexpectedKeys(
      errors,
      entity,
      new Set([
        "id",
        "displayName",
        "entityType",
        "status",
        "selectable",
        "promoted",
        "aliases",
        "sourceIds",
        "registryRefs",
        "relationships",
        "originRegions",
        "tags",
        "primaryImageAssetId",
      ]),
      `Catalog entity ${entity.id || "<missing id>"}`,
    );
    if (entitiesById.has(entity.id)) errors.push(`Duplicate catalog identity ${entity.id}`);
    entitiesById.set(entity.id, entity);
    if (!CURIE_PATTERN.test(entity.id || "")) errors.push(`Invalid catalog identity ${entity.id}`);
    if (!entity.displayName?.trim()) errors.push(`Catalog entity ${entity.id} is missing displayName`);
    if (entity.displayName?.trim() && !isUsableCatalogName(entity.displayName)) {
      errors.push(`Catalog entity ${entity.id} uses placeholder displayName ${entity.displayName}`);
    }
    if (entity.entityType !== "dog") errors.push(`Catalog entity ${entity.id} must have entityType dog`);
    if (!SELECTABLE_DISPOSITIONS.has(entity.status)) errors.push(`Catalog entity ${entity.id} has invalid status`);
    if (entity.selectable !== true) errors.push(`Runtime catalog entity ${entity.id} must be selectable`);
    if (!Array.isArray(entity.sourceIds) || !entity.sourceIds.includes(entity.id)) {
      errors.push(`Catalog entity ${entity.id} must preserve its VBO source id`);
    }
    for (const alias of entity.aliases || []) {
      if (!isUsableCatalogName(alias)) {
        errors.push(`Catalog entity ${entity.id} uses placeholder alias ${alias}`);
      }
    }
    if (
      entity.primaryImageAssetId !== null &&
      !/^dogs:photo:[a-z0-9_-]+:[a-f0-9]{12,64}$/u.test(entity.primaryImageAssetId || "")
    ) {
      errors.push(`Catalog entity ${entity.id} has invalid primaryImageAssetId`);
    }
    const normalizedName = normalizeCatalogName(entity.displayName);
    const previousId = namesByNormalized.get(normalizedName);
    if (previousId && !duplicateExceptions.has(pairKey(previousId, entity.id))) {
      errors.push(`Duplicate normalized display name for ${previousId} and ${entity.id}`);
    }
    namesByNormalized.set(normalizedName, entity.id);
    if (Buffer.byteLength(JSON.stringify(entity)) > MAX_RECORD_BYTES) {
      errors.push(`Catalog entity ${entity.id} exceeds ${MAX_RECORD_BYTES} bytes`);
    }
  }
  for (const entity of entities) {
    const parentId = entity.relationships?.parentId;
    if (parentId && !entitiesById.has(parentId)) {
      errors.push(`Catalog entity ${entity.id} references missing parent ${parentId}`);
    }
    for (const relatedId of entity.relationships?.relatedIds || []) {
      if (!entitiesById.has(relatedId)) {
        errors.push(`Catalog entity ${entity.id} references missing related entity ${relatedId}`);
      }
    }
  }
  const catalogParentCycle = detectDirectedCycle(
    [...entitiesById.keys()],
    (id) => {
      const parentId = entitiesById.get(id)?.relationships?.parentId;
      return parentId ? [parentId] : [];
    },
  );
  if (catalogParentCycle) errors.push(`Runtime parent cycle: ${catalogParentCycle.join(" -> ")}`);

  const runtimeBytes = Buffer.byteLength(stableJson(catalog));
  if (runtimeBytes > MAX_RUNTIME_BYTES) {
    errors.push(`Runtime catalog is ${runtimeBytes} bytes; limit is ${MAX_RUNTIME_BYTES}`);
  }
  const expectedCatalog = buildRuntimeCatalog(ontology, metadata, overrides, classification);
  if (stableJson(expectedCatalog) !== stableJson(catalog)) {
    errors.push("dog-catalog.json does not match deterministic compiler output");
  }
  const expectedCoverage = buildCoverageReport(metadata, classification, catalog, sourceHash === metadata.sha256);
  if (stableJson(expectedCoverage) !== stableJson(coverage)) {
    errors.push("coverage-report.json does not match deterministic compiler output");
  }
  const expectedReview = buildClassificationReview(metadata, classification, catalog);
  if (review && stableJson(expectedReview) !== stableJson(review)) {
    errors.push("classification-review.json does not match deterministic compiler output");
  }
  return errors;
}
