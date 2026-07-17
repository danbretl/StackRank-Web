import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCommonsLedgerCandidate,
  buildCommonsMetadataUrl,
  buildOpenverseSearchUrl,
  hashRemoteOriginal,
  normalizeCommonsFileTitle,
  normalizeCommonsReference,
  normalizeCommonsMetadata,
  normalizeOpenverseDiscovery,
  plainTextFromHtml,
} from "../scripts/fetch-dog-artwork.mjs";
import {
  buildArtworkMagickArgs,
  parseArtworkCrop,
} from "../scripts/process-dog-artwork.mjs";
import {
  buildArtworkCoverageReport,
  normalizeLicenseUrl,
  resolveAllowedLicense,
  validateArtworkLedger,
} from "../scripts/validate-dog-artwork.mjs";

const root = new URL("../", import.meta.url);
const fixture = async (name) =>
  JSON.parse(await readFile(new URL(`data/dogs/artwork-fixtures/${name}`, root), "utf8"));
const policy = await fixture("../artwork-license-policy.json");

const sha256 = "a".repeat(64);
const sha1 = "b".repeat(40);
const baseLedger = (assets = []) => ({
  schemaVersion: 1,
  ledgerVersion: "test.1",
  catalogVersion: "vbo-2026-04-15",
  policyVersion: policy.policyVersion,
  storagePrefix: "dogs-catalog/vbo-2026-04-15-r1/",
  updatedAt: "2026-07-16",
  assets,
});

const approvedAsset = (overrides = {}) => ({
  assetId: "dogs:photo:commons:aaaaaaaaaaaaaaaa",
  catalogId: "VBO:0000661",
  sourceProvider: "wikimedia-commons",
  sourcePage: "https://commons.wikimedia.org/wiki/File:Example_dog.jpg",
  sourcePageRevision: { id: 456, timestamp: "2026-07-15T12:34:56Z" },
  originalUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Example_dog.jpg",
  title: "Example dog",
  creator: "Example Photographer",
  creatorUrl: "https://commons.wikimedia.org/wiki/User:Example",
  licenseId: "CC-BY-4.0",
  license: "CC BY 4.0",
  licenseVersion: "4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceLicenseLabel: "CC BY 4.0",
  sourceLicenseUrl: "https://creativecommons.org/licenses/by/4.0",
  sourceCredit: "Own work",
  sourceAttributionRequired: true,
  attribution: "Example dog — Example Photographer; CC BY 4.0; via Wikimedia Commons.",
  retrievedAt: "2026-07-16T12:00:00Z",
  sourceSha256: sha256,
  sourceSha1: sha1,
  sourceMime: "image/jpeg",
  sourceBytes: 1000,
  sourceWidth: 1200,
  sourceHeight: 800,
  modifications: ["crop", "resize", "webp conversion"],
  review: {
    status: "approved",
    reviewedAt: "2026-07-16",
    reviewedBy: "Fixture Reviewer",
    rightsNotes: "Source page, author, subject, and exact license checked.",
    subjectMatchesCatalog: true,
    nonCopyrightRestrictionsReviewed: true,
  },
  uiDisplayAllowed: true,
  publicSnapshotAllowed: false,
  rasterExportAllowed: false,
  attributionCompliance: {
    attributionSurface: "detail-and-credits",
    sourceLinkAvailable: true,
    licenseLinkAvailable: true,
    modificationsDisclosed: true,
  },
  delivery: {
    status: "uploaded_verified",
    variants: [
      {
        role: "card",
        width: 320,
        height: 213,
        mime: "image/webp",
        bytes: 12345,
        sha256: "c".repeat(64),
        objectPath:
          "dogs-catalog/vbo-2026-04-15-r1/dogs-photo-commons-aaaaaaaaaaaaaaaa-320.webp",
      },
      {
        role: "detail",
        width: 960,
        height: 640,
        mime: "image/webp",
        bytes: 45678,
        sha256: "d".repeat(64),
        objectPath:
          "dogs-catalog/vbo-2026-04-15-r1/dogs-photo-commons-aaaaaaaaaaaaaaaa-960.webp",
      },
    ],
  },
  ...overrides,
});

const catalog = (primaryImageAssetId = "dogs:photo:commons:aaaaaaaaaaaaaaaa") => ({
  catalogVersion: "vbo-2026-04-15",
  entities: [
    {
      catalogId: "VBO:0000661",
      primaryText: "Example Breed",
      disposition: "canonical",
      status: "breed",
      selectable: true,
      primaryImageAssetId,
    },
  ],
});

test("license URL normalization is exact but tolerates scheme and trailing-slash differences", () => {
  assert.equal(
    normalizeLicenseUrl("http://creativecommons.org/licenses/by-sa/4.0"),
    "https://creativecommons.org/licenses/by-sa/4.0/",
  );
  assert.equal(
    normalizeLicenseUrl("https://creativecommons.org/publicdomain/zero/1.0/deed.en"),
    "https://creativecommons.org/publicdomain/zero/1.0/",
  );
  assert.equal(
    resolveAllowedLicense(policy, {
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    })?.id,
    "CC0-1.0",
  );
  assert.equal(
    resolveAllowedLicense(policy, {
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    })?.id,
    "CC-BY-SA-4.0",
  );
  assert.equal(
    resolveAllowedLicense(policy, {
      license: "CC BY-NC 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
    }),
    null,
  );
  assert.equal(
    resolveAllowedLicense(policy, {
      license: "CC BY-ND 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/",
    }),
    null,
  );
  assert.equal(
    resolveAllowedLicense(policy, {
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    }),
    null,
    "a permissive-looking label cannot override a different URL",
  );
});

test("Commons file input normalization accepts exact titles and canonical file URLs", () => {
  assert.equal(normalizeCommonsFileTitle("Example dog.jpg"), "File:Example dog.jpg");
  assert.equal(
    normalizeCommonsFileTitle("https://commons.wikimedia.org/wiki/File:Example_dog.jpg"),
    "File:Example dog.jpg",
  );
  assert.throws(
    () => normalizeCommonsFileTitle("https://example.com/image.jpg"),
    /Not a Wikimedia Commons URL/,
  );
  assert.deepEqual(
    normalizeCommonsReference("https://commons.wikimedia.org/w/index.php?curid=76249233"),
    { pageId: 76249233, title: null },
  );
  const url = buildCommonsMetadataUrl("File:Example dog.jpg");
  assert.equal(url.hostname, "commons.wikimedia.org");
  assert.equal(url.searchParams.get("titles"), "File:Example dog.jpg");
  assert.match(url.searchParams.get("iiprop"), /extmetadata/);
  assert.equal(url.searchParams.get("maxlag"), "5");
  const byPageId = buildCommonsMetadataUrl(
    "https://commons.wikimedia.org/w/index.php?curid=76249233",
  );
  assert.equal(byPageId.searchParams.get("pageids"), "76249233");
  assert.equal(byPageId.searchParams.has("titles"), false);
});

test("Commons metadata normalization preserves the exact source revision, creator, license, and dimensions", async () => {
  const normalized = normalizeCommonsMetadata(await fixture("commons-imageinfo.json"));
  assert.deepEqual(normalized.sourcePageRevision, { id: 456, timestamp: "2026-07-15T12:34:56Z" });
  assert.equal(normalized.creator, "Example Photographer");
  assert.equal(normalized.creatorUrl, "https://commons.wikimedia.org/wiki/User:Example");
  assert.equal(normalized.sourceLicenseLabel, "CC BY-SA 4.0");
  assert.equal(normalized.sourceLicenseUrl, "https://creativecommons.org/licenses/by-sa/4.0");
  assert.equal(normalized.sourceWidth, 1200);
  assert.equal(normalized.sourceHeight, 800);
});

test("Commons metadata with additional restrictions is rejected", async () => {
  const payload = await fixture("commons-imageinfo.json");
  payload.query.pages[0].imageinfo[0].extmetadata.Restrictions.value = "Editorial use only";
  assert.throws(() => normalizeCommonsMetadata(payload), /additional restrictions/);
});

test("Commons metadata cannot redirect original hashing to an untrusted host", async () => {
  const payload = await fixture("commons-imageinfo.json");
  payload.query.pages[0].imageinfo[0].url = "https://example.com/lookalike.jpg";
  assert.throws(() => normalizeCommonsMetadata(payload), /not on upload.wikimedia.org/);
});

test("plain-text creator extraction removes provider HTML without losing attribution text", () => {
  assert.equal(
    plainTextFromHtml('<bdi><a href="https://example.com">Ada &amp; Example</a><br>Photo</bdi>'),
    "Ada & Example Photo",
  );
  const protocolRelative = normalizeCommonsMetadata({
    query: {
      pages: [
        {
          pageid: 1,
          title: "File:Protocol-relative creator.jpg",
          fullurl: "https://commons.wikimedia.org/wiki/File:Protocol-relative_creator.jpg",
          revisions: [{ revid: 1, timestamp: "2026-07-16T00:00:00Z" }],
          imageinfo: [
            {
              url: "https://upload.wikimedia.org/example.jpg",
              size: 1,
              width: 1,
              height: 1,
              mime: "image/jpeg",
              sha1: "0".repeat(40),
              extmetadata: {
                Artist: {
                  value:
                    '<a href="//commons.wikimedia.org/wiki/User:Example">Example Photographer</a>',
                },
                LicenseShortName: { value: "CC BY 4.0" },
                LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0" },
                ObjectName: { value: "Example" },
                Restrictions: { value: "" },
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(protocolRelative.creatorUrl, "https://commons.wikimedia.org/wiki/User:Example");
});

test("remote hashing streams bytes and checks both the byte count and Commons SHA-1", async () => {
  const bytes = new TextEncoder().encode("hello world\n");
  const expectedSha1 = createHash("sha1").update(bytes).digest("hex");
  const expectedSha256 = createHash("sha256").update(bytes).digest("hex");
  const fetchImpl = async () =>
    new Response(bytes, { status: 200, headers: { "content-length": String(bytes.length) } });
  assert.deepEqual(
    await hashRemoteOriginal("https://upload.wikimedia.org/example.jpg", {
      fetchImpl,
      expectedBytes: bytes.length,
      expectedSha1,
    }),
    { bytes: bytes.length, sha256: expectedSha256, sha1: expectedSha1 },
  );
  await assert.rejects(
    hashRemoteOriginal("https://upload.wikimedia.org/example.jpg", {
      fetchImpl,
      expectedBytes: bytes.length,
      expectedSha1: "0".repeat(40),
    }),
    /SHA-1 does not match/,
  );
});

test("Commons imports remain human-review pending and deny every purpose", async () => {
  const metadata = normalizeCommonsMetadata(await fixture("commons-imageinfo.json"));
  const candidate = buildCommonsLedgerCandidate({
    catalogId: "VBO:0000661",
    metadata,
    hashes: {
      sha256,
      sha1: metadata.sourceSha1,
      bytes: metadata.sourceBytes,
    },
    policy,
    retrievedAt: "2026-07-16T12:00:00Z",
    discoveredVia: {
      provider: "openverse",
      id: "11111111-1111-1111-1111-111111111111",
      landingPage: "https://commons.wikimedia.org/w/index.php?curid=123",
      retrievedAt: "2026-07-16T12:00:00Z",
    },
  });
  assert.equal(candidate.assetId, "dogs:photo:commons:aaaaaaaaaaaaaaaa");
  assert.equal(candidate.review.status, "pending");
  assert.equal(candidate.review.subjectMatchesCatalog, false);
  assert.equal(candidate.uiDisplayAllowed, false);
  assert.equal(candidate.publicSnapshotAllowed, false);
  assert.equal(candidate.rasterExportAllowed, false);
  assert.equal(candidate.delivery.status, "not_ready");
  assert.deepEqual(candidate.modifications, ["none"]);
  assert.equal(candidate.sourceLicenseLabel, "CC BY-SA 4.0");
  assert.equal(candidate.sourceLicenseUrl, "https://creativecommons.org/licenses/by-sa/4.0");
  assert.equal(candidate.sourceCredit, "Own work");
  assert.equal(candidate.sourceAttributionRequired, true);
  assert.deepEqual(candidate.discoveredVia, {
    provider: "openverse",
    id: "11111111-1111-1111-1111-111111111111",
    landingPage: "https://commons.wikimedia.org/w/index.php?curid=123",
    retrievedAt: "2026-07-16T12:00:00Z",
  });
});

test("Openverse search is narrowly filtered and capped for anonymous discovery", () => {
  const url = buildOpenverseSearchUrl({ query: "example breed dog", limit: 12, source: "wikimedia" });
  assert.equal(url.hostname, "api.openverse.org");
  assert.equal(url.searchParams.get("license"), "cc0,pdm,by,by-sa");
  assert.equal(url.searchParams.get("license_type"), "commercial,modification");
  assert.equal(url.searchParams.get("mature"), "false");
  assert.equal(url.searchParams.get("page_size"), "12");
  assert.equal(url.searchParams.get("source"), "wikimedia");
  assert.throws(() => buildOpenverseSearchUrl({ query: "dog", limit: 21 }), /1–20/);
});

test("Openverse normalization remains discovery-only and filters an NC response defensively", async () => {
  const discovery = normalizeOpenverseDiscovery({
    payload: await fixture("openverse-search.json"),
    catalogId: "VBO:0000661",
    query: "example breed dog",
    retrievedAt: "2026-07-16T12:00:00Z",
  });
  assert.equal(discovery.results.length, 1);
  assert.equal(discovery.results[0].verificationStatus, "unverified-discovery");
  assert.equal(discovery.results[0].mustReverifyAtOriginal, true);
  assert.equal(discovery.results[0].uiDisplayAllowed, false);
  assert.match(discovery.warning, /does not verify license status/);
});

test("optimized artwork processing requires an explicit safe 3:2 crop and fixed WebP recipe", () => {
  const crop = parseArtworkCrop("12,34,1500,1000");
  assert.deepEqual(crop, { x: 12, y: 34, width: 1500, height: 1000 });
  assert.throws(() => parseArtworkCrop("0,0,1000,1000"), /3:2 aspect ratio/);
  assert.throws(() => parseArtworkCrop("-1,0,1500,1000"), /invalid/);
  const args = buildArtworkMagickArgs({
    sourcePath: "/tmp/source.jpg",
    outputPath: "/tmp/card.webp",
    crop,
    target: { width: 320, height: 213 },
  });
  assert.deepEqual(args.slice(0, 6), [
    "/tmp/source.jpg",
    "-auto-orient",
    "-crop",
    "1500x1000+12+34",
    "+repage",
    "-strip",
  ]);
  assert.ok(args.includes("320x213!"));
  assert.ok(args.includes("webp:method=6"));
  assert.ok(args.includes("webp:exact=true"));
});

test("a byte-ready, human-approved Commons row passes structural validation", () => {
  const result = validateArtworkLedger({
    ledger: baseLedger([approvedAsset()]),
    policy,
    catalog: catalog(),
    packs: [{ id: "starter", starter: true, catalogIds: ["VBO:0000661"] }],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.coverage.uiDisplay.currentCanonicalPercent, 100);
  assert.equal(result.report.coverage.uiDisplay.promotedPercent, 100);
  assert.equal(result.report.launchReadyForUi, true);
});

test("purpose permissions fail closed for pending reviews and disabled global gates", () => {
  const pending = approvedAsset({
    review: {
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      rightsNotes: "Automated import only.",
      subjectMatchesCatalog: false,
      nonCopyrightRestrictionsReviewed: false,
    },
  });
  const pendingResult = validateArtworkLedger({ ledger: baseLedger([pending]), policy, catalog: null });
  assert.ok(pendingResult.errors.some((error) => /non-approved rows must deny every purpose/.test(error)));

  const snapshot = approvedAsset({ publicSnapshotAllowed: true });
  const snapshotResult = validateArtworkLedger({ ledger: baseLedger([snapshot]), policy, catalog: null });
  assert.ok(snapshotResult.errors.some((error) => /policy gate publicSnapshot is disabled/.test(error)));
});

test("a ready ShareAlike derivative requires explicit same-license and attribution compliance", () => {
  const bySa = approvedAsset({
    licenseId: "CC-BY-SA-4.0",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceLicenseLabel: "CC BY-SA 4.0",
    sourceLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution:
      "Example dog — Example Photographer; CC BY-SA 4.0; via Wikimedia Commons.",
  });
  const denied = validateArtworkLedger({ ledger: baseLedger([bySa]), policy, catalog: catalog() });
  assert.ok(denied.errors.some((error) => /ready ShareAlike delivery requires/.test(error)));

  const allowed = validateArtworkLedger({
    ledger: baseLedger([
      {
        ...bySa,
        shareAlikeCompliance: {
          adapterLicenseId: "CC-BY-SA-4.0",
          adapterLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
          modificationsDisclosed: true,
          attributionSurface: "detail-and-credits",
          noAdditionalRestrictions: true,
        },
      },
    ]),
    policy,
    catalog: catalog(),
  });
  assert.deepEqual(allowed.errors, []);
});

test("unsupported fields, mismatched licenses, missing hashes, and unready delivery are rejected", () => {
  const broken = approvedAsset({
    rawProviderBlob: {},
    licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
    sourceSha256: "",
    delivery: { status: "not_ready", variants: [] },
  });
  const result = validateArtworkLedger({ ledger: baseLedger([broken]), policy, catalog: null });
  assert.ok(result.errors.some((error) => /unsupported field rawProviderBlob/.test(error)));
  assert.ok(result.errors.some((error) => /do not match the allowlist/.test(error)));
  assert.ok(result.errors.some((error) => /sourceSha256/.test(error)));
  assert.ok(result.errors.some((error) => /allowed purpose requires byte-verified delivery/.test(error)));
});

test("catalog image references fail if their ledger row is missing or belongs to another breed", () => {
  const missing = validateArtworkLedger({ ledger: baseLedger([]), policy, catalog: catalog(), packs: [] });
  assert.ok(missing.errors.some((error) => /has no ledger row/.test(error)));
  const wrongOwner = approvedAsset({ catalogId: "VBO:0000662" });
  const mismatched = validateArtworkLedger({
    ledger: baseLedger([wrongOwner]),
    policy,
    catalog: catalog(),
    packs: [],
  });
  assert.ok(mismatched.errors.some((error) => /primary image belongs to/.test(error)));
});

test("coverage reports distinguish rights approval, deployable UI coverage, and denied export purposes", () => {
  const report = buildArtworkCoverageReport({
    ledger: baseLedger([approvedAsset()]),
    policy,
    catalog: catalog(),
    packs: [{ id: "starter", promoted: true, catalogIds: ["VBO:0000661"] }],
  });
  assert.equal(report.ledger.approvedRightsRows, 1);
  assert.equal(report.ledger.readyDeliveryRows, 1);
  assert.deepEqual(report.ledger.allRowsLicenseDistribution, { "CC-BY-4.0": 1 });
  assert.deepEqual(report.ledger.approvedLicenseDistribution, { "CC-BY-4.0": 1 });
  assert.equal(report.coverage.uiDisplay.selectableCovered, 1);
  assert.equal(report.coverage.uiDisplay.currentSelectableCovered, 1);
  assert.equal(report.coverage.uiDisplay.currentCanonicalCovered, 1);
  assert.equal(report.coverage.publicSnapshot.selectableCovered, 0);
  assert.equal(report.coverage.rasterExport.selectableCovered, 0);
  assert.equal(report.launchChecks.publicSnapshotGateReviewed, false);
  assert.equal(report.missingImageStrategy.searchAndRankingRemainAvailable, true);
  assert.equal(report.unresolvedUiArtworkSummary.total, 0);
  assert.deepEqual(report.promotedUnresolvedUiArtwork, []);
  const missingAttribution = approvedAsset({ attributionCompliance: undefined });
  const deniedReport = buildArtworkCoverageReport({
    ledger: baseLedger([missingAttribution]),
    policy,
    catalog: catalog(null),
    packs: [],
  });
  assert.equal(deniedReport.coverage.uiDisplay.selectableCovered, 0);
});

test("catalog-level promoted markers participate in the 100% promoted-artwork gate", () => {
  const promotedCatalog = catalog();
  promotedCatalog.entities[0].promoted = true;
  const report = buildArtworkCoverageReport({
    ledger: baseLedger([approvedAsset()]),
    policy,
    catalog: promotedCatalog,
    packs: null,
  });
  assert.equal(report.catalog.promoted, 1);
  assert.equal(report.coverage.uiDisplay.promotedPercent, 100);
  assert.equal(report.launchChecks.promotedUiCoverageMet, true);
});

test("strict launch validation reports honest missing-image coverage without weakening structural mode", () => {
  const noImageCatalog = catalog(null);
  const structural = validateArtworkLedger({
    ledger: baseLedger([]),
    policy,
    catalog: noImageCatalog,
    packs: [{ id: "starter", starter: true, catalogIds: ["VBO:0000661"] }],
  });
  assert.deepEqual(structural.errors, []);
  assert.equal(structural.report.launchReadyForUi, false);
  assert.deepEqual(structural.report.unresolvedUiArtwork, [
    { catalogId: "VBO:0000661", primaryText: "Example Breed", reason: "no ledger row" },
  ]);
  assert.deepEqual(structural.report.unresolvedUiArtworkSummary, {
    total: 1,
    byReason: { "no ledger row": 1 },
    promotedTotal: 1,
  });
  assert.deepEqual(structural.report.promotedUnresolvedUiArtwork, [
    { catalogId: "VBO:0000661", primaryText: "Example Breed", reason: "no ledger row" },
  ]);

  const strict = validateArtworkLedger({
    ledger: baseLedger([]),
    policy,
    catalog: noImageCatalog,
    packs: [{ id: "starter", starter: true, catalogIds: ["VBO:0000661"] }],
    strictLaunch: true,
  });
  assert.ok(strict.errors.some((error) => /current canonical UI coverage is 0%/.test(error)));
  assert.ok(strict.errors.some((error) => /promoted UI coverage is 0%/.test(error)));
});
