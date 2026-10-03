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
