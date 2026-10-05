# Start cohort N yourself

Preparation only: no new executor session, workers, persistent goal, registry, image call or generation has been started.

## New session settings

1. Start a **new local Codex task** with working directory:
   `/Users/danbretl/.codex/worktrees/dogs-cohort-n/stackrank`
2. Confirm the task is on branch **`dogs/cohort-n-100`**, based on
   `c3ba4b030f7ad587e8a11cfc264c86b2543e5ab1`. Do not start it in `/Users/danbretl/src/stackrank`.
3. Recommended primary: **gpt-6-astra, high reasoning**, with **Full access** and network enabled.
   These are requested settings, not something the prompt can set or prove. The new task must report
   the actual disclosed execution policy. If that model is unavailable, use an available capable
   primary and record the substitution; do not invent a model identifier. The three workers are
   explicitly configured **gpt-6.1-sol/high**, with compact briefs and no nested workers.
4. Paste the starter below. You do not need to paste the full long prompt as well.

```text
I am starting the authorized cohort N run now. Work only in /Users/danbretl/.codex/worktrees/dogs-cohort-n/stackrank on dogs/cohort-n-100. Read notes/feature-ideas/dogs-cohort-n-kickoff-prompt.md and follow it through exactly 100 NEW accepted, researched portrait/full-profile/short-description pairs beyond the frozen 802-pair baseline. Prepare a fully tested, locally committed branch for later integration. Do not merge, push, deploy, publish, change main, or touch Claude's audited checkout/evidence. The audit finishing is not by itself permission to integrate; wait for my later integration instruction. Start the run now, including the fresh N bootstrap and three bounded workers. Continue until the 100-pair branch handback is complete or a genuine documented blocker prevents further authorized progress; ordinary batching and compaction are not stopping points.
```

The full prompt is `notes/feature-ideas/dogs-cohort-n-kickoff-prompt.md`.
The rationale is `notes/testing/dogs-cohort-n-efficiency-plan.md`.

## What is already prepared

- Separate branch and worktree; original main checkout and historical evidence unchanged.
- Frozen 802-pair/profile/artwork/WebP baseline and 802 independently copied master files.
- An isolation preflight and four regression tests for path containment/main/symlink rejection.
- A concrete first-session checklist for fresh N support. Existing M-only packet, coordinator,
  source-policy, builder and archive validators **do not yet accept N**. This is an explicit first
  implementation phase, not a reason to reuse M's state or stop for new user permission.
- No candidate identities have been approved; no empty approval or worker-policy attestation is fabricated.

At startup, the task should run:

```sh
pwd
git branch --show-current
PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-dogs-n-isolation.py --full
PYTHONDONTWRITEBYTECODE=1 python3 tests/dogs-n-isolation.test.py
```

All new operational evidence belongs in `reports/dogs-generated-artwork/cohort-n/` inside this
worktree; new native masters belong in `assets/dogs/generated-masters/cohort-n/`. These are local,
ignored files, not an off-machine backup. Do not delete this worktree after the run. A branch push
could trigger a Vercel preview, so this preparation deliberately authorizes **local commits only**.
No automatic session launch or reminder is scheduled. Once you start it, continuity instructions
cannot guarantee completion through an account quota, outage, permission restriction or Mac sleep.
