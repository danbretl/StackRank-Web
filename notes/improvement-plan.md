# StackRank front-to-back improvement plan

Status: **evaluation snapshot, 2026-07-07.** Produced from a full read of the codebase: `app.js` (~9,650 lines), all `lib/` modules, `index.html`, `styles.css` structure, `supabase/` (functions, migrations, config), `vercel.json`, CI, `tests/`, `scripts/`, and the notes directory. Each item states what to change, where, why, and the gotchas an executor needs. Items are grouped and ordered by priority within each group. Nothing here is committed roadmap — it is a ranked menu for the product owner.

Execution progress:

- **34 Land the in-flight iPad Lists work:** completed before this execution pass in commits `2291076` and `8a81ecf`; working tree was clean on `main` before item 19 started.
- **19 Cache-key verify check:** implemented in this pass with `scripts/check-cache-versions.mjs`, `data/asset-versions.json`, runtime module-graph `lib/` imports versioned, and `npm run verify` wired to run `npm run check:cache`.
- **1 Stop loading `supabase-js` from jsdelivr at runtime:** implemented in this pass; `@supabase/supabase-js@2.108.2` is vendored as a standalone browser ESM bundle, `app.js` imports it locally, CSP removes jsdelivr, `/vendor/` gets immutable caching, and the rendered browser smoke loaded the local module graph cleanly.

**Baseline context an executor must know before touching anything:**

- The 2026-06/07 redesign (see `notes/feature-ideas/design-audit.md`) is **complete through Phase 8 and released**. Do not revisit Phase 1–8 visual/IA decisions; the app shell now has Rank / Discover / Lists destinations (`lib/app-shell.js`, `lib/lists.js`, `data-app-destination` on `main.app`).
- The former in-flight iPad Lists two-column layout work has landed (`2291076`, with documentation follow-up `8a81ecf`); unrelated CSS/e2e work can proceed from a clean base.
- Ground rules from `CLAUDE.md` apply to every item: no build step, no npm runtime deps, mobile first-class, no TMDB ratings shown, bump `?v=N` cache keys, new logic gets DOM-free `lib/` modules with tests, commit only when asked.
- Validation for every item: `npm run verify` (unit + `node --check` + Deno checks + e2e); `npm run test:production` after deploys; `npm run screenshots` when responsive visuals are at risk.

---

## P0 — Security and abuse hardening

### 1. Stop loading `supabase-js` from jsdelivr at runtime

- **What:** `app.js:1` imports `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/+esm` in production. Vendor the built ESM bundle into the repo (e.g. `vendor/supabase-js-2.108.2.js`), import it relatively, and remove `https://cdn.jsdelivr.net` from `script-src` and `connect-src` in `vercel.json`'s CSP.
- **Why:** This is the app's only third-party runtime script. ESM `import` cannot carry SRI, so a jsdelivr compromise or outage is a full XSS/availability hole in an app that stores personal data. Vendoring closes the supply-chain gap, tightens CSP to `'self'` for scripts, and removes a render-blocking cross-origin fetch from boot.
- **Files:** `app.js` (import + bump `?v=`), new `vendor/` file, `vercel.json` (CSP + immutable cache header for the vendor path), `index.html` (nothing — module graph), `notes/` doc of the pinned version and upgrade procedure.
- **Gotchas:** The bundle must be the browser ESM build (`+esm` output), committed verbatim with its version in the filename so upgrades are explicit diffs. Update the e2e harness if it stubs the CDN URL (grep `run-e2e-smoke.cjs` for `jsdelivr`). CSP change needs a production smoke (`npm run test:production` asserts the CSP string — update its expectation).

### 2. Add an Origin allowlist to the TMDB edge functions

- **What:** `tmdb-search`, `tmdb-suggest`, `tmdb-detail` validate the `apikey` header, but that key ships in `app.js` and is public by design, and all four functions answer with `Access-Control-Allow-Origin: *`. Anyone can lift the key and use these endpoints as a free TMDB proxy. In `supabase/functions/_shared/` add an origin check (allow `https://www.stackrankapp.com`, `https://stackrankapp.com`, `https://danbretl.github.io`, Vercel preview pattern, `http://localhost:*`) that (a) echoes the matched origin in `Access-Control-Allow-Origin` instead of `*`, and (b) rejects browser requests with a disallowed Origin. Keep requests with **no** Origin header working (the Node production smoke and curl have none) or gate them behind the apikey check only.
- **Why:** Protects the TMDB quota (rate-limit exhaustion breaks search/suggestions for real users) at near-zero cost. `tmdb-image` must keep `*` (canvas PNG export requires it) — for it, rely on the strict path regex plus item 3.
- **Files:** `supabase/functions/_shared/` (new `origin.ts` + tests alongside `publishable-key.ts`), all four `index.ts`, redeploy each with `supabase functions deploy <name>`.
- **Gotchas:** Non-browser abuse can spoof Origin — this is a speed bump, not a wall; pair with item 3. Don't break the e2e harness (it serves from `localhost`). CORS preflight (`OPTIONS`) must return the same computed origin header.

### 3. Rate-limit the public `tmdb-image` proxy and lengthen its cache

- **What:** Add a coarse per-IP token bucket (in-memory `Map` keyed by `req.headers.get("x-forwarded-for")`, e.g. 300 requests/5 min — a full poster-wall export is ~70) to `supabase/functions/tmdb-image/index.ts`, returning 429 beyond it. Raise `Cache-Control` from `max-age=86400` to `public, max-age=604800, s-maxage=2592000, immutable` — TMDB poster paths are content-addressed and never change.
- **Why:** It is intentionally public + CORS-`*`; today one client can loop it indefinitely, burning Supabase invocation budget and TMDB quota. The longer cache also makes repeat PNG exports faster and cheaper.
- **Gotchas:** Edge-function instances are ephemeral, so an in-memory bucket is per-instance and approximate — that's fine, the goal is stopping dumb loops, not determined attackers. Keep the 200-path behavior identical otherwise; `tests/` has no coverage here, so add a Deno test for the limiter logic in `_shared`.

### 4. Bound stored `jsonb` payload sizes in Postgres

- **What:** New migration adding check constraints: `rankings.movies` and `movie_lists.movies` limited by `octet_length(movies::text) <= 1048576` (1 MB — a 1,000-movie list with detail fields is ~300 KB; verify against a real backup first and pick 2× headroom), and `pack_progress.state` to 8 KB. Mirror a client-side guard in `saveRanking()`/`saveSuggestionQueues()` (`app.js` ~2419/2151) that warns and skips the remote write instead of throwing when the payload exceeds the cap.
- **Why:** Any authenticated user can currently upsert an arbitrarily large blob into their row — a storage-abuse vector and a self-inflicted sync breaker. `product_events` already has exactly this style of bound (512 bytes); the user tables should too.
- **Gotchas:** The constraint failure surfaces as a Supabase error → `runSupabaseRequest` marks sync unavailable; the client-side pre-check is what keeps the UX sane. Add the migration via `supabase/migrations/` with the timestamp convention; test the merge paths in `tests/persistence.test.js` are unaffected (they are pure, they should be).

### 5. `product_events` retention and flood posture

- **What:** (a) Add a scheduled cleanup (Supabase cron / `pg_cron` migration) deleting `product_events` rows older than ~180 days; (b) document the accepted risk that inserts are anon-grantable and only bounded per-row (the client's 80-event session cap is advisory). Optionally add a Postgres statement-level trigger rejecting >N inserts per `session_id` (e.g. 500) as a cheap flood brake.
- **Why:** Insert-only tables grow forever; the strict name/property allowlists already prevent data abuse, but nothing prevents volume abuse or unbounded storage.
- **Files:** new migration; `notes/feature-ideas/product-instrumentation.md` (document retention + the clean-analysis cutoff interaction).

---

## P1 — Correctness and data-integrity improvements

### 6. Cross-device merge loses rank positions — make it explicit

- **What:** `mergeRankingPayloads` (`lib/persistence.js:57`) keeps the newest snapshot's order and **appends** older-only movies at the bottom. A movie ranked #3 on the phone appears last on the laptop after merge, silently. Two-part fix: (a) in `loadRanking` (`app.js:2440`), when the merge appends movies that weren't in the newest payload, surface a toast — "N movies merged from another device were added to the bottom — review their placement" — with a button that opens ranking review or the full-screen view filtered to them (they have `rankedAt`, so `buildReviewQueue`'s recency preference already favors them); (b) longer-term option: insert merged movies near their old relative position (fractional index between former neighbors present in both lists) instead of appending. Ship (a) first; (b) needs careful property tests in `tests/persistence.test.js` before it's trusted.
- **Why:** This is the only silent data-*placement* loss in an app whose core value is the order. Users who rank on two devices will hit it.
- **Gotchas:** The merge contract ("never drop, never reorder base") is load-bearing and well-tested — do not weaken it. (a) is purely additive: return metadata (`appendedKeys`) from a wrapper rather than changing `mergeRankingPayloads`'s signature used elsewhere.

### 7. Decide and document the sign-out data story

- **What:** `handleSignOut` (`app.js:8843`) sets `ranking = []` and calls `saveRanking()` while signed out, which **overwrites the browser-local ranking with an empty list at a fresh timestamp**. The account copy is safe, and merge-on-next-sign-in resurrects the movies (append semantics), but a signed-out visitor after sign-out sees an empty app, and the *order* is at the mercy of item 6. Either (a) intentionally keep "sign out clears this device" and add a confirm dialog stating it ("Sign out? Your list stays in your account; this device will show an empty list."), or (b) leave the local snapshot untouched on sign-out (skip the `saveRanking()` wipe) so the device keeps a read/write local copy.
- **Why:** Today it's an undocumented destructive side effect of a non-destructive-looking button.
- **Gotchas:** Option (b) means a shared computer keeps the last user's list visible — that's why (a) with the confirm text is probably right, but it's a product decision. Add an e2e assertion for whichever behavior is chosen (`run-e2e-smoke.cjs` already mocks signed-in persistence).

### 8. Backup nudges for signed-out users

- **What:** Signed-out users' only durability is localStorage. Add a quiet, dismissible prompt (reuse the actionable toast in `setAddFeedback`) after meaningful accumulation — e.g. every 25 rankings, or when `localPersistenceUnavailable` flips true — offering "Download backup" (existing `downloadStackRankBackup`) or "Sign in to sync". Persist last-nudge state in localStorage so it fires at most every ~30 days.
- **Why:** "Never lose data" is priority one, but browser storage is evicted by iOS/Safari after inactivity; today the user is only warned when storage is *already* failing.
- **Files:** `app.js` (ranking-settled path `handleRankingSettled`), a pure gate in a new-or-existing lib module (`lib/ftue.js` is close in spirit) with tests.

### 9. Autocomplete listbox ARIA and keyboard-reorder gap

- **What:** Two accessibility completions: (a) the search input (`index.html:266` region) has `role="listbox"` on the suggestion container and `role="option"` items, but the input lacks `role="combobox"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` wiring — add them in `renderSuggestions`/`setActiveSuggestion`/`hideSuggestions` (`app.js:9364–9464`); (b) Move mode (ranking + full-screen) is pointer-drag only — add keyboard reorder: when a `.ranking__handle` has focus, ArrowUp/ArrowDown moves the item one slot (reuse `moveRankingItem` from `lib/fullscreen-ranking.js`), with an `aria-live` announcement ("Moved to #4 of 30").
- **Why:** These are the two real gaps in an otherwise strong a11y story (focus trap, `inert`, `aria-live` statuses are already in place). Keyboard reorder also serves desktop power users.
- **Gotchas:** Announce via the existing `add-feedback` live region rather than adding another. e2e: extend the keyboard-autocomplete flow already in the smoke suite.

---

## P2 — Product improvements (engagement, retention, growth)

Ordered by expected impact ÷ effort. The first three have existing design notes — extend those documents rather than re-speccing.

### 10. Public shareable list link (read-only)

- **What:** The single biggest growth lever the app lacks: a URL someone can tap from a group chat. Add an opt-in "Publish a link" action in Share Studio: a `shared_lists` table (`slug text pk` — 10-char random, `payload jsonb` snapshot of `{displayName, movies:[{title,year,posterPath,tmdbId}]}`, `list_id text` owner ref, `created_at`, `revoked boolean`), RLS: owner insert/update/delete scoped like `rankings`, `anon` select where `revoked = false`. A read-only route `/s/:slug` — a small static `shared.html` + `shared.js` (rewrite in `vercel.json`: `/s/:slug` → `/shared.html`) that fetches the row via the publishable key and renders the poster-grid list using existing `lib/` renderers. Include "Make your own stack" CTA linking to `/movies`. Publishing requires being signed in (RLS needs a uid); signed-out users see "Sign in to publish".
- **Why:** Today sharing is images only — great for stories, dead for conversations. A link is the standard virality loop and reuses everything: the list, the monochrome look, the CTA funnel.
- **Gotchas:** It's a *snapshot*, not live sync (simpler, avoids leaking ongoing edits) — say so in the UI, offer "Update link" (upsert same slug) and "Revoke". OG tags on `shared.html` should be generic (no per-list server rendering exists — accept that, or later add a Supabase edge function that emits per-slug OG meta). Add `select` rate awareness: payload bound per item 4. New telemetry events (`share_link_published`, `shared_list_viewed`) need a migration extending the event allowlist. E2E: mock the table like `movie_lists` is mocked today. Update `robots.txt`/`sitemap.xml` deliberately (probably exclude `/s/`).

### 11. "Pick something for tonight" (from `notes/feature-ideas/next-product-ideas.md`)

- **What:** A decision tool over **Watch next**: user picks available time (chips: <90m / ~2h / long / any) and optional genre; app scores queue movies by runtime fit + rank-weighted taste signals (`lib/insights.js` + `lib/taste.js` already compute genre/people/decade weights) and shows 3 candidates with "Watch this → then rank it" affordance. Pure selection logic in a new `lib/tonight.js` with tests; UI as a compact panel at the top of the Lists destination (it markets the queue exactly where the queue lives).
- **Why:** Closes the discover → save → **choose** → watch → rank loop; gives Watch next a purpose beyond storage; drives the rank-again retention moment. Runtime data comes from the existing detail enrichment (`fetchMovieDetail`), fetched on demand for the queue like Share Studio does.
- **Gotchas:** No TMDB ratings in the scoring explanation ("Because you rank sci-fi high" style reasons, reusing `lib/suggestions.js` phrasing). Makes no persistent choice on the user's behalf (per the note). Requires runtime for queue movies — hydrate with the same batched pattern as `enrichShareAssets` (batches of 4, request-id guard).

### 12. Comparison receipt with inline undo (from the same note)

- **What:** After a placement, extend the existing toast into an optional expandable receipt: the K comparisons made ("Chose *Heat* over *Casino*"), plus the existing Undo and a "Re-rank" shortcut. Data is already in hand at settle time — `compareHistory` holds the trail; capture `{midMovie, choseNew}` per step in `handleDecision` (`app.js:2657`) before it's cleared.
- **Why:** Binary insertion is the product's magic and its biggest comprehension risk; a receipt makes it legible and catches mis-taps while fresh. Cheap: no persistence, no new surface — an actionable toast variant.
- **Gotchas:** Keep it one-shot and dismissible; do not retain history beyond the toast (explicit non-goal in the note). Mobile: cap visible rows (~4) with "…and 2 more".

### 13. Finish Google/Apple OAuth production setup

- **What:** The sign-in view already detects and shows providers dynamically (`lib/auth.js`, `loadSignInProviderAvailability`); what's missing is provider-console credentials (see `notes/feature-ideas/auth-upgrade.md`). This is a configuration task, not code: Google Cloud OAuth client + Apple Developer Services ID, secrets into Supabase dashboard.
- **Why:** Magic-link-only is measurable sign-in friction on mobile (leave app → mail → tap → return). Sync adoption gates all retention math, and `signed_in` is already on every telemetry event to prove the delta.
- **Gotchas:** Apple requires a paid developer account and 6-month key rotation; document rotation dates in the auth note. Test on the production origin — redirect allowlists are already in `supabase/config.toml`.

### 14. PWA: manifest + installability (service worker optional, later)

- **What:** Step 1 (cheap, safe): add `manifest.webmanifest` (name, icons from existing `assets/`, `display: standalone`, `start_url: /movies`, monochrome theme colors), link it in `index.html`; CSP already allows `manifest-src 'self'`. Step 2 (separate decision): a minimal service worker that precaches the app shell (`index.html`, `app.js` + `lib/`, `styles.css`, packs JSON) for offline boot — ranking/queues already work offline-by-localStorage once the shell loads. Requires `worker-src 'self'` in CSP (currently `'none'`) and a careful update strategy that coexists with the `?v=N` scheme (SW should cache-bust on new deploys via a version stamp in the SW file).
- **Why:** The app is used heavily on phones and is already local-first; "Add to Home Screen" without Safari chrome is a real retention surface. Offline shell makes airplane-mode ranking work.
- **Gotchas:** Service workers + manual cache keys are the top footgun ("my change isn't showing up" gotcha would get a new failure mode) — that's why step 2 is separate and needs an explicit kill switch (SW that self-unregisters on a flag). Do step 1 now regardless.

### 15. Letterboxd/CSV interop

- **What:** (a) Export: add "CSV (Letterboxd)" to Share Studio's copy/export row — columns `Title,Year,Rating10` is not applicable (no ratings) so use their watchlist-import format `Title,Year` plus a plain `Position` column for other tools; generation belongs in `lib/share-export.js` with tests. (b) Import: the title-import overlay already accepts pasted lines; add "paste a Letterboxd export" awareness — detect CSV headers in `parseRankedTitleList` (`lib/backup.js`) and extract the Title/Year columns.
- **Why:** Letterboxd is where the target user already lives; frictionless in/out builds trust (and their exports are a huge onboarding shortcut past the 100-title cap — keep the cap but tell the user to trim).
- **Gotchas:** CSV quoting edge cases — write the parser tests first (`tests/backup.test.js`). No API scraping; file/paste only.

### 16. Where-to-watch on the movie detail pane

- **What:** Extend `tmdb-detail` edge function to also return TMDB `watch/providers` for the user's region (accept a `region` param, default `US`), and render a compact "Where to watch" row (provider logos, flatrate/rent grouping) in the detail pane (`renderDetailPane`, `app.js:4376`).
- **Why:** "Can I actually watch this tonight" is the number-one question a queue app leaves unanswered; it feeds item 11 directly.
- **Gotchas:** TMDB's provider data requires **JustWatch attribution** — add it beside the existing TMDB notice in the pane and on `/privacy`. Adds payload to a hot endpoint: make it opt-in via a query flag so list-wide enrichment (Taste Explorer, Share) doesn't fetch it. Redeploy function; bump nothing client-side except `app.js?v=`.

### 17. Discover destination: seed-picker for "Inspired by"

- **What:** The Inspired-by section seeds from the last-added or a rank-weighted top-10 pick (`getPersonalSuggestionSeed`, `app.js:5693`), and "More" reshuffles opaquely. Add a small "change seed" affordance: a chip row of the top ~5 ranked movies (posters) letting the user pick the seed explicitly; picking sets `activeSuggestionSeed` and refreshes.
- **Why:** Highest-signal suggestion surface, currently uncontrollable; giving control is cheap (state + one render) and makes Discover feel personal rather than random.
- **Gotchas:** Preserve `sessionStorage` previous-seed avoidance; telemetry: reuse `ranking_started` sources, no new event needed unless desired.

### 18. Root home page instead of `/` → `/movies` redirect

- **What:** Per `notes/feature-ideas/multi-domain-url-architecture.md`, the 307 at `/` is temporary. Ship a minimal static landing (`home.html`: one-screen pitch, screenshot, "Rank movies" CTA → `/movies`) and change `vercel.json` to rewrite `/` → `/home.html`.
- **Why:** A redirect wastes the domain root for SEO/unfurls and blocks future categories (TV, music). A landing page is also where the share-link CTA (item 10) lands cold users.
- **Gotchas:** Keep canonical/OG coherent (`/` gets its own OG card; `npm run test:production` asserts the redirect today — update it). Update `sitemap.xml`.

---

## P3 — Architecture, performance, and code health

### 19. Kill the manual `?v=N` cache-busting footgun with a verify check

- **What:** The repo's most recurring operational bug class ("my change isn't showing up") is hand-maintained version queries across `index.html`, `app.js` lib imports, and `PACK_FALLBACK_PATH`. Without adding a build step, add `scripts/check-cache-versions.mjs` to `npm run verify`: it hashes each versioned asset, keeps a committed manifest (`data/asset-versions.json` of `path → {hash, v}`), and **fails verify** when a file's content changed but its recorded `?v=` didn't — printing exactly which query strings to bump. Optionally add `--fix` to bump them automatically.
- **Why:** Converts a documented human-memory rule into a mechanical check; near-zero risk since it changes no runtime behavior.
- **Gotchas:** The manifest updates in the same commit as the bump — the script must treat "hash changed AND v changed" as pass-and-rewrite-manifest. Cover `lib/*.js` imports inside `app.js` (regex `\.\/lib\/[\w-]+\.js\?v=\d+` plus unversioned lib imports, which should also be flagged once and versioned).

### 20. Memoize derived pack stats (real hot-path waste)

- **What:** `getPackStats(pack)` walks every pack movie and does `findIndex` over `ranking`, `watchList`, `notInterestedList` (`getMovieHandledState`, `app.js:4834`). It is called O(packs) times *per sort comparison* in `sortedPacksForDisplay` (`app.js:4872` — comparator calls `getPackStats(a)`/`getPackStats(b)` and `packStatusRank` recomputes them again), on every `renderPackSurfaces()`, which runs on every ranking settle, queue change, and undo. With 114 packs × ~15 movies × a 200-movie ranking that's millions of `movieKey` string builds per render. Fix: build one `Map(movieKey → handledState)` per render pass from the three lists (O(total movies)), pass a lookup into `computePackStats`, and compute each pack's stats exactly once per render (`const entries = packs.map(p => ({p, stats}))` then sort on the precomputed stats).
- **Why:** Straightforward 100×+ reduction on the most-repeated hot path; matters on older phones, and it's a pure refactor with existing coverage in `tests/packs.test.js` (extend to accept the lookup form).
- **Gotchas:** `syncPackCompletion` mutates `packProgress` during `renderPackSurfaces` — recompute stats after reconciliation or feed it the same memo carefully (compute memo → reconcile → invalidate only affected slugs).

### 21. Memoize `getRankingInsights()` per state tick

- **What:** `getRankingInsights()` re-derives the full insight object (map over ranking + `computeRankingInsights`) and is called from `renderListSnapshot`, `renderTasteExplorer`, `updateShareStudio`, `shareSectionAvailability`, `updateShareExportControls`, several share builders — often 3–6 times within one synchronous render. Cache the result keyed on a monotonically-bumped `stateVersion` counter (bump in `saveRanking`, queue persist, and `detailCache.set`).
- **Why:** Same class of waste as item 20; also simplifies reasoning ("insights are stable within a tick").
- **Gotchas:** `detailCache` fills asynchronously — bumping the version in `fetchMovieDetail`'s cache-set keeps enrichment reflected. Keep `computeRankingInsights` itself pure/untouched.

### 22. Split `app.js` into feature modules (no bundler needed)

- **What:** 9,650 lines in one module is the codebase's biggest maintenance tax (the CLAUDE.md line-map drifts constantly; edits collide). It's already an ES module, so browsers can load a split graph natively. Extract along the existing seams, one module per PR-sized commit, keeping `app.js` as the composition root that owns shared state and passes dependencies explicitly: `js/share-studio.js` (~2,500 lines: builders, preview, PNG/zip export, lightbox), `js/packs-ui.js` (~1,000), `js/detail-pane.js`, `js/comparison.js` (+review), `js/queues-ui.js`, `js/import-backup-ui.js`, `js/auth-ui.js`. State access via a small context object (`{getRanking, setRanking, save, render…}`) or per-module init functions — mirror how `lib/` wrappers already bind live state.
- **Why:** Reviewability, parallel agent work, smaller cache-invalidation blast radius (a share-only change stops invalidating all 9,650 lines), and it makes item 19's versioning more valuable.
- **Gotchas:** This is the riskiest refactor in the plan — do it *after* items 19–21, module by module, `npm run verify` between each. Every extracted file needs a `?v=N` (item 19's checker enforces it). Do not convert shared mutable state to exported bindings (ESM live bindings + reassignment is a trap) — use accessor functions. e2e selectors must not change.

### 23. Deduplicate the three whole-list SVG renderers

- **What:** The mixed/text/posters list-cell rendering exists three nearly identical times: `shareSectionBuilders().fullList` (`app.js:6611`), `buildWideFullListDescriptor` (`app.js:6827`), and `buildWholeListPageDescriptors` (`app.js:7019`) — ~450 duplicated lines where a geometry tweak must be applied thrice (titleFit, cell metrics, fallback-poster clip paths are copy-pasted). Extract parameterized cell/row renderers (`renderMixedCell`, `renderTextRow`, `renderPosterCell`, each taking `{cols, cellW, …}`) into `lib/share-svg.js` next to the existing composers, with unit tests over the emitted SVG strings.
- **Why:** Real drift risk (the three copies already differ subtly in insets), and `lib/share-svg.js` is the established home with a test harness.
- **Gotchas:** Keep output byte-identical first (snapshot the current SVG strings in tests, then refactor to match) so the e2e download-artifact validations stay green. Bump `lib/share-svg.js`'s cache key when it changes; item 19 now enforces runtime module-graph import cache keys.

### 24. Modernize edge functions to `Deno.serve`

- **What:** All four functions import `serve` from `deno.land/std@0.224.0` — deprecated in favor of the built-in `Deno.serve`. Swap (mechanical), and centralize the duplicated `corsHeaders` + error-response helpers into `_shared/http.ts`.
- **Why:** Removes a deprecated remote std dependency and shrinks per-function boilerplate; pairs naturally with items 2–3 which touch the same files.
- **Gotchas:** `deno check` config in `package.json` covers `_shared/*.ts`; redeploy all four after.

### 25. Incremental rendering guard for very large rankings

- **What:** `renderRanking` rebuilds the entire `<ol>` innerHTML on every change; fine at 100 movies, sluggish at 1,000 (each row builds 5 buttons + overflow menus). Cheap mitigation without virtualization: (a) render rows above a threshold (e.g. 200) with a "Show all N" expander (top 200 + the neighborhood of the last placement always visible), and (b) skip re-render when nothing changed (dirty flag via the item-21 `stateVersion`).
- **Why:** Import + Letterboxd interop (item 15) makes 500–1,000-movie lists realistic; the full-screen grid already handles browsing, so the home list can afford truncation.
- **Gotchas:** Filter/move-mode/drag index math relies on `dataset.index` mapping into `ranking` — the expander must preserve absolute indices (it already uses per-item dataset indices, so hidden ranges just mean missing DOM nodes; drag reorder should be disabled while truncated, like it is while filtered).

### 26. Boot performance niceties

- **What:** (a) Add `<link rel="preconnect" href="https://image.tmdb.org">` and `…href="https://hrfhakrxsllrqmscxxpb.supabase.co">` to `index.html` (only fonts.gstatic is preconnected today); (b) `loading="lazy"` on ranking-row posters below the fold (`createMoviePoster` — currently only taste rows and fullscreen cards lazy-load); (c) once item 1 lands, `modulepreload` the vendor bundle.
- **Why:** Signed-in boot does auth + 4 sequential loads before first real paint; shaving connection setup and poster decode is cheap wins on phones.
- **Gotchas:** None of substance; verify with the boot-layout-stability e2e flow.

---

## P4 — Testing, CI, observability

### 27. Split the monolithic e2e harness

- **What:** `scripts/run-e2e-smoke.cjs` is 6,200 lines: CDP harness + 23 flows in one file. Extract the harness (browser boot, page eval helpers, mock-Supabase fixtures, report writer) into `scripts/e2e/harness.cjs` and one file per flow (`scripts/e2e/flows/*.cjs`) that the runner discovers. Keep `E2E_ONLY` substring filtering and the report format identical.
- **Why:** The file is at the size where flows copy-paste helpers (the pending iPad diff adds another 100-line eval blob); per-flow files make ownership, review, and agent-parallel edits tractable.
- **Gotchas:** Zero-dependency constraint stays (plain `require`). Do this after the in-flight iPad work lands to avoid rebasing it.

### 28. Scheduled production monitoring

- **What:** `npm run test:production` exists but only runs when a human remembers. Add `.github/workflows/production-smoke.yml`: cron (e.g. every 6h) running `npm run test:production`, failing loudly (GitHub issue creation or email on failure).
- **Why:** The deploy chain (Vercel + Cloudflare DNS + Supabase + Resend) has many silent-failure surfaces (cert renewals, header regressions, edge-function drift after console changes); this is free monitoring with a script that already exists.
- **Gotchas:** Networked and flaky-adjacent — add one retry inside the workflow before alerting. Note prod smoke hits real endpoints; it already uses `?debug=1` to avoid contaminating telemetry.

### 29. Screenshot regression diffing (optional, behind a flag)

- **What:** `npm run screenshots` archives deterministic screenshots but nothing compares them. Add `scripts/compare-screenshots.mjs`: pixel-diff (naive per-pixel with threshold; no deps — decode PNG via zlib + manual filter reconstruction is genuinely painful, so if a dep is unacceptable, compare byte-identical dimensions + a downsampled perceptual hash implemented in ~100 lines) against a committed `debug/screenshots/baseline/` set, reporting changed surfaces. Run manually / in CI as a non-blocking job.
- **Why:** The redesign is done; the risk now is regression. Phase-8-style manual QA doesn't scale to every change.
- **Gotchas:** Honest cost note: without a real image-diff dependency this is approximate. If the zero-dep rule can bend for devDependencies (`package-lock.json` is gitignored, so it can't — decide first), `pixelmatch` + `pngjs` is the pragmatic route; otherwise ship the perceptual-hash version.

### 30. Minimal client-error visibility

- **What:** Today JS errors on user devices vanish (console.warn only). Two privacy-consistent options: (a) extend `product_events` with a `client_error` event whose only properties are an allowlisted `source` (module name) and `count` bucket — no messages, no stacks — added via migration + `lib/telemetry.js` allowlist, fired from a `window.onerror`/`unhandledrejection` handler with a per-session cap of ~5; or (b) decide explicitly to keep zero error telemetry and document that in the instrumentation note. Recommend (a): it answers "is the deployed build breaking for people" without collecting anything personal.
- **Why:** The one observability hole: a boot-halting JS error (the documented "blank page" gotcha) is currently invisible unless a user reports it.
- **Gotchas:** Keep it out of DNT/GPC/debug sessions automatically (the existing `shouldCollectProductTelemetry` gate already covers this). Never include error text — allowlist constraint enforces it at the DB.

### 31. Fill telemetry funnel gaps (small)

- **What:** Missing events that current product questions need: `queue_saved` (suggestion→watch), `detail_opened`, `tonight_opened/tonight_picked` (item 11), `share_link_published/viewed` (item 10). Each needs: migration extending the DB allowlists, `lib/telemetry.js` `PRODUCT_EVENT_NAMES`, call sites, and doc updates in `product-instrumentation.md`.
- **Why:** Save/Hide is a core engagement action with zero instrumentation today; you can't evaluate Discover without it.
- **Gotchas:** DB constraint and lib allowlist must ship together (constraint rejects unknown names — client would silently fail inserts otherwise, which is survivable but muddies data).

---

## P5 — Documentation and housekeeping

### 32. Refresh `CLAUDE.md` structural drift

- **What:** The shared brief predates the shipped redesign: no mention of the Rank/Discover/Lists app shell, `lib/app-shell.js`/`lib/lists.js` are only in the module list, and the `app.js` line-map is substantially stale (e.g. "1206–2050 undo/cancel" — now ~2716+; suggestions engine now ~5700). Update the feature map (destinations, segmented Lists tabs), the code map ranges, and add the queue-tab behavior. If item 22 lands, replace line ranges with module pointers.
- **Why:** The brief is the contract for every agent session; drift compounds into wrong edits.

### 33. Repo hygiene

- **What:** (a) `sessions/` (session-export logs, ~500K lines) and `notes/.DS_Store`, `supabase/.DS_Store` sit in the working tree — gitignored but heavy and privacy-adjacent (logs of past assistant sessions); delete or move out of the repo dir. (b) `data/suggestion-packs.source.json` (7k lines) vs generated `suggestion-packs.json` — confirm the source file is still the authoring input for `npm run author:packs` and note it in CLAUDE.md's file list. (c) The `console.info("StackRank build", "taste-explorer-v1")` tag (`app.js:135`) is stale — either maintain it per release or remove it.
- **Why:** Low effort; keeps the tree navigable and avoids accidental future commits of local artifacts.

### 34. Land the in-flight iPad Lists work

- **What:** The working tree has an unfinished-looking but coherent change: two-column iPad queue grids with e2e coverage (`styles.css`, `run-e2e-smoke.cjs`, `?v=130` bumps in both HTML files). Run `npm run verify`, eyeball with `npm run screenshots --only=…` at tablet width, and commit it (single line, e.g. "Lay out iPad lists in two columns") before any other styles/e2e work from this plan begins.
- **Why:** Everything in P2/P3 that touches CSS or the e2e file will conflict with it.

---

## Suggested execution order

1. **Unblock:** 34 (land in-flight iPad work) → 19 (cache-key checker) — both make everything else safer.
2. **Security batch (one session):** 1, 2, 3, 4, 24 — edge functions and CSP together, one redeploy pass, one production smoke.
3. **Perf batch:** 20, 21, 26 — pure wins, low risk, measurable.
4. **Data-integrity batch:** 6a, 7, 8 — product-owner decision needed on 7 first.
5. **Product picks (owner chooses):** 10 and 11 are the highest-leverage; 12, 13, 15, 16, 17 are each independently shippable; 14 step 1 anytime; 18 when a landing page is wanted.
6. **Structural (only when the above is stable):** 22 module split → 23 SVG dedupe → 25 large-list guard → 27 e2e split.
7. **Continuous:** 28, 30, 31 observability; 32, 33 docs.

Dependencies to respect: 19 before 22 (versioning of new modules); 34 before 27 and any CSS work; 4 before 10 (payload bounds apply to `shared_lists` too); 30/31 require coordinated migration + lib changes; 1 changes the CSP that 14's service worker would change again — sequence them.
