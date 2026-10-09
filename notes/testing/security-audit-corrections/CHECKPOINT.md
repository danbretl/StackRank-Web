# Security cutover complete

Both exact approved SQL migrations applied to production hrfhakrxsllrqmscxxpb:
- approved20261009052409 -> hosted20261009060218 (unchanged SHA256 ea07a9f75f188826fbae4ef18a8168d1a3ac52d713837f51d4f65b7265d3efe7)
- approved20261009052514 -> hosted20261009070637 (unchanged SHA256 a096c9a23952eed5d1398be08f6d3ddf655e31762a20d4d60a65b56ea67bb7d7)

Local filenames aligned to authoritative hosted history. No SQL replay or history repair.
CLI login-role failure was bypassed through the parent-authorized connected migration
execution path, without changing roles/credentials. Two tool requests for second SQL
expired; readback proved absence before successful reconnect application.

Live metadata plus six anonymous malformed-slug/limit=0 HTTP probes verify access
cutover. All212 local synthetic PostgreSQL assertions pass after filename alignment.
No customer rows or production telemetry bursts. See HANDBACK.md and live receipts.
Weakening rollback still requires separate approval; no Auth settings changed.
Security code/Edge deployment previously verified at eb9a2b07; evidence commit
`d4eb829631065d6d070475d569e1ec1aebb43a1d` is pushed. CI37897518567 passed and
Vercel dpl_DX3kPZnfMpjeYSpxfRo7tAJNy77D is READY at that exact SHA with production aliases.
See cutover-ci.json and cutover-vercel.json. No runtime bytes changed in cutover.

Authorized next task: accessibility audit corrections, AFTER security release closeout.
Audit: /Users/danbretl/Documents/Codex/2026-10-07/task/stackrank-accessibility-audit/audit/.
Parent authorization October9 07:05 UTC (Sentinel_ba9c3968307c8191a0be11a536c014b6).
Accessibility implementation and release state now live in
`notes/testing/accessibility-audit-corrections/CHECKPOINT.md`. Preserve all audit inputs.
