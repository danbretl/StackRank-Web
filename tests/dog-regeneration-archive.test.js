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

test('K archives follow absolute worker evidence and root approvals into the complete immutable closure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dogs-k-archive-'));
  try {
    const prefix = 'reports/dogs-generated-artwork/cohort-k/';
    fs.mkdirSync(path.join(root, prefix, 'worker-a'), { recursive: true });
    fs.mkdirSync(path.join(root, prefix, 'root-approvals'));
    const original = path.join(root, prefix, 'worker-a/original.jpg');
    const license = path.join(root, prefix, 'worker-a/license.txt');
    const prompt = path.join(root, prefix, 'worker-a/prompt.txt');
    fs.writeFileSync(original, 'unchanged exact original');
    fs.writeFileSync(license, 'actual earliest creator release');
    fs.writeFileSync(prompt, 'exact approved prompt');
    const packet = path.join(root, prefix, 'worker-a/packet.json');
    fs.writeFileSync(packet, JSON.stringify({ reference: { originalPath: original, chainPath: license }, promptPath: prompt }));
    const approval = path.join(root, prefix, 'root-approvals/approval.json');
    fs.writeFileSync(approval, JSON.stringify({ packet: { path: packet }, reference: { path: original }, prompt: { path: prompt } }));
    const rows = collectRegenerationFiles(root, { generation: { rootApprovalPath: approval } }, []);
    assert.equal(rows.length, 5);
    assert.ok(rows.every(row => row.path.startsWith(prefix)));
    assert.ok(rows.some(row => row.path.endsWith('/license.txt')));
    assert.ok(rows.some(row => row.path.endsWith('/prompt.txt')));
    assert.deepEqual(collectRegenerationFiles(root, { outside: '/unrelated/private.txt' }, []), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('K absolute evidence is recovered through the integration worktree shared-report symlink', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'dogs-k-linked-archive-'));
  try {
    const source = path.join(parent, 'source'), integration = path.join(parent, 'integration');
    const prefix = 'reports/dogs-generated-artwork/cohort-k/';
    fs.mkdirSync(path.join(source, prefix, 'worker-a'), { recursive: true });
    fs.mkdirSync(integration);
    fs.symlinkSync(path.join(source, 'reports'), path.join(integration, 'reports'));
    const original = path.join(source, prefix, 'worker-a/original.jpg');
    fs.writeFileSync(original, 'source-visible original');
    const rows = collectRegenerationFiles(integration, { originalPath: original }, []);
    assert.equal(rows.length, 1); assert.equal(rows[0].path, prefix + 'worker-a/original.jpg');
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
