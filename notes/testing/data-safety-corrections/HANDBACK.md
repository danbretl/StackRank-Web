# Movies and Dogs data-safety correction — hand-back

Product **`d1809a43d71098987461e1367fdbc5fc129bcaf8`** is pushed to `main` and Vercel production is READY. Production smoke, exact changed-file hashes, exclusion checks and desktop/phone rendering passed. Exact-commit GitHub CI also passed on its first attempt.

Baseline: `033a397e3ea0d7121358fe5910b7acccf4f9f566`. The isolated integration branch is `fix/data-safety-20261007` at `/Users/danbretl/src/stackrank-data-safety-release`; `main` was fast-forwarded without resetting, stashing or cleaning the original checkout. The documentation-only follow-up containing this hand-back can be identified with `git log -1 --format=%H -- notes/testing/data-safety-corrections/HANDBACK.md`; final delivery separately verifies that revision's CI and deployment.

## Result and audit decisions

All **30 audit entries** received independent dispositions in [dispositions.json](dispositions.json). Scoped source/evidence reviews are in [movies-adjudication.json](movies-adjudication.json), [dogs-adjudication.json](dogs-adjudication.json), [independent-review.json](independent-review.json) and [release-review.md](release-review.md).

| Audit entries | Decision |
| --- | --- |
| DS-001–013 | Confirmed correction scope implemented. The hung-request claim is bounded to the observed stall; Dogs' corrupt-local boot overwrite required another surface to trigger canonicalization. |
| DS-014 | Dogs supported progress export fixed. Movies' documented supported-field/year bounds retained; identity-affecting normalization now warns. Arbitrary-field preservation was rejected. |
| DS-015–017 | All three hypotheses independently reproduced and corrected: PostgreSQL byte-limit mismatch, delete-before-replace pack loss, and delayed account share responses. |
| DS-018–019 | Historical clock ordering and same-row last-writer behavior are mitigated for corrected clients by exact-token conditional writes and explicit conflicts. Older clients remain a stated limitation. |
| DS-R01–R11 | Rejected leads independently upheld within the evidence boundaries documented in the ledger. |

Unowned legacy data and unreadable/conflicting copies are safely retained for explicit recovery. No customer records were cleaned up or assigned to an inferred owner. No verified correction remains deferred; the limits below remain genuine limits rather than fabricated resolutions.

The Dogs catalog is unchanged: **900 public / 339 hidden / 902 complete / 1,239 retained IDs**. Hidden IDs, ranking slots, backups and public-sharing exclusions remain intact. This release adds no cohort, portrait generation, identity merge or renumbering. The earlier Dogs catalog correction and completed-holds releases remain documented in their own hand-backs.

## Behavior that changed

- Movies and Dogs now store atomic, owner-scoped device envelopes. Unowned legacy bytes stay preserved; known owner-qualified legacy data keeps that owner. Anonymous work requires explicit consent before entering an account. Account changes invalidate pending comparisons, imports, undo and delayed responses.
- Local commits use Web Locks and owner revisions. A stale tab preserves its attempted edit and blocks further writes with an explicit reload/recovery path. Missing locks, quota failures and malformed data fail closed. A failed departure save can retain an owner-filtered session-only copy with a persistent warning and download action.
- Device saves start immediately, independently of network waits. Every remote request also confirms the current local snapshot is durable before sending. Movies re-rank and queue comparisons retain their original durable entries until settled.
- Clean mirrors adopt account state exactly, including removals. Dirty state writes only against its observed `updated_at`; absent rows use INSERT-only. Changed/unknown baselines preserve conflicts. Returned rows and ambiguous outcomes are checked, including a committed request followed by an automatic retry returning zero rows. There is no unconditional-upsert fallback.
- Sync status distinguishes pending, conflict, error and confirmed outcomes per surface. Restore reports local persistence separately from account saves. Pack replacement uses conditional empty states for removed known rows, without deleting all rows first. Database-size guards account for PostgreSQL `jsonb::text` formatting.
- Recovery copies remain bounded, downloadable and explicitly dismissible even after review. Controls work in normal page flow on desktop and phones. Home counts read only the matching owner envelope; privacy and sign-out copy reflect retention and genuine anonymous work.

No schema, RLS, credentials, account settings, Edge functions or hosting/security configuration changed. Read-only deployed metadata confirmed the existing table columns, grants, owner policies and size constraints required for conditional writes. [deployed-schema-readonly.json](deployed-schema-readonly.json) contains that evidence, not customer rows.

## Verification and release receipts

Final local `npm run verify` passed on unchanged runtime source:

- **656 Node, 58 Python and 24 Deno tests**.
- **44 existing staged browser flows plus 45 strict safety flows**. The safety runner fails on uncaught browser exceptions and records source hashes before/after. All final cases passed with unchanged source hashes.
- Syntax/cache checks, Movies packs, Dogs catalog/profile/artwork/packs and N validators, and deterministic deployment-contract builds passed.
- The final public closure contains **2,171 files / 173,226,483 bytes**, digest `80975a4505249456567097cd283ea304355e363d1ed1aa2e033e94fd2e1dc572`. New runtime helpers are included; private evidence and test tooling are excluded.

[local-verification.json](local-verification.json) contains exact report paths. Browser coverage and isolation limits are described in [browser-regression-contract.md](browser-regression-contract.md). Tests use fresh Chrome profiles and synthetic loopback accounts; no customer-account mutation probes or mobile emulators were used.

Independent review and browser barriers caught additional implementation defects before publication, including overlapping activation, delayed initial reads, deferred local saves behind hung requests, a current-snapshot durability gate, inaccessible recovery capacity, session-only warnings and overlapping phone controls. They were corrected and regressed. Intermediate failures and fixture corrections are retained in ignored reports; final green receipts supersede them. The repeated-mutation transport behavior is observed; it is not falsely attributed to a proven SDK retry policy.

- Product CI: [GitHub run 37581202697](https://github.com/danbretl/StackRank-Web/actions/runs/37581202697), exact product SHA; see [product-ci.json](product-ci.json) for its successful receipt.
- Production: [Vercel deployment](https://vercel.com/danbretl-2590s-projects/stackrank/4zEUPfm9GnGdVficTG52NLAhdGNo), `dpl_4zEUPfm9GnGdVficTG52NLAhdGNo`, exact product SHA, READY and aliased to `www.stackrankapp.com`; [product-vercel.json](product-vercel.json).
- **49 production smoke checks, 26 exact file hashes, eight excluded-path 404 checks and four rendered views passed**. Scripted requests were limited to two per second; no broad portrait crawl or challenge bypass occurred. [production-verification.json](production-verification.json), [product-live-files.json](product-live-files.json), [product-rendered-review.json](product-rendered-review.json).
- Rendering loaded actual production static files with backend/provider/telemetry requests blocked. It verifies the frontend, fresh signed-out navigation, 900 Dogs entries and responsive layout; it does not prove live TMDB/Supabase provider health or signed-in production writes. No mitigation challenge or live mutation request occurred.

## Remaining boundaries and rollback

1. Older cached clients can still issue their former unconditional writes. This client-only correction does not provide fleet-wide deletion protection, identify past leakage/loss, or automatically repair customer data. Reload older tabs before replacing account data.
2. Conditional writes are atomic per row, not across ranking, queues and progress. Partial account saves remain possible; the UI preserves and reports them for retry or explicit resolution.
3. Recovery is browser-local and bounded. Storage denial/quota failure may leave only a session-memory copy; keep that tab open and download it. Clearing browser storage or closing that tab can remove the respective copies. No off-Mac archive backup was verified.
4. Real-account mutation/RLS enforcement probes were not performed. Source checks, actual read-only schema metadata, isolated PostgreSQL size fixtures and browser mocks have separate evidentiary roles; none is represented as a customer-data test.

Prefer a forward correction if a release issue arises. Baseline deployment `dpl_C4CNC9ZmXULCMwwJxwrMuarYpA9s` at `033a397e` remains the historical rollback artifact. Reverting would reintroduce known ownerless/last-writer behavior and would not read the new envelopes; do not treat rollback as a data migration or erase the new/legacy copies. No rollback was performed.

The entire original audit remains at `/Users/danbretl/src/stackrank-data-safety-audit-20261007T043458Z/`: **10,044 regular files** match the takeover hashes, aggregate `73597ef1d5eb81d58cd9d769a34b0b973b310e27f0e63259a935799d86d6153e`. The three existing AGENTS symlink targets are separately recorded. Original checkout untracked material, source snapshots and private archives were neither deleted nor relocated; [input-preservation.json](input-preservation.json) and [archive-preservation-recheck.json](archive-preservation-recheck.json). No private source caches were uploaded. GitHub Pages stays disabled; Vercel still builds and serves only `dist/public`.
