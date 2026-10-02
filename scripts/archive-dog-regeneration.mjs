import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const privatePrefixes = ['reports/dogs-generated-artwork/cohort-i/', 'reports/dogs-generated-artwork/cohort-j/', 'assets/dogs/generated-masters/cohort-j/', 'reports/dogs-generated-artwork/cohort-k/', 'assets/dogs/generated-masters/cohort-k/'];

export function collectRegenerationFiles(root, entry, packetPaths) {
  const files = new Map();
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === 'object') return Object.values(value).forEach(walk);
    if (typeof value !== 'string') return;
    // Independent K tasks use absolute shared-artifact paths. Bind those paths
    // to an actually reachable private prefix, retaining canonical restore paths.
    if (path.isAbsolute(value)) {
      let relativeValue = null;
      for (const prefix of privatePrefixes) {
        const base = path.join(root, prefix);
        const realBase = fs.existsSync(base) ? fs.realpathSync(base) : base;
        const realValue = fs.existsSync(value) ? fs.realpathSync(value) : value;
        const relative = path.relative(realBase, realValue);
        if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
          relativeValue = prefix + relative.split(path.sep).join('/');
          break;
        }
      }
      if (!relativeValue) return;
      value = relativeValue;
    }
    if (!privatePrefixes.some(prefix => value.startsWith(prefix))) return;
    const normalized = path.posix.normalize(value);
    if (normalized !== value || value.includes('..') || !privatePrefixes.some(prefix => normalized.startsWith(prefix))) throw Error(`Unsafe archive path: ${value}`);
    if (files.has(value)) return;
    const absolute = path.join(root, value);
    // Operational registries also describe existing worker staging directories.
    // They are metadata, not files to recurse through or archive wholesale.
    if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) return;
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw Error(`Missing regeneration material: ${value}`);
    const bytes = fs.readFileSync(absolute);
    files.set(value, { path: value, sha256: hash(bytes), bytes: bytes.length });
    if (value.endsWith('.json')) {
      const record = JSON.parse(bytes.toString());
      // Global review ledgers are retained as snapshots, without pulling prior
      // milestones' native masters into every later archive.
      if (value.startsWith('reports/dogs-generated-artwork/cohort-k/') || Object.hasOwn(record, 'entries') || value.endsWith('/generation-attempts.json')) walk(record);
    }
  };
  walk(entry);
  packetPaths.forEach(walk);
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function createRegenerationArchive(root, wave) {
  if (!/^[jk](?:0[1-9]|10)$/.test(wave)) throw Error('Expected J/K wave j01–j10 or k01–k10');
  const letter = wave[0];
  const ledgerPath = `data/dogs/portrait-cohort-${letter}.json`;
  const cohort = JSON.parse(fs.readFileSync(path.join(root, ledgerPath)));
  const batchPath = `data/dogs/generated-artwork-batch-${wave}.json`;
  const profilePath = `data/dogs/profile-refresh-${wave}.json`;
  const batch = JSON.parse(fs.readFileSync(path.join(root, batchPath)));
  const ids = batch.images.map(image => image.catalogId);
  const release = cohort.integrationBatches.find(item => item.subwave === wave);
  if (!release || JSON.stringify(release.catalogIds) !== JSON.stringify(ids) || release.count !== ids.length || new Set(ids).size !== ids.length) throw Error('Archive requires exact distinct recorded release membership');
  const files = new Map();
  for (const id of ids) {
    const entry = cohort.entries[id];
    if (entry?.integration?.subwave !== wave || entry.qa.status !== 'approved' || entry.profile.status !== 'approved') throw Error(`Unapproved archive identity: ${id}`);
    const packetDir = path.posix.dirname(entry.preparation.packetPath);
    const packetPaths = letter === 'j'
      ? ['packet.json', 'profiles.json', 'rights-reviewed.json', 'generation-attempts.json', 'batch-candidate.json'].map(name => `${packetDir}/${name}`)
      : [entry.preparation.packetPath, ...(entry.preparation.archiveEvidencePaths || [])];
    packetPaths.push(...(entry.reference.supplementalEvidencePaths || []));
    for (const file of collectRegenerationFiles(root, entry, packetPaths)) files.set(file.path, file);
  }
  // These are immutable snapshots inside the archive; later publication receipts
  // may extend the live cohort ledger without changing the saved source material.
  for (const file of [ledgerPath, batchPath, profilePath]) {
    const bytes = fs.readFileSync(path.join(root, file));
    files.set(file, { path: file, sha256: hash(bytes), bytes: bytes.length });
  }
  const list = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const objects = [...new Map(list.map(file => [file.sha256, file])).values()];
  const archivePath = `reports/dogs-generated-artwork/cohort-${letter}/regeneration-archives/${wave}.tar.gz`;
  const manifestPath = `data/dogs/regeneration-manifest-${wave}.json`;
  if (fs.existsSync(path.join(root, archivePath)) || fs.existsSync(path.join(root, manifestPath))) throw Error('Refusing to replace an existing regeneration archive');
  fs.mkdirSync(path.dirname(path.join(root, archivePath)), { recursive: true });
  const manifest = { schemaVersion: 1, cohortId: cohort.cohortId, wave, createdAt: new Date().toISOString(),
    catalogIds: ids, selectionSha256: cohort.selectionSha256,
    storage: 'Local ignored archive; no off-machine backup is asserted',
    archivePath, archiveSha256: null, archiveBytes: null,
    fileCount: list.length, uniqueObjectCount: objects.length,
    uniqueObjectBytes: objects.reduce((sum, file) => sum + file.bytes, 0),
    purposes: { uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false },
    contents: 'Pinned reference originals/metadata/File text, attribution chains, claim-specific primary snapshots, reviewed full/short prose, exact prompts, all native attempts including rejected outputs, and accountable review receipts.',
    files: list };
  const python = `import sys,json,tarfile,hashlib,io,pathlib\np=json.load(sys.stdin);root=pathlib.Path(p['root'])\nwith tarfile.open(root/p['archivePath'],'w:gz') as t:\n for f in p['objects']:\n  b=(root/f['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==f['sha256']\n  i=tarfile.TarInfo('objects/'+f['sha256']);i.size=len(b);i.mode=0o600;t.addfile(i,io.BytesIO(b))\n b=json.dumps(p['manifest'],ensure_ascii=False,indent=2).encode();i=tarfile.TarInfo('index.json');i.size=len(b);i.mode=0o600;t.addfile(i,io.BytesIO(b))\nwith tarfile.open(root/p['archivePath'],'r:gz') as t:\n for f in p['objects']:\n  b=t.extractfile('objects/'+f['sha256']).read();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']\n`;
  const result = spawnSync('python3', ['-c', python], { input: JSON.stringify({ root, archivePath, objects, manifest }), encoding: 'utf8' });
  if (result.status !== 0) throw Error(`Archive creation/verification failed: ${result.stderr}`);
  const bytes = fs.readFileSync(path.join(root, archivePath));
  manifest.archiveSha256 = hash(bytes); manifest.archiveBytes = bytes.length;
  fs.writeFileSync(path.join(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const manifest = createRegenerationArchive(process.cwd(), process.argv[2]);
  console.log(`${manifest.wave}: archived ${manifest.catalogIds.length} pairs, ${manifest.fileCount} files, ${manifest.uniqueObjectCount} verified objects; ${manifest.archiveSha256}`);
}
