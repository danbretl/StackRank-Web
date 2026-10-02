# Cohort K: one-time worker setup

This is operational setup for Dan's freshly authorized 250-pair continuation. It does not
extend cohort J. The orchestrator task is `01a0fb1a-a276-71a1-a589-44be5e408e6c`
(“Launch 250 Dogs Portrait Pairs”), running against `/Users/danbretl/src/stackrank`.

## Why Dan creates these tasks

The exposed task-creation API can select `gpt-6.1-sol` and `xhigh`, but cannot set or attest
the new task's permission mode. Computer Use explicitly rejects access to the Codex app.
Dan requires Full access at creation, so tasks must be created through his app controls with
Full access selected before the first prompt. Prompt text cannot grant permissions.

Create five independent StackRank local tasks. Select an isolated Worktree from `main`,
GPT-6.1 Sol, Extra High, and Full access for each. Also confirm those model/effort settings
on the orchestrator; its supplied runtime already confirms `danger-full-access`, approval
policy `never`, unrestricted filesystem, and network enabled. The orchestrator's runtime
does not disclose its actual model/effort identifier.

Paste this identical initial prompt into each of the five configured tasks:

```text
Join the StackRank Dogs cohort K run as one of five independent 50-pair workers.
Read /Users/danbretl/src/stackrank/notes/feature-ideas/dogs-cohort-k-worker-setup.md and follow its bootstrap instructions. This task must already be configured as gpt-6.1-sol / xhigh / Full access. I authorize isolated worktrees and task-specific coordination, peer-review, progress and reply messages between you, the other four K workers and orchestrator 01a0fb1a-a276-71a1-a589-44be5e408e6c. Perform only the runtime/workspace self-check now, report it to the orchestrator, and wait for its exact disjoint assignment before research, acquisition or generation. Do not spawn additional agents, edit shared product files, push main or deploy.
```

## Worker bootstrap instructions

1. Before any shell command or file write, read your supplied execution-policy instructions.
   Full access must be explicit: unrestricted/danger-full-access filesystem and no tool
   approval prompts (`never`, or an explicitly equivalent supplied policy). If your policy
   is constrained or unavailable, report that accurately in your final response and stop
   setup without asking for command approval or trying to alter configuration.
2. Set your own task title to `Dogs K worker — awaiting assignment` using the supported
   task-title tool. Inspect only your workspace with `pwd`, `git status --short --branch`,
   `git rev-parse HEAD`, and `git rev-parse --git-common-dir`. Confirm the isolated worktree
   belongs to `danbretl/StackRank-Web` and starts at verified main
   `012c1e4f94fa64c1407f36d5b3a32adb200b628a`. Report a changed main as a fact for root to
   reconcile. Do not create a second worktree if already in one.
3. Report your actual cwd, HEAD, supplied filesystem/network/approval policies, and whether
   your runtime discloses the actual model/effort. Do not claim the requested model/effort
   is independently verified when it is only supplied by the human's picker selection.
4. Send that setup report to orchestrator `01a0fb1a-a276-71a1-a589-44be5e408e6c` through
   `send_message_to_thread`. The human-pasted bootstrap prompt above explicitly authorizes
   this task-specific message. If that tool cannot be used, put the complete report in your
   final output; root will read your thread. No outside correspondence is authorized.
5. End this setup turn. Root will discover the five task IDs, assign A–E, record settings and
   workspace paths, freeze disjoint exact IDs, and send the substantive worker brief. The
   50-pair scope remains pending that assignment and shared throttle/preflight setup.

## Continuing work

The full execution contract is `notes/feature-ideas/dogs-parallel-50-kickoff-prompt.md` and
`notes/feature-ideas/dogs-parallel-continuation-handoff-2026-10-01.md`. Use compact assigned
records from `data/dogs/portrait-continuation-context.json` rather than reading all old ledgers.
Root owns selection, reserves, rights policy, approvals, integration, commits, pushes and releases.
Workers own isolated research/source evidence, prose, prompts, generation and staging receipts.
Peer review follows A→B→C→D→E→A. The global Commons limit is one owner with at least 5.1
seconds after completed requests and a global stop on 429; imagegen has at most four simultaneous
calls, one per worker. No acquisition or image call is permitted until those controls and exact
root approval are present. J's frozen selection, holds, stop and accepted artwork remain intact.
