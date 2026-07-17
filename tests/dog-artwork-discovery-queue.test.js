import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildArtworkSearchQuery,
  buildDogArtworkDiscoveryQueue,
  sha256Text,
  stableJson,
  validateDogArtworkDiscoveryQueue,
} from "../scripts/dog-artwork-discovery-queue-lib.mjs";

const root = new URL("../", import.meta.url);

const fixture = () => ({
  catalog: {
    catalogVersion: "catalog-test.1",
    entities: [
      {
        id: "VBO:0000004",
        displayName: "Pack Four",
        status: "canonical",
        selectable: true,
        aliases: ["Fourth"],
        sourceIds: ["VBO:0000004"],
      },
      {
        id: "VBO:0000003",
        displayName: "Long Tail",
        status: "canonical",
        selectable: true,
        aliases: [],
        sourceIds: ["VBO:0000003"],
      },
      {
        id: "VBO:0000002",
        displayName: "Already Led",
        status: "canonical",
        selectable: true,
        aliases: [],
        sourceIds: ["VBO:0000002"],
      },
      {
        id: "VBO:0000001",
        displayName: "Promoted One",
        status: "canonical",
        selectable: true,
        aliases: ["One Dog"],
        sourceIds: ["VBO:0000001"],
      },
      {
        id: "VBO:0000005",
        displayName: "Historic Five",
        status: "historical",
        selectable: true,
      },
      {
        id: "VBO:0000006",
        displayName: "Variety Six",
        status: "variety",
        selectable: true,
      },
    ],
  },
  ledger: {
    ledgerVersion: "ledger-test.1",
    assets: [{ catalogId: "VBO:0000002" }],
  },
  packs: {
    editorialVersion: "packs-test.1",
    packs: [
      {
        id: "starter",
        promoted: true,
        placements: ["starter"],
        items: ["VBO:0000001"],
      },
      { id: "browse-a", promoted: false, items: ["VBO:0000004", "VBO:0000001"] },
      { id: "browse-b", promoted: false, items: ["VBO:0000004"] },
    ],
  },
  policy: { policyVersion: "policy-test.1" },
  sourceHashes: {
    catalog: "a".repeat(64),
    ledger: "b".repeat(64),
    packs: "c".repeat(64),
    policy: "d".repeat(64),
  },
});

test("discovery queue contains every and only current-canonical concept lacking a ledger row", () => {
  const sources = fixture();
  const queue = buildDogArtworkDiscoveryQueue(sources);
  assert.deepEqual(
    queue.items.map((item) => item.catalogId),
    ["VBO:0000001", "VBO:0000004", "VBO:0000003"],
  );
  assert.deepEqual(queue.summary, {
    currentCanonicalCount: 4,
    catalogIdsWithLedgerRows: 1,
    queuedMissingLedgerRows: 3,
    promoted: 1,
    packEngaged: 1,
    catalogLongTail: 1,
  });
  assert.deepEqual(queue.items.map((item) => item.priorityRank), [1, 2, 3]);
  assert.equal(queue.items[0].priority.tier, "promoted");
  assert.equal(queue.items[1].priority.packCount, 2);
});

test("search inputs are exact, conservative, bounded, and fail closed", () => {
  const queue = buildDogArtworkDiscoveryQueue(fixture());
  const item = queue.items[0];
  assert.equal(buildArtworkSearchQuery('  Promoted "One"  '), '"Promoted One" dog');
  assert.equal(item.discovery.query, '"Promoted One" dog');

  const openverse = new URL(item.discovery.openverse.requestUrl);
  assert.equal(openverse.origin, "https://api.openverse.org");
  assert.equal(openverse.searchParams.get("source"), "wikimedia");
  assert.equal(openverse.searchParams.get("page"), "1");
  assert.equal(openverse.searchParams.get("page_size"), "10");
  assert.equal(openverse.searchParams.get("license"), "cc0,pdm,by,by-sa");
  assert.equal(openverse.searchParams.get("license_type"), "commercial,modification");
  assert.equal(openverse.searchParams.get("mature"), "false");
  assert.equal(openverse.searchParams.get("filter_dead"), "true");

  const commons = new URL(item.discovery.commons.apiSearchUrl);
  assert.equal(commons.origin, "https://commons.wikimedia.org");
  assert.equal(commons.searchParams.get("gsrnamespace"), "6");
  assert.equal(commons.searchParams.get("gsrlimit"), "10");
  assert.equal(item.reviewState, "no-ledger-row");
  assert.deepEqual(item.permissions, {
    uiDisplayAllowed: false,
    publicSnapshotAllowed: false,
    rasterExportAllowed: false,
  });
  assert.equal(queue.policy.automaticImportAllowed, false);
  assert.equal(queue.policy.automaticApprovalAllowed, false);
  assert.equal(queue.policy.bulkDownloadAllowed, false);
});

test("queue output is deterministic across source ordering", () => {
  const sources = fixture();
  const first = buildDogArtworkDiscoveryQueue(sources);
  const second = buildDogArtworkDiscoveryQueue({
    ...sources,
    catalog: { ...sources.catalog, entities: [...sources.catalog.entities].reverse() },
    ledger: { ...sources.ledger, assets: [...sources.ledger.assets].reverse() },
    packs: { ...sources.packs, packs: [...sources.packs.packs].reverse() },
  });
  assert.equal(stableJson(first), stableJson(second));
});

test("validator rejects missing coverage, unsafe permission, stale ordering, or missing source digest", () => {
  const sources = fixture();
  const queue = buildDogArtworkDiscoveryQueue(sources);
  const broken = structuredClone(queue);
  broken.items.shift();
  broken.items[0].permissions.uiDisplayAllowed = true;
  broken.items[0].priority.packCount = 99;
  broken.items.reverse();
  broken.sourceVersions.catalogSha256 = "";
  const errors = validateDogArtworkDiscoveryQueue({ queue: broken, ...sources });
  assert.ok(errors.some((error) => /every and only current-canonical/.test(error)));
  assert.ok(errors.some((error) => /purpose/.test(error)));
  assert.ok(errors.some((error) => /priority ordering/.test(error)));
  assert.ok(errors.some((error) => /pack engagement sources/.test(error)));
  assert.ok(errors.some((error) => /catalogSha256/.test(error)));
});

test("tracked discovery queue exactly matches the current versioned catalog, ledger, packs, and policy", async () => {
  const paths = {
    catalog: new URL("data/dogs/dog-catalog.json", root),
    ledger: new URL("data/dogs/image-rights.json", root),
    packs: new URL("data/dogs/packs.json", root),
    policy: new URL("data/dogs/artwork-license-policy.json", root),
    queue: new URL("data/dogs/artwork-discovery-queue.json", root),
  };
  const [catalogText, ledgerText, packsText, policyText, queueText] = await Promise.all([
    readFile(paths.catalog, "utf8"),
    readFile(paths.ledger, "utf8"),
    readFile(paths.packs, "utf8"),
    readFile(paths.policy, "utf8"),
    readFile(paths.queue, "utf8"),
  ]);
  const built = buildDogArtworkDiscoveryQueue({
    catalog: JSON.parse(catalogText),
    ledger: JSON.parse(ledgerText),
    packs: JSON.parse(packsText),
    policy: JSON.parse(policyText),
    sourceHashes: {
      catalog: sha256Text(catalogText),
      ledger: sha256Text(ledgerText),
      packs: sha256Text(packsText),
      policy: sha256Text(policyText),
    },
  });
  assert.equal(queueText, stableJson(built));
  assert.equal(built.sourceVersions.catalogVersion, "vbo-2026-04-15.2");
  assert.equal(built.summary.currentCanonicalCount, 899);
  assert.equal(built.summary.catalogIdsWithLedgerRows, 28);
  assert.equal(built.summary.queuedMissingLedgerRows, 871);
  assert.equal(built.summary.promoted, 0);
  assert.equal(built.summary.packEngaged, 185);
  assert.equal(built.summary.catalogLongTail, 686);
  const ledgerIds = new Set(JSON.parse(ledgerText).assets.map((asset) => asset.catalogId));
  assert.ok(built.items.every((item) => !ledgerIds.has(item.catalogId)));
  assert.equal(new Set(built.items.map((item) => item.catalogId)).size, 871);
});
