import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_POLICY, SOURCE_AUTH_SHA256, validTextOnlyEvidence, validTextOnlyPublicReference } from '../scripts/dog-portrait-source-policy.mjs';

test('text-only provenance requires approved exact research and cannot masquerade as a photo', () => {
  const dossier = { path: '/private/dossier.json', sha256: 'd'.repeat(64), bytes: 100 };
  const evidence = { mode: 'text-only', status: 'approved', policyVersion: SOURCE_POLICY,
    sourcePolicyAuthorization: { ...dossier, sha256: SOURCE_AUTH_SHA256 }, researchDossier: dossier,
    imageInputs: [], rootMorphologyEvidenceRead: true, rootIdentityApproved: true, rootSourceUseApproved: true,
    purposes: { uiDisplayAllowed: false, publicSnapshotAllowed: false, rasterExportAllowed: false } };
  const reference = { mode: 'text-only', policyVersion: SOURCE_POLICY, researchDossierSha256: dossier.sha256,
    imageInputs: [], sourcePage: 'https://example.org/standard' };
  assert.equal(validTextOnlyPublicReference(reference, evidence), true);
  assert.equal(validTextOnlyEvidence({ ...evidence, imageInputs: [dossier] }), false);
  assert.equal(validTextOnlyEvidence({ ...evidence, assetId: 'unreviewed-photo' }), false);
  assert.equal(validTextOnlyEvidence({ ...evidence, rootMorphologyEvidenceRead: false }), false);
  assert.equal(validTextOnlyPublicReference({ ...reference, researchDossierSha256: 'e'.repeat(64) }, evidence), false);
  assert.equal(validTextOnlyEvidence({ ...evidence, purposes: { ...evidence.purposes, publicSnapshotAllowed: true } }), false);
});
