import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTWORK_REVIEW_PAGE_SIZE,
  buildArtworkReviewExport,
  clearArtworkReview,
  filterArtworkAssets,
  isArtworkReviewStale,
  normalizeArtworkReviewState,
  paginateArtworkAssets,
  preferredArtworkVariant,
  setArtworkReview,
} from "../lib/dogs-artwork-review.js";

const assets = [
  {
    assetId: "dogs:generated:vbo-1:v1",
    catalogId: "VBO:0000001",
    name: "Alpha Hound",
    aliases: ["First Dog"],
    masterSha256: "a".repeat(64),
    generatedAt: "2026-09-22T10:00:00Z",
    variants: [
      { role: "card", url: "alpha-320.webp" },
      { role: "detail", url: "alpha-960.webp" },
    ],
  },
  {
    assetId: "dogs:generated:vbo-2:v1",
    catalogId: "VBO:0000002",
    name: "Beta Terrier",
    aliases: [],
    masterSha256: "b".repeat(64),
    generatedAt: "2026-09-22T11:00:00Z",
    variants: [{ role: "card", url: "beta-320.webp" }],
  },
];

test("review state keeps only known concerns and bounded non-empty records", () => {
  const normalized = normalizeArtworkReviewState({
    reviews: {
      "dogs:generated:vbo-1:v1": {
        concerns: ["anatomy", "anatomy", "unsupported"],
        note: `  needs another look ${"x".repeat(2100)}  `,
        updatedAt: "2026-09-22T12:00:00Z",
      },
      empty: { concerns: [], note: "" },
    },
  });
  assert.deepEqual(normalized.reviews["dogs:generated:vbo-1:v1"].concerns, ["anatomy"]);
  assert.equal(normalized.reviews["dogs:generated:vbo-1:v1"].note.length, 2000);
  assert.equal("empty" in normalized.reviews, false);
});

test("saving and clearing one artwork review does not disturb other records", () => {
  let state = setArtworkReview(null, assets[0].assetId, {
    concerns: ["breedIdentity", "scene"],
    note: "Tail and background need review.",
  }, "2026-09-22T12:30:00Z");
  state = setArtworkReview(state, assets[1].assetId, { concerns: ["framing"], note: "" }, "2026-09-22T12:31:00Z");
  state = clearArtworkReview(state, assets[0].assetId);
  assert.equal(state.reviews[assets[0].assetId], undefined);
  assert.deepEqual(state.reviews[assets[1].assetId].concerns, ["framing"]);
});

test("search includes names, aliases, and catalog ids while flagged filtering is local", () => {
  const state = setArtworkReview(null, assets[1].assetId, { concerns: ["other"], note: "" }, "2026-09-22T12:00:00Z");
  assert.deepEqual(filterArtworkAssets(assets, { query: "first dog" }).map((asset) => asset.name), ["Alpha Hound"]);
  assert.deepEqual(filterArtworkAssets(assets, { query: "VBO:0000002" }).map((asset) => asset.name), ["Beta Terrier"]);
  assert.deepEqual(filterArtworkAssets(assets, { flaggedOnly: true, reviews: state.reviews }).map((asset) => asset.name), ["Beta Terrier"]);
});

test("pagination clamps page state and reports exact visible ranges", () => {
  const many = Array.from({ length: ARTWORK_REVIEW_PAGE_SIZE + 3 }, (_, index) => ({ id: index }));
  assert.deepEqual(paginateArtworkAssets(many, 2), {
    items: many.slice(ARTWORK_REVIEW_PAGE_SIZE),
    page: 2,
    pageSize: ARTWORK_REVIEW_PAGE_SIZE,
    totalPages: 2,
    totalItems: ARTWORK_REVIEW_PAGE_SIZE + 3,
    start: ARTWORK_REVIEW_PAGE_SIZE + 1,
    end: ARTWORK_REVIEW_PAGE_SIZE + 3,
  });
  assert.equal(paginateArtworkAssets(many, 99).page, 2);
});

test("export carries stable triage identifiers and exact generation evidence", () => {
  const state = setArtworkReview(null, assets[0].assetId, {
    concerns: ["breedIdentity", "anatomy"],
    note: "Check the far hind paw.",
    masterSha256: assets[0].masterSha256,
    generatedAt: assets[0].generatedAt,
  }, "2026-09-22T12:30:00Z");
  const payload = buildArtworkReviewExport({
    state,
    assets,
    manifestVersion: "manifest-v1",
    exportedAt: "2026-09-22T13:00:00Z",
  });
  assert.equal(payload.reviewCount, 1);
  assert.deepEqual(payload.reviews[0], {
    assetId: assets[0].assetId,
    catalogId: assets[0].catalogId,
    name: assets[0].name,
    masterSha256: assets[0].masterSha256,
    generatedAt: assets[0].generatedAt,
    currentMasterSha256: assets[0].masterSha256,
    currentGeneratedAt: assets[0].generatedAt,
    stale: false,
    concerns: ["breedIdentity", "anatomy"],
    note: "Check the far hind paw.",
    reviewedAt: "2026-09-22T12:30:00Z",
  });
});

test("review-time generation evidence marks a replacement master as stale", () => {
  const review = {
    concerns: ["breedIdentity"],
    note: "",
    masterSha256: "c".repeat(64),
    generatedAt: "2026-09-20T10:00:00Z",
  };
  assert.equal(isArtworkReviewStale(review, assets[0]), true);
  const state = { schemaVersion: 1, reviews: { [assets[0].assetId]: review } };
  const payload = buildArtworkReviewExport({ state, assets, manifestVersion: "manifest-v2" });
  assert.equal(payload.reviews[0].masterSha256, "c".repeat(64));
  assert.equal(payload.reviews[0].currentMasterSha256, assets[0].masterSha256);
  assert.equal(payload.reviews[0].stale, true);
});

test("detail variant is preferred with a safe card fallback", () => {
  assert.equal(preferredArtworkVariant(assets[0], "detail").url, "alpha-960.webp");
  assert.equal(preferredArtworkVariant(assets[1], "detail").url, "beta-320.webp");
});
