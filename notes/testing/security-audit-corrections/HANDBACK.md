# StackRank security correction release

Baseline: `c236ef0faf1733eb1ede8730e2cf665e42a7ccb5`. Work is isolated on
`fix/security-audit-20261009`. This is the October 9 Movies/Dogs security assignment,
not the previously completed Dogs catalog audit. Original security audit and source
copies are immutable; `start.json` records 17,407 hashed entries and symlinks.

## Findings and corrections

`dispositions.json` accounts for SR-01 through SR-08 and independently discovered
EDGE-01. Independent Astra assessment and final code review are in
`share-auth-architecture.md` and `independent-release-review.json`.

- **SR-01/SR-04:** Movies owner identifiers and direct listing are removed by exact-slug
  public read functions plus removal of public share-table access. The audit missed the
  existing project brief's unlisted-link intent. URLs/slugs and anonymous viewing remain;
  owners retain their authenticated publish/update/revoke operations. Viewer clients do
  not adopt stored sessions or URL tokens. Before the SQL cutover only missing-RPC errors
  permit legacy reads; the verified SQL cutover now removes that exposure.
  Already-loaded old viewers need reload after cutover. Known links and saved copies
  cannot be revoked retroactively by this change.
- **SR-02:** fresh hosted metadata confirms unnecessary maintenance privileges on six
  legacy tables, expanding the audit's originally verified three. Revoke only
  TRUNCATE/TRIGGER/REFERENCES; no normal owner DML or default privilege changes.
  No HTTP TRUNCATE exploit was demonstrated.
- **SR-03:** reject telemetry statements above 20 rows while retaining the session cap.
  This bounds persisted burst size, not repeated small requests, concurrency or total
  ingestion cost. The AFTER trigger also does not eliminate work before rejection.
- **SR-05:** reject invalid recommendation seeds before upstream work. The original
  authority stayed on TMDB; no SSRF or secret-exfiltration claim is made.
- **SR-06/EDGE-01:** add missing JSON-proxy limits, a header-independent budget per
  instance and a real memory bound for rate-limit keys. Headers remain untrusted hints;
  distributed/restarted instances remain a limit, and a busy instance may reject new
  legitimate clients. Books retains its usual quota with bounded shared-helper storage.
- **SR-07:** retain current Auth flow/configuration. No takeover or attacker-controlled
  admitted host was established. PKCE would affect cross-device magic-link completion;
  narrowing redirects affects existing development/preview sign-in. Those live settings
  require independent compatibility work and exact approval, not a mechanical audit fix.
- **SR-08:** reject unsupported Movies payload keys on new payload writes, while allowing
  existing untouched payloads to be revoked. A NOT VALID CHECK was rejected because it
  would still block revocation updates. Public RPCs omit old extra keys without scanning
  or rewriting customer records. Nested published item content is not newly redefined.

The fresh advisory report also identifies direct EXECUTE grants on the telemetry trigger
function; the applied migration removes those unnecessary grants. A trigger-only function
is not thereby a demonstrated callable privilege exploit. Its remaining password-policy
advisory is outside this passwordless client correction; no Auth setting was changed.

## Verification and publication status

Candidate implementations passed 212 native PostgreSQL assertions with synthetic accounts,
27 Deno tests plus 12 real-handler stub steps, and 24 actual-client browser cases. Native
proof includes both migrations, role isolation, conditional saves, revocation of legacy
payloads, exact-slug reads, column grants, and 24 rollback checks. Browser proof includes
session isolation, strict fallback, hostile text, desktop/mobile and both no-CSP and adapted
production-CSP conditions. Hosted transport/JWT/Auth delivery are separate boundaries.

Full final-tree verification passed: 660 Node, 58 Python, 27 Deno tests plus 12
handler steps, 44 staged application flows, 45 data-safety cases and 24 security
browser cases. Deployment classification/determinism passes with 2,172 public files.
See `local-verification.json`. Initial validation runs retained two stale test
expectations (inline anonymous options and app cache193); both were updated and the
entire final tree passed. Runtime/SQL hashes still match independent review.

Product **`eb9a2b0735f18d1308d450be6bf504721c36c39a`** is on remote main.
[Exact CI run37889517069](https://github.com/danbretl/StackRank-Web/actions/runs/37889517069)
succeeded, including the new native database suite. Vercel production deployment
`dpl_8MWoqFoEftK83RaSDawBLRWRByNh` is READY at that exact SHA with the www/apex aliases.
All six Edge consumers are ACTIVE with unchanged JWT settings; retrieved deployed
source matches the tested tree. Original deployed source matched baseline before
replacement and remains in the ignored local rollback archive.

Production passed 49 paced smoke checks, 11 exact file-byte comparisons, six excluded
private-path checks and seven ordinary Edge input calls. Four fresh signed-out renders
cover desktop/phone Movies and Dogs and navigation. Those renders intentionally block
backend/provider/font/telemetry traffic, so Movies' unavailable-provider display is
expected; normal provider operation is separately checked by the ordinary Edge smoke.
No production load tests, forged-header attacks or customer records were used. See
`product-ci.json`, `product-vercel.json`, `edge-deployment.json`,
`edge-deployed-source-check.json`, `production-smoke.json`, `production-byte-checks.json`,
`edge-live-smoke.json` and `production-rendered.json`.

**Both approved migrations are applied and verified in production.** Dan approved the
exact SQL at 05:56 UTC; the parent also authorized the identical-SQL connected-tool
execution after CLI login-role initialization failed. No login role or credentials were
altered. The first applied as `20261009060218`, the second as `20261009070637`.
Repository filenames now match hosted history; SQL bytes retain their approved hashes.
The approval packet retains original versions20261009052409 /20261009052514 as historical
identifiers. No migration-history repair, SQL replay or rollback was performed.
Two second-migration requests expired; metadata confirmed absence before the successful
post-reconnect request. See `live-migration-receipt.json`.

Live metadata verifies grants, public-column access, public projections, owner policies,
function configuration and triggers. Six bounded anonymous HTTP probes passed: both
exact-slug RPCs accept anonymous malformed-slug requests with empty results; both share
tables deny zero-row slug and owner-ID selection. All212 native database assertions
passed again against the renamed exact SQL. Populated link viewing, revocation,
normal owner operations and telemetry20/500 boundaries use local synthetic fixtures;
no live customer accounts, payloads or telemetry bursts were exercised. Readback plus
these fixtures establishes the intended database behavior without claiming a live
populated-account end-to-end test. See `live-database-review.md`,
`live-database-verification.json`, `live-cutover-http.json` and `post-cutover-native.json`.

The advisor now flags the two intentionally public SECURITY DEFINER RPCs for anon and
authenticated execution. Their exact-slug/active filters, fixed SQL, empty search_path
and public-only projection implement the approved guest viewing boundary; removing
execution would break it. The unrelated leaked-password-protection advisory remains.
[RPC advisory guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [password advisory guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No Auth configuration was changed. See `post-cutover-advisors.json`.

Cutover evidence commit `d4eb829631065d6d070475d569e1ec1aebb43a1d` is on remote main.
[Exact CI37897518567](https://github.com/danbretl/StackRank-Web/actions/runs/37897518567)
passed; Vercel `dpl_DX3kPZnfMpjeYSpxfRo7tAJNy77D` is READY at the same SHA with
production aliases. See `cutover-ci.json` and `cutover-vercel.json`.

## Preservation and rollback

No customer records were queried or changed. Hosted inspection is ACL/policy/function
metadata plus malformed-slug/zero-row anonymous HTTP only; every row mutation test uses the disposable local engine. Existing ranking,
backup/recovery, account-isolation and catalog behavior remain under the full regression
suite. Main's unrelated untracked files and all prior worktrees/archives remain in place.
Off-Mac archive backup remains unverified; nothing was deleted or relocated.

Vercel continues to build only `dist/public`; no private source cache or native archive is
published. GitHub Pages remains disabled. Six Edge functions require deployment because
they consume the shared limiter; Vercel deployment alone does not update them.

Prefer rolling forward. Local rollback SQL is tested but restores prior exposure and thus
requires separate exact approval before live use. Keep RPC-capable viewers after database
cutover; reverting to an old direct-table viewer alone breaks viewing. No user-data reset,
identity migration, link rotation or customer cleanup is part of rollback.
