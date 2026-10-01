import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectRegenerationFiles } from '../scripts/archive-dog-regeneration.mjs';

test('regeneration collection preserves packet-only attribution sources and avoids old global review masters', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dogs-archive-'));
  try {
    const prefix = 'reports/dogs-generated-artwork/cohort-j/';
    fs.mkdirSync(path.join(root, prefix), { recursive: true });
    for (const [name, bytes] of Object.entries({ 'original.jpg': 'native original', 'chain.json': '{}',
      'packet.json': JSON.stringify({ entries: [{ reference: { originalPath: `${prefix}original.jpg`, additionalChainSources: [{ snapshotPath: `${prefix}chain.json` }] } }] }),
      'primary-image-review.json': JSON.stringify([{ nativeMasterPath: 'assets/dogs/generated-masters/cohort-j/old-wave.png' }]) })) fs.writeFileSync(path.join(root, prefix, name), bytes);
    const rows = collectRegenerationFiles(root, { qa: { primaryReviewPath: `${prefix}primary-image-review.json` } }, [`${prefix}packet.json`]);
    assert.equal(rows.length, 4);
    assert.ok(rows.some(row => row.path.endsWith('/chain.json')));
    assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.sha256) && row.bytes > 0));
    assert.equal(new Set(rows.map(row => row.path)).size, rows.length);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('regeneration collection fails on missing evidence or paths escaping the private source tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dogs-archive-'));
  try {
    assert.throws(() => collectRegenerationFiles(root, { source: 'reports/dogs-generated-artwork/cohort-j/missing.pdf' }, []), /Missing regeneration material/);
    assert.throws(() => collectRegenerationFiles(root, { source: 'reports/dogs-generated-artwork/cohort-j/../../../private.txt' }, []), /Unsafe archive path/);
    assert.deepEqual(collectRegenerationFiles(root, { irrelevant: '/Users/example/private.txt' }, []), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
