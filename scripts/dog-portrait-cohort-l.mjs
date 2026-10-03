import { createHash } from 'node:crypto';
import { kDigest } from './dog-portrait-cohort-k.mjs';

export const lDigest = kDigest;
const hash = value => /^[a-f0-9]{64}$/.test(value || '');
const text = value => typeof value === 'string' && value.trim().length > 0;
const binding = value => text(value?.path) && hash(value?.sha256) && Number.isSafeInteger(value?.bytes) && value.bytes > 0;
const wave = value => /^l(?:0[1-9]|[1-9]\d|100)$/.test(value || '');
const rawDigest = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Each tranche is frozen independently. Appending a later tranche cannot alter
// the digest already bound by an earlier entry, approval or image attempt.
export function portraitCohortLTrancheDigest(freeze) {
  const { selectionSha256, ...content } = freeze;
  return lDigest(content);
}

export function portraitCohortLRollingAuthorized(cohort, authorization) {
  const policy = cohort.batchPolicy;
  return policy?.mode === 'rolling-small' && policy.authority === 'direct-user-instruction' &&
    binding(policy.authorization) && policy.minimumQualifiedPerTranche === 1 &&
    policy.reservesRequired === false && policy.targetAdditionalPublishedPairs === 100 &&
    authorization?.cohortId === 'dogs-portraits-l' && authorization.authority === 'direct-user-instruction' &&
    authorization.answer === 'Yes—use the rolling queue and finish all 100' &&
    authorization.targetAdditionalPublishedPairs === 100 && authorization.baselinePublishedPairs === 602 &&
    authorization.sourceQualityPurposePreservationAndReleaseGatesUnchanged === true;
}

export function summarizePortraitCohortL(cohort) {
  const rows = Object.values(cohort.entries || {});
  return { qualified: new Set((cohort.qualificationReceipts || []).map(row => row.catalogId)).size,
    generationCalls: rows.reduce((sum, row) => sum + (row.generation?.attempts?.length || 0), 0),
    accepted: rows.filter(row => row.qa?.status === 'approved' && row.profile?.status === 'approved').length,
    integrated: rows.filter(row => row.integration?.status === 'integrated').length,
    published: rows.filter(row => row.publication?.status === 'published').length };
}

export function validatePortraitCohortL(cohort, { catalog, rightsLedger, generatedArtwork, profiles, batchingAuthorization, trancheFreezes = {} } = {}) {
  const errors = [], fail = (ok, message) => { if (!ok) errors.push(message); };
  fail(cohort.schemaVersion === 1 && cohort.cohortId === 'dogs-portraits-l', 'Unknown L cohort schema or identity');
  fail(cohort.targetAdditionalPairs === 100 && cohort.baseline?.baselinePairs === 602 && cohort.baseline?.catalogIdentities === 1239, 'L baseline/100-pair target changed');
  for (const key of ['tranches', 'amendments', 'qualificationReceipts', 'integrationBatches', 'publications']) fail(Array.isArray(cohort[key]), `L ${key} must be an array`);
  fail(cohort.entries && !Array.isArray(cohort.entries) && typeof cohort.entries === 'object', 'L entries must be keyed by exact catalog ID');
  if (errors.length) return errors;
  if (cohort.batchPolicy) fail(portraitCohortLRollingAuthorized(cohort, batchingAuthorization), 'Rolling/smaller batches require a separately hashed direct-user batching amendment');
  const rolling = portraitCohortLRollingAuthorized(cohort, batchingAuthorization);
  const qualified = new Set();
  for (const receipt of cohort.qualificationReceipts) {
    fail(binding(receipt) && /^VBO:\d{7}$/.test(receipt.catalogId || '') && !qualified.has(receipt.catalogId), 'Qualification needs distinct exact ID and immutable receipt binding');
    fail(receipt.generationAuthorized === false, `${receipt.catalogId}: qualification is not an image-call approval`);
    qualified.add(receipt.catalogId);
  }
  const tranches = new Map(), selected = new Map();
  for (const tranche of cohort.tranches) {
    const ids = tranche.catalogIds, reserves = tranche.reserveCatalogIds;
    fail(wave(tranche.id) && !tranches.has(tranche.id), 'L tranche ID must be unique l01–l100');
    fail(Array.isArray(ids) && Array.isArray(reserves) && ids.length > 0 && ids.length <= 100, `${tranche.id}: exact primary/reserve membership required`);
    if (!Array.isArray(ids) || !Array.isArray(reserves)) continue;
    fail(new Set([...ids, ...reserves]).size === ids.length + reserves.length, `${tranche.id}: duplicate primary/reserve identity`);
    const frozen = trancheFreezes[tranche.id];
    fail(binding(tranche.freeze) && Number.isFinite(Date.parse(tranche.frozenAt)) && frozen?.selectionSha256 === tranche.selectionSha256 && tranche.selectionSha256 === portraitCohortLTrancheDigest(frozen || {}), `${tranche.id}: immutable membership digest/freeze required`);
    fail(frozen?.cohortId === 'dogs-portraits-l' && frozen.id === tranche.id && frozen.frozenAt === tranche.frozenAt && same(frozen.catalogIds, ids) && same(frozen.reserveCatalogIds, reserves) && same(frozen.batchPolicy, cohort.batchPolicy), `${tranche.id}: actual freeze membership/authorization mismatch`);
    fail(Array.isArray(frozen?.members) && frozen.members.length === ids.length + reserves.length && [...ids, ...reserves].every(id => frozen.members.some(row => row.catalogId === id && binding(row.qualification) && same(row.qualification, Object.fromEntries(Object.entries(cohort.qualificationReceipts.find(receipt => receipt.catalogId === id) || {}).filter(([key]) => ['path', 'sha256', 'bytes'].includes(key)))))), `${tranche.id}: actual frozen qualification bindings required`);
    if (!rolling) fail(ids.length === 20 && reserves.length >= 3 && reserves.length <= 5, `${tranche.id}: default tranche requires20 qualified primaries plus3–5 qualified reserves`);
    else fail(frozen?.batchPolicy?.authorization?.sha256 === cohort.batchPolicy.authorization.sha256, `${tranche.id}: rolling tranche must bind direct-user batching amendment`);
    for (const id of [...ids, ...reserves]) fail(qualified.has(id), `${tranche.id}: unqualified identity ${id}`);
    for (const id of ids) { fail(!selected.has(id), `${id}: selected in multiple tranches`); selected.set(id, tranche); }
    tranches.set(tranche.id, tranche);
  }
  fail(selected.size <= 100, 'L selection exceeds100 additional pairs');
  const catalogById = new Map((catalog?.entities || []).map(row => [row.id, row]));
  const rightsById = new Map((rightsLedger?.assets || []).map(row => [row.assetId, row]));
  const assets = new Map((generatedArtwork?.assets || []).map(row => [row.catalogId, row]));
  for (const [id, entry] of Object.entries(cohort.entries)) {
    const tranche = selected.get(id);
    fail(entry.catalogId === id && tranche, `${id}: entry outside frozen tranche membership`);
    if (catalog) fail(catalogById.get(id)?.displayName === entry.displayName, `${id}: exact catalog name mismatch`);
    fail(entry.preparation?.trancheId === tranche?.id && entry.preparation?.trancheSha256 === tranche?.selectionSha256 && binding(entry.preparation?.packet) && binding(entry.preparation?.peer) && binding(entry.qualification), `${id}: exact packet/peer/qualification and tranche digest required`);
    const attempts = entry.generation?.attempts;
    fail(Array.isArray(attempts), `${id}: append-only generation attempts required`);
    if (!Array.isArray(attempts)) continue;
    for (const [index, attempt] of attempts.entries()) {
      fail(attempt.number === index + 1 && text(attempt.id) && attempts.filter(row => row.id === attempt.id).length === 1, `${id}: unique sequential attempt IDs required`);
      fail(binding(attempt.receipt) && binding(attempt.approval) && binding(attempt.preflight) && text(attempt.imagePermitId) && attempt.trancheSha256 === tranche?.selectionSha256, `${id}: exact attempt receipt/approval/preflight/permit and tranche required`);
      fail(['generated', 'failed'].includes(attempt.status) && ['pending', 'rejected', 'accepted'].includes(attempt.qaDecision), `${id}: invalid attempt state`);
      fail(text(attempt.prompt) && attempt.promptSha256 === rawDigest(attempt.prompt) && attempt.promptTemplateVersion === 'dogs-field-guide-v9-cohort-l', `${id}: exact L prompt required`);
      if (attempt.status === 'generated') fail(binding(attempt.native) && attempt.native.sha256 === attempt.originalOutputSha256 && text(attempt.originalOutputPath), `${id}: unchanged native output binding required`);
      if (attempt.status === 'failed') fail(text(attempt.failure), `${id}: failed attempt needs evidence`);
      if (attempt.qaDecision === 'rejected') fail(text(attempt.rejectionReason), `${id}: rejection needs accountable reason`);
    }
    if (attempts.length) fail(entry.reference?.status === 'approved' && entry.profile?.status === 'approved', `${id}: generation requires approved reference and independently reviewed full/short profile`);
    if (entry.profile?.status === 'approved') fail(text(entry.profile.author) && text(entry.profile.reviewer) && entry.profile.author !== entry.profile.reviewer && hash(entry.profile.summarySha256) && hash(entry.profile.shortDescriptionSha256), `${id}: independent exact full/short review required`);
    if (entry.reference?.status === 'approved' && rightsLedger) {
      const row = rightsById.get(entry.reference.assetId);
      fail(row?.catalogId === id && row.review?.status === 'approved' && row.uiDisplayAllowed === false && row.publicSnapshotAllowed === false && row.rasterExportAllowed === false, `${id}: exact private morphology rights row required`);
    }
    const accepted = attempts.find(row => row.id === entry.generation?.acceptedAttemptId);
    const pairReady = entry.qa?.status === 'approved' && entry.profile?.status === 'approved';
    if (pairReady || entry.integration?.status === 'integrated' || entry.publication?.status === 'published') {
      fail(pairReady && accepted?.status === 'generated' && accepted.qaDecision === 'accepted' && accepted.width === 1536 && accepted.height === 1024 && attempts.filter(row => row.qaDecision === 'accepted').length === 1, `${id}: exact1536×1024 accepted pair required`);
      fail(binding(entry.qa?.rootReview) && ['breedIdentity', 'anatomy', 'crop', 'aesthetics'].every(key => text(entry.qa[key])), `${id}: whole-native root QA receipt and four dimensions required`);
    }
    if (entry.integration?.status === 'integrated') {
      fail(wave(entry.integration.subwave) && entry.integration.batchManifest === `data/dogs/generated-artwork-batch-${entry.integration.subwave}.json`, `${id}: exact release batch integration required`);
      if (generatedArtwork) fail(assets.get(id)?.masterSha256 === accepted?.native?.sha256 && assets.get(id)?.promptTemplateVersion === 'dogs-field-guide-v9-cohort-l', `${id}: integrated asset/master mismatch`);
      if (profiles) { const row = profiles.profiles?.[id]; fail(row && rawDigest(row.summary) === entry.profile.summarySha256 && rawDigest(row.shortDescription) === entry.profile.shortDescriptionSha256, `${id}: integrated full/short copy mismatch`); }
    }
    if (entry.publication?.status === 'published') fail(entry.integration?.status === 'integrated' && binding(entry.publication.receipt), `${id}: publication needs integrated pair and exact receipt`);
  }
  const released = new Set(), releaseWaves = new Set();
  for (const batch of cohort.integrationBatches) {
    const tranche = tranches.get(batch.trancheId), ids = batch.catalogIds;
    fail(wave(batch.subwave) && !releaseWaves.has(batch.subwave), 'L release wave must be unique l01–l100');
    releaseWaves.add(batch.subwave);
    fail(tranche && batch.trancheSha256 === tranche.selectionSha256 && Array.isArray(ids) && ids.length > 0 && batch.count === ids.length && batch.batchManifest === `data/dogs/generated-artwork-batch-${batch.subwave}.json`, 'L integrated release must bind exact tranche/subset and batch manifest');
    fail(binding(batch.contactSheet) && binding(batch.rootRelease), 'L release needs reviewed contact sheet and exact root release receipt');
    let previous = -1;
    for (const id of ids || []) {
      const index = tranche?.catalogIds.indexOf(id) ?? -1;
      fail(index > previous && !released.has(id), `${id}: releases must be ordered disjoint subsets of frozen tranche membership`);
      previous = index; released.add(id);
      fail(cohort.entries[id]?.integration?.status === 'integrated' && cohort.entries[id].integration.subwave === batch.subwave && cohort.entries[id].integration.batchManifest === batch.batchManifest, `${id}: recorded release member is not integrated into exact batch`);
    }
  }
  for (const [id, entry] of Object.entries(cohort.entries)) if (entry.integration?.status === 'integrated') fail(released.has(id), `${id}: integrated pair missing exact release membership`);

  fail(same(cohort.progress, summarizePortraitCohortL(cohort)), 'L progress summary is stale');
  return errors;
}
