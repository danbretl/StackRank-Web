import { createHash } from "node:crypto";
import { buildOpenverseSearchUrl } from "./fetch-dog-artwork.mjs";

export const DISCOVERY_QUEUE_SCHEMA_VERSION = 1;
export const DISCOVERY_QUEUE_MAX_ITEMS = 2_000;
export const DISCOVERY_QUEUE_MAX_BYTES = 8 * 1024 * 1024;
export const DISCOVERY_RESULT_LIMIT = 10;

const CURRENT_CANONICAL_STATUSES = new Set(["canonical", "breed"]);
const codepointCompare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const asArray = (value) => (Array.isArray(value) ? value : []);

export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export const sha256Text = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const isCurrentCanonicalDog = (entity) =>
  entity?.selectable === true &&
  entity?.current !== false &&
  CURRENT_CANONICAL_STATUSES.has(
    cleanText(entity?.status || entity?.catalogStatus).toLowerCase(),
  );

export const buildArtworkSearchQuery = (displayName) => {
  const normalizedName = cleanText(displayName)
    .replace(/["\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedName) throw new Error("Artwork discovery requires a canonical display name");
  const query = `"${normalizedName}" dog`;
  if (query.length > 200) throw new Error(`Artwork search query exceeds 200 characters: ${query}`);
  return query;
};

export const buildCommonsSearchUrls = (query) => {
  const mediaSearch = new URL("https://commons.wikimedia.org/w/index.php");
  mediaSearch.searchParams.set("search", query);
  mediaSearch.searchParams.set("title", "Special:MediaSearch");
  mediaSearch.searchParams.set("type", "image");

  const apiSearch = new URL("https://commons.wikimedia.org/w/api.php");
  [
    ["action", "query"],
    ["format", "json"],
    ["formatversion", "2"],
    ["generator", "search"],
    ["gsrsearch", query],
    ["gsrnamespace", "6"],
    ["gsrlimit", String(DISCOVERY_RESULT_LIMIT)],
    ["gsrwhat", "text"],
    ["prop", "info"],
    ["inprop", "url"],
    ["maxlag", "5"],
  ].forEach(([key, value]) => apiSearch.searchParams.set(key, value));

  return {
    query,
    mediaSearchUrl: mediaSearch.toString(),
    apiSearchUrl: apiSearch.toString(),
    resultLimit: DISCOVERY_RESULT_LIMIT,
    licenseFiltering: "none",
    warning:
      "Commons search results are discovery leads only. Verify one exact File page and its current Imageinfo metadata before creating a pending candidate.",
  };
};

const packItems = (pack) =>
  asArray(pack?.items || pack?.catalogIds)
    .map((item) => (typeof item === "string" ? item : cleanText(item?.catalogId || item?.id)))
    .filter(Boolean);

const packIsPromoted = (pack) =>
  pack?.promoted === true ||
  asArray(pack?.placements).some((placement) =>
    ["starter", "homepage", "promoted"].includes(cleanText(placement)),
  );

const packEngagementByCatalogId = (packs) => {
  const engagement = new Map();
  for (const pack of asArray(packs?.packs || packs)) {
    const packId = cleanText(pack?.id);
    if (!packId) continue;
    const promoted = packIsPromoted(pack);
    for (const catalogId of new Set(packItems(pack))) {
      const current = engagement.get(catalogId) || {
        packIds: [],
        promotedPackIds: [],
      };
      current.packIds.push(packId);
      if (promoted) current.promotedPackIds.push(packId);
      engagement.set(catalogId, current);
    }
  }
  for (const value of engagement.values()) {
    value.packIds.sort(codepointCompare);
    value.promotedPackIds.sort(codepointCompare);
  }
  return engagement;
};

const priorityTier = ({ promoted, packCount }) => {
  if (promoted) return "promoted";
  if (packCount > 0) return "pack-engaged";
  return "catalog-long-tail";
};

const buildPriority = (entity, pack) => {
  const promoted = entity?.promoted === true || pack.promotedPackIds.length > 0;
  return {
    tier: priorityTier({ promoted, packCount: pack.packIds.length }),
    promoted,
    promotedPackCount: pack.promotedPackIds.length,
    packCount: pack.packIds.length,
    promotedPackIds: pack.promotedPackIds,
    packIds: pack.packIds,
  };
};

const buildDiscoveryInputs = (displayName) => {
  const query = buildArtworkSearchQuery(displayName);
  const openverseUrl = buildOpenverseSearchUrl({
    query,
    limit: DISCOVERY_RESULT_LIMIT,
    source: "wikimedia",
  });
  return {
    query,
    openverse: {
      requestUrl: openverseUrl.toString(),
      source: "wikimedia",
      resultLimit: DISCOVERY_RESULT_LIMIT,
      page: 1,
      allowedAdvertisedLicenses: ["cc0", "pdm", "by", "by-sa"],
      requiredLicenseTypes: ["commercial", "modification"],
      mature: false,
      filterDead: true,
      status: "unverified-discovery-only",
    },
    commons: buildCommonsSearchUrls(query),
  };
};

const compareQueueItems = (left, right) =>
  Number(right.priority.promoted) - Number(left.priority.promoted) ||
  right.priority.promotedPackCount - left.priority.promotedPackCount ||
  right.priority.packCount - left.priority.packCount ||
  codepointCompare(left.displayName, right.displayName) ||
  codepointCompare(left.catalogId, right.catalogId);

const queueSummary = (items, currentCanonicalCount, ledgerCatalogIdCount) => ({
  currentCanonicalCount,
  catalogIdsWithLedgerRows: ledgerCatalogIdCount,
  queuedMissingLedgerRows: items.length,
  promoted: items.filter((item) => item.priority.tier === "promoted").length,
  packEngaged: items.filter((item) => item.priority.tier === "pack-engaged").length,
  catalogLongTail: items.filter((item) => item.priority.tier === "catalog-long-tail").length,
});

export const buildDogArtworkDiscoveryQueue = ({
  catalog,
  ledger,
  packs,
  policy,
  sourceHashes,
}) => {
  const entities = asArray(catalog?.entities);
  const assets = asArray(ledger?.assets);
  const currentCanonical = entities.filter(isCurrentCanonicalDog);
  const ledgerCatalogIds = new Set(assets.map((asset) => cleanText(asset?.catalogId)).filter(Boolean));
  const engagement = packEngagementByCatalogId(packs);

  const items = currentCanonical
    .filter((entity) => !ledgerCatalogIds.has(cleanText(entity?.id || entity?.catalogId)))
    .map((entity) => {
      const catalogId = cleanText(entity?.id || entity?.catalogId);
      const displayName = cleanText(entity?.displayName || entity?.primaryText);
      const pack = engagement.get(catalogId) || { packIds: [], promotedPackIds: [] };
      return {
        priorityRank: 0,
        catalogId,
        displayName,
        catalogStatus: cleanText(entity?.status || entity?.catalogStatus),
        aliases: [...new Set(asArray(entity?.aliases).map(cleanText).filter(Boolean))].sort(
          codepointCompare,
        ),
        sourceIds: [...new Set(asArray(entity?.sourceIds).map(cleanText).filter(Boolean))].sort(
          codepointCompare,
        ),
        priority: buildPriority(entity, pack),
        discovery: buildDiscoveryInputs(displayName),
        evidenceContractId: "dogs-artwork-ledger-v1",
        reviewState: "no-ledger-row",
        permissions: {
          uiDisplayAllowed: false,
          publicSnapshotAllowed: false,
          rasterExportAllowed: false,
        },
      };
    })
    .sort(compareQueueItems)
    .map((item, index) => ({ ...item, priorityRank: index + 1 }));

  const queue = {
    schemaVersion: DISCOVERY_QUEUE_SCHEMA_VERSION,
    queueId: "stackrank-dogs-artwork-discovery",
    queueVersion: [
      cleanText(catalog?.catalogVersion),
      cleanText(ledger?.ledgerVersion),
      cleanText(packs?.editorialVersion),
      cleanText(policy?.policyVersion),
    ].join("+"),
    reviewOnly: true,
    networkRequestsPerformed: false,
    mutationsPerformed: false,
    sourceVersions: {
      catalogVersion: cleanText(catalog?.catalogVersion),
      catalogSha256: cleanText(sourceHashes?.catalog),
      ledgerVersion: cleanText(ledger?.ledgerVersion),
      ledgerSha256: cleanText(sourceHashes?.ledger),
      packsEditorialVersion: cleanText(packs?.editorialVersion),
      packsSha256: cleanText(sourceHashes?.packs),
      policyVersion: cleanText(policy?.policyVersion),
      policySha256: cleanText(sourceHashes?.policy),
    },
    policy: {
      providerScope: ["wikimedia-commons"],
      openverseRole: "discovery-only",
      maxResultsPerEntityPerProvider: DISCOVERY_RESULT_LIMIT,
      automaticImportAllowed: false,
      automaticApprovalAllowed: false,
      bulkDownloadAllowed: false,
      publicDomainClaimsRequireManualEvidence: true,
      warning:
        "Search relevance and advertised license metadata are not identity or rights evidence. Open one exact Commons File page and verify the original source before producing a pending candidate.",
    },
    evidenceContract: {
      id: "dogs-artwork-ledger-v1",
      requiredCandidateFields: [
        "assetId",
        "catalogId",
        "sourceProvider",
        "sourcePage",
        "sourcePageRevision.id",
        "sourcePageRevision.timestamp",
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
        "attribution",
        "retrievedAt",
        "sourceSha256",
        "sourceSha1",
        "sourceMime",
        "sourceBytes",
        "sourceWidth",
        "sourceHeight",
        "modifications",
        "review.status",
        "review.reviewedAt",
        "review.reviewedBy",
        "review.rightsNotes",
        "review.subjectMatchesCatalog",
        "review.nonCopyrightRestrictionsReviewed",
        "uiDisplayAllowed",
        "publicSnapshotAllowed",
        "rasterExportAllowed",
        "delivery.status",
        "delivery.variants",
      ],
      conditionalCandidateFields: {
        openverseDiscovery: [
          "discoveredVia.provider",
          "discoveredVia.id",
          "discoveredVia.landingPage",
          "discoveredVia.retrievedAt",
        ],
        publicDomainMark: ["publicDomainBasis"],
      },
      exactOriginalChecks: [
        "Commons File-page revision id and timestamp",
        "Commons Imageinfo SHA-1 and byte count",
        "locally streamed SHA-256 of the exact original",
        "creator and upstream source chain",
        "exact license label, version, and canonical URL",
        "subject identity against the canonical VBO concept",
        "non-copyright restrictions and crop integrity",
      ],
      initialCandidateState: {
        reviewStatus: "pending",
        subjectMatchesCatalog: false,
        nonCopyrightRestrictionsReviewed: false,
        uiDisplayAllowed: false,
        publicSnapshotAllowed: false,
        rasterExportAllowed: false,
        deliveryStatus: "not_ready",
      },
    },
    operatorHandoff: {
      openverseCommand: [
        "node",
        "scripts/fetch-dog-artwork.mjs",
        "openverse",
        "--catalog-id",
        "<catalogId>",
        "--query",
        "<discovery.query>",
        "--limit",
        String(DISCOVERY_RESULT_LIMIT),
        "--source",
        "wikimedia",
        "--out",
        "<create-only output path>",
      ],
      commonsCommand: [
        "node",
        "scripts/fetch-dog-artwork.mjs",
        "commons",
        "--catalog-id",
        "<catalogId>",
        "--file",
        "<exact Commons File title or curid URL>",
        "--out",
        "<create-only output path>",
      ],
      reminder:
        "Run at most one bounded discovery request at a time. Neither command edits image-rights.json or approves an asset.",
    },
    summary: queueSummary(items, currentCanonical.length, ledgerCatalogIds.size),
    items,
  };

  const errors = validateDogArtworkDiscoveryQueue({ queue, catalog, ledger, packs, policy });
  if (errors.length) throw new Error(`Invalid Dogs artwork discovery queue:\n- ${errors.join("\n- ")}`);
  return queue;
};

const exactSet = (values) => [...new Set(values)].sort(codepointCompare);

export const validateDogArtworkDiscoveryQueue = ({
  queue,
  catalog,
  ledger,
  packs,
  policy,
}) => {
  const errors = [];
  const items = asArray(queue?.items);
  const entities = asArray(catalog?.entities);
  const assets = asArray(ledger?.assets);
  const ledgerCatalogIds = new Set(assets.map((asset) => cleanText(asset?.catalogId)).filter(Boolean));
  const entityByCatalogId = new Map(
    entities.map((entity) => [cleanText(entity?.id || entity?.catalogId), entity]),
  );
  const engagement = packEngagementByCatalogId(packs);
  const expectedIds = exactSet(
    entities
      .filter(isCurrentCanonicalDog)
      .map((entity) => cleanText(entity?.id || entity?.catalogId))
      .filter((catalogId) => catalogId && !ledgerCatalogIds.has(catalogId)),
  );
  const actualIds = exactSet(items.map((item) => cleanText(item?.catalogId)).filter(Boolean));

  if (queue?.schemaVersion !== DISCOVERY_QUEUE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${DISCOVERY_QUEUE_SCHEMA_VERSION}`);
  }
  if (queue?.reviewOnly !== true) errors.push("queue must be explicitly review-only");
  if (queue?.networkRequestsPerformed !== false) {
    errors.push("queue generation must record zero network requests");
  }
  if (queue?.mutationsPerformed !== false) {
    errors.push("queue generation must record zero source mutations");
  }
  if (queue?.policy?.automaticImportAllowed !== false) {
    errors.push("automatic imports must be denied");
  }
  if (queue?.policy?.automaticApprovalAllowed !== false) {
    errors.push("automatic approvals must be denied");
  }
  if (queue?.policy?.bulkDownloadAllowed !== false) {
    errors.push("bulk downloads must be denied");
  }
  if (items.length > DISCOVERY_QUEUE_MAX_ITEMS) {
    errors.push(`queue exceeds ${DISCOVERY_QUEUE_MAX_ITEMS} items`);
  }
  if (JSON.stringify(queue).length > DISCOVERY_QUEUE_MAX_BYTES) {
    errors.push(`queue exceeds ${DISCOVERY_QUEUE_MAX_BYTES} bytes`);
  }
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
    errors.push("queue must contain every and only current-canonical catalog id without a ledger row");
  }
  if (actualIds.length !== items.length) errors.push("queue catalog ids must be unique and nonempty");
  if (queue?.sourceVersions?.catalogVersion !== cleanText(catalog?.catalogVersion)) {
    errors.push("catalog version does not match source");
  }
  if (queue?.sourceVersions?.ledgerVersion !== cleanText(ledger?.ledgerVersion)) {
    errors.push("ledger version does not match source");
  }
  if (queue?.sourceVersions?.packsEditorialVersion !== cleanText(packs?.editorialVersion)) {
    errors.push("pack editorial version does not match source");
  }
  if (queue?.sourceVersions?.policyVersion !== cleanText(policy?.policyVersion)) {
    errors.push("policy version does not match source");
  }
  for (const key of ["catalogSha256", "ledgerSha256", "packsSha256", "policySha256"]) {
    const value = queue?.sourceVersions?.[key];
    if (!/^[a-f0-9]{64}$/.test(cleanText(value))) {
      errors.push(`${key} must be an exact SHA-256 source digest`);
    }
  }

  const expectedSorted = [...items].sort(compareQueueItems);
  items.forEach((item, index) => {
    const label = `items[${index}]`;
    if (item?.priorityRank !== index + 1) errors.push(`${label}.priorityRank is not sequential`);
    if (expectedSorted[index]?.catalogId !== item?.catalogId) {
      errors.push(`${label} violates promoted/pack-engagement priority ordering`);
    }
    const entity = entityByCatalogId.get(cleanText(item?.catalogId));
    const expectedPack = engagement.get(cleanText(item?.catalogId)) || {
      packIds: [],
      promotedPackIds: [],
    };
    const expectedPriority = buildPriority(entity, expectedPack);
    if (JSON.stringify(item?.priority) !== JSON.stringify(expectedPriority)) {
      errors.push(`${label}.priority does not match promoted and pack engagement sources`);
    }
    const expectedDisplayName = cleanText(entity?.displayName || entity?.primaryText);
    if (item?.displayName !== expectedDisplayName) {
      errors.push(`${label}.displayName does not match the canonical catalog record`);
    }
    const expectedAliases = [
      ...new Set(asArray(entity?.aliases).map(cleanText).filter(Boolean)),
    ].sort(codepointCompare);
    const expectedSourceIds = [
      ...new Set(asArray(entity?.sourceIds).map(cleanText).filter(Boolean)),
    ].sort(codepointCompare);
    if (JSON.stringify(item?.aliases) !== JSON.stringify(expectedAliases)) {
      errors.push(`${label}.aliases do not match the catalog`);
    }
    if (JSON.stringify(item?.sourceIds) !== JSON.stringify(expectedSourceIds)) {
      errors.push(`${label}.sourceIds do not match the catalog`);
    }
    const expectedDiscovery = (() => {
      try {
        return buildDiscoveryInputs(expectedDisplayName);
      } catch {
        return null;
      }
    })();
    if (JSON.stringify(item?.discovery) !== JSON.stringify(expectedDiscovery)) {
      errors.push(`${label}.discovery must use the exact conservative, bounded search inputs`);
    }
    try {
      const openverse = new URL(item?.discovery?.openverse?.requestUrl);
      if (openverse.origin !== "https://api.openverse.org") {
        errors.push(`${label} Openverse request must use the HTTPS Openverse API`);
      }
      if (openverse.searchParams.get("page") !== "1") errors.push(`${label} must request page 1`);
      if (openverse.searchParams.get("page_size") !== String(DISCOVERY_RESULT_LIMIT)) {
        errors.push(`${label} must use the bounded result limit`);
      }
      if (openverse.searchParams.get("source") !== "wikimedia") {
        errors.push(`${label} must restrict Openverse discovery to Wikimedia`);
      }
      if (openverse.searchParams.get("license") !== "cc0,pdm,by,by-sa") {
        errors.push(`${label} has an unsafe advertised-license filter`);
      }
      if (openverse.searchParams.get("license_type") !== "commercial,modification") {
        errors.push(`${label} must require commercial and modification license types`);
      }
      if (openverse.searchParams.get("mature") !== "false") {
        errors.push(`${label} must exclude mature results`);
      }
      if (openverse.searchParams.get("filter_dead") !== "true") {
        errors.push(`${label} must filter dead results`);
      }
    } catch {
      errors.push(`${label} has an invalid Openverse request URL`);
    }
    for (const [urlName, urlValue] of [
      ["mediaSearchUrl", item?.discovery?.commons?.mediaSearchUrl],
      ["apiSearchUrl", item?.discovery?.commons?.apiSearchUrl],
    ]) {
      try {
        const commons = new URL(urlValue);
        if (commons.protocol !== "https:" || commons.hostname !== "commons.wikimedia.org") {
          errors.push(`${label}.${urlName} must stay on HTTPS Wikimedia Commons`);
        }
      } catch {
        errors.push(`${label}.${urlName} is invalid`);
      }
    }
    if (item?.evidenceContractId !== queue?.evidenceContract?.id) {
      errors.push(`${label} does not bind the shared evidence contract`);
    }
    if (item?.reviewState !== "no-ledger-row") {
      errors.push(`${label} must remain explicitly unreviewed`);
    }
    if (
      item?.permissions?.uiDisplayAllowed !== false ||
      item?.permissions?.publicSnapshotAllowed !== false ||
      item?.permissions?.rasterExportAllowed !== false
    ) {
      errors.push(`${label} must deny every artwork purpose`);
    }
  });

  const summary = queueSummary(
    items,
    entities.filter(isCurrentCanonicalDog).length,
    ledgerCatalogIds.size,
  );
  if (JSON.stringify(queue?.summary) !== JSON.stringify(summary)) {
    errors.push("queue summary does not match its items and sources");
  }
  if (
    !asArray(queue?.evidenceContract?.requiredCandidateFields).includes("sourceSha256") ||
    !asArray(queue?.evidenceContract?.requiredCandidateFields).includes(
      "review.nonCopyrightRestrictionsReviewed",
    )
  ) {
    errors.push("evidence contract is missing exact byte or human-review fields");
  }
  return errors;
};
