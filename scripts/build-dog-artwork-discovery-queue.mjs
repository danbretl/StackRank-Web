#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildDogArtworkDiscoveryQueue,
  sha256Text,
  stableJson,
} from "./dog-artwork-discovery-queue-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = {
  catalog: path.join(ROOT, "data", "dogs", "dog-catalog.json"),
  ledger: path.join(ROOT, "data", "dogs", "image-rights.json"),
  packs: path.join(ROOT, "data", "dogs", "packs.json"),
  policy: path.join(ROOT, "data", "dogs", "artwork-license-policy.json"),
};
const OUTPUT = path.join(ROOT, "data", "dogs", "artwork-discovery-queue.json");

const loadSource = async (sourcePath) => {
  const text = await readFile(sourcePath, "utf8");
  return { value: JSON.parse(text), sha256: sha256Text(text) };
};

export const buildQueueFromRepository = async () => {
  const [catalog, ledger, packs, policy] = await Promise.all(
    Object.values(SOURCES).map(loadSource),
  );
  return buildDogArtworkDiscoveryQueue({
    catalog: catalog.value,
    ledger: ledger.value,
    packs: packs.value,
    policy: policy.value,
    sourceHashes: {
      catalog: catalog.sha256,
      ledger: ledger.sha256,
      packs: packs.sha256,
      policy: policy.sha256,
    },
  });
};

const parseArgs = (argv) => {
  const options = { check: false, stdout: false };
  for (const argument of argv) {
    if (argument === "--check") options.check = true;
    else if (argument === "--stdout") options.stdout = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
};

const printHelp = () => {
  console.log(`Build the deterministic, review-only Dogs artwork discovery queue.

Usage:
  node scripts/build-dog-artwork-discovery-queue.mjs
  node scripts/build-dog-artwork-discovery-queue.mjs --check
  node scripts/build-dog-artwork-discovery-queue.mjs --stdout

The builder performs no network request, never edits image-rights.json, never imports or approves
an asset, and never downloads or uploads image bytes. --check fails if the tracked queue is stale.
`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const serialized = stableJson(await buildQueueFromRepository());
  if (options.stdout) {
    process.stdout.write(serialized);
    return;
  }
  if (options.check) {
    const existing = await readFile(OUTPUT, "utf8").catch(() => "");
    if (existing !== serialized) throw new Error("Tracked Dogs artwork discovery queue is stale");
    console.log("Dogs artwork discovery queue is current");
    return;
  }
  await writeFile(OUTPUT, serialized, "utf8");
  const queue = JSON.parse(serialized);
  console.log(
    `Wrote ${path.relative(ROOT, OUTPUT)}: ${queue.summary.queuedMissingLedgerRows} current-canonical concepts (${queue.summary.packEngaged} pack-engaged, ${queue.summary.catalogLongTail} long-tail)`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
