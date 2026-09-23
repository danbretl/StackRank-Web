import { createHash } from "node:crypto";

export const cohortDigest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value) => typeof value === "string" && value.trim().length > 0;
const hash = (value) => /^[a-f0-9]{64}$/.test(value || "");

// F is a completed-pair target with immutable selection pools and append-only substitutions.
// This separate schema deliberately leaves the frozen cohort-E rules untouched.
export function portraitCohortFSelectionDigest(cohort) {
  return cohortDigest({ cohortId: cohort.cohortId, frozenAt: cohort.frozenAt,
    targetCompletedCount: cohort.targetCompletedCount, baseline: cohort.baseline,
    selectionPolicy: cohort.selectionPolicy, sourceSnapshots: cohort.sourceSnapshots,
    primary: cohort.primary, reserves: cohort.reserves, retainedHolds: cohort.retainedHolds });
}

export function activeCohortFIds(cohort) {
  const ids = cohort.primary.map((entry) => entry.catalogId);
  for (const amendment of cohort.amendments) {
    const index = ids.indexOf(amendment.blockedCatalogId);
    if (index >= 0) ids[index] = amendment.activatedCatalogId;
  }
  return ids;
}

export function summarizePortraitCohortF(cohort) {
  const all = Object.values(cohort.entries);
  const active = activeCohortFIds(cohort).map((id) => cohort.entries[id]).filter(Boolean);
  const attempts = all.flatMap((entry) => entry.generation.attempts);
  return {
    targetCount: cohort.targetCompletedCount,
    referenceApprovedCount: active.filter((entry) => entry.reference.status === "approved").length,
    profileApprovedCount: active.filter((entry) => entry.profile.status === "approved").length,
    attemptedIdentityCount: all.filter((entry) => entry.generation.attempts.length).length,
    generationCallCount: attempts.length,
    generatedOutputCount: attempts.filter((attempt) => attempt.status === "generated").length,
    failedCallCount: attempts.filter((attempt) => attempt.status === "failed").length,
    rejectedMasterCount: attempts.filter((attempt) => attempt.qaDecision === "rejected").length,
    unselectedMasterCount: attempts.filter((attempt) => attempt.qaDecision === "unselected").length,
    retryCount: all.reduce((sum, entry) => sum + Math.max(0, entry.generation.attempts.length - 1), 0),
    acceptedPairCount: active.filter((entry) => entry.qa.status === "approved" && entry.profile.status === "approved").length,
    integratedPairCount: active.filter((entry) => entry.integration.status === "integrated").length,
    publishedPairCount: active.filter((entry) => entry.publication.status === "published").length,
    blockedCount: all.filter((entry) => entry.hold?.status === "blocked").length,
    reserveActivationCount: cohort.amendments.length,
    remainingCount: cohort.targetCompletedCount - active.filter((entry) => entry.publication.status === "published").length,
    nextCatalogId: active.find((entry) => entry.publication.status !== "published" && entry.hold?.status !== "blocked")?.catalogId || null,
  };
}

export function validatePortraitCohortF(cohort, { catalog, rightsLedger, generatedArtwork, profiles } = {}) {
  const errors = [];
  const fail = (ok, message) => { if (!ok) errors.push(message); };
  fail(cohort.schemaVersion === 2 && cohort.cohortId === "dogs-portraits-f", "Unknown F cohort schema or identity");
  fail(cohort.targetCompletedCount === 100 && cohort.primary?.length === 100, "F requires 100 frozen primary identities and completed pairs");
  if (!Array.isArray(cohort.primary) || !Array.isArray(cohort.reserves) || !Array.isArray(cohort.amendments) || !cohort.entries) return [...errors, "Missing selection pools, amendments or entries"];
  fail(cohort.selectionSha256 === portraitCohortFSelectionDigest(cohort), "Frozen F selection digest mismatch");
  fail(cohort.baseline?.selectableCount === 1239 && cohort.baseline?.illustratedCount === 282 && cohort.baseline?.developedCount === 282, "F baseline changed");
  fail(cohort.retainedHolds?.length === 20, "Retain all twenty cohort-E holds");
  const catalogById = new Map((catalog?.entities || []).map((entry) => [entry.id, entry]));
  const rightsById = new Map((rightsLedger?.assets || []).map((entry) => [entry.assetId, entry]));
  const generatedById = new Map((generatedArtwork?.assets || []).map((entry) => [entry.catalogId, entry]));
  const pools = [...cohort.primary, ...cohort.reserves];
  fail(new Set(pools.map((entry) => entry.catalogId)).size === pools.length, "Duplicate selection identity");
  for (const pool of [cohort.primary, cohort.reserves]) pool.forEach((entry, index) => {
    const id = entry.catalogId;
    fail(entry.ordinal === index + 1 && text(entry.rationale), `${id}: ordered selection and rationale required`);
    fail(!cohort.baseline.generatedCatalogIds.includes(id), `${id}: already illustrated at freeze`);
    fail(!cohort.retainedHolds.some((hold) => hold.catalogId === id), `${id}: existing E hold cannot silently reopen`);
    if (catalog) fail(catalogById.get(id)?.selectable === true && catalogById.get(id)?.displayName === entry.displayName && catalogById.get(id)?.status === entry.catalogStatus, `${id}: exact selectable catalog identity mismatch`);
  });
  for (const key of ["catalog", "profiles", "packs", "rightsLedger", "generatedArtwork", "artworkLicensePolicy", "generatedArtworkPolicy", "cohortE"]) {
    fail(text(cohort.sourceSnapshots?.[key]?.path) && hash(cohort.sourceSnapshots?.[key]?.sha256), `${key}: exact source snapshot hash required`);
  }
  const active = cohort.primary.map((entry) => entry.catalogId);
  const activated = new Set();
  let previousSha256 = cohort.selectionSha256;
  for (const [index, amendment] of cohort.amendments.entries()) {
    const { sha256, ...content } = amendment;
    const slot = active.indexOf(amendment.blockedCatalogId);
    fail(amendment.sequence === index + 1 && amendment.previousSha256 === previousSha256 && sha256 === cohortDigest(content), "Append-only selection amendment chain mismatch");
    fail(slot >= 0 && cohort.entries[amendment.blockedCatalogId]?.hold?.status === "blocked", "Reserve activation requires an active blocked identity");
    const next = cohort.reserves.find((entry) => !activated.has(entry.catalogId) && cohort.reserveAssessments?.[entry.catalogId]?.status !== "blocked");
    fail(next?.catalogId === amendment.activatedCatalogId, "Must activate the next eligible ordered reserve");
    fail(text(amendment.recordedAt) && text(amendment.reason) && amendment.evidencePaths?.length > 0, "Reserve activation requires dated evidence");
    if (slot >= 0) active[slot] = amendment.activatedCatalogId;
    activated.add(amendment.activatedCatalogId);
    previousSha256 = sha256;
  }
  for (const [id, assessment] of Object.entries(cohort.reserveAssessments || {})) fail(cohort.reserves.some((entry) => entry.catalogId === id) && assessment.status === "blocked" && text(assessment.reason) && assessment.evidencePaths?.length > 0, `${id}: skipped reserve requires evidence`);
  const selected = new Set([...cohort.primary.map((entry) => entry.catalogId), ...activated]);
  fail(Object.keys(cohort.entries).length === selected.size, "Progress must retain every primary and activated reserve");
  for (const id of selected) {
    const entry = cohort.entries[id];
    if (!entry) { errors.push(`${id}: missing retained progress entry`); continue; }
    fail(entry.catalogId === id, `${id}: progress identity mismatch`);
    if (entry.hold?.status === "blocked") fail(text(entry.hold.reason) && entry.hold.evidencePaths?.length > 0, `${id}: hold evidence required`);
    const attempts = entry.generation?.attempts;
    if (!Array.isArray(attempts)) { errors.push(`${id}: append-only attempts missing`); continue; }
    if (entry.reference.status === "approved") {
      fail(text(entry.reference.assetId) && text(entry.reference.visualReview) && hash(entry.reference.sourceSha256) && text(entry.reference.rightsReview), `${id}: exact reference and accountable visual/rights review required`);
      if (rightsLedger) {
        const reference = rightsById.get(entry.reference.assetId);
        fail(reference?.catalogId === id && reference?.sourcePage === entry.reference.sourcePage && reference?.sourceSha256 === entry.reference.sourceSha256 && reference?.review?.status === "approved" && reference?.review?.subjectMatchesCatalog === true && reference?.review?.nonCopyrightRestrictionsReviewed === true, `${id}: reference ledger evidence mismatch`);
        fail(reference?.uiDisplayAllowed === false && reference?.publicSnapshotAllowed === false && reference?.rasterExportAllowed === false, `${id}: morphology-only purposes changed`);
      }
    }
    if (entry.profile.status === "approved") fail(text(entry.profile.sourcePath) && hash(entry.profile.sha256) && text(entry.profile.author) && text(entry.profile.reviewer) && entry.profile.author !== entry.profile.reviewer && text(entry.profile.reviewNotes), `${id}: profile requires evidence and independent review`);
    if (attempts.length) fail(entry.reference.status === "approved" && entry.scene.status === "ready" && text(entry.scene.description) && text(entry.scene.rationale) && entry.scene.sources?.length > 0, `${id}: generation requires approved reference and researched scene`);
    for (const [index, attempt] of attempts.entries()) {
      // The first two calibration calls predate the checkpoint correction. Keep the missing
      // start times explicit rather than inventing them; all later calls require pre-call time.
      const boundedF01AuditException = ["f01a-0200377-a1", "f01a-0200956-a1", "f01a-0200956-a2", "f01a-0200700-a1", "f01a-0200880-a1"].includes(attempt.id)
        && attempt.startedAt === null && text(attempt.startTimeEvidence) && text(attempt.recordedAt)
        && text(attempt.startTimeBounds?.preCallBatchCheckpointPath)
        && Number.isFinite(Date.parse(attempt.startTimeBounds?.notBefore))
        && Date.parse(attempt.startTimeBounds.notBefore) <= Date.parse(attempt.startTimeBounds?.beforeOrAt);
      const recordedCalibrationException = id === "VBO:0200376" && ["rough-a0", "rough-a1"].includes(attempt.id)
        && attempt.startedAt === null && text(attempt.startTimeEvidence) && text(attempt.recordedAt);
      fail(attempt.number === index + 1 && text(attempt.id) && (text(attempt.startedAt) || recordedCalibrationException || boundedF01AuditException) && text(attempt.prompt) && text(attempt.agentModel) && text(attempt.reasoningEffort), `${id}: exact sequential attempt/prompt/operator record required`);
      fail(["running", "generated", "failed"].includes(attempt.status) && ["pending", "accepted", "rejected", "unselected"].includes(attempt.qaDecision), `${id}: invalid attempt state`);
      if (attempt.status === "generated") fail(attempt.masterPath?.startsWith("assets/dogs/generated-masters/") && hash(attempt.masterSha256) && attempt.masterSha256 === attempt.originalOutputSha256 && text(attempt.originalOutputPath) && attempt.width === 1536 && attempt.height === 1024, `${id}: preserve native 1536x1024 output and hashes`);
      if (attempt.status === "failed") fail(text(attempt.failure), `${id}: failed call evidence missing`);
      if (["rejected", "unselected"].includes(attempt.qaDecision)) fail(text(attempt.rejectionReason), `${id}: rejected master reason missing`);
    }
    if (entry.qa.status === "approved" || entry.integration.status === "integrated") {
      const accepted = attempts.find((attempt) => attempt.id === entry.generation.acceptedAttemptId);
      fail(entry.generation.status === "accepted" && accepted?.status === "generated" && accepted?.qaDecision === "accepted" && attempts.filter((attempt) => attempt.qaDecision === "accepted").length === 1, `${id}: one exact accepted master required`);
      fail(["reviewedAt", "breedIdentity", "anatomy", "crop", "aesthetics"].every((key) => text(entry.qa[key])) && entry.qa.primaryFullResolutionViewed === true && entry.qa.workerFullResolutionViewed === true, `${id}: independent full-resolution acceptance required`);
    }
    if (entry.integration.status === "integrated") {
      fail(active.includes(id) && entry.qa.status === "approved" && entry.profile.status === "approved" && text(entry.qa.contactSheetPath) && text(entry.integration.integratedAt) && /^f0[1-4]$/.test(entry.integration.subwave), `${id}: only completed reviewed pairs may integrate`);
      if (generatedArtwork) {
        const asset = generatedById.get(id), accepted = attempts.find((attempt) => attempt.id === entry.generation.acceptedAttemptId);
        fail(asset?.masterSha256 === accepted?.masterSha256 && asset?.reference?.assetId === entry.reference.assetId && asset?.uiDisplayAllowed === true && asset?.publicSnapshotAllowed === false && asset?.rasterExportAllowed === false, `${id}: integrated master/reference/purpose mismatch`);
      }
      if (profiles) fail(profiles.profiles?.[id]?.reviewStatus === "editor-reviewed" && cohortDigest(profiles.profiles[id].summary) === entry.profile.summarySha256, `${id}: integrated approved description mismatch`);
    }
    if (entry.publication.status === "published") fail(entry.integration.status === "integrated" && text(entry.publication.commit) && text(entry.publication.deploymentUrl) && text(entry.publication.verifiedAt) && text(entry.publication.evidencePath), `${id}: publication receipt required`);
  }
  fail(JSON.stringify(cohort.progress) === JSON.stringify(summarizePortraitCohortF(cohort)), "F progress summary is stale");
  return errors;
}
