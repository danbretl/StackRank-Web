import {
  normalizeEntityRef,
  normalizeEntitySnapshot,
} from "./entity.js?v=1";

const FACET_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

const cleanText = (value) => String(value || "").trim();

export function normalizeCatalogSearchText(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const normalizeStringList = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string")
    .map(cleanText)
    .filter((value) => {
      const key = normalizeCatalogSearchText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeFacets = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.freeze(Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => FACET_KEY_PATTERN.test(key))
      .map(([key, values]) => [
        key,
        Object.freeze(normalizeStringList(Array.isArray(values) ? values : [values])),
      ])
      .filter(([, values]) => values.length),
  ));
};

export function validateCatalogVersion(
  catalog,
  {
    supportedSchemaVersions = [1],
    expectedCatalogId = null,
    expectedCatalogVersion = null,
  } = {},
) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    return { valid: false, reason: "invalid-catalog" };
  }
  const schemaVersion = catalog.schemaVersion;
  const allowedSchemaVersions = Array.isArray(supportedSchemaVersions)
    ? supportedSchemaVersions
    : [];
  if (!allowedSchemaVersions.includes(schemaVersion)) {
    return { valid: false, reason: "unsupported-schema-version", schemaVersion };
  }
  const catalogId = typeof catalog.catalogId === "string" ? cleanText(catalog.catalogId) : "";
  const catalogVersion = typeof catalog.catalogVersion === "string"
    ? cleanText(catalog.catalogVersion)
    : "";
  if (!catalogId || !catalogVersion) {
    return { valid: false, reason: "missing-catalog-identity", schemaVersion };
  }
  if (expectedCatalogId && catalogId !== expectedCatalogId) {
    return { valid: false, reason: "catalog-id-mismatch", schemaVersion, catalogId, catalogVersion };
  }
  if (expectedCatalogVersion && catalogVersion !== expectedCatalogVersion) {
    return { valid: false, reason: "catalog-version-mismatch", schemaVersion, catalogId, catalogVersion };
  }
  return { valid: true, reason: "valid", schemaVersion, catalogId, catalogVersion };
}

const defaultRecords = (catalog) => catalog?.entities;
const defaultEntityRef = (record, adapter) => record?.entityRef || {
  domain: adapter?.domain,
  type: adapter?.entityType || record?.entityType,
  source: adapter?.source,
  id: record?.id,
};
const defaultSnapshot = (record) => record?.snapshot || {
  primaryText: record?.displayName,
  secondaryText: record?.secondaryText,
  year: record?.year,
  image: record?.image,
};

export function normalizeCatalog(catalog, adapter = {}, versionOptions = {}) {
  const version = validateCatalogVersion(catalog, versionOptions);
  if (!version.valid) return { ...version, items: Object.freeze([]), rejectedCount: 0 };

  const records = (adapter.getRecords || defaultRecords)(catalog);
  if (!Array.isArray(records)) {
    return { ...version, valid: false, reason: "missing-catalog-records", items: Object.freeze([]), rejectedCount: 0 };
  }

  const items = [];
  const seen = new Set();
  const expectedDomain = cleanText(adapter.domain).toLowerCase();
  const expectedEntityType = cleanText(adapter.entityType).toLowerCase();
  const expectedSource = cleanText(adapter.source).toLowerCase();
  let rejectedCount = 0;
  records.forEach((record) => {
    const entityRef = normalizeEntityRef(
      (adapter.getEntityRef || defaultEntityRef)(record, adapter),
    );
    const snapshot = normalizeEntitySnapshot(
      (adapter.getSnapshot || defaultSnapshot)(record, adapter),
    );
    const aliases = normalizeStringList(
      (adapter.getAliases || ((value) => value?.aliases))(record),
    );
    const rawStatus = (adapter.getStatus || ((value) => value?.status))(record);
    const status = typeof rawStatus === "string" ? cleanText(rawStatus).toLowerCase() : "";
    const selectable = (adapter.isSelectable || ((value) => value?.selectable))(record) === true;
    const key = entityRef
      ? `${entityRef.domain}:${entityRef.type}:${entityRef.source}:${entityRef.id}`
      : "";
    const adapterIdentityMismatch = Boolean(
      entityRef && (
        (expectedDomain && entityRef.domain !== expectedDomain) ||
        (expectedEntityType && entityRef.type !== expectedEntityType) ||
        (expectedSource && entityRef.source !== expectedSource)
      )
    );
    if (!entityRef || adapterIdentityMismatch || !snapshot || !status || !key || seen.has(key)) {
      rejectedCount += 1;
      return;
    }
    seen.add(key);
    const facets = normalizeFacets(
      (adapter.getFacets || ((value) => value?.facets))(record),
    );
    items.push(Object.freeze({
      entityRef: Object.freeze(entityRef),
      snapshot: Object.freeze({
        ...snapshot,
        image: Object.freeze(snapshot.image),
      }),
      aliases: Object.freeze(aliases),
      status,
      selectable,
      facets,
    }));
  });

  return {
    ...version,
    items: Object.freeze(items),
    rejectedCount,
  };
}

export function buildCatalogIndex(normalizedCatalog) {
  const items = normalizedCatalog?.valid && Array.isArray(normalizedCatalog.items)
    ? normalizedCatalog.items
    : [];
  const entries = items.map((item, order) => {
    const primary = normalizeCatalogSearchText(item.snapshot.primaryText);
    const aliases = item.aliases.map((alias) => ({
      raw: alias,
      normalized: normalizeCatalogSearchText(alias),
    }));
    return Object.freeze({ item, order, primary, aliases });
  });
  return Object.freeze({
    catalogId: normalizedCatalog?.catalogId || "",
    catalogVersion: normalizedCatalog?.catalogVersion || "",
    entries: Object.freeze(entries),
  });
}

const matchesFacets = (item, facets) => {
  if (!facets || typeof facets !== "object" || Array.isArray(facets)) return true;
  return Object.entries(facets).every(([key, requested]) => {
    const needles = normalizeStringList(Array.isArray(requested) ? requested : [requested])
      .map(normalizeCatalogSearchText);
    if (!needles.length) return true;
    const values = (item.facets[key] || []).map(normalizeCatalogSearchText);
    return needles.some((needle) => values.includes(needle));
  });
};

const matchEntry = (entry, query) => {
  if (!query) return { score: 5, matchedOn: "browse", matchedText: "" };
  if (entry.primary === query) return { score: 0, matchedOn: "primary", matchedText: entry.item.snapshot.primaryText };
  const exactAlias = entry.aliases.find(({ normalized }) => normalized === query);
  if (exactAlias) return { score: 1, matchedOn: "alias", matchedText: exactAlias.raw };
  if (entry.primary.startsWith(query)) return { score: 2, matchedOn: "primary", matchedText: entry.item.snapshot.primaryText };
  const prefixAlias = entry.aliases.find(({ normalized }) => normalized.startsWith(query));
  if (prefixAlias) return { score: 3, matchedOn: "alias", matchedText: prefixAlias.raw };
  if (entry.primary.includes(query)) return { score: 4, matchedOn: "primary", matchedText: entry.item.snapshot.primaryText };
  const partialAlias = entry.aliases.find(({ normalized }) => normalized.includes(query));
  return partialAlias
    ? { score: 5, matchedOn: "alias", matchedText: partialAlias.raw }
    : null;
};

export function searchCatalog(index, query = "", { limit = 12, facets = {}, selectableOnly = true } = {}) {
  const count = Number.isInteger(limit) ? Math.max(0, Math.min(limit, 100)) : 12;
  if (!count || !index || !Array.isArray(index.entries)) return [];
  const normalizedQuery = normalizeCatalogSearchText(query);
  return index.entries
    .filter(({ item }) => (!selectableOnly || item.selectable) && matchesFacets(item, facets))
    .map((entry) => ({ entry, match: matchEntry(entry, normalizedQuery) }))
    .filter(({ match }) => match)
    .sort((a, b) => a.match.score - b.match.score || a.entry.order - b.entry.order)
    .slice(0, count)
    .map(({ entry, match }) => Object.freeze({ item: entry.item, ...match }));
}

export function catalogFacetValues(index, facet) {
  if (!FACET_KEY_PATTERN.test(String(facet || "")) || !Array.isArray(index?.entries)) return [];
  const counts = new Map();
  index.entries.forEach(({ item }) => {
    (item.facets[facet] || []).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
}
