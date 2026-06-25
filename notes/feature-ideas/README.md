# Feature ideas

This folder captures product ideas that are worth revisiting later. They are intentionally written as pick-up-ready notes, not committed roadmap decisions.

## Implemented

- [Movie detail pane](movie-detail-decision-sheet.md) — v1 done in commit `64ff621`.
- [Share export sizes and a multi-image image set](share-export-sizes-and-image-set.md) — **v1 shipped (Jun 2026).** Skinny/Wide single-image shapes + the Image set format (grouped, paginated cards). Phase 3 polish (ZIP delivery, iPad page size) still parked — see the note.

## Current top candidates (priority order, set Jun 2026)

1. [**Suggestion packs**](suggestion-packs.md) — **new #1.** Curated themed movie sets ("Directed by Wes Anderson", "Movies from 1999", "Best Picture winners") the customer works through via browse or auto-rank mode, with saved progress and resurfacing when a pack changes. Attacks the weakest surface (what to rank next); mostly assembles existing systems. Full spec written; ready to hand to a new session.
2. [Share export sizes and image set — Phase 3](share-export-sizes-and-image-set.md) — ZIP delivery, iPad page size, richer in-studio per-card previews.
3. [Undo history for list changes](undo-history-for-list-changes.md) — safety net for destructive actions; toasts already exist to hang it on.
4. [Ranking review mode](ranking-review-mode.md) — strengthens the core (a list you trust) once it grows large.
5. [Better suggestion explanations](better-suggestion-explanations.md) — makes the add/save/hide decision easier; small, self-contained.
6. [Personal stats and taste profile](personal-stats-and-taste-profile.md) — engine already exists (`getRankingInsights()`), but **open question: what does an on-page stats section show that the Share Studio doesn't?** Needs a clear differentiated purpose before it's worth building.

## Completed ideas with potential follow-ups

- [Movie detail pane](movie-detail-decision-sheet.md)
- [Share export sizes and a multi-image image set](share-export-sizes-and-image-set.md) — Phase 3 (ZIP, iPad, richer in-studio previews) is the follow-up.

## Cross-cutting infrastructure now available

The Share Suite build left reusable pieces that lower the cost of several ideas above:

- **Rank-weighted insight engine** — `getRankingInsights()` returns decades, genres, directors, cast, average year, oldest/newest, "most ranked in one day," etc. Directly powers Personal stats; useful for Better suggestion explanations.
- **Passive metadata** — `rankedAt` on rank, `savedAt`/`hiddenAt` on queue moves (no DB schema change). Enables time-based stats and recency ordering.
- **Loading-skeleton pattern** — both an in-SVG skeleton (share sections) and a DOM shimmer (`renderBootSkeleton()`, main page) now exist to reuse.
