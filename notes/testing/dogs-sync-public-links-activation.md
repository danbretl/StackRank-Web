# Dogs sync and public-link activation

Status: **production schema and post-apply probes complete; client capabilities enabled locally.**
The authorized three-file production sequence passed schema, RLS, two-user, anonymous-link,
revocation, Storage, advisor-baseline, and zero-residue checks on July 22, 2026. The local release
candidate now enables Dogs account sync and public text snapshots while keeping raster export off.
No integrated client commit, push, deployment, or production-root redirect change has occurred.

The Dogs browser client now contains the complete additive-table path for ranking, Curious about,
Not for me, pack progress, auth, and owner-managed public snapshots. Local storage is always written
first. Signed-in loads merge the newest local/remote order and append older-only entities before the
merged result is written back to both surfaces. After the catalog loads, stored VBO ids found in a
runtime entity's `sourceIds` are upgraded to its current canonical id and deduplicated without
changing unrelated item order.

The public renderer is a separate `dogs-shared.html` / `dogs-shared.js` artifact at
`/s/dogs/:slug`. Its Supabase client sets `persistSession`, `autoRefreshToken`, and
`detectSessionInUrl` to false and selects only the anonymous safe columns. Legacy Movies
`/s/:slug`, its table, and its payload remain unchanged.

## Conflict contract

Remote writes are scoped to the row that changed: ranking, each list type, and pack progress do not
overwrite one another. The local queue payload carries backward-compatible per-list timestamps so
a Curious-about edit cannot make a stale Not-for-me copy look newer. Initial account loading is a
serialized no-loss reconciliation; ordinary writes wait until that reconciliation has captured the
remote rows.

Concurrent edits to the **same row** remain last-writer-wins, matching the mature Movies sync
contract and the category tables' `updated_at` design. StackRank is a single-owner app rather than a
collaborative editor; each tab still retains its local copy, and the next load appends older-only
entities. True same-row compare-and-swap would require an additional reviewed database RPC or row
revision migration and is intentionally not implied by this client activation. The protected-preview
QA should explicitly accept this contract before deployment; the capability flags were enabled only
after the production schema and isolation probes passed.

## Activation sequence

1. **Complete:** Rehearse the normal production sequence as three ordered files:
   `20260709001734_add_tonight_events.sql` (the separately observed Movies telemetry change),
   `20260716090037_add_category_data_tables.sql`, then
   `20260716090038_add_dog_artwork_storage.sql`. The disposable branch/scratch rehearsal covers all
   three and must not be merged into production. The SQL, Data API, two-user, cross-category,
   revocation, and public-link probes in `notes/testing/dogs-supabase-rls-review.md` focus on the
   category-table migration.
2. **Complete:** Dan authorized that exact order for project `hrfhakrxsllrqmscxxpb`; the CLI applied
   all three files and every post-application schema, grant, RLS, constraint, mature-Movies,
   two-user, cross-category, anonymous active/revoked snapshot, and Storage probe passed. Fixture
   cleanup left zero rows, objects, or Auth users.
3. **Complete:** Change only `DOGS_CATEGORY.capabilities.accountSync` and
   `DOGS_CATEGORY.capabilities.publicSnapshots` in `lib/categories/dogs.js` from `false` to `true`,
   bump the importing cache versions, and rerun unit, mocked browser, and real two-user checks. The
   capability/static suite, cache check, signed-out Browser check, and mocked no-loss
   sync/publish/update/copy/revoke/anonymous/revoked E2E flow passed; the earlier real two-user
   production probe remains the data-plane evidence.
4. **Complete:** Update `/privacy` and the corresponding production-smoke assertion in the same
   release. The revised policy and its desktop/mobile privacy E2E assertion passed locally.
5. **Next:** Deploy a protected preview and verify signed-out local-only behavior, signed-in no-loss merge,
   publish/update/copy/revoke, anonymous view, and revoked-link denial. Only then request explicit
   authorization for production promotion.

Credential hygiene is complete for this release. A private operator-output redaction mistake exposed
the confidential legacy service-role JWT and the public-by-design legacy anonymous JWT; no modern
publishable or secret key was exposed, the one affected temporary artifact was deleted, and
repository/temporary-file rescans are clean. On 2026-07-22 both legacy API keys were disabled and the
previous legacy HS256 signing key was revoked, leaving the current P-256 signing key active. The
modern-key bounded production probe passed afterward. No key value belongs in source or this note,
and the legacy path must not be re-enabled.

Artwork remains independent. The initial 28-asset/56-WebP batch is immutably delivered and enabled
for normal UI display, but every public-snapshot and raster-export artwork purpose remains false.
Enabling public text snapshots therefore includes no image unless the category, rights policy,
asset review, purpose flag, and immutable-delivery checks all separately allow that use.
