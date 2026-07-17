// Purpose-level provider and artwork policy checks for new StackRank
// categories. Every purpose requires an explicit capability grant; artwork
// purposes also require an explicit per-asset grant. Unknown purposes deny.

export const PROVIDER_PURPOSES = Object.freeze({
  ACCOUNT_SYNC: "account-sync",
  LIVE_SUGGESTIONS: "live-suggestions",
  PUBLIC_SNAPSHOT: "public-snapshot",
  TEXT_EXPORT: "text-export",
  ARTWORK_UI_DISPLAY: "artwork-ui-display",
  ARTWORK_PUBLIC_SNAPSHOT: "artwork-public-snapshot",
  ARTWORK_RASTER_EXPORT: "artwork-raster-export",
});

const PURPOSE_RULES = Object.freeze({
  [PROVIDER_PURPOSES.ACCOUNT_SYNC]: Object.freeze({
    capability: "accountSync",
  }),
  [PROVIDER_PURPOSES.LIVE_SUGGESTIONS]: Object.freeze({
    capability: "liveSuggestions",
  }),
  [PROVIDER_PURPOSES.PUBLIC_SNAPSHOT]: Object.freeze({
    capability: "publicSnapshots",
  }),
  [PROVIDER_PURPOSES.TEXT_EXPORT]: Object.freeze({
    capability: "textExport",
  }),
  [PROVIDER_PURPOSES.ARTWORK_UI_DISPLAY]: Object.freeze({
    capability: "artworkDisplay",
    assetFlag: "uiDisplayAllowed",
    rightsGate: "uiDisplay",
  }),
  [PROVIDER_PURPOSES.ARTWORK_PUBLIC_SNAPSHOT]: Object.freeze({
    capability: "publicSnapshots",
    assetFlag: "publicSnapshotAllowed",
    rightsGate: "publicSnapshot",
  }),
  [PROVIDER_PURPOSES.ARTWORK_RASTER_EXPORT]: Object.freeze({
    capability: "rasterArtworkExport",
    assetFlag: "rasterExportAllowed",
    rightsGate: "rasterExport",
  }),
});

const VERIFIED_DELIVERY_STATUSES = new Set([
  "bundled_verified",
  "uploaded_verified",
]);

const denied = (purpose, reason, details = {}) => ({
  allowed: false,
  purpose,
  reason,
  ...details,
});

export function evaluateProviderPurpose(policy, purpose, context = {}) {
  const asset = context?.asset;
  const rightsPolicy = context?.rightsPolicy;
  const rule = PURPOSE_RULES[purpose];
  if (!rule) return denied(purpose, "unknown-purpose");

  const capabilities = policy?.capabilities;
  if (!capabilities || capabilities[rule.capability] !== true) {
    return denied(purpose, "capability-disabled", {
      capability: rule.capability,
    });
  }

  if (rule.assetFlag) {
    if (!asset || typeof asset !== "object") {
      return denied(purpose, "asset-required", {
        capability: rule.capability,
        assetFlag: rule.assetFlag,
      });
    }
    if (rightsPolicy?.purposeGates?.[rule.rightsGate]?.enabled !== true) {
      return denied(purpose, "rights-policy-disabled", {
        capability: rule.capability,
        assetFlag: rule.assetFlag,
        rightsGate: rule.rightsGate,
      });
    }
    if (asset?.review?.status !== "approved") {
      return denied(purpose, "asset-review-not-approved", {
        capability: rule.capability,
        assetFlag: rule.assetFlag,
      });
    }
    if (asset?.review?.subjectMatchesCatalog !== true) {
      return denied(purpose, "asset-subject-unverified", {
        capability: rule.capability,
        assetFlag: rule.assetFlag,
      });
    }
    if (!VERIFIED_DELIVERY_STATUSES.has(asset?.delivery?.status)) {
      return denied(purpose, "asset-delivery-unverified", {
        capability: rule.capability,
        assetFlag: rule.assetFlag,
      });
    }
    if (asset[rule.assetFlag] !== true) {
      return denied(purpose, "asset-purpose-denied", {
        capability: rule.capability,
        assetFlag: rule.assetFlag,
      });
    }
  }

  return {
    allowed: true,
    purpose,
    reason: "allowed",
    capability: rule.capability,
    ...(rule.assetFlag
      ? { assetFlag: rule.assetFlag, rightsGate: rule.rightsGate }
      : {}),
  };
}

export function canProviderPurpose(policy, purpose, context) {
  return evaluateProviderPurpose(policy, purpose, context).allowed;
}
