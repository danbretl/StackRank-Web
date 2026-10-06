import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { completedDogCatalogIds } from '../lib/dogs-public-visibility.js';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const receipt = read('notes/testing/dogs-audit-corrections/applied-profile-fields.json');
const continuation = read('notes/testing/dogs-completed-holds-resolution/resolution-ledger.json');
const followById = new Map(continuation.decisions.map(row => [row.catalogId, row]));
const catalog = read('data/dogs/dog-catalog.json');
const profiles = read('data/dogs/breed-profiles.json');
const artwork = read('data/dogs/generated-artwork.json');
const publicIds = completedDogCatalogIds({entities: catalog.entities, profiles, artwork});

test('accepted correction fields reach authoring and compiled profiles without stale N overwrite', () => {
  const final = new Map(receipt.fields.map(row => [`${row.catalogId}/${row.field}`, row]));
  const compiledFields = new Set(['summary','shortDescription','interestingFact','historicalRoots','sizeBand','originRegions','originBasis','typeLabel','typeBasis']);
  for (const row of final.values()) {
    const authored = read(row.file).profiles[row.catalogId];
    assert.deepEqual(authored[row.field], followById.get(row.catalogId)?.afterProfile[row.field] ?? row.newValue, `${row.catalogId} authored ${row.field}`);
    if (compiledFields.has(row.field)) assert.deepEqual(profiles.profiles[row.catalogId][row.field], followById.get(row.catalogId)?.afterProfile[row.field] ?? row.newValue, `${row.catalogId} compiled ${row.field}`);
  }
});

test('combined N and audit release retains all completion evidence while enforcing each evidence hold', () => {
  const coverage = read('notes/testing/dogs-audit-corrections/evidence/coverage-index.json');
  assert.equal(coverage.originalAuditTotals.allFindings, 81);
  assert.equal(coverage.originalAuditTotals.openIssues, 19);
  assert.equal(coverage.reviewCoverage.NProfiles, 100);
  assert.equal(coverage.reviewCoverage.NPortraits, 100);
  assert.equal(catalog.entities.length, 1239);
  assert.equal(artwork.assets.length, 902);
  assert.equal(publicIds.size, continuation.counts.public);
  for (const row of read('notes/testing/dogs-audit-corrections/evidence/cross-evidence-holds.json')) {
    assert.equal(publicIds.has(row.id), followById.get(row.id)?.disposition === 'restored', row.id);
    assert.equal(profiles.profiles[row.id].reviewStatus, 'editor-reviewed', row.id);
    assert.ok(artwork.assets.some(asset => asset.catalogId === row.id && asset.review.status === 'approved'), row.id);
  }
  assert.ok(publicIds.has('VBO:0200027'));
  assert.ok(publicIds.has('VBO:0200590'));
  assert.ok(publicIds.has('VBO:0201117'));
  assert.ok(publicIds.has('VBO:0201363'));
  assert.ok(!publicIds.has('VBO:0200734'));
  assert.ok(!publicIds.has('VBO:0200390'));
  assert.ok(!publicIds.has('VBO:0201430'));
});
