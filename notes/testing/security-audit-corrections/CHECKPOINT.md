# Security corrections checkpoint

Active assignment is the October 9 security audit, not the completed Dogs catalog audit.
Baseline `c236ef0f`; isolated branch `fix/security-audit-20261009` in
`/Users/danbretl/src/stackrank-security-release`.

Product `eb9a2b0735f18d1308d450be6bf504721c36c39a` is committed, fast-forwarded into main,
pushed and remote-ref verified. Vercel production `dpl_8MWoqFoEftK83RaSDawBLRWRByNh`
is READY at this SHA with production aliases. Six Edge consumers deployed and every
retrieved source matches the tested tree. CI run 37889517069 completed successfully, including native database regressions.

Local full verification passed: 660 Node, 58 Python, 27 Deno +12 handler steps,
44 staged app flows, 45 data-safety cases, 24 security browser cases. Native database
212 assertions passed independently, including both migrations and rollback.
Production: 49 paced smoke checks, 11 exact bytes, 6 excluded paths, 7 ordinary Edge
input checks and 4 read-only desktop/phone renders passed. Render harness blocks all
backend/font/telemetry traffic; expected Movies unavailable-provider state is documented.
Audit/source originals rehashed: all17,407 entries unchanged. Main unrelated files intact.

Dan approved the exact two migrations at 05:56 UTC on October 9 (message
`Sentinel_d26069f7677081918f3d9337d4f8933f`). Both SQL hashes still match the approved
packet. No live migration has yet run: `supabase migration list --linked` failed
while initializing `cli_login_postgres` (HTTP400 / SQL42501; insufficient platform
role permissions). Do not retry or change credentials/roles. Fresh metadata matches
the approved baseline grants and confirms both migrations absent. Sanitized receipt:
`live-migration-attempt.json`.

The connected MCP migration tool is an available alternative, but assigns its own
migration timestamps. Independent database review considers exact-SQL application
and byte-preserving local filename reconciliation within existing approval; the
prior CLI recommendation was to avoid history drift, not a separate approval rule.
A clarification was nevertheless sent to the parent before that assessment arrived;
await its response before taking that proposed alternative. Preserve the original
approved filenames/hashes in evidence; never manually edit hosted migration history.
After application verify metadata/history and bounded invalid-slug/zero-row HTTP
checks. No customer rows, role changes or weaker-access rollback.

Finish exact receipts, disposition statuses, HAND BACK and CLAUDE update in a committed
follow-up. Do not claim global telemetry/Edge rate protection; SR03/SR06 remain bounded
hardening. SR07 Auth flow/config unchanged after independent compatibility review.
