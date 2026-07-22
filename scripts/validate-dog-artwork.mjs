#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = {
  ledger: path.join(ROOT, "data", "dogs", "image-rights.json"),
  policy: path.join(ROOT, "data", "dogs", "artwork-license-policy.json"),
  catalog: path.join(ROOT, "data", "dogs", "dog-catalog.json"),
  packs: path.join(ROOT, "data", "dogs", "packs.json"),
  report: path.join(ROOT, "data", "dogs", "artwork-coverage-report.json"),
};

const ALLOWED_ASSET_KEYS = new Set([
  "assetId",
  "catalogId",
  "sourceProvider",
  "discoveredVia",
  "sourcePage",
  "sourcePageRevision",
  "originalUrl",
  "title",
  "creator",
  "creatorUrl",
  "licenseId",
  "license",
  "licenseVersion",
  "licenseUrl",
  "sourceLicenseLabel",
  "sourceLicenseUrl",
  "sourceCredit",
  "sourceAttributionRequired",
  "publicDomainBasis",
  "attribution",
  "retrievedAt",
  "sourceSha256",
  "sourceSha1",
  "sourceMime",
  "sourceBytes",
  "sourceWidth",
  "sourceHeight",
  "modifications",
  "review",
  "uiDisplayAllowed",
  "publicSnapshotAllowed",
  "rasterExportAllowed",
  "rasterCompliance",
  "attributionCompliance",
  "shareAlikeCompliance",
  "delivery",
]);
const ALLOWED_LEDGER_KEYS = new Set([
  "schemaVersion",
  "ledgerVersion",
  "catalogVersion",
  "policyVersion",
  "storagePrefix",
  "publicAssetBaseUrl",
  "updatedAt",
  "assets",
]);
const ALLOWED_REVISION_KEYS = new Set(["id", "timestamp"]);
const ALLOWED_DISCOVERY_KEYS = new Set(["provider", "id", "landingPage", "retrievedAt"]);
const ALLOWED_REVIEW_KEYS = new Set([
  "status",
  "reviewedAt",
  "reviewedBy",
  "rightsNotes",
  "subjectMatchesCatalog",
  "nonCopyrightRestrictionsReviewed",
]);
const ALLOWED_DELIVERY_KEYS = new Set(["status", "variants"]);
const ALLOWED_VARIANT_KEYS = new Set([
  "role",
  "width",
  "height",
  "mime",
  "bytes",
  "sha256",
  "objectPath",
]);
const ALLOWED_RASTER_COMPLIANCE_KEYS = new Set([
  "attributionEmbedded",
  "licenseLinkEmbedded",
  "modificationsEmbedded",
  "adapterLicense",
  "shareAlikeNoticeEmbedded",
]);
const ALLOWED_SHARE_ALIKE_COMPLIANCE_KEYS = new Set([
  "adapterLicenseId",
  "adapterLicenseUrl",
  "modificationsDisclosed",
  "attributionSurface",
  "noAdditionalRestrictions",
]);
const ALLOWED_ATTRIBUTION_COMPLIANCE_KEYS = new Set([
  "attributionSurface",
  "sourceLinkAvailable",
  "licenseLinkAvailable",
  "modificationsDisclosed",
]);

const ALLOWED_MODIFICATIONS = new Set([
  "none",
  "crop",
  "resize",
  "orientation normalization",
  "webp conversion",
]);
const ALLOWED_REVIEW_STATUSES = new Set(["pending", "approved", "quarantined", "retired"]);
const ALLOWED_DELIVERY_STATUSES = new Set([
  "not_ready",
  "bundled_verified",
  "uploaded_verified",
  "retired",
]);
const READY_DELIVERY_STATUSES = new Set(["bundled_verified", "uploaded_verified"]);
const ALLOWED_SOURCE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CURRENT_STATUSES = new Set([
  "canonical",
  "breed",
  "variety",
  "regional",
  "landrace",
  "crossbreed",
  "type",
]);

const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);
const cleanString = (value) => (typeof value === "string" ? value.trim() : "");
const isSha256 = (value) => /^[a-f0-9]{64}$/.test(cleanString(value));
const isSha1 = (value) => /^[a-f0-9]{40}$/.test(cleanString(value));
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(cleanString(value));
const isDateTime = (value) => {
  if (!cleanString(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && /T/.test(value);
};
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const normalizeLicenseUrl = (value) => {
  const raw = cleanString(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.protocol = "https:";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/deed(?:\.[a-z-]+)?\/?$/i, "/");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url.toString();
  } catch {
    return raw;
  }
};

export const resolveAllowedLicense = (policy, { licenseId, license, licenseUrl } = {}) => {
  const normalizedUrl = normalizeLicenseUrl(licenseUrl);
  const sourceLabel = cleanString(license);
  return (
    asArray(policy?.licenses).find((entry) => {
      const idMatches = cleanString(licenseId) ? entry.id === licenseId : true;
      const urlMatches = normalizeLicenseUrl(entry.url) === normalizedUrl;
      const labelMatches = asArray(entry.acceptedSourceLabels).includes(sourceLabel) || entry.label === sourceLabel;
      return idMatches && urlMatches && labelMatches;
    }) || null
  );
};

const catalogRecords = (catalog) => {
  if (Array.isArray(catalog)) return catalog;
  for (const key of ["entities", "items", "catalog", "breeds"]) {
    if (Array.isArray(catalog?.[key])) return catalog[key];
  }
  return [];
};

const recordCatalogId = (record) =>
  cleanString(record?.catalogId) ||
  cleanString(record?.id) ||
  cleanString(record?.entityRef?.id) ||
  cleanString(record?.entity?.entityRef?.id);

const recordPrimaryText = (record) =>
  cleanString(record?.primaryText) ||
  cleanString(record?.displayName) ||
  cleanString(record?.name) ||
  recordCatalogId(record);

const recordPrimaryAssetId = (record) =>
  cleanString(record?.primaryImageAssetId) ||
  cleanString(record?.imageAssetId) ||
  cleanString(record?.image?.assetId) ||
  cleanString(record?.snapshot?.image?.assetId);

const isSelectableRecord = (record) => {
  if (record?.selectable === false) return false;
  if (record?.selectable === true) return true;
  const disposition = cleanString(record?.disposition).toLowerCase();
  return ["canonical", "variety", "crossbreed", "historical"].includes(disposition);
};

const isCurrentSelectableRecord = (record) => {
  if (!isSelectableRecord(record)) return false;
  const disposition = cleanString(record?.disposition).toLowerCase();
  const status = cleanString(record?.status || record?.catalogStatus).toLowerCase();
  if (disposition === "historical" || status === "historical" || status === "extinct") return false;
  if (record?.current === false) return false;
  if (!status) return ["canonical", "variety", "crossbreed"].includes(disposition);
  return CURRENT_STATUSES.has(status);
};

const isCurrentCanonicalRecord = (record) => {
  if (!isCurrentSelectableRecord(record)) return false;
  const disposition = cleanString(record?.disposition).toLowerCase();
  const status = cleanString(record?.status || record?.catalogStatus).toLowerCase();
  return ["canonical", "breed"].includes(status) || (!status && disposition === "canonical");
};

const packRecords = (packs) => {
  if (Array.isArray(packs)) return packs;
  for (const key of ["packs", "items"]) {
    if (Array.isArray(packs?.[key])) return packs[key];
  }
  return [];
};

const packIsPromoted = (pack) =>
  pack?.promoted === true ||
  pack?.starter === true ||
  pack?.isStarter === true ||
  asArray(pack?.placements).some((placement) => ["starter", "homepage", "promoted"].includes(placement));

const packCatalogIds = (pack) => {
  const entries =
    pack?.catalogIds || pack?.items || pack?.entities || pack?.breeds || pack?.members || [];
  return asArray(entries)
    .map((item) => (typeof item === "string" ? item : recordCatalogId(item)))
    .filter(Boolean);
};

const ratio = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);
const percent = (numerator, denominator) => Number((ratio(numerator, denominator) * 100).toFixed(2));

const PURPOSE_GATE_BY_FIELD = {
  uiDisplayAllowed: "uiDisplay",
  publicSnapshotAllowed: "publicSnapshot",
  rasterExportAllowed: "rasterExport",
};

const purposeReady = (asset, purpose, policy) => {
  const attribution = asset?.attributionCompliance;
  const license = resolveAllowedLicense(policy, asset);
  const shareAlikeReady =
    !license?.shareAlike ||
    (asset?.shareAlikeCompliance?.adapterLicenseId === license.id &&
      normalizeLicenseUrl(asset?.shareAlikeCompliance?.adapterLicenseUrl) ===
        normalizeLicenseUrl(license.url) &&
      asset?.shareAlikeCompliance?.modificationsDisclosed === true &&
      asset?.shareAlikeCompliance?.attributionSurface === "detail-and-credits" &&
      asset?.shareAlikeCompliance?.noAdditionalRestrictions === true);
  return (
    license != null &&
    policy?.purposeGates?.[PURPOSE_GATE_BY_FIELD[purpose]]?.enabled === true &&
    asset?.review?.status === "approved" &&
    asset?.review?.subjectMatchesCatalog === true &&
    asset?.review?.nonCopyrightRestrictionsReviewed === true &&
    READY_DELIVERY_STATUSES.has(asset?.delivery?.status) &&
    attribution?.attributionSurface === "detail-and-credits" &&
    attribution?.sourceLinkAvailable === true &&
    attribution?.licenseLinkAvailable === true &&
    attribution?.modificationsDisclosed === true &&
    shareAlikeReady &&
    asset?.[purpose] === true
  );
};

const validateUnknownKeys = (asset, index, errors) => {
  Object.keys(asset).forEach((key) => {
    if (!ALLOWED_ASSET_KEYS.has(key)) errors.push(`assets[${index}] has unsupported field ${key}`);
  });
};

const validateObjectKeys = (object, allowed, label, errors) => {
  if (!isObject(object)) return;
  Object.keys(object).forEach((key) => {
    if (!allowed.has(key)) errors.push(`${label} has unsupported field ${key}`);
  });
};

const validateAsset = ({ asset, index, ledger, policy, catalogById, errors, warnings }) => {
  const label = cleanString(asset?.assetId) || `assets[${index}]`;
  if (!isObject(asset)) {
    errors.push(`assets[${index}] must be an object`);
    return;
  }
  validateUnknownKeys(asset, index, errors);

  if (!/^dogs:photo:[a-z0-9-]+:[a-f0-9]{16}$/.test(cleanString(asset.assetId))) {
    errors.push(`${label}: invalid assetId`);
  }
  if (!/^VBO:\d{7}$/.test(cleanString(asset.catalogId))) errors.push(`${label}: invalid catalogId`);
  if (catalogById && !catalogById.has(asset.catalogId)) {
    errors.push(`${label}: catalogId ${asset.catalogId} is not in the runtime catalog`);
  }
  if (!asArray(policy?.sourceRules?.approvedProviders).includes(asset.sourceProvider)) {
    errors.push(`${label}: unsupported sourceProvider ${asset.sourceProvider || "(missing)"}`);
  }
  if (!isHttpsUrl(asset.sourcePage)) errors.push(`${label}: sourcePage must be an HTTPS URL`);
  if (!isHttpsUrl(asset.originalUrl)) errors.push(`${label}: originalUrl must be an HTTPS URL`);
  if (asset.sourceProvider === "wikimedia-commons") {
    try {
      const page = new URL(asset.sourcePage);
      const original = new URL(asset.originalUrl);
      if (page.hostname !== "commons.wikimedia.org") {
        errors.push(`${label}: Commons sourcePage must use commons.wikimedia.org`);
      }
      if (original.hostname !== "upload.wikimedia.org") {
        errors.push(`${label}: Commons originalUrl must use upload.wikimedia.org`);
      }
    } catch {
      // URL shape already reported.
    }
  }
  validateObjectKeys(asset.sourcePageRevision, ALLOWED_REVISION_KEYS, `${label}: sourcePageRevision`, errors);
  if (!Number.isInteger(asset?.sourcePageRevision?.id) || asset.sourcePageRevision.id < 1) {
    errors.push(`${label}: sourcePageRevision.id must be a positive integer`);
  }
  if (!isDateTime(asset?.sourcePageRevision?.timestamp)) {
    errors.push(`${label}: sourcePageRevision.timestamp must be an ISO date-time`);
  }
  if (!cleanString(asset.title) || /[<>]/.test(asset.title)) errors.push(`${label}: title must be plain text`);
  const creator = cleanString(asset.creator);
  if (!creator || /^(unknown|anonymous|n\/a)$/i.test(creator) || /[<>]/.test(creator)) {
    errors.push(`${label}: creator must be verified plain text`);
  }
  if (asset.creatorUrl != null && !isHttpsUrl(asset.creatorUrl)) {
    errors.push(`${label}: creatorUrl must be null or an HTTPS URL`);
  }
  if (asset.discoveredVia != null) {
    validateObjectKeys(asset.discoveredVia, ALLOWED_DISCOVERY_KEYS, `${label}: discoveredVia`, errors);
    if (asset.discoveredVia?.provider !== "openverse") errors.push(`${label}: discoveredVia.provider must be openverse`);
    if (!cleanString(asset.discoveredVia?.id)) errors.push(`${label}: discoveredVia.id is required`);
    if (!isHttpsUrl(asset.discoveredVia?.landingPage)) {
      errors.push(`${label}: discoveredVia.landingPage must be an HTTPS original landing page`);
    }
    if (!isDateTime(asset.discoveredVia?.retrievedAt)) {
      errors.push(`${label}: discoveredVia.retrievedAt must be an ISO date-time`);
    }
  }

  const license = resolveAllowedLicense(policy, asset);
  if (!license) {
    errors.push(`${label}: license id, label, and canonical URL do not match the allowlist`);
  } else {
    if (asset.licenseId !== license.id) errors.push(`${label}: licenseId does not match policy`);
    if (asset.licenseVersion !== license.version) errors.push(`${label}: licenseVersion does not match policy`);
    if (!license.commercialUse || !license.derivatives) {
      errors.push(`${label}: license does not explicitly permit commercial use and derivatives`);
    }
    if (license.manualPublicDomainEvidence && !cleanString(asset.publicDomainBasis)) {
      errors.push(`${label}: public-domain rows require publicDomainBasis`);
    }
    if (!asArray(license.acceptedSourceLabels).includes(cleanString(asset.sourceLicenseLabel))) {
      errors.push(`${label}: sourceLicenseLabel does not match the selected license`);
    }
    if (normalizeLicenseUrl(asset.sourceLicenseUrl) !== normalizeLicenseUrl(license.url)) {
      errors.push(`${label}: sourceLicenseUrl does not resolve to the selected canonical license`);
    }
    if (license.requiresAttribution && asset.sourceAttributionRequired !== true) {
      errors.push(`${label}: source attribution metadata contradicts an attribution-required license`);
    }
  }
  if (!cleanString(asset.sourceLicenseUrl)) errors.push(`${label}: sourceLicenseUrl is required`);
  if (typeof asset.sourceCredit !== "string" || /[<>]/.test(asset.sourceCredit)) {
    errors.push(`${label}: sourceCredit must be normalized plain text`);
  }
  if (typeof asset.sourceAttributionRequired !== "boolean") {
    errors.push(`${label}: sourceAttributionRequired must be explicit boolean`);
  }

  const attribution = cleanString(asset.attribution).toLowerCase();
  if (!attribution || !attribution.includes(creator.toLowerCase())) {
    errors.push(`${label}: attribution must identify the creator`);
  }
  if (license && !attribution.includes(license.label.toLowerCase())) {
    errors.push(`${label}: attribution must identify the exact license`);
  }
  if (/[<>]/.test(cleanString(asset.attribution))) errors.push(`${label}: attribution must be plain text`);
  if (!isDateTime(asset.retrievedAt)) errors.push(`${label}: retrievedAt must be an ISO date-time`);
  if (!isSha256(asset.sourceSha256)) errors.push(`${label}: sourceSha256 must be 64 lowercase hex characters`);
  if (!isSha1(asset.sourceSha1)) errors.push(`${label}: sourceSha1 must be 40 lowercase hex characters`);
  if (!ALLOWED_SOURCE_MIMES.has(asset.sourceMime)) errors.push(`${label}: unsupported sourceMime`);
  if (!Number.isInteger(asset.sourceBytes) || asset.sourceBytes < 1 || asset.sourceBytes > 52_428_800) {
    errors.push(`${label}: sourceBytes must be between 1 and 50 MiB`);
  }
  if (!Number.isInteger(asset.sourceWidth) || asset.sourceWidth < 1) errors.push(`${label}: sourceWidth invalid`);
  if (!Number.isInteger(asset.sourceHeight) || asset.sourceHeight < 1) errors.push(`${label}: sourceHeight invalid`);

  const modifications = asArray(asset.modifications);
  if (!modifications.length) errors.push(`${label}: modifications must be explicit`);
  modifications.forEach((entry) => {
    if (!ALLOWED_MODIFICATIONS.has(entry)) errors.push(`${label}: unsupported modification ${entry}`);
  });
  if (new Set(modifications).size !== modifications.length) errors.push(`${label}: duplicate modifications`);
  if (modifications.includes("none") && modifications.length > 1) {
    errors.push(`${label}: modification "none" cannot be combined with modifications`);
  }

  const review = asset.review;
  validateObjectKeys(review, ALLOWED_REVIEW_KEYS, `${label}: review`, errors);
  if (/[<>]/.test(cleanString(review?.rightsNotes))) {
    errors.push(`${label}: review.rightsNotes must be plain text`);
  }
  if (!isObject(review) || !ALLOWED_REVIEW_STATUSES.has(review.status)) {
    errors.push(`${label}: review.status is invalid`);
  } else if (review.status === "approved") {
    if (!isDate(review.reviewedAt)) errors.push(`${label}: approved row requires review.reviewedAt`);
    if (!cleanString(review.reviewedBy)) errors.push(`${label}: approved row requires review.reviewedBy`);
    if (!cleanString(review.rightsNotes)) errors.push(`${label}: approved row requires review.rightsNotes`);
    if (review.subjectMatchesCatalog !== true) {
      errors.push(`${label}: approved row requires human-confirmed subjectMatchesCatalog`);
    }
    if (review.nonCopyrightRestrictionsReviewed !== true) {
      errors.push(`${label}: approved row requires nonCopyrightRestrictionsReviewed`);
    }
  } else {
    if (asset.uiDisplayAllowed || asset.publicSnapshotAllowed || asset.rasterExportAllowed) {
      errors.push(`${label}: non-approved rows must deny every purpose`);
    }
  }

  for (const [field, gate] of [
    ["uiDisplayAllowed", "uiDisplay"],
    ["publicSnapshotAllowed", "publicSnapshot"],
    ["rasterExportAllowed", "rasterExport"],
  ]) {
    if (typeof asset[field] !== "boolean") errors.push(`${label}: ${field} must be explicit boolean`);
    if (asset[field] === true && policy?.purposeGates?.[gate]?.enabled !== true) {
      errors.push(`${label}: ${field} is true while policy gate ${gate} is disabled`);
    }
  }
  if (asset.publicSnapshotAllowed && !asset.uiDisplayAllowed) {
    errors.push(`${label}: publicSnapshotAllowed requires uiDisplayAllowed`);
  }
  if (asset.rasterExportAllowed && !asset.publicSnapshotAllowed) {
    errors.push(`${label}: rasterExportAllowed requires publicSnapshotAllowed`);
  }

  const delivery = asset.delivery;
  validateObjectKeys(delivery, ALLOWED_DELIVERY_KEYS, `${label}: delivery`, errors);
  if (!isObject(delivery) || !ALLOWED_DELIVERY_STATUSES.has(delivery.status)) {
    errors.push(`${label}: delivery.status is invalid`);
  } else {
    const variants = asArray(delivery.variants);
    if (READY_DELIVERY_STATUSES.has(delivery.status)) {
      const roles = variants.map((variant) => variant?.role);
      if (!roles.includes("card") || !roles.includes("detail")) {
        errors.push(`${label}: ready delivery requires card and detail variants`);
      }
      if (modifications.includes("none")) errors.push(`${label}: ready delivery cannot declare no modifications`);
      if (!modifications.includes("resize") || !modifications.includes("webp conversion")) {
        errors.push(`${label}: ready delivery must declare resize and webp conversion`);
      }
      variants.forEach((variant, variantIndex) => {
        const variantLabel = `${label}: delivery.variants[${variantIndex}]`;
        validateObjectKeys(variant, ALLOWED_VARIANT_KEYS, variantLabel, errors);
        if (!new Set(["card", "detail"]).has(variant?.role)) errors.push(`${variantLabel} role invalid`);
        if (variant?.mime !== "image/webp") errors.push(`${variantLabel} must be image/webp`);
        if (!Number.isInteger(variant?.width) || variant.width < 1) errors.push(`${variantLabel} width invalid`);
        if (!Number.isInteger(variant?.height) || variant.height < 1) errors.push(`${variantLabel} height invalid`);
        if (!Number.isInteger(variant?.bytes) || variant.bytes < 1) errors.push(`${variantLabel} bytes invalid`);
        if (!isSha256(variant?.sha256)) errors.push(`${variantLabel} sha256 invalid`);
        const objectPath = cleanString(variant?.objectPath);
        if (
          !objectPath.startsWith(ledger.storagePrefix) ||
          !objectPath.endsWith(".webp") ||
          !/^[a-z0-9/.-]+$/.test(objectPath) ||
          objectPath.includes("..")
        ) {
          errors.push(`${variantLabel} objectPath must be immutable under ${ledger.storagePrefix}`);
        }
      });
      if (new Set(roles).size !== roles.length) errors.push(`${label}: duplicate delivery roles`);
    } else if (variants.length) {
      errors.push(`${label}: non-ready delivery must not advertise variants`);
    }
    if (
      (asset.uiDisplayAllowed || asset.publicSnapshotAllowed || asset.rasterExportAllowed) &&
      !READY_DELIVERY_STATUSES.has(delivery.status)
    ) {
      errors.push(`${label}: an allowed purpose requires byte-verified delivery`);
    }
  }

  if (license?.shareAlike && READY_DELIVERY_STATUSES.has(delivery?.status)) {
    const compliance = asset.shareAlikeCompliance;
    validateObjectKeys(
      compliance,
      ALLOWED_SHARE_ALIKE_COMPLIANCE_KEYS,
      `${label}: shareAlikeCompliance`,
      errors,
    );
    if (
      !isObject(compliance) ||
      compliance.adapterLicenseId !== license.id ||
      normalizeLicenseUrl(compliance.adapterLicenseUrl) !== normalizeLicenseUrl(license.url) ||
      compliance.modificationsDisclosed !== true ||
      compliance.attributionSurface !== "detail-and-credits" ||
      compliance.noAdditionalRestrictions !== true
    ) {
      errors.push(
        `${label}: ready ShareAlike delivery requires the same license, disclosed modifications, detail/credits attribution, and no added restrictions`,
      );
    }
  } else if (asset.shareAlikeCompliance) {
    warnings.push(`${label}: shareAlikeCompliance is present but no ready ShareAlike delivery requires it`);
  }

  if (READY_DELIVERY_STATUSES.has(delivery?.status)) {
    const compliance = asset.attributionCompliance;
    validateObjectKeys(
      compliance,
      ALLOWED_ATTRIBUTION_COMPLIANCE_KEYS,
      `${label}: attributionCompliance`,
      errors,
    );
    if (
      !isObject(compliance) ||
      compliance.attributionSurface !== "detail-and-credits" ||
      compliance.sourceLinkAvailable !== true ||
      compliance.licenseLinkAvailable !== true ||
      compliance.modificationsDisclosed !== true
    ) {
      errors.push(
        `${label}: ready delivery requires attribution, source/license links, and modification disclosure on detail and credits surfaces`,
      );
    }
  } else if (asset.attributionCompliance) {
    warnings.push(`${label}: attributionCompliance is present while delivery is not ready`);
  }

  if (asset.rasterExportAllowed) {
    const compliance = asset.rasterCompliance;
    validateObjectKeys(
      compliance,
      ALLOWED_RASTER_COMPLIANCE_KEYS,
      `${label}: rasterCompliance`,
      errors,
    );
    if (
      !isObject(compliance) ||
      compliance.attributionEmbedded !== true ||
      compliance.licenseLinkEmbedded !== true ||
      compliance.modificationsEmbedded !== true ||
      !cleanString(compliance.adapterLicense)
    ) {
      errors.push(`${label}: raster export requires embedded attribution/license/modification compliance`);
    }
    if (license?.shareAlike && compliance?.shareAlikeNoticeEmbedded !== true) {
      errors.push(`${label}: ShareAlike raster export requires an embedded ShareAlike notice`);
    }
  } else if (asset.rasterCompliance) {
    warnings.push(`${label}: rasterCompliance is present while raster export remains denied`);
  }
};

export const buildArtworkCoverageReport = ({ ledger, policy, catalog = null, packs = null }) => {
  const records = catalogRecords(catalog);
  const selectable = records.filter(isSelectableRecord);
  const currentSelectable = records.filter(isCurrentSelectableRecord);
  const currentCanonical = records.filter(isCurrentCanonicalRecord);
  const assets = asArray(ledger?.assets);
  const assetsByCatalog = new Map();
  assets.forEach((asset) => {
    const entries = assetsByCatalog.get(asset.catalogId) || [];
    entries.push(asset);
    assetsByCatalog.set(asset.catalogId, entries);
  });
  const covered = (record, purpose) =>
    asArray(assetsByCatalog.get(recordCatalogId(record))).some((asset) =>
      purposeReady(asset, purpose, policy),
    );

  const promotedIds = new Set(
    packRecords(packs)
      .filter(packIsPromoted)
      .flatMap(packCatalogIds),
  );
  records.forEach((record) => {
    if (record?.promoted === true) promotedIds.add(recordCatalogId(record));
  });
  const promotedRecords = records.filter((record) => promotedIds.has(recordCatalogId(record)));

  const countCovered = (set, purpose) => set.filter((record) => covered(record, purpose)).length;
  const uiSelectable = countCovered(selectable, "uiDisplayAllowed");
  const uiCurrentSelectable = countCovered(currentSelectable, "uiDisplayAllowed");
  const uiCurrent = countCovered(currentCanonical, "uiDisplayAllowed");
  const uiPromoted = countCovered(promotedRecords, "uiDisplayAllowed");
  const snapshotSelectable = countCovered(selectable, "publicSnapshotAllowed");
  const rasterSelectable = countCovered(selectable, "rasterExportAllowed");
  const approvedAssets = assets.filter((asset) => asset?.review?.status === "approved");
  const distribution = (rows, field) => {
    const counts = {};
    rows.forEach((row) => {
      const key = cleanString(row?.[field]) || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  };

  const unresolvedEntry = (record) => {
    const catalogId = recordCatalogId(record);
    const candidates = asArray(assetsByCatalog.get(catalogId));
    let reason = "no ledger row";
    if (candidates.some((asset) => asset?.review?.status === "pending")) reason = "human review pending";
    else if (candidates.some((asset) => asset?.review?.status === "quarantined")) reason = "candidate quarantined";
    else if (candidates.some((asset) => asset?.review?.status === "approved")) reason = "approved rights, delivery/purpose not ready";
    return { catalogId, primaryText: recordPrimaryText(record), reason };
  };
  const unresolvedFor = (set) =>
    set
      .filter((record) => !covered(record, "uiDisplayAllowed"))
      .map(unresolvedEntry)
      .sort((a, b) => a.catalogId.localeCompare(b.catalogId));
  const unresolved = unresolvedFor(selectable);
  const promotedUnresolved = unresolvedFor(promotedRecords);
  const unresolvedReasonCounts = {};
  unresolved.forEach(({ reason }) => {
    unresolvedReasonCounts[reason] = (unresolvedReasonCounts[reason] || 0) + 1;
  });

  const missingPromotedIds = [...promotedIds]
    .filter((catalogId) => !records.some((record) => recordCatalogId(record) === catalogId))
    .sort();
  const thresholds = policy?.launchThresholds || {};
  const currentThreshold = Number(thresholds.currentCanonicalUiCoverage ?? 0.95);
  const promotedThreshold = Number(thresholds.promotedUiCoverage ?? 1);
  const hasCatalog = records.length > 0;
  const promotedDenominatorKnown =
    records.some((record) => record?.promoted === true) || packRecords(packs).some(packIsPromoted);
  const launchChecks = {
    catalogLoaded: hasCatalog,
    currentCanonicalUiCoverageMet:
      hasCatalog && ratio(uiCurrent, currentCanonical.length) >= currentThreshold,
    promotedUiCoverageMet:
      promotedDenominatorKnown &&
      missingPromotedIds.length === 0 &&
      ratio(uiPromoted, promotedRecords.length) >= promotedThreshold,
    publicSnapshotGateReviewed: policy?.purposeGates?.publicSnapshot?.enabled === true,
    rasterExportGateReviewed: policy?.purposeGates?.rasterExport?.enabled === true,
  };

  return {
    schemaVersion: 1,
    ledgerVersion: ledger?.ledgerVersion || null,
    policyVersion: policy?.policyVersion || null,
    catalogVersion: catalog?.catalogVersion || catalog?.version || ledger?.catalogVersion || null,
    sourceDates: {
      ledgerUpdatedAt: ledger?.updatedAt || null,
      policyReviewedAt: policy?.reviewedAt || null,
    },
    catalog: {
      records: records.length,
      selectable: selectable.length,
      currentSelectable: currentSelectable.length,
      currentCanonical: currentCanonical.length,
      promoted: promotedRecords.length,
      missingPromotedCatalogIds: missingPromotedIds,
    },
    ledger: {
      rows: assets.length,
      approvedRightsRows: approvedAssets.length,
      pendingRows: assets.filter((asset) => asset?.review?.status === "pending").length,
      quarantinedRows: assets.filter((asset) => asset?.review?.status === "quarantined").length,
      readyDeliveryRows: assets.filter((asset) => READY_DELIVERY_STATUSES.has(asset?.delivery?.status)).length,
      allRowsLicenseDistribution: distribution(assets, "licenseId"),
      approvedLicenseDistribution: distribution(approvedAssets, "licenseId"),
      allRowsSourceProviderDistribution: distribution(assets, "sourceProvider"),
      approvedSourceProviderDistribution: distribution(approvedAssets, "sourceProvider"),
    },
    coverage: {
      uiDisplay: {
        selectableCovered: uiSelectable,
        selectableTotal: selectable.length,
        selectablePercent: percent(uiSelectable, selectable.length),
        currentSelectableCovered: uiCurrentSelectable,
        currentSelectableTotal: currentSelectable.length,
        currentSelectablePercent: percent(uiCurrentSelectable, currentSelectable.length),
        currentCanonicalCovered: uiCurrent,
        currentCanonicalTotal: currentCanonical.length,
        currentCanonicalPercent: percent(uiCurrent, currentCanonical.length),
        promotedCovered: uiPromoted,
        promotedTotal: promotedRecords.length,
        promotedPercent: percent(uiPromoted, promotedRecords.length),
      },
      publicSnapshot: {
        selectableCovered: snapshotSelectable,
        selectableTotal: selectable.length,
        selectablePercent: percent(snapshotSelectable, selectable.length),
      },
      rasterExport: {
        selectableCovered: rasterSelectable,
        selectableTotal: selectable.length,
        selectablePercent: percent(rasterSelectable, selectable.length),
      },
    },
    launchChecks,
    launchReadyForUi: Object.values({
      catalogLoaded: launchChecks.catalogLoaded,
      currentCanonicalUiCoverageMet: launchChecks.currentCanonicalUiCoverageMet,
      promotedUiCoverageMet: launchChecks.promotedUiCoverageMet,
    }).every(Boolean),
    unresolvedUiArtworkSummary: {
      total: unresolved.length,
      byReason: Object.fromEntries(
        Object.entries(unresolvedReasonCounts).sort(([a], [b]) => a.localeCompare(b)),
      ),
      promotedTotal: promotedUnresolved.length,
    },
    promotedUnresolvedUiArtwork: promotedUnresolved,
    unresolvedUiArtwork: unresolved,
    missingImageStrategy: {
      behavior: "Render the catalog identity and ranking controls with a neutral non-photographic fallback; never substitute another breed or an AI-generated breed depiction.",
      accessibleName: "Use the canonical breed/type name; do not describe the fallback as a photo.",
      visualTreatment: "Use the shared monochrome keyline, a decorative abstract paw/initial mark, and the same stable aspect box as approved photography so layout does not jump.",
      brokenImageTreatment: "On an approved asset load error, remove the failed image from accessibility and reveal the identical fallback without retrying an unverified source URL.",
      detailDisclosure: "A detail view may say ‘Photo awaiting rights review’; ranking and search cards should stay visually quiet.",
      searchAndRankingRemainAvailable: true,
      hideBrokenImages: true,
      requestUnapprovedOriginals: false,
      publicSnapshotBehavior: "Omit photography unless publicSnapshotAllowed is true for a byte-verified approved row.",
      rasterExportBehavior: "Omit photography unless rasterExportAllowed is true and export attribution compliance is present.",
    },
  };
};

export const validateArtworkLedger = ({ ledger, policy, catalog = null, packs = null, strictLaunch = false }) => {
  const errors = [];
  const warnings = [];
  if (!isObject(ledger)) return { errors: ["ledger must be an object"], warnings, report: null };
  validateObjectKeys(ledger, ALLOWED_LEDGER_KEYS, "ledger", errors);
  if (ledger.schemaVersion !== 1) errors.push("ledger.schemaVersion must be 1");
  for (const field of [
    "ledgerVersion",
    "catalogVersion",
    "policyVersion",
    "storagePrefix",
    "publicAssetBaseUrl",
  ]) {
    if (!cleanString(ledger[field])) errors.push(`ledger.${field} is required`);
  }
  if (ledger.policyVersion !== policy?.policyVersion) errors.push("ledger.policyVersion does not match policy.policyVersion");
  const runtimeCatalogVersion = cleanString(catalog?.catalogVersion || catalog?.version);
  if (runtimeCatalogVersion && ledger.catalogVersion !== runtimeCatalogVersion) {
    errors.push(
      `ledger.catalogVersion ${ledger.catalogVersion} does not match runtime catalog ${runtimeCatalogVersion}`,
    );
  }
  if (!/^dogs-catalog\/[a-z0-9.-]+\/$/.test(cleanString(ledger.storagePrefix))) {
    errors.push("ledger.storagePrefix must be an immutable dogs-catalog version prefix");
  }
  try {
    const publicAssetBaseUrl = new URL(cleanString(ledger.publicAssetBaseUrl));
    if (
      publicAssetBaseUrl.protocol !== "https:" ||
      publicAssetBaseUrl.username ||
      publicAssetBaseUrl.password ||
      publicAssetBaseUrl.search ||
      publicAssetBaseUrl.hash ||
      publicAssetBaseUrl.pathname !== "/storage/v1/object/public/"
    ) {
      throw new Error("unsafe public asset base");
    }
  } catch {
    errors.push(
      "ledger.publicAssetBaseUrl must be a credential-free HTTPS Supabase public Storage URL",
    );
  }
  if (!isDate(ledger.updatedAt)) errors.push("ledger.updatedAt must be YYYY-MM-DD");
  if (!Array.isArray(ledger.assets)) errors.push("ledger.assets must be an array");

  const records = catalogRecords(catalog);
  const catalogById = records.length
    ? new Map(records.map((record) => [recordCatalogId(record), record]).filter(([id]) => id))
    : null;
  if (!catalogById) warnings.push("runtime catalog not loaded; catalog referential coverage is not verified");
  const assets = asArray(ledger.assets);
  assets.forEach((asset, index) =>
    validateAsset({ asset, index, ledger, policy, catalogById, errors, warnings }),
  );

  const duplicateValues = (values) =>
    [...new Set(values.filter(Boolean))].filter((value) => values.filter((candidate) => candidate === value).length > 1);
  duplicateValues(assets.map((asset) => asset?.assetId)).forEach((assetId) => {
    errors.push(`duplicate assetId ${assetId}`);
  });
  duplicateValues(assets.map((asset) => asset?.sourceSha256)).forEach((hash) => {
    errors.push(`duplicate sourceSha256 ${hash}`);
  });
  duplicateValues(assets.map((asset) => asset?.originalUrl)).forEach((url) => {
    errors.push(`duplicate originalUrl ${url}`);
  });

  if (catalogById) {
    records.forEach((record) => {
      const assetId = recordPrimaryAssetId(record);
      if (!assetId) return;
      const asset = assets.find((candidate) => candidate.assetId === assetId);
      const catalogId = recordCatalogId(record);
      if (!asset) errors.push(`${catalogId}: primaryImageAssetId ${assetId} has no ledger row`);
      else if (asset.catalogId !== catalogId) errors.push(`${catalogId}: primary image belongs to ${asset.catalogId}`);
      else if (!purposeReady(asset, "uiDisplayAllowed", policy)) {
        errors.push(`${catalogId}: primary image is not approved and byte-ready for UI display`);
      }
    });
  }

  const report = buildArtworkCoverageReport({ ledger, policy, catalog, packs });
  if (strictLaunch && !report.launchReadyForUi) {
    if (!report.launchChecks.catalogLoaded) errors.push("launch: runtime catalog is not loaded");
    if (!report.launchChecks.currentCanonicalUiCoverageMet) {
      errors.push(
        `launch: current canonical UI coverage is ${report.coverage.uiDisplay.currentCanonicalPercent}% (requires ${Number(policy?.launchThresholds?.currentCanonicalUiCoverage ?? 0.95) * 100}%)`,
      );
    }
    if (!report.launchChecks.promotedUiCoverageMet) {
      errors.push(
        `launch: promoted UI coverage is ${report.coverage.uiDisplay.promotedPercent}% (requires ${Number(policy?.launchThresholds?.promotedUiCoverage ?? 1) * 100}%)`,
      );
    }
  }
  return { errors, warnings, report };
};

const readJson = async (filename, { optional = false } = {}) => {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    throw new Error(`Cannot read ${path.relative(ROOT, filename)}: ${error.message}`);
  }
};

const parseCli = (argv) => {
  const options = { ...DEFAULTS, strictLaunch: false, writeReport: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict-launch") options.strictLaunch = true;
    else if (arg === "--no-report") options.writeReport = false;
    else if (["--ledger", "--policy", "--catalog", "--packs", "--report"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a path`);
      options[arg.slice(2)] = path.resolve(value);
      index += 1;
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
};

const printHelp = () => {
  console.log(`Validate the StackRank Dogs image-rights ledger and generate deterministic coverage.\n\nUsage:\n  node scripts/validate-dog-artwork.mjs [options]\n\nOptions:\n  --ledger <path>         Rights ledger (default data/dogs/image-rights.json)\n  --policy <path>         License policy\n  --catalog <path>        Runtime catalog; optional while catalog work is in flight\n  --packs <path>          Pack library; optional while editorial work is in flight\n  --report <path>         Coverage report output\n  --strict-launch         Fail on the 95% current / 100% promoted UI coverage gates\n  --no-report             Do not write the coverage report\n  --help                  Show this help\n`);
};

const main = async () => {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const [ledger, policy, catalog, packs] = await Promise.all([
    readJson(options.ledger),
    readJson(options.policy),
    readJson(options.catalog, { optional: true }),
    readJson(options.packs, { optional: true }),
  ]);
  const result = validateArtworkLedger({
    ledger,
    policy,
    catalog,
    packs,
    strictLaunch: options.strictLaunch,
  });
  if (options.writeReport && result.report) {
    await writeFile(options.report, `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
  }
  console.log(
    JSON.stringify(
      {
        assets: ledger.assets?.length || 0,
        approvedRights: result.report?.ledger?.approvedRightsRows || 0,
        readyForUi: result.report?.coverage?.uiDisplay?.selectableCovered || 0,
        selectableCatalogEntries: result.report?.coverage?.uiDisplay?.selectableTotal || 0,
        currentCanonicalUiCoverage: `${result.report?.coverage?.uiDisplay?.currentCanonicalPercent || 0}%`,
        promotedUiCoverage: `${result.report?.coverage?.uiDisplay?.promotedPercent || 0}%`,
        launchReadyForUi: result.report?.launchReadyForUi || false,
        errors: result.errors.length,
        warnings: result.warnings.length,
      },
      null,
      2,
    ),
  );
  result.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  if (result.errors.length) {
    console.error(`\n${result.errors.length} artwork validation error${result.errors.length === 1 ? "" : "s"}:`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log("\nDog artwork structural validation passed.");
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
