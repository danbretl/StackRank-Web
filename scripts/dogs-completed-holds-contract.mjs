import { createHash } from 'node:crypto';
import { completedDogCatalogIds } from '../lib/dogs-public-visibility.js';

const jsonHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const FROZEN_BASELINE = '50b86d2c3feb51a9c352c3ce9b8bec45909f25a643da6a9fb12d941acad051f3';

/** Scoped continuation of the preserved audit, never a replacement for its original receipts. */
export function validateCompletedHoldResolution(input) {
  const { holdFreeze: freeze, holdResolution: ledger, catalog, profiles, artwork, authoring, overrides } = input;
  const errors = [];
  const check = (value, message) => { if (!value) errors.push(message); };
  check(jsonHash(freeze) === FROZEN_BASELINE, 'Completed-hold baseline commitment changed');
  check(ledger?.baselineCommit === '8621d9b3692a4d8070a7a849f455a204fe94ec58', 'Wrong completed-hold baseline revision');
  const frozen = new Map((freeze?.entries || []).map(row => [row.id, row]));
  const rows = ledger?.decisions || [];
  check(frozen.size === 96 && rows.length === 96 && new Set(rows.map(row => row.catalogId)).size === 96 &&
    rows.every(row => frozen.has(row.catalogId)), 'Every one of the 96 completed holds needs exactly one resolution');
  const entities = new Map(catalog.entities.map(row => [row.id, row]));
  const assets = new Map(artwork.assets.map(row => [row.catalogId, row]));
  const publicIds = completedDogCatalogIds({ entities: catalog.entities, profiles, artwork });
  for (const row of rows) {
    const original = frozen.get(row.catalogId);
    if (!original) continue;
    const id = row.catalogId, entity = entities.get(id), profile = profiles.profiles[id];
    const authored = authoring[row.authoringFile]?.profiles?.[id];
    check(['restored', 'excluded', 'residual-gap'].includes(row.disposition), `${id}: unknown resolution`);
    check(row.independentReview?.status === 'accepted' && !!row.independentReview.reviewer &&
      row.independentReview.reviewer !== row.worker && !!row.rationale, `${id}: independent resolution review missing`);
    check(row.authoringFile === original.authoring.file && same(row.beforeProfile, original.authoring.profile), `${id}: prior authoring chain changed`);
    check(same(authored, row.afterProfile), `${id}: resolution differs from final authoring`);
    check(same(profile, row.afterCompiledProfile), `${id}: resolution differs from compiled profile`);
    check(same(entity, row.afterEntity), `${id}: resolution differs from compiled identity`);
    check(same(entity?.sourceIds, original.entity.sourceIds) && entity?.selectable === original.entity.selectable, `${id}: resolution remapped identity or selectable history`);
    check(same(assets.get(id), original.artwork), `${id}: preserved portrait approval/provenance/bytes changed`);
    const visibility = overrides.entities[id]?.editorialVisibility || null;
    check(same(visibility, row.afterVisibility), `${id}: resolution differs from authored visibility`);
    const restored = row.disposition === 'restored';
    check(publicIds.has(id) === restored && (entity?.editorialVisibility === 'suppressed') === !restored,
      `${id}: resolution disagrees with public selection`);
    check(profile?.reviewStatus === 'editor-reviewed', `${id}: resolution falsified copy approval`);
    check(Array.isArray(row.afterProfile?.sources) && row.afterProfile.sources.length > 0 &&
      row.afterProfile.sources.every(source => source.url?.startsWith('https://') && source.title && source.evidence), `${id}: resolution needs actual claim evidence`);
    if (!restored) check(!!row.exactRemainingGap && !!visibility?.reason, `${id}: exclusion/residual needs an exact reason`);
    if (profile?.identityScope === 'category') check(!!profile.portraitExample && /group|category|family/i.test(profile.typeLabel), `${id}: category representation lacks explicit scope/example`);
  }
  const restored = rows.filter(row => row.disposition === 'restored').length;
  check(publicIds.size === 806 + restored, 'Unscoped public selection change beyond the frozen 96');
  check(ledger?.counts?.public === publicIds.size && ledger?.counts?.restored === restored, 'Resolution counts disagree with actual public projection');
  return { valid: errors.length === 0, errors, reviewed: rows.length, restored, public: publicIds.size };
}
