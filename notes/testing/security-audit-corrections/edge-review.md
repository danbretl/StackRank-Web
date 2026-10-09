# Independent Edge correction review — October 9, 2026

Baseline: `c236ef0faf1733eb1ede8730e2cf665e42a7ccb5`. Scope is SR-05 and SR-06 in the new security audit. Original audit/source directories were read only. No production requests, real keys, customer records, configuration changes or deployments were used for this review.

## Decisions

**SR-05 confirmed and corrected locally.** `tmdb-suggest` inserted `seed` directly into the TMDB recommendation path. A fresh baseline copy fails the new traversal rejection test. This is an upstream path/query validation defect; the authority remains the fixed TMDB host, so neither arbitrary-host SSRF nor key exfiltration was demonstrated. Recommendation requests now require 1–10 ASCII digits, including rejection of missing/empty seeds; the ordinary UI supplies numeric TMDB IDs. Invalid seeds return 400 without upstream fetch. Popular, trending and essentials retain their existing behavior. The ten-digit bound is consistent with `tonight-pick` candidate parsing; contrary to the planning text, baseline `tmdb-detail` itself used an unbounded digits regex.

**SR-06 partially hardened; managed-header trust remains unverified.** Source inspection confirms no rate limiter in search/detail/suggest and first-XFF preference in the shared helper. Locally supplied headers can select arbitrary buckets. No managed ingress bypass is claimed. The correction treats all forwarding headers as coarse, untrusted hints and adds a separate header-independent budget within each Movies function instance. Changing or omitting hints does not bypass that aggregate budget in that instance. Exhaustion produces 429 plus Retry-After before upstream work.

| Function | Client-hint burst | Instance burst | Refill window |
| --- | ---: | ---: | --- |
| tmdb-search | 120 | 1,200 | 5 minutes |
| tmdb-detail | 120 | 1,200 | 5 minutes |
| tmdb-suggest | 120 | 1,200 | 5 minutes |
| tmdb-image | 300 (preserved) | 3,000 | 5 minutes |
| tonight-pick | 60 (preserved) | 600 | 5 minutes |
| books-search | 30 (preserved) | No new aggregate budget | 5 minutes |

These are continuously refilling token buckets, not fixed-window totals. The aggregate burst is ten times the hint burst to allow ordinary concurrent users while imposing a finite per-instance brake. Buckets remain ephemeral; restarts, other instances and regions have separate budgets. An attacker can consume a shared instance budget and temporarily limit unrelated users. This does not provide a verified-IP limit, a fleet-wide spend ceiling, or complete abuse prevention. Stronger enforcement would require a trusted ingress identity and shared server-side budget; no unapproved service, credential, account or database change was introduced.

**Additional discovery EDGE-01: bounded-memory bug corrected.** The old `maxBuckets` branch only pruned expired entries. Rotating fresh hints could exceed that nominal maximum indefinitely. The helper now refuses new hints once 5,000 live buckets are present; existing buckets remain available and are not evicted/reset. Expired capacity is reclaimed when a new hint arrives. Oversized hints (>128 characters) use the unknown bucket. Tests verify bounded size, no live-client budget reset, and later capacity recovery. This also applies to Books through its existing shared helper; its normal quota and search/cache flow are preserved. At capacity, new legitimate clients can be rejected until entries expire: an explicit bounded-memory availability tradeoff.

## Current primary documentation review

Read the current [Supabase changelog](https://supabase.com/changelog.md). Its recursive-function rate-limit entry only covers function-to-function calls; [the corresponding guide](https://supabase.com/docs/guides/functions/recursive-functions) explicitly excludes inbound calls and external API fetches. It does not solve TMDB abuse limits.

Supabase's [API security guide](https://supabase.com/docs/guides/api/securing-your-api) discusses reading XFF for database rate limits but does not establish a managed Edge Functions first-hop overwrite contract. [Self-hosted Envoy documentation](https://supabase.com/docs/guides/self-hosting/self-hosted-envoy) documents that gateway's peer-address handling; this is not evidence of the hosted project configuration. Searches for managed XFF/CF header guarantees did not find a primary contract adequate to label these hints authenticated IP addresses. No alternative header was guessed to be trusted. The [regional invocation guide](https://supabase.com/docs/guides/functions/regional-invocation) also supports treating an instance-local budget as local rather than global.

## Verification

- New `supabase/functions/_shared/proxy-security_test.ts` captures actual Deno handlers, replaces environment access with synthetic constants, replaces every fetch, fixes the clock, and restores globals after execution. It runs without network or environment permissions. Narrow local read permission exists solely for fresh handler module imports.
- The same test against source files copied from baseline Git objects failed **9 security steps** and passed **3 controls**. This independently reproduces invalid-seed acceptance, missing JSON limits and rotation beyond the new aggregate budgets. The positive controls are existing image/Tonight hint limits and key/origin/preflight/Books behavior. Baseline logs remain in ignored `reports/security-audit-corrections/edge-baseline-probe.log`.
- Corrected full function suite: **27 tests / 12 handler steps passed**, zero failures. Command: `deno test --no-lock --no-remote --allow-read=supabase/functions supabase/functions/_shared/*_test.ts`. Corrected log: `reports/security-audit-corrections/edge-corrected-probe.log`.
- Handler steps cover numeric recommendation success, malformed/missing/overlong rejection with zero fetch, ordinary suggestion types, stable/missing-hint exhaustion, rotated-hint exhaustion, absence of fetch after denial, Retry-After, existing key/origin/preflight boundaries and Books' unchanged normal quota.
- `deno check --no-lock --no-remote` passed for all six consumer entrypoints. Existing refill tests continue to pass.
- No production load or spoofed-header probe was attempted. Hosted results belong in the release receipt after deployment; these local results do not prove deployed protection.

## Deployment and rollback

Deploy all shared-helper consumers from the final verified commit: **tmdb-search, tmdb-detail, tmdb-suggest, tmdb-image, tonight-pick and books-search**. Entry files import the changed shared helper; redeploying only entry files that differ would leave Books' deployed helper stale. Keep existing JWT/origin/key configuration. No migration or secret change is needed for these Edge changes.

Rollback consists of redeploying these six functions from the prior product commit. That restores the previous seed validation gap, absent JSON limits and unbounded fresh-hint storage, so use rollback only for a demonstrated functional regression. Vercel code deployment alone does not deploy these Supabase functions.
