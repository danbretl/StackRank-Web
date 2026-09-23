# StackRank Dogs product handoff

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

Snapshot date: **September 22, 2026**

This is a durable orientation document for a new primary agent. It is a snapshot, not a replacement
for `AGENTS.md`, the code, or the authoritative launch/status documents. If they disagree, inspect
the current implementation and update this handoff rather than silently following stale prose.

## Product in one paragraph

StackRank Dogs is the public second StackRank product at `/dogs`. It keeps Movies' mature
**Rank / Ranking / You** structure and binary-insertion ranking mechanics, but behaves like a warm,
modern dog field guide: large breed names, excellent breed portraits, friendly field notes,
dog-family context, origins and history where supported, editorial discovery packs, and enough
personality that browsing unfamiliar dogs is fun. It ranks personal affection or interest. It is not
an adoption matcher, veterinary guide, buyer's guide, or predictor of an individual dog's behavior
or household suitability.
Breed descriptions should nevertheless prioritize sourced personality and character. Explain what
the breed is like as documented tendencies, then add distinctive habits, skills and history. A
portrait already shows appearance; it should occupy only a minor functional note in the prose.

## Historical release and working-tree snapshot (superseded above)

- Production `/dogs` is public and the production root still redirects to `/movies`.
- The substantial Dogs launch shipped in `31267389`; the field-guide redesign shipped in
  `254810ae`.
- `main` and `origin/main` currently point at `3118b869`.
- Production has the first 28 generated portraits. A second 24-portrait cohort is complete, fully
  verified, and present in the intentionally dirty local working tree, but is **not committed,
  pushed, or deployed**.
- The local integrated manifest therefore contains **52 generated portraits / 104 optimized WebP
  variants**. Full-resolution generated masters are local and gitignored.
- Preserve every existing local change. In particular, do not delete or modify the unrelated
  untracked `logo-design-brief/` directory.
- Books is paused, working, local-only/noindex, and out of scope for provider outreach or product
  expansion.

No future agent should assume that image-generation work grants commit, push, deployment, root
redirect, database-migration, or production-storage authorization. Those remain separate user
decisions.

## Product and data surface

### Catalog

- Pinned VBO release: `2026-04-15`, stored at
  `data/dogs/sources/vbo-2026-04-15.json`.
- Raw Dog breed descendants: **1,537**, with **100% explicit disposition**.
- Selectable runtime identities: **1,239**:
  - 877 canonical breeds/types;
  - 187 varieties;
  - 139 crossbreeds;
  - 36 historical types.
- VBO ids are the durable identity foundation. Search aliases resolve to the provider-qualified
  canonical identity; raw ontology ids and registry codes are not routine UI copy.
- Key files: `data/dogs/dog-catalog.json`, `data/dogs/classification.json`,
  `data/dogs/catalog-overrides.json`, and `scripts/build-dog-catalog.mjs`.

### Profiles and editorial discovery

- The unlinked `/dogs/artwork-review` viewer supports left/right arrows through the filtered
  portrait sequence, including page boundaries, and Escape to close. Outside the dialog, arrows
  turn gallery pages. Visible controls and a counter support touch use; shortcuts leave text editing
  alone and keep unsaved drafts associated with each portrait. Closing reveals and focuses the
  current portrait. The review sequence stays fixed while open even if a flag is cleared.
- `data/dogs/breed-profiles.json` covers every selectable identity.
- The profile tiers are 282 editor-reviewed, 314 source-reviewed, and 643 conservative generated
  baselines. All 282 illustrated breeds have been rewritten to prioritize sourced personality and
  character, with working habits and history secondary. The original 28 preserve their new source
  evidence in `data/dogs/profile-overrides.json`; the other 254 use `profile-refresh-{a,b,c}.json`.
  All 310 breed-source references appear in expandable notes in the app and artwork reviewer. Baselines
  contain concise identity/origin facts, with no research-process filler or empty fact callouts.
  See `notes/feature-ideas/dogs-breed-profile-quality.md` and the `stackrank-dog-profiles` skill.
- `data/dogs/packs.json` contains 46 validated editorial packs with 448 references across 251
  distinct VBO ids and 17 editorial families.
- Every profile has a friendly field note and a human-readable dog-family label. Origins, historical
  roots, size, registry context, and popularity appear only when scoped evidence exists.
- Popularity claims must always include geography, year, source, rank, and denominator.

### Core interactions

The discovery refinement in `dogs-discovery-refinement.md` replaces the oversized hero while
keeping ranking primary. Search spans the “A few dogs to meet” section, beside Surprise me;
Browse all dogs is a highlighted section action. Full pack details show every eligible dog with
portrait/name ranking and Rank next, preserving the pack after completion/cancel. Whole comparison
cards choose a dog; About this dog is separate, and Escape from About returns to the same pair.
Rank this breed is visually primary in profiles. Movies and Dogs share a quiet brand dropdown.
The redundant profile disclaimer and user-facing “handled” wording are removed.

`dogs.html`, `dogs.js`, and `dogs.css` implement:

- accessible canonical/alias search and gallery across the 307 completed public identities;
- compact discovery introduction, four shuffled portraits, Surprise me, rotating/resumable packs, and Recently ranked;
- exact binary insertion with opening jitter, Undo, Cancel, and origin restoration;
- Detailed, Photos, and Compact ranking views;
- safe filters plus mouse, touch, and keyboard reordering;
- adjacent-pair Review order with session undo;
- image-forward comparisons, ranking rows, discovery cards, and breed details;
- mutually exclusive Curious about / Not for me lists;
- evidence-backed Taste patterns;
- category-bound backup, restore, name/alias import, and text/Markdown/JSON exports;
- account sync and revocable, read-only, text-first public snapshots at `/s/dogs/:slug`.

Movies parity is the default. Dogs should deviate only when responsible dog discovery or field-guide
context materially benefits.

## Architecture and compatibility boundaries

The app remains a plain static SPA: no framework, bundler, or application npm dependencies. Shared
DOM-free primitives live under `lib/`; Dogs-specific content, rendering, taxonomy, and taste signals
remain Dogs-owned.

Preserve all mature Movies contracts:

- routes and legacy `/s/:slug` public links;
- localStorage keys and payloads;
- Supabase tables and database behavior;
- account merge/no-loss behavior;
- browser flows and exports.

Dogs uses isolated local keys and additive category tables. The production migrations and Storage
bucket have already been applied and passed real two-user RLS, Data API, snapshot, and Storage
probes. Dogs account sync and text public snapshots are enabled. Generated/public-snapshot artwork
and raster exports are still intentionally disabled.

## Artwork model

There are two deliberately separate systems:

1. **Generated field-guide portraits** in `data/dogs/generated-artwork.json`, governed by
   `data/dogs/generated-artwork-policy.json`. They are allowed in normal Dogs UI only and visibly
   disclosed as generated breed illustrations.
2. **Licensed-photo fallback** in `data/dogs/image-rights.json`, governed by
   `data/dogs/artwork-license-policy.json`. The original 28 rows are display-ready; the latest 24
   rows are morphology-reference-only and deny every display/export purpose.

Normal UI approval never implies public-snapshot or raster-export approval. Do not merge these
systems or broaden purpose flags as a shortcut.

The detailed continuation state, latest cohort, scene decisions, and batch workflow are in
`notes/feature-ideas/dogs-artwork-expansion-handoff-2026-09-22.md`.

## Verification baseline

The local 52-portrait state passed the complete release gate:

- 424 / 424 Node tests;
- 24 / 24 Deno function tests;
- syntax and all cache-manifest checks;
- Movies pack validation plus every Dogs catalog/profile/artwork/discovery/pack validator;
- 37 / 37 real-Chrome flows, including Movies, Books, Dogs, family home, responsive layouts,
  failure recovery, generated-artwork disclosure, licensed fallback attribution, Dogs sync/public
  links, and an exact Basset Hound portrait assertion.

Evidence:

- `reports/runs/2026-09-22T140321Z`
- `reports/e2e/runs/2026-09-22T140338Z`
- `reports/dogs-generated-artwork/cohort-d-contact-sheet.jpg`
- `reports/dogs-generated-artwork/cohort-d-reference-contact-sheet.jpg`
- `reports/e2e/runs/2026-09-22T140338Z/screenshots/dogs-new-artwork-search.png`

Future artwork work must rerun focused validators after every subwave and finish its cohort with
`npm run verify`. Browser screenshots must be visually inspected, not merely asserted green.

## Current priorities

1. Expand excellent generated portraits from 52 toward all 1,239 selectable identities, in
   accountable cohorts of about 250 and visually reviewed subwaves of 20–30.
2. Prioritize the remaining pack-engaged identities, then canonical long tail, then deliberately
   extend discovery/reference coverage to varieties, crossbreeds, and historical types.
3. Continue improving the least-developed profile copy with stable sources, without inventing breed
   personality or suitability claims.
4. Keep Movies parity and compatibility intact; keep Books paused/noindex.
5. Keep public-snapshot artwork, raster sharing, root cutover, and release operations behind their
   independent gates.

## Authoritative reading order

1. `AGENTS.md`
2. `notes/feature-ideas/dogs-agent-kickoff-prompt.md`
3. `notes/feature-ideas/dogs-launch-plan.md`
4. `notes/testing/dogs-implementation-status.md`
5. `notes/feature-ideas/dogs-field-guide-v2.md`
6. `notes/feature-ideas/dogs-artwork-expansion-handoff-2026-09-22.md`
