const unsafeClaim = /\b(?:perfect for|best for|safe with|aggressive|hypoallergenic|easy to train|good with children)\b/iu;

// This narrowly scoped observation still requires the profile's source and
// editorial reviews. It is not a category-wide trainability claim.
const attributedTrainability = /\beasy to train(?= in (?:his|her) owner[’']s account, (?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)-year-old \p{Lu}[\p{L}’'-]* (?:is|was)\b)/gu;

export function hasUnsafeDogProfileCopy(text) {
  return unsafeClaim.test(String(text || '').replace(attributedTrainability, ''));
}
