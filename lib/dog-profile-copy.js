const unsafeClaim = /\b(?:perfect for|best for|safe with|aggressive|hypoallergenic|easy to train|good with children)\b/iu;

// This narrowly scoped observation still requires the profile's source and
// editorial reviews. It is not a category-wide trainability claim.
const attributedTrainability = /\beasy to train(?= in (?:his|her) owner[’']s account, (?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)-year-old \p{Lu}[\p{L}’'-]* (?:is|was)\b)/gu;

// Retain a source's adverse guardian observation without turning it into an
// unattributed breed-wide label. Source accuracy still needs editorial review.
const attributedGuardianWarning = /\b(?:\p{Lu}[\p{L}’'-]* ){1,4}Kennel describes a guardian affectionate toward its family but aggressive toward unfamiliar beings\b/gu;

// A published field survey can report adverse observations. Require the exact
// population and survey attribution; this does not allow a universal breed label.
const attributedKombaiSurvey = /(?:Kombai dogs in a survey of Tamil Nadu’s Theni district were described as aggressive toward strangers|Theni survey accounts describe Kombai guard dogs as aggressive toward strangers)/gu;

export function hasUnsafeDogProfileCopy(text) {
  return unsafeClaim.test(String(text || '').replace(attributedTrainability, '').replace(attributedGuardianWarning, '').replace(attributedKombaiSurvey, ''));
}
