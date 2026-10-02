import { createHash } from 'node:crypto';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const kDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const promptDigest = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => /^[a-f0-9]{64}$/.test(value || '');
const iso = value => text(value) && /T\d\d:\d\d:\d\d/.test(value) && Number.isFinite(Date.parse(value));
const inSet = (value, values) => values.includes(value);
const BASELINE_COMMIT = '012c1e4f94fa64c1407f36d5b3a32adb200b628a';

// K owns a separate 250-pair freeze with five independent 50-slot workers. All earlier cohorts, including J, keep their own checks and stop receipts.
export function portraitCohortKSelectionDigest(cohort) {
  return kDigest({ cohortId: cohort.cohortId, frozenAt: cohort.frozenAt,
    targetCompletedCount: cohort.targetCompletedCount, baseline: cohort.baseline,
    sourceSnapshots: cohort.sourceSnapshots, selectionPolicy: cohort.selectionPolicy,
    primary: cohort.primary, reserves: cohort.reserves, frozenAssignments: cohort.frozenAssignments });
}

export function activeCohortKIds(cohort) {
  const ids = cohort.primary.map(entry => entry.catalogId);
  for (const amendment of cohort.amendments) {
    const index = ids.indexOf(amendment.blockedCatalogId);
    if (index >= 0) ids[index] = amendment.activatedCatalogId;
  }
  return ids;
}

export function activeCohortKSlots(cohort) {
  const ids = activeCohortKIds(cohort);
  return cohort.primary.map((entry, index) => ({ catalogId: ids[index], worker: entry.preparationWorker, ordinal: index + 1 }));
}

// A direct user stop may finish an already started, smaller release. It does
// not rewrite the selection, admit unfinished pairs, or authorize later batches.
export function portraitCohortKStopAllowsBatch(cohort, batch) {
  const stop = cohort.stopAfterCurrentBatch;
  if (!stop) return false;
  const { sha256, ...content } = stop;
  const ids = stop.catalogIds;
  return sha256 === kDigest(content) && stop.action === 'finish-current-batch-and-stop' &&
    stop.authority === 'direct-user-instruction' && iso(stop.requestedAt) && text(stop.instruction) &&
    stop.selectionSha256 === cohort.selectionSha256 && /^k(?:0[1-9]|10)$/.test(stop.subwave) &&
    Array.isArray(ids) && ids.length > 0 && ids.length <= 30 && new Set(ids).size === ids.length &&
    Number.isSafeInteger(stop.completedPairLimit) && stop.completedPairLimit <= cohort.targetCompletedCount &&
    batch.subwave === stop.subwave && batch.count === ids.length &&
    JSON.stringify(batch.catalogIds) === JSON.stringify(ids);
}

export function summarizePortraitCohortK(cohort) {
  const all = Object.values(cohort.entries);
  const active = activeCohortKIds(cohort).map(id => cohort.entries[id]).filter(Boolean);
  const attempts = all.flatMap(entry => entry.generation.attempts);
  const accepted = active.filter(entry => entry.qa.status === 'approved' && entry.profile.status === 'approved');
  const integrated = active.filter(entry => entry.integration.status === 'integrated');
  const published = active.filter(entry => entry.publication.status === 'published');
  const stop = cohort.stopAfterCurrentBatch;
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
    workers: (cohort.frozenAssignments || []).map(assignment => {
      const rows = activeCohortKSlots(cohort).filter(slot => slot.worker === assignment.worker).map(slot => cohort.entries[slot.catalogId]).filter(Boolean);
      return { worker: assignment.worker, targetCount: 50,
        acceptedPairCount: rows.filter(entry => entry.qa.status === 'approved' && entry.profile.status === 'approved').length,
        integratedPairCount: rows.filter(entry => entry.integration.status === 'integrated').length,
        publishedPairCount: rows.filter(entry => entry.publication.status === 'published').length };
    }),
    reserveActivationCount: cohort.amendments.length,
    remainingCount: cohort.targetCompletedCount - published.length,
    nextCatalogId: (stop ? stop.catalogIds.map(id => cohort.entries[id]) : active).find(entry => entry?.publication.status !== 'published' && entry?.hold?.status !== 'blocked')?.catalogId || null,
    ...(stop ? { authorizedCompletedPairLimit: stop.completedPairLimit,
      remainingAuthorizedCount: stop.completedPairLimit - published.length,
      runStatus: published.length === stop.completedPairLimit ? 'stopped-after-user-requested-batch' : 'finishing-user-requested-batch' } : {}) };
}

export function validatePortraitCohortK(cohort, { catalog, rightsLedger, generatedArtwork, profiles } = {}) {
  const errors = [];
  const fail = (ok, message) => { if (!ok) errors.push(message); };
  fail(cohort.schemaVersion === 1 && cohort.cohortId === 'dogs-portraits-k', 'Unknown K cohort schema or identity');
  fail(cohort.targetCompletedCount === 250 && cohort.primary?.length === 250 && cohort.reserves?.length >= 25, 'K requires 250 frozen primaries and at least 25 ordered reserves');
  if (!Array.isArray(cohort.primary) || !Array.isArray(cohort.reserves) || !Array.isArray(cohort.amendments) || !cohort.entries) return [...errors, 'Missing K selection pools, amendments or entries'];
  fail(iso(cohort.frozenAt), 'K freeze needs an explicit timestamp');
  fail(cohort.selectionSha256 === portraitCohortKSelectionDigest(cohort), 'Frozen K selection digest mismatch');
  fail(cohort.baseline?.illustratedCount === 560 && cohort.baseline?.developedCount === 560 && cohort.baseline?.targetTotalCompletedPairs === 810 && cohort.baseline?.selectableCount === 1239 && cohort.baseline?.commit === BASELINE_COMMIT, 'K baseline/target changed');
  fail(cohort.baseline?.generatedCatalogIds?.length === 560 && new Set(cohort.baseline.generatedCatalogIds).size === 560 && cohort.baseline?.heldCatalogIds?.length === 44 && new Set(cohort.baseline.heldCatalogIds).size === 44, 'K must preserve exact published coverage and prior holds');
  for (const key of ['dog-catalog', 'generated-artwork', 'breed-profiles', 'image-rights', 'packs', 'artwork-license-policy', 'generated-artwork-policy']) {
    fail(text(cohort.sourceSnapshots?.[key]?.path) && text(cohort.sourceSnapshots?.[key]?.snapshotPath) && hash(cohort.sourceSnapshots?.[key]?.sha256), `${key}: K baseline source hash missing`);
  }
  fail(cohort.selectionPolicy?.referencePurposes?.uiDisplayAllowed === false && cohort.selectionPolicy?.referencePurposes?.publicSnapshotAllowed === false && cohort.selectionPolicy?.referencePurposes?.rasterExportAllowed === false && cohort.selectionPolicy?.generatedPurposes?.uiDisplayAllowed === true && cohort.selectionPolicy?.generatedPurposes?.publicSnapshotAllowed === false && cohort.selectionPolicy?.generatedPurposes?.rasterExportAllowed === false, 'Artwork purpose gates changed');
  fail(cohort.assignments?.filter(a => ['k_worker_a', 'k_worker_b', 'k_worker_c', 'k_worker_d', 'k_worker_e'].includes(a.worker)).length === 5 && cohort.assignments.filter(a => ['k_worker_a', 'k_worker_b', 'k_worker_c', 'k_worker_d', 'k_worker_e'].includes(a.worker)).every(a => a.model === 'gpt-6.1-sol' && a.reasoningEffort === 'xhigh') && cohort.assignments.some(a => a.worker === 'primary orchestrator' && a.model === 'not disclosed in runtime'), 'Actual K model assignments changed or invented');
  fail(cohort.imageGeneration?.tool === 'OpenAI built-in imagegen' && cohort.imageGeneration?.underlyingImageModel === 'undisclosed' && cohort.imageGeneration?.promptTemplateVersion === 'dogs-field-guide-v8-cohort-k' && JSON.stringify(cohort.imageGeneration?.nativeDimensions) === '[1536,1024]', 'K generation provenance changed');
  const workerNames = ['k_worker_a', 'k_worker_b', 'k_worker_c', 'k_worker_d', 'k_worker_e'];
  const frozen = cohort.frozenAssignments || [];
  fail(frozen.length === 5 && new Set(frozen.map(a => a.worker)).size === 5 && workerNames.every(worker => frozen.some(a => a.worker === worker)), 'K needs five distinct frozen worker allocations');
  for (const worker of workerNames) {
    const allocation = frozen.find(a => a.worker === worker);
    const expectedIds = cohort.primary.filter(p => p.preparationWorker === worker).map(p => p.catalogId);
    fail(expectedIds.length === 50 && allocation?.catalogIds?.length === 50 && JSON.stringify(allocation.catalogIds) === JSON.stringify(expectedIds), `${worker}: exact disjoint 50-slot ownership changed`);
    const operation = cohort.assignments?.find(a => a.worker === worker);
    fail(text(operation?.threadId) && text(operation?.workspace) && operation?.permissions?.sandboxMode === 'danger-full-access' && operation?.permissions?.approvalPolicy === 'never' && operation?.permissions?.networkAccess === 'enabled' && hash(operation?.setupReceiptSha256), `${worker}: actual task/worktree/Full access receipt missing`);
  }
  const operations = (cohort.assignments || []).filter(a => workerNames.includes(a.worker));
  fail(new Set(operations.map(a => a.threadId)).size === 5 && new Set(operations.map(a => a.workspace)).size === 5, 'K worker thread/worktree ownership must be independent');
  const pools = [...cohort.primary, ...cohort.reserves];
  fail(new Set(pools.map(entry => entry.catalogId)).size === pools.length, 'Duplicate K selection identity');
  const byId = new Map((catalog?.entities || []).map(entry => [entry.id, entry]));
  cohort.primary.forEach((entry, index) => {
    const id = entry.catalogId;
    fail(entry.ordinal === index + 1 && entry.subwave === `k${String(Math.floor(index / 25) + 1).padStart(2, '0')}` && text(entry.basis) && text(entry.identityReview), `${id}: frozen K order or basis changed`);
    fail(workerNames.includes(entry.preparationWorker), `${id}: frozen K worker missing`);
    if (catalog) fail(byId.get(id)?.selectable === true && byId.get(id)?.displayName === entry.displayName, `${id}: exact selectable catalog identity mismatch`);
  });
  cohort.reserves.forEach((entry, index) => {
    fail(entry.ordinal === index + 1, `${entry.catalogId}: reserve order changed`);
    if (catalog) fail(byId.get(entry.catalogId)?.selectable === true && byId.get(entry.catalogId)?.displayName === entry.displayName, `${entry.catalogId}: exact reserve identity mismatch`);
  });
  for (const entry of pools) {
    fail(!cohort.baseline.generatedCatalogIds?.includes(entry.catalogId), `${entry.catalogId}: identity already published at K freeze`);
    fail(!cohort.baseline.heldCatalogIds?.includes(entry.catalogId), `${entry.catalogId}: prior held identity requires a separately evidenced reopening`);
  }
  const active = cohort.primary.map(entry => entry.catalogId), activated = new Set();
  let previousSha256 = cohort.selectionSha256;
  for (const [index, amendment] of cohort.amendments.entries()) {
    const { sha256, ...content } = amendment;
    const slot = active.indexOf(amendment.blockedCatalogId);
    fail(amendment.sequence === index + 1 && amendment.previousSha256 === previousSha256 && sha256 === kDigest(content), 'Append-only K amendment chain mismatch');
    fail(slot >= 0 && cohort.entries[amendment.blockedCatalogId]?.hold?.status === 'blocked', 'K reserve activation requires active blocked identity');
    fail(slot >= 0 && amendment.worker === cohort.primary[slot]?.preparationWorker, 'K reserve activation must inherit the blocked acceptance slot owner');
    const next = cohort.reserves.find(entry => !activated.has(entry.catalogId) && cohort.reserveAssessments?.[entry.catalogId]?.status !== 'blocked');
    fail(next?.catalogId === amendment.activatedCatalogId, 'K must activate next eligible ordered reserve');
    fail(iso(amendment.recordedAt) && text(amendment.reason) && amendment.evidencePaths?.length > 0, 'K activation needs dated evidence');
    if (slot >= 0) active[slot] = amendment.activatedCatalogId;
    activated.add(amendment.activatedCatalogId);
    previousSha256 = sha256;
  }
  for (const [id, assessment] of Object.entries(cohort.reserveAssessments || {})) fail(cohort.reserves.some(entry => entry.catalogId === id) && assessment.status === 'blocked' && text(assessment.reason) && assessment.evidencePaths?.length > 0, `${id}: skipped reserve needs evidence`);
  const selected = new Set([...cohort.primary.map(entry => entry.catalogId), ...activated]);
  fail(Object.keys(cohort.entries).length === selected.size, 'K progress must retain every primary and activated reserve');
  // Frozen subwaves describe preparation ownership. Publication milestones may
  // combine approved pairs from those groups, with exact membership recorded.
  const releaseById = new Map();
  const batches = cohort.integrationBatches || [];
  const releasedCount = batches.reduce((sum, batch) => sum + (batch.catalogIds?.length || 0), 0);
  if (cohort.stopAfterCurrentBatch) {
    const stop = cohort.stopAfterCurrentBatch;
    fail(portraitCohortKStopAllowsBatch(cohort, { subwave: stop.subwave, count: stop.catalogIds?.length, catalogIds: stop.catalogIds }), 'K user stop requires a hashed direct instruction and exact final batch membership');
    fail(stop.catalogIds?.every((id, i, ids) => active.includes(id) && (i === 0 || active.indexOf(ids[i - 1]) < active.indexOf(id))), 'K user stop must retain active frozen order');
    fail(releasedCount <= stop.completedPairLimit && batches.every(batch => batch.subwave <= stop.subwave), 'K cannot release beyond the user-requested stop');
    if (batches.some(batch => batch.subwave === stop.subwave)) fail(releasedCount === stop.completedPairLimit, 'K stopped release count must match its recorded limit');
  }
  for (const [index, batch] of batches.entries()) {
    const wave = `k${String(index + 1).padStart(2, '0')}`;
    const ids = batch.catalogIds || [];
    fail(batch.subwave === wave && batch.batchManifest === `data/dogs/generated-artwork-batch-${wave}.json` && iso(batch.integratedAt), `${wave}: sequential release receipt required`);
    fail(batch.count === ids.length && ids.length <= 30 && (ids.length >= 20 || releasedCount === cohort.targetCompletedCount || portraitCohortKStopAllowsBatch(cohort, batch)) && new Set(ids).size === ids.length, `${wave}: distinct approximately 25-pair release membership required`);
    fail(ids.every((id, i) => active.includes(id) && (i === 0 || active.indexOf(ids[i - 1]) < active.indexOf(id))), `${wave}: release membership must follow the active frozen order`);
    for (const id of ids) {
      fail(!releaseById.has(id), `${id}: duplicate release membership`);
      releaseById.set(id, batch);
    }
  }
  const rightsById = new Map((rightsLedger?.assets || []).map(asset => [asset.assetId, asset]));
  const generatedById = new Map((generatedArtwork?.assets || []).map(asset => [asset.catalogId, asset]));
  const allAttemptIds = new Set();
  for (const id of selected) {
    const entry = cohort.entries[id];
    if (!entry) { errors.push(`${id}: missing K progress entry`); continue; }
    fail(entry.catalogId === id, `${id}: progress identity mismatch`);
    const activeSlot = activeCohortKSlots(cohort).find(slot => slot.catalogId === id);
    if (activeSlot) fail(entry.preparation?.worker === activeSlot.worker, `${id}: active identity must retain its frozen slot owner`);
    if (entry.hold?.status === 'blocked') fail(text(entry.hold.reason) && entry.hold.evidencePaths?.length > 0, `${id}: hold evidence required`);
    fail(inSet(entry.reference?.status, ['pending', 'worker-approved', 'approved', 'blocked']) && inSet(entry.scene?.status, ['pending', 'worker-ready', 'ready', 'blocked']) && inSet(entry.profile?.status, ['pending', 'draft', 'approved', 'blocked']) && inSet(entry.generation?.status, ['pending', 'staged', 'accepted', 'blocked']) && inSet(entry.qa?.status, ['pending', 'approved', 'rejected']) && inSet(entry.integration?.status, ['pending', 'integrated']) && inSet(entry.publication?.status, ['pending', 'published']), `${id}: invalid K stage status`);
    if (inSet(entry.reference.status, ['worker-approved', 'approved'])) {
      fail(text(entry.reference.originalPath) && text(entry.reference.filePageWikitextPath) && hash(entry.reference.filePageWikitextSha256) && text(entry.reference.metadataPath) && hash(entry.reference.metadataSha256), `${id}: preserved original, pinned File text and acquisition metadata required`);
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
    if (inSet(entry.scene.status, ['worker-ready', 'ready'])) fail(text(entry.scene.description) && text(entry.scene.rationale) && entry.scene.sources?.length > 0, `${id}: researched scene evidence missing`);
    if (inSet(entry.profile.status, ['draft', 'approved'])) fail(entry.profile.sourceSnapshots?.length > 0 && entry.profile.sourceSnapshots.every(source => text(source.url) && text(source.snapshotPath) && hash(source.snapshotSha256) && text(source.evidence)), `${id}: preserved claim-specific primary source snapshots required`);
    if (inSet(entry.profile.status, ['draft', 'approved'])) fail(text(entry.profile.shortDescription) && entry.profile.shortDescription.length >= 80 && entry.profile.shortDescription.length <= 180, `${id}: authored short description must be 80–180 characters`);
    if (entry.profile.status === 'approved') fail(text(entry.profile.sourcePath) && hash(entry.profile.summarySha256) && entry.profile.shortDescriptionSha256 === kDigest(entry.profile.shortDescription) && text(entry.profile.author) && text(entry.profile.reviewer) && entry.profile.author !== entry.profile.reviewer && text(entry.profile.reviewNotes), `${id}: independent sourced profile review required`);
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
      fail(iso(attempt.startedAt) && text(attempt.prompt) && promptDigest(attempt.prompt) === attempt.promptSha256 && hash(attempt.referenceInputSha256) && text(attempt.referenceInputPath) && attempt.agentModel === 'gpt-6.1-sol' && attempt.reasoningEffort === 'xhigh' && attempt.imageGenerator === 'built-in imagegen' && attempt.imageModel === 'undisclosed', `${id}: exact pre-call prompt/reference/operator receipt required`);
      fail(attempt.rootApprovalPath?.startsWith('reports/dogs-generated-artwork/cohort-k/root-approvals/') && hash(attempt.rootApprovalSha256) && attempt.preflightReceiptPath?.startsWith('reports/dogs-generated-artwork/cohort-k/') && hash(attempt.preflightReceiptSha256) && text(attempt.imagePermitId), `${id}: dedicated immutable root approval and successful global image preflight required`);
      if (attempt.status === 'generated') {
        // Retain an erroneous tool output at its actual dimensions. This archival
        // exception can never qualify an accepted or unreviewed portrait.
        const rejectedFormat = attempt.qaDecision === 'rejected' &&
          attempt.validationFailure === 'nonconforming-native-dimensions' &&
          Number.isInteger(attempt.width) && attempt.width > 0 &&
          Number.isInteger(attempt.height) && attempt.height > 0;
        const nativeFormat = attempt.width === 1536 && attempt.height === 1024;
        fail(iso(attempt.completedAt) && Date.parse(attempt.completedAt) >= Date.parse(attempt.startedAt) && attempt.masterPath?.startsWith('assets/dogs/generated-masters/cohort-k/') && hash(attempt.masterSha256) && attempt.masterSha256 === attempt.originalOutputSha256 && text(attempt.originalOutputPath) && (nativeFormat || rejectedFormat), `${id}: native generated master/hash receipt invalid`);
      }
      if (attempt.status === 'failed') fail(text(attempt.failure), `${id}: failed call evidence missing`);
      if (inSet(attempt.qaDecision, ['rejected', 'unselected'])) fail(text(attempt.rejectionReason), `${id}: rejected/unselected output needs reason`);
    }
    if (entry.qa.status === 'approved' || entry.integration.status === 'integrated') {
      const accepted = attempts.find(attempt => attempt.id === entry.generation.acceptedAttemptId);
      fail(entry.reference.status === 'approved' && entry.scene.status === 'ready' && entry.profile.status === 'approved' && entry.generation.status === 'accepted' && accepted?.status === 'generated' && accepted?.qaDecision === 'accepted' && attempts.filter(attempt => attempt.qaDecision === 'accepted').length === 1, `${id}: one independently reviewed complete pair required`);
      fail(entry.qa.primaryFullResolutionViewed === true && entry.qa.workerFullResolutionViewed === true && ['reviewedAt', 'breedIdentity', 'anatomy', 'crop', 'aesthetics'].every(key => text(entry.qa[key])), `${id}: full-resolution QA dimensions and reviewers required`);
    }
    if (entry.integration.status === 'integrated') {
      const batch = releaseById.get(id);
      const preparationWave = `k${String(Math.floor(active.indexOf(id) / 25) + 1).padStart(2, '0')}`;
      fail(active.includes(id) && entry.qa.status === 'approved' && batch && entry.integration.subwave === batch.subwave && entry.integration.batchManifest === batch.batchManifest && entry.preparation?.subwave === preparationWave && iso(entry.integration.integratedAt) && text(entry.qa.contactSheetPath), `${id}: accepted K pair requires explicit release and frozen preparation membership`);
      if (generatedArtwork) {
        const asset = generatedById.get(id), accepted = attempts.find(attempt => attempt.id === entry.generation.acceptedAttemptId);
        fail(asset?.masterSha256 === accepted?.masterSha256 && asset?.reference?.assetId === entry.reference.assetId && asset?.uiDisplayAllowed === true && asset?.publicSnapshotAllowed === false && asset?.rasterExportAllowed === false, `${id}: integrated artwork/rights purpose mismatch`);
      }
      if (profiles) fail(profiles.profiles?.[id]?.reviewStatus === 'editor-reviewed' && kDigest(profiles.profiles[id].summary) === entry.profile.summarySha256 && profiles.profiles[id].shortDescription === entry.profile.shortDescription && kDigest(profiles.profiles[id].shortDescription) === entry.profile.shortDescriptionSha256, `${id}: integrated reviewed full/short description mismatch`);
    }
    if (releaseById.has(id)) fail(entry.integration.status === 'integrated', `${id}: release lists an unintegrated pair`);
    if (entry.publication.status === 'published') fail(entry.integration.status === 'integrated' && text(entry.publication.commit) && text(entry.publication.deploymentUrl) && iso(entry.publication.verifiedAt) && text(entry.publication.evidencePath), `${id}: publication receipt required`);
  }
  fail(JSON.stringify(cohort.progress) === JSON.stringify(summarizePortraitCohortK(cohort)), 'K progress summary is stale');
  return errors;
}
