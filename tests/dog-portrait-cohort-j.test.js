import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { jDigest, portraitCohortJSelectionDigest, activeCohortJIds, summarizePortraitCohortJ, validatePortraitCohortJ } from '../scripts/dog-portrait-cohort-j.mjs';
const seed=JSON.parse(await readFile(new URL('../data/dogs/portrait-cohort-j.json',import.meta.url),'utf8'));
const baseline=()=>{const c=structuredClone(seed); c.amendments=[];c.reserveAssessments={};c.integrationBatches=[];c.publicationMilestones=[];c.entries=Object.fromEntries(c.primary.map(p=>[p.catalogId,{catalogId:p.catalogId,reference:{status:'pending'},scene:{status:'pending'},profile:{status:'pending'},generation:{status:'pending',acceptedAttemptId:null,attempts:[]},qa:{status:'pending'},integration:{status:'pending'},publication:{status:'pending'}}]));c.progress=summarizePortraitCohortJ(c);return c;};
const refresh=c=>(c.progress=summarizePortraitCohortJ(c),c);
const hash='a'.repeat(64),date='2026-10-01T07:00:00Z';
const prepared=c=>{const e=c.entries[c.primary[0].catalogId];e.reference={status:'worker-approved',assetId:'private-reference',originalPath:'original.jpg',filePageWikitextPath:'pinned.txt',filePageWikitextSha256:hash,metadataPath:'metadata.json',metadataSha256:hash,sourcePage:'https://commons.wikimedia.org/wiki/File:Exact_adult.jpg',sourceSha256:hash,visualReview:'Individual native adult reference read.',rightsReview:'Pinned own work, creator and exact license read.',sourcePageRevision:{id:123,timestamp:date},purposes:{uiDisplayAllowed:false,publicSnapshotAllowed:false,rasterExportAllowed:false}};e.scene={status:'worker-ready',description:'An open natural meadow.',rationale:'Documented regional field work.',sources:[{url:'https://www.fci.be/standard.pdf'}]};e.profile={status:'draft',shortDescription:'An individually researched character note with distinct historical context and supported working habits.',sourceSnapshots:[{url:'https://www.fci.be/standard.pdf',snapshotPath:'primary.pdf',snapshotSha256:hash,evidence:'Specific behavior and work claims read.'}]};return e;};
const generated=e=>{const prompt='Exact individually approved morphology and scene; native1536x1024 landscape.';e.generation.status='staged';e.generation.attempts=[{id:'j01-b-0200041-01',number:1,status:'generated',qaDecision:'pending',startedAt:date,completedAt:date,prompt,promptSha256:createHash('sha256').update(prompt).digest('hex'),referenceInputSha256:hash,referenceInputPath:'original.jpg',agentModel:'gpt-6.1-sol',reasoningEffort:'high',imageGenerator:'built-in imagegen',imageModel:'undisclosed',masterPath:'assets/dogs/generated-masters/cohort-j/j01-b/native.png',masterSha256:hash,originalOutputSha256:hash,originalOutputPath:'/native-tool-output.png',width:1536,height:1024}];};

test('J keeps its250-identity order and500→750 baseline independent of older cohorts',()=>{const c=baseline();assert.equal(c.selectionSha256,'3939e68cd9af8d6eb22728c7e243ca90f9208a904ff5d286e5ac41ea4733fde0');assert.deepEqual(validatePortraitCohortJ(c),[]);assert.equal(c.primary.length,250);assert.equal(c.reserves.length,61);assert.equal(c.primary[249].subwave,'j10');assert.equal(c.progress.acceptedPairCount,0);assert.equal(c.progress.remainingCount,250);});
test('J frozen selection rejects identity, order, baseline and purpose drift',()=>{for(const mutate of [c=>c.primary.reverse(),c=>c.baseline.illustratedCount=499,c=>c.selectionPolicy.referencePurposes.uiDisplayAllowed=true]){const c=baseline();mutate(c);assert.ok(validatePortraitCohortJ(c).length);}});
test('a prepared packet requires preserved pinned metadata and primary source snapshots',()=>{const c=baseline(),e=prepared(c);assert.deepEqual(validatePortraitCohortJ(refresh(c)),[]);delete e.reference.metadataSha256;assert.ok(validatePortraitCohortJ(c).some(s=>/acquisition metadata/.test(s)));e.reference.metadataSha256=hash;delete e.profile.sourceSnapshots;assert.ok(validatePortraitCohortJ(c).some(s=>/source snapshots/.test(s)));});
test('generated attempts require exact prompt hash, actual6.1operator, source gate and native unaltered output',()=>{const c=baseline(),e=prepared(c);generated(e);assert.deepEqual(validatePortraitCohortJ(refresh(c)),[]);for(const [key,value] of [['promptSha256','b'.repeat(64)],['agentModel','gpt-6-sol'],['width',1500],['originalOutputSha256','b'.repeat(64)]]){const prior=e.generation.attempts[0][key];e.generation.attempts[0][key]=value;assert.ok(validatePortraitCohortJ(c).length,key);e.generation.attempts[0][key]=prior;}e.reference.status='pending';assert.ok(validatePortraitCohortJ(c).some(s=>/qualified reference/.test(s)));});
test('reference and output attempts never count as an accepted complete pair',()=>{const c=baseline(),e=prepared(c);generated(e);assert.equal(summarizePortraitCohortJ(c).generationCallCount,1);assert.equal(summarizePortraitCohortJ(c).acceptedPairCount,0);e.qa.status='approved';assert.ok(validatePortraitCohortJ(refresh(c)).some(s=>/complete pair|required/.test(s)));});
test('reserve activation requires a real hold and a hash-chained next eligible reserve',()=>{const c=baseline(),id=c.primary[0].catalogId,r=c.reserves[0];c.entries[id].hold={status:'blocked',reason:'Exact adult original source chain unresolved.',evidencePaths:['blocked.json']};c.entries[r.catalogId]={...structuredClone(c.entries[id]),catalogId:r.catalogId};delete c.entries[r.catalogId].hold;const a={sequence:1,previousSha256:c.selectionSha256,blockedCatalogId:id,activatedCatalogId:r.catalogId,recordedAt:date,reason:'Source cannot qualify; first eligible reserve activated.',evidencePaths:['blocked.json']};a.sha256=jDigest(a);c.amendments.push(a);assert.equal(activeCohortJIds(c)[0],r.catalogId);assert.deepEqual(validatePortraitCohortJ(refresh(c)),[]);c.amendments[0].activatedCatalogId=c.reserves[1].catalogId;assert.ok(validatePortraitCohortJ(c).some(s=>/chain|next eligible/.test(s)));});
test('all preceding ineligible reserves need dated evidence instead of silent skipping',()=>{const c=baseline(),id=c.primary[0].catalogId,r=c.reserves[1];c.entries[id].hold={status:'blocked',reason:'Source block.',evidencePaths:['blocked.json']};c.entries[r.catalogId]={...structuredClone(c.entries[id]),catalogId:r.catalogId};delete c.entries[r.catalogId].hold;const a={sequence:1,previousSha256:c.selectionSha256,blockedCatalogId:id,activatedCatalogId:r.catalogId,recordedAt:date,reason:'Reserve1 also source-blocked; reserve2 eligible.',evidencePaths:['blocked.json']};a.sha256=jDigest(a);c.amendments.push(a);assert.ok(validatePortraitCohortJ(refresh(c)).some(s=>/next eligible/.test(s)));c.reserveAssessments[c.reserves[0].catalogId]={status:'blocked',reason:'No exact adult morphology original found.',evidencePaths:['reserve1.json']};assert.deepEqual(validatePortraitCohortJ(c),[]);});
test('independent profile review cannot be supplied by the original writer',()=>{const c=baseline(),e=prepared(c);e.profile={...e.profile,status:'approved',sourcePath:'profile-refresh-j01.json',summarySha256:hash,author:'writer-b',reviewer:'writer-b',reviewNotes:'Review.'};assert.ok(validatePortraitCohortJ(refresh(c)).some(s=>/independent sourced profile/.test(s)));});
test('counts cannot become publication without integration and a deployment receipt',()=>{const c=baseline(),e=c.entries[c.primary[0].catalogId];e.publication.status='published';assert.ok(validatePortraitCohortJ(refresh(c)).some(s=>/publication receipt/.test(s)));});

function releaseFixture() {
  const c=baseline(), ids=[...c.primary.slice(0,19),c.primary[25]].map(p=>p.catalogId);
  const compiled={profiles:{}};
  for(const id of ids){
    const e=structuredClone(prepared(baseline())); e.catalogId=id; generated(e);
    e.reference.status='approved';e.reference.primaryReviewedAt=date;e.scene.status='ready';
    e.profile={...e.profile,status:'approved',sourcePath:'profile-refresh-j01.json',summarySha256:jDigest('Approved individual summary.'),shortDescriptionSha256:jDigest(e.profile.shortDescription),author:'writer',reviewer:'independent',reviewNotes:'Claims and both texts read.'};
    const a=e.generation.attempts[0];a.id=id+'-01';a.qaDecision='accepted';e.generation.status='accepted';e.generation.acceptedAttemptId=a.id;
    e.qa={status:'approved',primaryFullResolutionViewed:true,workerFullResolutionViewed:true,reviewedAt:date,breedIdentity:'Exact identity.',anatomy:'Coherent four paws.',crop:'Whole tail and body.',aesthetics:'Natural editorial scene.',contactSheetPath:'release.jpg'};
    e.preparation={subwave:c.primary.find(p=>p.catalogId===id).subwave};
    e.integration={status:'integrated',subwave:'j01',batchManifest:'data/dogs/generated-artwork-batch-j01.json',integratedAt:date};
    c.entries[id]=e;compiled.profiles[id]={reviewStatus:'editor-reviewed',summary:'Approved individual summary.',shortDescription:e.profile.shortDescription};
  }
  c.integrationBatches=[{subwave:'j01',batchManifest:'data/dogs/generated-artwork-batch-j01.json',integratedAt:date,count:ids.length,catalogIds:ids}];
  return {c:refresh(c),compiled,ids};
}
test('recorded releases can span frozen preparation groups without rewriting that selection',()=>{
  const {c,compiled,ids}=releaseFixture();assert.deepEqual(validatePortraitCohortJ(c,{profiles:compiled}),[]);
  const e=c.entries[ids.at(-1)];assert.equal(e.preparation.subwave,'j02');assert.equal(e.integration.subwave,'j01');
  e.preparation.subwave='j01';assert.ok(validatePortraitCohortJ(c).some(s=>/preparation membership/.test(s)));
});
test('release membership rejects missing, duplicate and unintegrated identities',()=>{
  for(const mutate of [c=>c.integrationBatches=[],c=>c.integrationBatches[0].catalogIds.push(c.integrationBatches[0].catalogIds[0]),c=>c.entries[c.integrationBatches[0].catalogIds[0]].integration.status='pending']){
    const {c}=releaseFixture();mutate(c);assert.ok(validatePortraitCohortJ(refresh(c)).length);
  }
});
test('compiled short prose must match the independently approved text and digest',()=>{
  const {c,compiled,ids}=releaseFixture();assert.deepEqual(validatePortraitCohortJ(c,{profiles:compiled}),[]);
  compiled.profiles[ids[0]].shortDescription='Unsupported replacement copy.';
  assert.ok(validatePortraitCohortJ(c,{profiles:compiled}).some(s=>/full\/short description mismatch/.test(s)));
});
