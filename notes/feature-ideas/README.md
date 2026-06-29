# Feature ideas

This folder captures product ideas that are worth revisiting later. They are intentionally written as pick-up-ready notes, not committed roadmap decisions.

## Implemented

- [Movie detail pane](movie-detail-decision-sheet.md) — v1 done in commit `64ff621`.
- [Share export sizes and a multi-image image set](share-export-sizes-and-image-set.md) — **shipped (Jun 2026).** Skinny/Wide single-image shapes, grouped/paginated Image sets, ZIP delivery, per-card preview labels, pack exports, empty-section handling, and a full-resolution lightbox with per-image actions/navigation. Only an alternate iPad-shaped Image-set layout remains parked.
- [Suggestion packs](suggestion-packs.md) — **v1 shipped (Jun 2026).** 114 curated fallback packs, browse/detail/Rank-all flows, text/category/progress filters, derived progress, organic discovery, local/Supabase persistence paths, bulk actions, Share Studio integration, and pack-aware undo.
- [Undo for list changes](undo-history-for-list-changes.md) — **shipped (Jun 2026).** Single-level toast undo covers queue actions, ranking deletion/clear, completed placements (including pack Rank all), and pack Save all/Hide all.
- [Website link preview metadata](website-link-preview-metadata.md) — **shipped (Jun 2026).** Open Graph/Twitter metadata plus a reproducible 1200×630 preview card.
- [Backup, restore, and title-list import](backup-and-import.md) — **shipped (Jun 2026).** Complete versioned JSON backups, exact restore with undo, and TMDB-backed ordered-title import with conservative automatic matching, disambiguation, and replacement consent.
- [Better suggestion explanations](better-suggestion-explanations.md) — **shipped (Jun 2026).** All three suggestion sources have plain-language section context and every movie card gets an async-enriched, truthful source/genre reason without exposing TMDB ratings.
- [Full-screen ranking view](ranking-fullscreen-view.md) — **v2 shipped (Jun 2026, interactive).** Roomy responsive poster grid with detail, re-rank/remove, filtering, density, jump-to, keyboard navigation, and undoable 2-D pointer drag.
- [Ranking review mode](ranking-review-mode.md) — **v1 shipped (Jun 2026).** Adjacent-pair audit pass: a Review button surfaces pairs (favoring recent additions, via `lib/review.js`), Keep/Swap/End in the reused comparison panel, immediate persistence, and a session-level undo.
- [Suggestion packs: broaden representation](suggestion-packs-diversity.md) — **shipped (Jun 2026).** 14 representation packs added (114 total): 6 thematic (Black, Queer, Trans & Nonbinary, Women Behind the Camera, Latino & Latin American, African) + 6 creator filmographies (Peele, Coogler, DuVernay, Nair, Sciamma, Cuarón) + Indigenous and Southeast Asian gateways. Production tables, pack upload, and cross-device progress sync are active.
- [Product instrumentation](product-instrumentation.md) — **shipped (Jun 2026).** Vercel Web Analytics pageviews plus a privacy-bounded Supabase event stream for ranking, review, packs, sharing, import, and future activation funnels.
- [First-run quick start](first-run-quick-start.md) — **shipped (Jun 2026).** Contextual zero/one-movie guidance, three varied starter packs, direct title import, activation telemetry, and a tested desktop/mobile empty→comparison flow.
- [Personal stats and taste profile](personal-stats-and-taste-profile.md) — **interactive Taste Explorer v1 shipped (Jun 2026).** A collapsed five-movie reward surface turns rank-weighted genre/era/person signals into evidence rows, full-screen ranking lenses, and focused pack searches.

## Current top candidates (priority order, refreshed 2026-06-28)

1. [**Suggestion packs Phase 4**](suggestion-packs.md) — filters and the 100-pack expansion now ship; a featured row or alternate sorting should wait for usage evidence.
2. [**Ranking review mode follow-ups**](ranking-review-mode.md) — adjacent-pair v1 shipped; per-swap undo or confidence-gap/section strategies can wait for usage evidence that deepening review is worth it.
3. [**Image-set tablet layout**](share-export-sizes-and-image-set.md) — an optional fixed landscape/iPad page system remains parked; lower priority because Wide single-image output already covers the main tablet/dashboard use case.

## New exploratory concepts

- [**Three product ideas to revisit**](next-product-ideas.md) — a Watch-next “pick something for tonight” tool, automatic list lenses, and a comparison-trail placement receipt. Briefly captured, not yet prioritized.

## Parked (bigger bets)

- [**Social features**](social-features.md) — friends, viewing friends' rankings, per-title rank comparison, and an auto "friend pack" per friend. Explicitly later: needs a profiles/friendship/privacy model and new (deliberately non-owner) RLS policies. Captured so current work stays compatible.

## Completed ideas with potential follow-ups

- [Movie detail pane](movie-detail-decision-sheet.md) — now also works from queues and packs; tapping its poster opens the shared high-resolution lightbox. Trailer/focus/loading polish remain optional.
- [Share export sizes and a multi-image image set](share-export-sizes-and-image-set.md) — alternate iPad-shaped Image-set pagination remains the only material parked item.
- [Suggestion packs](suggestion-packs.md) — a featured/sort pass and production resurfacing validation remain; text/category/progress filters now ship.
- [Undo for list changes](undo-history-for-list-changes.md) — intentionally single-level and short-lived; multi-step history remains out of scope unless usage shows a need.
- [Website link preview metadata](website-link-preview-metadata.md) — Open Graph/Twitter tags + a generated 1200x630 `assets/og-preview.png` now ship; follow-up is post-deploy verification in Apple Messages and favicon/Apple-touch-icon polish.
- [Full-screen ranking view](ranking-fullscreen-view.md) — interaction parity and 2-D drag now ship; keyboard reordering and persisted density remain optional.
- [First-run quick start](first-run-quick-start.md) — evaluate the recorded activation funnel after 14 days (or 30 days with low traffic) before adding more onboarding UI.

## Cross-cutting infrastructure now available

The Share Suite build left reusable pieces that lower the cost of several ideas above:

- **Rank-weighted insight engine** — `getRankingInsights()` returns decades, genres, directors, cast, average year, oldest/newest, "most ranked in one day," etc. Directly powers Share Studio and the shipped interactive Taste Explorer.
- **Taste lenses** — `lib/taste.js` derives recurring signals and rank-preserving movie subsets; the full-screen ranking can now present those subsets without creating separate lists.
- **Passive metadata** — `rankedAt` on rank, `savedAt`/`hiddenAt` on queue moves (no DB schema change). Enables time-based stats and recency ordering.
- **Loading-skeleton pattern** — both an in-SVG skeleton (share sections) and a DOM shimmer (`renderBootSkeleton()`, main page) now exist to reuse.
- **Single-level undo controller** — `lib/undo.js` provides tested expiry/token semantics; app-level restore closures cover ranking and queue snapshots.
- **Shared full-resolution lightbox** — Share Studio images and detail posters share zoom/pan/dismiss behavior; share mode adds download/share actions and Image-set navigation.
- **Pack-derived progress/indexes** — pack status, membership, featured ordering, and summaries are reusable for filters, discovery explanations, and future stats.
- **Privacy-bounded product events** — ephemeral page-session funnels with strict event/property allowlists, bucketed counts, DNT/GPC opt-out, production-only collection, and no movie or account identifiers.
