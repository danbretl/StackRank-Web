import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { completedDogCatalogIds } from '../lib/dogs-public-visibility.js';
import { validateCompletedHoldResolution } from './dogs-completed-holds-contract.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NOTES = 'notes/testing/dogs-audit-corrections/';
const digest = value => createHash('sha256').update(value).digest('hex');
const jsonDigest = value => digest(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const commitment = {
  // Semantic JSON hashes of the immutable N hand-back; whitespace is not evidence.
  cohort: '96a20d7886839f61febd48d174243562ccf9d16a9a2afa259928a3742a9b5075',
  completion: '0253d35024e4bf330dfa17e08ca6e4a936290d1a2fbaeea9978ae52ad167be41',
  // c3ba4b03 canonical IDs, source-ID mappings and selectable flags, sorted by ID.
  identity: '28aaf623254583e8d6c8a9f97d723e6923dc5822a0fdd0c48497a659f8951a0b',
};

/** Read only committed release inputs. Never follow private evidence/native bindings. */
export function loadAuditReleaseInputs({ root = ROOT, readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) } = {}) {
  const cohort = readJson('data/dogs/portrait-cohort-n.json');
  const completion = readJson('data/dogs/portrait-cohort-n-completion.json');
  const authoring = {};
  for (const entry of Object.values(cohort.entries)) {
    if (entry.integration?.status !== 'integrated') continue;
    const wave = entry.integration.subwave;
    if (!/^n\d+$/.test(wave)) throw new Error('Unsafe N authoring wave');
    const file = `data/dogs/profile-refresh-${wave}.json`;
    authoring[file] ||= readJson(file);
  }
  const holdFreeze = readJson('notes/testing/dogs-completed-holds-resolution/freeze.json');
  const holdResolution = readJson('notes/testing/dogs-completed-holds-resolution/resolution-ledger.json');
  for (const row of holdFreeze.entries) authoring[row.authoring.file] ||= readJson(row.authoring.file);
  return {
    cohort, completion, authoring, holdFreeze, holdResolution,
    catalog: readJson('data/dogs/dog-catalog.json'),
    profiles: readJson('data/dogs/breed-profiles.json'),
    artwork: readJson('data/dogs/generated-artwork.json'),
    overrides: readJson('data/dogs/catalog-overrides.json'),
    applied: readJson(`${NOTES}applied-profile-fields.json`),
    decisions: readJson(`${NOTES}catalog-decisions.json`),
    coverage: readJson(`${NOTES}evidence/coverage-index.json`),
    reviews: ['n-a-review.json', 'n-b-review.json'].map(file => readJson(`${NOTES}evidence/${file}`)),
  };
}

/** Final combined catalog contract, not a new certification of private source/native bytes. */
export function validateDogsAuditRelease(input) {
  const { cohort, completion, catalog, profiles, artwork, authoring, overrides, applied, decisions, coverage, reviews } = input;
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const continuation = validateCompletedHoldResolution(input);
  errors.push(...continuation.errors);
  const followRows = new Map((input.holdResolution?.decisions || []).map(row => [row.catalogId, row]));
  check(jsonDigest(cohort) === commitment.cohort, 'Original N cohort frozen commitment changed');
  check(jsonDigest(completion) === commitment.completion, 'Original N completion frozen commitment changed');
  const identities = catalog.entities.map(({ id, sourceIds, selectable }) => ({ id, sourceIds, selectable })).sort((a, b) => a.id.localeCompare(b.id));
  check(identities.length === 1239 && jsonDigest(identities) === commitment.identity, 'Catalog identity loss, addition or destructive source-ID/selectable migration');
  const ids = completion.acceptedCatalogIds;
  const idSet = new Set(ids);
  const integrated = Object.values(cohort.entries).filter(entry => entry.integration?.status === 'integrated').map(entry => entry.catalogId);
  const exactIds = values => values.length === 100 && new Set(values).size === 100 && values.every(id => idSet.has(id));
  check(ids.length === 100 && idSet.size === 100 && exactIds(integrated), 'Exactly 100 original accepted N identities must remain integrated');
  const nAssets = artwork.assets.filter(asset => asset.promptTemplateVersion === 'dogs-field-guide-v11-cohort-n');
  check(exactIds(nAssets.map(asset => asset.catalogId)), 'Exactly 100 accepted N artwork identities must remain stored');
  const byId = new Map(catalog.entities.map(entity => [entity.id, entity]));
  const assets = new Map(artwork.assets.map(asset => [asset.catalogId, asset]));
  const publicIds = completedDogCatalogIds({ entities: catalog.entities, profiles, artwork });
  const coverageRows = coverage.NCoverage || [];
  check(exactIds(coverageRows.map(row => row.catalogId)), 'N100 review coverage must have every accepted identity exactly once');
  const reviewRows = reviews.flatMap(review => review.reviews || []);
  check(exactIds(reviewRows.map(row => row.catalogId)), 'N100 underlying independent reviews must have every identity exactly once');
  check(applied.postApplicationReview?.status === 'passed_authoring_review', 'Applied correction receipt lacks completed authoring review');
  const correctionRows = applied.fields.filter(row => idSet.has(row.catalogId));
  check(new Set(correctionRows.map(row => `${row.catalogId}:${row.field}`)).size === correctionRows.length, 'Duplicate N field correction receipts');
  for (const id of ids) {
    const entry = cohort.entries[id];
    const entity = byId.get(id), asset = assets.get(id), profile = profiles.profiles[id];
    const file = `data/dogs/profile-refresh-${entry?.integration?.subwave}.json`;
    const authored = authoring[file]?.profiles?.[id];
    const follow = followRows.get(id);
    const priorAuthored = follow?.beforeProfile || authored;
    check(!!entity && !!asset && !!profile && !!authored, `${id}: missing N identity, artwork, profile or authoring`);
    if (!entity || !asset || !profile || !authored) continue;
    const accepted = entry.generation.attempts.find(attempt => attempt.id === entry.generation.acceptedAttemptId);
    check(accepted?.qaDecision === 'accepted' && accepted.native?.sha256 === asset.masterSha256 && accepted.originalOutputSha256 === asset.masterSha256,
      `${id}: accepted native hash does not match runtime master commitment`);
    check(asset.sourceType === 'ai-generated' && asset.review?.status === 'approved' && asset.uiDisplayAllowed === true && asset.publicSnapshotAllowed === false && asset.rasterExportAllowed === false,
      `${id}: artwork approval or purposes changed`);
    check(entry.reference.purposes.uiDisplayAllowed === false && entry.reference.purposes.publicSnapshotAllowed === false && entry.reference.purposes.rasterExportAllowed === false,
      `${id}: research image purposes changed`);
    for (const field of ['summary', 'shortDescription']) {
      const correction = correctionRows.find(row => row.catalogId === id && row.field === field);
      const originalHash = entry.profile[`${field}Sha256`];
      if (correction) {
        check(correction.disposition === 'applied' && correction.file === file && !!correction.decision && !!correction.rationale && digest(String(correction.oldValue)) === originalHash,
          `${id}: ${field} correction lacks exact original-copy receipt`);
        check(same(priorAuthored[field], correction.newValue) &&
          same(profile[field], follow ? follow.afterProfile[field] : correction.newValue), `${id}: approved ${field} correction overwritten in authoring or compiled output`);
      } else {
        check(digest(String(priorAuthored[field])) === originalHash &&
          (follow ? same(profile[field], follow.afterProfile[field]) : digest(String(profile[field])) === originalHash), `${id}: unauthorized ${field} change without applied receipt`);
      }
    }
    for (const row of correctionRows.filter(row => row.catalogId === id)) {
      check(row.disposition === 'applied' && row.file === file && same(priorAuthored[row.field], row.newValue), `${id}: applied ${row.field} receipt differs from prior authoring chain`);
      // Sources/review dates are authoring provenance, compiled into sourceIds instead.
      if (!['sources', 'reviewedAt'].includes(row.field)) check(same(profile[row.field], follow ? follow.afterProfile[row.field] : row.newValue), `${id}: applied ${row.field} receipt differs from compiled profile`);
    }
    check(profile.reviewStatus === 'editor-reviewed', `${id}: editorial suppression must not falsify profile approval`);
    const review = coverageRows.find(row => row.catalogId === id);
    const originalReview = reviewRows.find(row => row.catalogId === id);
    const copyReviewed = originalReview?.fullShortAndSurfacedFactsReviewed === true ||
      (originalReview?.fullSummaryRead === true && originalReview.shortDescriptionRead === true && originalReview.surfacedStructuredFieldsRead === true);
    const portraitReviewed = originalReview?.actualPortraitInspected === true || originalReview?.portrait?.declaredHashMatches === true;
    const reviewedHash = originalReview?.detailAssetSha256 || originalReview?.portrait?.sha256;
    check(copyReviewed && portraitReviewed && reviewedHash === review?.portraitSha256, `${id}: underlying N review does not support coverage index`);
    const detail = asset.variants.find(variant => variant.role === 'detail');
    check(review?.fullShortSurfacedFieldsReviewed === true && review.actualPortraitReviewed === true && review.portraitSha256 === detail?.sha256,
      `${id}: full/short/fact or actual-portrait coverage missing/stale`);
    const held = overrides.entities[id]?.editorialVisibility?.status === 'suppressed';
    const decision = decisions.decisions.filter(row => row.catalogId === id && row.field === 'editorialVisibility').at(-1);
    check((entity.editorialVisibility === 'suppressed') === held && publicIds.has(id) === !held, `${id}: final hold/retained visibility differs from authoring`);
    if (held) check(follow ? same(follow.afterVisibility, overrides.entities[id].editorialVisibility) :
      decision?.after?.status === 'suppressed' && same(decision.after, overrides.entities[id].editorialVisibility), `${id}: suppression lacks exact lead decision`);
    if (/^(suppress|editorial-suppress)/.test(review?.reviewRecommendation || '')) check(held || follow?.disposition === 'restored', `${id}: reviewed N hold unexpectedly public`);
  }
  for (const entry of Object.values(cohort.entries).filter(entry => entry.hold?.status === 'held')) {
    check(!assets.has(entry.catalogId) && !publicIds.has(entry.catalogId), `${entry.catalogId}: historical rejected N hold became accepted/public`);
  }
  return { valid: errors.length === 0, errors, integratedN: integrated.length, reviewedN: coverageRows.length,
    publicN: ids.filter(id => publicIds.has(id)).length, suppressedN: ids.filter(id => byId.get(id)?.editorialVisibility === 'suppressed').length,
    privateSourceOrNativeBytesRevalidated: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = validateDogsAuditRelease(loadAuditReleaseInputs());
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
