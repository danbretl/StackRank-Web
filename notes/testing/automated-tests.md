# Automated test suite — strategy, phases & progress

> Living engineering doc. Started 2026-06-26. This is both the **plan** and the
> **progress tracker** — update the checklists as you go so another agent can pick
> up mid-stream. If this conflicts with the code, the code wins; fix this doc.

## Status at a glance

**Phases 0–6 complete; Phase 7 has a first browser-smoke slice.** `npm test`
runs 83 fast unit/structural tests in ~0.2s. The entire pure logic core is
extracted into `lib/` and covered: ZIP writer, text-fit/SVG-text, formatters,
movie identity + merge (never-lose-data), the rank-weighted insight engine, pack
progress + share aggregation, the share text/data export builder + serializers,
the binary-insertion ranking search, and the pure Share SVG composition layer.
`npm run test:e2e` now drives headless Chrome against the real static app and
covers localStorage hydration, queue-to-ranking comparison flow, comparison
undo/cancel restore, and Share Studio preview/empty-toggle wiring. `npm run
verify` runs both suites plus syntax/type checks.

Modules: `lib/{zip,text,format,movie,insights,packs,share-export,share-svg,ranking}.js`.
Tests: `tests/{zip,text,format,movie,insights,packs,share-export,share-svg,ranking}.test.js`.

## Goal

Move past "Dan is the manual QA." Build a suite of automated tests that is:

- **Impactful, not vanity** — covers logic whose breakage would actually hurt
  (lost rankings, wrong rank-weighted taste math, broken share exports, pack
  progress drift), not getters and trivia.
- **Fast & repeatable** — the core unit suite runs in well under a second so it's
  usable for tight TDD loops and pre-commit checks.
- **Zero-dependency** — honors the project's "no npm deps" rule. Uses Node's
  built-in `node --test` runner + `node:assert`. The E2E smoke harness also uses
  only Node stdlib plus Chrome's DevTools Protocol via the built-in WebSocket
  global. No Jest/Vitest/Playwright dependency.
- **No build step** — same constraint as the app.

## The core architectural move: `lib/` ES modules

`app.js` is one ~4,800-line ES module with **no exports** and lots of top-level
DOM/Supabase side effects, so it can't be imported into Node as-is. Instead of
mocking a whole DOM to import it, we **extract pure logic into small native ES
modules under `lib/`** that *both* the browser app and the Node tests import:

```
app.js  ──import──►  lib/zip.js, lib/text.js, lib/insights.js, …
tests/  ──import──►  lib/…                     (Node, node --test)
```

- The browser already does native ESM (`import { createClient } from "https://…"`).
  Local `import { x } from "./lib/x.js"` resolves the same way on GitHub Pages —
  **no bundler needed**.
- Each `lib/` module must be **side-effect-free and DOM-free**: pure functions
  only, all state passed in as arguments. That's what makes it Node-importable and
  deterministic.
- `app.js` keeps the thin, stateful, DOM-bound wrappers that gather module globals
  (`ranking`, `watchList`, `packProgress`, `detailCache`, `shareOptions`) and call
  the pure `lib/` functions.

### Extraction rule (keep the app safe)

The app has no tests yet, so extraction is the risky part. Rules:

1. Move the function **logic-identical** to `lib/`; don't "improve" it mid-move.
2. `app.js` imports it; delete the in-file definition. For state-coupled
   functions, refactor `app.js`'s wrapper to pass state in, and keep the wrapper's
   name/signature so call sites don't change.
3. After each extraction batch, **smoke-test in the browser preview** (reload,
   open Share Studio, rank a movie, check console is clean) before moving on.
4. Then write/extend the `lib/` test file. Once a module is under test, further
   changes are TDD.

## Running the tests

```
npm run verify          # full handoff/CI gate: unit reports + syntax + edge checks + E2E
npm test                # the whole suite + saves reports/runs/<timestamp>/
npm run test:e2e        # headless Chrome smoke + saves reports/e2e/runs/<timestamp>/
npm run test:watch      # re-run on change (node --test --watch tests/)
npm run check           # node --check app.js
npm run check:functions # deno check supabase/functions/*/index.ts
node --test tests/zip.test.js   # one file
```

Target: full unit suite < 1s. No network, no DOM, no fixtures larger than needed.
`npm test` prints the human-readable spec reporter to the terminal and saves a
timestamped report directory under `reports/runs/<timestamp>/` (gitignored). Each
run contains:

- `summary.md` — quick human-readable status, counts, command, and failure list.
- `summary.json` — structured metadata for agents/scripts.
- `output.log` — full terminal output from the Node test runner.
- `junit.xml` — machine-readable JUnit XML for CI/test viewers.

`reports/latest` is a symlink to the most recent run, so the fastest follow-up is
usually `open reports/latest/summary.md` or `sed -n '1,120p' reports/latest/summary.md`.

`npm run test:e2e` starts its own no-cache static server, launches a fresh
headless Chrome profile per flow, seeds localStorage with deterministic data, and
saves a separate timestamped report under `reports/e2e/runs/<timestamp>/`
(gitignored). Each E2E run contains:

- `summary.md` — human-readable status, per-flow durations, details, and
  screenshot paths.
- `summary.json` — structured metadata for agents/scripts.
- `junit.xml` — machine-readable JUnit XML.
- `screenshots/*.png` — state captures for the exercised flows.

`reports/e2e/latest` is a symlink to the most recent E2E run. Set `CHROME_PATH`
if Chrome/Chromium is installed somewhere nonstandard.

CI runs `npm run verify` on pushes to `main` and pull requests via
`.github/workflows/test.yml`, then uploads `reports/runs/**` and
`reports/e2e/runs/**` as the `test-reports` artifact.

## Testing policy for future changes

Every future development effort should leave the suite at least as strong as it
found it:

- **Run `npm run verify` before handoff** unless the change is explicitly docs-only
  and does not touch executable code. Report the command and result; inspect
  `reports/latest/summary.md` after the run when following up on failures.
- **Add tests with new behavior**, not after a later cleanup. For new pure logic,
  create or extend a focused `lib/` module and write `tests/<module>.test.js`.
- **Regression fixes start with a failing test** when the bug is in logic that can
  be isolated. Add the smallest fixture that would have caught the bug.
- **Protect high-risk invariants first:** no ranking loss or shrinkage, stable
  movie identity, binary-insertion placement, rank-weighted taste math, pack
  derived progress, share empty-section omission, SVG/text padding, ZIP validity,
  and edge-function response shape.
- **UI-only work needs a browser smoke** of the affected flow. Start with
  `npm run test:e2e` when the touched surface is covered there. If layout or
  mobile behavior is the risk, also run targeted screenshots
  (`npm run screenshots -- --only=…`) and inspect the output.
- **Do not import `app.js` in Node tests.** It has DOM/Supabase side effects. Move
  pure logic to `lib/` and keep `app.js` as the thin state/DOM adapter.
- **Keep tests deterministic:** no network, no wall-clock assertions unless the
  date/time is injected, no real Supabase/TMDB calls, no reliance on localStorage.

## What we test, by impact (the priority order)

1. **Data integrity / never-lose-data** — `mergeRankings` dedup by `movieKey`,
   local-payload parse/normalize (array vs `{movies,updated_at}` shapes, garbage),
   timestamp-guard merge, `toStoredMovie` shape, ranking migrations. A bug here
   silently destroys a user's list. *Highest.*
2. **Rank-weighted insight engine** — `preferenceWeight`, `countPreferenceValues`,
   `countPreferenceMany` / `countReversePreferenceMany`, decade bucketing, median,
   and `computeRankingInsights` orchestration. The product's "taste" math; weight
   bugs are invisible to the eye. Includes the invariant *top-ranked items must
   carry more weight than bottom-ranked* and golden end-to-end cases.
3. **Pack progress** — derived `getPackStats` (handled set, progress, status:
   completed / started / discovered / resurfaced), `getSharePackSummary`,
   `getSharePackFeatured` ordering, status text. Drives the packs UI and the new
   share section.
4. **Share text/data exports** — `buildShareExportSections` structure, the
   empty-section omission rule, tone titles, Markdown/JSON/Text serialization.
   Regression-prone (recently changed).
5. **Text-fit invariants** — `wrapTextToSvgWidth` never returns a line whose
   `estimateSvgTextWidth` exceeds `maxWidth` (the recurring "titles touch the
   border" bug), ellipsis on overflow, `estimateSvgTextWidth` monotonicity.
6. **ZIP writer** — `crc32` against known vectors, `createStoredZipBlob` produces a
   structurally valid archive that round-trips (validated externally with `unzip`/
   Python `zipfile` once; locked in with byte-level assertions in Node).
7. **Binary-insertion ranking** — the comparison search converges to the correct
   insertion index for any comparator (modeled as a pure function).
8. **SVG structural** — `buildShareSvg` etc. emit well-formed SVG with the expected
   sections present/absent per options; padding/no-overlap invariants.
9. **DOM / integration / E2E** — wiring, persistence round-trips, comparison UX,
   drag reorder. Heavier; jsdom for wiring, optional browser-driven smoke.

## Phases & progress

Legend: [ ] todo · [~] in progress · [x] done

### Phase 0 — Harness + first vertical slice ✅
- [x] Create `lib/`, `tests/`, `notes/testing/`.
- [x] `package.json` `test` / `test:watch` scripts (+ `"type": "module"`).
- [x] Extract `lib/zip.js` (`crc32`, `concatBytes`, `dosDateTime`,
      `createStoredZipBlob`); `app.js` imports it.
- [x] `tests/zip.test.js` — CRC32 vectors, archive structure, round-trip via a
      self-contained Node-side ZIP reader, UTF-8 + binary content. (8 tests)
- [x] `npm test` green in ~0.1s; browser smoke-tested (app boots, zip export
      still emits a valid `application/zip` after the extraction).

### Phase 1 — Pure utilities (zero state coupling) ✅
- [x] `lib/text.js` — `xmlEscape`, `estimateSvgTextWidth`, `wrapText`,
      `wrapTextToSvgWidth`, `trimTextToSvgWidth`, `svgTextLines`. `app.js` imports.
- [x] `tests/text.test.js` — wrap-width invariant (no multi-char line exceeds
      maxWidth across a font×width×title matrix), ellipsis, maxLines, single
      long-word break with no char loss, escape correctness. (12 tests)
- [x] `lib/format.js` — `formatRuntime`, `formatRuntimeTotal`,
      `formatShareRuntimeTotal`, `decadeLabel`, `rankedCountLabel`, `dayKey`,
      `formatShortDate`.
- [x] `tests/format.test.js`. (6 tests)
- [x] `lib/movie.js` — `normalizeTitle`, `movieKey`, `movieYear`,
      `isDuplicateMovie(list, m)`, `mergeRankings`. `app.js` keeps a one-line
      `isDuplicateMovie(m)` wrapper that binds the live `ranking`.
- [x] `tests/movie.test.js` — identity (tmdbId vs title/year), dedup edge cases
      incl. cross-identity bridging, merge order + dedup + never-shrink. (10 tests)
- [x] Browser smoke-tested: app boots clean, ranking/snapshot/packs/share all
      render. **36 tests green, ~0.14s.**

### Phase 2 — Insight engine ✅
- [x] `lib/insights.js` — pure primitives (`preferenceWeight`, `countValues`,
      `countPreferenceValues`, `countPreferenceMany`, `countReversePreferenceMany`,
      `median`) + `computeRankingInsights(enriched, { watchCount, hiddenCount,
      rankingUpdatedAt })`. `getRankingInsights()` in `app.js` is now a thin
      wrapper that enriches `ranking` via the detail cache and passes counts.
- [x] `tests/insights.test.js` — weighting invariants (rank beats frequency;
      reverse-weighting for bottom lists), decade/genre/people aggregation,
      oldest/newest/average/median/span, busiest-day, golden fixture, empty list,
      year-less movies. (11 tests)
- [x] Browser smoke-tested: genres/cast/eras/snapshot all render with real
      enriched data, no errors. **47 tests green, ~0.15s.**

### Phase 3 — Packs ✅
- [x] `lib/packs.js` — `computePackStats(pack, handledStateFor, progressEntry)`,
      `packStatusRank`/`packStatusText`/`packActionText`/`sharePackCardStatus`
      (all take `stats`), `summarizePacks(entries)`, `featuredPacks(entries,n)`.
      `app.js` wrappers bind the live `getMovieHandledState` + `packProgress`.
- [x] `tests/packs.test.js` — every derived status (completed / started /
      discovered / dismissed / resurfaced / not_started), progress fraction,
      status/action/card text, aggregate counts + distinct ranked/handled ids +
      top category, featured ordering (in-progress before completed, by progress
      then recency), untouched-excluded, limit, engaged self-hide. (11 tests)
- [x] Browser smoke-tested: main packs panel + share packs section both render
      with correct derived statuses. **58 tests green.**

### Phase 4 — Share exports ✅
- [x] `lib/share-export.js` — `getSharePickGroups`, `movieExportLine`,
      `shareRankingMetaCards`, pure `buildShareExportSections(insights, options,
      ctx)` (ctx = `{ tone, watchList, notInterestedList, watchRuntimeDisplay,
      hiddenRuntimeDisplay, hiddenRuntimeLabel, packSummary, packFeatured }`), and
      `sectionsToMarkdown` / `sectionsToText` serializers. `app.js`'s
      `buildShareExportSections` is now a wrapper that gathers ctx; `buildShareMarkdown`/`buildShareText` call the serializers.
- [x] `tests/share-export.test.js` — canonical section order, tone titles,
      **empty-section omission** (queues/genres/people), toggles-off omission,
      packs block (engaged-only, before whole list, line content), meta-card
      provenance vs fallback, Markdown/Text serializer structure. (11 tests)
- [x] Browser smoke-tested: Markdown export + SVG poster render correctly.
      **69 tests green, ~0.15s.**

### Phase 5 — Ranking algorithm ✅
- [x] `lib/ranking.js` — `comparisonMidIndex`, `applyComparison`,
      `isSearchSettled`, plus a test convenience `resolveInsertionIndex(count, fn)`.
      `app.js`'s `showComparison`/`handleDecision` now call these (identical
      arithmetic), so the binary-insertion search is unit-testable.
- [x] `tests/ranking.test.js` — the defining property: against an ordered list,
      a new value lands at the sorted index for **every slot × every size 0–30**
      and keeps the list sorted; comparison count bounded by ⌈log₂(n+1)⌉; empty
      list, always-better/always-worse, a hand-checked size-3 trace. (7 tests)
- [x] Verified **live in the browser**: added "Inception" via search, chose
      "existing better" 4×, it landed at #11 (bottom) and ranking grew 10→11, no
      errors. **76 tests green.**

### Phase 6 — SVG structural ✅
- [x] Extracted the pure Share SVG assembly seam to `lib/share-svg.js`:
      title/name helpers, shared SVG styles, frame rendering, header,
      single-column section placement, single-image composition, wide masonry
      composition, and image-set card composition. `app.js` still owns the
      stateful section descriptor builders and passes their descriptors into the
      pure composers.
- [x] `tests/share-svg.test.js` — structural SVG coverage without a DOM harness:
      balanced tag checks, escaped display names/kickers, deterministic footer
      dates, section omission/order via descriptor filtering, single-image min
      height and growth, horizontal text padding for the single-image chrome,
      wide canvas dimensions + masonry column transforms, and image-set card
      shrink/cap height behavior. (7 tests)
- [x] Validation: `npm test` green (**83 tests**, ~0.18s), `node --check app.js`
      green, and browser smoke on `localhost:8000` confirmed Share Studio opens,
      renders the single SVG preview, disables empty section toggles, and renders
      a 7-card Image set preview with ZIP button labels.

### Phase 7 — DOM / integration / E2E (initial browser-smoke slice ✅)
- [x] Chose a browser-driven, zero-dependency harness: `scripts/run-e2e-smoke.cjs`
      starts a static server and drives headless Chrome/Chromium through CDP.
- [x] Reports mirror the unit suite shape under `reports/e2e/runs/<timestamp>/`
      with `reports/e2e/latest` for the newest run.
- [x] Persistence round-trip: seed localStorage ranking + queues → reload the real
      app → assert rendered ranking order, queue counts/subtitles, clean runtime.
- [x] Comparison flow: seed Watch next → click a queue row → complete
      binary-insertion decisions → assert the movie lands in ranking and leaves
      the queue.
- [x] Undo/cancel flow: make one comparison choice → undo back to the initial
      comparison state → cancel → assert the original Watch next row is restored
      and the ranking is unchanged.
- [x] Share Studio: open modal → assert SVG preview, empty-section toggles disabled,
      Image set preview cards render, and shape controls hide for image sets.
- [ ] Extend E2E coverage for drag reorder, autocomplete selection, export
      downloads, and mobile viewport comparison layout.

## Conventions

- Test files: `tests/<module>.test.js`, using `import { test } from "node:test"`
  and `node:assert/strict`.
- One `lib/` module per cohesive concern; **no DOM, no globals, no network**.
- Prefer **property/invariant tests** for math (e.g. "weight decreases down the
  list") over brittle exact-number snapshots, plus a few golden cases for clarity.
- Keep fixtures inline and minimal; a shared `tests/fixtures.js` only once reused.
- When you fix a bug, add the failing case first (TDD), then fix.

## Technical notes / gotchas discovered

- `Blob`, `TextEncoder`, `DOMParser`? — `Blob` and `TextEncoder` are globals in
  Node 25, so `lib/zip.js` works in Node unchanged. `DOMParser` is **not** in Node;
  keep anything needing it (e.g. `getSvgPosterOverlays`) in `app.js`, not `lib/`.
- `lib/` modules must avoid `window`/`document`/`localStorage`. Pass values in.
