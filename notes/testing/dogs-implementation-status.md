# StackRank Dogs implementation status

## Current cohort H — September 23, 2026

H01 is complete and live: **25 additional accepted portrait/profile pairs bring production to 432 of 1,239; 807 unfinished identities remain hidden.** H02 has 18 accepted native portraits and independently reviewed full/short descriptions awaiting integration and release to reach 450.
Product `43fce77b` is pushed and Vercel READY. Full `npm run verify` passed **475 Node tests, 24 Deno tests and 41 Chrome flows**; production passed **49 checks and 15 exact byte comparisons**, including new image variants, descriptions and generation metadata. Desktop and phone Rank, browse/detail, comparison, ranking and artwork-review surfaces were checked. Prior artwork and approved profiles remain unchanged.

H keeps its frozen 43-primary/10-reserve selection and append-only amendment. Smooth Saluki `VBO:0201173` is held: its proposed original duplicates an existing public fallback, and three distinct alternatives failed morphology/readability gates. Ordered reserve Petit Bleu de Gascogne `VBO:0201010` replaces it. **27 holds remain visible: E20, F5, G1, H1.** No historical hold was reopened. H used three reused **gpt-6-sol/high** workers; primary runtime configuration and the built-in image model were not disclosed.

H01 used 29 built-in calls for 25 accepted masters and four quality rejections. H02 has 19 calls, 18 outputs and one failed Hällefors input call followed by a documented compatibility retry; there were no H02 native quality rejections. Continue with H02 only after the H01 documentation follow-up is pushed.
See `notes/testing/dogs-portrait-cohort-h.md` and `data/dogs/portrait-cohort-h.json` for selection, acceptance, publication and next-session details. Evidence and local native masters live under `reports/dogs-generated-artwork/cohort-h/` and `assets/dogs/generated-masters/cohort-h/`.

All 1,239 source records and hidden saved entries remain intact. Generated artwork stays disclosed and permitted only in normal Dogs UI; public-snapshot and raster-export purposes remain false. Movies, Books, the root redirect, database/Storage and concurrent site improvements are preserved. Dan explicitly authorized direct-main commits, pushes and their normal Vercel deployments for this run; historical release prohibitions below are superseded within that scope.

## Historical 100-pair continuation — completed before H

The new 100-pair continuation is complete and live: **100 additional accepted portraits and individually
researched descriptions; 407 of 1,239 overall, with 832 unfinished identities hidden from the main site.**
Final product `3ab129ae` is pushed and Vercel READY. Final full verification passed 466 Node, 24 Deno
and 41 Chrome flows; production passed 49 checks and 15 exact byte comparisons. Previously published
artwork, approved full profiles and sources remain unchanged. All four milestones have production receipts.
See `notes/testing/dogs-portrait-continuation-100.md`, `notes/testing/dogs-portrait-cohort-g.md` and
`data/dogs/portrait-continuation-100.json` for frozen selections, publications and latest lessons.
E retains 20 holds, F retains 5, G retains 1; this run activated three ordered reserves. Grey Norwegian
Elkhound 0200957 is held as a duplicate of already published 0200955, with Brindle Boxer 0200211 replacing
it by append-only G amendment. No active identity remains unfinished in this run. Native outputs and
rejected/held evidence are preserved. Future artwork should start from current 407 coverage and a fresh
cohort (H if unused), verifying checkout counts first; do not rerun this completed selection.
Hidden saved state, normal-UI-only generated artwork, denied snapshot/export purposes, Movies/Books,
root redirect and the concurrent site improvements remain intact. Historical counts below are retained.

## September 22 direct ranking and compact views

Product commit `610c2eea` makes unranked discovery portraits and Surprise me start ranking directly;
All dogs keeps opening profiles. The discovery toolbar groups search, Surprise me and Shuffle dogs
(full-width search above the buttons on phones). The pack section is now titled Dog packs. Full
packs show unranked dogs before visibly grayscale/dimmed ranked dogs.

Comparison cards choose a dog everywhere except a small image-corner info control, with a 44px
hit target. The old footer buttons are gone. Escape closes About and restores the active pair;
phone portrait and landscape keep both choices and useful portrait sizes inside one viewport.

All 307 approved profiles have authored `shortDescription` values (89–142 characters). Detailed
ranking displays those complete sentences without clipping; Photos contains portraits/names,
and Compact keeps small thumbnails in a dense list. Full summaries and other profile fields and
sources remain unchanged. Keyboard Move controls retain focus through repeated arrow presses.
The source/model and future-batch writing contract are documented in `dogs-breed-profile-quality.md`.

Full `npm run verify` passed: 455 Node tests, 24 Deno tests, 69 cache-checked runtime assets,
all catalog/data validators and 41/41 Chrome flows. Reports: `reports/runs/2026-09-23T064353Z`
and `reports/e2e/runs/2026-09-23T064410Z`. Coverage includes real discovery/Surprise clicks,
All dogs detail behavior, ranked-last/grayscale pack state, profile disclosure and Escape,
no clipped short descriptions, Photos/Compact density, and repeated keyboard moves in all views.
Desktop, exact phone portrait/landscape, and iPad layouts were checked; mobile screenshots and
the grouped mobile discovery controls were visually inspected.

Runtime versions: `dogs.js?v=50`, `dogs.css?v=10`, `dogs-explore.js?v=4`,
`dogs-explore.css?v=4`, `dogs-comparison.css?v=5`, `lib/dogs.js?v=7`,
`breed-profiles.json?v=6` (profile version `.7`), and `dogs-artwork-review.js?v=9`.
The shared category switcher remains at `v=1`. No image, rights-ledger, database, persistence,
or public-completion-gate changes are part of this release.

Vercel completed the deployment of `610c2eea`; all 49 `npm run test:production` checks passed.
Rendered production `/dogs?debug=1` confirmed the updated toolbar and Dog packs title, an authored
short description in Detailed ranking, and the unchanged full Great Dane profile with its portrait
and source disclosure. No console warnings/errors were recorded, and no ranking data was changed.
Production log: `/tmp/stackrank-dogs-ui-production.log`.

Concurrent portrait/profile preparation remains in the separate artwork worktree. That task
agreed to add reviewed short descriptions directly to new profile-refresh entries and integrate
its compiled artifact/cache changes only after this UI release.

## September 22 ranking-priority feedback

Product commit `d989cb7c` restores whole-card comparison choices, keeping About this dog as a
separate control. Escape from About dismisses only the profile and returns focus to the same pair;
Escape from the active comparison cancels it. Profile Rank this breed and pack Rank next have
primary styling. The redundant profile disclaimer is removed.

“A few dogs to meet” now groups a wide search row with Surprise me on the right and Browse all
dogs highlighted above the portraits. Search/Browse remain available when there are no new rail
suggestions. Packs use pictures and names without tags/Meet links; See all dogs opens every
eligible breed in that pack. Ranking/cancel restores the full pack's scroll/focus. Progress reflects
ranked counts, with Curious and Not for me separate; user-facing “handled” wording is removed.

Full `npm run verify` passed: 455 Node tests, 24 Deno tests, syntax/cache checks, all catalog/data
validators and 41/41 browser flows (`reports/e2e/runs/2026-09-23T060635Z`). New coverage uses real
pointer clicks on comparison portraits/names, real Escape from About on desktop and phone,
full-pack membership and ranking/cancel return, scroll/focus, progress refresh, grouped discovery
geometry and primary action contrast. Desktop and phone layouts were visually inspected.
Phone rank choices remain within one viewport; scrolling is confined to the separate About view.

Runtime versions: `dogs.js?v=49`, `dogs.css?v=9`, `dogs-explore.js?v=3`,
`dogs-explore.css?v=3`, `dogs-comparison.css?v=4`; shared category switcher stays at `v=1`.
Vercel reported the deployment complete; all 49 `npm run test:production` checks passed.
Rendered production `/dogs?debug=1` confirmed the grouped discovery controls, primary profile
ranking action, loaded portrait and removal of the disclaimer, with no console warnings/errors.

## September 22 discovery and comparison refinement (initial release)

Product commit `cd85278c` makes discovery the main Dogs entry point, adds the public
24-portrait browse gallery, compacts the header/search, repairs settings/Recently ranked styling,
adds desktop comparison descriptions and mobile profile disclosure, and shares a quiet category
switcher across Movies and Dogs. Details: [design record](../feature-ideas/dogs-discovery-refinement.md).

Validation passed: full `npm run verify` with 455 Node tests, 24 Deno tests, 69 versioned runtime
assets, all Movies/Dogs data validators, and 40/40 browser flows
(`reports/e2e/runs/2026-09-23T052801Z`). The gallery regression passed again after the final
scroll-restoration refinement (`reports/e2e/runs/2026-09-23T053021Z`).
In-app desktop and phone screenshots and real interactions were inspected; the automated suite
also covers exact phone portrait/landscape and iPad geometry. No portrait/profile content,
database schema, artwork rights gate, or root-route change is included.

Vercel completed the production deployment of `cd85278c`. `npm run test:production` passed
all 49 checks, including the new discovery/comparison/switcher assets and immutable cache headers.
Rendered production `/dogs?debug=1` showed the compact header and gallery; opening a breed
displayed its full portrait/profile with sequential navigation and no console warnings/errors.
The public cohort remains 307. Runtime versions are `dogs.js?v=48`, `dogs.css?v=8`,
`dogs-explore.js?v=2`, `dogs-explore.css?v=2`, `dogs-comparison.css?v=3`, and shared
category-switcher JS/CSS at `v=1`.


Status date: **September 22, 2026**

**Latest release — September 22, 2026:** Cohort F01 adds **25 accepted portraits and 25
independently reviewed personality-first descriptions**, for **307 completed pairs**. Product commit
`19221e09` also limits the main Dogs site to those 307 completed identities.
The full 1,239-record catalog is retained; 932 unfinished identities are hidden, with saved rankings,
queues and backups preserved. Completing both gates restores an identity automatically. There are
42 nonempty public packs from 46 source packs. Existing public snapshots are not rewritten; new
snapshots and exports use visible entries. Artwork sharing remains denied.

Dan requested stopping after this batch around 300 total. The original 100-identity F selection stays
frozen for future use; do not start further work without a new request. Seventeen additional native
F02 outputs are staged only, unaccepted and unpublished. Start next session with
`notes/testing/dogs-portrait-cohort-f.md`, `data/dogs/portrait-cohort-f.json` and
`data/dogs/portrait-cohort-f-staging.json`. All 20 E holds remain; three F holds and three ordered
reserve activations are recorded. Prior 282 portraits, rights rows and approved profiles are unchanged.

Verification for F01: **453 Node tests, 24 Deno tests, all validators, 39 Chrome flows and 44
production checks passed**. Vercel deployment `dpl_BSPUEzBLdn6E9RK2t223KYV9oVkX` is READY;
all 50 new WebPs and current runtime/profile/provenance artifacts match production byte hashes.
Live desktop/phone checks confirmed matching descriptions in both surfaces and completed-only search.
Committed receipt: `data/dogs/portrait-cohort-f-release-f01.json`.

**Previous artwork update (historical):** Commit `635e54c7` brings preserved batch D plus 230 newly accepted
cohort-E portraits. Production now has **282** generated portraits; all 250 selected identities have
been reviewed, with 20 reference holds. See `notes/testing/dogs-portrait-cohort-e.md` for current
counts, blockers and checks.
The new unlinked `/dogs/artwork-review` page provides pagination, search, a large-image dialog,
generation provenance, local concern notes and export. Full verification passed 440 Node tests,
24 Deno tests, all validators and 38 Chrome flows; 44 production checks passed.
**Previous profile update (historical):** Deployed commit `ce6687ff` rewrites all 282 illustrated profiles around personality
and character, with habits, instincts, skills and history supporting that introduction. It follows
the earlier boilerplate cleanup (`82a69801`) and sourced depth pass (`3dd3957a`). Both Dogs and the
artwork reviewer use artifact `.5` / dataset cache version 4 and expose 310 breed-source references
in expandable notes. The other 957 catalog entries remain brief pending individual research.
Verification passed 443 Node tests, 24 Deno tests, all validators and 38 Chrome flows; reports are
`reports/runs/2026-09-23T011459Z` and `reports/e2e/runs/2026-09-23T011516Z`. The shared authoring
contract and installed `stackrank-dog-profiles` skill now require personality-first copy. See
`notes/feature-ideas/dogs-breed-profile-quality.md` for release evidence.
All 44 production smoke checks passed, and the live detail panel was visually verified.

**Artwork reviewer keyboard update:** Deployed commit `c44768b2` adds left/right navigation through
the filtered portrait sequence, including across gallery pages, and visible previous/next controls
with a position counter. Outside the dialog, arrows turn gallery pages. Escape closes and restores
focus to the current portrait. Unsaved drafts remain attached to their portrait; text editing keeps
native arrow behavior, while focused concern checkboxes permit portrait navigation.
Final `npm run verify` passed 443 Node tests, 24 Deno tests, all validators and 38 Chrome flows
(`reports/runs/2026-09-23T024746Z`, `reports/e2e/runs/2026-09-23T024803Z`). Coverage includes
filtered sequences, page boundaries, draft restoration, editing guards, Escape/focus and phone
navigation controls; desktop and phone screenshots were visually inspected. Vercel reported a
successful deployment; all 44 production smoke checks passed. Real keyboard input on the live
`/dogs/artwork-review?debug=1` page verified next/previous portraits and Escape with focus restoration.
Dan's approval of the personality-first descriptions is recorded in the authoring contract for
future profiles and revisions.

The original 52-portrait local-release sections below describe the earlier baseline.

Durable continuation context for a new agent is recorded in
`notes/feature-ideas/dogs-product-handoff-2026-09-22.md` and
`notes/feature-ideas/dogs-artwork-expansion-handoff-2026-09-22.md`. A paste-ready large-cohort
kickoff is in `notes/feature-ideas/dogs-artwork-expansion-kickoff-prompt.md`.

StackRank Dogs is now a substantial public second product, not a demo. The `/dogs` route, complete
generated catalog, editorial discovery library, ranking/list utilities, failure handling, shared
category contracts, additive production persistence, family-home artifact, and regression coverage
shipped in commit `31267389` through merged PR #4 on July 22, 2026. The exact protected-preview
artifact was promoted to production, then `main` was fast-forwarded to the same commit. The
production root still redirects to `/movies`, and Books remains noindex and local-only.

The September field-guide release adds a warmer, image-forward product system, a friendly profile
for every selectable catalog entry, and 52 art-directed generated breed portraits for the promoted
cohort plus the 24 highest-priority previously unillustrated pack breeds. The rights ledger keeps the
original 28-photo fallback intact and adds 24 reference-only, purpose-denied morphology sources.
Account sync and revocable public text snapshots are active after real
production Auth/Data API/browser verification. Public-snapshot artwork and raster sharing remain
separately denied by purpose policy.

The 24-portrait expansion described below is complete in the local working tree and has not yet been
committed, pushed, or deployed. Production therefore remains on the original 28-portrait field-guide
release until a separate release action is authorized.

## Delivery phase status

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 0 — orient and protect | Complete | Existing Books/cross-domain work and `logo-design-brief/` were preserved; Movies stayed on its existing routes, keys, tables, and payloads. |
| 1 — catalog compiler | Complete | Pinned VBO release, 100% raw-term disposition, deterministic compiler, validator, difficult-case tests, and an accountable 2026-07-21 editorial audit of every generated review queue. |
| 2 — artwork pipeline | Second generated portrait cohort complete locally; release pending | All 27 promoted entities plus Broholmer and 24 additional high-visibility pack breeds have art-directed generated portraits in 320/960 WebPs with source-reference provenance and recorded human QA. The separate licensed-photo import/process/ledger pipeline remains fail-closed. Public-snapshot and raster-export purposes remain denied for both systems. |
| 3 — shared category platform | Complete for demonstrated local behavior | Entity, catalog, ranking session, ranked-list, backup, provider-purpose, list transition, ranking operation, and remote-row contracts have focused tests. Books remains noindex and working. |
| 4 — Dogs local product | Complete, field-guide V2 shipped | `/dogs` implements the Movies-parity interaction contract, a warm editorial visual system, six-pack discovery shelf, all-catalog field notes and dog-family labels, image-forward comparison/ranking/details, and responsive/failure browser flows. |
| 5 — sync, links, family | Active in production | Account sync, per-list timestamps, account isolation, owner publish/update/copy/revoke, and the anonymous `/s/dogs/:slug` renderer are live and independently security-reviewed. Production probes and a post-deploy disposable-account browser pass verified remote ranking persistence plus active/revoked snapshot behavior with zero fixture residue. Raster sharing remains separately disabled. The noindex `home.html` artifact remains unrouted. |
| 6 — launch hardening | Public release live | Privacy/credits, sitemap, security/cache routes, validators, screenshots, full verification, real-Postgres rehearsal/probes, and immutable artwork delivery passed for the original launch. Field-guide commit `254810ae` passed the complete local release gate, deployed successfully through Vercel, and passed all 35 production-smoke checks; `/` remains on `/movies`. |

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

## Field-guide profile coverage

`data/dogs/breed-profiles.json` contains one bounded profile for every `1,239` selectable concept:

| Review tier | Profiles | Contract |
| --- | ---: | --- |
| Editor-reviewed | 282 | Individually written breed descriptions for every portrait-bearing identity; optional distinct facts, supported size/history/origin information, and traceable source notes. |
| Source-reviewed | 314 | Unique structured source match and/or cited registry context, compiled conservatively. |
| Generated baseline | 643 | Concise identity/classification/origin context; no process filler or invented temperament, suitability, or household-fit claims. |

Every profile carries a human-readable dog-family label. Official FCI family context wins when it is
available for the promoted cohort, a curated editorial family is next, and the remaining long tail
uses an explicit breed/variety/crossbreed/historical catalog label rather than a guessed kennel-club
classification. Popularity appears only where its geography, year, source, rank, and denominator are
recorded; the initial release includes scoped 2025 U.S. AKC facts for three editor-reviewed breeds.

The deterministic compiler combines the pinned VBO catalog, the bundled editorial packs, a 2026-09-21
Wikidata CC0 snapshot, the citation-only promoted FCI snapshot, the original override file, and
the three source-backed profile refresh batches. New source references preserve exact breed identity;
explicitly researched origins take precedence over structured-source origin matches.
`npm run validate:dogs:profiles` requires exact all-catalog coverage, bounded fields, declared sources,
safe review states, and byte-for-byte current output.

Key artifacts:

- `data/dogs/breed-profiles.json`
- `data/dogs/breed-profiles.schema.json`
- `data/dogs/profile-overrides.json`
- `data/dogs/profile-refresh-a.json`, `profile-refresh-b.json`, and `profile-refresh-c.json`
- `data/dogs/sources/wikidata-dog-breeds-2026-09-21.json`
- `data/dogs/sources/fci-promoted-profiles-2026-09-21.json`
- `scripts/build-dog-profiles.mjs`
- `scripts/dog-profiles-lib.mjs`
- `scripts/validate-dog-profiles.mjs`

## Generated portraits and licensed-photo fallback

The normal UI now prefers 52 art-directed generated portraits: every promoted starter entity plus
Broholmer, then the 24 highest-priority previously unillustrated breeds that appear in at least three
editorial packs. Each manifest row records the exact rights-reviewed morphology reference, prompt
template version, master hash, generated timestamp, 320/960 WebP hashes, and four-part human review
for breed identity, anatomy, crop, and aesthetics. The tracked variants total 104 files; full-resolution
generation masters remain local and ignored. The UI visibly discloses that these are generated breed
illustrations and that individual dogs vary.

`data/dogs/generated-artwork-policy.json` is intentionally separate from the licensed-photo ledger.
It allows normal UI display only; public snapshots and raster export remain false. The compiler and
validator reject unreviewed assets, missing reference-ledger rows, unsafe paths, wrong dimensions,
hash drift, or downstream-purpose expansion.

The original 28-row licensed-photo system remains available as the fail-closed fallback. The 24 new
source rows are approved only as morphology references: they are not processed or enabled for UI,
public snapshots, or raster exports. Exact licensed-photo purpose coverage is:

Current exact purpose coverage is:

| Gate | Approved / required |
| --- | ---: |
| UI display | 28 / 877 current canonical |
| Public snapshots | 0 / 877 current canonical |
| Raster export | 0 / 877 current canonical |
| Promoted starter entities with UI display | 27 / 27 |

All 27 promoted entities have a Wikimedia Commons candidate imported by exact file page and revision,
plus one nonpromoted Broholmer row (`28` display-ready fallbacks). The second cohort adds 24 separately
gated reference-only rows, for `52` exact ledger records total. Every source was streamed and verified
against SHA-256, Commons SHA-1, and byte count, then visually checked for a plausible single-breed
subject. All 52 passed accountable subject, license, and non-copyright review; the original 28 also
passed deliberate crop and delivery review and remain the only licensed photos enabled for UI display:

| UI-display fallback license | Rows |
| --- | ---: |
| CC BY 2.0 | 4 |
| CC BY-SA 3.0 | 12 |
| CC BY-SA 4.0 | 11 |
| CC0 1.0 | 1 |

The original display-ready set adds the Broholmer CC BY-SA 3.0 row. An initial Basenji candidate using a regional
CC BY-SA 3.0 AT license was rejected rather than weakening policy; a generic CC BY-SA 4.0 file was
selected instead.

No licensed-photo runtime image is checked into the repository. The licensed-photo processor applies
the approved editorial 3:2 crop, emits hashed 320×213 and 960×640 WebPs, and records the
transformation. Those 56 objects remain stored under immutable production paths and were read back
and verified against their manifest bytes, MIME type, and cache policy. The licensed-photo ledger
records the UI-display purpose for all 28 assets while keeping public-snapshot and raster-export
purpose booleans false. Openverse remains a discovery-only source and cannot write directly to the
rights ledger.

The UI prefers the 52 generated portraits, can fall back to the 28 separately approved licensed
photographs, and uses a polished code-native fallback everywhere else. Public-link artwork and
raster sharing remain disabled because normal UI-display approval does not imply either additional
purpose.

A deterministic review-only discovery queue now accounts for all `825` current-canonical concepts
that do not yet have any ledger row: `161` are prioritized by editorial-pack engagement and `664`
form the catalog long tail. All `52` existing ledger ids are excluded regardless of approval state,
so no pending candidate is accidentally rediscovered as “missing.” The queue embeds source versions
and SHA-256 digests plus bounded Openverse/Commons search inputs; it performs no request, import,
approval, or download by itself.

`npm run review:dogs:artwork` builds a noindex local review workspace under
`reports/dogs-artwork-review/`. It presents all 52 exact ledger candidates with uncropped Commons
originals, pinned/current source links, hashes, attribution, license text, and three separate human
review dimensions. Work-in-progress notes stay in that browser and export as a review-aid JSON file;
the workspace has no approval, upload, processing, or ledger-write capability.

Key artifacts:

- `data/dogs/image-rights.json`
- `data/dogs/generated-artwork.json`
- `data/dogs/generated-artwork-policy.json`
- `data/dogs/generated-artwork-batch-{root,a,b,c,d}.json`
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
- `scripts/build-generated-dog-artwork.mjs`
- `scripts/validate-generated-dog-artwork.mjs`

## Implemented product contract

`dogs.html`, `dogs.js`, and `dogs.css` provide:

- accessible canonical/alias search over all 1,239 selectable concepts;
- a friendly bounded field note and human-readable dog-family label for all 1,239 concepts, with
  deeper editor-reviewed copy, interesting facts, origins, size, history, registry group, and scoped
  popularity where evidence exists;
- canonical VBO identity storage even when an alias initiated ranking;
- six rotating/continuation packs on Rank, all 46 packs in a filterable browser, progress, image-forward
  breed cards, browse prompts, and Recently ranked;
- binary insertion with opening jitter, exact midpoint narrowing, Undo last choice, Cancel, and origin/scroll restoration;
- Detailed, Photos, and Compact ranking views;
- safe status/region/approved-image filters with reorder disabled while filtered;
- mouse, coarse-pointer handle, and keyboard reorder with announcements and Undo;
- adjacent-pair Review order with one-session Undo;
- image-forward details and comparisons with human-readable provenance, relationships, aliases,
  catalog coverage, generated-image disclosure, and licensed-photo attribution in
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
`/s/dogs/:slug` artifact are live. Mocked browser QA
covers merge, publish/update/copy/revoke, anonymous rendering, revoked denial, and legacy identity
remapping. The migration, production probe, capability, privacy, static, cache, protected-preview,
and post-deploy Browser gates have passed.

`.vercelignore` keeps versioned ontology inputs, audit fixtures, tests, notes, migration sources, local
full-resolution generated masters, and design workspaces out of deployment uploads while retaining
the bounded Dogs runtime catalog, profiles, optimized generated portraits, packs, rights ledger, and
license policies.

## Visual fidelity ledger

Generated design references are ideation artifacts only:

- `notes/feature-ideas/multi-domain-assets/dogs-primary-screen-concept.png`
- `notes/feature-ideas/multi-domain-assets/dogs-comparison-mobile-concept.png`
- `notes/feature-ideas/multi-domain-assets/stackrank-family-home-concept.png`

Adopted and advanced: editorial hierarchy, oversized direct prompt, central rank bar, restrained ruled
pack layout, two-choice comparison takeover, equal category cards, and double-keyline primary actions.
The field-guide release adds warm bone/clay/moss accents, oversized breed names, portrait-first cards,
friendly field-note copy, fact callouts, and visible “Meet this dog” actions without turning the
product garish or abandoning Movies’ Rank / Ranking / You mechanics.

Intentional deviations:

- generated breed portraits now serve as normal runtime UI after a separate generation policy,
  reference-provenance manifest, per-image human QA, and visible disclosure were added;
- the licensed-photo rights ledger remains intact as a fallback and is not conflated with generated
  artwork permission;
- the family home remains noindex/unrouted pending a separate root-cutover authorization;
- public text-snapshot controls follow the signed-in release contract, while public-snapshot artwork
  and raster sharing stay absent because those independent purpose gates remain denied.

Accepted implementation screenshots are produced by the Dogs and family-home E2E flows under
`reports/e2e/latest/screenshots/`. Desktop Rank, Ranking, detail, phone comparison, phone landscape,
iPad portrait/landscape, family desktop/mobile, catalog failure, and storage failure were visually
inspected during implementation.

## Verification and release checklist

The September 22 field-guide update completed with a green `npm run verify`, followed by a final
syntax/cache/browser rerun after tightening synchronous detail-image painting:

- 424 / 424 Node unit and data tests passed (`reports/runs/2026-09-22T064338Z`);
- 24 / 24 Deno function tests passed;
- browser syntax and all 59 cache-manifest assets passed;
- the 131-pack Movies validator passed;
- Dogs catalog, all-catalog profiles, structural licensed artwork, generated portraits,
  comprehensive artwork-discovery, and 46-pack validators passed;
- 37 / 37 real-Chrome flows passed (`reports/e2e/runs/2026-09-22T064812Z`), including
  Movies, Books, Dogs, family home, exact 390×844 and 844×390 Dogs viewports, iPad, failure
  recovery, strict backup/import/export downloads, generated-artwork disclosure, licensed-artwork
  attribution fallback, pointer/keyboard
  reorder and cancellation, legacy Movies sharing, and the activated Dogs account-sync/public-link
  flow. The new desktop, phone, iPad, and public-snapshot screenshots were visually inspected.
- Vercel reported a successful Production deployment for `254810ae`; the canonical `/dogs` route
  served `dogs.css?v=7`, `dogs.js?v=26`, and exact generated WebP bytes. `npm run test:production`
  then passed all 35 route, redirect, security-header, cache, metadata, catalog, privacy-credit, and
  sitemap checks.

The local second-cohort expansion then passed the same full release gate: 424 / 424 Node tests
(`reports/runs/2026-09-22T140321Z`), 24 / 24 Deno tests, syntax and all 59 cache-manifest assets,
both pack validators, every Dogs catalog/profile/artwork/discovery validator, and 37 / 37 real-Chrome
flows (`reports/e2e/runs/2026-09-22T140338Z`). The Dogs browser flow now asserts that a newly added
Basset Hound result loads its exact generated 320px WebP from the real 52-portrait manifest; the
desktop result, 24-up master contact sheet, and responsive existing flows were visually inspected.

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

Post-deploy `npm run test:production` passed all 35 route, redirect, security-header, cache,
metadata, catalog, privacy-credit, and sitemap checks. A real disposable production account then
ranked Great Dane, reloaded it from the remote Dogs row, published an anonymous text-only snapshot,
verified that it exposed neither artwork nor internal catalog codes, revoked it, and observed the
public denial state. Cleanup removed its ranking, list, pack-progress, shared-list, and Auth records;
the final residue query returned zero. Vercel reported no runtime error clusters for the launch
window.

Ongoing release guardrails:

1. Preserve the exact three-file migration order and zero-residue result as the production baseline.
2. Keep public-snapshot artwork and raster export false until their independent rights-purpose gates
   pass; expand UI photography incrementally rather than holding the product for aspirational 95%
   current-canonical coverage.
3. Keep the revoked legacy JWT path disabled, do not reuse or redistribute the exposed confidential
   JWT, and keep operational clients on independently managed modern publishable/secret keys.
4. Keep `/` on `/movies` until a separate family-home cutover is explicitly authorized.

The root redirect remains `/movies`; a family-home cutover is not required for Dogs launch and
remains separately unauthorized.
