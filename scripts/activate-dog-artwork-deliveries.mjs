#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LEDGER = path.join(ROOT, "data/dogs/image-rights.json");
const DEFAULT_OVERRIDES = path.join(ROOT, "data/dogs/catalog-overrides.json");
const CONFIRMATION = "I_REVIEWED_VERIFIED_DOG_ARTWORK_DELIVERIES";
const REQUIRED_MODIFICATIONS = Object.freeze(["crop", "resize", "webp conversion"]);

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const clone = (value) => structuredClone(value);

const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const findMatchingBrace = (text, openIndex) => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("catalog-overrides.json entities object is not balanced");
};

const compactObject = (value) =>
  `{${Object.entries(value)
    .map(([key, entry]) => `${JSON.stringify(key)}: ${JSON.stringify(entry)}`)
    .join(", ")}}`;

export const applyDogArtworkLinksToOverrides = (source, links) => {
  const parsed = JSON.parse(source);
  const entities = clone(parsed.entities || {});
  for (const { catalogId, assetId } of links) {
    entities[catalogId] = {
      ...(entities[catalogId] || {}),
      primaryImageAssetId: assetId,
    };
  }

  const marker = '  "entities": {';
  const markerIndex = source.indexOf(marker);
  requireCondition(markerIndex >= 0, "catalog-overrides.json has no entities object");
  const openIndex = source.indexOf("{", markerIndex + marker.length - 1);
  const closeIndex = findMatchingBrace(source, openIndex);
  const replacement = [
    '  "entities": {',
    ...Object.entries(entities)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(
        ([catalogId, override], index, rows) =>
          `    ${JSON.stringify(catalogId)}: ${compactObject(override)}${
            index === rows.length - 1 ? "" : ","
          }`,
      ),
    "  }",
  ].join("\n");
  return `${source.slice(0, markerIndex)}${replacement}${source.slice(closeIndex + 1)}`;
};

export const activateDogArtworkDeliveries = ({
  ledger,
  reports,
  ledgerVersion,
  activatedAt,
}) => {
  requireCondition(Array.isArray(ledger?.assets), "Artwork ledger has no assets array");
  requireCondition(reports.length > 0, "No delivery reports were supplied");
  requireCondition(clean(ledgerVersion), "A new ledger version is required");
  requireCondition(clean(activatedAt), "An activation date is required");

  const nextLedger = clone(ledger);
  const assetsById = new Map(nextLedger.assets.map((asset) => [asset.assetId, asset]));
  const seen = new Set();
  const links = [];

  for (const report of reports) {
    const fragment = report?.ledgerFragment;
    requireCondition(
      report?.kind === "stackrank-dogs-artwork-delivery-verification" &&
        report?.mode === "upload-and-verify" &&
        report?.remote?.status === "verified" &&
        report?.ledgerMutationPerformed === false &&
        fragment?.delivery?.status === "uploaded_verified",
      "Every artwork activation input must be a verified, secret-free upload report",
    );
    requireCondition(!seen.has(fragment.assetId), `Duplicate delivery report ${fragment.assetId}`);
    seen.add(fragment.assetId);

    const asset = assetsById.get(fragment.assetId);
    requireCondition(asset, `Delivery report references unknown asset ${fragment.assetId}`);
    requireCondition(
      asset.catalogId === fragment.catalogId && report.catalogId === fragment.catalogId,
      `${fragment.assetId} catalog identity does not match the ledger`,
    );
    requireCondition(
      asset.review?.status === "approved" &&
        asset.review?.subjectMatchesCatalog === true &&
        asset.review?.nonCopyrightRestrictionsReviewed === true,
      `${fragment.assetId} has not passed accountable rights and subject review`,
    );
    requireCondition(
      asset.publicSnapshotAllowed === false && asset.rasterExportAllowed === false,
      `${fragment.assetId} has an unrelated sharing purpose already enabled`,
    );
    requireCondition(
      report.remote.publicAssetBaseUrl === nextLedger.publicAssetBaseUrl,
      `${fragment.assetId} was verified against a different public asset base`,
    );
    requireCondition(
      Array.isArray(fragment.delivery.variants) &&
        fragment.delivery.variants.length === 2 &&
        new Set(fragment.delivery.variants.map((variant) => variant.role)).size === 2 &&
        fragment.delivery.variants.every((variant) =>
          ["card", "detail"].includes(variant.role) &&
          clean(variant.objectPath).startsWith(nextLedger.storagePrefix)),
      `${fragment.assetId} does not contain the expected immutable card and detail variants`,
    );

    asset.modifications = [...REQUIRED_MODIFICATIONS];
    asset.delivery = clone(fragment.delivery);
    asset.attributionCompliance = {
      attributionSurface: "detail-and-credits",
      sourceLinkAvailable: true,
      licenseLinkAvailable: true,
      modificationsDisclosed: true,
    };
    if (asset.licenseId.includes("BY-SA")) {
      asset.shareAlikeCompliance = {
        adapterLicenseId: asset.licenseId,
        adapterLicenseUrl: asset.licenseUrl,
        modificationsDisclosed: true,
        attributionSurface: "detail-and-credits",
        noAdditionalRestrictions: true,
      };
    } else {
      delete asset.shareAlikeCompliance;
    }
    asset.uiDisplayAllowed = true;
    asset.publicSnapshotAllowed = false;
    asset.rasterExportAllowed = false;
    links.push({ catalogId: asset.catalogId, assetId: asset.assetId });
  }

  nextLedger.ledgerVersion = clean(ledgerVersion);
  nextLedger.updatedAt = clean(activatedAt);
  return {
    ledger: nextLedger,
    links: links.sort((left, right) => left.catalogId.localeCompare(right.catalogId, "en")),
  };
};

const parseArgs = (argv) => {
  const options = { apply: false, expectedCount: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--reports") options.reports = argv[++index];
    else if (argument === "--ledger-version") options.ledgerVersion = argv[++index];
    else if (argument === "--activated-at") options.activatedAt = argv[++index];
    else if (argument === "--expected-count") options.expectedCount = Number(argv[++index]);
    else if (argument === "--confirm-activation") options.confirmation = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
};

export const runDogArtworkActivation = (argv = process.argv.slice(2)) => {
  const options = parseArgs(argv);
  requireCondition(clean(options.reports), "--reports is required");
  const reportPaths = fs
    .readdirSync(path.resolve(options.reports))
    .filter((name) => name.endsWith(".artwork-delivery.json"))
    .sort()
    .map((name) => path.join(path.resolve(options.reports), name));
  if (options.expectedCount !== null) {
    requireCondition(
      reportPaths.length === options.expectedCount,
      `Expected ${options.expectedCount} reports but found ${reportPaths.length}`,
    );
  }
  const ledger = JSON.parse(fs.readFileSync(DEFAULT_LEDGER, "utf8"));
  const reports = reportPaths.map((reportPath) =>
    JSON.parse(fs.readFileSync(reportPath, "utf8")),
  );
  const activated = activateDogArtworkDeliveries({
    ledger,
    reports,
    ledgerVersion: options.ledgerVersion,
    activatedAt: options.activatedAt,
  });
  process.stdout.write(
    `Validated ${activated.links.length} verified deliveries for UI-only activation.\n`,
  );
  if (!options.apply) {
    process.stdout.write("Dry run only; pass --apply with the exact confirmation to write files.\n");
    return activated;
  }
  requireCondition(
    options.confirmation === CONFIRMATION,
    `--apply requires --confirm-activation ${CONFIRMATION}`,
  );
  const overridesSource = fs.readFileSync(DEFAULT_OVERRIDES, "utf8");
  fs.writeFileSync(DEFAULT_LEDGER, `${JSON.stringify(activated.ledger, null, 2)}\n`);
  fs.writeFileSync(
    DEFAULT_OVERRIDES,
    applyDogArtworkLinksToOverrides(overridesSource, activated.links),
  );
  process.stdout.write("Activated verified Dogs artwork in the rights ledger and catalog overrides.\n");
  return activated;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    runDogArtworkActivation();
  } catch (error) {
    process.stderr.write(`Dogs artwork activation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
