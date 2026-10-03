import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncLReviewMetadata } from '../scripts/prepare-dog-portrait-l.mjs';
test('review metadata sync is finite, check-only by default, and repeatable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dogs-l-prepare-'));
  try {
    await fs.mkdir(path.join(root, 'data/dogs'), { recursive: true });
    for (const file of ['generated-artwork-batch-l01.json', 'generated-artwork-batch-l100.json', 'generated-artwork-batch-l00.json', 'generated-artwork-batch-l101.json', 'generated-artwork-batch-k01.json']) await fs.writeFile(path.join(root, 'data/dogs', file), '{}');
    const file = path.join(root, 'dogs-artwork-review.js'); await fs.writeFile(file, 'const L_BATCH_METADATA_URLS = [];\n');
    const check = await syncLReviewMetadata(root); assert.equal(check.changed, true); assert.equal(check.urls.length, 2); assert.equal(await fs.readFile(file, 'utf8'), 'const L_BATCH_METADATA_URLS = [];\n');
    await syncLReviewMetadata(root, { apply: true }); assert.equal((await syncLReviewMetadata(root)).changed, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
