import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CORRECTION_TEXT_ONLY_TEMPLATE, validCorrectionTextOnlyPublicReference } from './dog-portrait-source-policy.mjs';

export const ARTWORK_CORRECTION_PATH = 'data/dogs/generated-artwork-corrections-2026-10-06.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => /^[a-f0-9]{64}$/.test(value || '');
const gates = ['rootMorphologyEvidenceRead', 'rootIdentityApproved', 'rootSourceUseApproved', 'rootSceneAndPromptApproved'];

/** Additive replacement: historical entries stay intact, and ambiguous/stale targets fail closed. */
export function applyDogArtworkCorrections(entries, document) {
  if (document?.schemaVersion !== 1 || document.correctionId !== 'dogs-audit-corrections-2026-10-06' || !Array.isArray(document.images)) throw new Error('Invalid artwork correction document');
  const next = [...entries];
  const seen = new Set();
  for (const entry of document.images) {
    const id = entry?.catalogId;
    const matches = entries.filter(old => old.catalogId === id);
    if (seen.has(id) || matches.length !== 1) throw new Error(`${id}: ambiguous correction target`);
    seen.add(id);
    const old = matches[0];
    if (old.generatedPath !== entry.replacesGeneratedPath || old.masterSha256 !== entry.replacesMasterSha256 ||
      !hash(entry.replacesMasterSha256) || entry.replacesAssetId !== `dogs:generated:${id.replace(':', '-').toLowerCase()}:v1`) throw new Error(`${id}: stale correction target`);
    if (entry.generatedPath === old.generatedPath || !/^assets\/dogs\/generated-masters\/audit-2026-10-06\/[\w-]+\.png$/.test(entry.generatedPath || '') ||
      !hash(entry.masterSha256) || entry.masterSha256 === old.masterSha256) throw new Error(`${id}: correction must preserve original master`);
    if (entry.promptTemplateVersion !== CORRECTION_TEXT_ONLY_TEMPLATE || !validCorrectionTextOnlyPublicReference(entry.reference, entry.referenceEvidence) ||
      !hash(entry.promptSha256) || sha256(entry.prompt || '') !== entry.promptSha256) throw new Error(`${id}: invalid correction provenance`);
    if (entry.qa?.verdict !== 'pass' || ['workerFullResolutionViewed', 'primaryFullResolutionViewed', 'workerContactSheetViewed', 'leadContactSheetViewed'].some(key => entry.qa[key] !== true) ||
      entry.uiDisplayAllowed !== true || entry.publicSnapshotAllowed !== false || entry.rasterExportAllowed !== false) throw new Error(`${id}: incomplete correction QA or purposes`);
    next[next.indexOf(old)] = entry;
  }
  return next;
}

/** Verify committed evidence bytes, including identity/prompt binding inside pre-call approval. */
export async function verifyDogArtworkCorrectionEvidence(root, entry) {
  const readBinding = async binding => {
    if (!binding || path.isAbsolute(binding.path || '') || !(binding.path || '').startsWith('notes/testing/dogs-audit-corrections/artwork/') || binding.path.split('/').includes('..')) throw new Error(`${entry.catalogId}: unsafe evidence path`);
    const bytes = await fs.readFile(path.join(root, binding.path));
    if (bytes.length !== binding.bytes || sha256(bytes) !== binding.sha256) throw new Error(`${entry.catalogId}: changed correction evidence`);
    return bytes;
  };
  const evidence = entry.referenceEvidence;
  const authorization = JSON.parse(await readBinding(evidence.sourcePolicyAuthorization));
  if (!authorization.catalogIds?.includes(entry.catalogId)) throw new Error(`${entry.catalogId}: outside correction authority`);
  await readBinding(evidence.researchDossier);
  const approval = JSON.parse(await readBinding(evidence.rootApproval));
  if (path.basename(evidence.rootApproval.path) !== `${evidence.rootApproval.sha256}.json` ||
    approval.status !== 'approved' || approval.catalogId !== entry.catalogId || approval.correctionId !== 'dogs-audit-corrections-2026-10-06' ||
    approval.inputMode !== 'text-only' || !Array.isArray(approval.imageInputs) || approval.imageInputs.length ||
    approval.nativeDimensions?.join(',') !== '1536,1024' || gates.some(key => approval[key] !== true) ||
    ['uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'].some(key => approval.referencePurposes?.[key] !== false) ||
    approval.prompt?.sha256 !== entry.promptSha256 || approval.prompt?.bytes !== Buffer.byteLength(entry.prompt) ||
    ['researchDossier', 'sourcePolicyAuthorization'].some(key => approval[key]?.sha256 !== evidence[key].sha256 || approval[key]?.bytes !== evidence[key].bytes)) throw new Error(`${entry.catalogId}: approval does not bind exact correction`);
}
