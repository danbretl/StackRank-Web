import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitCohortLTrancheDigest, summarizePortraitCohortL, validatePortraitCohortL } from '../scripts/dog-portrait-cohort-l.mjs';
const hash = 'a'.repeat(64), binding = { path: '/private/evidence.json', sha256: hash, bytes: 20 };
const authority = { cohortId: 'dogs-portraits-l', authority: 'direct-user-instruction', answer: 'Yes—use the rolling queue and finish all 100', targetAdditionalPublishedPairs: 100, baselinePublishedPairs: 602, sourceQualityPurposePreservationAndReleaseGatesUnchanged: true };
const seed = () => ({ schemaVersion: 1, cohortId: 'dogs-portraits-l', baseline: { baselinePairs: 602, catalogIdentities: 1239 }, targetAdditionalPairs: 100, qualificationReceipts: [{ ...binding, catalogId: 'VBO:0200469', generationAuthorized: false }], tranches: [], amendments: [], entries: {}, integrationBatches: [], publications: [], progress: { qualified: 1, generationCalls: 0, accepted: 0, integrated: 0, published: 0 } });
const policy = () => ({ mode: 'rolling-small', authority: 'direct-user-instruction', authorization: binding, minimumQualifiedPerTranche: 1, reservesRequired: false, targetAdditionalPublishedPairs: 100 });
const tranche = (id = 'l01', catalogIds = ['VBO:0200469']) => {
  const frozen = { schemaVersion: 1, cohortId: 'dogs-portraits-l', id, catalogIds, reserveCatalogIds: [], frozenAt: '2026-10-03T15:00:00Z', batchPolicy: policy(), members: catalogIds.map(catalogId => ({ catalogId, worker: 'B', qualification: binding })) };
  frozen.selectionSha256 = portraitCohortLTrancheDigest(frozen);
  const row = { id, catalogIds, reserveCatalogIds: [], frozenAt: frozen.frozenAt, freeze: binding, selectionSha256: frozen.selectionSha256 };
  Object.defineProperty(row, 'freezeBody', { value: frozen }); return row;
};
const freezes = c => Object.fromEntries(c.tranches.map(row => [row.id, row.freezeBody]));
const options = c => ({ batchingAuthorization: authority, trancheFreezes: freezes(c) });
test('L research ledger has no implicit generation authorization', () => assert.deepEqual(validatePortraitCohortL(seed()), []));
test('default minimum cannot be waived by a smaller tranche or unbound rolling claim', () => {
  const c = seed(); c.tranches = [tranche()];
  assert.ok(validatePortraitCohortL(c).some(message => message.includes('default tranche')));
  c.batchPolicy = policy(); assert.ok(validatePortraitCohortL(c).some(message => message.includes('direct-user')));
  assert.deepEqual(validatePortraitCohortL(c, options(c)), []);
  assert.ok(validatePortraitCohortL(c, { ...options(c), batchingAuthorization: { ...authority, sourceQualityPurposePreservationAndReleaseGatesUnchanged: false } }).length);
});
test('appending a tranche preserves earlier membership digest; changing old membership fails', () => {
  const c = seed(); c.batchPolicy = policy(); c.tranches = [tranche()];
  const old = c.tranches[0].selectionSha256;
  c.qualificationReceipts.push({ ...binding, catalogId: 'VBO:0201086', generationAuthorized: false });
  c.tranches.push(tranche('l02', ['VBO:0201086'])); c.progress = summarizePortraitCohortL(c);
  assert.equal(c.tranches[0].selectionSha256, old);
  assert.deepEqual(validatePortraitCohortL(c, options(c)), []);
  c.tranches[0].catalogIds = ['VBO:0201086'];
  assert.ok(validatePortraitCohortL(c, options(c)).some(message => message.includes('membership/authorization')));
});
test('L generation cannot be recorded without exact packet/tranche and attempt approval gates', () => {
  const c = seed(); c.batchPolicy = policy(); c.tranches = [tranche()];
  c.entries['VBO:0200469'] = { catalogId: 'VBO:0200469', displayName: 'Markiesje', preparation: { packet: binding, peer: binding, trancheId: 'l01', trancheSha256: c.tranches[0].selectionSha256 }, qualification: binding, generation: { attempts: [{ id: 'attempt1', number: 1, status: 'generated', qaDecision: 'accepted', prompt: 'missing approval' }] }, profile: { status: 'approved', author: 'B', reviewer: 'B' }, reference: { status: 'approved' }, qa: { status: 'approved' } };
  c.progress = summarizePortraitCohortL(c);
  const errors = validatePortraitCohortL(c, options(c));
  assert.ok(errors.some(message => message.includes('approval/preflight')));
  assert.ok(errors.some(message => message.includes('independent exact')));
  assert.ok(errors.some(message => message.includes('whole-native')));
});

test('a release can publish an ordered subset while later frozen members remain unfinished', async () => {
  const { createHash } = await import('node:crypto');
  const c = seed(), ids = ['VBO:0200469', 'VBO:0201086'];
  c.batchPolicy = policy(); c.qualificationReceipts.push({ ...binding, catalogId: ids[1], generationAuthorized: false }); c.tranches = [tranche('l01', ids)];
  const prompt = 'Exact approved L portrait prompt';
  const attempt = { id: 'attempt1', number: 1, status: 'generated', qaDecision: 'accepted', receipt: binding, approval: binding, preflight: binding, imagePermitId: 'permit1', trancheSha256: c.tranches[0].selectionSha256, prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'), promptTemplateVersion: 'dogs-field-guide-v9-cohort-l', native: binding, originalOutputSha256: hash, originalOutputPath: '/native.png', width: 1536, height: 1024 };
  c.entries[ids[0]] = { catalogId: ids[0], displayName: 'Markiesje', preparation: { packet: binding, peer: binding, trancheId: 'l01', trancheSha256: c.tranches[0].selectionSha256 }, qualification: binding, reference: { status: 'approved' }, profile: { status: 'approved', author: 'B', reviewer: 'C', summarySha256: hash, shortDescriptionSha256: hash }, generation: { acceptedAttemptId: 'attempt1', attempts: [attempt] }, qa: { status: 'approved', rootReview: binding, breedIdentity: 'Read', anatomy: 'Read', crop: 'Read', aesthetics: 'Read' }, integration: { status: 'integrated', subwave: 'l02', batchManifest: 'data/dogs/generated-artwork-batch-l02.json' } };
  c.integrationBatches = [{ subwave: 'l02', trancheId: 'l01', trancheSha256: c.tranches[0].selectionSha256, catalogIds: [ids[0]], count: 1, batchManifest: 'data/dogs/generated-artwork-batch-l02.json', contactSheet: binding, rootRelease: binding }]; c.progress = summarizePortraitCohortL(c);
  assert.deepEqual(validatePortraitCohortL(c, options(c)), []);
  c.integrationBatches.push({ ...c.integrationBatches[0], subwave: 'l03', batchManifest: 'data/dogs/generated-artwork-batch-l03.json' });
  assert.ok(validatePortraitCohortL(c, options(c)).some(message => message.includes('ordered disjoint')));
});
