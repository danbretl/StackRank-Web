import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { portraitCohortMTrancheDigest, summarizePortraitCohortM, validatePortraitCohortM } from '../scripts/dog-portrait-cohort-m.mjs';
const hash = 'a'.repeat(64), binding = { path: '/private/evidence.json', sha256: hash, bytes: 20 };
const authority = { cohortId: 'dogs-portraits-m', authority: 'direct-user-instruction', approved: true, starterPrompt: binding, sourcePolicy: binding, minimumQualifiedPerTranche: 1, reservesRequired: false, targetAdditionalPublishedPairs: 100, baselinePublishedPairs: 702, sourceQualityPurposePreservationAndReleaseGatesUnchanged: true };
const seed = () => ({ schemaVersion: 1, cohortId: 'dogs-portraits-m', baseline: { baselinePairs: 702, catalogIdentities: 1239 }, targetAdditionalPairs: 100, qualificationReceipts: [{ ...binding, catalogId: 'VBO:0200469', generationAuthorized: false }], tranches: [], amendments: [], entries: {}, integrationBatches: [], publications: [], progress: { qualified: 1, generationCalls: 0, accepted: 0, integrated: 0, published: 0 } });
const policy = () => ({ mode: 'rolling-small', authority: 'direct-user-instruction', authorization: binding, minimumQualifiedPerTranche: 1, reservesRequired: false, targetAdditionalPublishedPairs: 100 });
const tranche = (id = 'm01', catalogIds = ['VBO:0200469']) => {
  const frozen = { schemaVersion: 1, cohortId: 'dogs-portraits-m', id, catalogIds, reserveCatalogIds: [], frozenAt: '2026-10-03T15:00:00Z', batchPolicy: policy(), members: catalogIds.map(catalogId => ({ catalogId, worker: 'B', qualification: binding })) };
  frozen.selectionSha256 = portraitCohortMTrancheDigest(frozen);
  const row = { id, catalogIds, reserveCatalogIds: [], frozenAt: frozen.frozenAt, freeze: binding, selectionSha256: frozen.selectionSha256 };
  Object.defineProperty(row, 'freezeBody', { value: frozen }); return row;
};
const freezes = c => Object.fromEntries(c.tranches.map(row => [row.id, row.freezeBody]));
const options = c => ({ batchingAuthorization: authority, trancheFreezes: freezes(c) });
test('M original authorization permits one qualified identity with no separate amendment', () => {
 const c=seed(); c.batchPolicy=policy(); c.tranches=[tranche()];
 assert.deepEqual(validatePortraitCohortM(c, options(c)), []);
 assert.ok(validatePortraitCohortM(c).length);
 assert.ok(validatePortraitCohortM(c, {...options(c), batchingAuthorization:{...authority, approved:false}}).length);
 assert.ok(validatePortraitCohortM(c, {...options(c), batchingAuthorization:{...authority, baselinePublishedPairs:602}}).length);
});
test('appending a tranche preserves earlier membership digest; changing old membership fails', () => {
  const c = seed(); c.batchPolicy = policy(); c.tranches = [tranche()];
  const old = c.tranches[0].selectionSha256;
  c.qualificationReceipts.push({ ...binding, catalogId: 'VBO:0201086', generationAuthorized: false });
  c.tranches.push(tranche('m02', ['VBO:0201086'])); c.progress = summarizePortraitCohortM(c);
  assert.equal(c.tranches[0].selectionSha256, old);
  assert.deepEqual(validatePortraitCohortM(c, options(c)), []);
  c.tranches[0].catalogIds = ['VBO:0201086'];
  assert.ok(validatePortraitCohortM(c, options(c)).some(message => message.includes('membership/authorization')));
});
test('L generation cannot be recorded without exact packet/tranche and attempt approval gates', () => {
  const c = seed(); c.batchPolicy = policy(); c.tranches = [tranche()];
  c.entries['VBO:0200469'] = { catalogId: 'VBO:0200469', displayName: 'Markiesje', preparation: { packet: binding, peer: binding, trancheId: 'm01', trancheSha256: c.tranches[0].selectionSha256 }, qualification: binding, generation: { attempts: [{ id: 'attempt1', number: 1, status: 'generated', qaDecision: 'accepted', prompt: 'missing approval' }] }, profile: { status: 'approved', author: 'B', reviewer: 'B' }, reference: { status: 'approved' }, qa: { status: 'approved' } };
  c.progress = summarizePortraitCohortM(c);
  const errors = validatePortraitCohortM(c, options(c));
  assert.ok(errors.some(message => message.includes('approval/preflight')));
  assert.ok(errors.some(message => message.includes('independent exact')));
  assert.ok(errors.some(message => message.includes('whole-native')));
});

test('a release can publish an ordered subset while later frozen members remain unfinished', async () => {
  const { createHash } = await import('node:crypto');
  const c = seed(), ids = ['VBO:0200469', 'VBO:0201086'];
  c.batchPolicy = policy(); c.qualificationReceipts.push({ ...binding, catalogId: ids[1], generationAuthorized: false }); c.tranches = [tranche('m01', ids)];
  const prompt = 'Exact approved L portrait prompt';
  const attempt = { id: 'attempt1', number: 1, status: 'generated', qaDecision: 'accepted', receipt: binding, approval: binding, preflight: binding, imagePermitId: 'permit1', trancheSha256: c.tranches[0].selectionSha256, prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'), promptTemplateVersion: 'dogs-field-guide-v9-cohort-m', native: binding, originalOutputSha256: hash, originalOutputPath: '/native.png', width: 1536, height: 1024 };
  c.entries[ids[0]] = { catalogId: ids[0], displayName: 'Markiesje', preparation: { packet: binding, peer: binding, trancheId: 'm01', trancheSha256: c.tranches[0].selectionSha256 }, qualification: binding, reference: { status: 'approved' }, profile: { status: 'approved', author: 'B', reviewer: 'C', summarySha256: hash, shortDescriptionSha256: hash }, generation: { acceptedAttemptId: 'attempt1', attempts: [attempt] }, qa: { status: 'approved', rootReview: binding, breedIdentity: 'Read', anatomy: 'Read', crop: 'Read', aesthetics: 'Read' }, integration: { status: 'integrated', subwave: 'm02', batchManifest: 'data/dogs/generated-artwork-batch-m02.json' } };
  c.integrationBatches = [{ subwave: 'm02', trancheId: 'm01', trancheSha256: c.tranches[0].selectionSha256, catalogIds: [ids[0]], count: 1, batchManifest: 'data/dogs/generated-artwork-batch-m02.json', contactSheet: binding, rootRelease: binding }]; c.progress = summarizePortraitCohortM(c);
  assert.deepEqual(validatePortraitCohortM(c, options(c)), []);
  c.integrationBatches.push({ ...c.integrationBatches[0], subwave: 'm03', batchManifest: 'data/dogs/generated-artwork-batch-m03.json' });
  assert.ok(validatePortraitCohortM(c, options(c)).some(message => message.includes('ordered disjoint')));
});

test('qualified replacements preserve frozen holds and the 100-published-pair target', () => {
  const c = seed(), ids = Array.from({ length: 101 }, (_, n) => `VBO:${String(200000 + n).padStart(7, '0')}`);
  c.batchPolicy = policy();
  c.qualificationReceipts = ids.map(catalogId => ({ ...binding, catalogId, generationAuthorized: false }));
  c.tranches = [tranche('m01', ids.slice(0, 100)), tranche('m101', ids.slice(100))];
  c.progress = summarizePortraitCohortM(c);
  assert.ok(validatePortraitCohortM(c, options(c)).some(message => message.includes('exceeds100')));
  const old = ids[0], replacement = ids[100], prompt = 'Exact failed portrait prompt';
  c.entries[old] = { catalogId: old, displayName: 'Held dog', qualification: binding,
    preparation: { packet: binding, peer: binding, trancheId: 'm01', trancheSha256: c.tranches[0].selectionSha256 },
    profile: { status: 'approved', author: 'A', reviewer: 'B', summarySha256: hash, shortDescriptionSha256: hash }, reference: { status: 'approved' },
    generation: { attempts: [{ number: 1, id: 'attempt1', status: 'generated', qaDecision: 'rejected', receipt: binding, approval: binding, preflight: binding,
      imagePermitId: 'permit1', trancheSha256: c.tranches[0].selectionSha256, prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'),
      promptTemplateVersion: 'dogs-field-guide-v9-cohort-m', native: binding, originalOutputSha256: hash, originalOutputPath: '/native.png', rejectionReason: 'Tail incomplete' }] },
    qa: { status: 'rejected' }, integration: { status: 'held' }, publication: { status: 'held' }, hold: { status: 'held', receipt: binding, reason: 'Tail incomplete' } };
  const body = { type: 'qualified-hold-replacement', at: '2026-10-03T22:00:00Z', heldCatalogId: old, replacementCatalogId: replacement,
    holdReceipt: binding, replacementQualification: binding, replacementTrancheId: 'm101', replacementTrancheSha256: c.tranches[1].selectionSha256 };
  c.amendments.push({ ...body, receipt: binding }); c.progress = summarizePortraitCohortM(c);
  const opts = { ...options(c), replacementReceipts: { [hash]: body } };
  const frozenDigest = c.tranches[0].selectionSha256;
  assert.deepEqual(validatePortraitCohortM(c, opts), []);
  assert.deepEqual(c.progress, { qualified: 101, generationCalls: 1, accepted: 0, integrated: 0, published: 0 });
  assert.equal(c.tranches[0].selectionSha256, frozenDigest);
  assert.ok(validatePortraitCohortM(c, options(c)).some(message => message.includes('immutable amendment')));
  c.amendments[0].replacementQualification = { ...binding, sha256: 'b'.repeat(64) };
  assert.ok(validatePortraitCohortM(c, opts).some(message => message.includes('genuinely qualified')));
  c.amendments[0].replacementQualification = binding;
  c.amendments.push({ ...c.amendments[0] });
  assert.ok(validatePortraitCohortM(c, opts).some(message => message.includes('exactly once')));
  c.amendments.pop(); c.entries[old].publication.status = 'published';
  assert.ok(validatePortraitCohortM(c, opts).some(message => message.includes('held generation cannot')));
});
