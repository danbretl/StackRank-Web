const cleanText = (value) => String(value || "").trim().replace(/\s+/g, " ");

export const normalizeProfileName = (value) => cleanText(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/\([^)]*\)/g, " ")
  .replace(/\b(?:dog|breed)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const unique = (values) => [...new Set(values.map(cleanText).filter(Boolean))];

export function buildWikidataMatchIndex(records) {
  const matches = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    unique([record?.label, ...(record?.aliases || [])]).forEach((name) => {
      const key = normalizeProfileName(name);
      if (!key) return;
      const existing = matches.get(key) || [];
      if (!existing.some((item) => item.id === record.id)) existing.push(record);
      matches.set(key, existing);
    });
  });
  return matches;
}

export function uniqueWikidataMatch(entity, index) {
  const keys = unique([entity?.displayName, ...(entity?.aliases || [])])
    .map(normalizeProfileName)
    .filter(Boolean);
  const found = new Map();
  keys.forEach((key) => (index.get(key) || []).forEach((record) => found.set(record.id, record)));
  if (found.size !== 1) return null;
  return [...found.values()][0];
}

const lowerFirst = (value) => {
  const text = cleanText(value);
  return text ? `${text[0].toLocaleLowerCase()}${text.slice(1)}` : "";
};

const quotedList = (values, limit = 2) => unique(values).slice(0, limit).map((value) => `“${value}”`).join(" and ");

const FCI_FAMILY_LABELS = Object.freeze({
  1: "Herding dogs",
  2: "Pinscher, Schnauzer & mountain dogs",
  3: "Terriers",
  4: "Dachshunds",
  5: "Spitz & primitive dogs",
  6: "Scent hounds",
  7: "Pointing dogs",
  8: "Retrievers & water dogs",
  9: "Companion & toy dogs",
  10: "Sighthounds",
});

const EDITORIAL_FAMILY_LABELS = Object.freeze({
  sporting: "Sporting dogs",
  herding: "Herding dogs",
  crossbreed: "Crossbreeds",
  sighthound: "Sighthounds",
  working: "Working dogs",
  "spitz primitive": "Spitz & primitive dogs",
  terrier: "Terriers",
  "livestock guardian": "Livestock guardians",
  "water dog": "Water dogs",
  "toy companion": "Toy & companion dogs",
  "non sporting": "Non-sporting dogs",
  "scent hound": "Scent hounds",
  hound: "Hounds",
  spitz: "Spitz dogs",
  "primitive type": "Primitive dog types",
  "mastiff-type": "Mastiff-type dogs",
  companion: "Companion dogs",
  retriever: "Retrievers",
  "hairless breeds": "Hairless breeds",
  earthdog: "Earthdogs",
});

const STATUS_FAMILY_LABELS = Object.freeze({
  canonical: "Recognized breed or regional type",
  variety: "Breed variety",
  crossbreed: "Crossbreed or named mix",
  historical: "Historical breed or type",
});

export function dogTypeLabel({ entity, fciRecord, editorialFamilies = [] }) {
  const fciLabel = FCI_FAMILY_LABELS[Number(fciRecord?.groupNumber)];
  if (fciLabel) return { label: fciLabel, basis: "registry" };
  const editorial = editorialFamilies
    .map((family) => EDITORIAL_FAMILY_LABELS[cleanText(family).toLocaleLowerCase()])
    .find(Boolean);
  if (editorial) return { label: editorial, basis: "editorial" };
  return {
    label: STATUS_FAMILY_LABELS[cleanText(entity?.status).toLocaleLowerCase()] || "Dog breed or type",
    basis: "catalog",
  };
}

export function generatedProfileCopy(entity, { origins = [], packTitles = [], parentName = "" } = {}) {
  const name = cleanText(entity?.displayName) || "This dog";
  const originText = origins.length ? ` associated with ${origins.slice(0, 3).join(", ")}` : "";
  const packText = packTitles.length
    ? ` You can meet it in StackRank’s ${quotedList(packTitles)} collection${packTitles.length > 1 ? "s" : ""}.`
    : "";
  const status = cleanText(entity?.status).toLowerCase();
  let summary;
  if (status === "variety") {
    summary = `${name} is cataloged as a distinct dog variety${parentName ? ` within the wider ${parentName} family` : ""}${originText}. Varieties may reflect a documented difference in size, coat, working tradition, or registry treatment, so StackRank keeps this name visible rather than flattening it into a parent breed.${packText}`;
  } else if (status === "crossbreed") {
    summary = `${name} is a named crossbreed or dog type${originText}. Crossbred dogs can vary widely in looks, size, and personality—even within one litter—so this field guide treats the name as a useful introduction, never a promise about an individual dog.${packText}`;
  } else if (status === "historical") {
    summary = `${name} is preserved in the catalog as a historical dog breed or type${originText}. The name carries a piece of dog history even when a single modern population or standard no longer exists, and StackRank keeps that history discoverable without pretending it is a present-day personality profile.${packText}`;
  } else {
    summary = `${name} is a dog breed or type${originText}, with its own place in a wonderfully varied global catalog.${packText} This first field note stays close to verified names and source context while the deeper history is researched—because a short honest introduction is better than a confident invented one.`;
  }

  const aliases = unique(entity?.aliases || []).filter((alias) => normalizeProfileName(alias) !== normalizeProfileName(name));
  let interestingFact;
  if (aliases.length) {
    interestingFact = `You may also meet ${name} under the name “${aliases[0]}”—dog names often change as breeds move between languages, regions, and registries.`;
  } else if (parentName) {
    interestingFact = `${name} is kept as its own selectable entry while remaining connected to ${parentName}, so the catalog preserves the distinction instead of hiding it.`;
  } else if (packTitles.length) {
    interestingFact = `${name} appears in ${quotedList(packTitles, 1)}, one of StackRank’s editorial trails for discovering dogs beyond the most familiar names.`;
  } else {
    interestingFact = `${name} is one of 1,239 selectable breeds, varieties, crossbreeds, and historical types in StackRank’s VBO-based worldwide dog catalog.`;
  }

  return { summary: cleanText(summary), interestingFact: cleanText(interestingFact) };
}

export function titleCaseCountry(value) {
  return cleanText(value)
    .split(/\s+Country of patronage/i, 1)[0]
    .toLocaleLowerCase()
    .replace(/(^|[\s(-])\p{L}/gu, (match) => match.toLocaleUpperCase())
    .replace(/\bUsa\b/g, "USA")
    .replace(/\bUk\b/g, "UK")
    .replace(/\bFci\b/g, "FCI");
}

export function packMembershipByCatalogId(packs) {
  const map = new Map();
  (Array.isArray(packs) ? packs : []).forEach((pack) => {
    (Array.isArray(pack?.items) ? pack.items : []).forEach((id) => {
      const entry = map.get(id) || { titles: [], families: [] };
      if (pack.title && !entry.titles.includes(pack.title)) entry.titles.push(pack.title);
      const family = cleanText(pack.tasteTag || pack.family).replace(/-/g, " ");
      if (family && !["gateway", "registry group"].includes(family) && !entry.families.includes(family)) {
        entry.families.push(family);
      }
      map.set(id, entry);
    });
  });
  return map;
}

export function buildDogProfiles({ catalog, packs, wikidata, fci, overrides }) {
  const wikidataIndex = buildWikidataMatchIndex(wikidata?.records);
  const packById = packMembershipByCatalogId(packs?.packs);
  const fciById = new Map((fci?.records || []).map((record) => [record.catalogId, record]));
  const entityById = new Map((catalog?.entities || []).map((entity) => [entity.id, entity]));
  const profiles = {};

  (catalog?.entities || []).forEach((entity) => {
    const matched = uniqueWikidataMatch(entity, wikidataIndex);
    const fciRecord = fciById.get(entity.id);
    const pack = packById.get(entity.id) || { titles: [], families: [] };
    const override = overrides?.profiles?.[entity.id] || null;
    const origins = unique([
      ...(override?.originRegions || []),
      ...(fciRecord?.country ? [titleCaseCountry(fciRecord.country)] : []),
      ...(matched?.countries || []),
    ]).slice(0, 8);
    const parentName = entityById.get(entity?.relationships?.parentId)?.displayName || "";
    const generated = generatedProfileCopy(entity, {
      origins,
      packTitles: pack.titles,
      parentName,
    });
    const sourceIds = unique([
      "vbo-2026-04-15",
      pack.titles.length ? "stackrank-editorial-packs" : "",
      matched ? "wikidata-dog-breeds-2026-09-21" : "",
      fciRecord?.groupNumber ? "fci-promoted-profiles-2026-09-21" : "",
      override ? "stackrank-editorial-review-2026-09-21" : "",
    ]);
    const registryGroups = fciRecord?.groupNumber
      ? [{
          scheme: "FCI",
          label: `Group ${fciRecord.groupNumber} · ${fciRecord.groupLabel}`,
          sourceId: "fci-promoted-profiles-2026-09-21",
        }]
      : [];
    const popularityById = {
      "VBO:0200610": { geography: "United States", year: 2025, rank: 3, total: 202, sourceId: "akc-us-registrations-2025" },
      "VBO:0200406": { geography: "United States", year: 2025, rank: 5, total: 202, sourceId: "akc-us-registrations-2025" },
      "VBO:0200800": { geography: "United States", year: 2025, rank: 2, total: 202, sourceId: "akc-us-registrations-2025" },
    };
    const popularity = popularityById[entity.id];
    if (popularity) sourceIds.push("akc-us-registrations-2025");
    const editorialFamilies = unique([...(override?.editorialFamilies || []), ...pack.families]).slice(0, 12);
    const type = dogTypeLabel({ entity, fciRecord, editorialFamilies });
    profiles[entity.id] = {
      summary: cleanText(override?.summary || generated.summary),
      interestingFact: cleanText(override?.interestingFact || generated.interestingFact),
      sizeBand: override?.sizeBand || "unknown",
      typeLabel: type.label,
      typeBasis: type.basis,
      originRegions: origins,
      historicalRoots: cleanText(override?.historicalRoots),
      editorialFamilies,
      registryGroups,
      ...(popularity ? { popularity } : {}),
      sourceIds: unique(sourceIds),
      reviewStatus: override ? "editor-reviewed" : matched || fciRecord?.groupNumber ? "source-reviewed" : "generated",
    };
  });

  return {
    schemaVersion: 1,
    profileVersion: "dogs-field-guide-2026-09-21.2",
    sources: [
      { id: "vbo-2026-04-15", name: "Vertebrate Breed Ontology", url: catalog.source.artifactUrl, license: catalog.source.license, retrievedAt: `${catalog.source.retrievedAt}T00:00:00.000Z` },
      { id: "wikidata-dog-breeds-2026-09-21", name: "Wikidata structured dog-breed statements", url: wikidata.source.url, license: wikidata.source.license, retrievedAt: wikidata.retrievedAt },
      { id: "fci-promoted-profiles-2026-09-21", name: "FCI breed nomenclature (promoted cohort)", url: fci.source.url, license: "Citation-only primary reference", retrievedAt: fci.retrievedAt },
      { id: "stackrank-editorial-packs", name: "StackRank Dogs editorial packs", url: "https://www.stackrankapp.com/dogs", license: "StackRank editorial data", retrievedAt: `${packs.updatedAt}T00:00:00.000Z` },
      { id: "stackrank-editorial-review-2026-09-21", name: "StackRank Dogs profile review", url: "https://www.stackrankapp.com/dogs", license: "Original StackRank editorial copy", retrievedAt: "2026-09-21T00:00:00.000Z" },
      { id: "akc-us-registrations-2025", name: "AKC 2025 U.S. registration ranking", url: "https://www.akc.org/most-popular-breeds/", license: "Citation-only factual reference", retrievedAt: "2026-09-21T00:00:00.000Z" }
    ],
    profiles,
  };
}
