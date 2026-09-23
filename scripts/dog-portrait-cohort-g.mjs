import { createHash } from 'node:crypto';

export const gDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const promptDigest = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => /^[a-f0-9]{64}$/.test(value || '');
const iso = value => text(value) && /T\d\d:\d\d:\d\d/.test(value) && Number.isFinite(Date.parse(value));
const inSet = (value, values) => values.includes(value);
const RUN_SHA = '1817c6548fdc677d29731ad42956dac23eb1dcf20f7557612eea3c02a8258af8';

// Includes the G-only slice and its run provenance. Never modifies or extends E/F digests.
export function portraitCohortGSelectionDigest(cohort) {
  return gDigest({ cohortId: cohort.cohortId, frozenAt: cohort.frozenAt,
    targetCompletedCount: cohort.targetCompletedCount, baseline: cohort.baseline,
    runFreeze: cohort.runFreeze, selectionPolicy: cohort.selectionPolicy,
    primary: cohort.primary, reserves: cohort.reserves });
}

export function activeCohortGIds(cohort) {
  const ids = cohort.primary.map(entry => entry.catalogId);
  for (const amendment of cohort.amendments) {
    const index = ids.indexOf(amendment.blockedCatalogId);
    if (index >= 0) ids[index] = amendment.activatedCatalogId;
  }
  return ids;
}

export function summarizePortraitCohortG(cohort) {
  const all = Object.values(cohort.entries);
  const active = activeCohortGIds(cohort).map(id => cohort.entries[id]).filter(Boolean);
  const attempts = all.flatMap(entry => entry.generation.attempts);
  const accepted = active.filter(entry => entry.qa.status === 'approved' && entry.profile.status === 'approved');
  const integrated = active.filter(entry => entry.integration.status === 'integrated');
  const published = active.filter(entry => entry.publication.status === 'published');
  return { targetCount: cohort.targetCompletedCount,
    workerReferenceReadyCount: active.filter(entry => inSet(entry.reference.status, ['worker-approved', 'approved'])).length,
    primaryReferenceApprovedCount: active.filter(entry => entry.reference.status === 'approved').length,
    profileApprovedCount: active.filter(entry => entry.profile.status === 'approved').length,
    attemptedIdentityCount: all.filter(entry => entry.generation.attempts.length > 0).length,
    generationCallCount: attempts.length,
    generatedOutputCount: attempts.filter(attempt => attempt.status === 'generated').length,
    failedCallCount: attempts.filter(attempt => attempt.status === 'failed').length,
    rejectedMasterCount: attempts.filter(attempt => attempt.qaDecision === 'rejected').length,
    retryCount: all.reduce((sum, entry) => sum + Math.max(0, entry.generation.attempts.length - 1), 0),
    acceptedPairCount: accepted.length, integratedPairCount: integrated.length,
    publishedPairCount: published.length,
    blockedCount: all.filter(entry => entry.hold?.status === 'blocked').length,
    reserveActivationCount: cohort.amendments.length,
    remainingCount: cohort.targetCompletedCount - published.length,
    nextCatalogId: active.find(entry => entry.publication.status !== 'published' && entry.hold?.status !== 'blocked')?.catalogId || null };
}

export function validatePortraitCohortG(cohort, { runSelection, catalog, rightsLedger, generatedArtwork, profiles } = {}) {
  const errors = [];
  const fail = (ok, message) => { if (!ok) errors.push(message); };
  fail(cohort.schemaVersion === 1 && cohort.cohortId === 'dogs-portraits-g', 'Unknown G cohort schema or identity');
  fail(cohort.targetCompletedCount === 25 && cohort.primary?.length === 25 && cohort.reserves?.length === 15, 'G requires 25 frozen primaries and 15 ordered reserves');
  if (!Array.isArray(cohort.primary) || !Array.isArray(cohort.reserves) || !Array.isArray(cohort.amendments) || !cohort.entries) return [...errors, 'Missing G selection pools, amendments or entries'];
  fail(cohort.selectionSha256 === portraitCohortGSelectionDigest(cohort), 'Frozen G selection digest mismatch');
  fail(cohort.runFreeze?.runId === 'dogs-next-100-2026-09-23' && cohort.runFreeze?.selectionSha256 === RUN_SHA && cohort.runFreeze?.selectionPath === 'data/dogs/portrait-continuation-100.json' && JSON.stringify(cohort.runFreeze?.gPrimaryRunOrdinals) === '[76,100]', 'G must retain exact parent run freeze provenance');
  fail(cohort.baseline?.runStartIllustratedCount === 307 && cohort.baseline?.runStartDevelopedCount === 307 && cohort.baseline?.expectedGStartIllustratedCount === 382 && cohort.baseline?.expectedGStartDevelopedCount === 382 && cohort.baseline?.targetTotalCompletedPairs === 407 && cohort.baseline?.selectableCount === 1239, 'G baseline/target changed');
  fail(cohort.selectionPolicy?.referencePurposes?.uiDisplayAllowed === false && cohort.selectionPolicy?.referencePurposes?.publicSnapshotAllowed === false && cohort.selectionPolicy?.referencePurposes?.rasterExportAllowed === false && cohort.selectionPolicy?.generatedPurposes?.uiDisplayAllowed === true && cohort.selectionPolicy?.generatedPurposes?.publicSnapshotAllowed === false && cohort.selectionPolicy?.generatedPurposes?.rasterExportAllowed === false, 'Artwork purpose gates changed');
  fail(cohort.assignments?.filter(a => ['f_worker_a', 'f_worker_b', 'f_worker_c'].includes(a.worker)).length === 3 && cohort.assignments.filter(a => ['f_worker_a', 'f_worker_b', 'f_worker_c'].includes(a.worker)).every(a => a.model === 'gpt-6-sol' && a.reasoningEffort === 'high') && cohort.assignments.some(a => a.worker === 'primary orchestrator' && a.model === 'not disclosed in runtime'), 'Actual G model assignments changed or invented');
  fail(cohort.imageGeneration?.tool === 'OpenAI built-in imagegen' && cohort.imageGeneration?.underlyingImageModel === 'undisclosed' && cohort.imageGeneration?.promptTemplateVersion === 'dogs-field-guide-v4-cohort-g' && JSON.stringify(cohort.imageGeneration?.nativeDimensions) === '[1536,1024]', 'G generation provenance changed');
  const pools = [...cohort.primary, ...cohort.reserves];
  fail(new Set(pools.map(entry => entry.catalogId)).size === 40, 'Duplicate G selection identity');
  const byId = new Map((catalog?.entities || []).map(entry => [entry.id, entry]));
  cohort.primary.forEach((entry, index) => {
    const id = entry.catalogId;
    fail(entry.ordinal === index + 1 && entry.runOrdinal === 76 + index && entry.subwave === 'g01' && text(entry.basis), `${id}: frozen G order or basis changed`);
    if (catalog) fail(byId.get(id)?.selectable === true && byId.get(id)?.displayName === entry.displayName, `${id}: exact selectable catalog identity mismatch`);
  });
  cohort.reserves.forEach((entry, index) => {
    fail(entry.ordinal === index + 1, `${entry.catalogId}: reserve order changed`);
    if (catalog) fail(byId.get(entry.catalogId)?.selectable === true && byId.get(entry.catalogId)?.displayName === entry.displayName, `${entry.catalogId}: exact reserve identity mismatch`);
  });
  if (runSelection) {
    fail(runSelection.selectionSha256 === RUN_SHA && runSelection.runId === cohort.runFreeze.runId, 'Parent run selection freeze mismatch');
    const g = runSelection.primary?.filter(entry => entry.cohort === 'g') || [];
    fail(g.length === 25 && g.every((entry, index) => entry.ordinal === cohort.primary[index].runOrdinal && entry.catalogId === cohort.primary[index].catalogId && entry.displayName === cohort.primary[index].displayName), 'G primaries diverge from frozen parent run');
    fail(runSelection.additionalOrderedReserves?.length === 15 && runSelection.additionalOrderedReserves.every((entry, index) => entry.catalogId === cohort.reserves[index].catalogId && entry.displayName === cohort.reserves[index].displayName), 'G reserves diverge from frozen parent run');
  }
  const active = cohort.primary.map(entry => entry.catalogId), activated = new Set();
  let previousSha256 = cohort.selectionSha256;
  for (const [index, amendment] of cohort.amendments.entries()) {
    const { sha256, ...content } = amendment;
    const slot = active.indexOf(amendment.blockedCatalogId);
    fail(amendment.sequence === index + 1 && amendment.previousSha256 === previousSha256 && sha256 === gDigest(content), 'Append-only G amendment chain mismatch');
    fail(slot >= 0 && cohort.entries[amendment.blockedCatalogId]?.hold?.status === 'blocked', 'G reserve activation requires active blocked identity');
    const next = cohort.reserves.find(entry => !activated.has(entry.catalogId) && cohort.reserveAssessments?.[entry.catalogId]?.status !== 'blocked');
    fail(next?.catalogId === amendment.activatedCatalogId, 'G must activate next eligible ordered reserve');
    fail(iso(amendment.recordedAt) && text(amendment.reason) && amendment.evidencePaths?.length > 0, 'G activation needs dated evidence');
    if (slot >= 0) active[slot] = amendment.activatedCatalogId;
    activated.add(amendment.activatedCatalogId);
    previousSha256 = sha256;
  }
  for (const [id, assessment] of Object.entries(cohort.reserveAssessments || {})) fail(cohort.reserves.some(entry => entry.catalogId === id) && assessment.status === 'blocked' && text(assessment.reason) && assessment.evidencePaths?.length > 0, `${id}: skipped reserve needs evidence`);
  const selected = new Set([...cohort.primary.map(entry => entry.catalogId), ...activated]);
  fail(Object.keys(cohort.entries).length === selected.size, 'G progress must retain every primary and activated reserve');
  const rightsById = new Map((rightsLedger?.assets || []).map(asset => [asset.assetId, asset]));
  const generatedById = new Map((generatedArtwork?.assets || []).map(asset => [asset.catalogId, asset]));
  const allAttemptIds = new Set();
  for (const id of selected) {
    const entry = cohort.entries[id];
    if (!entry) { errors.push(`${id}: missing G progress entry`); continue; }
    fail(entry.catalogId === id, `${id}: progress identity mismatch`);
    if (entry.hold?.status === 'blocked') fail(text(entry.hold.reason) && entry.hold.evidencePaths?.length > 0, `${id}: hold evidence required`);
    fail(inSet(entry.reference?.status, ['pending', 'worker-approved', 'approved', 'blocked']) && inSet(entry.scene?.status, ['pending', 'worker-ready', 'ready', 'blocked']) && inSet(entry.profile?.status, ['pending', 'draft', 'approved', 'blocked']) && inSet(entry.generation?.status, ['pending', 'staged', 'accepted', 'blocked']) && inSet(entry.qa?.status, ['pending', 'approved', 'rejected']) && inSet(entry.integration?.status, ['pending', 'integrated']) && inSet(entry.publication?.status, ['pending', 'published']), `${id}: invalid G stage status`);
    if (inSet(entry.reference.status, ['worker-approved', 'approved'])) {
      fail(text(entry.reference.assetId) && text(entry.reference.sourcePage) && hash(entry.reference.sourceSha256) && text(entry.reference.visualReview) && text(entry.reference.rightsReview), `${id}: source identity and rights evidence required`);
      fail(Number.isSafeInteger(entry.reference.sourcePageRevision?.id) && entry.reference.sourcePageRevision.id > 0 && iso(entry.reference.sourcePageRevision.timestamp), `${id}: pinned source File-page revision required`);
      fail(entry.reference.purposes?.uiDisplayAllowed === false && entry.reference.purposes?.publicSnapshotAllowed === false && entry.reference.purposes?.rasterExportAllowed === false, `${id}: reference purposes changed`);
      if (entry.reference.status === 'approved') {
        fail(iso(entry.reference.primaryReviewedAt), `${id}: independent primary reference review required`);
        if (rightsLedger) {
          const right = rightsById.get(entry.reference.assetId);
          fail(right?.catalogId === id && right?.sourcePage === entry.reference.sourcePage && right?.sourceSha256 === entry.reference.sourceSha256 && right?.sourcePageRevision?.id === entry.reference.sourcePageRevision?.id && right?.sourcePageRevision?.timestamp === entry.reference.sourcePageRevision?.timestamp && right?.review?.status === 'approved' && right?.review?.subjectMatchesCatalog === true && right?.review?.nonCopyrightRestrictionsReviewed === true, `${id}: approved rights ledger mismatch`);
          fail(right?.uiDisplayAllowed === false && right?.publicSnapshotAllowed === false && right?.rasterExportAllowed === false, `${id}: morphology-only rights changed`);
        }
      }
    }
    if (inSet(entry.profile.status, ['draft', 'approved'])) fail(text(entry.profile.shortDescription) && entry.profile.shortDescription.length >= 80 && entry.profile.shortDescription.length <= 150, `${id}: authored short description must be 80–150 characters`);
    if (entry.profile.status === 'approved') fail(text(entry.profile.sourcePath) && hash(entry.profile.summarySha256) && text(entry.profile.author) && text(entry.profile.reviewer) && entry.profile.author !== entry.profile.reviewer && text(entry.profile.reviewNotes), `${id}: independent sourced profile review required`);
    const attempts = entry.generation?.attempts;
    if (!Array.isArray(attempts)) { errors.push(`${id}: append-only attempts missing`); continue; }
    const qualifiedForGeneration = inSet(entry.reference.status, ['worker-approved', 'approved']) && inSet(entry.scene.status, ['worker-ready', 'ready']);
    // A later source/identity hold must not erase real generated attempts. It may
    // archive them only when none remains accepted or selected for integration.
    const archivedBlockedAttempts = entry.hold?.status === 'blocked' && text(entry.hold.reason) && entry.hold.evidencePaths?.length > 0 && entry.generation.status === 'blocked' && entry.generation.acceptedAttemptId == null && entry.qa.status !== 'approved' && attempts.every(attempt => attempt.qaDecision !== 'accepted' && (attempt.status !== 'generated' || inSet(attempt.qaDecision, ['rejected', 'unselected'])));
    if (attempts.length) {
      fail(qualifiedForGeneration || archivedBlockedAttempts, `${id}: generated output lacks a qualified reference/scene gate or evidenced blocked archive`);
      if (entry.hold?.status === 'blocked') fail(archivedBlockedAttempts, `${id}: blocked generated identity cannot retain an accepted or unreviewed master`);
    }
    for (const [index, attempt] of attempts.entries()) {
      fail(attempt.number === index + 1 && text(attempt.id) && !allAttemptIds.has(attempt.id), `${id}: unique sequential attempt missing`); allAttemptIds.add(attempt.id);
      fail(inSet(attempt.status, ['running', 'generated', 'failed']) && inSet(attempt.qaDecision, ['pending', 'accepted', 'rejected', 'unselected']), `${id}: invalid attempt state`);
      fail(iso(attempt.startedAt) && text(attempt.prompt) && promptDigest(attempt.prompt) === attempt.promptSha256 && hash(attempt.referenceInputSha256) && text(attempt.referenceInputPath) && attempt.agentModel === 'gpt-6-sol' && attempt.reasoningEffort === 'high' && attempt.imageGenerator === 'built-in imagegen' && attempt.imageModel === 'undisclosed', `${id}: exact pre-call prompt/reference/operator receipt required`);
      if (attempt.status === 'generated') fail(iso(attempt.completedAt) && Date.parse(attempt.completedAt) >= Date.parse(attempt.startedAt) && attempt.masterPath?.startsWith('assets/dogs/generated-masters/cohort-g/') && hash(attempt.masterSha256) && attempt.masterSha256 === attempt.originalOutputSha256 && text(attempt.originalOutputPath) && attempt.width === 1536 && attempt.height === 1024, `${id}: native generated master/hash receipt invalid`);
      if (attempt.status === 'failed') fail(text(attempt.failure), `${id}: failed call evidence missing`);
      if (inSet(attempt.qaDecision, ['rejected', 'unselected'])) fail(text(attempt.rejectionReason), `${id}: rejected/unselected output needs reason`);
    }
    if (entry.qa.status === 'approved' || entry.integration.status === 'integrated') {
      const accepted = attempts.find(attempt => attempt.id === entry.generation.acceptedAttemptId);
      fail(entry.reference.status === 'approved' && entry.scene.status === 'ready' && entry.profile.status === 'approved' && entry.generation.status === 'accepted' && accepted?.status === 'generated' && accepted?.qaDecision === 'accepted' && attempts.filter(attempt => attempt.qaDecision === 'accepted').length === 1, `${id}: one independently reviewed complete pair required`);
      fail(entry.qa.primaryFullResolutionViewed === true && entry.qa.workerFullResolutionViewed === true && ['reviewedAt', 'breedIdentity', 'anatomy', 'crop', 'aesthetics'].every(key => text(entry.qa[key])), `${id}: full-resolution QA dimensions and reviewers required`);
    }
    if (entry.integration.status === 'integrated') {
      fail(active.includes(id) && entry.qa.status === 'approved' && entry.integration.subwave === 'g01' && entry.integration.batchManifest === 'data/dogs/generated-artwork-batch-g01.json' && iso(entry.integration.integratedAt) && text(entry.qa.contactSheetPath), `${id}: only accepted G01 pairs may integrate`);
      if (generatedArtwork) {
        const asset = generatedById.get(id), accepted = attempts.find(attempt => attempt.id === entry.generation.acceptedAttemptId);
        fail(asset?.masterSha256 === accepted?.masterSha256 && asset?.reference?.assetId === entry.reference.assetId && asset?.uiDisplayAllowed === true && asset?.publicSnapshotAllowed === false && asset?.rasterExportAllowed === false, `${id}: integrated artwork/rights purpose mismatch`);
      }
      if (profiles) fail(profiles.profiles?.[id]?.reviewStatus === 'editor-reviewed' && gDigest(profiles.profiles[id].summary) === entry.profile.summarySha256, `${id}: integrated reviewed summary mismatch`);
    }
    if (entry.publication.status === 'published') fail(entry.integration.status === 'integrated' && text(entry.publication.commit) && text(entry.publication.deploymentUrl) && iso(entry.publication.verifiedAt) && text(entry.publication.evidencePath), `${id}: publication receipt required`);
  }
  fail(JSON.stringify(cohort.progress) === JSON.stringify(summarizePortraitCohortG(cohort)), 'G progress summary is stale');
  return errors;
}
