import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cohortDigest, portraitCohortFSelectionDigest, summarizePortraitCohortF, validatePortraitCohortF, activeCohortFIds } from '../scripts/dog-portrait-cohort-f.mjs';
const read = async name => JSON.parse(await readFile(new URL(`../data/dogs/${name}.json`, import.meta.url)));
const [frozen, catalog, rightsLedger, generatedArtwork, profiles] = await Promise.all(['portrait-cohort-f', 'dog-catalog', 'image-rights', 'generated-artwork', 'breed-profiles'].map(read));
const selectionHash = '0b3022a1a5de921fbc9974032ba105f8660b3b8b5611c902852754896caafc83';
function fixture() {
  const cohort = structuredClone(frozen);
  cohort.amendments = []; cohort.reserveAssessments = {}; cohort.entries = {};
  for (const {catalogId} of cohort.primary) cohort.entries[catalogId] = {catalogId, reference:{status:'pending'}, scene:{status:'pending'}, profile:{status:'pending'}, generation:{status:'pending', attempts:[]}, qa:{status:'pending'}, integration:{status:'pending'}, publication:{status:'pending'}};
  cohort.progress = summarizePortraitCohortF(cohort); return cohort;
}
function activate(cohort, reserveIndex = 0) {
  const blockedCatalogId = cohort.primary[0].catalogId, activatedCatalogId = cohort.reserves[reserveIndex].catalogId;
  cohort.entries[blockedCatalogId].hold = {status:'blocked', reason:'Exact adult identity unresolved', evidencePaths:['reports/exact-evidence.json']};
  cohort.entries[activatedCatalogId] = {...structuredClone(cohort.entries[cohort.primary[1].catalogId]), catalogId:activatedCatalogId};
  const amendment = {sequence:1, previousSha256:cohort.selectionSha256, blockedCatalogId, activatedCatalogId, recordedAt:'2026-09-23T00:00:00Z', reason:'Qualified replacement after documented hold', evidencePaths:['reports/exact-evidence.json']};
  cohort.amendments.push({...amendment, sha256:cohortDigest(amendment)});
  cohort.progress = summarizePortraitCohortF(cohort);
}
test('F retains 100 frozen primaries, ordered reserves, 20 E holds and exact baseline', () => {
  assert.equal(portraitCohortFSelectionDigest(frozen), selectionHash);
  assert.deepEqual(validatePortraitCohortF(frozen, {catalog,rightsLedger,generatedArtwork,profiles}), []);
  assert.equal(frozen.primary.length,100); assert.equal(frozen.reserves.length,74);
  assert.equal(frozen.primary.filter(x=>x.catalogStatus==='variety').length,25);
});
test('F progress edits preserve selection while pool reordering fails', () => {
  const c=fixture(); c.entries[c.primary[0].catalogId].preparation={status:'researching'};
  assert.equal(portraitCohortFSelectionDigest(c),selectionHash);
  [c.reserves[0],c.reserves[1]]=[c.reserves[1],c.reserves[0]];
  assert.ok(validatePortraitCohortF(c).some(x=>x.includes('digest mismatch')));
});
test('F reserve activation retains blocked evidence and exactly 100 active slots', () => {
  const c=fixture();activate(c);
  assert.deepEqual(validatePortraitCohortF(c,{catalog}),[]);
  assert.equal(activeCohortFIds(c).length,100);assert.equal(Object.keys(c.entries).length,101);
  assert.equal(c.progress.blockedCount,1);assert.equal(c.progress.remainingCount,100);
  c.entries[c.primary[0].catalogId].hold.status='pending';
  assert.ok(validatePortraitCohortF(c).some(x=>x.includes('active blocked')));
});
test('F reserves cannot skip eligible order or rewrite amendment evidence silently', () => {
  const c=fixture();activate(c,1);
  assert.ok(validatePortraitCohortF(c).some(x=>x.includes('next eligible')));
  c.reserveAssessments[c.reserves[0].catalogId]={status:'blocked',reason:'No qualifying exact reference',evidencePaths:['reports/reference-hold.json']};
  assert.deepEqual(validatePortraitCohortF(c),[]);
  c.amendments[0].reason='Changed';
  assert.ok(validatePortraitCohortF(c).some(x=>x.includes('chain mismatch')));
});
test('F cannot count a profile draft or unsupported image as an integrated published pair', () => {
  const c=fixture(),e=c.entries[c.primary[0].catalogId];
  e.integration.status='integrated';e.publication.status='published';c.progress=summarizePortraitCohortF(c);
  const errors=validatePortraitCohortF(c);
  assert.ok(errors.some(x=>x.includes('completed reviewed pairs')));
  assert.ok(errors.some(x=>x.includes('one exact accepted master')));
  assert.ok(errors.some(x=>x.includes('publication receipt')));
  assert.equal(c.progress.acceptedPairCount,0);
});
