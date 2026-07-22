#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveAllowedLicense } from "./validate-dog-artwork.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY_PATH = path.join(ROOT, "data", "dogs", "artwork-license-policy.json");
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const OPENVERSE_IMAGES_API = "https://api.openverse.org/v1/images/";
const USER_AGENT =
  "StackRankDogsArtwork/0.1 (https://www.stackrankapp.com/privacy; contact: stackrank@danbretl.com)";
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const ALLOWED_SOURCE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OPENVERSE_LICENSES = new Set(["cc0", "by", "by-sa", "pdm"]);

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");
const metadataValue = (imageInfo, key) => cleanString(imageInfo?.extmetadata?.[key]?.value);
const isHttpsUrl = (value, hostname = "") => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!hostname || url.hostname === hostname);
  } catch {
    return false;
  }
};

const decodeHtmlEntities = (value) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));

export const plainTextFromHtml = (value) =>
  decodeHtmlEntities(
    cleanString(value)
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

const firstHttpsHref = (value) => {
  const match = cleanString(value).match(/href=["'](https:[^"']+|\/\/[^"']+)["']/i);
  if (!match) return null;
  const href = decodeHtmlEntities(match[1]);
  return href.startsWith("//") ? `https:${href}` : href;
};

export const normalizeCommonsFileTitle = (input) => {
  let value = cleanString(input);
  if (!value) throw new Error("A Commons file title or URL is required");
  try {
    const url = new URL(value);
    if (url.hostname !== "commons.wikimedia.org") throw new Error("Not a Wikimedia Commons URL");
    const wikiMarker = "/wiki/";
    if (url.pathname.includes(wikiMarker)) value = decodeURIComponent(url.pathname.split(wikiMarker)[1]);
    else value = url.searchParams.get("title") || "";
  } catch (error) {
    if (/^https?:/i.test(value)) throw error;
  }
  value = value.replace(/_/g, " ").trim();
  if (!/^File:/i.test(value)) value = `File:${value}`;
  if (!/^File:.+/i.test(value)) throw new Error("Invalid Commons file title");
  return `File:${value.slice(value.indexOf(":") + 1)}`;
};

export const normalizeCommonsReference = (input) => {
  const value = cleanString(input);
  if (!value) throw new Error("A Commons file title or URL is required");
  try {
    const url = new URL(value);
    if (url.hostname !== "commons.wikimedia.org") throw new Error("Not a Wikimedia Commons URL");
    const pageId = url.searchParams.get("curid");
    if (pageId) {
      if (!/^\d+$/.test(pageId) || Number(pageId) < 1) throw new Error("Invalid Commons curid");
      return { pageId: Number(pageId), title: null };
    }
  } catch (error) {
    if (/^https?:/i.test(value)) throw error;
  }
  return { pageId: null, title: normalizeCommonsFileTitle(value) };
};

export const buildCommonsMetadataUrl = (fileInput) => {
  const url = new URL(COMMONS_API);
  const reference = normalizeCommonsReference(fileInput);
  const params = {
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo|revisions|info",
    inprop: "url",
    iiprop: "url|size|mime|sha1|extmetadata",
    iiextmetadatafilter:
      "LicenseShortName|LicenseUrl|Artist|Credit|ObjectName|AttributionRequired|Restrictions|UsageTerms",
    rvprop: "ids|timestamp",
    rvlimit: "1",
    maxlag: "5",
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (reference.pageId) url.searchParams.set("pageids", String(reference.pageId));
  else url.searchParams.set("titles", reference.title);
  return url;
};

export const normalizeCommonsMetadata = (payload) => {
  if (payload?.error) throw new Error(`Commons API error: ${payload.error.info || payload.error.code}`);
  const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : [];
  if (pages.length !== 1 || pages[0]?.missing) throw new Error("Commons file page was not found");
  const page = pages[0];
  const imageInfo = page?.imageinfo?.[0];
  const revision = page?.revisions?.[0];
  if (!imageInfo || !revision) throw new Error("Commons response is missing image or revision metadata");
  if (!isHttpsUrl(page.fullurl, "commons.wikimedia.org")) {
    throw new Error("Commons response is missing a canonical HTTPS file page");
  }
  if (!isHttpsUrl(imageInfo.url, "upload.wikimedia.org")) {
    throw new Error("Commons response original is not on upload.wikimedia.org");
  }
  if (!ALLOWED_SOURCE_MIMES.has(imageInfo.mime)) {
    throw new Error(`Unsupported original MIME type ${imageInfo.mime || "(missing)"}; photographs must be JPEG, PNG, or WebP`);
  }
  if (!Number.isInteger(imageInfo.size) || imageInfo.size < 1 || imageInfo.size > MAX_SOURCE_BYTES) {
    throw new Error(`Commons original is empty or exceeds ${MAX_SOURCE_BYTES} bytes`);
  }
  if (!Number.isInteger(imageInfo.width) || imageInfo.width < 1 || !Number.isInteger(imageInfo.height) || imageInfo.height < 1) {
    throw new Error("Commons response has invalid image dimensions");
  }
  if (!/^[a-f0-9]{40}$/i.test(cleanString(imageInfo.sha1))) {
    throw new Error("Commons response is missing an exact SHA-1 source hash");
  }
  const creatorHtml = metadataValue(imageInfo, "Artist");
  const creator = plainTextFromHtml(creatorHtml);
  if (!creator || /^(unknown|anonymous|n\/a)$/i.test(creator)) {
    throw new Error("Commons metadata does not identify a reviewable creator");
  }
  const restrictions = plainTextFromHtml(metadataValue(imageInfo, "Restrictions"));
  if (restrictions) throw new Error(`Commons metadata declares additional restrictions: ${restrictions}`);
  return {
    pageId: page.pageid,
    fileTitle: page.title,
    sourcePage: page.fullurl,
    sourcePageRevision: { id: revision.revid, timestamp: revision.timestamp },
    originalUrl: imageInfo.url,
    title: plainTextFromHtml(metadataValue(imageInfo, "ObjectName")) || page.title.replace(/^File:/, ""),
    creator,
    creatorUrl: firstHttpsHref(creatorHtml),
    sourceLicenseLabel: metadataValue(imageInfo, "LicenseShortName"),
    sourceLicenseUrl: metadataValue(imageInfo, "LicenseUrl"),
    sourceUsageTerms: plainTextFromHtml(metadataValue(imageInfo, "UsageTerms")),
    sourceCredit: plainTextFromHtml(metadataValue(imageInfo, "Credit")),
    attributionRequired: metadataValue(imageInfo, "AttributionRequired") === "true",
    sourceSha1: cleanString(imageInfo.sha1).toLowerCase(),
    sourceMime: imageInfo.mime,
    sourceBytes: imageInfo.size,
    sourceWidth: imageInfo.width,
    sourceHeight: imageInfo.height,
  };
};

export const hashRemoteOriginal = async (
  url,
  { fetchImpl = fetch, expectedBytes = null, expectedSha1 = null, maxBytes = MAX_SOURCE_BYTES } = {},
) => {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/jpeg,image/png,image/webp" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Original download failed with HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Original exceeds the ${maxBytes}-byte import limit`);
  }
  const sha256 = createHash("sha256");
  const sha1 = createHash("sha1");
  let bytes = 0;
  if (!response.body) throw new Error("Original response has no body");
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) {
      if (typeof response.body.cancel === "function") await response.body.cancel();
      throw new Error(`Original exceeds the ${maxBytes}-byte import limit`);
    }
    sha256.update(chunk);
    sha1.update(chunk);
  }
  const result = { bytes, sha256: sha256.digest("hex"), sha1: sha1.digest("hex") };
  if (expectedBytes != null && bytes !== expectedBytes) {
    throw new Error(`Original byte count ${bytes} does not match Commons metadata ${expectedBytes}`);
  }
  if (expectedSha1 && result.sha1 !== cleanString(expectedSha1).toLowerCase()) {
    throw new Error("Original SHA-1 does not match the Commons Imageinfo response");
  }
  return result;
};

export const buildCommonsLedgerCandidate = ({
  catalogId,
  metadata,
  hashes,
  policy,
  retrievedAt = new Date().toISOString(),
  discoveredVia = null,
}) => {
  if (!/^VBO:\d{7}$/.test(cleanString(catalogId))) throw new Error("catalogId must be a VBO CURIE such as VBO:0000661");
  if (!/^[a-f0-9]{64}$/.test(hashes?.sha256 || "")) throw new Error("A verified SHA-256 hash is required");
  if (hashes?.sha1 !== metadata.sourceSha1) throw new Error("Verified SHA-1 does not match metadata");
  if (hashes?.bytes !== metadata.sourceBytes) throw new Error("Verified byte count does not match metadata");
  const license = resolveAllowedLicense(policy, {
    license: metadata.sourceLicenseLabel,
    licenseUrl: metadata.sourceLicenseUrl,
  });
  if (!license) {
    throw new Error(
      `Unsupported or ambiguous license: ${metadata.sourceLicenseLabel || "(missing)"} ${metadata.sourceLicenseUrl || ""}`.trim(),
    );
  }
  if (license.manualPublicDomainEvidence) {
    throw new Error("Public-domain claims require a separate human evidence review and are not auto-imported");
  }
  const candidate = {
    assetId: `dogs:photo:commons:${hashes.sha256.slice(0, 16)}`,
    catalogId,
    sourceProvider: "wikimedia-commons",
    sourcePage: metadata.sourcePage,
    sourcePageRevision: metadata.sourcePageRevision,
    originalUrl: metadata.originalUrl,
    title: metadata.title,
    creator: metadata.creator,
    creatorUrl: metadata.creatorUrl,
    licenseId: license.id,
    license: license.label,
    licenseVersion: license.version,
    licenseUrl: license.url,
    sourceLicenseLabel: metadata.sourceLicenseLabel,
    sourceLicenseUrl: metadata.sourceLicenseUrl,
    sourceCredit: metadata.sourceCredit,
    sourceAttributionRequired: metadata.attributionRequired,
    attribution: `${metadata.title} — ${metadata.creator}; ${license.label}; via Wikimedia Commons.`,
    retrievedAt,
    sourceSha256: hashes.sha256,
    sourceSha1: hashes.sha1,
    sourceMime: metadata.sourceMime,
    sourceBytes: hashes.bytes,
    sourceWidth: metadata.sourceWidth,
    sourceHeight: metadata.sourceHeight,
    modifications: ["none"],
    review: {
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      rightsNotes:
        "Metadata and original bytes were imported automatically. A human must verify the license chain, subject identity, and non-copyright restrictions before approval.",
      subjectMatchesCatalog: false,
      nonCopyrightRestrictionsReviewed: false,
    },
    uiDisplayAllowed: false,
    publicSnapshotAllowed: false,
    rasterExportAllowed: false,
    delivery: { status: "not_ready", variants: [] },
  };
  if (discoveredVia) candidate.discoveredVia = discoveredVia;
  return candidate;
};

export const fetchCommonsCandidate = async ({
  catalogId,
  file,
  policy,
  fetchImpl = fetch,
  retrievedAt = new Date().toISOString(),
  openverseId = "",
}) => {
  const response = await fetchImpl(buildCommonsMetadataUrl(file), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Commons metadata request failed with HTTP ${response.status}`);
  const metadata = normalizeCommonsMetadata(await response.json());
  const hashes = await hashRemoteOriginal(metadata.originalUrl, {
    fetchImpl,
    expectedBytes: metadata.sourceBytes,
    expectedSha1: metadata.sourceSha1,
  });
  const discoveredVia = cleanString(openverseId)
    ? {
        provider: "openverse",
        id: cleanString(openverseId),
        landingPage: /^https:\/\//.test(file) ? file : metadata.sourcePage,
        retrievedAt,
      }
    : null;
  return buildCommonsLedgerCandidate({
    catalogId,
    metadata,
    hashes,
    policy,
    retrievedAt,
    discoveredVia,
  });
};

export const buildOpenverseSearchUrl = ({ query, limit = 10, source = "" }) => {
  const q = cleanString(query);
  if (!q || q.length > 200) throw new Error("Openverse query must contain 1–200 characters");
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Openverse anonymous discovery is limited to 1–20 results per request");
  }
  const url = new URL(OPENVERSE_IMAGES_API);
  url.searchParams.set("q", q);
  url.searchParams.set("license", "cc0,pdm,by,by-sa");
  url.searchParams.set("license_type", "commercial,modification");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("page", "1");
  url.searchParams.set("mature", "false");
  url.searchParams.set("filter_dead", "true");
  if (cleanString(source)) url.searchParams.set("source", cleanString(source));
  return url;
};

export const normalizeOpenverseDiscovery = ({
  payload,
  catalogId,
  query,
  retrievedAt = new Date().toISOString(),
}) => {
  if (!/^VBO:\d{7}$/.test(cleanString(catalogId))) throw new Error("catalogId must be a VBO CURIE");
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return {
    schemaVersion: 1,
    provider: "openverse",
    catalogId,
    query: cleanString(query),
    retrievedAt,
    providerTerms: "https://docs.openverse.org/terms_of_service.html",
    warning:
      "Discovery only. Openverse says it does not verify license status. Re-open and independently verify the original source before creating a rights-ledger row.",
    results: results
      .filter(
        (result) =>
          OPENVERSE_LICENSES.has(cleanString(result?.license).toLowerCase()) &&
          cleanString(result?.id) &&
          isHttpsUrl(result?.foreign_landing_url),
      )
      .map((result) => ({
        openverseId: cleanString(result.id),
        title: cleanString(result.title),
        creator: cleanString(result.creator),
        creatorUrl: cleanString(result.creator_url) || null,
        source: cleanString(result.source),
        provider: cleanString(result.provider),
        originalPage: cleanString(result.foreign_landing_url),
        advertisedOriginalUrl: cleanString(result.url),
        thumbnailUrl: cleanString(result.thumbnail),
        openverseAdvertisedLicense: {
          code: cleanString(result.license),
          version: cleanString(result.license_version),
          url: cleanString(result.license_url),
          attribution: cleanString(result.attribution),
        },
        verificationStatus: "unverified-discovery",
        mustReverifyAtOriginal: true,
        uiDisplayAllowed: false,
        publicSnapshotAllowed: false,
        rasterExportAllowed: false,
      })),
  };
};

export const fetchOpenverseDiscovery = async ({ catalogId, query, limit = 10, source = "", fetchImpl = fetch, retrievedAt }) => {
  const response = await fetchImpl(buildOpenverseSearchUrl({ query, limit, source }), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Openverse request failed with HTTP ${response.status}`);
  return normalizeOpenverseDiscovery({ payload: await response.json(), catalogId, query, retrievedAt });
};

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const options = { command: command === "--help" ? null : command, limit: 10, source: "" };
  if (command === "--help") options.help = true;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--help") options.help = true;
    else if (
      ["--catalog-id", "--file", "--query", "--limit", "--source", "--out", "--openverse-id"].includes(arg)
    ) {
      const value = rest[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  options.limit = Number(options.limit);
  return options;
};

const printHelp = () => {
  console.log(`Rights-safe StackRank Dogs artwork acquisition. Imports never approve an asset.\n\nExact Commons file (metadata + streamed original hashes):\n  node scripts/fetch-dog-artwork.mjs commons --catalog-id VBO:0000661 --file "File:Example.jpg" [--out data/dogs/artwork-candidate-example.json]\n\nOpenverse-to-Commons handoff (curid landing URLs are accepted):\n  node scripts/fetch-dog-artwork.mjs commons --catalog-id VBO:0000661 --file "https://commons.wikimedia.org/w/index.php?curid=123" --openverse-id <uuid> [--out data/dogs/artwork-candidate-example.json]\n\nOpenverse discovery (never a rights-ledger import):\n  node scripts/fetch-dog-artwork.mjs openverse --catalog-id VBO:0000661 --query "breed name dog" [--limit 10] [--source wikimedia] [--out data/dogs/artwork-discovery-example.json]\n\nSafety rules:\n  - Outputs cannot overwrite data/dogs/image-rights.json.\n  - Commons candidates start pending with every purpose denied.\n  - Openverse results remain unverified discovery records and must be checked at the original source.\n`);
};

const writeOutput = async (value, outputPath) => {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  const resolved = path.resolve(outputPath);
  if (resolved === path.join(ROOT, "data", "dogs", "image-rights.json")) {
    throw new Error("The importer cannot write image-rights.json; a human must review and promote candidates explicitly");
  }
  await writeFile(resolved, serialized, { encoding: "utf8", flag: "wx" });
  console.error(`Wrote ${path.relative(ROOT, resolved)}`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.command) {
    printHelp();
    return;
  }
  const policy = JSON.parse(await readFile(POLICY_PATH, "utf8"));
  if (options.command === "commons") {
    if (!options.catalogId || !options.file) throw new Error("commons requires --catalog-id and --file");
    await writeOutput(
      await fetchCommonsCandidate({
        catalogId: options.catalogId,
        file: options.file,
        policy,
        openverseId: options.openverseId,
      }),
      options.out,
    );
  } else if (options.command === "openverse") {
    if (!options.catalogId || !options.query) throw new Error("openverse requires --catalog-id and --query");
    await writeOutput(
      await fetchOpenverseDiscovery({
        catalogId: options.catalogId,
        query: options.query,
        limit: options.limit,
        source: options.source,
      }),
      options.out,
    );
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
