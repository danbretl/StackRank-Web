#!/usr/bin/env node
import fs from "node:fs/promises";
import { buildDogProfiles } from "./dog-profiles-lib.mjs";

const readJson = async (path) => JSON.parse(await fs.readFile(new URL(`../${path}`, import.meta.url), "utf8"));

const [catalog, packs, wikidata, fci, overrides, shortDescriptions] = await Promise.all([
  readJson("data/dogs/dog-catalog.json"),
  readJson("data/dogs/packs.json"),
  readJson("data/dogs/sources/wikidata-dog-breeds-2026-09-21.json"),
  readJson("data/dogs/sources/fci-promoted-profiles-2026-09-21.json"),
  readJson("data/dogs/profile-overrides.json"),
  readJson("data/dogs/profile-short-descriptions.json"),
]);

const refreshes = await Promise.all(["a", "b", "c", "f", "f02", "f03", "f04", "g01"].map((batch) => readJson(`data/dogs/profile-refresh-${batch}.json`)));
const profiles = buildDogProfiles({ catalog, packs, wikidata, fci, overrides, refreshes, shortDescriptions });
const outputUrl = new URL("../data/dogs/breed-profiles.json", import.meta.url);
const next = `${JSON.stringify(profiles, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await fs.readFile(outputUrl, "utf8").catch(() => "");
  if (current !== next) {
    console.error("data/dogs/breed-profiles.json is stale; run npm run build:dogs:profiles");
    process.exitCode = 1;
  } else {
    console.log(`Dog profiles are current (${Object.keys(profiles.profiles).length} entries).`);
  }
} else {
  await fs.writeFile(outputUrl, next);
  console.log(`Wrote ${Object.keys(profiles.profiles).length} Dog profiles to data/dogs/breed-profiles.json.`);
}
