import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { hDigest, portraitCohortHSelectionDigest, summarizePortraitCohortH,
  activeCohortHIds, validatePortraitCohortH } from '../scripts/dog-portrait-cohort-h.mjs';

const read = async path => JSON.parse(await readFile(path, 'utf8'));
const [seed, catalog] = await Promise.all([read('data/dogs/portrait-cohort-h.json'), read('data/dogs/dog-catalog.json')]);
const frozenDigest = 'e68cbba5b52c60bf637ce91a858a0553683ca4fd2919276338adb3a6e904ae47';
const hash = 'a'.repeat(64);
const time = '2026-09-23T16:00:00Z';
const pendingEntry = catalogId => ({ catalogId, preparation: { status: 'pending' },
  reference: { status: 'pending' }, scene: { status: 'pending' }, profile: { status: 'pending' },
  generation: { status: 'pending', acceptedAttemptId: null, attempts: [] }, qa: { status: 'pending' },
  integration: { status: 'pending' }, publication: { status: 'pending' } });
const fixture = () => {
  const c = structuredClone(seed);
  c.amendments = []; c.reserveAssessments = {};
  c.entries = Object.fromEntries(c.primary.map(x => [x.catalogId, pendingEntry(x.catalogId)]));
  c.progress = summarizePortraitCohortH(c);
  return c;
};
const refresh = c => { c.progress = summarizePortraitCohortH(c); return c; };
function readyEntry(c, index = 0) {
  const id = c.primary[index].catalogId, e = c.entries[id];
  e.reference = { status: 'worker-approved', assetId: 'test:reference', sourcePage: 'https://commons.wikimedia.org/wiki/File:Test.jpg',
    sourceSha256: hash, sourcePageRevision: { id: 123, timestamp: time }, visualReview: 'Synthetic inspected reference',
    rightsReview: 'Synthetic rights review', purposes: { uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false } };
  e.scene = { status: 'worker-ready', description: 'Synthetic natural scene', rationale: 'Synthetic work setting', sources: [{ url: 'https://example.org/standard' }] };
  const prompt = 'Synthetic portrait request';
  e.generation = { status: 'staged', acceptedAttemptId: null, attempts: [{ number: 1, id: 'synthetic-h-1', status: 'generated', qaDecision: 'pending',
    startedAt: time, completedAt: time, prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'),
    referenceInputPath: 'reports/synthetic-reference.png', referenceInputSha256: hash,
    agentModel: 'gpt-6-sol', reasoningEffort: 'high', imageGenerator: 'built-in imagegen', imageModel: 'undisclosed',
    masterPath: 'assets/dogs/generated-masters/cohort-h/synthetic.png', masterSha256: hash, originalOutputSha256: hash,
    originalOutputPath: '/synthetic/native.png', width: 1536, height: 1024 }] };
  return e;
}
function acceptedEntry(c, index = 0) {
  const e = readyEntry(c, index), summary = 'A synthetic source-supported profile used only to test the completion gate.';
  e.reference.status = 'approved'; e.reference.primaryReviewedAt = time; e.scene.status = 'ready';
  e.profile = { status: 'approved', sourcePath: 'reports/synthetic-profile.json', summarySha256: hDigest(summary),
    shortDescription: 'A source-supported synthetic description whose documented character and work are independently reviewed.',
    author: 'synthetic writer', reviewer: 'synthetic peer', reviewNotes: 'Claims checked against source' };
  e.generation.status = 'accepted'; e.generation.acceptedAttemptId = e.generation.attempts[0].id; e.generation.attempts[0].qaDecision = 'accepted';
  e.qa = { status: 'approved', primaryFullResolutionViewed: true, workerFullResolutionViewed: true, reviewedAt: time,
    breedIdentity: 'Synthetic identity pass', anatomy: 'Synthetic anatomy pass', crop: 'Synthetic crop pass', aesthetics: 'Synthetic aesthetics pass', contactSheetPath: 'reports/synthetic-sheet.jpg' };
  const wave = index < 25 ? 'h01' : 'h02';
  e.integration = { status: 'integrated', subwave: wave, batchManifest: `data/dogs/generated-artwork-batch-${wave}.json`, integratedAt: time };
  const context = { profiles: { profiles: { [e.catalogId]: { reviewStatus: 'editor-reviewed', summary } } },
    rightsLedger: { assets: [{ ...e.reference, catalogId: e.catalogId, review: { status: 'approved', subjectMatchesCatalog: true, nonCopyrightRestrictionsReviewed: true }, uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false }] },
    generatedArtwork: { assets: [{ catalogId: e.catalogId, masterSha256: hash, reference: { assetId: e.reference.assetId }, uiDisplayAllowed: true, publicSnapshotAllowed: false, rasterExportAllowed: false }] } };
  return { e, context };
}
function activate(c, id = c.primary[0].catalogId, reserveIndex = 0) {
  c.entries[id].hold = { status: 'blocked', reason: 'Synthetic exact-source failure', evidencePaths: ['reports/synthetic-hold.json'] };
  const activatedCatalogId = c.reserves[reserveIndex].catalogId;
  c.entries[activatedCatalogId] = pendingEntry(activatedCatalogId);
  const content = { sequence: 1, previousSha256: c.selectionSha256, blockedCatalogId: id, activatedCatalogId, recordedAt: time,
    reason: 'Synthetic documented source failure', evidencePaths: ['reports/synthetic-hold.json'] };
  c.amendments.push({ ...content, sha256: hDigest(content) }); return activatedCatalogId;
}

test('H retains its own 43+10 freeze, 407 baseline and two waves', () => {
  assert.equal(portraitCohortHSelectionDigest(seed), frozenDigest);
  assert.deepEqual(validatePortraitCohortH(seed, { catalog }), []);
  assert.equal(seed.primary.filter(x => x.subwave === 'h01').length, 25);
  assert.equal(seed.primary.filter(x => x.subwave === 'h02').length, 18);
  assert.equal(seed.baseline.generatedCatalogIds.length, 407);
});
test('stage changes cannot rewrite identity, reserve order or the protected baseline', () => {
  const c = fixture(); c.entries[c.primary[0].catalogId].preparation.status = 'ready';
  assert.equal(portraitCohortHSelectionDigest(c), frozenDigest);
  [c.reserves[0], c.reserves[1]] = [c.reserves[1], c.reserves[0]];
  assert.ok(validatePortraitCohortH(c).some(x => x.includes('digest mismatch')));
  const d = fixture(); d.primary[0].catalogId = d.baseline.generatedCatalogIds[0];
  assert.ok(validatePortraitCohortH(d).some(x => x.includes('already published')));
  d.primary[0].catalogId = d.baseline.heldCatalogIds[0];
  assert.ok(validatePortraitCohortH(d).some(x => x.includes('prior held identity')));
});
test('ordered reserve activation requires a blocked identity, evidence and a hash chain', () => {
  const c = fixture(), id = activate(c); refresh(c);
  assert.deepEqual(validatePortraitCohortH(c, { catalog }), []); assert.equal(activeCohortHIds(c)[0], id);
  const d = fixture(); activate(d, d.primary[0].catalogId, 1); refresh(d);
  assert.ok(validatePortraitCohortH(d).some(x => x.includes('next eligible')));
  c.amendments[0].reason = 'Changed after recording';
  assert.ok(validatePortraitCohortH(c).some(x => x.includes('amendment chain')));
});
test('attempt accounting preserves prompt, native bytes and concrete rejection reasons', () => {
  const c = fixture(), e = readyEntry(c); refresh(c); assert.deepEqual(validatePortraitCohortH(c), []);
  const a = e.generation.attempts[0]; a.prompt += ' altered'; a.masterSha256 = 'b'.repeat(64); a.qaDecision = 'rejected'; refresh(c);
  const errors = validatePortraitCohortH(c);
  assert.ok(errors.some(x => x.includes('pre-call prompt'))); assert.ok(errors.some(x => x.includes('native generated')));
  assert.ok(errors.some(x => x.includes('rejected/unselected')));
});
test('pending work cannot claim acceptance or publication, and counters cannot drift', () => {
  const c = fixture(), e = c.entries[c.primary[0].catalogId]; e.qa.status = 'approved'; e.publication.status = 'published';
  const errors = validatePortraitCohortH(c);
  assert.ok(errors.some(x => x.includes('complete pair'))); assert.ok(errors.some(x => x.includes('publication receipt')));
  assert.ok(errors.some(x => x.includes('progress summary')));
});
test('both waves require independent QA and matching compiled rights, profiles and artwork', () => {
  for (const index of [0, 25]) {
    const c = fixture(), { e, context } = acceptedEntry(c, index); refresh(c);
    assert.deepEqual(validatePortraitCohortH(c, context), []);
    e.qa.primaryFullResolutionViewed = false; context.generatedArtwork.assets[0].publicSnapshotAllowed = true;
    context.profiles.profiles[e.catalogId].summary += ' changed';
    const errors = validatePortraitCohortH(c, context);
    assert.ok(errors.some(x => x.includes('full-resolution QA'))); assert.ok(errors.some(x => x.includes('integrated artwork')));
    assert.ok(errors.some(x => x.includes('integrated reviewed summary')));
  }
});
test('publication needs a release receipt and integration must use its frozen wave', () => {
  const c = fixture(), { e, context } = acceptedEntry(c, 25); e.publication = { status: 'published' }; refresh(c);
  assert.ok(validatePortraitCohortH(c, context).some(x => x.includes('publication receipt')));
  e.publication = { status: 'published', commit: 'test-commit', deploymentUrl: 'https://example.org', verifiedAt: time, evidencePath: 'reports/test.json' };
  assert.deepEqual(validatePortraitCohortH(c, context), []);
  e.integration.subwave = 'h01'; e.integration.batchManifest = 'data/dogs/generated-artwork-batch-h01.json';
  assert.ok(validatePortraitCohortH(c, context).some(x => x.includes('frozen wave')));
});
test('a later identity hold retains outputs but cannot retain an accepted master', () => {
  const c = fixture(), e = readyEntry(c); activate(c, e.catalogId);
  e.reference.status = 'blocked'; e.scene.status = 'blocked'; e.generation.status = 'blocked'; e.qa.status = 'rejected';
  e.generation.attempts[0].qaDecision = 'rejected'; e.generation.attempts[0].rejectionReason = 'Synthetic later identity failure'; refresh(c);
  assert.deepEqual(validatePortraitCohortH(c), []); assert.equal(c.progress.generationCallCount, 1);
  e.generation.attempts[0].qaDecision = 'accepted'; refresh(c);
  assert.ok(validatePortraitCohortH(c).some(x => x.includes('blocked generated identity')));
});
test('pinned references and scene evidence fail closed before generation', () => {
  const c = fixture(), e = readyEntry(c); delete e.reference.sourcePageRevision;
  e.reference.purposes.uiDisplayAllowed = true; e.scene.sources = []; refresh(c);
  const errors = validatePortraitCohortH(c);
  assert.ok(errors.some(x => x.includes('pinned source File-page'))); assert.ok(errors.some(x => x.includes('reference purposes')));
  assert.ok(errors.some(x => x.includes('scene evidence')));
});
