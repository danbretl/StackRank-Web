# StackRank Dogs launch plan

> Implementation status as of July 16, 2026 is tracked in
> `notes/testing/dogs-implementation-status.md`. This plan remains the launch contract; incomplete
> artwork, database, editorial, and authorization gates are not waived by local implementation.

Status: **approved direction as of July 16, 2026.** StackRank Dogs is the active next-category
initiative. Books is paused as a noindex, device-only experiment; no provider outreach is planned.

This plan supersedes the earlier recommendation to advance Books and Dogs in parallel. Preserve the
Books implementation and tests, but do not spend time expanding it unless Dan changes direction.

## Outcome

Build StackRank Dogs as a real, public-quality second product alongside Movies, using the work to
establish the architecture for a family of StackRank categories.

“Done” does not mean a 36-breed demo. It means:

- a comprehensive, globally aware, versioned dog breed/type catalog;
- a delightful Rank / Ranking / You product at `/dogs`;
- the mature comparison, review, reorder, undo, backup, accessibility, responsive, and no-loss
  behavior people expect from Movies;
- a controlled artwork and attribution system suitable for a public product;
- an additive cross-category persistence path that never jeopardizes Movies data;
- a StackRank family home that makes Movies and Dogs feel like siblings;
- full automated and rendered-browser verification before release.

Do not rewrite Movies wholesale and do not copy its 11,000-line `app.js`. Use Dogs to prove the
new-domain architecture, extracting only demonstrated shared behavior.

## Product definition

StackRank Dogs ranks **dog breeds and commonly understood dog types by personal affection or
interest**.

It is not:

- a breed-selection or household-suitability recommender;
- a safety, temperament, intelligence, trainability, or health ranking;
- a claim that breed determines an individual dog’s behavior;
- a ranking of individual dogs;
- a kennel-club recognition authority.

Preferred product language:

- “Which dog breed are you more drawn to?”
- “Which one do you love more?”
- “Favorite breeds and types”
- “Curious about”
- “Not for me”

Avoid scored or categorical claims such as “best with children,” “apartment friendly,” “safe,”
“aggressive,” “smartest,” or “easy to train.” Any later care, behavior, or health content requires
expert-quality sources and a separate editorial review.

## Catalog completeness contract

### Source universe

Use the [Vertebrate Breed Ontology](https://obofoundry.org/ontology/vbo.html) as the identity and
alias foundation. It is maintained as a computable breed vocabulary and published under CC BY 4.0.

Pin an exact release in the repository. At planning time:

- release: `2026-04-15`;
- artifact: `http://purl.obolibrary.org/obo/vbo/releases/2026-04-15/vbo-base.json`;
- SHA-256 observed July 16, 2026:
  `511bb27d7581bfb8bccf69583c8ac0e3c12de4fdecaf0a8649abfcbfc5ed4da1`;
- descendants of VBO “Dog breed” (`VBO:0400024`): 1,537 labeled terms.

Do not present those 1,537 terms directly. The source includes aliases, country-qualified
duplicates, varieties, designer crosses, historical concepts, and at least one non-domestic animal.

### Definition of complete

The catalog pipeline must account for **100% of source-universe terms**. Every term receives exactly
one disposition:

1. `canonical` — a selectable breed/type concept;
2. `alias` — a searchable name pointing to a canonical concept;
3. `variety` — a separately selectable or nested size/coat/registry variety with an explicit parent;
4. `crossbreed` — a commonly understood intentional or colloquial cross, visibly labeled as such;
5. `historical` — preserved and searchable, but not necessarily promoted in discovery;
6. `excluded` — not a domestic dog breed/type, malformed, or otherwise inappropriate, with a
   machine-readable reason and source note.

No raw term may disappear merely because it is obscure. Completeness is a coverage report, not a
marketing number.

### Consumer catalog policy

- Use stable VBO ids as the primary identity wherever possible.
- Preserve registry, regional, transliterated, historic, and spelling aliases.
- Treat kennel clubs and registries as provenance schemes, not universal truth.
- Do not merge similarly named breeds without evidence.
- Do not treat coat or size variants uniformly across all breeds; follow the source concept and
  documented registry distinctions.
- Include recognized breeds, regional/landrace concepts, historical/extinct breeds, and widely used
  crossbreed/type names, but label their status honestly.
- Include a carefully framed “Mixed breed” concept; do not imply one appearance or behavior.
- Maintain explicit `canonicalOf`, `parent`, and `related` relationships rather than encoding them
  in display names.
- Search must find aliases while always storing the canonical entity reference.

The likely public catalog will contain hundreds of canonical selectable concepts. Do not set a
target count before classification. Let the auditable source dispositions determine it.

### Catalog files

Recommended source/generation layout:

```text
data/dogs/
  sources/
    vbo-2026-04-15.json           # pinned upstream artifact or reproducible fetch metadata
    vbo-2026-04-15.sha256
  classification.json            # every VBO dog descendant and its disposition
  catalog-overrides.json          # display names, aliases, relationships, safe metadata
  image-rights.json               # exact per-asset provenance and license ledger
  packs.json                      # curated dog packs
  dog-catalog.json                # generated runtime artifact
  coverage-report.json            # generated audit artifact
scripts/
  build-dog-catalog.mjs
  validate-dog-catalog.mjs
  fetch-dog-artwork.mjs
```

The runtime artifact must be generated deterministically, schema-versioned, bounded, and
cache-busted. The source classification and rights ledger—not the generated JSON—are the editorial
source of truth.

### Required catalog validation

The validator must fail on:

- an unclassified VBO descendant;
- duplicate canonical identity or normalized display name without an explicit exception;
- an alias pointing nowhere;
- relationship cycles;
- canonical records missing display name, entity type, status, or provenance;
- invalid or unsupported image licenses;
- image assets without attribution/source/license fields;
- catalog entries referencing missing assets;
- pack entries referencing missing/nonselectable catalog ids;
- duplicate pack ids or duplicate entries inside a pack;
- unsafe or unsupported metadata fields;
- runtime payload or individual-record size limits;
- nondeterministic output.

Unit tests should assert representative difficult cases: Akita variants, similarly named shepherd
dogs, Xoloitzcuintli size varieties, regional/country-qualified duplicates, historical names,
designer crosses, mixed breed, and non-domestic exclusions.

## Artwork and rights system

Dogs is visual, but image availability must not drive identity or catalog inclusion.

### Allowed sources and licenses

Prefer Wikimedia Commons and Openverse-discovered originals with verifiable source pages. For
commercial flexibility, accept only:

- public domain / CC0;
- CC BY versions permitting commercial use and derivatives;
- CC BY-SA versions permitting commercial use and derivatives, while honoring share-alike.

Reject or quarantine:

- CC BY-NC and other noncommercial licenses;
- no-derivatives licenses;
- images with missing or contradictory provenance;
- scraped kennel-club, breeder, stock-photo, social-media, Dog CEO/Stanford Dogs, or search-engine
  imagery without a license chain;
- provider images whose terms require deletion or prohibit derivative exports.

### Rights ledger fields

Each artwork record needs at minimum:

```json
{
  "assetId": "dogs:photo:...",
  "catalogId": "VBO_...",
  "sourcePage": "https://commons.wikimedia.org/wiki/File:...",
  "originalUrl": "https://upload.wikimedia.org/...",
  "creator": "...",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "attribution": "...",
  "retrievedAt": "...",
  "sourceSha256": "...",
  "modifications": ["crop", "resize", "webp conversion"],
  "uiDisplayAllowed": true,
  "publicSnapshotAllowed": true,
  "rasterExportAllowed": false
}
```

Purpose flags fail closed. Public sharing, image generation, and export may only use assets whose
ledger explicitly permits that purpose.

### Image storage recommendation

Do not fill the git repository with hundreds of large originals. Generate two optimized variants
per approved asset and store them under immutable, versioned paths in a public Supabase Storage
bucket or another explicitly chosen object store:

```text
dogs-catalog/<catalog-version>/<asset-id>-320.webp
dogs-catalog/<catalog-version>/<asset-id>-960.webp
```

The source ledger and deterministic processing scripts stay in git. Keep service/secret credentials
out of browser code. Client access is read-only; catalog uploads are an operator/build action.

Before using Supabase Storage, create a migration and policies deliberately. Storage upsert requires
INSERT, SELECT, and UPDATE permissions for the operator path. Do not grant browser writes. Verify
bucket/object access and cache headers after upload.

### Coverage strategy

- Identity/catalog completeness is required for launch.
- Aim for approved artwork for at least 95% of promoted/current canonical concepts and 100% of
  starter packs.
- Long-tail entries may use a polished non-photographic fallback while rights are unresolved.
- Search and ranking must remain usable without any image.
- Show compact photo attribution in the detail pane and a comprehensive credits surface.
- Do not enable raster share exports until the attribution and share-alike strategy is proven in
  tests and reviewed as a distinct launch gate.

## Product scope

### Rank

- Prominent accessible search over canonical names and aliases.
- Clicking a result begins ranking immediately.
- Recently ranked rail.
- Rotating curated packs and individual discovery prompts.
- Search results distinguish canonical breeds, varieties, historical names, and crossbreeds.
- Empty state teaches the comparison model with diverse starter packs.

### Comparison

- Reuse the shared binary-insertion session.
- Opening-comparison jitter and exact midpoint narrowing.
- Undo last choice and Cancel ranking with origin/scroll restoration.
- Full phone portrait, phone landscape, iPad, keyboard, coarse-pointer, and reduced-motion behavior.
- Prompt should be personal preference, never objective quality.

### Ranking

- Detailed, image-forward, and compact views if the shared controller can support them cleanly.
- Display/filter panel with safe facets such as catalog status, registry group/scheme, broad origin
  region, and image availability. Do not filter on behavioral claims.
- Pointer and keyboard reorder with live announcements.
- Adjacent-pair Review order sessions and one-session undo.
- Detail opens from an explicit info action; ranking starts only from clearly ranking-oriented
  surfaces.

### Secondary lists

- `curious` — “Curious about”; items the user wants to remember or learn about.
- `not_for_me` — “Not for me”; keeps unwanted suggestions out of discovery.
- Moving between ranking and lists must deduplicate by canonical entity identity.
- Do not imply adoption intent, ownership, suitability, or purchase.

### Packs

Launch with a broad editorial library rather than three demo shelves. Suggested families:

- global regions and histories;
- working, sporting, herding, hound, terrier, toy/companion, and non-sporting schemes—with scheme
  attribution because groups differ by registry;
- sighthounds and scent hounds;
- spitz and primitive types;
- livestock guardians;
- water dogs;
- small companions;
- giant breeds;
- distinctive coats and silhouettes;
- ancient and historical breeds;
- regional breeds people may not know;
- widely known crossbreeds, explicitly labeled;
- “start here” globally varied gateway packs.

Use `lib/packs.js`/pack-progress concepts where genuinely reusable, but create Dogs-native content
and copy. Validate diversity and overlap.

### Details

V1 safe detail fields:

- canonical name and aliases;
- catalog status (breed, variety, regional/landrace, historical, crossbreed/type);
- VBO id and catalog version;
- registry/group classifications with their scheme named;
- geographic/historical origin only when sourced;
- related/parent concepts;
- photo credit/license/source;
- brief curated history only when well sourced.

Do not populate temperament, health, lifespan, child compatibility, trainability, exercise need, or
housing suitability just because a public dog API exposes them.

### You / Taste

Possible evidence-backed signals:

- recurring registry/group classifications, always naming the scheme;
- broad regions represented near the top;
- historical families such as sighthound, spitz, livestock guardian, or companion when grounded in
  curated tags;
- size/coat variety preference only where the catalog explicitly models those dimensions.

Phrase them as patterns in the user’s ranking, never as personality analysis or dog-selection advice.

### Sharing

Implement in stages:

1. text/Markdown/JSON exports using the category-neutral entity snapshot;
2. signed-in public snapshot links at `/s/dogs/:slug` or the final agreed category route;
3. image-based sharing only for rights-cleared assets with a tested attribution surface.

Preserve `/s/:slug` as Movies permanently. Never reinterpret a legacy Movies shared payload.

## Shared architecture impact

### Keep Movies stable

- Preserve all existing Movies routes, storage keys, payload shapes, remote tables, and shared links.
- No in-place migration of `rankings`, `movie_lists`, `pack_progress`, or `shared_lists`.
- Do not import the new entity envelope into Movies until an isolated migration has a concrete user
  benefit and full compatibility proof.
- Keep every Movies browser flow green throughout Dogs work.

### Reuse current cross-domain primitives

Dogs should use and strengthen:

- `lib/category.js`;
- `lib/entity.js`;
- `lib/rank-session.js`;
- `lib/ranked-list.js`;
- `lib/category-backup.js`;
- the new-domain storage-key conventions;
- category-aware auth redirects.

### Extract demonstrated shared controllers

Build Dogs against small composable controllers, extracting from Books only where behavior is truly
the same:

```text
js/category/
  destination-controller.js
  search-combobox-controller.js
  comparison-controller.js
  ranking-controller.js
  settings-backup-controller.js
  local-persistence-controller.js
```

Keep rendering callbacks/category adapters explicit. A controller may understand “entity,” “image,”
and “primaryText”; it must not understand movie, book, author, breed group, or poster.

Potential new DOM-free modules:

- `lib/catalog.js` — alias search, facets, result normalization, catalog version checks;
- `lib/category-ranking.js` — move/remove/recent/stats operations over entity refs;
- `lib/provider-policy.js` — purpose capability checks that fail closed;
- `lib/category-lists.js` — canonical-identity transitions across ranking and secondary lists.

Do not create a universal details model, suggestion engine, Taste model, or Tonight abstraction.

### Styling

- Preserve the StackRank monochrome family and action hierarchy.
- Extract shared category tokens/layout into `category-base.css` only after comparing actual Books
  and Dogs needs.
- Keep Dogs artwork flexible: landscape/square photography must not be forced into movie-poster
  assumptions.
- Use width for composition and pointer capability only for interaction behavior.

## Persistence and Supabase

### Local first

Dogs begins with category-isolated local keys and category-bound backups. Complete and test the
product locally before changing production database schema.

Suggested keys:

```text
stackrank:dogs:ranking:v1
stackrank:dogs:queues:v1
stackrank:dogs:pack-progress:v1
stackrank:dogs:share-options:v1
stackrank:dogs:app-destination:v1
```

### Additive remote tables

When the local contract is stable, prepare additive migrations for new categories:

```text
category_rankings       (list_id, category, items, updated_at)
category_lists          (list_id, category, list_type, items, updated_at)
category_pack_progress  (list_id, category, state, updated_at)
category_shared_lists   (slug, list_id, category, payload, created_at, updated_at, revoked_at)
```

Use composite primary/unique keys appropriate to the operations. Keep `list_id = 'user:' ||
auth.uid()` for continuity.

Requirements:

- create migration files with `supabase migration new` rather than inventing names;
- enable RLS on every exposed table;
- use `TO authenticated` plus ownership predicates based on `(select auth.uid())`;
- UPDATE policies require both `USING` and `WITH CHECK`, plus SELECT policies;
- public shared-list reads expose only non-revoked rows and only the bounded snapshot fields;
- explicitly grant Data API access because new tables may not be automatically exposed;
- bound ranking/list/share payload sizes in both Postgres and the client;
- run database advisors and direct cross-user/cross-category isolation probes;
- do not deploy or apply production schema without explicit authorization from Dan;
- do not expose service-role or secret keys in the client.

The catalog itself should remain a generated static artifact plus immutable artwork storage, not a
user-editable Data API table.

### Auth and family navigation

- One origin and one Supabase session serve Movies and Dogs.
- Auth callbacks return to the initiating category.
- Account status may be shared UI; user data remains visibly category-specific.
- Signing out preserves the current Movies warning semantics and adds equivalent Dogs semantics.

## Root StackRank home

Replace the temporary root-to-Movies redirect only when Dogs is launch-ready.

The root should:

- explain StackRank’s comparison model in one sentence;
- present Movies and Dogs as equal category cards;
- show whether each category has local/account progress without leaking item names;
- preserve a direct `/movies` canonical route and introduce `/dogs`;
- avoid loading either category’s full app bundle;
- carry global privacy/account navigation;
- work without an account.

Update sitemap, robots, canonical/social metadata, CSP, production smoke, and auth redirect allowlists
as part of the same release.

## Delivery phases

Phases are gates, not excuses to stop. The implementing agent should continue autonomously while
safe work remains.

### Phase 0 — orient and protect the current worktree

- Read `AGENTS.md`, this plan, the multi-domain expansion plan, and current code/tests.
- Inspect the dirty worktree. Existing changes and `logo-design-brief/` belong to Dan; preserve them.
- Run a focused baseline before edits.
- Inventory current Books/cross-domain work and reuse it rather than starting over.

### Phase 1 — catalog compiler and coverage

- Pin VBO release and hash.
- Extract the complete dog descendant universe.
- Build classification/override schemas and deterministic compiler.
- Classify all raw terms using automation plus deliberate review of ambiguous clusters.
- Produce runtime catalog and coverage report.
- Add comprehensive catalog unit tests and validator command.

Exit gate: 100% raw-term disposition, zero identity/alias errors, representative difficult cases
reviewed, runtime artifact bounded.

### Phase 2 — artwork pipeline

- Define rights-led source query/import pipeline.
- Populate ledger and optimized assets at scale.
- Add missing-image workflow and coverage report.
- Implement detail attribution and Credits surface.
- Keep image export capabilities off by default.

Exit gate: all promoted packs have approved artwork, long-tail fallback is polished, every displayed
photo has a valid ledger row, no unsupported license enters generated assets.

### Phase 3 — shared new-category platform

- Harden existing entity/ranking/persistence modules as needed.
- Extract small shared controllers from Books only when Dogs demonstrates the same behavior.
- Keep Books working and noindex.
- Add category capability/purpose policy.

Exit gate: shared controllers have contract tests against both Books and Dogs adapters; no Movies
regression.

### Phase 4 — full Dogs local product

- Implement `/dogs`, responsive UI, search, discovery, packs, comparison, ranking views, review,
  reorder, details, lists, You/Taste, settings, and backup/import.
- Add deterministic browser flows for first-run through mature ranking behavior.
- Run visual repair cycles on desktop, iPad, phone portrait, and phone landscape.

Exit gate: usable end-to-end without Supabase, storage failure handled, no cross-category key access,
and full `npm run verify` green.

### Phase 5 — sync, public links, and family home

- Prepare additive migrations and RLS tests.
- Implement no-loss Dogs local/remote merge.
- Add category public snapshots with bounded payloads and legacy Movies preservation.
- Build the root StackRank home.
- Keep image sharing gated by artwork purpose flags.

Exit gate: cross-user and cross-category isolation verified; old cached Movies clients remain valid;
rollback is data-neutral. Production schema/deployment still requires Dan’s authorization.

### Phase 6 — launch hardening

- Privacy/Credits and provider/image attribution.
- Telemetry allowlist with category only; never breed ids, names, searches, or preferences.
- Accessibility and performance audit.
- SEO/social/robots/sitemap/security headers/cache busting.
- Production smoke additions.
- Catalog/editorial review report and unresolved-item report.
- Final release checklist with any manual deployment steps.

## Testing requirements

### Unit and data tests

- raw VBO extraction and release/hash verification;
- classification coverage and dispositions;
- alias search and canonical storage identity;
- merge/no-loss behavior;
- secondary-list transitions;
- rank sessions and insertion at every slot;
- backup round-trip and cross-category rejection;
- pack validation/diversity/overlap;
- image-license policy and attribution generation;
- provider-purpose capability denial;
- payload bounds.

### Browser flows

- empty Dogs first run and starter packs;
- alias search to canonical breed;
- first item, multi-comparison placement, undo, and cancel;
- review session and session undo;
- ranking views/filter/reorder with mouse, touch, and keyboard;
- Curious about / Not for me transitions;
- detail and photo attribution;
- backup download/restore/import;
- local storage failure and corrupt catalog/data recovery;
- desktop, iPad portrait/landscape, phone portrait/landscape;
- mocked signed-in merge/write/isolation when remote support is added;
- public snapshot publish/update/revoke/view when added;
- root category navigation without cross-loading data.

### Visual quality

Use the existing browser harness and screenshots. Inspect images visually, not just geometrically.
Check real dog photography, missing-image fallbacks, long international names, aliases, and varied
aspect ratios. Maintain a fidelity ledger for any generated design reference.

## Launch gates

Dogs is ready for a public launch only when:

- catalog coverage accounts for 100% of the pinned VBO source universe;
- all canonical identity and merge decisions are auditable;
- promoted/current catalog artwork coverage meets the declared threshold;
- every displayed image has a supported license and attribution;
- no suitability/behavior/medical claims ship without a separate review;
- Movies data/routes/tables/shared links remain backward compatible;
- local backup and no-loss persistence are proven;
- sync and public links, if enabled, pass RLS/isolation tests;
- all runtime assets are cache-busted and CSP allows only deliberate origins;
- `npm run verify` passes;
- Dogs-specific production smoke is ready;
- Dan has approved any production database migration, commit/push, and launch deployment.

## Explicit non-goals for this initiative

- Further Books provider outreach or public-beta expansion.
- TV, video games, or board-game implementation.
- A framework/bundler rewrite.
- A universal content/details schema.
- Migrating existing Movies records to the new entity shape.
- Dog adoption matching, breeder discovery, buying, veterinary advice, or behavioral prediction.
- AI-generated substitute photos presented as real breed examples.

## Primary references

- [Vertebrate Breed Ontology](https://obofoundry.org/ontology/vbo.html)
- [VBO repository](https://github.com/monarch-initiative/vertebrate-breed-ontology)
- [VBO standardization paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12103836/)
- [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- [Creative Commons license chooser](https://creativecommons.org/chooser/)
- [Dog genomics and behavior study](https://www.science.org/doi/10.1126/science.abk0639)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
