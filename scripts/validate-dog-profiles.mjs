#!/usr/bin/env node
import fs from "node:fs/promises";

const readJson = async (path) => JSON.parse(await fs.readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const [catalog, artifact, artwork] = await Promise.all([
  readJson("data/dogs/dog-catalog.json"),
  readJson("data/dogs/breed-profiles.json"),
  readJson("data/dogs/generated-artwork.json"),
]);

const errors = [];
const unsafe = /\b(?:perfect for|best for|safe with|aggressive|hypoallergenic|easy to train|good with children)\b/iu;
const sourceIds = new Set((artifact.sources || []).map((source) => source.id));
const expected = new Set((catalog.entities || []).map((entity) => entity.id));
const actual = new Set(Object.keys(artifact.profiles || {}));
const illustratedIds = new Set((artwork.assets || [])
  .filter((asset) => asset.uiDisplayAllowed === true && asset.review?.status === "approved")
  .map((asset) => asset.catalogId));

if (artifact.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (!artifact.profileVersion) errors.push("profileVersion is required");
if (sourceIds.size !== artifact.sources?.length) errors.push("Source ids must be unique");
for (const source of artifact.sources || []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id)) errors.push(`Invalid source id: ${source.id}`);
  if (typeof source.name !== "string" || !source.name.trim() || source.name.length > 120) errors.push(`${source.id}: invalid source name`);
  if (source.kind !== undefined && source.kind !== "breed-reference") errors.push(`${source.id}: invalid source kind`);
  try {
    const url = new URL(source.url);
    const allowed = source.kind === "breed-reference" ? ["https:"] : ["http:", "https:"];
    if (!allowed.includes(url.protocol) || url.username || url.password) errors.push(`${source.id}: invalid source URL`);
  } catch { errors.push(`${source.id}: invalid source URL`); }
}
expected.forEach((id) => { if (!actual.has(id)) errors.push(`Missing profile: ${id}`); });
actual.forEach((id) => { if (!expected.has(id)) errors.push(`Unknown profile: ${id}`); });

for (const [id, profile] of Object.entries(artifact.profiles || {})) {
  if (typeof profile.summary !== "string" || profile.summary.length < 20 || profile.summary.length > 700) errors.push(`${id}: invalid summary length`);
  if (profile.reviewStatus === "editor-reviewed" && profile.summary.length < 80) errors.push(`${id}: individually written summary is incomplete`);
  if (profile.shortDescription !== undefined &&
    (typeof profile.shortDescription !== "string" || profile.shortDescription.trim().length < 80 || profile.shortDescription.length > 180)) {
    errors.push(`${id}: invalid shortDescription length`);
  }
  if (illustratedIds.has(id) && profile.reviewStatus === "editor-reviewed" && !profile.shortDescription) {
    errors.push(`${id}: illustrated reviewed profile needs shortDescription`);
  }
  if (typeof profile.interestingFact !== "string" || (profile.interestingFact.length > 0 && profile.interestingFact.length < 20) || profile.interestingFact.length > 360) errors.push(`${id}: invalid interestingFact length`);
  if (/first field note|confident invented|still being deepened|StackRank keeps|selectable (?:entry|breeds)|cartoonish copy/i.test(`${profile.summary} ${profile.shortDescription || ""} ${profile.interestingFact}`)) errors.push(`${id}: process commentary belongs in source notes`);
  if (unsafe.test(`${profile.summary} ${profile.shortDescription || ""} ${profile.interestingFact}`)) errors.push(`${id}: unsafe suitability or behavior claim`);
  if (!["toy", "small", "medium", "large", "giant", "varies", "unknown"].includes(profile.sizeBand)) errors.push(`${id}: invalid sizeBand`);
  if (typeof profile.typeLabel !== "string" || !profile.typeLabel.trim() || profile.typeLabel.length > 80) errors.push(`${id}: invalid typeLabel`);
  if (!["registry", "editorial", "catalog"].includes(profile.typeBasis)) errors.push(`${id}: invalid typeBasis`);
  if (!["generated", "source-reviewed", "editor-reviewed"].includes(profile.reviewStatus)) errors.push(`${id}: invalid reviewStatus`);
  if (!Array.isArray(profile.sourceIds) || !profile.sourceIds.length) errors.push(`${id}: sourceIds required`);
  (profile.sourceIds || []).forEach((sourceId) => { if (!sourceIds.has(sourceId)) errors.push(`${id}: missing source ${sourceId}`); });
  (profile.registryGroups || []).forEach((group) => {
    if (!group.scheme || !group.label || !sourceIds.has(group.sourceId)) errors.push(`${id}: invalid registry group`);
  });
  if (profile.popularity) {
    const { geography, year, rank, total, sourceId } = profile.popularity;
    if (!geography || !Number.isInteger(year) || !Number.isInteger(rank) || !Number.isInteger(total) || rank > total || !sourceIds.has(sourceId)) {
      errors.push(`${id}: invalid popularity scope`);
    }
  }
}

if (errors.length) {
  console.error(errors.slice(0, 100).join("\n"));
  if (errors.length > 100) console.error(`…and ${errors.length - 100} more`);
  process.exitCode = 1;
} else {
  const counts = Object.values(artifact.profiles).reduce((result, profile) => {
    result[profile.reviewStatus] = (result[profile.reviewStatus] || 0) + 1;
    return result;
  }, {});
  console.log(`Validated ${actual.size} Dog profiles: ${JSON.stringify(counts)}.`);
}
