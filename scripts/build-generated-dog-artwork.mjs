#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { preserveDogArtwork } from "./preserve-dog-artwork.mjs";

const execFile = promisify(execFileCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "assets", "dogs", "generated");
const batchDirectory = path.join(root, "data", "dogs");
const batchPaths = (await fs.readdir(batchDirectory))
  .filter((filename) => /^generated-artwork-batch-[a-z0-9-]+\.json$/u.test(filename))
  .sort((left, right) => left.localeCompare(right))
  .map((filename) => path.join("data", "dogs", filename));
const targets = [
  { role: "card", width: 320, height: 213 },
  { role: "detail", width: 960, height: 640 },
];

const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
const hashFile = async (filename) => {
  const bytes = await fs.readFile(filename);
  return { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const batchEntries = (batch) => Array.isArray(batch) ? batch : batch.images || batch.assets || batch.entries || [];

const [catalog, rights, policy, ...batches] = await Promise.all([
  readJson("data/dogs/dog-catalog.json"),
  readJson("data/dogs/image-rights.json"),
  readJson("data/dogs/generated-artwork-policy.json"),
  ...batchPaths.map(readJson),
]);
const catalogById = new Map(catalog.entities.map((entity) => [entity.id, entity]));
const rightsByAssetId = new Map(rights.assets.map((asset) => [asset.assetId, asset]));
const entries = batches.flatMap(batchEntries);
const ids = new Set();
const errors = [];

for (const entry of entries) {
  if (!/^VBO:\d{7}$/u.test(entry?.catalogId || "") || !catalogById.has(entry.catalogId)) errors.push(`Invalid catalog id: ${entry?.catalogId}`);
  if (ids.has(entry?.catalogId)) errors.push(`Duplicate generated catalog id: ${entry.catalogId}`);
  ids.add(entry?.catalogId);
  if (entry?.qa?.verdict !== "pass") errors.push(`${entry?.catalogId}: QA did not pass`);
  if (entry?.generator !== "OpenAI built-in imagegen") errors.push(`${entry?.catalogId}: unsupported generator`);
  if (!["dogs-field-guide-v1", "dogs-field-guide-v2-cohort-e", "dogs-field-guide-v3-cohort-f"].includes(entry?.promptTemplateVersion)) errors.push(`${entry?.catalogId}: prompt template mismatch`);
  const reference = rightsByAssetId.get(entry?.reference?.assetId);
  if (!reference || reference.catalogId !== entry.catalogId || reference.review?.status !== "approved") {
    errors.push(`${entry?.catalogId}: missing matching rights-reviewed reference`);
  }
  if (!entry?.generatedPath?.startsWith("assets/dogs/generated-masters/") || entry.generatedPath.includes("..")) {
    errors.push(`${entry?.catalogId}: invalid master path`);
  }
}
if (!policy?.purposeGates?.uiDisplay || policy?.purposeGates?.publicSnapshot || policy?.purposeGates?.rasterExport) {
  errors.push("Generated artwork policy purpose gates are not fail-closed");
}
if (errors.length) throw new Error(errors.join("\n"));

const checkOnly = process.argv.includes("--check");
if (!checkOnly) await fs.mkdir(outputDirectory, { recursive: true });
const assets = [];

for (const entry of entries.sort((left, right) => left.catalogId.localeCompare(right.catalogId))) {
  const sourcePath = path.join(root, entry.generatedPath);
  const { stdout: dimensions } = await execFile("magick", [sourcePath, "-format", "%w,%h", "info:"]);
  if (dimensions.trim() !== "1536,1024") throw new Error(`${entry.catalogId}: expected a 1536x1024 master, got ${dimensions.trim()}`);
  const source = await hashFile(sourcePath);
  const stem = path.basename(entry.generatedPath, path.extname(entry.generatedPath));
  const variants = [];
  for (const target of targets) {
    const filename = `${stem}-${target.width}.webp`;
    const outputPath = path.join(outputDirectory, filename);
    const { stdout: outputBytes } = await execFile("magick", [
      sourcePath,
      "-strip",
      "-resize", `${target.width}x${target.height}^`,
      "-gravity", "center",
      "-extent", `${target.width}x${target.height}`,
      "-quality", "84",
      "-define", "webp:method=6",
      "webp:-",
    ], { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 });
    await preserveDogArtwork(outputPath, outputBytes, { checkOnly });
    const output = { bytes: outputBytes.byteLength, sha256: createHash("sha256").update(outputBytes).digest("hex") };
    variants.push({
      ...target,
      mime: "image/webp",
      bytes: output.bytes,
      sha256: output.sha256,
      url: `assets/dogs/generated/${filename}`,
    });
  }
  assets.push({
    assetId: `dogs:generated:${entry.catalogId.replace(":", "-").toLocaleLowerCase()}:v1`,
    catalogId: entry.catalogId,
    name: entry.name,
    sourceType: "ai-generated",
    generator: entry.generator,
    promptTemplateVersion: entry.promptTemplateVersion,
    generatedAt: entry.generatedAt,
    masterSha256: source.sha256,
    reference: entry.reference,
    review: {
      status: "approved",
      reviewedAt: entry.qa.reviewedAt || "2026-09-21",
      breedIdentity: entry.qa.breedIdentity,
      anatomy: entry.qa.anatomy,
      crop: entry.qa.crop,
      aesthetics: entry.qa.aesthetics,
    },
    uiDisplayAllowed: true,
    publicSnapshotAllowed: false,
    rasterExportAllowed: false,
    variants,
  });
}
const artifact = {
  schemaVersion: 1,
  manifestVersion: `dogs-generated-artwork-${assets.length}-${createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12)}`,
  policyVersion: policy.policyVersion,
  disclosure: policy.requiredDisclosure,
  assets,
};
const outputPath = path.join(root, "data", "dogs", "generated-artwork.json");
const next = `${JSON.stringify(artifact, null, 2)}\n`;
if (checkOnly) {
  const current = await fs.readFile(outputPath, "utf8").catch(() => "");
  if (current !== next) throw new Error("Generated Dog artwork manifest or variants are stale");
  console.log(`Generated Dog artwork is current (${assets.length} approved portraits).`);
} else {
  await fs.writeFile(outputPath, next);
  console.log(`Built ${assets.length} approved generated Dog portraits (${assets.length * targets.length} WebP variants).`);
}
