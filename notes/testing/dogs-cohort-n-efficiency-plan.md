# Cohort N preparation and efficiency plan

Prepared October 5, 2026. This is a plan for a user-started session; it has not started generation.
Baseline is `c3ba4b03`: 802 completed live pairs, 437 hidden, 1,239 identities.

## What M actually cost in time and calls

Sources: `data/dogs/portrait-cohort-m-process-review.json`, `portrait-cohort-m.json`, completion
record, and the 118 exact bound attempt receipts. Derived timing details are retained at
`reports/dogs-generated-artwork/cohort-n/preparation/m-timing-analysis.json` in the new worktree.

| Measure | Observed M result |
| --- | --- |
| Accepted additions | 100, from 102 qualified identities and two replacement holds |
| Built-in image calls | 118 completed, zero failed calls |
| Rejected outputs / targeted retries | 18 / 16; different counts because held identities were replaced |
| Calls per accepted pair | 1.18 |
| Rejected outputs as fraction of calls | 15.25% |
| Goal start to first call | 9m34s |
| Goal start to first publication | 49m20s |
| Goal start to last publication | 17.611 hours, including roughly six hours of mistaken pause |
| Recorded call elapsed time | Median 22s, p90 38s, aggregate 55.31 minutes over 118 receipts |
| Root QA to branch integration | Median 5.78 minutes; p90 30.95 minutes |
| Integration to verified live | Median 14.32 minutes; p90 28.87 minutes |
| Root QA to verified live | Median 24.91 minutes; p90 56.98 minutes |
| Product releases | 20, averaging five accepted additions per release |
| Worker settings | Three reusable gpt-6.1-sol/high workers; requested primary gpt-6-astra/high |

These receipt intervals are not billable model runtime. Per-identity waits overlap; their sums
must not be claimed as wall-clock savings. The approximately 11.6 hours left after the reported pause
is not a measured active-work total. Cost and complete phase attribution were not exposed. Root
review, source quality and preservation take real time; no exact completion-time promise is justified.

## Decisions for N

1. **Remove release synchronization from the overnight critical path.** No pushes/deployments or
   live polling. Work toward about five stable 20-pair local product checkpoints, each fully verified,
   rather than M's 20 production releases. That targets 75% fewer product verification/release cycles;
   it does not promise 75% faster generation. The first completed pair gets a focused end-to-end
   canary before scaling. Packet QA remains continuous and every native/copy remains individually reviewed.
2. **Keep concurrency at three.** The source policy and demonstrated workflow already use three
   image workers/permits. Recorded call intervals alone do not support adding more concurrent writers.
   Preparation and root review are the better first bottlenecks to remove. Root batches reading of
   completed packets but records separate immutable decisions; workers continue disjoint staging while
   a candidate is tested. Do not leave image-ready work idle merely because a release is running.
3. **Use dynamic 3–5 identity packets.** Keep ownership explicit, review A→B→C→A, and allow a single
   fully qualified identity to proceed immediately. No up-front 100-identity research gate or fixed
   worker quotas. Favor reusable exact evidence; a credible hold/replacement beats speculative license
   rescue or a fourth image attempt. Reuse agent context, not full-history forks/per-dog agents.
4. **Target the actual rejection pattern before spending calls.** M's rejects repeatedly concerned
   ears, lips/skin, coat phenotype and tail carriage/furnishing, including generic parent-breed drift.
   Add a compact positive, source-backed identity cue checklist before each first prompt. Do not add
   unsupported ratios or loosen QA. Preserve finite retries and all failed-native evidence.
5. **Avoid evidence duplication.** Archive minimal per-identity dependency closures, use content
   hashes, and treat raw source bodies/global registries as bounded evidence rather than recursively
   sweeping unrelated cohorts. New N records use copied N-owned dependencies; immutable old tuples
   remain unchanged and may be read only. All original 802 masters were APFS-cloned with distinct
   inodes and checked against manifest hashes (2,412,819,107 logical bytes / about 2.247 GiB).
6. **Make continuation explicit.** A user-started N goal stays ACTIVE across compaction/checkpoints.
   The previous mistaken pause is not copied into this run. Track source, approval, calls, QA,
   integration, tests and archives separately; N production publication stays zero. Audit bottlenecks
   periodically and at 45 minutes without a first call. A missing individual gate is repaired, not
   converted into a permission checkpoint or waived. Quotas/outages remain real limits.
7. **Reuse proven model roles.** Recommend a capable gpt-6-astra/high primary and three explicitly
   configured gpt-6.1-sol/high workers. Built-in image tool only. A different cheaper model is not
   justified for source/identity QA by the available evidence; deterministic checks use scripts.
   Disclose requested/configured versus actual visible settings and unavailable runtime/image model
   identifiers. No separate paid API or fabricated cost savings.

## Isolation and first-session engineering

Integration worktree `/Users/danbretl/.codex/worktrees/dogs-cohort-n/stackrank`, branch
`dogs/cohort-n-100`, based on `c3ba4b030f7ad587e8a11cfc264c86b2543e5ab1`.
Main/audit checkout `/Users/danbretl/src/stackrank` remains read-only and is not reset or cleaned.
A worktree shares Git metadata, so branch-local commits write Git objects; it does not provide a
kernel-level write boundary. `scripts/check-dogs-n-isolation.py` verifies the intended checkout,
branch, protected evidence, optional registry/output containment and baseline preservation. It
rejects main destinations, sibling-prefix escapes and symlink escapes; it never opens a coordinator DB.

All new N evidence/registry/SQLite/native/archive paths are under the N worktree. Existing helper
source derives roots from its own file location or accepts a root/registry, but M packet, coordinator,
source authorization, builder admission, reviewer metadata and archive wave handling are hard-coded.
The fresh session must implement/test additive N support before its first call, preserving M's gates.
That task is explicitly listed in the kickoff; no empty registry or fake authority is pre-seeded here.
**Preparation is ready for the user to start the new session; N generation tooling is not claimed to
be ready before that mandatory bootstrap passes.** No isolation blocker was found after the new
worktree/master-copy and containment checks. If a path cannot be safely isolated, stop that operation
before generation, preserve completed preparation and report the exact path/control.

At preparation there was about 21 GiB free space. Copy-on-write avoids an unnecessary physical
full-master duplicate now; later changes consume space. Check capacity during the run and never
remove audited historical files to make room. All archives remain local unless a separate backup is
explicitly verified. No branch push is part of this run: Vercel previews may be created even when
production uses main; .github/workflows/test.yml runs main pushes and PRs. Local full verification
therefore supplies branch evidence, and later integration requires a fresh review against audited main.

Completion means 100 NEW accepted/archived/tested/committed pairs, 902 candidate pairs/337 hidden,
zero active/unknown permits or accepted unintegrated work, and READY_FOR_POST_AUDIT_INTEGRATION.
It does not mean live publication. Existing live site remains 802/437 until Dan separately allows
integration after the Claude audit. No automatic start, worker launch, image call or goal is scheduled.

## Preparation verification

Before the local preparation commit, `npm run verify` passed: 574 Node tests, 40 Python tests,
24 Deno tests and 43 staged browser flows. Four additional path-isolation regressions pass.
The full 802-pair/1,604-variant/master-copy preservation check passes. Public artifact remains
1,866 files / 155,375,897 bytes, digest
`0777084b3e0e5adc179756b87bbface610678e3e60e96d3c7a579f909b16d8e7`.
Baseline snapshot SHA-256: `3fe8411eb052891adce735845aee5e240633a1418a5627fdeff05d7f4d53d4e9`.
Reports: `reports/runs/2026-10-05T060847Z`, `reports/e2e/runs/2026-10-05T060911Z`, and
`reports/dogs-generated-artwork/cohort-n/preparation/verification.json`.
These are preparation tests, not new-pair generation or final N validation. No task, worker, goal,
registry or image call was launched. Main remained at `c3ba4b03` with its prior untracked work intact.
