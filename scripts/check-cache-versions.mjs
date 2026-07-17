#!/usr/bin/env node

import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const MANIFEST_PATH = path.join(ROOT, "data", "asset-versions.json");
const ROOT_SOURCE_FILES = [
  "index.html",
  "privacy.html",
  "shared.html",
  "books.html",
  "dogs.html",
  "home.html",
  "app.js",
  "shared.js",
  "books.js",
  "dogs.js",
  "home.js",
];
const RUNTIME_SOURCE_DIRS = ["lib", "js"];
const LOCAL_ASSET_EXTENSIONS = new Set([
  ".css",
  ".ico",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".webmanifest",
]);

const sameOriginHosts = new Set(["stackrankapp.com", "www.stackrankapp.com"]);

const toPosix = (value) => value.split(path.sep).join("/");

const relativePath = (absolutePath, root = ROOT) => toPosix(path.relative(root, absolutePath));

const lineColumnAt = (text, index) => {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
};

export const sha256Hex = (content) =>
  crypto.createHash("sha256").update(content).digest("hex");

export const normalizeVersionedAssetPath = (specifier, sourcePath = "", root = ROOT) => {
  const [withoutQuery] = specifier.split("?");
  let pathname = withoutQuery;

  if (/^https?:\/\//.test(pathname)) {
    const url = new URL(pathname);
    if (!sameOriginHosts.has(url.hostname)) return null;
    pathname = url.pathname.replace(/^\/+/, "");
  } else if (pathname.startsWith("/")) {
    pathname = pathname.replace(/^\/+/, "");
  } else {
    const sourceDir = path.dirname(path.join(root, sourcePath));
    pathname = path.relative(root, path.resolve(sourceDir, pathname));
  }

  const normalized = toPosix(path.normalize(pathname));
  if (normalized.startsWith("../") || path.isAbsolute(normalized)) return null;
  if (!LOCAL_ASSET_EXTENSIONS.has(path.extname(normalized))) return null;
  return normalized;
};

export const collectVersionedReferencesFromText = (text, sourcePath, root = ROOT) => {
  const refs = [];
  const pattern =
    /(?<specifier>(?:https?:\/\/(?:www\.)?stackrankapp\.com\/|\.{0,2}\/|\/)?[A-Za-z0-9][A-Za-z0-9_./-]*\.(?:css|ico|js|json|png|svg|webmanifest))\?v=(?<version>\d+)/g;
  let match;

  while ((match = pattern.exec(text))) {
    const assetPath = normalizeVersionedAssetPath(match.groups.specifier, sourcePath, root);
    if (!assetPath) continue;
    const location = lineColumnAt(text, match.index);
    refs.push({
      assetPath,
      sourcePath,
      line: location.line,
      column: location.column,
      specifier: `${match.groups.specifier}?v=${match.groups.version}`,
      v: Number(match.groups.version),
    });
  }

  return refs;
};

export const findUnversionedRuntimeJsImports = (text, sourcePath = "app.js") => {
  const imports = [];
  const pattern =
    /(?:from\s*|import\s*\(\s*|import\s*)["'](?<specifier>\.{1,2}\/[A-Za-z0-9_./-]+\.js)(?!\?v=)["']/g;
  let match;

  while ((match = pattern.exec(text))) {
    const location = lineColumnAt(text, match.index);
    imports.push({
      sourcePath,
      line: location.line,
      column: location.column,
      specifier: match.groups.specifier,
    });
  }

  return imports;
};

export const findUnversionedAppLibImports = findUnversionedRuntimeJsImports;

export const groupVersionedReferences = (refs) => {
  const grouped = new Map();
  refs.forEach((ref) => {
    if (!grouped.has(ref.assetPath)) grouped.set(ref.assetPath, []);
    grouped.get(ref.assetPath).push(ref);
  });
  return grouped;
};

export const evaluateCacheManifest = (currentManifest, previousManifest = {}) => {
  const errors = [];
  const nextManifest = {};
  const changes = [];

  Object.entries(currentManifest)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([assetPath, current]) => {
      const previous = previousManifest[assetPath];
      nextManifest[assetPath] = current;
      if (!previous) {
        changes.push({ type: "added", assetPath });
        return;
      }
      const hashChanged = previous.hash !== current.hash;
      const versionChanged = Number(previous.v) !== Number(current.v);
      if (hashChanged && !versionChanged) {
        errors.push({
          type: "stale-version",
          assetPath,
          previous,
          current,
        });
        return;
      }
      if (hashChanged || versionChanged) {
        changes.push({
          type: hashChanged && versionChanged ? "updated" : "version-only",
          assetPath,
        });
      }
    });

  Object.keys(previousManifest)
    .filter((assetPath) => !currentManifest[assetPath])
    .sort()
    .forEach((assetPath) => {
      changes.push({ type: "removed", assetPath });
    });

  return { errors, changes, nextManifest };
};

const readJsonIfPresent = async (filePath) => {
  if (!existsSync(filePath)) return {};
  return JSON.parse(await readFile(filePath, "utf8"));
};

export const discoverRuntimeSourceFiles = async (root = ROOT) => {
  const files = [...ROOT_SOURCE_FILES];

  for (const dir of RUNTIME_SOURCE_DIRS) {
    const absoluteDir = path.join(root, dir);
    if (!existsSync(absoluteDir)) continue;
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => `${dir}/${entry.name}`)
      .sort()
      .forEach((filePath) => files.push(filePath));
  }

  return files;
};

const formatRef = (ref) => `${ref.sourcePath}:${ref.line}:${ref.column}`;

const formatRefs = (refs) => refs.map(formatRef).join(", ");

const buildCurrentManifest = async (groupedRefs, root = ROOT) => {
  const currentManifest = {};
  const errors = [];

  for (const [assetPath, refs] of [...groupedRefs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const versions = new Set(refs.map((ref) => ref.v));
    if (versions.size > 1) {
      errors.push(
        `${assetPath} has conflicting cache versions: ${refs
          .map((ref) => `?v=${ref.v} at ${formatRef(ref)}`)
          .join(", ")}`,
      );
      continue;
    }

    const absoluteAssetPath = path.join(root, assetPath);
    if (!existsSync(absoluteAssetPath)) {
      errors.push(`${assetPath} is referenced at ${formatRefs(refs)} but the file does not exist`);
      continue;
    }

    currentManifest[assetPath] = {
      hash: sha256Hex(await readFile(absoluteAssetPath)),
      v: refs[0].v,
    };
  }

  return { currentManifest, errors };
};

export const stringifyManifest = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;

export const collectProjectCacheState = async ({
  root = ROOT,
  sourceFiles,
} = {}) => {
  const refs = [];
  const unversionedImports = [];
  const filesToScan = sourceFiles || (await discoverRuntimeSourceFiles(root));

  for (const sourcePath of filesToScan) {
    const absolutePath = path.join(root, sourcePath);
    const text = await readFile(absolutePath, "utf8");
    refs.push(...collectVersionedReferencesFromText(text, sourcePath, root));
    if (sourcePath.endsWith(".js")) {
      unversionedImports.push(...findUnversionedRuntimeJsImports(text, sourcePath));
    }
  }

  const groupedRefs = groupVersionedReferences(refs);
  const { currentManifest, errors: referenceErrors } = await buildCurrentManifest(groupedRefs, root);
  return {
    refs,
    groupedRefs,
    currentManifest,
    referenceErrors,
    unversionedImports,
  };
};

const run = async () => {
  const previousManifest = await readJsonIfPresent(MANIFEST_PATH);
  const {
    groupedRefs,
    currentManifest,
    referenceErrors,
    unversionedImports,
  } = await collectProjectCacheState();
  const { errors: manifestErrors, changes, nextManifest } = evaluateCacheManifest(
    currentManifest,
    previousManifest,
  );

  const errors = [...referenceErrors];

  unversionedImports.forEach((entry) => {
    errors.push(
      `${formatRef(entry)} imports ${entry.specifier} without a cache key; add ?v=N to the app.js import`,
    );
  });

  manifestErrors.forEach((error) => {
    const refs = groupedRefs.get(error.assetPath) || [];
    const currentVersion = Number(error.current.v);
    const suggestedVersion = Number.isFinite(currentVersion) ? currentVersion + 1 : "N+1";
    errors.push(
      `${error.assetPath} changed but is still referenced as ?v=${error.current.v} at ${formatRefs(
        refs,
      )}; bump to ?v=${suggestedVersion} and rerun npm run check:cache`,
    );
  });

  if (errors.length) {
    console.error(`Cache version check failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  const previousText = stringifyManifest(previousManifest);
  const nextText = stringifyManifest(nextManifest);
  if (previousText !== nextText) {
    await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await writeFile(MANIFEST_PATH, nextText);
  }

  const summary =
    changes.length > 0
      ? `${changes.length} manifest update${changes.length === 1 ? "" : "s"}`
      : "manifest unchanged";
  console.log(`Cache version check passed (${Object.keys(nextManifest).length} assets, ${summary}).`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
