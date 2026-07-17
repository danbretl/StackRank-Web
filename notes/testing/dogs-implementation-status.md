# StackRank Dogs implementation status

Status date: **July 16, 2026**

StackRank Dogs is now a substantial local-first second product, not a demo. The `/dogs` route,
complete generated catalog, editorial discovery library, ranking/list utilities, failure handling,
shared category contracts, additive database proposal, family-home artifact, and regression coverage
are implemented in this worktree. It has not been committed, pushed, deployed, or connected to new
production tables.

Public launch is **not approved or ready** while the artwork gate is at zero and the additive
database migration remains unapplied and unprobed against Postgres. All affected capabilities fail
closed rather than pretending those gates passed.

## Delivery phase status

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 0 — orient and protect | Complete | Existing Books/cross-domain work and `logo-design-brief/` were preserved; Movies stayed on its existing routes, keys, tables, and payloads. |
| 1 — catalog compiler | Complete | Pinned VBO release, 100% raw-term disposition, deterministic compiler, validator, reports, and difficult-case tests. |
| 2 — artwork pipeline | Candidate pipeline complete; approval blocked | Import/process/ledger/policy/coverage tooling is fail-closed. All 27 promoted entities have exact Commons candidates, plus Broholmer; all 28 are byte-verified but pending human review, with zero approved or delivered assets. |
| 3 — shared category platform | Complete for demonstrated local behavior | Entity, catalog, ranking session, ranked-list, backup, provider-purpose, list transition, ranking operation, and remote-row contracts have focused tests. Books remains noindex and working. |
| 4 — Dogs local product | Complete | `/dogs` implements the full local interaction contract and responsive/failure browser flows. |
| 5 — sync, links, family | Prepared, not enabled | Additive migration and client no-loss/bounds helpers are ready but unapplied. Public snapshot/raster/account capabilities remain off. The noindex `home.html` artifact is ready without replacing `/`. |
| 6 — launch hardening | Substantially complete; manual gates remain | Privacy/credits, sitemap, security/cache routes, validators, production-smoke assertions, screenshots, and release instructions are present. Human rights/editorial review, a real database probe, and Dan's release authorization remain. |

## Catalog coverage

Pinned source:

- VBO release: `2026-04-15`
- Source artifact: `data/dogs/sources/vbo-2026-04-15.json`
- Bytes: `40,044,828`
- SHA-256: `511bb27d7581bfb8bccf69583c8ac0e3c12de4fdecaf0a8649abfcbfc5ed4da1`
- Raw Dog breed descendants: `1,537`
- Explicit dispositions: `1,537 / 1,537` (`100%`)

Disposition counts:

| Disposition | Count |
| --- | ---: |
| Canonical | 899 |
| Alias | 271 |
| Variety | 190 |
| Crossbreed | 139 |
| Historical | 36 |
| Excluded | 2 |

The runtime catalog contains `1,264` selectable concepts in a deterministic `706,898`-byte JSON
artifact. Review artifacts retain 26 regional/landrace decisions and 18 deliberately retained
ambiguous synonyms for human audit rather than silently collapsing them.

Key artifacts:

- `data/dogs/classification.json`
- `data/dogs/classification-review.json`
- `data/dogs/catalog-overrides.json`
- `data/dogs/dog-catalog.json`
- `data/dogs/coverage-report.json`
- `scripts/build-dog-catalog.mjs`
- `scripts/validate-dog-catalog.mjs`

## Editorial packs

`data/dogs/packs.json` contains:

- 46 packs;
- 448 pack references across 251 distinct VBO ids;
- 17 editorial families;
- 10 registry-attributed packs;
- exactly 3 globally varied promoted starter packs with 27 distinct promoted entities;
- maximum pairwise Jaccard overlap of `0.5385`.

The validator rejects missing/nonselectable ids, duplicated titles, excessive overlap, invalid
starter composition, unlabeled crossbreed content, and suitability/behavior claims.

## Artwork and rights coverage

Current exact deployable coverage is intentionally `0%`:

| Gate | Approved / required |
| --- | ---: |
| UI display | 0 / 899 current canonical |
| Public snapshots | 0 / 899 current canonical |
| Raster export | 0 / 899 current canonical |
| Promoted starter entities | 0 / 27 |

All 27 promoted entities now have a Wikimedia Commons candidate imported by exact file page and
revision, plus one nonpromoted Broholmer row (`28` total). Every original was streamed and verified
against SHA-256, Commons SHA-1, and byte count, then visually checked at thumbnail/crop level for a
plausible single-breed subject. All remain pending human subject/license/non-copyright review:

| Candidate license | Promoted rows |
| --- | ---: |
| CC BY 2.0 | 5 |
| CC BY 4.0 | 1 |
| CC BY-SA 3.0 | 10 |
| CC BY-SA 4.0 | 10 |
| CC0 1.0 | 1 |

The whole ledger adds the Broholmer CC BY-SA 3.0 row. An initial Basenji candidate using a regional
CC BY-SA 3.0 AT license was rejected rather than weakening policy; a generic CC BY-SA 4.0 file was
selected instead.

No file is checked in as a shippable runtime image. The processor requires an editorial 3:2
crop, emits hashed 320×213 and 960×640 WebPs, and records the transformation. ShareAlike output is
not marked ready without explicit same-license and attribution-surface confirmation. Openverse is
used for discovery only and cannot write directly to the rights ledger.

The UI therefore renders a polished code-native fallback. Public links and raster sharing remain
disabled even if a future asset is approved only for UI display.

Key artifacts:

- `data/dogs/image-rights.json`
- `data/dogs/artwork-license-policy.json`
- `data/dogs/artwork-coverage-report.json`
- `data/dogs/artwork-review-guide.md`
- `scripts/fetch-dog-artwork.mjs`
- `scripts/process-dog-artwork.mjs`
- `scripts/validate-dog-artwork.mjs`

## Implemented product contract

`dogs.html`, `dogs.js`, and `dogs.css` provide:

- accessible canonical/alias search over all 1,264 selectable concepts;
- canonical VBO identity storage even when an alias initiated ranking;
- three starter packs, all 46 packs in a filterable browser, progress, browse prompts, and Recently ranked;
- binary insertion with opening jitter, exact midpoint narrowing, Undo last choice, Cancel, and origin/scroll restoration;
- Detailed, Photos, and Compact ranking views;
- safe status/region/approved-image filters with reorder disabled while filtered;
- mouse, coarse-pointer handle, and keyboard reorder with announcements and Undo;
- adjacent-pair Review order with one-session Undo;
- provenance/relationships/aliases/status/VBO version plus rights attribution in details;
- exclusive Curious about / Not for me transitions by canonical identity;
- rank-weighted, evidence-backed region/registry/editorial-family Taste patterns;
- category-bound backup/restore and reviewed exact-name/alias import;
- text, Markdown, and JSON exports without artwork;
- catalog failure recovery that retains stored ranking data;
- actionable browser-storage failure warnings and emergency in-memory backup;
- desktop, iPad portrait/landscape, phone portrait/landscape, keyboard, touch-target, and reduced-motion behavior.

No temperament, health, lifespan, compatibility, exercise, housing, trainability, purchase, or
adoption-suitability claims are shipped.

## Shared architecture decisions

Shared modules understand provider-qualified entity refs, snapshots, catalog search/facets, ordered
lists, transitions, capabilities, payload bounds, and merge behavior. Dogs-specific rendering,
taxonomy copy, Taste signals, and pack content remain Dogs-owned. Movies was not moved onto the new
entity envelope, and Books was not expanded just to manufacture abstraction.

The proposed migration was created with `supabase migration new`:

- `supabase/migrations/20260716090037_add_category_data_tables.sql`

It adds only `category_rankings`, `category_lists`, `category_pack_progress`, and
`category_shared_lists`. It explicitly grants the intended Data API roles, enables RLS, gives every
owner table SELECT/INSERT/UPDATE/DELETE policies, uses `(select auth.uid())`, gives UPDATE both
`USING` and `WITH CHECK`, bounds all JSON payloads, and restricts anonymous snapshot reads to safe
columns on non-revoked rows. Mature Movies tables are untouched.

Docker is unavailable on this machine, so the migration was not parsed or applied against local
Postgres and advisors could not run. The exact local/branch probes and two-user/category/revocation
checks are in `notes/testing/dogs-supabase-rls-review.md`. This is a real remaining gate, not a test
result to infer from static SQL.

## Family home and release boundaries

`home.html` is a noindex family-home artifact with equal Movies and Dogs cards, global privacy/account
navigation, count-only per-category progress, and no category app bundles. It intentionally remains
at `/home.html`; `vercel.json` still redirects `/` to `/movies` as explicitly required.

Legacy Movies `/s/:slug` remains unchanged. The new category snapshot table/client envelope is
prepared, but no Dogs publish UI or public route is enabled before the migration and capability
gates pass.

`.vercelignore` keeps versioned ontology inputs, audit fixtures, tests, notes, migration sources, and
local design workspaces out of deployment uploads while retaining the bounded Dogs runtime catalog,
packs, rights ledger, and license policy.

## Visual fidelity ledger

Generated design references are ideation artifacts only:

- `notes/feature-ideas/multi-domain-assets/dogs-primary-screen-concept.png`
- `notes/feature-ideas/multi-domain-assets/dogs-comparison-mobile-concept.png`
- `notes/feature-ideas/multi-domain-assets/stackrank-family-home-concept.png`

Adopted: monochrome editorial hierarchy, oversized direct prompt, central rank bar, restrained ruled
pack layout, two-choice comparison takeover, equal category cards, and double-keyline primary actions.

Intentional deviations:

- generated dog photography was never used as runtime content because it has no acceptable rights ledger;
- runtime and family-home mosaics use neutral code-native fallbacks until reviewed photography exists;
- the family home is noindex/unrouted until the public launch authorization;
- public/raster sharing controls stay absent rather than showing an attractive but unsafe mock flow.

Accepted implementation screenshots are produced by the Dogs and family-home E2E flows under
`reports/e2e/latest/screenshots/`. Desktop Rank, Ranking, detail, phone comparison, phone landscape,
iPad portrait/landscape, family desktop/mobile, catalog failure, and storage failure were visually
inspected during implementation.

## Verification and release checklist

Final local verification completed with a green `npm run verify` on July 16, 2026:

- 348 / 348 Node unit and data tests passed (`reports/runs/2026-07-17T052457Z`);
- 24 / 24 Deno function tests passed;
- browser syntax and all 54 cache-manifest assets passed;
- the 114-pack Movies validator passed;
- Dogs catalog, structural artwork, and 46-pack validators passed;
- 35 / 35 real-Chrome flows passed (`reports/e2e/runs/2026-07-17T052511Z`), including
  Movies, Books, Dogs, family home, exact 390×844 and 844×390 Dogs viewports, iPad, failure
  recovery, backup/import/export downloads, pointer/keyboard reorder, and legacy Movies sharing.

The exact phone pass found and repaired a real intrinsic grid overflow that a shrink-to-fit geometry
check had masked; the final regression asserts a 390px layout viewport and zero horizontal overflow.
The Chrome harness retries one failed initial CDP launch with a fresh profile and foregrounds each
CDP page target before interaction. Keyboard reorder checks enable the explicit Move mode before
synchronizing the visible handle through Chrome's DOM focus command and complete key-down/key-up
events, so pointer-capability and headless-focus differences on slower Linux CI runners exercise the
same user-visible interaction contract instead of failing on environment or input timing.

The networked
`npm run test:production` script now contains Dogs route, header, metadata, immutable catalog/packs,
privacy-credit, and sitemap assertions, but it must not be run as evidence for Dogs until the
corresponding commit is actually deployed.

Before public launch:

1. Complete human review, processing/delivery, and approval for the 27 promoted candidates, then source/review enough current-canonical artwork to meet the declared 95% threshold.
2. Review the catalog ambiguity/regional/historical queues and record every accepted override.
3. Start a local or disposable Supabase branch; reset, lint, run advisors, and execute every isolation/revocation probe in the RLS review.
4. Obtain explicit authorization before applying the migration anywhere shared or production-facing.
5. Only after the migration passes, wire account sync/public links, enable their category capabilities, and add mocked plus real two-user browser coverage.
6. Decide and authorize the root-home cutover; then remove home noindex, replace the root redirect, and update global canonical/social/production checks in the same release.
7. Obtain explicit authorization to commit, push, deploy, or upload immutable artwork.
