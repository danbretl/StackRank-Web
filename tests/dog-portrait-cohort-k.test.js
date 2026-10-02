import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { kDigest, portraitCohortKSelectionDigest, activeCohortKSlots, summarizePortraitCohortK, validatePortraitCohortK } from '../scripts/dog-portrait-cohort-k.mjs';
import { summarizePortraitCohortJ, validatePortraitCohortJ } from '../scripts/dog-portrait-cohort-j.mjs';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const [catalog, j, context] = await Promise.all([read('data/dogs/dog-catalog.json'), read('data/dogs/portrait-cohort-j.json'), read('data/dogs/portrait-continuation-context.json')]);
const priorIds = [...j.baseline.generatedCatalogIds, ...Object.values(j.entries).filter(e => e.publication.status === 'published').map(e => e.catalogId)];
const heldIds = context.holds.map(e => e.catalogId);
const names = ['k_worker_a', 'k_worker_b', 'k_worker_c', 'k_worker_d', 'k_worker_e'];
const hash = 'a'.repeat(64), date = '2026-10-02T06:00:00Z';
const candidates = catalog.entities.filter(e => e.selectable && !priorIds.includes(e.id) && !heldIds.includes(e.id));
const refresh = c => (c.progress = summarizePortraitCohortK(c), c);
function seed() {
  const primary = candidates.slice(0, 250).map((e, index) => ({ ordinal: index + 1, catalogId: e.id,
    displayName: e.displayName, subwave: `k${String(Math.floor(index / 25) + 1).padStart(2, '0')}`,
    preparationWorker: names[index % 5], basis: 'Controlled test fixture, never a production selection.', identityReview: 'Exact source identity test fixture.' }));
  const c = { schemaVersion: 1, cohortId: 'dogs-portraits-k', frozenAt: date, targetCompletedCount: 250,
    baseline: { illustratedCount: 560, developedCount: 560, targetTotalCompletedPairs: 810, selectableCount: 1239,
      commit: '012c1e4f94fa64c1407f36d5b3a32adb200b628a', generatedCatalogIds: [...priorIds], heldCatalogIds: [...heldIds] },
    sourceSnapshots: Object.fromEntries(['dog-catalog', 'generated-artwork', 'breed-profiles', 'image-rights', 'packs', 'artwork-license-policy', 'generated-artwork-policy'].map(key => [key, { path: `data/dogs/${key}.json`, snapshotPath: `reports/dogs-generated-artwork/cohort-k/baseline/${key}.json`, sha256: hash }])),
    selectionPolicy: { referencePurposes: { uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false }, generatedPurposes: { uiDisplayAllowed: true, publicSnapshotAllowed: false, rasterExportAllowed: false } },
    primary, reserves: candidates.slice(250, 300).map((e, i) => ({ ordinal: i + 1, catalogId: e.id, displayName: e.displayName })),
    frozenAssignments: names.map(worker => ({ worker, catalogIds: primary.filter(e => e.preparationWorker === worker).map(e => e.catalogId) })),
    assignments: [...names.map((worker, index) => ({ worker, threadId: 'thread-' + index, workspace: '/isolated/' + worker,
      model: 'gpt-6.1-sol', reasoningEffort: 'xhigh', setupReceiptSha256: hash,
      permissions: { sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: 'enabled' } })), { worker: 'primary orchestrator', model: 'not disclosed in runtime' }],
    imageGeneration: { tool: 'OpenAI built-in imagegen', underlyingImageModel: 'undisclosed', promptTemplateVersion: 'dogs-field-guide-v8-cohort-k', nativeDimensions: [1536, 1024] },
    amendments: [], reserveAssessments: {}, entries: {}, integrationBatches: [], publicationMilestones: [] };
  c.entries = Object.fromEntries(primary.map(p => [p.catalogId, { catalogId: p.catalogId, preparation: { worker: p.preparationWorker, subwave: p.subwave },
    reference: { status: 'pending' }, scene: { status: 'pending' }, profile: { status: 'pending' },
    generation: { status: 'pending', acceptedAttemptId: null, attempts: [] }, qa: { status: 'pending' }, integration: { status: 'pending' }, publication: { status: 'pending' } }]));
  c.selectionSha256 = portraitCohortKSelectionDigest(c);
  return refresh(c);
}
function prepared(c) {
  const e = c.entries[c.primary[0].catalogId];
  e.reference = { status: 'worker-approved', assetId: 'private-reference', originalPath: 'original.jpg', filePageWikitextPath: 'pinned.txt', filePageWikitextSha256: hash, metadataPath: 'metadata.json', metadataSha256: hash, sourcePage: 'https://commons.wikimedia.org/wiki/File:Exact_adult.jpg', sourceSha256: hash, visualReview: 'Full adult original read.', rightsReview: 'Creator and earliest chain plus license read.', sourcePageRevision: { id: 123, timestamp: date }, purposes: { uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false } };
  e.scene = { status: 'worker-ready', description: 'A regional natural meadow.', rationale: 'Supported field work.', sources: [{ url: 'https://www.fci.be/standard.pdf' }] };
  e.profile = { status: 'draft', shortDescription: 'A character-led, individually researched note with supported working habits and specific regional history.', sourceSnapshots: [{ url: 'https://www.fci.be/standard.pdf', snapshotPath: 'primary.pdf', snapshotSha256: hash, evidence: 'The exact temperament and work paragraphs were read.' }] };
  return e;
}
function generated(e) {
  const prompt = 'Exact approved adult morphology, distinct natural scene, coherent full body and all four grounded paws; native 1536x1024.';
  e.generation.status = 'staged';
  e.generation.attempts = [{ id: 'k01-a-01', number: 1, status: 'generated', qaDecision: 'pending', startedAt: date, completedAt: date,
    prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'), referenceInputSha256: hash, referenceInputPath: 'original.jpg', agentModel: 'gpt-6.1-sol', reasoningEffort: 'xhigh', imageGenerator: 'built-in imagegen', imageModel: 'undisclosed',
    rootApprovalPath: 'reports/dogs-generated-artwork/cohort-k/root-approvals/approval.json', rootApprovalSha256: hash,
    preflightReceiptPath: 'reports/dogs-generated-artwork/cohort-k/worker-a/preflights/permit.json', preflightReceiptSha256: hash, imagePermitId: 'permit-A',
    masterPath: 'assets/dogs/generated-masters/cohort-k/worker-a/native.png', masterSha256: hash, originalOutputSha256: hash, originalOutputPath: '/unchanged-tool-output.png', width: 1536, height: 1024 }];
}

test('K separately freezes five 50-slot owners and the verified 560→810 baseline', () => {
  const c = seed(); assert.deepEqual(validatePortraitCohortK(c, { catalog }), []);
  assert.equal(c.primary.length, 250); assert.equal(c.progress.workers.length, 5);
  assert.ok(c.progress.workers.every(w => w.targetCount === 50 && w.acceptedPairCount === 0));
  assert.equal(c.progress.remainingCount, 250);
});
test('K cannot weaken the frozen J 60-pair stop or rewrite its original selection', () => {
  assert.equal(j.selectionSha256, '3939e68cd9af8d6eb22728c7e243ca90f9208a904ff5d286e5ac41ea4733fde0');
  assert.deepEqual(validatePortraitCohortJ(j), []);
  assert.equal(summarizePortraitCohortJ(j).authorizedCompletedPairLimit, 60);
  assert.equal(summarizePortraitCohortJ(j).remainingAuthorizedCount, 0);
});
test('K rejects changed ownership even when a caller recomputes the selection digest', () => {
  for (const mutate of [c => c.primary[0].preparationWorker = 'k_worker_b', c => c.frozenAssignments[0].catalogIds.push(c.primary[1].catalogId), c => c.entries[c.primary[0].catalogId].preparation.worker = 'k_worker_c']) {
    const c = seed(); mutate(c); c.selectionSha256 = portraitCohortKSelectionDigest(c);
    assert.ok(validatePortraitCohortK(refresh(c)).some(x => /ownership|slot owner/.test(x)));
  }
});
test('K rejects reused threads/workspaces, constrained permissions and reduced effort', () => {
  for (const mutate of [c => c.assignments[1].threadId = c.assignments[0].threadId, c => c.assignments[1].workspace = c.assignments[0].workspace, c => c.assignments[0].permissions.approvalPolicy = 'on-request', c => c.assignments[0].model = 'gpt-6-sol', c => c.assignments[0].reasoningEffort = 'high']) {
    const c = seed(); mutate(c); assert.ok(validatePortraitCohortK(c).length);
  }
});
test('K keeps baseline, frozen order, prior holds and artwork purposes protected', () => {
  for (const mutate of [c => c.primary.reverse(), c => c.baseline.illustratedCount = 559, c => c.baseline.heldCatalogIds.pop(), c => c.selectionPolicy.referencePurposes.uiDisplayAllowed = true, c => c.selectionPolicy.generatedPurposes.rasterExportAllowed = true]) {
    const c = seed(); mutate(c); assert.ok(validatePortraitCohortK(c).length);
  }
});
test('a K image attempt needs exact input hashes, xhigh settings and its root/global preflight receipts', () => {
  const c = seed(), e = prepared(c); generated(e); assert.deepEqual(validatePortraitCohortK(refresh(c)), []);
  for (const [key, value] of [['promptSha256', 'b'.repeat(64)], ['rootApprovalPath', 'worker-approval.json'], ['preflightReceiptSha256', null], ['imagePermitId', null], ['reasoningEffort', 'high'], ['originalOutputSha256', 'b'.repeat(64)], ['width', 1500]]) {
    const a = e.generation.attempts[0], old = a[key]; a[key] = value; assert.ok(validatePortraitCohortK(c).length, key); a[key] = old;
  }
  assert.equal(summarizePortraitCohortK(c).acceptedPairCount, 0);
});
test('a K reserve activation inherits its frozen slot owner and retains the blocked entry', () => {
  const c = seed(), p = c.primary[0], r = c.reserves[0];
  c.entries[p.catalogId].hold = { status: 'blocked', reason: 'Exact original source chain cannot qualify.', evidencePaths: ['source-hold.json'] };
  c.entries[r.catalogId] = structuredClone(c.entries[p.catalogId]); c.entries[r.catalogId].catalogId = r.catalogId; delete c.entries[r.catalogId].hold;
  const a = { sequence: 1, previousSha256: c.selectionSha256, blockedCatalogId: p.catalogId, activatedCatalogId: r.catalogId,
    worker: p.preparationWorker, recordedAt: date, reason: 'First eligible ordered reserve inherits acceptance slot.', evidencePaths: ['source-hold.json'] };
  a.sha256 = kDigest(a); c.amendments.push(a); assert.deepEqual(validatePortraitCohortK(refresh(c)), []);
  assert.equal(activeCohortKSlots(c)[0].worker, p.preparationWorker); assert.ok(c.entries[p.catalogId]);
  c.amendments[0].worker = 'k_worker_b'; const { sha256, ...content } = c.amendments[0]; c.amendments[0].sha256 = kDigest(content);
  assert.ok(validatePortraitCohortK(refresh(c)).some(x => /inherit/.test(x)));
});
test('same-writer profile approval and publication before integration never count as completed K work', () => {
  const c = seed(), e = prepared(c);
  e.profile = { ...e.profile, status: 'approved', sourcePath: 'profile-refresh-k01.json', summarySha256: hash, shortDescriptionSha256: kDigest(e.profile.shortDescription), author: 'writer-A', reviewer: 'writer-A', reviewNotes: 'Self review cannot satisfy peer gate.' };
  assert.ok(validatePortraitCohortK(refresh(c)).some(x => /independent sourced/.test(x)));
  e.publication.status = 'published'; assert.ok(validatePortraitCohortK(refresh(c)).some(x => /publication receipt/.test(x)));
});
test('K preserves rejected wrong-size outputs but never accepts them', () => {
  const c = seed(), e = prepared(c); generated(e); const a = e.generation.attempts[0];
  a.width = 1376; a.height = 1143; a.qaDecision = 'rejected'; a.validationFailure = 'nonconforming-native-dimensions'; a.rejectionReason = 'Retained real tool output at its wrong native size.';
  assert.deepEqual(validatePortraitCohortK(refresh(c)), []);
  for (const verdict of ['pending', 'accepted', 'unselected']) { a.qaDecision = verdict; assert.ok(validatePortraitCohortK(refresh(c)).some(x => /native generated/.test(x))); }
});
