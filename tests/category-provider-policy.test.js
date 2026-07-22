import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canProviderPurpose,
  evaluateProviderPurpose,
  PROVIDER_PURPOSES,
} from "../lib/provider-policy.js";

const DOGS_POLICY = {
  capabilities: {
    accountSync: false,
    liveSuggestions: false,
    publicSnapshots: true,
    textExport: true,
    artworkDisplay: true,
    rasterArtworkExport: false,
  },
};

const RIGHTS_POLICY = {
  purposeGates: {
    uiDisplay: { enabled: true },
    publicSnapshot: { enabled: true },
    rasterExport: { enabled: true },
  },
};

const approvedAsset = (overrides = {}) => ({
  review: { status: "approved", subjectMatchesCatalog: true },
  delivery: { status: "bundled_verified" },
  uiDisplayAllowed: true,
  publicSnapshotAllowed: true,
  rasterExportAllowed: true,
  ...overrides,
});

test("provider purposes deny missing, unknown, and disabled capabilities", () => {
  assert.deepEqual(evaluateProviderPurpose(null, PROVIDER_PURPOSES.ACCOUNT_SYNC), {
    allowed: false,
    purpose: "account-sync",
    reason: "capability-disabled",
    capability: "accountSync",
  });
  assert.equal(evaluateProviderPurpose(DOGS_POLICY, "invented-purpose").reason, "unknown-purpose");
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY, null).reason,
    "asset-required",
  );
  assert.equal(canProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ACCOUNT_SYNC), false);
  assert.equal(canProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.LIVE_SUGGESTIONS), false);
  assert.equal(canProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.TEXT_EXPORT), true);
});

test("artwork purpose checks require category and exact asset grants", () => {
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY).reason,
    "asset-required",
  );
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY, {
      asset: approvedAsset({ uiDisplayAllowed: false }),
      rightsPolicy: RIGHTS_POLICY,
    }).reason,
    "asset-purpose-denied",
  );
  assert.equal(
    canProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY, {
      asset: approvedAsset(),
      rightsPolicy: RIGHTS_POLICY,
    }),
    true,
  );
  assert.equal(
    canProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ARTWORK_PUBLIC_SNAPSHOT, {
      asset: approvedAsset(),
      rightsPolicy: RIGHTS_POLICY,
    }),
    true,
  );
  assert.equal(
    canProviderPurpose(DOGS_POLICY, PROVIDER_PURPOSES.ARTWORK_RASTER_EXPORT, {
      asset: approvedAsset(),
      rightsPolicy: RIGHTS_POLICY,
    }),
    false,
    "an asset grant cannot override a disabled category capability",
  );
});

test("omitted asset booleans fail closed even when another purpose is allowed", () => {
  const asset = approvedAsset({ rasterExportAllowed: undefined });
  const rasterPolicy = {
    capabilities: { ...DOGS_POLICY.capabilities, rasterArtworkExport: true },
  };
  assert.equal(
    evaluateProviderPurpose(rasterPolicy, PROVIDER_PURPOSES.ARTWORK_RASTER_EXPORT, {
      asset,
      rightsPolicy: RIGHTS_POLICY,
    }).reason,
    "asset-purpose-denied",
  );
});

test("artwork gates require global rights approval, human review, and verified delivery", () => {
  const purpose = PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY;
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, purpose, { asset: approvedAsset() }).reason,
    "rights-policy-disabled",
  );
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, purpose, {
      asset: approvedAsset(),
      rightsPolicy: { purposeGates: { uiDisplay: { enabled: false } } },
    }).reason,
    "rights-policy-disabled",
  );
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, purpose, {
      asset: approvedAsset({ review: { status: "pending", subjectMatchesCatalog: true } }),
      rightsPolicy: RIGHTS_POLICY,
    }).reason,
    "asset-review-not-approved",
  );
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, purpose, {
      asset: approvedAsset({ review: { status: "approved", subjectMatchesCatalog: false } }),
      rightsPolicy: RIGHTS_POLICY,
    }).reason,
    "asset-subject-unverified",
  );
  assert.equal(
    evaluateProviderPurpose(DOGS_POLICY, purpose, {
      asset: approvedAsset({ delivery: { status: "not_ready" } }),
      rightsPolicy: RIGHTS_POLICY,
    }).reason,
    "asset-delivery-unverified",
  );
});
