#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_AGENT =
  "StackRankDogsArtwork/0.1 (https://www.stackrankapp.com/privacy; contact: stackrank@danbretl.com)";
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const execFile = promisify(execFileCallback);
const TARGETS = [
  { role: "card", width: 320, height: 213 },
  { role: "detail", width: 960, height: 640 },
];

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");
const assetFilenameStem = (assetId) => assetId.replace(/:/g, "-");

export const parseArtworkCrop = (value) => {
  const parts = cleanString(value)
    .split(",")
    .map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error("--crop must be four comma-separated integers: x,y,width,height");
  }
  const [x, y, width, height] = parts;
  if (x < 0 || y < 0 || width < 1 || height < 1) throw new Error("Crop coordinates and size are invalid");
  const targetRatio = 3 / 2;
  if (Math.abs(width / height - targetRatio) / targetRatio > 0.005) {
    throw new Error("Crop must use a 3:2 aspect ratio within 0.5%");
  }
  return { x, y, width, height };
};

export const buildArtworkMagickArgs = ({ sourcePath, outputPath, crop, target }) => [
  sourcePath,
  "-auto-orient",
  "-crop",
  `${crop.width}x${crop.height}+${crop.x}+${crop.y}`,
  "+repage",
  "-strip",
  "-resize",
  `${target.width}x${target.height}!`,
  "-quality",
  "82",
  "-define",
  "webp:method=6",
  "-define",
  "webp:exact=true",
  outputPath,
];

const hashFile = async (filename) => {
  const bytes = await readFile(filename);
  return { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
};

const verifyLocalOriginal = async ({ candidate, filename }) => {
  const bytes = await readFile(filename);
  if (bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(`Original exceeds the ${MAX_SOURCE_BYTES}-byte processing limit`);
  }
  const result = {
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha1: createHash("sha1").update(bytes).digest("hex"),
  };
  if (result.bytes !== candidate.sourceBytes) throw new Error("Local byte count does not match the candidate ledger data");
  if (result.sha256 !== candidate.sourceSha256) throw new Error("Local SHA-256 does not match the candidate ledger data");
  if (result.sha1 !== candidate.sourceSha1) throw new Error("Local SHA-1 does not match the candidate ledger data");
  return result;
};

const downloadVerifiedOriginal = async ({ candidate, outputPath, fetchImpl = fetch }) => {
  const response = await fetchImpl(candidate.originalUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: candidate.sourceMime },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Original download failed with HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
    throw new Error(`Original exceeds the ${MAX_SOURCE_BYTES}-byte processing limit`);
  }
  if (!response.body) throw new Error("Original response has no body");
  const sha256 = createHash("sha256");
  const sha1 = createHash("sha1");
  const output = createWriteStream(outputPath, { flags: "wx" });
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > MAX_SOURCE_BYTES) throw new Error(`Original exceeds the ${MAX_SOURCE_BYTES}-byte processing limit`);
      sha256.update(chunk);
      sha1.update(chunk);
      if (!output.write(chunk)) await new Promise((resolve) => output.once("drain", resolve));
    }
    await new Promise((resolve, reject) => {
      output.end(resolve);
      output.once("error", reject);
    });
  } catch (error) {
    output.destroy();
    throw error;
  }
  const result = { bytes, sha256: sha256.digest("hex"), sha1: sha1.digest("hex") };
  if (result.bytes !== candidate.sourceBytes) throw new Error("Downloaded byte count does not match the candidate ledger data");
  if (result.sha256 !== candidate.sourceSha256) throw new Error("Downloaded SHA-256 does not match the candidate ledger data");
  if (result.sha1 !== candidate.sourceSha1) throw new Error("Downloaded SHA-1 does not match the candidate ledger data");
  return result;
};

const assertOutputDoesNotExist = async (filename) => {
  try {
    await access(filename);
    throw new Error(`Refusing to overwrite ${filename}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
};

const orientedDimensions = async (sourcePath, execFileImpl) => {
  const { stdout } = await execFileImpl("magick", [
    sourcePath,
    "-auto-orient",
    "-format",
    "%w,%h",
    "info:",
  ]);
  const [width, height] = cleanString(stdout)
    .split(",")
    .map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("Could not inspect oriented source dimensions");
  return { width, height };
};

const inspectVariant = async ({ filename, target, execFileImpl }) => {
  const { stdout } = await execFileImpl("magick", [filename, "-format", "%m|%w|%h", "info:"]);
  const [format, width, height] = cleanString(stdout).split("|");
  if (format !== "WEBP" || Number(width) !== target.width || Number(height) !== target.height) {
    throw new Error(`${filename} has unexpected format or dimensions: ${stdout}`);
  }
};

export const processArtworkCandidate = async ({
  candidate,
  crop,
  outputDirectory,
  storagePrefix,
  manifestPath = null,
  fetchImpl = fetch,
  execFileImpl = execFile,
  processedAt = new Date().toISOString(),
  sourcePath = null,
}) => {
  if (!/^dogs:photo:[a-z0-9-]+:[a-f0-9]{16}$/.test(cleanString(candidate?.assetId))) {
    throw new Error("Candidate has an invalid assetId");
  }
  if (!/^VBO:\d{7}$/.test(cleanString(candidate?.catalogId))) throw new Error("Candidate has an invalid catalogId");
  if (!/^https:\/\/upload\.wikimedia\.org\//.test(cleanString(candidate?.originalUrl))) {
    throw new Error("Processing currently supports byte-verified Wikimedia Commons originals only");
  }
  if (!/^[a-f0-9]{64}$/.test(cleanString(candidate?.sourceSha256))) throw new Error("Candidate sourceSha256 is invalid");
  if (!/^[a-f0-9]{40}$/.test(cleanString(candidate?.sourceSha1))) throw new Error("Candidate sourceSha1 is invalid");
  if (!/^dogs-catalog\/[a-z0-9.-]+\/$/.test(cleanString(storagePrefix))) {
    throw new Error("--storage-prefix must be an immutable dogs-catalog version prefix");
  }
  await mkdir(outputDirectory, { recursive: true });
  const stem = assetFilenameStem(candidate.assetId);
  const outputs = TARGETS.map((target) => ({
    target,
    filename: path.join(outputDirectory, `${stem}-${target.width}.webp`),
  }));
  const resolvedManifest = manifestPath || path.join(outputDirectory, `${stem}.artwork-processing.json`);
  await Promise.all([...outputs.map(({ filename }) => assertOutputDoesNotExist(filename)), assertOutputDoesNotExist(resolvedManifest)]);

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "stackrank-dog-artwork-"));
  const sourceExtension = candidate.sourceMime === "image/png" ? ".png" : candidate.sourceMime === "image/webp" ? ".webp" : ".jpg";
  const downloadedSourcePath = path.join(temporaryDirectory, `source${sourceExtension}`);
  const resolvedSourcePath = sourcePath ? path.resolve(sourcePath) : downloadedSourcePath;
  try {
    if (sourcePath) await verifyLocalOriginal({ candidate, filename: resolvedSourcePath });
    else await downloadVerifiedOriginal({ candidate, outputPath: resolvedSourcePath, fetchImpl });
    const dimensions = await orientedDimensions(resolvedSourcePath, execFileImpl);
    if (crop.x + crop.width > dimensions.width || crop.y + crop.height > dimensions.height) {
      throw new Error(
        `Crop ${crop.x},${crop.y},${crop.width},${crop.height} exceeds oriented source ${dimensions.width}x${dimensions.height}`,
      );
    }
    const { stdout: versionOutput } = await execFileImpl("magick", ["-version"]);
    for (const { target, filename } of outputs) {
      await execFileImpl("magick", buildArtworkMagickArgs({ sourcePath: resolvedSourcePath, outputPath: filename, crop, target }));
      await inspectVariant({ filename, target, execFileImpl });
    }
    const variants = [];
    for (const { target, filename } of outputs) {
      const hashed = await hashFile(filename);
      variants.push({
        role: target.role,
        width: target.width,
        height: target.height,
        mime: "image/webp",
        bytes: hashed.bytes,
        sha256: hashed.sha256,
        objectPath: `${storagePrefix}${path.basename(filename)}`,
        localPath: path.relative(ROOT, filename),
      });
    }
    const manifest = {
      schemaVersion: 1,
      assetId: candidate.assetId,
      catalogId: candidate.catalogId,
      sourcePage: candidate.sourcePage,
      sourceSha256: candidate.sourceSha256,
      processedAt,
      crop,
      modifications: ["crop", "orientation normalization", "resize", "webp conversion"],
      tool: {
        name: "ImageMagick",
        version: cleanString(versionOutput).split("\n")[0],
        quality: 82,
        webpMethod: 6,
      },
      delivery: {
        status: "generated_local",
        storagePrefix,
        variants,
      },
      promotionInstructions:
        "Visually inspect both variants, upload with immutable cache headers, verify remote bytes/hashes, then copy variants into the ledger and set delivery.status to uploaded_verified. This manifest never grants a purpose.",
    };
    await writeFile(resolvedManifest, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return manifest;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

const parseArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (["--candidate", "--crop", "--out-dir", "--storage-prefix", "--manifest", "--source"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
};

const printHelp = () => {
  console.log(`Generate two byte-hashed WebP variants from an exact, hashed Dogs artwork candidate.\n\nUsage:\n  node scripts/process-dog-artwork.mjs \\\n    --candidate data/dogs/artwork-candidate-example.json \\\n    --crop x,y,width,height \\\n    --out-dir /tmp/dog-artwork \\\n    --storage-prefix dogs-catalog/vbo-2026-04-15-r1/ \\\n    [--source /tmp/exact-byte-verified-original.jpg]\n\nThe 3:2 crop is an explicit editorial decision. This command verifies either the supplied local original or a fresh download against the candidate's SHA-256/SHA-1/byte count, auto-orients it, strips metadata, and writes 320×213 plus 960×640 WebP variants. It never uploads, edits the rights ledger, or enables a use purpose.\n`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  for (const field of ["candidate", "crop", "outDir", "storagePrefix"]) {
    if (!options[field]) throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
  }
  const candidate = JSON.parse(await readFile(path.resolve(options.candidate), "utf8"));
  const manifest = await processArtworkCandidate({
    candidate,
    crop: parseArtworkCrop(options.crop),
    outputDirectory: path.resolve(options.outDir),
    storagePrefix: options.storagePrefix,
    manifestPath: options.manifest ? path.resolve(options.manifest) : null,
    sourcePath: options.source ? path.resolve(options.source) : null,
  });
  console.log(JSON.stringify(manifest, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
