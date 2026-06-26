# Automated test suite — strategy, phases & progress

> Living engineering doc. Started 2026-06-26. This is both the **plan** and the
> **progress tracker** — update the checklists as you go so another agent can pick
> up mid-stream. If this conflicts with the code, the code wins; fix this doc.

## Status at a glance

**Phases 0–4 complete — 69 tests, `npm test` green in ~0.15s.** The entire pure
logic core is extracted into `lib/` and covered: ZIP writer, text-fit/SVG-text,
formatters, movie identity + merge (never-lose-data), the rank-weighted insight
engine, pack progress + share aggregation, and the share text/data export builder
+ serializers. Every extraction was browser-smoke-tested (app boots clean, all
surfaces render). **Next up: Phase 5 (SVG structural) and Phase 6 (DOM/E2E)** —
both heavier and specced below for a clean pickup.

Modules: `lib/{zip,text,format,movie,insights,packs,share-export}.js`.
Tests: `tests/{zip,text,format,movie,insights,packs,share-export}.test.js`.

## Goal

Move past "Dan is the manual QA." Build a suite of automated tests that is:

- **Impactful, not vanity** — covers logic whose breakage would actually hurt
  (lost rankings, wrong rank-weighted taste math, broken share exports, pack
  progress drift), not getters and trivia.
- **Fast & repeatable** — the core unit suite runs in well under a second so it's
  usable for tight TDD loops and pre-commit checks.
- **Zero-dependency** — honors the project's "no npm deps" rule. Uses Node's
  built-in `node --test` runner + `node:assert`. No Jest/Vitest/Playwright in the
  core suite. (A later, optional E2E phase may add a dev-only browser dep — see
  Phase 6 — but the bread-and-butter suite stays dep-free.)
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
npm test            # the whole suite (node --test tests/)
npm run test:watch  # re-run on change (node --test --watch tests/)
node --test tests/zip.test.js   # one file
```

Target: full unit suite < 1s. No network, no DOM, no fixtures larger than needed.

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

### Phase 5 — SVG structural
- [ ] Assert `buildShareSvg` / image-set output is well-formed XML, has expected
      section markers per options, respects content padding (no text x beyond the
      right margin), and the packs/queue self-hide reflects in the SVG.
- [ ] May need a tiny pure SVG-assembly seam; otherwise validate via string/regex.

### Phase 6 — DOM / integration / E2E (heavier; spec now, build later)
- [ ] Decide harness: jsdom (dev-only dep) for wiring vs. browser-driven smoke via
      the existing preview tooling / Playwright.
- [ ] Persistence round-trip: seed localStorage → load → assert `ranking` state.
- [ ] Comparison flow: add movie → binary-insertion decisions → correct final
      order; undo/cancel restore.
- [ ] Share Studio: toggles → preview/exports; empty-section disabling.

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
