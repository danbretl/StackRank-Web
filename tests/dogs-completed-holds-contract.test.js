import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditReleaseInputs } from '../scripts/validate-dogs-audit-release.mjs';
import { validateCompletedHoldResolution } from '../scripts/dogs-completed-holds-contract.mjs';
const fixture = () => loadAuditReleaseInputs();
const rejects = (input, pattern) => { const result = validateCompletedHoldResolution(input); assert.equal(result.valid, false); assert.match(result.errors.join('\n'), pattern); };
test('all96 completed holds resolve with94 restorations, two exclusions and preserved portraits', () => {
 const result=validateCompletedHoldResolution(fixture()); assert.deepEqual(result.errors,[]);assert.equal(result.reviewed,96);assert.equal(result.restored,94);assert.equal(result.public,900);
});
test('resolution cannot omit a held identity or substitute a self review', () => {
 let input=fixture();input.holdResolution.decisions.pop();rejects(input,/exactly one resolution/);
 input=fixture();let row=input.holdResolution.decisions[0];row.independentReview.reviewer=row.worker;rejects(input,/independent resolution review/);
});
test('publication cannot outrun its evidence or mutate saved identity mappings', () => {
 let input=fixture();const row=input.holdResolution.decisions.find(r=>r.disposition==='restored');input.authoring[row.authoringFile].profiles[row.catalogId].summary='Unreviewed replacement';rejects(input,/final authoring/);
 input=fixture();const entity=input.catalog.entities.find(e=>e.id===row.catalogId);entity.sourceIds=['VBO:DIFFERENT'];rejects(input,/remapped identity/);
});
test('category cards require a named example and exclusions cannot silently return', () => {
 let input=fixture();const row=input.holdResolution.decisions.find(r=>r.afterProfile.identityScope==='category');input.profiles.profiles[row.catalogId].portraitExample='';rejects(input,/explicit scope\/example/);
 input=fixture();const excluded=input.holdResolution.decisions.find(r=>r.disposition==='excluded');delete input.catalog.entities.find(e=>e.id===excluded.catalogId).editorialVisibility;rejects(input,/public selection/);
});
