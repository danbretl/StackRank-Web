import { validDogResearchUrl } from '../lib/dog-research-url.js';

export const SOURCE_POLICY = 'dogs-reference-research-2026-10-03.1';
export const SOURCE_AUTH_SHA256 = 'f846059e89386c25b6f5bf9b65c8ec3642ab83f85c5723e104102ed8d1f1b091';
export const TEXT_ONLY_TEMPLATE = 'dogs-field-guide-v10-cohort-l';
const hash = value => /^[a-f0-9]{64}$/.test(value || '');
const binding = value => typeof value?.path === 'string' && hash(value.sha256) && Number.isSafeInteger(value.bytes) && value.bytes > 0;

export function validTextOnlyEvidence(evidence) {
  return evidence?.mode === 'text-only' && evidence.status === 'approved' &&
    evidence.policyVersion === SOURCE_POLICY && binding(evidence.sourcePolicyAuthorization) &&
    evidence.sourcePolicyAuthorization.sha256 === SOURCE_AUTH_SHA256 && binding(evidence.researchDossier) &&
    Array.isArray(evidence.imageInputs) && evidence.imageInputs.length === 0 &&
    !evidence.assetId && !evidence.originalPath &&
    evidence.rootMorphologyEvidenceRead === true && evidence.rootIdentityApproved === true &&
    evidence.rootSourceUseApproved === true &&
    ['uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'].every(key => evidence.purposes?.[key] === false);
}

export function validTextOnlyPublicReference(reference, evidence) {
  return validTextOnlyEvidence(evidence) && reference?.mode === 'text-only' &&
    reference.policyVersion === SOURCE_POLICY && reference.researchDossierSha256 === evidence.researchDossier.sha256 &&
    Array.isArray(reference.imageInputs) && reference.imageInputs.length === 0 && !reference.assetId &&
    typeof reference.sourcePage === 'string' && reference.sourcePage.startsWith('https://');
}

// Fresh cohort M binds its original authorization; L's historical grant stays exact.
export const M_SOURCE_AUTH_SHA256 = '9fc88af4a34170def317b17d379570eb7319e40e55d30b05c9fc358529e2fd9e';
export const M_TEXT_ONLY_TEMPLATE = 'dogs-field-guide-v10-cohort-m';
export function validMTextOnlyEvidence(evidence) {
  return evidence?.mode === 'text-only' && evidence.status === 'approved' &&
    evidence.policyVersion === SOURCE_POLICY && binding(evidence.sourcePolicyAuthorization) &&
    evidence.sourcePolicyAuthorization.sha256 === M_SOURCE_AUTH_SHA256 && binding(evidence.researchDossier) &&
    Array.isArray(evidence.imageInputs) && evidence.imageInputs.length === 0 &&
    !evidence.assetId && !evidence.originalPath &&
    evidence.rootMorphologyEvidenceRead === true && evidence.rootIdentityApproved === true &&
    evidence.rootSourceUseApproved === true &&
    ['uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'].every(key => evidence.purposes?.[key] === false);
}

export function validMTextOnlyPublicReference(reference, evidence) {
  return validMTextOnlyEvidence(evidence) && reference?.mode === 'text-only' &&
    reference.policyVersion === SOURCE_POLICY && reference.researchDossierSha256 === evidence.researchDossier.sha256 &&
    Array.isArray(reference.imageInputs) && reference.imageInputs.length === 0 && !reference.assetId &&
    typeof reference.sourcePage === 'string' && validDogResearchUrl(reference.sourcePage);
}

// N has independent branch-only authority; historical grants remain unchanged.
export const N_SOURCE_AUTH_SHA256 = '292924b03d5fb2b641dfdef0cd4667aafb98760b71edf9efc4d4ed26920f0b9f';
export const N_TEXT_ONLY_TEMPLATE = 'dogs-field-guide-v11-cohort-n';
export function validNTextOnlyEvidence(evidence) {
  return evidence?.mode === 'text-only' && evidence.status === 'approved' &&
    evidence.policyVersion === SOURCE_POLICY && binding(evidence.sourcePolicyAuthorization) &&
    evidence.sourcePolicyAuthorization.sha256 === N_SOURCE_AUTH_SHA256 && binding(evidence.researchDossier) &&
    Array.isArray(evidence.imageInputs) && evidence.imageInputs.length === 0 &&
    !evidence.assetId && !evidence.originalPath &&
    evidence.rootMorphologyEvidenceRead === true && evidence.rootIdentityApproved === true &&
    evidence.rootSourceUseApproved === true &&
    ['uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'].every(key => evidence.purposes?.[key] === false);
}

export function validNTextOnlyPublicReference(reference, evidence) {
  return validNTextOnlyEvidence(evidence) && reference?.mode === 'text-only' &&
    reference.policyVersion === SOURCE_POLICY && reference.researchDossierSha256 === evidence.researchDossier.sha256 &&
    Array.isArray(reference.imageInputs) && reference.imageInputs.length === 0 && !reference.assetId &&
    typeof reference.sourcePage === 'string' && validDogResearchUrl(reference.sourcePage);
}

// The two audit corrections have fresh scoped authority, independent of cohort grants.
export const CORRECTION_SOURCE_AUTH_SHA256 = '46e474c39177058a40a2f20e2931d8d72219c93bd59765958267e5c8d33e75f7';
export const CORRECTION_TEXT_ONLY_TEMPLATE = 'dogs-field-guide-v11-audit-corrections';
export function validCorrectionTextOnlyEvidence(evidence) {
  return evidence?.mode === 'text-only' && evidence.status === 'approved' &&
    evidence.policyVersion === SOURCE_POLICY && binding(evidence.sourcePolicyAuthorization) &&
    evidence.sourcePolicyAuthorization.sha256 === CORRECTION_SOURCE_AUTH_SHA256 &&
    binding(evidence.researchDossier) && binding(evidence.rootApproval) &&
    Array.isArray(evidence.imageInputs) && evidence.imageInputs.length === 0 && !evidence.assetId && !evidence.originalPath &&
    ['rootMorphologyEvidenceRead', 'rootIdentityApproved', 'rootSourceUseApproved', 'rootSceneAndPromptApproved'].every(key => evidence[key] === true) &&
    ['uiDisplayAllowed', 'publicSnapshotAllowed', 'rasterExportAllowed'].every(key => evidence.purposes?.[key] === false);
}
export function validCorrectionTextOnlyPublicReference(reference, evidence) {
  return validCorrectionTextOnlyEvidence(evidence) && reference?.mode === 'text-only' &&
    reference.policyVersion === SOURCE_POLICY && reference.researchDossierSha256 === evidence.researchDossier.sha256 &&
    Array.isArray(reference.imageInputs) && reference.imageInputs.length === 0 && !reference.assetId &&
    validDogResearchUrl(reference.sourcePage);
}
