import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  portraitCohortSelectionDigest,
  summarizePortraitCohort,
  validatePortraitCohort,
} from "../scripts/dog-portrait-cohort.mjs";

const root = new URL("../", import.meta.url);
const frozen = JSON.parse(await readFile(new URL("data/dogs/portrait-cohort-e.json", root), "utf8"));
const catalog = JSON.parse(await readFile(new URL("data/dogs/dog-catalog.json", root), "utf8"));
const expectedDigest = "2dee8d3221097abe699cba2538d0d1d62da42b505027a81eb117caeb62e1b63c";

function fixture() {
  const cohort = structuredClone(frozen);
  for (const entry of cohort.entries) {
    entry.reference = { status: "pending" };
    entry.scene = { status: "pending" };
    entry.generation = { status: "pending", attempts: [], acceptedAttemptId: null };
    entry.qa = { status: "pending" };
    entry.integration = { status: "pending" };
  }
  cohort.progress = summarizePortraitCohort(cohort);
  return cohort;
}

function acceptFirst(cohort) {
  const entry = cohort.entries[0];
  entry.reference = { status: "approved", assetId: "ref-1", sourcePage: "https://commons.wikimedia.org/wiki/File:Exact.jpg", visualReview: "Exact breed subject reviewed at full resolution." };
  entry.scene = { status: "ready", description: "A natural standing portrait in a varied meadow.", rationale: "Neutral natural landscape avoids unsupported specificity.", sources: ["data/dogs/breed-profiles.json"] };
  entry.generation = { status: "accepted", acceptedAttemptId: "e01-001-a1", attempts: [{ number: 1, id: "e01-001-a1", status: "generated", startedAt: "2026-09-22T19:00:00Z", prompt: "The exact generation prompt.", masterPath: "assets/dogs/generated-masters/e01/first.png", masterSha256: "a".repeat(64), qaDecision: "accepted" }] };
  entry.qa = { status: "approved", reviewedAt: "2026-09-22", breedIdentity: "Breed-typical form reviewed.", anatomy: "All limbs and tail verified.", crop: "Full body retained.", aesthetics: "Scene and restrained palette inspected.", contactSheetPath: "reports/dogs-generated-artwork/cohort-e01.jpg" };
  return entry;
}

test("cohort E retains its exact frozen 250 identities, first 161 pack priorities and ten subwaves", () => {
  assert.equal(portraitCohortSelectionDigest(frozen), expectedDigest);
  assert.equal(frozen.selectionSha256, expectedDigest);
  const cohort = fixture();
  assert.deepEqual(validatePortraitCohort(cohort, { catalog }), []);
  assert.equal(cohort.entries.length, 250);
  assert.equal(new Set(cohort.entries.map((entry) => entry.catalogId)).size, 250);
  assert.ok(cohort.entries.slice(0, 161).every((entry, index) => entry.discoveryPriorityRank === index + 1 && entry.selection.packIds.length > 0));
  assert.ok(cohort.entries.slice(161).every((entry) => entry.selection.packIds.length === 0 && entry.selection.profileReviewStatus === "source-reviewed" && entry.selection.profileOriginAssociations.length > 0));
  assert.ok(cohort.progress.subwaves.every((wave) => wave.targetCount === 25));
  assert.deepEqual(cohort.progress.nextIdentity, { ordinal: 1, catalogId: "VBO:0201316", displayName: "Swedish Vallhund", subwave: "e01" });
});

test("progress updates never change the frozen identity and source digest", () => {
  const cohort = fixture();
  acceptFirst(cohort);
  cohort.progress = summarizePortraitCohort(cohort);
  assert.equal(portraitCohortSelectionDigest(cohort), expectedDigest);
  assert.deepEqual(validatePortraitCohort(cohort, { catalog }), []);
  assert.equal(cohort.progress.acceptedCount, 1);
  assert.equal(cohort.progress.integratedCount, 0);
  assert.equal(cohort.progress.nextIdentity.catalogId, cohort.entries[0].catalogId);
});

test("cohort changes and stale progress cannot silently pass validation", () => {
  const cohort = fixture();
  [cohort.entries[0], cohort.entries[1]] = [cohort.entries[1], cohort.entries[0]];
  assert.ok(validatePortraitCohort(cohort).some((error) => /Frozen selection digest mismatch/.test(error)));
  const stale = fixture();
  acceptFirst(stale);
  assert.ok(validatePortraitCohort(stale).some((error) => /Progress summary is stale/.test(error)));
});

test("failed calls and rejected masters remain distinct and every retry is counted", () => {
  const cohort = fixture();
  const entry = acceptFirst(cohort);
  const original = entry.generation.attempts[0];
  entry.generation.attempts = [
    { number: 1, id: "a1", status: "failed", startedAt: "2026-09-22", prompt: "Exact first prompt.", qaDecision: "pending", failure: "Tool returned a transient service error." },
    { ...original, number: 2, id: "a2", qaDecision: "rejected", rejectionReason: "Tail crop was too tight." },
    { ...original, number: 3, id: "a3" },
  ];
  entry.generation.acceptedAttemptId = "a3";
  cohort.progress = summarizePortraitCohort(cohort);
  assert.deepEqual(validatePortraitCohort(cohort), []);
  assert.equal(cohort.progress.attemptCount, 3);
  assert.equal(cohort.progress.completedGenerationCount, 2);
  assert.equal(cohort.progress.failedCallCount, 1);
  assert.equal(cohort.progress.rejectedMasterCount, 1);
  assert.equal(cohort.progress.retryCount, 2);
  assert.equal(cohort.progress.acceptedCount, 1);
});

test("approval requires exact master, source, scene and separate visual evidence", () => {
  const cohort = fixture();
  const entry = acceptFirst(cohort);
  entry.reference.status = "pending";
  entry.generation.attempts[0].masterPath = "assets/public-master.png";
  entry.qa.anatomy = "";
  cohort.progress = summarizePortraitCohort(cohort);
  const errors = validatePortraitCohort(cohort);
  assert.ok(errors.some((error) => /reviewed reference/.test(error)));
  assert.ok(errors.some((error) => /ignored master path/.test(error)));
  assert.ok(errors.some((error) => /four review dimensions/.test(error)));
});

test("integration advances the next identity only with matching accepted master and purpose gates", () => {
  const cohort = fixture();
  const entry = acceptFirst(cohort);
  entry.integration = { status: "integrated", assetId: "generated-1", batchManifest: "data/dogs/generated-artwork-batch-e01.json", integratedAt: "2026-09-22" };
  cohort.progress = summarizePortraitCohort(cohort);
  const sources = {
    catalog,
    rightsLedger: { assets: [{ assetId: "ref-1", catalogId: entry.catalogId, sourcePage: entry.reference.sourcePage, review: { status: "approved", subjectMatchesCatalog: true, nonCopyrightRestrictionsReviewed: true }, uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false }] },
    generatedArtwork: { assets: [{ assetId: "generated-1", catalogId: entry.catalogId, masterSha256: "a".repeat(64), reference: { assetId: "ref-1" }, uiDisplayAllowed: true, publicSnapshotAllowed: false, rasterExportAllowed: false }] },
  };
  assert.deepEqual(validatePortraitCohort(cohort, sources), []);
  assert.equal(cohort.progress.integratedCount, 1);
  assert.equal(cohort.progress.nextIdentity.catalogId, cohort.entries[1].catalogId);
  sources.generatedArtwork.assets[0].masterSha256 = "b".repeat(64);
  sources.rightsLedger.assets[0].uiDisplayAllowed = true;
  const errors = validatePortraitCohort(cohort, sources);
  assert.ok(errors.some((error) => /does not match accepted master/.test(error)));
  assert.ok(errors.some((error) => /reference purposes must remain denied/.test(error)));
});
