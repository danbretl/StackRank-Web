# Deployment file contract — hand-back

Status: **COMPLETE.** Release commit `55f1f595` passed CI, deployed to Vercel production, and passed
production smoke, contract and rendered checks on 2026-10-05 (UTC). The documentation revision
containing this file is `git log -1 --format=%H -- notes/testing/deployment-file-contract-handoff.md`.

Design and day-to-day usage live in `deployment-file-contract.md`; this document records the
task, evidence and how to continue. Bulky evidence is in the ignored
`reports/deployment-contract/` tree of the machine that ran the task (not in Git); the summaries
below are the durable record.

## Follow-up hardening — published release, October 5, 2026

Dan requested all three review follow-ups and explicitly approved publishing them. Release
`ad49091e532a84ace8b9cf6cc41b98e35624ba3b` is pushed to `main` and Vercel production is READY:

- Deployment: `dpl_Eg5BUtS6qCerWheSvh2iP7BXswcP`
- Inspector: https://vercel.com/danbretl-2590s-projects/stackrank/Eg5BUtS6qCerWheSvh2iP7BXswcP
- Release CI: https://github.com/danbretl/StackRank-Web/actions/runs/37269022058 — passed on attempt 2

The initial CI attempt passed all non-browser checks and 42 of 43 browser flows, but timed out on
the unchanged Dogs comparison focus assertion (`run-e2e-smoke.cjs:1249`). The isolated flow passed
again locally (`reports/e2e/runs/2026-10-05T054646Z`), and a rerun at the **same commit**, with no
code or test changes, passed the full CI suite. This records the intermittent failure rather than
claiming the first attempt was green.

The release implements:

- Git is required by default in the build/planning APIs and CLI. Vercel passes `--inputs git`
  explicitly and rejects fallback overrides. The production checker also requires Git.
- A successful HEAD without a valid content length requires GET byte-count/SHA-256 verification.
  Valid mismatching lengths fail; fallback requests retain rate limiting and mitigation handling.
- The guide and extraction tests now define the regex scanner's limits and require explicit
  dependencies plus consumer coverage for computed URLs. No universal JS parsing claim is made.

`npm run verify` passed on October 5 at 05:32 UTC: **574 Node, 40 Python, 24 Deno, 43 staged browser
flows**, all validators, syntax/cache checks, and deterministic builds. Focused hardening coverage
passes 31 tests. Reports:

- `reports/runs/2026-10-05T053023Z/summary.json`
- `reports/deployment-contract/runs/2026-10-05T053042Z/check-evidence.json`
- `reports/e2e/runs/2026-10-05T053047Z/summary.json`

Before/after inventories are identical: **1,866 files / 155,375,897 bytes**, digest
`0777084b3e0e5adc179756b87bbface610678e3e60e96d3c7a579f909b16d8e7`.
Hosted build logs confirm the same digest and `inputs: git (requested git)`, with **1,866 included,
811 excluded, zero unclassified**. Movies, Dogs, canonical copy and portrait assets are unchanged.
After publishing, **49 production smoke checks, ten exact live file hashes and four excluded-path
404 checks passed**. Requests were capped at two per second and configured to stop on mitigation;
none occurred. Evidence is in `reports/deployment-contract/hardening-release/` (`production-smoke.log`
and `live-sample.json`). No bulk portrait crawl was repeated. HEAD fallback failure cases are covered
with synthetic responses. HEAD-only length checks still cannot detect same-length corruption;
`--full` hashes every deployed file. Browser tests only cover exercised paths. GitHub Pages retirement
was separately authorized and completed (see section 8).

This follow-up documentation commit changes no runtime input. Its exact CI and production deployment
must be checked after pushing; the final delivery report records that final-commit evidence.

## 1. Objective, scope and non-goals

Make the static deployment explicit, reproducible, explainable and automatically checked for both
StackRank Movies and StackRank Dogs (plus the Books preview, shared viewers, privacy and the
noindex family home): a public-file declaration with dynamic dependency families, a deterministic
inventory, a safe staged-output builder, regression tests, and adoption in CI and Vercel, so that
development material cannot be published by accident and required runtime files cannot be
omitted silently.

Non-goals (not done, not authorized): product/runtime copy or behavior changes, Dogs generation or
breed/portrait/rights/cohort-ledger edits, Supabase schema/functions/credentials/account settings,
framework or bundler migration, removing the legacy GitHub Pages origin, destructive cleanup.

The task package (`PROMPT.md`, dated later than its companion files) superseded the package's older
local-only `ACCEPTANCE.md`/`DELIVERABLES.md`/`RUNNING.md` instructions (copy-to-`work/`, no commits);
this task worked in the real checkout and published, as `PROMPT.md` and `START-HERE.md` direct.

## 2. Starting state

- Checkout `/Users/danbretl/src/stackrank` (local name; remote `danbretl/StackRank-Web`), branch
  `main`, HEAD `2c2a73c64b162508302b887b038e68cc2e01f1eb`, in sync with `origin/main`.
- Tracked tree clean; nothing staged. Unrelated untracked paths were preserved untouched and never
  staged: `logo-design-brief/`, `notes/feature-ideas/dogs-overnight-next-100-kickoff-prompt-2026-10-04.md`,
  `notes/testing/dogs-cohort-l-final-analysis-2026-10-04.md`, `scripts/__pycache__/`.
  No concurrent commits appeared on `origin/main` during the task.
- 2,667 tracked entries (256,667,106 blob bytes; one symlink, `AGENTS.md` → `CLAUDE.md`).
- Content counts recomputed from source (unchanged by this task): 802 published Dogs
  portrait/profile pairs (`completedDogCatalogIds`), 437 hidden, 1,239 catalog entities, 1,239
  profiles, 802 generated-artwork records with 1,604 WebP variants (1,604 tracked WebPs), 178
  `generated-artwork-batch-*.json` files (all requested by `/dogs/artwork-review`), 46 Dogs packs.
- Baseline at that SHA: CI https://github.com/danbretl/StackRank-Web/actions/runs/37259120123
  (543 Node, 40 Python, 24 Deno, 41 browser flows); production smoke 49 checks. Production
  deployment for the baseline: Vercel inspector
  `https://vercel.com/danbretl-2590s-projects/stackrank/4KxQ2uDyCPRhXUEHGySyMb1SMRxm`
  (deployment URL `https://stackrank-qnylwqrm8-danbretl-2590s-projects.vercel.app`) — the rollback
  target.
- Pre-change hosting: Vercel "Other" preset, repository root as static output, no build command,
  `.vercelignore` exclusions. Observed on production before the change: `/package.json`,
  `/vercel.json`, `/.gitignore`, `/.vercelignore`, `/AGENTS.md`, `/notes/…`,
  `/data/dogs/portrait-cohort-m.json` returned 404; `/data/asset-versions.json`,
  `/data/suggestion-packs.source.json`, `/lib/dog-research-url.js`, `/lib/dog-profile-copy.js`,
  `/data/dogs/generated-artwork-batch-m50.json`, `/home.html` returned 200.

## 3. Architecture and decisions

- **Declaration** `deploy/public-files.json`: 10 entries with product + reason (Movies
  `index.html`, `shared.html`; Dogs `dogs.html`, `dogs-shared.html`, `dogs-artwork-review.html`;
  Books `books.html`; site `privacy.html`, `home.html`, `robots.txt`, `sitemap.xml`); 2 dynamic
  families; 12 acknowledged template constructions; 4 non-file literals (download names); 1 platform
  path (`/_vercel/insights/script.js`); 1 opaque module (vendored Supabase bundle); 43 reasoned
  exclusion rules (3 are guards for untracked/generated paths).
- **Discovery** (`deploy/contract.mjs`): HTML attributes, CSS `url()`/`@import`, JS imports and
  path-like string literals, sitemap/robots URLs; WHATWG URL resolution against every URL that
  serves a document (rewrite sources included), so query strings/fragments drop and `..` clamps at
  the site root; `vercel.json` rewrites/redirects map routes; same-origin absolute URLs map to files;
  external origins are recorded and never fetched. Product attribution and dependency chains follow
  load edges only (a link to another page is navigation, and every linked document must be an
  entry). It is not a JS parser — limitations are listed in `deployment-file-contract.md`.
- **Dynamic families**: `dogs-generated-portraits` (json-manifest over
  `data/dogs/generated-artwork.json` `assets[].variants[]`, each URL pattern-checked, traversal-
  checked and verified against the manifest's bytes and SHA-256) and
  `artwork-review-e-series-batches` (sequence e01–e10 anchored to the exact template literal in
  `dogs-artwork-review.js`). The other 168 batch URLs are literals discovered statically. Batch
  fetches are optional in the page, so a gap would be silent at runtime; the build, the staged
  browser flow and the production checks all make it loud.
- **Classification**: in Git mode inputs are the index (`git ls-files -s`): tracked plus explicitly
  added candidates; untracked/ignored/generated files are never inputs. Every tracked path is
  included or excluded; unclassified paths, excluded-but-reachable paths and stale rules fail.
  Filesystem mode (no usable Git metadata, e.g. a hosted build without `.git`) still enforces the
  closure and safety rules but reports classification as `not-run`; CI is the authoritative
  classifier.
- **Deterministic build and safety**: everything is validated before any write; the builder only
  replaces a build directory carrying `.stackrank-deploy-output`; it refuses the source root or an
  ancestor, directories holding tracked files or overlapping public source directories, symlinked
  build directories, and unowned non-empty directories. Public paths must be portable; case/NFC
  collisions fail. Copies are exclusive and re-verified (missing/extra/altered/linked files fail).
  Reports are sorted and environment-free; volatile metadata is separated.
- **Hosting adoption**: `vercel.json` gained `installCommand: ""`, `buildCommand: "node deploy/build.mjs --build-dir dist"`,
  `outputDirectory: "dist/public"` (documented vercel.json overrides; no dashboard change needed).
  Routes, redirects, headers, CSP, cache rules and noindex rules are byte-for-byte unchanged and
  apply to identical public paths. `.vercelignore` is unchanged; it now only trims the build source
  and a test asserts it keeps `deploy/` and every public input.

## 4. Changed files and measured effect

Release commit (product/tooling):

| File | Purpose |
| --- | --- |
| `deploy/public-files.json` | Declaration (new). |
| `deploy/contract.mjs` | Contract engine (new; Node built-ins only). |
| `deploy/build.mjs` | Build / `--check` CLI (new). |
| `tests/deploy-contract.test.js` | 22 tests: 17 fixture-tree positive/negative cases + 5 real-repository assertions (new). |
| `scripts/run-e2e-smoke.cjs` | `--serve-root`/`E2E_SERVE_ROOT` staged serving, server request log, staged inventory flow, missing-file gate, artwork batch assertion, extra MIME types. |
| `scripts/check-production-contract.mjs` | Read-only, rate-limited production comparison (new). |
| `scripts/check-production-rendered.cjs` | Read-only rendered production check in a fresh headless profile (new). |
| `vercel.json` | Build/output/install settings (3 lines). |
| `package.json` | `build:deploy`, `check:deploy`, `test:e2e:staged`; `verify` runs the contract check and staged E2E instead of source-root E2E. |
| `.gitignore` | `dist/`. |
| `.github/workflows/test.yml` | Uploads `reports/deployment-contract/**`, `dist/contract/**`, `dist/build-info.json`. |

Documentation commit: this file, `deployment-file-contract.md` (new), and updates to
`automated-tests.md`, `deployment-output-exclusions.md` (marked superseded),
`production-release-checklist.md` and `CLAUDE.md`.

No runtime file (HTML/JS/CSS/data/WebP), cache version or `data/asset-versions.json` changed.

Measured (modeled before = baseline commit tracked files minus Git-semantics `.vercelignore`
matches minus the four provider-withheld files observed as 404; not a measured Vercel listing):

| | Files | Bytes |
| --- | ---: | ---: |
| Modeled ignore-based output at `2c2a73c6` | 1,869 | 155,549,408 |
| Contract output at the release commit | 1,866 | 155,375,897 |
| Removed (intentional) | 3 | 173,511 |
| Added | 0 | 0 |

Removed: `data/asset-versions.json` (8,526 B; cache-check manifest), `data/suggestion-packs.source.json`
(164,005 B; pack authoring source — runtime uses `data/suggestion-packs.json`),
`lib/dog-profile-copy.js` (980 B; Node-side helper, imported by no browser module). Compatibility:
no runtime code, test or production check fetches them; direct URLs now 404. Under the old model
the three new `deploy/` files (75,354 B) would also have been published — the class of leak the
contract prevents. Contract digest `0777084b3e0e5adc179756b87bbface610678e3e60e96d3c7a579f909b16d8e7`.
Per product (files reached; shared files count in each product): Movies 40 / 1,547,768 B, Dogs
1,826 / 154,004,181 B, Books 13 / 87,120 B, site 11 / 287,952 B. Classification at the release
commit: 1,866 included + 807 excluded = 2,673 tracked, 0 unclassified. No claim is made about
storage of retained older deployments or billing.

## 5. Commands, tools and results

Tools: Node v26.5.0, npm 11.17.0, Python 3.13.2, Deno 2.7.14, Google Chrome 154.0.8037.93 (macOS
arm64); CI uses Node 24 and Deno 2.x on ubuntu-latest. `gh` was used read-only for CI/deployment
status. No Vercel CLI; nothing installed.

| Check | Command | Result |
| --- | --- | --- |
| Contract tests | `node --test tests/deploy-contract.test.js` | PASS 22/22 (+ routing: 32/32 with `tests/routing.test.js`) |
| Determinism + source preservation | `npm run check:deploy` | PASS: identical reports, identical output trees, output matches inventory, Git status unchanged, public inputs unchanged |
| Full gate | `npm run verify` | PASS (exit 0, 2m10s): 565 Node, 40 Python (27+6+7), 24 Deno, syntax, cache (70 assets unchanged), pack + Dogs validators, contract double build, 43/43 staged browser flows |
| Staged browser suite alone | `npm run test:e2e:staged` | PASS 43/43 (41 existing flows + staged inventory + missing-file gate), serving root `dist/public` on `http://127.0.0.1:<random port>` |
| Omission drill | tampered disposable copies of `dist/` | PASS (the checks failed as required; see below) |

Staged serving evidence (`reports/e2e/runs/2026-10-05T044538Z`, the verify run): serving mode
`staged`, root `dist/public`; 1,866/1,866 inventory files byte-matched over HTTP, 805 excluded
tracked paths returned 404, 10 canonical routes served the right documents, 1,604 portraits;
app-initiated failed responses were only `/favicon.ico` (browser default; never a site file),
`/missing-e2e-seed` and `/share-link-seed` (intentional negative fixtures); 0 source files missing
from the artifact; no browser exceptions in the passing flows. Screenshots are in that report's
`screenshots/`.

Separate Movies vs Dogs staged coverage (all against `dist/public`):
- **Movies**: app shell navigation, first run, comparisons/undo/cancel, review session, ranking
  views/drag, Taste Explorer, Tonight, suggestions, packs/Rank all, Share Studio preview/lightbox,
  backup/PNG/ZIP/per-page downloads (real files validated), public share link publish/view
  (`shared.html` viewer), mocked signed-in merge/save, privacy/TMDB credits — 40 public Movies files.
- **Dogs**: completed-pair visibility (802 shown, hidden identities preserved), comprehensive
  product, discovery gallery/category switching, packs, mocked account sync + public snapshot
  (`dogs-shared.html` viewer), phone viewports, approved artwork/attribution (raster export and
  public-snapshot artwork remain denied), failure recovery, artwork review with 178/178 batch
  documents requested and served — 1,826 public Dogs files including all 1,604 portraits.
- **Books / site**: Books vertical slice (noindex), noindex family home, privacy.

Omission drill (`reports/deployment-contract/logs/omission-drill.log`): removing
`generated-artwork-batch-m50.json`, `VBO-0000661-broholmer-960.webp` and `lib/share-svg.js` from a
copy of the staged output made `verifyOutput` report all three, the staged inventory flow fail
(exit 1), the Dogs artwork-review flow fail, the Movies Share Studio flow fail (exit 1) and the
missing-file gate name the files; removing only the m50 batch made the artwork-review flow fail
with `expected 178, served 177` (exit 1). The untouched artifact passed (exit 0).

Production coverage and results are in section 6 (Movies and Dogs reported separately).

## 6. Release and production verification

- Release commit `55f1f59567b965d319c84ce08dc9cc1d5c5a9a21`
  ("Build the Vercel deployment from a declared public file contract").
- CI: https://github.com/danbretl/StackRank-Web/actions/runs/37265393971 — **success** on head SHA
  `55f1f595…` (04:53:01–04:55:48Z): 565 Node, 40 Python, 24 Deno, cache (70 assets unchanged),
  validators, `check:deploy` all PASS, Linux build `inputs: git`, classification 1,866 included /
  807 excluded / 0 unclassified, contract digest `0777084b…d8e7` (identical to the macOS build), and
  43/43 staged browser flows served from `dist/public`.
- Vercel production deployment: GitHub deployment `6851622572`, state success at
  2026-10-05T04:53:18Z; inspector `https://vercel.com/danbretl-2590s-projects/stackrank/C5GRY5r7LqQo3CkhwKGBoPqeVHGj`;
  deployment URL `https://stackrank-fbxlruwcz-danbretl-2590s-projects.vercel.app`; aliases
  `www.stackrankapp.com` (and apex redirect).
- Exact-commit evidence: the Vercel status on commit `55f1f595` is "Deployment has completed", and
  production now returns 404 for `/data/asset-versions.json`, `/data/suggestion-packs.source.json`
  and `/lib/dog-profile-copy.js` (all 200 before the release), which only the contract-built
  `dist/public` output produces; served bytes match the release inventory (below). The Vercel build
  log itself (input mode in the hosted build) was not inspected — no dashboard/CLI access was used.
- `npm run test:production` (05:00Z): **PASS 49/49** — redirect chain, clean routes (Movies,
  Dogs, artwork review, privacy, `/s/:slug`, `/s/dogs/:slug`), security headers equal to
  `vercel.json` on every route, canonical/social metadata, cache-busted asset immutability, Dogs
  catalog 1,239 entities / 46 packs, artwork manifest purpose gates (public snapshot and raster
  export still `false`), OG image 1200×630, privacy/credits, robots and sitemap.
- `node scripts/check-production-contract.mjs --rate 5` (04:59:56–05:06Z, report
  `reports/deployment-contract/production/2026-10-05T045956Z.json`): **PASS**, contract digest
  `0777084b…d8e7`. All 1,866 public files served with HTTP 200, expected MIME type and the
  configured immutable cache header where `vercel.json` sets one; 288 SHA-256 byte comparisons (all
  262 HTML/JS/CSS/JSON/icon/text files plus a 1-in-64 sample of 26 portraits) and 1,578 portrait
  length checks. Per product: Movies 40/40, Dogs 1,826/1,826, Books 13/13, site 11/11.
  Exclusions: 34 selected paths (every path removed relative to the old model — the 3 runtime-
  irrelevant files plus the 3 `deploy/` files — and up to 3 per exclusion class) all 404.
- `node scripts/check-production-rendered.cjs` (05:06Z, fresh headless profile, every URL with
  `?debug=1`; `navigator.webdriver` was false in this headless mode, so suppression relied on
  `?debug=1`; Movies TMDB functions stubbed in-page; evidence and screenshots in
  `reports/deployment-contract/production-rendered/2026-10-05T050631Z/`): **PASS 6/6**, no
  exceptions, no console errors, no same-origin failures.
  - Movies: app shell with a seeded 3-movie throwaway ranking, Share Studio preview and a real
    385,387-byte PNG download; `/s/prodsmoke1` viewer renders its unavailable state.
  - Dogs: `/dogs` catalog ready with 802 completed pairs and loaded portraits; artwork review lists
    802 assets, opens a detail with provenance/prompt, and all 178 batch documents returned 200;
    `/s/dogs/prodsmoke123` viewer renders its unavailable state.
  - Site: `/books` (robots `noindex,nofollow`), `/privacy`, `/home.html` (noindex) render.
- Production rollback was not needed.

Incident: the first (pre-deploy) run of `check-production-contract.mjs` used 8 concurrent
requests (~60 requests/s). Vercel's firewall then challenged this client
(`403`, `x-vercel-mitigated: challenge`) for every path. Before that, the run had shown all 1,866
candidate files already matching production (288 hashed, 1,578 length-checked; Movies 40/40,
Dogs 1,826/1,826, Books 13/13, site 11/11) and exactly the three newly excluded files served with
200. The challenge was not bypassed; the checkers now rate-limit (10 requests/s, 2 concurrent by
default), sample excluded paths per class (all removed-by-contract paths always), and stop with a
"blocked" status on any mitigation header instead of retrying or rendering a challenge page.

## 7. Hosting configuration and rollback

Changed in Git only (`vercel.json`): previous values were unset (project defaults: Other preset,
root output, no build); new values `installCommand: ""`, `buildCommand: "node deploy/build.mjs --build-dir dist"`,
`outputDirectory: "dist/public"`. No Vercel dashboard/project setting, domain, environment variable,
Supabase or DNS setting was changed.

Rollback options (either restores the pre-contract root-static deployment):

1. Fastest, no Git change: in the Vercel dashboard for project `stackrank`, use Instant Rollback /
   "Promote to Production" on the baseline deployment `4KxQ2uDyCPRhXUEHGySyMb1SMRxm`
   (`stackrank-qnylwqrm8-…vercel.app`). Note that the next push to `main` deploys again.
2. Durable: revert the release commit and push:

```bash
git revert 55f1f59567b965d319c84ce08dc9cc1d5c5a9a21
```

   then `git push origin main`. (Reverting only the three `vercel.json` lines also restores root
   output; the rest of the tooling is inert without them.)

Verify a rollback: `npm run test:production` passes; `/data/asset-versions.json` returns 200 again
(old model); Movies/Dogs/artwork review render (`node scripts/check-production-rendered.cjs`).
A forward fix is preferable when the contract itself is right but an entry/family is missing:
add it to `deploy/public-files.json`, run `npm run verify`, push.

## 8. Limitations, open questions and tradeoffs

- Regex discovery is not a JS parser or evaluator: comments can count; variable-only paths such
  as `${base}/${name}`, concatenation, multiline/nested templates and extensionless bare names can
  evade discovery. Declare computed dependencies explicitly and test their consumers. The staged
  suite only covers exercised paths. See the current contract guide and focused boundary tests.
- The vendored Supabase bundle is opaque by declaration; its own requests target Supabase.
- Follow-up hardening shipped in `ad49091e`: Git mode is now the default and Vercel requires it
  explicitly; fallback overrides are rejected in hosted builds. Missing Git metadata stops the
  build before writes. Production HEAD responses without a usable length require GET
  byte-count/SHA-256 verification. The original release evidence in sections 2–7 predates this
  hardening; current release evidence is recorded near the top of this handoff.
- `/favicon.ico` (root) has never existed; browsers request it on pages without an icon link
  (`privacy.html`). Pre-existing and out of scope; the rendered check reports but does not fail it.
- GitHub Pages was disabled at Dan’s request on October 5, 2026: `has_pages:false`, site API 404,
  old public URL 404; Vercel remains live. GitHub retains a historical system-managed Pages
  workflow and rejects a separate disable request (422), but the publishing configuration is gone.
- Case-only collisions cannot be created in fixtures on case-insensitive macOS volumes; covered by
  the pure collision function. Windows hosting is not modeled (POSIX paths only).
- The current-ignore comparison is a Git-semantics model plus observed provider behavior, not a
  measured Vercel file listing.

## 9. Next-agent instructions

Read first: `notes/testing/deployment-file-contract.md`, `deploy/public-files.json`, then
`deploy/contract.mjs` (exports are unit-tested in `tests/deploy-contract.test.js`).

Reproduce:

```bash
npm run check:deploy
```

```bash
npm run test:e2e:staged
```

```bash
npm run verify
```

After any deployment (wait for Vercel success on the exact SHA via the GitHub deployments API):

```bash
npm run test:production
```

```bash
node scripts/check-production-contract.mjs
```

```bash
node scripts/check-production-rendered.cjs
```

Safe to change: the declaration (add entries/families/rules with reasons), tests, checker
defaults. Keep `deploy/` outside `.vercelignore`. Do not loosen Dogs purpose gates, remove
`generated-artwork-batch-*.json` from the artwork review, or edit runtime data to make packaging
easier. Do not repeat high-rate production probing; keep the checkers' rate limits and never work
around a Vercel challenge. Nothing else remains for this task once section 6 is complete.
