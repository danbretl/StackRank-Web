import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activateDogArtworkDeliveries,
  applyDogArtworkLinksToOverrides,
} from "../scripts/activate-dog-artwork-deliveries.mjs";

const asset = (overrides = {}) => ({
  assetId: "dogs:photo:commons:aaaaaaaaaaaaaaaa",
  catalogId: "VBO:0200623",
  licenseId: "CC-BY-SA-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  modifications: ["none"],
  review: {
    status: "approved",
    subjectMatchesCatalog: true,
    nonCopyrightRestrictionsReviewed: true,
  },
  uiDisplayAllowed: false,
  publicSnapshotAllowed: false,
  rasterExportAllowed: false,
  delivery: { status: "not_ready", variants: [] },
  ...overrides,
});

const report = (overrides = {}) => ({
  kind: "stackrank-dogs-artwork-delivery-verification",
  mode: "upload-and-verify",
  catalogId: "VBO:0200623",
  remote: {
    status: "verified",
    publicAssetBaseUrl: "https://project.supabase.co/storage/v1/object/public/",
  },
  ledgerMutationPerformed: false,
  ledgerFragment: {
    assetId: "dogs:photo:commons:aaaaaaaaaaaaaaaa",
    catalogId: "VBO:0200623",
    delivery: {
      status: "uploaded_verified",
      variants: [
        {
          role: "card",
          objectPath: "dogs-catalog/v1/example-320.webp",
        },
        {
          role: "detail",
          objectPath: "dogs-catalog/v1/example-960.webp",
        },
      ],
    },
  },
  ...overrides,
});

test("verified Dogs deliveries activate only in-app display with required compliance", () => {
  const result = activateDogArtworkDeliveries({
    ledger: {
      ledgerVersion: "old",
      updatedAt: "2026-07-21",
      storagePrefix: "dogs-catalog/v1/",
      publicAssetBaseUrl: "https://project.supabase.co/storage/v1/object/public/",
      assets: [asset()],
    },
    reports: [report()],
    ledgerVersion: "2026-07-22.1",
    activatedAt: "2026-07-22",
  });
  const activated = result.ledger.assets[0];
  assert.deepEqual(activated.modifications, ["crop", "resize", "webp conversion"]);
  assert.equal(activated.delivery.status, "uploaded_verified");
  assert.equal(activated.uiDisplayAllowed, true);
  assert.equal(activated.publicSnapshotAllowed, false);
  assert.equal(activated.rasterExportAllowed, false);
  assert.equal(activated.attributionCompliance.attributionSurface, "detail-and-credits");
  assert.equal(activated.shareAlikeCompliance.adapterLicenseId, "CC-BY-SA-4.0");
  assert.deepEqual(result.links, [{
    catalogId: "VBO:0200623",
    assetId: "dogs:photo:commons:aaaaaaaaaaaaaaaa",
  }]);
});

test("catalog artwork links preserve compact overrides and can add a new entity", () => {
  const source = `{
  "schemaVersion": 1,
  "entities": {
    "VBO:0000661": {"displayName": "Broholmer"}
  },
  "searchAliasOwners": {}
}\n`;
  const updated = applyDogArtworkLinksToOverrides(source, [
    { catalogId: "VBO:0000661", assetId: "dogs:photo:commons:bbbbbbbbbbbbbbbb" },
    { catalogId: "VBO:0200623", assetId: "dogs:photo:commons:aaaaaaaaaaaaaaaa" },
  ]);
  const parsed = JSON.parse(updated);
  assert.equal(
    parsed.entities["VBO:0000661"].primaryImageAssetId,
    "dogs:photo:commons:bbbbbbbbbbbbbbbb",
  );
  assert.equal(
    parsed.entities["VBO:0200623"].primaryImageAssetId,
    "dogs:photo:commons:aaaaaaaaaaaaaaaa",
  );
  assert.ok(updated.split("\n").length < 12);
});

test("activation rejects unverified reports and unrelated purpose expansion", () => {
  const common = {
    ledger: {
      storagePrefix: "dogs-catalog/v1/",
      publicAssetBaseUrl: "https://project.supabase.co/storage/v1/object/public/",
      assets: [asset()],
    },
    reports: [report({ remote: { status: "pending" } })],
    ledgerVersion: "2026-07-22.1",
    activatedAt: "2026-07-22",
  };
  assert.throws(() => activateDogArtworkDeliveries(common), /verified, secret-free/u);
  assert.throws(
    () => activateDogArtworkDeliveries({
      ...common,
      ledger: { ...common.ledger, assets: [asset({ publicSnapshotAllowed: true })] },
      reports: [report()],
    }),
    /unrelated sharing purpose/u,
  );
});
