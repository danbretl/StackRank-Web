import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gDigest, portraitCohortGSelectionDigest, summarizePortraitCohortG,
  activeCohortGIds, validatePortraitCohortG } from '../scripts/dog-portrait-cohort-g.mjs';

const read = async path => JSON.parse(await readFile(path, 'utf8'));
const [seed, runSelection, catalog] = await Promise.all([
  read('data/dogs/portrait-cohort-g.json'),
  read('data/dogs/portrait-continuation-100.json'),
  read('data/dogs/dog-catalog.json'),
]);
const frozenDigest = '1edeac15cdf5bbc8734b975f69c6d7608916c96eed4d8a1b772cbfe9f7ea2726';
const fixture = (source = seed) => structuredClone(source);
const trackedGeneratedPrimary = (source = seed) => source.primary.map(item => source.entries[item.catalogId]).find(entry => entry?.generation.attempts.some(attempt => attempt.status === 'generated'));
const pendingEntry = catalogId => ({ catalogId, preparation: { status: 'pending' },
  reference: { status: 'pending' }, scene: { status: 'pending' },
  profile: { status: 'pending' }, generation: { status: 'pending', acceptedAttemptId: null, attempts: [] },
  qa: { status: 'pending' }, integration: { status: 'pending' }, publication: { status: 'pending' } });
const pendingFixture = (source = seed) => {
  const cohort = fixture(source);
  cohort.amendments = [];
  cohort.reserveAssessments = {};
  cohort.entries = Object.fromEntries(cohort.primary.map(x => [x.catalogId, pendingEntry(x.catalogId)]));
  cohort.integrationBatches = [];
  cohort.publications = [];
  cohort.progress = summarizePortraitCohortG(cohort);
  return cohort;
};

test('G owns a separate 25+15 freeze linked to the 100-pair run', () => {
  assert.equal(portraitCohortGSelectionDigest(seed), frozenDigest);
  assert.deepEqual(validatePortraitCohortG(seed, { runSelection, catalog }), []);
  assert.equal(seed.primary.length, 25);
  assert.equal(seed.reserves.length, 15);
  assert.deepEqual(seed.primary.map(x => x.runOrdinal), Array.from({ length: 25 }, (_, i) => i + 76));
  assert.equal(seed.baseline.expectedGStartIllustratedCount, 382);
  assert.equal(seed.progress.generationCallCount, Object.values(seed.entries).reduce((sum, entry) => sum + entry.generation.attempts.length, 0));
});

test('stage progress cannot rewrite the freeze; selection and parent-run changes are detected', () => {
  const cohort = pendingFixture();
  cohort.entries[cohort.primary[0].catalogId].preparation.status = 'staged';
  assert.equal(portraitCohortGSelectionDigest(cohort), frozenDigest);
  [cohort.reserves[0], cohort.reserves[1]] = [cohort.reserves[1], cohort.reserves[0]];
  assert.ok(validatePortraitCohortG(cohort).some(x => x.includes('digest mismatch')));
  const changed = pendingFixture();
  changed.runFreeze.selectionSha256 = 'a'.repeat(64);
  assert.ok(validatePortraitCohortG(changed).some(x => x.includes('parent run freeze')));
  const parent = structuredClone(runSelection);
  parent.primary[75].catalogId = 'VBO:changed';
  assert.ok(validatePortraitCohortG(seed, { runSelection: parent }).some(x => x.includes('diverge')));
});

test('recorded attempts reject changed prompts, missing rejection reasons and altered native hashes', () => {
  const cohort = fixture();
  const entry = Object.values(cohort.entries).find(e => e.generation.attempts.length >= 3 &&
    e.generation.attempts.some(a => a.qaDecision === 'rejected'));
  assert.ok(entry, 'tracked G ledger must retain an original crop retry chain');
  entry.generation.attempts[0].prompt += ' changed after call';
  entry.generation.attempts.find(a => a.qaDecision === 'rejected').rejectionReason = '';
  entry.generation.attempts.at(-1).masterSha256 = 'b'.repeat(64);
  cohort.progress = summarizePortraitCohortG(cohort);
  const errors = validatePortraitCohortG(cohort);
  assert.ok(errors.some(x => x.includes('pre-call prompt')));
  assert.ok(errors.some(x => x.includes('rejected/unselected')));
  assert.ok(errors.some(x => x.includes('native generated')));
});

test('a pending identity cannot claim acceptance, integration or publication', () => {
  const cohort = pendingFixture();
  const entry = cohort.entries[cohort.primary[0].catalogId];
  entry.qa.status = 'approved';
  entry.integration.status = 'integrated';
  entry.publication.status = 'published';
  cohort.progress = summarizePortraitCohortG(cohort);
  const errors = validatePortraitCohortG(cohort);
  assert.ok(errors.some(x => x.includes('one independently reviewed complete pair')));
  assert.ok(errors.some(x => x.includes('full-resolution QA')));
  assert.ok(errors.some(x => x.includes('only accepted G01')));
  assert.ok(errors.some(x => x.includes('publication receipt')));
});

test('ordered reserve activation needs a blocked active identity and chained evidence', () => {
  const cohort = pendingFixture();
  const blockedCatalogId = cohort.primary[0].catalogId;
  const activatedCatalogId = cohort.reserves[0].catalogId;
  cohort.entries[blockedCatalogId].hold = { status: 'blocked', reason: 'Exact source failed', evidencePaths: ['notes/hold.json'] };
  cohort.entries[activatedCatalogId] = { catalogId: activatedCatalogId, preparation: { status: 'pending' },
    reference: { status: 'pending' }, scene: { status: 'pending' }, profile: { status: 'pending' },
    generation: { status: 'pending', acceptedAttemptId: null, attempts: [] }, qa: { status: 'pending' },
    integration: { status: 'pending' }, publication: { status: 'pending' } };
  const content = { sequence: 1, previousSha256: cohort.selectionSha256, blockedCatalogId, activatedCatalogId,
    recordedAt: '2026-09-23T09:00:00Z', reason: 'Documented exact-source failure', evidencePaths: ['notes/hold.json'] };
  cohort.amendments.push({ ...content, sha256: gDigest(content) });
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.deepEqual(validatePortraitCohortG(cohort, { runSelection, catalog }), []);
  assert.equal(activeCohortGIds(cohort).length, 25);
  cohort.amendments[0].activatedCatalogId = cohort.reserves[1].catalogId;
  assert.ok(validatePortraitCohortG(cohort).some(x => x.includes('next eligible')));
});

test('stale counters and reference-purpose flips fail independently of selection digest', () => {
  const cohort = pendingFixture();
  cohort.progress.generationCallCount = 1;
  cohort.selectionPolicy.referencePurposes.uiDisplayAllowed = true;
  const errors = validatePortraitCohortG(cohort);
  assert.ok(errors.some(x => x.includes('progress summary')));
  assert.ok(errors.some(x => x.includes('purpose gates')));
});

test('a generated identity may be held with every output archived and the next reserve activated', () => {
  const cohort = pendingFixture();
  const tracked = trackedGeneratedPrimary();
  assert.ok(tracked, 'tracked seed must contain a generated primary');
  const entry = structuredClone(tracked);
  const blockedCatalogId = entry.catalogId;
  cohort.entries[blockedCatalogId] = entry;
  entry.integration = { status: 'pending' };
  entry.publication = { status: 'pending' };
  const activatedCatalogId = cohort.reserves[0].catalogId;
  entry.hold = { status: 'blocked', reason: 'Pinned source identity failed after generation', evidencePaths: ['reports/hold.json'] };
  entry.reference.status = 'blocked';
  entry.scene.status = 'blocked';
  entry.generation.status = 'blocked';
  entry.generation.acceptedAttemptId = null;
  entry.qa.status = 'rejected';
  for (const attempt of entry.generation.attempts) {
    if (attempt.status === 'generated') {
      attempt.qaDecision = 'rejected';
      attempt.rejectionReason ||= 'Source identity failed after generation';
    }
  }
  cohort.entries[activatedCatalogId] = pendingEntry(activatedCatalogId);
  const content = { sequence: 1, previousSha256: cohort.selectionSha256, blockedCatalogId, activatedCatalogId,
    recordedAt: '2026-09-23T11:00:00Z', reason: 'Documented source identity failure', evidencePaths: ['reports/hold.json'] };
  cohort.amendments = [{ ...content, sha256: gDigest(content) }];
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.deepEqual(validatePortraitCohortG(cohort, { runSelection, catalog }), []);
  assert.equal(activeCohortGIds(cohort)[cohort.primary.findIndex(item => item.catalogId === blockedCatalogId)], activatedCatalogId);
  assert.equal(cohort.progress.generationCallCount, entry.generation.attempts.length);

  entry.generation.attempts[0].qaDecision = 'accepted';
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.ok(validatePortraitCohortG(cohort).some(error => error.includes('blocked generated identity')));
  entry.generation.attempts[0].qaDecision = 'rejected';
  entry.hold.evidencePaths = [];
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.ok(validatePortraitCohortG(cohort).some(error => error.includes('hold evidence required')));
  delete entry.hold;
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.ok(validatePortraitCohortG(cohort).some(error => error.includes('generated output lacks a qualified reference/scene gate')));
});

test('pinned source revision is required and must agree with approved rights ledger', () => {
  const cohort = pendingFixture();
  const tracked = trackedGeneratedPrimary();
  assert.ok(tracked?.reference.sourcePageRevision?.id);
  const entry = structuredClone(tracked);
  cohort.entries[entry.catalogId] = entry;
  delete entry.hold;
  entry.reference.status = 'worker-approved';
  entry.scene.status = 'worker-ready';
  entry.profile = { status: 'pending' };
  entry.generation = { status: 'pending', acceptedAttemptId: null, attempts: [] };
  entry.qa = { status: 'pending' };
  entry.integration = { status: 'pending' };
  entry.publication = { status: 'pending' };
  const originalRevision = structuredClone(entry.reference.sourcePageRevision);
  delete entry.reference.sourcePageRevision;
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.ok(validatePortraitCohortG(cohort).some(error => error.includes('pinned source File-page revision')));
  entry.reference.sourcePageRevision = originalRevision;
  entry.reference.status = 'approved';
  entry.reference.primaryReviewedAt = '2026-09-23T11:00:00Z';
  const rightsLedger = { assets: [{ assetId: entry.reference.assetId, catalogId: entry.catalogId,
    sourcePage: entry.reference.sourcePage, sourceSha256: entry.reference.sourceSha256,
    sourcePageRevision: { id: originalRevision.id + 1, timestamp: originalRevision.timestamp },
    review: { status: 'approved', subjectMatchesCatalog: true, nonCopyrightRestrictionsReviewed: true },
    uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false }] };
  cohort.progress = summarizePortraitCohortG(cohort);
  assert.ok(validatePortraitCohortG(cohort, { rightsLedger }).some(error => error.includes('approved rights ledger mismatch')));
});

test('one synthetic root-reviewed G pair needs matching profile, rights, master and publication receipt', () => {
  const tracked = trackedGeneratedPrimary();
  assert.ok(tracked, 'tracked G seed must retain a generated primary');
  const id = tracked.catalogId;
  const cohort = pendingFixture();
  const entry = structuredClone(tracked);
  delete entry.hold;
  const accepted = entry.generation.attempts.find(a => a.status === 'generated' && a.qaDecision === 'accepted')
    || entry.generation.attempts.find(a => a.status === 'generated' && a.qaDecision === 'pending')
    || entry.generation.attempts.find(a => a.status === 'generated');
  for (const attempt of entry.generation.attempts) {
    if (attempt !== accepted && attempt.status === 'generated') {
      attempt.qaDecision = 'rejected';
      attempt.rejectionReason ||= 'Synthetic fixture selects a different archived attempt';
    }
  }
  const summary = 'Independent test summary of this breed’s documented character and work.';
  entry.reference.status = 'approved';
  entry.reference.primaryReviewedAt = '2026-09-23T11:00:00Z';
  entry.scene.status = 'ready';
  entry.profile.status = 'approved';
  entry.profile.author = 'synthetic worker';
  entry.profile.shortDescription = 'A documented working breed whose character and historical tasks are checked in this synthetic review fixture.';
  entry.profile.sourcePath = 'reports/synthetic-profile.json';
  entry.profile.summarySha256 = gDigest(summary);
  entry.profile.reviewer = 'independent root reviewer';
  entry.profile.reviewNotes = 'Source-checked synthetic fixture';
  entry.generation.status = 'accepted';
  entry.generation.acceptedAttemptId = accepted.id;
  accepted.qaDecision = 'accepted';
  entry.qa = { status: 'approved', workerFullResolutionViewed: true, primaryFullResolutionViewed: true,
    reviewedAt: '2026-09-23T11:05:00Z', breedIdentity: 'pass', anatomy: 'pass', crop: 'pass',
    aesthetics: 'pass', contactSheetPath: 'reports/synthetic-contact-sheet.jpg' };
  entry.integration = { status: 'integrated', subwave: 'g01', batchManifest: 'data/dogs/generated-artwork-batch-g01.json', integratedAt: '2026-09-23T11:06:00Z' };
  entry.publication = { status: 'published', commit: 'abcdef12', deploymentUrl: 'https://example.com',
    verifiedAt: '2026-09-23T11:10:00Z', evidencePath: 'reports/synthetic-deployment.json' };
  cohort.entries[id] = entry;
  cohort.progress = summarizePortraitCohortG(cohort);
  const rightsLedger = { assets: [{ assetId: entry.reference.assetId, catalogId: id,
    sourcePage: entry.reference.sourcePage, sourceSha256: entry.reference.sourceSha256,
    sourcePageRevision: structuredClone(entry.reference.sourcePageRevision),
    review: { status: 'approved', subjectMatchesCatalog: true, nonCopyrightRestrictionsReviewed: true },
    uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false }] };
  const generatedArtwork = { assets: [{ catalogId: id, masterSha256: accepted.masterSha256,
    reference: { assetId: entry.reference.assetId }, uiDisplayAllowed: true,
    publicSnapshotAllowed: false, rasterExportAllowed: false }] };
  const profiles = { profiles: { [id]: { reviewStatus: 'editor-reviewed', summary } } };
  assert.deepEqual(validatePortraitCohortG(cohort, { runSelection, catalog, rightsLedger, generatedArtwork, profiles }), []);
  assert.equal(cohort.progress.publishedPairCount, 1);
  generatedArtwork.assets[0].masterSha256 = 'f'.repeat(64);
  assert.ok(validatePortraitCohortG(cohort, { generatedArtwork, profiles }).some(error => error.includes('integrated artwork')));
});
