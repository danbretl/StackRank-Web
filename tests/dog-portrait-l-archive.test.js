import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectLRegenerationFiles } from '../scripts/dog-portrait-l-archive.mjs';

test('L archives follow selected canonical packet tuples without traversing source JSON or global indexes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dogs-l-archive-'));
  try {
    const prefix = 'reports/dogs-generated-artwork/cohort-l/worker-a/';
    fs.mkdirSync(path.join(root, prefix), { recursive: true });
    const put = (name, value) => { const p = path.join(root, prefix, name); const raw = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)); fs.writeFileSync(p, raw); return { path: p, sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length }; };
    const original = put('selected.jpg', 'exact selected original');
    const unselected = put('unselected.jpg', 'other packet member');
    const source = put('acquisition.json', { globalMissingMaster: prefix + 'never-acquired.png' });
    const packet = put('packet.json', { cohortId: 'dogs-portraits-l', worker: 'A', entries: [{ catalogId: 'VBO:0200469', reference: { original }, evidence: [source] }, { catalogId: 'VBO:0201086', reference: { original: unselected } }] });
    const peer = put('peer.json', { verdict: 'pass', reviewer: 'B', packet, entries: [{ catalogId: 'VBO:0200469', sourceOriginal: original }, { catalogId: 'VBO:0201086', sourceOriginal: unselected }] });
    const rows = collectLRegenerationFiles(root, { catalogId: 'VBO:0200469', preparation: { packet, peer } });
    assert.deepEqual(rows.map(row => path.basename(row.path)), ['acquisition.json', 'packet.json', 'peer.json', 'selected.jpg']);
    fs.writeFileSync(original.path, 'changed');
    assert.throws(() => collectLRegenerationFiles(root, { catalogId: 'VBO:0200469', preparation: { packet, peer } }), /bytes changed/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
