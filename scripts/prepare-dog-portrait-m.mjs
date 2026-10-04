import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectProjectCacheState, stringifyManifest } from './check-cache-versions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function syncMReviewMetadata(root, { apply = false } = {}) {
  const filenames = (await fs.readdir(path.join(root, 'data/dogs')))
    .filter(name => /^generated-artwork-batch-m(?:0[1-9]|[1-9]\d|100)\.json$/.test(name)).sort();
  const urls = filenames.map(name => `/data/dogs/${name}`);
  const filename = path.join(root, 'dogs-artwork-review.js');
  const old = await fs.readFile(filename, 'utf8');
  const pattern = /const M_BATCH_METADATA_URLS = \[[\s\S]*?\];/;
  if (!pattern.test(old)) throw Error('Missing finite M review metadata slot');
  const next = old.replace(pattern, `const M_BATCH_METADATA_URLS = ${JSON.stringify(urls, null, 2)};`);
  if (next !== old && apply) await fs.writeFile(filename, next);
  return { changed: next !== old, urls };
}

export async function syncPortraitCaches(root, { apply = false } = {}) {
  const filename = path.join(root, 'data/asset-versions.json');
  const previous = JSON.parse(await fs.readFile(filename, 'utf8'));
  let state = await collectProjectCacheState({ root });
  if (state.referenceErrors.length || state.unversionedImports.length) throw Error('Cache references must be valid and versioned before synchronization');
  const bumped = Object.keys(state.currentManifest).filter(asset => previous[asset] && previous[asset].hash !== state.currentManifest[asset].hash && previous[asset].v === state.currentManifest[asset].v);
  if (apply && bumped.length) {
    const updates = new Map();
    for (const asset of bumped) for (const ref of state.groupedRefs.get(asset)) {
      if (!updates.has(ref.sourcePath)) updates.set(ref.sourcePath, await fs.readFile(path.join(root, ref.sourcePath), 'utf8'));
      const replacement = ref.specifier.replace(/\?v=\d+$/, `?v=${ref.v + 1}`);
      updates.set(ref.sourcePath, updates.get(ref.sourcePath).split(ref.specifier).join(replacement));
    }
    for (const [source, text] of updates) await fs.writeFile(path.join(root, source), text);
    // Source changes can require another cache bump (review JS then HTML's JS
    // reference). Iterate until no hash has changed without a version bump.
    return syncPortraitCaches(root, { apply });
  }
  if (apply) { state = await collectProjectCacheState({ root }); await fs.writeFile(filename, stringifyManifest(state.currentManifest)); }
  return { stale: bumped, manifestChanged: stringifyManifest(previous) !== stringifyManifest(state.currentManifest) };
}

export async function preparePortraitM(root, { apply = false } = {}) {
  // Builders consume only explicitly prepared accepted batch artifacts. They do
  // not create evidence, select an identity, approve a native or publish a site.
  for (const script of ['build-dog-profiles.mjs', 'build-generated-dog-artwork.mjs', 'build-dog-artwork-discovery-queue.mjs']) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...(apply ? [] : ['--check'])], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw Error(`${script}: ${result.stderr || result.stdout}`);
  }
  const metadata = await syncMReviewMetadata(root, { apply });
  const caches = await syncPortraitCaches(root, { apply });
  if (!apply && (metadata.changed || caches.stale.length || caches.manifestChanged)) throw Error('Reviewer metadata/cache manifest is stale; root can rerun with --apply after reviewing prepared batch artifacts');
  const validation = spawnSync(process.execPath, [path.join(root, 'scripts/dog-portrait-cohort.mjs'), '--cohort=m', '--check'], { cwd: root, encoding: 'utf8' });
  if (validation.status !== 0) throw Error(validation.stderr || validation.stdout);
  return { valid: true, mode: apply ? 'prepared-local-only' : 'check', mBatchMetadata: metadata.urls.length, generationOrPublicationPerformed: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) console.log('Usage: node scripts/prepare-dog-portrait-m.mjs [--check|--apply]\nDefault: read/check only. --apply rebuilds existing reviewed artifact projections and syncs finite reviewer URLs/cache keys locally; no generation, approvals, selection freeze or publication.');
  else if (args.length > 1 || args.some(arg => !['--check', '--apply'].includes(arg))) { console.error('Unknown option'); process.exitCode = 1; }
  else preparePortraitM(root, { apply: args.includes('--apply') }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
