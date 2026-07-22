#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseArtworkCrop, processArtworkCandidate } from "./process-dog-artwork.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LEDGER = path.join(ROOT, "data", "dogs", "image-rights.json");
const DEFAULT_RECIPES = path.join(ROOT, "data", "dogs", "artwork-crop-recipes.json");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const parseArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (["--ledger", "--recipes", "--originals-dir", "--out-dir", "--processed-at"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

const findImageFiles = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findImageFiles(filename)));
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(filename);
  }
  return files;
};

const indexExactOriginals = async ({ directory, wantedHashes }) => {
  const matches = new Map();
  for (const filename of await findImageFiles(directory)) {
    const bytes = await readFile(filename);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!wantedHashes.has(sha256)) continue;
    const current = matches.get(sha256) || [];
    current.push(filename);
    matches.set(sha256, current);
  }
  return matches;
};

export const assertArtworkCropRecipeContract = ({ ledger, recipes }) => {
  if (recipes.catalogVersion !== ledger.catalogVersion) throw new Error("Crop recipe catalogVersion does not match ledger");
  if (recipes.ledgerVersion !== ledger.ledgerVersion) throw new Error("Crop recipe ledgerVersion does not match ledger");
  if (recipes.recipes.length !== ledger.assets.length) throw new Error("Crop recipes must cover every exact ledger asset once");
  const assets = new Map(ledger.assets.map((asset) => [asset.assetId, asset]));
  const seen = new Set();
  for (const recipe of recipes.recipes) {
    if (seen.has(recipe.assetId)) throw new Error(`Duplicate crop recipe ${recipe.assetId}`);
    seen.add(recipe.assetId);
    const asset = assets.get(recipe.assetId);
    if (!asset) throw new Error(`Crop recipe references unknown asset ${recipe.assetId}`);
    if (recipe.catalogId !== asset.catalogId) throw new Error(`Crop recipe catalogId mismatch for ${recipe.assetId}`);
    if (recipe.sourceSha256 !== asset.sourceSha256) throw new Error(`Crop recipe source hash mismatch for ${recipe.assetId}`);
    parseArtworkCrop([recipe.crop.x, recipe.crop.y, recipe.crop.width, recipe.crop.height].join(","));
  }
};

export const prepareDogArtworkBatch = async ({
  ledgerPath = DEFAULT_LEDGER,
  recipesPath = DEFAULT_RECIPES,
  originalsDirectory,
  outputDirectory,
  processedAt = new Date().toISOString(),
}) => {
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  const recipes = JSON.parse(await readFile(recipesPath, "utf8"));
  assertArtworkCropRecipeContract({ ledger, recipes });
  const assets = new Map(ledger.assets.map((asset) => [asset.assetId, asset]));
  const wantedHashes = new Set(ledger.assets.map((asset) => asset.sourceSha256));
  const exactOriginals = await indexExactOriginals({ directory: originalsDirectory, wantedHashes });
  const manifests = [];

  for (const recipe of recipes.recipes) {
    const candidate = assets.get(recipe.assetId);
    const sourcePaths = exactOriginals.get(candidate.sourceSha256) || [];
    if (sourcePaths.length !== 1) {
      throw new Error(`${candidate.assetId} needs exactly one byte-matching local original; found ${sourcePaths.length}`);
    }
    const crop = parseArtworkCrop([recipe.crop.x, recipe.crop.y, recipe.crop.width, recipe.crop.height].join(","));
    const manifest = await processArtworkCandidate({
      candidate,
      crop,
      outputDirectory,
      storagePrefix: ledger.storagePrefix,
      processedAt,
      sourcePath: sourcePaths[0],
    });
    manifests.push({
      ...manifest,
      sourceLocalFilename: path.basename(sourcePaths[0]),
      cropRationale: recipe.rationale,
      visualInspection: "pending",
    });
  }

  const summary = {
    schemaVersion: 1,
    kind: "stackrank-dogs-artwork-local-batch-preparation",
    catalogVersion: ledger.catalogVersion,
    ledgerVersion: ledger.ledgerVersion,
    processedAt,
    status: "generated_local_pending_visual_inspection",
    warning: "This local report does not approve, upload, deliver, or grant any artwork purpose.",
    assets: manifests,
  };
  const summaryPath = path.join(outputDirectory, "dogs-artwork-batch-preparation.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { summary, summaryPath };
};

const printHelp = () => {
  console.log(`Prepare every current Dogs artwork ledger candidate from exact local originals.\n\nUsage:\n  node scripts/prepare-dog-artwork-batch.mjs \\\n    --originals-dir /tmp/stackrank-dogs-artwork-audit \\\n    --out-dir /tmp/stackrank-dogs-artwork-prepared\n\nThe command verifies every local original against ledger SHA-256/SHA-1/bytes and runs the deterministic 320/960 WebP processor with the tracked deliberate crop recipes. It never uploads, edits the rights ledger, approves an asset, or grants a purpose.\n`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.originalsDir) throw new Error("--originals-dir is required");
  if (!options.outDir) throw new Error("--out-dir is required");
  const { summary, summaryPath } = await prepareDogArtworkBatch({
    ledgerPath: options.ledger ? path.resolve(options.ledger) : DEFAULT_LEDGER,
    recipesPath: options.recipes ? path.resolve(options.recipes) : DEFAULT_RECIPES,
    originalsDirectory: path.resolve(options.originalsDir),
    outputDirectory: path.resolve(options.outDir),
    processedAt: options.processedAt || new Date().toISOString(),
  });
  console.log(`Prepared ${summary.assets.length} exact Dogs artwork candidates locally.`);
  console.log(`Batch report: ${summaryPath}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
