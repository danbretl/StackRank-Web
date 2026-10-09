# Independent database correction review

The local native PostgreSQL run passes **212 assertions**, including reproduction of the old weaknesses, correction controls and explicit rollback. Both candidate migrations remain subject to the user's separate live security-settings confirmation gate. This document does not claim that these protections are deployed.

## Decisions

- **SR-02 — confirmed, scope expanded by fresh metadata.** Remove only TRUNCATE, REFERENCES and TRIGGER from anon/authenticated on rankings, movie_lists, pack_progress, shared_lists, product_events and suggestion_packs. Existing read/write grants and owner RLS remain unchanged. The original audit proved direct SQL TRUNCATE; no PostgREST truncate endpoint or arbitrary-SQL RPC has been demonstrated. Fresh metadata, recorded separately by the release lead, supports the expanded six-table scope. No default privileges are changed.
- **SR-03 — confirmed; bounded correction with explicit residual risk.** Retain the 500-per-client-session check and reject INSERT statements exceeding 20 rows, including rotating session IDs. Movies and its public viewer insert one event at a time, so this preserves their current API. The AFTER statement trigger rejects the transaction after PostgreSQL processes inserted rows; it bounds persisted rows per statement, not total request parsing/work. Repeated smaller requests and rotating sessions remain possible. This is not a global request-rate or total-storage cap, and does not certify concurrent-request quota behavior.
- **SR-08 — confirmed hardening; reject proposed NOT VALID CHECK for compatibility.** Even NOT VALID CHECK constraints apply to later updates, including a revocation-only update to a legacy payload. A BEFORE INSERT OR UPDATE OF payload trigger instead enforces the existing top-level Movies contract (`movies`, optional `displayName`) on payload writes while allowing revocation of untouched legacy payloads. Existing object/array/size constraints remain. No row scan, rewrite, cleanup or customer-data inspection is required. Existing payloads can be replaced with conforming content. Separately, the exact-slug read RPC projects only supported top-level fields without changing stored bytes.

## Files and native test boundary

Migration `supabase/migrations/20261009052409_harden_legacy_privileges_and_payload_writes.sql` was created using installed Supabase CLI 2.109.1 `migration new`, after inspecting its help. It is transaction-wrapped. The replacement telemetry function retains its explicit search path and fully qualified table query; the new payload trigger is SECURITY INVOKER, has a fixed catalog-only search path, and no PUBLIC/anon/authenticated direct execution grant.

Run `python3 scripts/test-security-database.py`. The harness discovers PostgreSQL through `pg_config --bindir`, accepts `--pg-bin`, or locates initdb on PATH. Tested locally with PostgreSQL 17.11; no version-specific extension is required. On macOS the sandbox denies PostgreSQL shared memory, so the successful run used approved process escalation. Every run creates a fresh cluster under ignored `reports/security-audit-corrections/`, with a private 0700 Unix socket, no TCP listener, bounded memory, 8-second statement timeout and 2-second lock timeout. Its finally block stops the owned cluster. It accepts no remote database URL or credentials.

The prerequisite SQL uses synthetic auth-claim functions, a minimal Storage schema and inert cron adapter. The 15 original migrations otherwise execute unchanged. Original legacy rankings CREATE DDL is absent from version control; its recorded columns are modeled with synthetic defaults. Historical and freshly confirmed legacy privileges are explicitly supplied; there is no claim that a blank PostgreSQL instance reproduces unspecified Supabase defaults. The tests connect as a non-superuser NOINHERIT/NOBYPASSRLS authenticator and SET LOCAL ROLE anon/authenticated. Helper functions run as the caller. This is native PostgreSQL policy/privilege execution, not PostgREST/JWT/GoTrue/Storage HTTP/scheduler validation.

The local fixtures and bootstrap derive from inspected immutable auditor scripts and contain only fabricated owners, lists and snapshots. No script is executed in, or writes to, the audit directory. Failed harness runs are retained: the initial sandbox run could not allocate shared memory; the first expanded share run exposed a fixture collision with the existing owner/category unique key, corrected by assigning an unused synthetic category. Neither failure indicated a product regression.

Coverage includes baseline 2,000-row rotating-session acceptance; rolled-back direct SQL TRUNCATE bypass; all six tables × two roles × three removed privileges plus actual denied TRUNCATE; 20-row acceptance/21-row rejection; 500 accepted same-session rows in batches and rejected 501st; direct trigger-call denial; supported and extra-key payload writes; malformed legacy snapshot read/revoke/rewrite controls; all six private ranking/list/progress surfaces' owner read, foreign read/update/transfer denial, conditional save, stale-save refusal and backup/replacement compatibility. Share-specific checks include anonymous explicit column reads (not just count), authenticated owner-only enumeration, both exact-slug RPCs, revoked/invalid/unknown/null inputs, active wrong-category rejection, omitted owner fields, legacy extra-key projection, owner revocation/restore using RETURNING, and SECURITY DEFINER/empty search-path/PUBLIC EXECUTE metadata.

See `database-results.json` for assertion names, exact migration hashes, test file hashes and the retained raw report path. Local cluster artifacts are not deployment inputs.

## Rollback

`rollback-database-hardening.sql` restores the original telemetry function, removes only the new payload trigger/function and restores the recorded maintenance privileges. `share-rollback.sql`, prepared by the independent release lead, restores old public-table access but retains RPCs so the new viewers continue working. Both scripts were executed only against the disposable local cluster; 24 rollback assertions verify the deliberately restored prior weaknesses and new-viewer RPC compatibility. A live rollback reopens findings and requires its own action-time approval. Prefer retaining the compatible clients and rolling forward.

## Primary documentation checked

- PostgreSQL 17 CREATE TRIGGER: https://www.postgresql.org/docs/17/sql-createtrigger.html — UPDATE OF triggers and transition relations.
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security — grants and owner policies are separate controls.

No hosted customer records, credentials, or security settings were read or changed by this worker.
