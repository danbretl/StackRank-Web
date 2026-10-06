import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ARTWORK_CORRECTION_PATH, applyDogArtworkCorrections, verifyDogArtworkCorrectionEvidence } from '../scripts/dog-artwork-corrections.mjs';
import { artworkGenerationRecord } from '../lib/dogs-artwork-review.js';
import { N_SOURCE_AUTH_SHA256, validCorrectionTextOnlyEvidence } from '../scripts/dog-portrait-source-policy.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const document = JSON.parse(await fs.readFile(path.join(root, ARTWORK_CORRECTION_PATH)));
const historical = (await Promise.all(['e08', 'l21'].map(async batch => JSON.parse(await fs.readFile(path.join(root, `data/dogs/generated-artwork-batch-${batch}.json`)))))).flatMap(batch => batch.images);

test('artwork corrections replace exact historical targets without mutating history or expanding IDs', () => {
  const frozen = structuredClone(historical);
  const result = applyDogArtworkCorrections(historical, document);
  assert.deepEqual(historical, frozen);
  assert.deepEqual(result.map(x => x.catalogId), historical.map(x => x.catalogId));
  assert.equal(result.filter(x => document.images.includes(x)).length, 2);
  for (const entry of document.images) assert.equal(result.find(x => x.catalogId === entry.catalogId), entry);
});

test('artwork corrections reject stale paths, hashes, ambiguous targets and overwrite attempts', () => {
  for (const change of [x => x.replacesGeneratedPath += '.wrong', x => x.replacesMasterSha256 = 'f'.repeat(64), x => x.generatedPath = x.replacesGeneratedPath, x => x.qa.leadContactSheetViewed = false, x => x.prompt += 'changed']) {
    const invalid = structuredClone(document); change(invalid.images[0]);
    assert.throws(() => applyDogArtworkCorrections(historical, invalid));
  }
  assert.throws(() => applyDogArtworkCorrections([...historical, historical.find(x => x.catalogId === document.images[0].catalogId)], document), /ambiguous/);
  assert.throws(() => applyDogArtworkCorrections(historical, {...document, images: [...document.images, document.images[0]]}), /ambiguous/);
});

test('correction authority is fresh, text-only and binds committed exact approval bytes', async () => {
  for (const entry of document.images) await verifyDogArtworkCorrectionEvidence(root, entry);
  const evidence = structuredClone(document.images[0].referenceEvidence);
  assert.equal(validCorrectionTextOnlyEvidence(evidence), true);
  evidence.sourcePolicyAuthorization.sha256 = N_SOURCE_AUTH_SHA256;
  assert.equal(validCorrectionTextOnlyEvidence(evidence), false);
  evidence.sourcePolicyAuthorization.sha256 = document.images[0].referenceEvidence.sourcePolicyAuthorization.sha256;
  evidence.imageInputs.push({path:'unreviewed.jpg'});
  assert.equal(validCorrectionTextOnlyEvidence(evidence), false);
});

test('evidence mutation and escaped paths fail before corrected asset is admitted', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dog-correction-test-'));
  try {
    await fs.cp(path.join(root, 'notes/testing/dogs-audit-corrections/artwork'), path.join(temp, 'notes/testing/dogs-audit-corrections/artwork'), {recursive:true});
    const entry = document.images[0];
    await fs.appendFile(path.join(temp, entry.referenceEvidence.researchDossier.path), ' ');
    await assert.rejects(verifyDogArtworkCorrectionEvidence(temp, entry), /changed correction evidence/);
    const invalid = structuredClone(entry); invalid.referenceEvidence.rootApproval.path = '/private/not-allowed.json';
    await assert.rejects(verifyDogArtworkCorrectionEvidence(root, invalid), /unsafe evidence path/);
  } finally { await fs.rm(temp, {recursive:true,force:true}); }
});

test('reviewer selects native-specific correction metadata and never silently uses superseded prompt', () => {
  const corrected = document.images[0], old = historical.find(x => x.catalogId === corrected.catalogId);
  assert.equal(artworkGenerationRecord([old, corrected], corrected), corrected);
  assert.equal(artworkGenerationRecord([old], corrected), null);
  assert.equal(artworkGenerationRecord([{...old, generatedAt:corrected.generatedAt}], corrected), null);
  assert.equal(artworkGenerationRecord([old], old), old);
});

test('only the four superseded portrait variants are excluded while original files remain', async () => {
  const contract = JSON.parse(await fs.readFile(path.join(root, 'deploy/public-files.json')));
  const superseded = contract.excluded.filter(rule => rule.class === 'superseded-artwork');
  const expected = historical.filter(old => document.images.some(entry => entry.catalogId === old.catalogId))
    .flatMap(old => [320,960].map(width => `assets/dogs/generated/${path.basename(old.generatedPath,'.png')}-${width}.webp`));
  assert.deepEqual(superseded.map(rule => rule.pattern).sort(), expected.sort());
  for (const name of expected) assert.ok((await fs.stat(path.join(root,name))).isFile());
  for (const entry of document.images) for (const variant of entry.variants) assert.ok(!superseded.some(rule => rule.pattern === variant.url));
});
