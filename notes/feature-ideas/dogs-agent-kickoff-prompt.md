# StackRank Dogs agent kickoff prompt

Copy everything below into a new Codex task rooted at `/Users/danbretl/src/stackrank`.

---

You are the primary orchestrator for a long-running implementation effort in the StackRank
repository at `/Users/danbretl/src/stackrank`.

Your objective is to build **StackRank Dogs as a comprehensive, public-quality second StackRank
product alongside Movies**, and to make the necessary safe improvements to the greater StackRank
architecture so future categories can share proven technology. Work autonomously and diligently for
as long as useful work remains. Do not stop after research, planning, scaffolding, or a tiny demo.
Drive the implementation toward a genuinely usable, deeply tested Dogs product.

## Required context

1. Read `AGENTS.md` completely and obey it.
2. Read `notes/feature-ideas/dogs-launch-plan.md` completely. It is the authoritative product,
   catalog, rights, architecture, persistence, testing, and launch plan.
3. Read `notes/feature-ideas/multi-domain-expansion-plan.md` for background and
   `notes/feature-ideas/multi-domain-url-architecture.md` for route history.
4. Inspect the current working tree before editing. It is intentionally dirty from prior
   cross-domain/Books work. Preserve all existing user changes and the unrelated untracked
   `logo-design-brief/` directory. Do not reset, discard, or overwrite work you do not own.
5. Understand the existing experimental Books slice and cross-domain modules before deciding what to
   reuse. Books is paused and must remain working/noindex, but no provider outreach or Books feature
   expansion is requested.

## Direction and non-negotiable decisions

- Dogs is the active next category. Books is paused, not deleted.
- This is not a 36-breed demo. Build a comprehensive, globally aware catalog.
- The pinned VBO 2026-04-15 artifact has 1,537 labeled descendants below Dog breed. Account for
  100% of them through explicit `canonical`, `alias`, `variety`, `crossbreed`, `historical`, or
  `excluded` dispositions. The number of selectable canonical concepts must emerge from auditable
  classification, not an arbitrary cap.
- Use VBO ids as the identity foundation and preserve aliases/provenance. Do not dump raw ontology
  terms directly into the UI.
- Use only rights-verifiable dog imagery. Build and validate a per-image license/attribution ledger.
  Reject NC, no-derivatives, scraped, uncertain, breeder, social, stock-search, or provenance-free
  imagery. Image rights must be purpose-specific and fail closed.
- StackRank Dogs ranks personal affection/interest in breeds and types. It must not become adoption
  matching, buying, veterinary advice, household suitability, or behavior/temperament prediction.
- Preserve every Movies route, localStorage key, payload shape, Supabase table, public-link format,
  and mature browser behavior. Do not perform an in-place Movies schema migration.
- Keep the app static/no-framework/no-bundler unless Dan explicitly changes that architectural
  constraint.
- Build Dogs at `/dogs`; preserve `/movies`, `/books`, `/privacy`, and legacy Movies `/s/:slug`.
- Do not commit, push, create a PR, apply production database migrations, replace the root redirect,
  or deploy the site without Dan’s explicit authorization. You may prepare and test local migration
  files and mocked browser flows. If you change an existing/new Edge Function, obey the repository’s
  mandatory function-deployment rule and report exactly what external state changed; avoid creating
  unnecessary functions.

## Collaboration mandate

Use multiple agents heavily for concrete bounded workstreams. You are the orchestrator and own final
integration and verification. Suggested initial parallel assignments:

1. **Catalog/VBO agent:** inspect the pinned ontology, design classifications, build deterministic
   extraction/coverage tooling, identify ambiguous clusters, and add tests. It may edit dedicated
   catalog scripts/data/tests, coordinated with you.
2. **Artwork/rights agent:** design the rights schema and validator, research safe Wikimedia
   Commons/Openverse acquisition mechanics, build the asset-processing pipeline, and produce a
   coverage/attribution strategy. It must never use an image merely because it is easy to find.
3. **Architecture/product agent:** audit Books and the new cross-domain primitives, propose or
   implement small shared controllers, and build Dogs UI/product surfaces without copying Movies
   wholesale.

Keep one concurrency slot for your own integration work. Agents share the same filesystem, so assign
non-overlapping files, communicate interfaces early, review every change, and do not assume an
agent’s report is correct without inspecting/testing it. Spawn follow-up agents when later work
becomes independently parallelizable, such as pack editorial validation, Supabase/RLS review, or
responsive browser QA.

## How to work

- Start with a concise commentary update and a task plan, then execute.
- Make reasonable in-scope decisions autonomously. Do not pause for preferences that can be safely
  deferred or represented as reversible data/config.
- Keep Dan informed at least every 60 seconds during tool-heavy work with short, substantive updates.
- Lead with working outcomes. Maintain tests alongside implementation rather than at the end.
- Use `rg`/`rg --files` for discovery and `apply_patch` for manual edits.
- Preserve the current design language: monochrome, editorial, punchy, high-quality, responsive,
  accessible, and unmistakably a StackRank sibling.
- For UI work, use the applicable frontend-building/testing skills and render real screenshots.
  Inspect them visually on desktop, iPad, phone portrait, and phone landscape. Repair visual issues,
  not just assertion failures.
- For any Supabase work, use the Supabase skill, fetch the current changelog first, inspect current
  documentation, discover CLI commands with `--help`, and verify RLS/Data API behavior directly.
- Use primary sources for any time-sensitive taxonomy, license, or provider assertion. Record source
  dates and exact licenses in repository data.

## Implementation sequence

Treat the phases in `dogs-launch-plan.md` as gates, not stopping points. Continue through as many as
can be completed safely in this task.

### 1. Orient and protect

- Inspect all existing diffs and baseline tests.
- Reconcile any stale documentation with code.
- Inventory the current category/entity/rank-session/ranked-list/backup modules and Books E2E flow.
- Establish a tracked plan with explicit ownership across agents.

### 2. Build the complete catalog system

- Pin and hash the exact VBO release reproducibly.
- Extract the full Dog breed descendant universe.
- Define strict schemas for classification, overrides, relationships, provenance, packs, runtime
  catalog, and coverage report.
- Classify every raw term. Automate obvious normalization, but produce explicit review artifacts for
  ambiguous duplicates, variants, historical names, landraces, designer crosses, and exclusions.
- Add deterministic build/validate scripts and focused unit tests.
- Ensure search aliases resolve to one canonical stored entity without erasing provenance.

Do not mark this phase complete while source terms remain silently unclassified.

### 3. Build the artwork/rights pipeline

- Implement the purpose-aware rights ledger and validator.
- Build reproducible Wikimedia Commons/Openverse source import and optimized-asset generation.
- Store source hashes, creator, source page, exact license/version, attribution, modifications, and
  allowed purposes.
- Design immutable object paths and a local/test asset strategy before any storage upload.
- Make missing imagery a supported, polished state.
- Achieve approved artwork for all promoted packs and maximize coverage of current canonical breeds;
  report exact coverage and unresolved items honestly.

Do not enable raster sharing merely because an image displays in the UI.

### 4. Establish the shared new-category platform

- Reuse the existing DOM-free cross-domain primitives.
- Add only small, demonstrated shared controllers/modules needed by both Books and Dogs.
- Keep category rendering and policy adapters explicit.
- Add purpose/capability checks that deny unsupported sync/share/artwork uses.
- Keep Books passing and noindex; do not broaden Books scope.
- Do not retrofit mature Movies code unless the extraction has an immediate proven benefit and full
  compatibility coverage.

### 5. Build the full Dogs product

Implement a real `/dogs` experience, including:

- Rank / Ranking / You shell;
- accessible canonical/alias search;
- first-run education and diverse starter packs;
- recently ranked;
- binary comparison with jitter, undo, and cancel/origin restoration;
- ranking review and session undo;
- mouse/touch/keyboard reorder;
- useful views and safe filters;
- detail pane with aliases, status, provenance, relationships, and image attribution;
- Curious about and Not for me lists with canonical deduplication;
- substantial curated pack library and progress;
- safe, evidence-backed Taste patterns;
- category-bound backup, restore, and title/alias import if appropriate;
- robust storage/catalog/image failure handling;
- text/Markdown/JSON exports;
- public/image sharing only when its rights and persistence gates are actually satisfied.

Use Dogs-native copy and composition. Do not mechanically rename movie concepts.

### 6. Prepare additive sync and family architecture

Only after the local Dogs contract is stable:

- create migrations with `supabase migration new` for generic new-category tables;
- keep all Movies tables untouched;
- add explicit Data API grants, RLS, SELECT/INSERT/UPDATE/DELETE policies as needed, ownership checks
  using `(select auth.uid())`, `USING` plus `WITH CHECK`, and payload bounds;
- build no-loss local/remote Dogs merge behavior and mocked signed-in E2E coverage;
- test cross-user and cross-category isolation;
- prepare category public-link storage/routes without changing legacy Movies links;
- build the root StackRank family home locally, but do not replace the production root redirect
  without authorization.

Do not apply production migrations merely because the SQL is ready.

### 7. Verify and harden

- Add catalog, rights, identity, persistence, backup, policy, packs, and ranking unit tests.
- Add full real-browser Dogs flows across desktop, iPad, phone portrait, and phone landscape.
- Test storage failure, malformed catalog, broken images, cross-category isolation, keyboard
  interactions, touch targets, and reduced motion.
- Run `npm run verify` repeatedly and finish with one fully green run.
- Add Dogs-specific production-smoke coverage ready for launch.
- Update privacy/credits, CSP, cache versions, routes, sitemap/robots strategy, telemetry allowlists,
  project documentation, and launch checklist.

## Quality bar and definition of done

Do not report completion based on lines written or a screen that boots. A high-quality handoff must
include:

- exact canonical/selectable/alias/variety/crossbreed/historical/excluded counts;
- 100% raw VBO term disposition with a generated coverage report;
- exact image coverage and license distribution, plus unresolved artwork report;
- a usable Dogs app with the core mature StackRank interaction contract;
- explicit shared-vs-category architecture and why each extraction was made;
- proof that Movies and Books still pass;
- full unit/function/catalog/E2E results;
- rendered screenshots inspected and repaired;
- any prepared-but-not-applied migrations or deployment steps clearly identified;
- risks that truly require Dan’s authorization or editorial judgment;
- no hidden production mutation, commit, or push.

Continue autonomously while safe, meaningful implementation remains. If a truly blocking decision
arises, keep progressing on independent catalog, architecture, UI, rights, or testing work before
asking. The goal is to return with StackRank Dogs substantially real—not another recommendation to
build it later.

---
