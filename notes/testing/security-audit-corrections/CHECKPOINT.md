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

NO LIVE DATABASE MIGRATION OR AUTH SETTING CHANGE. Exact SQL, hashes, risks and rollback:
LIVE-MIGRATION-APPROVAL.md. Exact-action confirmation has been requested; await Dan/parent response
before application for ONLY the two named migrations on hrfhakrxsllrqmscxxpb. Do not infer
approval from code/deploy authorization. Local files are not hosted protection.

If approved, use main's existing link and normal CLI credential handling:
`supabase migration list --linked`; `supabase db push --linked --dry-run`.
Proceed only if precisely versions20261009052409 and20261009052514 are pending.
Then `supabase db push --linked`, followed by metadata/history and bounded invalid-slug/
zero-row API checks. No secrets/customer rows; stop if credentials inaccessible.
Avoid timestamp-generating MCP migration application, --include-all, history repair,
seed/role flags or blanket default-ACL changes. Old cached viewers need reload after
cutover; links/slugs and authenticated owner management remain unchanged.

Finish exact receipts, disposition statuses, HAND BACK and CLAUDE update in a committed
follow-up. Do not claim global telemetry/Edge rate protection; SR03/SR06 remain bounded
hardening. SR07 Auth flow/config unchanged after independent compatibility review.
