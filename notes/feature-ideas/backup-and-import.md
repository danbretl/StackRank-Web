# Feature: Backup, restore, and title-list import

Status: **shipped (2026-06-27); data-safety correction October 7, 2026**. Release evidence: `notes/testing/data-safety-corrections/HANDBACK.md`.

## What shipped

- List settings now has a **Backup & import** section.
- **Download backup** saves a versioned `stackrank-backup-YYYY-MM-DD.json`
  containing the ranking, Watch next, Not for me, pack progress, and Share
  Studio options.
- **Restore backup** validates and normalizes JSON, warns about identity-affecting normalization, and confirms replacement of the current owner's state. Device persistence and account synchronization have separate outcomes; partial account saves are reported and retryable. Undo belongs to the same owner session. Preserve the original backup if warnings or save errors appear.
- **Import titles** accepts one ordered movie title per line, with optional
  numeric/bullet prefixes and optional release years.
- Titles are matched through the existing `tmdb-search` proxy. Only a unique
  exact title match (and exact year when supplied) is selected automatically.
  Ambiguous results require an explicit movie selection or Skip.
- The review step preserves input order, rejects duplicate TMDB selections, and
  requires a confirmation checkbox before replacing a non-empty ranking.
- A title import replaces only the ranking. Watch/hidden queues remain, except
  any movie now ranked is removed from those queues.

## Data-integrity decisions

- Movies and Dogs persist ranking/list/progress in separate owner-scoped atomic local envelopes. Legacy bytes are retained for explicit recovery; account sign-in does not automatically adopt unowned or anonymous lists. Known foreign-owner data remains inaccessible through recovery controls.
- A clean account mirror adopts remote state exactly. Dirty local state saves only against an unchanged known baseline; conflicting state pauses for explicit resolution instead of silently unioning removed items back into the account.
- Local persistence is acknowledged before account writes. Remote saves use conditional per-row UPDATE against the observed `updated_at`, or INSERT when the row was observed absent. Error/timeout readback must confirm the attempted token and payload. There is no unconditional-upsert fallback and no multi-row transaction guarantee; partial outcomes are reported and retained for recovery.
- Backup parsing preserves supported identity/order fields, validates IDs/years, deduplicates within lists and enforces ranking → Watch next → Not for me precedence. Movies warns before applying identity-affecting normalization. Dogs keeps stable and hidden IDs in backups and reports unsupported pack-progress omissions; category boundaries remain enforced.
- Pack-progress restore does **not** delete existing account rows before attempting writes. Removed known rows receive conditional empty states, restored known rows are conditionally saved, and unknown legacy slugs remain local. A failure on one row cannot be described as complete account replacement.
- Recovery copies are bounded and never automatically evicted. Previously resolved copies remain accessible for explicit download and dismissal. A failed browser write can leave only a session-memory copy; keep that tab open and download it before reload/close. A browser-local recovery archive is not an off-device backup.
- Old cached clients still perform their former unconditional writes. These corrections protect the updated client and detect conflicting account versions; they cannot guarantee fleet-wide deletion safety or repair past loss/leakage.

## Validation

- Pure tests cover supported backup round trips, warnings, owner separation, bounded recovery, local revision conflicts, conditional writes/readback and database-compatible payload size.
- Staged browser flows exercise the real application and vendored client against a loopback synthetic Supabase, with controlled responses, owner changes, interrupted comparisons, stale tabs, replacement conflicts and storage failures. Network denial prevents these fixtures from writing customer accounts.
- Existing broad browser checks cover import consent, queue normalization, restore/download behavior and responsive Movies/Dogs flows. These are not proof of deployed RLS, customer-data correctness or successful production cross-device mutations. Exact final tests/CI/deployment receipts belong in the committed data-safety hand-back.

## Signals and follow-ups

Import/restore regressions are assessed through automated tests, privacy-bounded product events where instrumented, and user reports. Events must never contain imported titles, account identities or backup contents.

Potential follow-ups:

- Any future real-account mutation probe requires explicit authorization and isolated test accounts. This correction does not authorize customer-data writes, schema/RLS changes or cleanup.
- Add a retry control directly on failed TMDB rows if users encounter transient
  search failures often; v1 uses Back → Match titles to retry the batch.
- Consider CSV/Letterboxd-specific parsing only if real exports expose formats
  the current one-title-per-line parser cannot handle cleanly.
