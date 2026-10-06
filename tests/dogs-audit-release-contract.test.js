import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditReleaseInputs, validateDogsAuditRelease } from '../scripts/validate-dogs-audit-release.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const original = loadAuditReleaseInputs();
const fixture = () => structuredClone(original);
const rejects = (input, pattern) => {
  const result = validateDogsAuditRelease(input);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), pattern);
};

test('final N release contract accepts all100 with explicit corrections and preserved holds', () => {
  const result = validateDogsAuditRelease(fixture());
  assert.deepEqual(result.errors, []);
  assert.equal(result.integratedN, 100);
  assert.equal(result.reviewedN, 100);
  assert.equal(result.publicN + result.suppressedN, 100);
  assert.equal(result.privateSourceOrNativeBytesRevalidated, false);
});

test('release validation works with only tracked inputs and no private reports or masters', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'dogs-release-contract-'));
  try {
    loadAuditReleaseInputs({ readJson(file) {
      assert.match(file, /^(data\/dogs\/|notes\/testing\/(?:dogs-audit-corrections|dogs-completed-holds-resolution)\/)/);
      const target = path.join(destination, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const raw = fs.readFileSync(path.join(root, file), 'utf8');
      fs.writeFileSync(target, raw);
      return JSON.parse(raw);
    } });
    assert.equal(fs.existsSync(path.join(destination, 'reports')), false);
    assert.equal(fs.existsSync(path.join(destination, 'assets')), false);
    assert.deepEqual(validateDogsAuditRelease(loadAuditReleaseInputs({ root: destination })).errors, []);
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

test('a missing N identity or changed source-ID mapping fails without renumbering history', () => {
  const input = fixture(), id = input.completion.acceptedCatalogIds[0];
  input.catalog.entities = input.catalog.entities.filter(entity => entity.id !== id);
  rejects(input, /identity loss|missing N identity/);
  const changed = fixture();
  changed.catalog.entities[0].sourceIds = [];
  rejects(changed, /source-ID/);
});

test('changed native commitment and snapshot/raster grants fail independently', () => {
  for (const change of [asset => { asset.masterSha256 = 'a'.repeat(64); }, asset => { asset.publicSnapshotAllowed = true; }, asset => { asset.rasterExportAllowed = true; }]) {
    const input = fixture();
    change(input.artwork.assets.find(asset => asset.catalogId === input.completion.acceptedCatalogIds[0]));
    rejects(input, /native hash|purposes changed/);
  }
});

test('N copy without an applied receipt cannot replace frozen approved text', () => {
  const input = fixture(), id = input.completion.acceptedCatalogIds[0];
  input.profiles.profiles[id].summary += ' Unsupported addition.';
  rejects(input, /unauthorized summary change/);
});

test('reintegrating original N copy cannot overwrite a later approved correction', () => {
  for (const target of ['compiled', 'authoring']) {
    const input = fixture();
    const correction = input.applied.fields.find(row => row.catalogId === 'VBO:0200841' && row.field === 'summary');
    if (target === 'compiled') input.profiles.profiles[correction.catalogId].summary = correction.oldValue;
    else input.authoring[correction.file].profiles[correction.catalogId].summary = correction.oldValue;
    rejects(input, /approved summary correction overwritten/);
  }
});

test('missing review coverage, removed suppression and rewritten historical ledgers fail', () => {
  const missing = fixture(); missing.coverage.NCoverage.pop();
  rejects(missing, /N100 review coverage/);
  const visible = fixture();
  const heldId = visible.completion.acceptedCatalogIds.find(id => visible.overrides.entities[id]?.editorialVisibility?.status === 'suppressed');
  delete visible.catalog.entities.find(entity => entity.id === heldId).editorialVisibility;
  rejects(visible, /hold\/retained visibility/);
  const rewritten = fixture(); rewritten.cohort.completedAt = 'changed';
  rejects(rewritten, /frozen commitment changed/);
});
