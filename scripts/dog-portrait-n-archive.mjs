import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prefixes = ['reports/dogs-generated-artwork/cohort-n/', 'assets/dogs/generated-masters/cohort-n/'];

// N packets contain absolute exact-byte tuples. Include source JSON as evidence,
// never recursively interpret an acquisition body, root index or registry.
export function collectNRegenerationFiles(root, entry) {
  const files = new Map();
  const add = item => {
    if (!item || typeof item.path !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256 || '') || !Number.isSafeInteger(item.bytes)) throw Error('N archive requires exact path/hash/bytes bindings');
    const absolute = path.isAbsolute(item.path) ? item.path : path.join(root, item.path);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw Error(`Missing N regeneration material: ${item.path}`);
    const real = fs.realpathSync(absolute);
    let canonical;
    for (const prefix of prefixes) {
      const base = path.join(root, prefix);
      if (!fs.existsSync(base)) continue;
      const relative = path.relative(fs.realpathSync(base), real);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) { canonical = prefix + relative.split(path.sep).join('/'); break; }
    }
    if (!canonical) throw Error(`N evidence outside private archive roots: ${item.path}`);
    const bytes = fs.readFileSync(real);
    if (bytes.length !== item.bytes || sha(bytes) !== item.sha256) throw Error(`N evidence bytes changed: ${item.path}`);
    files.set(canonical, { path: canonical, sha256: item.sha256, bytes: item.bytes });
    return JSON.parse.bind(null, bytes.toString());
  };
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'path') && Object.hasOwn(value, 'sha256') && Object.hasOwn(value, 'bytes')) add(value);
    Object.values(value).forEach(walk);
  };
  const packet = entry.preparation?.packet, peer = entry.preparation?.peer;
  if (!packet || !peer) throw Error('N archive requires final canonical packet and independent peer');
  const packetBody = add(packet)(), peerBody = add(peer)();
  if (packetBody.cohortId !== 'dogs-portraits-n' || peerBody.verdict !== 'pass' || peerBody.packet?.sha256 !== packet.sha256 || peerBody.reviewer === packetBody.worker) throw Error('N archive packet/peer mismatch');
  const selected = packetBody.entries?.filter(row => row.catalogId === entry.catalogId);
  const reviewed = peerBody.entries?.filter(row => row.catalogId === entry.catalogId);
  if (selected?.length !== 1 || reviewed?.length !== 1) throw Error('N archive requires one exact selected packet/peer member');
  walk(entry); walk(selected[0]); walk(reviewed[0]);
  if (packetBody.sourcePolicyAuthorization) { walk(packetBody.sourcePolicyAuthorization); walk(add(packetBody.sourcePolicyAuthorization)()); }
  if (selected[0].reference?.mode === "text-only") {
    const dossier = add(selected[0].reference.researchDossier)(); walk(dossier);
    for (const observation of dossier.visualResearch || []) {
      const observations = observation.observations;
      // Inline observation arrays were already walked with the dossier above.
      // Only the object form denotes a separately bound observation document.
      if (observations && typeof observations === "object" && !Array.isArray(observations)) walk(add(observations)());
    }
  }
  const freezePath = path.join(root, `reports/dogs-generated-artwork/cohort-n/tranche-${entry.preparation.trancheId}-freeze-001.json`);
  const freezeBytes = fs.readFileSync(freezePath);
  add({ path: freezePath, sha256: sha(freezeBytes), bytes: freezeBytes.length });
  // Explicit root qualification and each actual attempt/approval/preflight/QA
  // body can carry indispensable exact tuples. Global indexes are not followed.
  for (const item of [entry.qualification, entry.qa?.rootReview, ...(entry.preparation?.corrections || []),
    ...(entry.generation?.attempts || []).flatMap(row => [row.receipt, row.approval, row.preflight])].filter(Boolean)) {
    const body = add(item)(); walk(body);
    if (body.retryAmendment) walk(add(body.retryAmendment)());
  }
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}
