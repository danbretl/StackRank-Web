#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PACK_SCHEMA_VERSION = 1;
export const MIN_PACKS = 35;
export const MIN_PACK_ITEMS = 8;
export const MAX_PACK_ITEMS = 14;
export const MIN_UNIQUE_ITEMS = 200;
export const MAX_ITEM_APPEARANCES = 6;
export const MAX_PAIRWISE_JACCARD = 0.6;

export const PACK_FAMILIES = Object.freeze([
  "gateway",
  "sporting",
  "hound",
  "working",
  "terrier",
  "toy-companion",
  "non-sporting",
  "herding",
  "sighthound",
  "scent-hound",
  "spitz-primitive",
  "livestock-guardian",
  "water-dog",
  "giant",
  "coat-silhouette",
  "regional-history",
  "crossbreed",
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "catalogId",
  "catalogVersion",
  "editorialVersion",
  "updatedAt",
  "sources",
  "packs",
]);
const ALLOWED_SOURCE_KEYS = new Set(["id", "label", "url", "retrievedAt"]);
const ALLOWED_PACK_KEYS = new Set([
  "id",
  "title",
  "subtitle",
  "description",
  "family",
  "placements",
  "promoted",
  "diversityRegions",
  "schemeAttribution",
  "crossbreedDisclosure",
  "items",
]);
const ALLOWED_SCHEME_KEYS = new Set(["sourceId", "label", "note"]);
const ALLOWED_PLACEMENTS = new Set(["starter", "featured", "browse"]);
const SELECTABLE_STATUSES = new Set(["canonical", "variety", "crossbreed", "historical"]);
const UNSAFE_COPY_PATTERNS = [
  /\bbest (?:dog|breed|with|for)\b/i,
  /\bfamily[- ]friendly\b/i,
  /\bkid[- ]friendly\b/i,
  /\bgood with children\b/i,
  /\bapartment[- ]friendly\b/i,
  /\bhypoallergenic\b/i,
  /\baggressiv(?:e|eness)\b/i,
  /\bsmartest\b/i,
  /\beasy to train\b/i,
  /\blow maintenance\b/i,
  /\b(?:healthiest|lifespan|exercise needs?|temperament score)\b/i,
  /\bsafe (?:with|for|around)\b/i,
];

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value) => String(value || "").trim();
const normalizedText = (value) => cleanText(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(cleanText(value));
const isUrl = (value) => {
  try {
    const url = new URL(cleanText(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_error) {
    return false;
  }
};

const validateKeys = (value, allowed, label, errors) => {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} has unsupported field ${key}`);
  }
};

const catalogRecords = (catalog) => Array.isArray(catalog?.entities)
  ? catalog.entities
  : Array.isArray(catalog?.items)
    ? catalog.items
    : [];

const intersectionCount = (left, right) => {
  const rightSet = new Set(right);
  return [...new Set(left)].filter((item) => rightSet.has(item)).length;
};

export function analyzePackOverlaps(packs) {
  const records = Array.isArray(packs) ? packs : [];
  const overlaps = [];
  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
      const left = [...new Set(Array.isArray(records[leftIndex]?.items) ? records[leftIndex].items : [])];
      const right = [...new Set(Array.isArray(records[rightIndex]?.items) ? records[rightIndex].items : [])];
      const intersection = intersectionCount(left, right);
      const union = left.length + right.length - intersection;
      overlaps.push({
        leftId: records[leftIndex]?.id || `pack-${leftIndex}`,
        rightId: records[rightIndex]?.id || `pack-${rightIndex}`,
        intersection,
        jaccard: union ? intersection / union : 0,
      });
    }
  }
  return overlaps.sort((a, b) => b.jaccard - a.jaccard || a.leftId.localeCompare(b.leftId));
}

const validateCopy = (pack, label, errors) => {
  for (const key of ["title", "subtitle", "description", "crossbreedDisclosure"]) {
    const value = cleanText(pack?.[key]);
    if (!value) continue;
    const unsafe = UNSAFE_COPY_PATTERNS.find((pattern) => pattern.test(value));
    if (unsafe) errors.push(`${label}.${key} contains unsupported suitability/behavior copy: ${unsafe}`);
  }
};

const validateSource = (source, index, sourceIds, errors) => {
  const label = `sources[${index}]`;
  validateKeys(source, ALLOWED_SOURCE_KEYS, label, errors);
  const id = cleanText(source?.id);
  if (!/^[a-z0-9][a-z0-9-]+$/.test(id)) errors.push(`${label}.id must be stable kebab-case`);
  if (sourceIds.has(id)) errors.push(`${label}.id duplicates ${id}`);
  sourceIds.add(id);
  if (cleanText(source?.label).length < 8) errors.push(`${label}.label is too short`);
  if (!isUrl(source?.url)) errors.push(`${label}.url must be an http(s) source URL`);
  if (!isDate(source?.retrievedAt)) errors.push(`${label}.retrievedAt must be YYYY-MM-DD`);
};

export function validateDogPacks(packLibrary, catalog) {
  const errors = [];
  const warnings = [];
  validateKeys(packLibrary, ALLOWED_TOP_LEVEL_KEYS, "pack library", errors);
  if (packLibrary?.schemaVersion !== PACK_SCHEMA_VERSION) {
    errors.push(`pack library schemaVersion must be ${PACK_SCHEMA_VERSION}`);
  }
  if (!cleanText(packLibrary?.catalogId)) errors.push("pack library catalogId is required");
  if (!cleanText(packLibrary?.catalogVersion)) errors.push("pack library catalogVersion is required");
  if (!cleanText(packLibrary?.editorialVersion)) errors.push("pack library editorialVersion is required");
  if (!isDate(packLibrary?.updatedAt)) errors.push("pack library updatedAt must be YYYY-MM-DD");

  const records = catalogRecords(catalog);
  const catalogById = new Map(records.map((record) => [record?.id, record]));
  if (!records.length) errors.push("catalog must provide at least one entity");
  if (cleanText(catalog?.catalogId) && cleanText(packLibrary?.catalogId) !== cleanText(catalog.catalogId)) {
    errors.push(`pack library catalogId ${packLibrary?.catalogId} does not match catalog ${catalog.catalogId}`);
  }
  if (cleanText(catalog?.catalogVersion) && cleanText(packLibrary?.catalogVersion) !== cleanText(catalog.catalogVersion)) {
    errors.push(`pack library catalogVersion ${packLibrary?.catalogVersion} does not match catalog ${catalog.catalogVersion}`);
  }

  const sources = Array.isArray(packLibrary?.sources) ? packLibrary.sources : [];
  if (sources.length < 3) errors.push("pack library requires registry and catalog sources");
  const sourceIds = new Set();
  sources.forEach((source, index) => validateSource(source, index, sourceIds, errors));

  const packs = Array.isArray(packLibrary?.packs) ? packLibrary.packs : [];
  if (packs.length < MIN_PACKS) errors.push(`pack library requires at least ${MIN_PACKS} packs`);
  const packIds = new Set();
  const normalizedTitles = new Set();
  const familyCounts = new Map();
  const itemCounts = new Map();
  let schemeCount = 0;

  packs.forEach((pack, index) => {
    const label = `packs[${index}]`;
    validateKeys(pack, ALLOWED_PACK_KEYS, label, errors);
    const id = cleanText(pack?.id);
    const title = cleanText(pack?.title);
    const titleKey = normalizedText(title);
    if (!/^[a-z0-9][a-z0-9-]+$/.test(id)) errors.push(`${label}.id must be stable kebab-case`);
    if (packIds.has(id)) errors.push(`${label}.id duplicates ${id}`);
    packIds.add(id);
    if (title.length < 4 || title.length > 80) errors.push(`${label}.title must be 4-80 characters`);
    if (normalizedTitles.has(titleKey)) errors.push(`${label}.title duplicates another normalized title: ${title}`);
    normalizedTitles.add(titleKey);
    if (cleanText(pack?.subtitle).length < 8) errors.push(`${label}.subtitle is too short`);
    if (cleanText(pack?.description).length < 30) errors.push(`${label}.description is too short`);
    validateCopy(pack, label, errors);

    const family = cleanText(pack?.family);
    if (!PACK_FAMILIES.includes(family)) errors.push(`${label}.family is unsupported: ${family}`);
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    if (typeof pack?.promoted !== "boolean") errors.push(`${label}.promoted must be boolean`);

    const placements = Array.isArray(pack?.placements) ? pack.placements : [];
    if (!placements.length) errors.push(`${label}.placements must not be empty`);
    if (new Set(placements).size !== placements.length) errors.push(`${label}.placements contains duplicates`);
    placements.forEach((placement) => {
      if (!ALLOWED_PLACEMENTS.has(placement)) errors.push(`${label}.placements has unsupported value ${placement}`);
    });

    if (pack?.schemeAttribution !== undefined) {
      schemeCount += 1;
      validateKeys(pack.schemeAttribution, ALLOWED_SCHEME_KEYS, `${label}.schemeAttribution`, errors);
      const sourceId = cleanText(pack.schemeAttribution?.sourceId);
      if (!sourceIds.has(sourceId)) errors.push(`${label}.schemeAttribution.sourceId points nowhere: ${sourceId}`);
      if (cleanText(pack.schemeAttribution?.label).length < 8) errors.push(`${label}.schemeAttribution.label is too short`);
      if (!/registry/i.test(cleanText(pack.schemeAttribution?.note))) {
        errors.push(`${label}.schemeAttribution.note must explain that the scheme is registry-specific`);
      }
    }

    const items = Array.isArray(pack?.items) ? pack.items : [];
    if (items.length < MIN_PACK_ITEMS || items.length > MAX_PACK_ITEMS) {
      errors.push(`${label}.items must contain ${MIN_PACK_ITEMS}-${MAX_PACK_ITEMS} catalog ids`);
    }
    if (new Set(items).size !== items.length) errors.push(`${label}.items contains duplicate catalog ids`);
    items.forEach((catalogId, itemIndex) => {
      if (typeof catalogId !== "string" || !catalogId.trim()) {
        errors.push(`${label}.items[${itemIndex}] must be a catalog id string`);
        return;
      }
      const record = catalogById.get(catalogId);
      if (!record) {
        errors.push(`${label}.items[${itemIndex}] points to missing catalog id ${catalogId}`);
        return;
      }
      if (record.selectable !== true || !SELECTABLE_STATUSES.has(record.status)) {
        errors.push(`${label}.items[${itemIndex}] points to nonselectable catalog id ${catalogId}`);
      }
      if (record.status === "crossbreed" && family !== "crossbreed") {
        errors.push(`${label}.items[${itemIndex}] is a crossbreed outside an explicitly labeled crossbreed pack`);
      }
      if (family === "crossbreed" && record.status !== "crossbreed") {
        errors.push(`${label}.items[${itemIndex}] must have catalog status crossbreed`);
      }
      itemCounts.set(catalogId, (itemCounts.get(catalogId) || 0) + 1);
    });

    if (family === "crossbreed") {
      const disclosure = cleanText(pack?.crossbreedDisclosure);
      if (disclosure.length < 40 || !/crossbreed/i.test(disclosure)) {
        errors.push(`${label}.crossbreedDisclosure must explicitly frame the pack as crossbreeds`);
      }
    } else if (pack?.crossbreedDisclosure !== undefined) {
      warnings.push(`${label}.crossbreedDisclosure is unnecessary outside the crossbreed family`);
    }

    if (id === "historical-catalog-concepts") {
      items.forEach((catalogId, itemIndex) => {
        if (catalogById.get(catalogId)?.status !== "historical") {
          errors.push(`${label}.items[${itemIndex}] must have catalog status historical`);
        }
      });
    }
  });

  for (const family of PACK_FAMILIES) {
    if (!familyCounts.get(family)) errors.push(`pack library is missing required family ${family}`);
  }
  if (schemeCount < 10) errors.push("pack library requires at least ten named registry-scheme samplers");

  const starters = packs.filter((pack) => pack?.placements?.includes("starter"));
  const promoted = packs.filter((pack) => pack?.promoted === true);
  if (starters.length !== 3) errors.push("pack library must contain exactly three starter packs");
  if (promoted.length !== 3) errors.push("pack library must contain exactly three promoted packs");
  starters.forEach((pack) => {
    const label = `starter ${pack.id}`;
    if (pack.family !== "gateway") errors.push(`${label} must use family gateway`);
    if (pack.promoted !== true) errors.push(`${label} must be promoted`);
    if (!pack.placements.includes("featured")) errors.push(`${label} must also be featured`);
    const regions = Array.isArray(pack.diversityRegions) ? pack.diversityRegions : [];
    if (new Set(regions).size < 4) errors.push(`${label} must declare at least four represented world regions`);
  });
  const starterItems = starters.flatMap((pack) => pack.items || []);
  if (new Set(starterItems).size < 24) errors.push("starter packs must cover at least 24 distinct catalog entities");
  const starterOverlaps = analyzePackOverlaps(starters);
  starterOverlaps.forEach((overlap) => {
    if (overlap.jaccard > 0.25) {
      errors.push(`starter packs ${overlap.leftId} and ${overlap.rightId} overlap too heavily (${overlap.jaccard.toFixed(3)})`);
    }
  });

  if (itemCounts.size < MIN_UNIQUE_ITEMS) {
    errors.push(`pack library requires at least ${MIN_UNIQUE_ITEMS} distinct catalog entities`);
  }
  for (const [catalogId, count] of itemCounts) {
    if (count > MAX_ITEM_APPEARANCES) {
      errors.push(`${catalogId} appears in ${count} packs; maximum is ${MAX_ITEM_APPEARANCES}`);
    }
  }
  const overlaps = analyzePackOverlaps(packs);
  overlaps.forEach((overlap) => {
    if (overlap.jaccard > MAX_PAIRWISE_JACCARD) {
      errors.push(`packs ${overlap.leftId} and ${overlap.rightId} overlap too heavily (${overlap.jaccard.toFixed(3)})`);
    }
  });

  const summary = {
    packs: packs.length,
    families: Object.fromEntries([...familyCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    registrySchemePacks: schemeCount,
    starterPacks: starters.length,
    promotedPacks: promoted.length,
    itemReferences: packs.reduce((total, pack) => total + (pack?.items?.length || 0), 0),
    uniqueCatalogItems: itemCounts.size,
    maxItemAppearances: Math.max(0, ...itemCounts.values()),
    maxPairwiseJaccard: Number((overlaps[0]?.jaccard || 0).toFixed(4)),
    highestOverlap: overlaps[0] || null,
  };
  return { errors, warnings, summary };
}

const parseArgs = (argv) => {
  const options = {
    packs: path.join(ROOT, "data", "dogs", "packs.json"),
    catalog: path.join(ROOT, "data", "dogs", "dog-catalog.json"),
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--help") options.help = true;
    else if (arg === "--packs" || arg === "--catalog") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a path`);
      options[arg.slice(2)] = path.resolve(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Validate StackRank Dogs editorial packs.\n\nUsage: node scripts/validate-dog-packs.mjs [--packs path] [--catalog path] [--json]");
    return;
  }
  const [packLibrary, catalog] = await Promise.all([
    readFile(options.packs, "utf8").then(JSON.parse),
    readFile(options.catalog, "utf8").then(JSON.parse),
  ]);
  const result = validateDogPacks(packLibrary, catalog);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(JSON.stringify(result.summary, null, 2));
    result.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
    if (result.errors.length) {
      console.error(`\n${result.errors.length} dog pack validation error${result.errors.length === 1 ? "" : "s"}:`);
      result.errors.forEach((error) => console.error(`- ${error}`));
    } else console.log("\nDog pack validation passed.");
  }
  if (result.errors.length) process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
