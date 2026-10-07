# Data-safety correction assessment — October 7, 2026

Baseline: `033a397e3ea0d7121358fe5910b7acccf4f9f566`. Main has no tracked changes; unrelated untracked files remain in place. Integration branch `fix/data-safety-20261007` is isolated at `/Users/danbretl/src/stackrank-data-safety-release`. The complete Claude archive and source snapshot remain at `/Users/danbretl/src/stackrank-data-safety-audit-20261007T043458Z`; `input-preservation.json` records initial content hashes.

This assessment precedes implementation and is provisional where stated. The final per-finding ledger and verification receipts supersede it.

## Supported causes and refinements

Independent source review agrees with the main failure classes: unowned local mirrors can be merged into another account; Movies persists removal before comparison completion; Movies can write after a failed initial read; stale in-memory tabs overwrite newer device data; union-on-load resurrects intentional removals; undo survives account changes. Movies queue merging repeatedly includes the anonymous key. Movies writes are unordered and status uses one flag for unrelated operations.

Dogs' malformed-row issue is real: its parser returns the same sentinel for missing and present-invalid rows, and initial reconciliation writes all surfaces. The checked-in SQL permits the malformed inner-item fixture even though the current normal UI does not generate it. Coupled ranking/queue reconciliation must fail closed rather than discard rejected rows.

Two claims need narrower wording: the Dogs hung-write probe establishes a request stalled for its observation window, not an infinite hang; Dogs' corrupt ranking is overwritten during boot when another surface triggers canonicalization, otherwise on a later save. Backup fidelity findings must distinguish useful supported fields from intentionally rejected arbitrary fields. Movies delete-before-upsert pack-progress replacement is reachable during restore and needs an independent fault test before upgrading DS-016 from hypothesis. Share completion after account switch likewise needs an explicit delayed-response reproduction.

## Decisions for implementation

1. Use owner-scoped, atomic local envelopes. Never infer ownership of legacy unscoped bytes from whichever session happens to be active. Preserve ambiguous bytes and offer explicit recovery/import; genuine anonymous data also requires consent before entering an account.
2. Keep unfinished Movies comparisons provisional. A reload must retain the original ranking/queue entry. Invalidate undo, pending imports/comparisons, and delayed UI results across owner/session changes.
3. Replace automatic union-on-load for corrected clients with account baseline reconciliation: a clean device adopts remote state exactly; dirty local state with a changed/unknown baseline is preserved and requires an explicit resolution. Do not silently upload it over a clear, restore, or removal.
4. Use existing owner policies and row columns: conditional UPDATE against the exact observed `updated_at`, plus INSERT-only for an observed absent row. Return and validate the affected row; a conflict never falls back to an unconditional upsert. Generate a strictly advancing token and retain the server-returned representation.
5. Serialize local writes with Web Locks and compare the observed local revision. Preserve a stale tab's attempted changes in a bounded recovery path and block account writes. A warning alone is insufficient. If preservation fails or capacity is full, keep the original state and block replacement.
6. Track pending/failed/conflicted state accurately. An aborted/timed-out request may have committed: read back the attempted token and payload before acknowledging or resolving; never blindly retry against a newly advanced baseline. Per-surface partial outcomes must remain visible.
7. Preserve malformed local data and reject malformed remote state without overwriting it. Fix supported backup fidelity issues without weakening category boundaries or changing stable identities/hidden slots.

## Highest-risk scope and limits

Ownership migration and replacement reconciliation affect both applications, all local persistence callers, initial load, auth events, backups, and browser tests. These require integrated browser races, interruption tests, independent review, full verification, and exact-commit CI/production checks before release.

No schema, RLS, credentials, account configuration, or customer-data changes are planned. Existing checked-in grants support conditional writes; any deployed-schema check must be read-only with existing authorized access. Conditional writes are atomic per row, not across ranking/queue/progress rows; partial success must be recoverable and honestly reported.

Old cached clients can still perform unconditional writes. Without server enforcement, this release cannot guarantee deletion/replacement protection across clients that have not updated. The corrected client must detect those changes, preserve conflicts, and document that limit. Existing leaked or lost data cannot be identified or repaired automatically; no global cleanup is authorized.

All 30 audit entries (14 reported defects, 3 hypotheses, 2 accepted limitations, 11 rejected leads) will receive final independent dispositions. Historical green tests and mock receipts are supporting evidence, not production RLS proof.
