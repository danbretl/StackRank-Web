import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const policy = JSON.parse(fs.readFileSync(new URL("../data/dogs/generated-artwork-policy.json", import.meta.url)));

test("generated Dog artwork has explicit disclosure and fail-closed downstream purposes", () => {
  assert.match(policy.requiredDisclosure, /AI-generated breed portrait/);
  assert.equal(policy.purposeGates.uiDisplay, true);
  assert.equal(policy.purposeGates.publicSnapshot, false);
  assert.equal(policy.purposeGates.rasterExport, false);
  assert.equal(policy.referenceRules.referencesMustBeRightsReviewed, true);
  assert.equal(policy.referenceRules.copyingReferenceCompositionIsForbidden, true);
});
