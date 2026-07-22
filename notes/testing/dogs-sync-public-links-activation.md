# Dogs sync and public-link activation

Status: **client prepared; production capabilities disabled.** No migration was applied and no
production state changed while this client path was built.

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
QA should explicitly accept this contract or keep the capability flags disabled pending that schema
work.

## Activation sequence

1. Rehearse the normal pending production sequence as three ordered files:
   `20260709001734_add_tonight_events.sql` (the separately observed Movies telemetry change),
   `20260716090037_add_category_data_tables.sql`, then
   `20260716090038_add_dog_artwork_storage.sql`. The disposable branch/scratch rehearsal covers all
   three and must not be merged into production. The SQL, Data API, two-user, cross-category,
   revocation, and public-link probes in `notes/testing/dogs-supabase-rls-review.md` focus on the
   category-table migration.
2. Obtain explicit authorization for that exact three-file order, then apply it without a branch
   merge. Do not enable the client before post-application probes pass.
3. Change only `DOGS_CATEGORY.capabilities.accountSync` and
   `DOGS_CATEGORY.capabilities.publicSnapshots` in `lib/categories/dogs.js` from `false` to `true`,
   bump the importing cache versions, and rerun unit, mocked browser, and real two-user checks.
4. Update `/privacy` and the corresponding production-smoke assertion in the same release. The
   current statement that Dogs is not included in account sync/public sharing is deliberately true
   while the capability values remain false.
5. Deploy a protected preview and verify signed-out local-only behavior, signed-in no-loss merge,
   publish/update/copy/revoke, anonymous view, and revoked-link denial. Only then request explicit
   authorization for production promotion.

Artwork remains independent: enabling public text snapshots does not enable raster sharing, and an
image is included only when the category, rights policy, asset review, purpose flag, and immutable
delivery checks all allow public-snapshot use.
