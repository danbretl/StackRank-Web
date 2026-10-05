import { N_SOURCE_AUTH_SHA256, SOURCE_POLICY } from '../scripts/dog-portrait-source-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { portraitCohortNTrancheDigest, summarizePortraitCohortN, validatePortraitCohortN } from '../scripts/dog-portrait-cohort-n.mjs';
const hash = 'a'.repeat(64), binding = { path: '/private/evidence.json', sha256: hash, bytes: 20 };
const reference = () => ({mode:'text-only',status:'approved',policyVersion:SOURCE_POLICY,sourcePolicyAuthorization:{...binding,sha256:N_SOURCE_AUTH_SHA256},researchDossier:binding,imageInputs:[],rootMorphologyEvidenceRead:true,rootIdentityApproved:true,rootSourceUseApproved:true,purposes:{uiDisplayAllowed:false,publicSnapshotAllowed:false,rasterExportAllowed:false}});
const authority = { cohortId: 'dogs-portraits-n', authority: 'direct-user-instruction', approved: true, publicationAuthorized: false, integrationRequiresLaterUserInstruction: true, starterPrompt: binding, sourcePolicy: binding, minimumQualifiedPerTranche: 1, reservesRequired: false, targetAdditionalAcceptedPairs: 100, baselinePublishedPairs: 802, sourceQualityPurposePreservationAndReleaseGatesUnchanged: true };
const seed = () => ({ schemaVersion: 1, cohortId: 'dogs-portraits-n', baseline: { baselinePairs: 802, catalogIdentities: 1239 }, targetAdditionalPairs: 100, qualificationReceipts: [{ ...binding, catalogId: 'VBO:0200469', generationAuthorized: false }], tranches: [], amendments: [], entries: {}, integrationBatches: [], publications: [], progress: { qualified: 1, generationCalls: 0, accepted: 0, integrated: 0, published: 0 } });
const policy = () => ({ mode: 'rolling-small', authority: 'direct-user-instruction', authorization: binding, minimumQualifiedPerTranche: 1, reservesRequired: false, targetAdditionalAcceptedPairs: 100 });
const tranche = (id = 'n01', catalogIds = ['VBO:0200469']) => {
  const frozen = { schemaVersion: 1, cohortId: 'dogs-portraits-n', id, catalogIds, reserveCatalogIds: [], frozenAt: '2026-10-03T15:00:00Z', batchPolicy: policy(), members: catalogIds.map(catalogId => ({ catalogId, worker: 'B', qualification: binding })) };
  frozen.selectionSha256 = portraitCohortNTrancheDigest(frozen);
  const row = { id, catalogIds, reserveCatalogIds: [], frozenAt: frozen.frozenAt, freeze: binding, selectionSha256: frozen.selectionSha256 };
  Object.defineProperty(row, 'freezeBody', { value: frozen }); return row;
};
const freezes = c => Object.fromEntries(c.tranches.map(row => [row.id, row.freezeBody]));
const options = c => ({ baselineIds: Array.from({length:802}, (_,i)=>`baseline-${i}`), batchingAuthorization: authority, trancheFreezes: freezes(c) });
test('N original authorization permits one qualified identity with no separate amendment', () => {
 const c=seed(); c.batchPolicy=policy(); c.tranches=[tranche()];
 assert.deepEqual(validatePortraitCohortN(c, options(c)), []);
 assert.ok(validatePortraitCohortN(c).length);
 assert.ok(validatePortraitCohortN(c, {...options(c), batchingAuthorization:{...authority, approved:false}}).length);
 assert.ok(validatePortraitCohortN(c, {...options(c), batchingAuthorization:{...authority, baselinePublishedPairs:602}}).length);
});
test('appending a tranche preserves earlier membership digest; changing old membership fails', () => {
  const c = seed(); c.batchPolicy = policy(); c.tranches = [tranche()];
  const old = c.tranches[0].selectionSha256;
  c.qualificationReceipts.push({ ...binding, catalogId: 'VBO:0201086', generationAuthorized: false });
  c.tranches.push(tranche('n02', ['VBO:0201086'])); c.progress = summarizePortraitCohortN(c);
  assert.equal(c.tranches[0].selectionSha256, old);
  assert.deepEqual(validatePortraitCohortN(c, options(c)), []);
  c.tranches[0].catalogIds = ['VBO:0201086'];
  assert.ok(validatePortraitCohortN(c, options(c)).some(message => message.includes('membership/authorization')));
});
test('L generation cannot be recorded without exact packet/tranche and attempt approval gates', () => {
  const c = seed(); c.batchPolicy = policy(); c.tranches = [tranche()];
  c.entries['VBO:0200469'] = { catalogId: 'VBO:0200469', displayName: 'Markiesje', preparation: { packet: binding, peer: binding, trancheId: 'n01', trancheSha256: c.tranches[0].selectionSha256 }, qualification: binding, generation: { attempts: [{ id: 'attempt1', number: 1, status: 'generated', qaDecision: 'accepted', prompt: 'missing approval' }] }, profile: { status: 'approved', author: 'B', reviewer: 'B' }, reference: reference(), qa: { status: 'approved' } };
  c.progress = summarizePortraitCohortN(c);
  const errors = validatePortraitCohortN(c, options(c));
  assert.ok(errors.some(message => message.includes('approval/preflight')));
  assert.ok(errors.some(message => message.includes('independent exact')));
  assert.ok(errors.some(message => message.includes('whole-native')));
});

test('a release can publish an ordered subset while later frozen members remain unfinished', async () => {
  const { createHash } = await import('node:crypto');
  const c = seed(), ids = ['VBO:0200469', 'VBO:0201086'];
  c.batchPolicy = policy(); c.qualificationReceipts.push({ ...binding, catalogId: ids[1], generationAuthorized: false }); c.tranches = [tranche('n01', ids)];
  const prompt = 'Exact approved L portrait prompt';
  const attempt = { id: 'N-VBO:0200469-1', number: 1, status: 'generated', qaDecision: 'accepted', receipt: binding, approval: binding, preflight: binding, imagePermitId: 'permit1', trancheSha256: c.tranches[0].selectionSha256, prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'), promptTemplateVersion: 'dogs-field-guide-v11-cohort-n', native: binding, originalOutputSha256: hash, originalOutputPath: '/native.png', width: 1536, height: 1024 };
  c.entries[ids[0]] = { catalogId: ids[0], displayName: 'Markiesje', preparation: { packet: binding, peer: binding, trancheId: 'n01', trancheSha256: c.tranches[0].selectionSha256 }, qualification: binding, reference: reference(), profile: { status: 'approved', author: 'B', reviewer: 'C', summarySha256: hash, shortDescriptionSha256: hash }, generation: { acceptedAttemptId: 'N-VBO:0200469-1', attempts: [attempt] }, qa: { status: 'approved', rootReview: binding, breedIdentity: 'Read', anatomy: 'Read', crop: 'Read', aesthetics: 'Read' }, integration: { status: 'integrated', subwave: 'n02', batchManifest: 'data/dogs/generated-artwork-batch-n02.json' } };
  c.integrationBatches = [{ subwave: 'n02', trancheId: 'n01', trancheSha256: c.tranches[0].selectionSha256, catalogIds: [ids[0]], count: 1, batchManifest: 'data/dogs/generated-artwork-batch-n02.json', contactSheet: binding, rootRelease: binding }]; c.progress = summarizePortraitCohortN(c);
  assert.deepEqual(validatePortraitCohortN(c, options(c)), []);
  c.integrationBatches.push({ ...c.integrationBatches[0], subwave: 'n03', batchManifest: 'data/dogs/generated-artwork-batch-n03.json' });
  assert.ok(validatePortraitCohortN(c, options(c)).some(message => message.includes('ordered disjoint')));
});

test('qualified replacements preserve frozen holds and the 100-published-pair target', () => {
  const c = seed(), ids = Array.from({ length: 101 }, (_, n) => `VBO:${String(200000 + n).padStart(7, '0')}`);
  c.batchPolicy = policy();
  c.qualificationReceipts = ids.map(catalogId => ({ ...binding, catalogId, generationAuthorized: false }));
  c.tranches = [tranche('n01', ids.slice(0, 100)), tranche('n101', ids.slice(100))];
  c.progress = summarizePortraitCohortN(c);
  assert.ok(validatePortraitCohortN(c, options(c)).some(message => message.includes('exceeds100')));
  const old = ids[0], replacement = ids[100], prompt = 'Exact failed portrait prompt';
  c.entries[old] = { catalogId: old, displayName: 'Held dog', qualification: binding,
    preparation: { packet: binding, peer: binding, trancheId: 'n01', trancheSha256: c.tranches[0].selectionSha256 },
    profile: { status: 'approved', author: 'A', reviewer: 'B', summarySha256: hash, shortDescriptionSha256: hash }, reference: reference(),
    generation: { attempts: [{ number: 1, id: `N-${old}-1`, status: 'generated', qaDecision: 'rejected', receipt: binding, approval: binding, preflight: binding,
      imagePermitId: 'permit1', trancheSha256: c.tranches[0].selectionSha256, prompt, promptSha256: createHash('sha256').update(prompt).digest('hex'),
      promptTemplateVersion: 'dogs-field-guide-v11-cohort-n', native: binding, originalOutputSha256: hash, originalOutputPath: '/native.png', rejectionReason: 'Tail incomplete' }] },
    qa: { status: 'rejected' }, integration: { status: 'held' }, publication: { status: 'held' }, hold: { status: 'held', receipt: binding, reason: 'Tail incomplete' } };
  const body = { type: 'qualified-hold-replacement', at: '2026-10-03T22:00:00Z', heldCatalogId: old, replacementCatalogId: replacement,
    holdReceipt: binding, replacementQualification: binding, replacementTrancheId: 'n101', replacementTrancheSha256: c.tranches[1].selectionSha256 };
  c.amendments.push({ ...body, receipt: binding }); c.progress = summarizePortraitCohortN(c);
  const opts = { ...options(c), replacementReceipts: { [hash]: body } };
  const frozenDigest = c.tranches[0].selectionSha256;
  assert.deepEqual(validatePortraitCohortN(c, opts), []);
  assert.deepEqual(c.progress, { qualified: 101, generationCalls: 1, accepted: 0, integrated: 0, published: 0 });
  assert.equal(c.tranches[0].selectionSha256, frozenDigest);
  assert.ok(validatePortraitCohortN(c, options(c)).some(message => message.includes('immutable amendment')));
  c.amendments[0].replacementQualification = { ...binding, sha256: 'b'.repeat(64) };
  assert.ok(validatePortraitCohortN(c, opts).some(message => message.includes('genuinely qualified')));
  c.amendments[0].replacementQualification = binding;
  c.amendments.push({ ...c.amendments[0] });
  assert.ok(validatePortraitCohortN(c, opts).some(message => message.includes('exactly once')));
  c.amendments.pop(); c.entries[old].publication.status = 'published';
  assert.ok(validatePortraitCohortN(c, opts).some(message => message.includes('held generation cannot')));
});

test('N finality accepts100 archived tested local commits and forbids publication', () => {
  const c=seed(), ids=Array.from({length:100},(_,i)=>`VBO:${String(220000+i).padStart(7,'0')}`);
  c.batchPolicy=policy(); c.qualificationReceipts=ids.map(catalogId=>({...binding,catalogId,generationAuthorized:false})); c.tranches=[tranche('n01',ids)];
  const prompt='Exact approved N text-only prompt', digest=createHash('sha256').update(prompt).digest('hex');
  for (const id of ids) c.entries[id]={catalogId:id,displayName:'Test identity',qualification:binding,preparation:{packet:binding,peer:binding,trancheId:'n01',trancheSha256:c.tranches[0].selectionSha256},profile:{status:'approved',author:'A',reviewer:'B',summarySha256:hash,shortDescriptionSha256:hash},reference:reference(),generation:{acceptedAttemptId:`N-${id}-1`,attempts:[{number:1,id:`N-${id}-1`,status:'generated',qaDecision:'accepted',receipt:binding,approval:binding,preflight:binding,imagePermitId:`permit-${id}`,trancheSha256:c.tranches[0].selectionSha256,prompt,promptSha256:digest,promptTemplateVersion:'dogs-field-guide-v11-cohort-n',native:binding,originalOutputSha256:hash,originalOutputPath:'/native.png',width:1536,height:1024}]},qa:{status:'approved',rootReview:binding,breedIdentity:'Read',anatomy:'Read',crop:'Read',aesthetics:'Read'},integration:{status:'integrated',subwave:'n01',batchManifest:'data/dogs/generated-artwork-batch-n01.json'},publication:{status:'withheld'},archive:{manifest:binding},verification:{receipt:binding},commit:'c'.repeat(40)};
  c.integrationBatches=[{subwave:'n01',trancheId:'n01',trancheSha256:c.tranches[0].selectionSha256,catalogIds:ids,count:100,batchManifest:'data/dogs/generated-artwork-batch-n01.json',contactSheet:binding,rootRelease:binding}];
  c.status='READY_FOR_POST_AUDIT_INTEGRATION'; c.activePermits=0; c.workersIdle=true; c.progress=summarizePortraitCohortN(c);
  assert.deepEqual(validatePortraitCohortN(c,options(c)),[]);
  c.entries[ids[0]].publication={status:'published',receipt:binding};c.progress=summarizePortraitCohortN(c);
  assert.ok(validatePortraitCohortN(c,options(c)).some(e=>e.includes('withheld')));
  c.entries[ids[0]].publication={status:'withheld'};c.progress=summarizePortraitCohortN(c);delete c.entries[ids[0]].commit;
  assert.ok(validatePortraitCohortN(c,options(c)).some(e=>e.includes('local commit')));
});
