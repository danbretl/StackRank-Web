# Independent live database verification

**Pass: all 35 metadata comparisons/checks.** On October 9, 2026, two read-only catalog queries independently verified production project `hrfhakrxsllrqmscxxpb`. No customer records, customer-row counts, credentials, writes, role changes or rollback were accessed/performed.

- Approved `20261009052409` is recorded as hosted `20261009060218` (`harden_legacy_privileges_and_payload_writes`).
- Approved `20261009052514` is recorded as hosted `20261009070637` (`restrict_public_shares_to_exact_slug`).
- Renamed repository SQL files retain the exact SHA-256 values in the approval receipt. All four live function bodies match the approved SQL byte-for-byte.
- All **36 effective maintenance privileges** (six tables × two roles × TRUNCATE/TRIGGER/REFERENCES) are denied. Every one of the **13 share-table columns** denies effective anonymous SELECT. Table/column grant changes match only the approved revocations; normal authenticated owner grants remain.
- All **31 owner policies** remain unchanged. Nineteen owner policies and the remaining non-owner policies were compared with the fresh October 9 pre-migration inventory; the twelve private-category owner policies were compared with the preserved October 7 metadata because the fresh inventory omitted those three tables. Only the two approved public-read policies disappeared. All ten inspected tables retain RLS. Default ACLs remain unchanged.
- Both public RPCs are SECURITY DEFINER, use an empty fixed search path, permit anon/authenticated execution, deny PUBLIC execution, and expose only the approved result fields. Their exact approved bodies enforce one valid active slug, exclude owner identifiers, project supported payload fields and restrict the Dogs endpoint to Dogs.
- The enabled telemetry AFTER INSERT statement trigger uses `new_rows`; its exact function body contains the **20-row statement guard and 500-row session cap**. Browser roles cannot invoke the trigger function directly.
- The enabled payload trigger is BEFORE INSERT OR UPDATE OF payload, runs per row as SECURITY INVOKER with a fixed catalog-only search path, and denies direct browser execution. Revocation-only updates therefore do not run this new payload check.

Evidence: `live-database-verification.json` contains both exact metadata queries, their results, approval-to-hosted version mapping, comparison details and the 35 passing checks. These are metadata assertions, separate from the **212 native synthetic PostgreSQL assertions** and the release lead's HTTP/browser checks.

Residual limits: this worker did not exercise populated live customer links, actual owner CRUD, telemetry writes, PostgREST authentication, or scheduler execution. Telemetry still permits repeated small requests and incurs work before its AFTER-trigger rejection; this is not a global flood defense. Exact-slug public sharing remains public to anyone possessing the link and cannot retract previously copied data. Broad default grants remain unchanged, so future objects still require explicit privilege review. No blocker was found in the approved live database changes.
