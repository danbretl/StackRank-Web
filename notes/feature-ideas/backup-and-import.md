# Feature: Backup, restore, and title-list import

Status: **shipped (2026-06-27)**

## What shipped

- List settings now has a **Backup & import** section.
- **Download backup** saves a versioned `stackrank-backup-YYYY-MM-DD.json`
  containing the ranking, Watch next, Not for me, pack progress, and Share
  Studio options.
- **Restore backup** validates and normalizes the JSON, confirms the destructive
  replacement, writes the exact state locally and to Supabase where available,
  and offers a short-lived undo.
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

- `saveRanking()` now always refreshes localStorage before attempting the remote
  Supabase upsert. This prevents merge-on-load from resurrecting a pre-import or
  pre-clear local ranking.
- Backup restore is an explicit exact-replacement path rather than the normal
  never-shrink merge path.
- Backup parsing keeps only known movie fields, validates ids/years, deduplicates
  each list, and enforces ranking → Watch next → Not for me precedence.
- Pack progress restore replaces remote rows for the signed-in list before
  upserting restored rows; unknown legacy pack slugs remain local but are not
  sent through the current foreign-key-backed remote table.

## Validation

- `tests/backup.test.js` covers title parsing, exact-match selection, backup
  validation/round-trip, cross-list deduplication, and imported ranking order.
- The E2E smoke suite covers ambiguous-title review, ranking replacement
  consent, queue normalization, exact local persistence, full backup restore,
  and reload persistence.
- Desktop and 390×844 mobile browser QA verified the input/review layouts,
  matching controls, replacement warning, and clean console.

## Signals and follow-ups

There is no product analytics layer today, so v1 success is assessed through
direct usage and support feedback. If instrumentation is added later, useful
signals are import starts/completions, exact vs manually reviewed matches,
skipped titles, restore failures, and Undo usage after replacement.

Potential follow-ups:

- Exercise backup restore while signed in against production Supabase to confirm
  exact cross-device replacement, including remote `pack_progress`.
- Add a retry control directly on failed TMDB rows if users encounter transient
  search failures often; v1 uses Back → Match titles to retry the batch.
- Consider CSV/Letterboxd-specific parsing only if real exports expose formats
  the current one-title-per-line parser cannot handle cleanly.
