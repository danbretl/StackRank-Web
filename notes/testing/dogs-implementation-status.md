# StackRank Dogs implementation status

Status date: **July 22, 2026**

StackRank Dogs is now a substantial local-first second product, not a demo. The `/dogs` route,
complete generated catalog, editorial discovery library, ranking/list utilities, failure handling,
shared category contracts, additive database proposal, family-home artifact, and regression coverage
are implemented on the `codex/dogs-launch` review branch and published to a protected Vercel preview
through draft PR #1. The additive production schema and initial UI-display artwork batch are now
present and independently probed, but the current integrated work has not been committed, pushed,
or deployed and the production root redirect has not changed.

The comprehensive local-first Dogs product is ready for an iterative public `/dogs` release with 28
rights-reviewed photographs plus polished neutral fallbacks for the rest of the catalog. The
production database and Storage gates have passed. Account sync and public snapshot links remain
enabled in the local release candidate after production and mocked-browser activation checks;
public-snapshot artwork and raster sharing remain separately denied by purpose policy. The activated
client has not been committed, pushed, previewed, or deployed.

## Delivery phase status

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 0 — orient and protect | Complete | Existing Books/cross-domain work and `logo-design-brief/` were preserved; Movies stayed on its existing routes, keys, tables, and payloads. |
| 1 — catalog compiler | Complete | Pinned VBO release, 100% raw-term disposition, deterministic compiler, validator, difficult-case tests, and an accountable 2026-07-21 editorial audit of every generated review queue. |
| 2 — artwork pipeline | Initial UI batch delivered | Import/process/ledger/policy/coverage tooling remains fail-closed. All 27 promoted entities plus Broholmer have accountable approvals and 320/960 WebPs under immutable object names. All 56 production objects passed remote byte, MIME, and immutable-cache verification. UI display is enabled for these 28 assets; public-snapshot and raster-export purposes remain denied. |
| 3 — shared category platform | Complete for demonstrated local behavior | Entity, catalog, ranking session, ranked-list, backup, provider-purpose, list transition, ranking operation, and remote-row contracts have focused tests. Books remains noindex and working. |
| 4 — Dogs local product | Complete | `/dogs` implements the full local interaction contract and responsive/failure browser flows. |
| 5 — sync, links, family | Production schema verified; local client activated | Account sync, per-list timestamps, account isolation, owner publish/update/copy/revoke, and the anonymous `/s/dogs/:slug` renderer are implemented and independently security-reviewed. The production schema passed real two-user and anonymous probes with zero fixture residue. The local capability, privacy, static, cache, signed-out Browser, and mocked no-loss sync/public-link checks passed. Raster sharing remains separately disabled. The noindex `home.html` artifact is ready without replacing `/`. |
| 6 — launch hardening | Release candidate awaiting publication | Privacy/credits, sitemap, security/cache routes, validators, production-smoke assertions, screenshots, full verification, a real-Postgres branch rehearsal, production migration probes, and immutable artwork-delivery verification are present. No commit, push, deployment, or root-redirect change has occurred for this integrated pass. |

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
| Canonical | 877 |
| Alias | 294 |
| Variety | 187 |
| Crossbreed | 139 |
| Historical | 36 |
| Excluded | 4 |

The runtime catalog contains `1,239` selectable concepts in a deterministic `697,034`-byte JSON
artifact. Review artifacts retain 20 regional/landrace decisions and 18 deliberately retained
ambiguous synonyms as explicit audit records rather than silently collapsing them.

The accountable editorial pass is recorded in
`notes/testing/dogs-catalog-editorial-audit-2026-07-21.md`. It recomputed every generated decision,
compared all selectable exact VBO names before alias suppression, researched identity conflicts from
primary registry sources, applied high-confidence corrections, and added full-queue traceability
tests. The remaining regional and ambiguous rows are explicit retained decisions, not an unreviewed
launch backlog.

`npm run review:dogs:catalog` builds a noindex local workspace under
`reports/dogs-catalog-review/`. It combines all 698 deterministic review-queue entries with exact
VBO labels, parents, synonyms, cross-references, source URLs, runtime entity context, and existing
override evidence. Draft decisions and notes stay in that browser and export only as a review-aid
JSON file; the workspace has no import, apply, catalog-build, or source-file write capability.

Key artifacts:

- `data/dogs/classification.json`
- `data/dogs/classification-review.json`
- `data/dogs/catalog-overrides.json`
- `data/dogs/catalog-review-guide.md`
- `data/dogs/dog-catalog.json`
- `data/dogs/coverage-report.json`
- `scripts/build-dog-catalog.mjs`
- `scripts/build-dog-catalog-review.mjs`
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

Current exact purpose coverage is:

| Gate | Approved / required |
| --- | ---: |
| UI display | 28 / 877 current canonical |
| Public snapshots | 0 / 877 current canonical |
| Raster export | 0 / 877 current canonical |
| Promoted starter entities with UI display | 27 / 27 |

All 27 promoted entities now have a Wikimedia Commons candidate imported by exact file page and
revision, plus one nonpromoted Broholmer row (`28` total). Every original was streamed and verified
against SHA-256, Commons SHA-1, and byte count, then visually checked at thumbnail/crop level for a
plausible single-breed subject. All 28 passed accountable subject, license, crop, and non-copyright
review and were delivered for UI display:

| Current-ledger license | Rows |
| --- | ---: |
| CC BY 2.0 | 4 |
| CC BY-SA 3.0 | 12 |
| CC BY-SA 4.0 | 11 |
| CC0 1.0 | 1 |

The whole ledger adds the Broholmer CC BY-SA 3.0 row. An initial Basenji candidate using a regional
CC BY-SA 3.0 AT license was rejected rather than weakening policy; a generic CC BY-SA 4.0 file was
selected instead.

No runtime image is checked into the repository. The processor applies the approved editorial 3:2
crop, emits hashed 320×213 and 960×640 WebPs, and records the transformation. The resulting 56
objects are stored under immutable production paths and were read back and verified against their
manifest bytes, MIME type, and cache policy. The ledger records the UI-display purpose for all 28
assets while keeping public-snapshot and raster-export purpose booleans false. Openverse remains a
discovery-only source and cannot write directly to the rights ledger.

The UI renders these 28 approved photographs and a polished code-native fallback everywhere else.
Public-link artwork and raster sharing remain disabled because UI-display approval does not imply
either additional purpose.

A deterministic review-only discovery queue now accounts for all `849` current-canonical concepts
that do not yet have any ledger row: `185` are prioritized by editorial-pack engagement and `664`
form the catalog long tail. All `28` existing ledger ids are excluded regardless of approval state,
so no pending candidate is accidentally rediscovered as “missing.” The queue embeds source versions
and SHA-256 digests plus bounded Openverse/Commons search inputs; it performs no request, import,
approval, or download by itself.

`npm run review:dogs:artwork` builds a noindex local review workspace under
`reports/dogs-artwork-review/`. It presents all 28 exact ledger candidates with uncropped Commons
originals, pinned/current source links, hashes, attribution, license text, and three separate human
review dimensions. Work-in-progress notes stay in that browser and export as a review-aid JSON file;
the workspace has no approval, upload, processing, or ledger-write capability.

Key artifacts:

- `data/dogs/image-rights.json`
- `data/dogs/artwork-license-policy.json`
- `data/dogs/artwork-coverage-report.json`
- `data/dogs/artwork-review-guide.md`
- `data/dogs/artwork-discovery-guide.md`
- `data/dogs/artwork-discovery-queue.json`
- `scripts/build-dog-artwork-review.mjs`
- `scripts/build-dog-artwork-discovery-queue.mjs`
- `scripts/deliver-dog-artwork.mjs`
- `scripts/fetch-dog-artwork.mjs`
- `scripts/process-dog-artwork.mjs`
- `scripts/validate-dog-artwork.mjs`

## Implemented product contract

`dogs.html`, `dogs.js`, and `dogs.css` provide:

- accessible canonical/alias search over all 1,239 selectable concepts;
- canonical VBO identity storage even when an alias initiated ranking;
- three starter packs, all 46 packs in a filterable browser, progress, browse prompts, and Recently ranked;
- binary insertion with opening jitter, exact midpoint narrowing, Undo last choice, Cancel, and origin/scroll restoration;
- Detailed, Photos, and Compact ranking views;
- safe status/region/approved-image filters with reorder disabled while filtered;
- mouse, coarse-pointer handle, and keyboard reorder with announcements and Undo;
- adjacent-pair Review order with one-session Undo;
- human-readable provenance, relationships, aliases, catalog coverage, and rights attribution in
  details without exposing raw ontology ids, pinned catalog versions, registry ids, or parent codes;
- exclusive Curious about / Not for me transitions by canonical identity;
- rank-weighted, evidence-backed region and editorial-family Taste patterns without raw registry
  codes;
- category-bound backup/restore and reviewed exact-name/alias import;
- text and Markdown exports with human-readable VBO credit, plus identity-preserving JSON exports;
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

The additive Dogs migrations were created with `supabase migration new`:

- `supabase/migrations/20260716090037_add_category_data_tables.sql`
- `supabase/migrations/20260716090038_add_dog_artwork_storage.sql`

The first adds only `category_rankings`, `category_lists`, `category_pack_progress`, and
`category_shared_lists`. It explicitly grants the intended Data API roles, enables RLS, gives every
owner table SELECT/INSERT/UPDATE/DELETE policies, uses `(select auth.uid())`, gives UPDATE both
`USING` and `WITH CHECK`, bounds all JSON payloads and generic identifiers, and restricts anonymous
snapshot reads to safe columns on non-revoked rows. Mature Movies tables are untouched.

The second prepares a public-read, WebP-only `dogs-catalog` bucket with a 5 MiB object bound and no
browser list or write policies. Artwork delivery remains a separate operator action.

Docker and local Postgres are unavailable on this machine. The Stack Rank project is now in the Pro
organization, and the three-file migration sequence first passed on a no-production-data hosted
branch using PostgreSQL 17, two real Auth users, SQL/grant/RLS/constraint checks, Data API isolation,
public/revoked snapshot checks, Storage restrictions, and advisors. Fixture cleanup passed and the
branch was deleted without merge.

On July 22 Dan explicitly authorized production project `hrfhakrxsllrqmscxxpb`, and the CLI applied
the normal pending sequence in this exact order:

1. `20260709001734_add_tonight_events.sql`
2. `20260716090037_add_category_data_tables.sql`
3. `20260716090038_add_dog_artwork_storage.sql`

Post-application production probes passed the exact ledger, schema, explicit Data API grants, RLS,
17-policy surface, constraints, bounded bucket, mature Movies-table compatibility, and unchanged
advisor-baseline checks. Two real disposable Auth users then passed owner CRUD, cross-user denial,
same-owner cross-category isolation, anonymous safe-column snapshot reads, revocation denial, and
Storage public-known-object/list/write restrictions. The Storage fixture, all fixture rows, and both
Auth users were removed; the residue check was zero. The detailed evidence and repository-history
baseline nuance are recorded in `notes/testing/dogs-supabase-rls-review.md`.

One operator-output redaction mistake exposed both legacy JWT API-key values inside this private
Codex task. The confidential legacy service-role JWT was treated as compromised; the legacy
anonymous JWT is public by design but shared the legacy signing-secret system. No modern publishable
or secret key was exposed, the one temporary artifact containing JWT-shaped material was deleted,
and repository plus StackRank temporary-file rescans were clean. Remediation completed on
2026-07-22: the legacy anonymous/service-role API keys were disabled, the previous legacy HS256
signing key was revoked, the current P-256 signing key remained active, and the bounded production
probe passed afterward using only modern publishable/secret keys with zero fixture residue.

## Family home and release boundaries

`home.html` is a noindex family-home artifact with equal Movies and Dogs cards, global privacy/account
navigation, count-only per-category progress, and no category app bundles. It intentionally remains
at `/home.html`; `vercel.json` still redirects `/` to `/movies` as explicitly required.

Legacy Movies `/s/:slug` remains unchanged. Dogs owner controls and the distinct anonymous
`/s/dogs/:slug` artifact are complete with locally enabled capabilities. Mocked browser QA
covers merge, publish/update/copy/revoke, anonymous rendering, revoked denial, and legacy identity
remapping. The migration, production probe, capability, privacy, static, cache, and local Browser
gates have passed, but the activated Dogs publish UI has not been committed, pushed, or deployed.

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
- the runtime catalog now references 28 rights-reviewed, immutably delivered Commons photographs
  and uses neutral code-native fallbacks for every other concept;
- the family home is noindex/unrouted until the public launch authorization;
- public text-snapshot controls follow the signed-in release contract, while public-snapshot artwork
  and raster sharing stay absent because those independent purpose gates remain denied.

Accepted implementation screenshots are produced by the Dogs and family-home E2E flows under
`reports/e2e/latest/screenshots/`. Desktop Rank, Ranking, detail, phone comparison, phone landscape,
iPad portrait/landscape, family desktop/mobile, catalog failure, and storage failure were visually
inspected during implementation.

## Verification and release checklist

Final local verification completed with a green `npm run verify` on July 21, 2026 (the report uses
UTC July 22):

- 398 / 398 Node unit and data tests passed (`reports/runs/2026-07-22T042033Z`);
- 24 / 24 Deno function tests passed;
- browser syntax and all 57 cache-manifest assets passed;
- the 114-pack Movies validator passed;
- Dogs catalog, structural artwork, comprehensive artwork-discovery, and 46-pack validators passed;
- 37 / 37 real-Chrome flows passed (`reports/e2e/runs/2026-07-22T042052Z`), including
  Movies, Books, Dogs, family home, exact 390×844 and 844×390 Dogs viewports, iPad, failure
  recovery, strict backup/import/export downloads, approved-artwork attribution, pointer/keyboard
  reorder and cancellation, legacy Movies sharing, and the then-fail-closed Dogs account-sync/public-link
  flow. The new desktop, phone, iPad, and public-snapshot screenshots were visually inspected.

After production probes and artwork delivery passed, the local activation follow-up enabled only
Dogs account sync and public snapshots, kept raster export false, and passed 36 focused
capability/remote-persistence tests, syntax/cache checks, signed-out Browser inspection, the mocked
no-loss sync and full public-link lifecycle E2E flow, and the desktop/mobile privacy E2E flow.

The exact phone pass found and repaired a real intrinsic grid overflow that a shrink-to-fit geometry
check had masked; the final regression asserts a 390px layout viewport and zero horizontal overflow.
The Chrome harness retries one failed initial CDP launch with a fresh profile, foregrounds each CDP
page target, and enables headless focus emulation before interaction. Keyboard reorder checks enable
the explicit Move mode before testing visible handles. The unified Posters check dispatches a
bubbling, cancelable Arrow Down event directly to that handle because Linux headless Chrome does not
reliably retain DOM focus on this newly rendered control; it still verifies that the application
handled the event, reordered both views, rendered the moved handle's accessible label and keyboard
shortcuts, announced the move, and supports Undo. Separate list and full ranking flows retain
real-CDP focus movement coverage. The same hardening completes CDP key pairs in Share Studio,
records focus-restoration calls across deliberate DOM replacement, and excludes transient
`:focus-visible` colors from the pack close-control base-style comparison.

The networked
`npm run test:production` script now contains Dogs route, header, metadata, immutable catalog/packs,
privacy-credit, and sitemap assertions, but it must not be run as evidence for Dogs until the
corresponding commit is actually deployed.

For the iterative public local-first launch:

1. Commit and push the integrated, fully verified local-first release without `logo-design-brief/` or
   unrelated dirty-worktree content, then deploy the public `/dogs` route while `/` stays on
   `/movies` and Books stays noindex.
2. Verify the real production Dogs route, Movies compatibility, headers/cache behavior, responsive
   rendering, and console/network cleanliness.

For the integrated sync, links, and photography release:

1. The exact three-file production migration set and post-application probes are complete. Preserve
   the captured migration order and zero-residue result as the production baseline.
2. The local client now enables only Dogs account sync/public snapshots, updates privacy and
   production-smoke assertions in the same release, and keeps raster export false. Verify real
   signed-in auth plus anonymous/revoked links on a protected preview before deployment.
3. The delivered 28-image UI-display batch is integrated while public-snapshot and raster artwork
   remain false. Expand photography incrementally rather than holding the product for aspirational
   95% current-canonical coverage.
4. Keep the revoked legacy JWT path disabled, do not reuse or redistribute the exposed confidential
   JWT, and keep operational clients on independently managed modern publishable/secret keys.

The root redirect remains `/movies`; a family-home cutover is not required for Dogs launch and
remains separately unauthorized.
