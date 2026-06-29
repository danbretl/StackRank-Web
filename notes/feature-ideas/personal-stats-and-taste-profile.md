# Feature idea: Personal stats and taste profile

Status: **interactive Taste Explorer v1 shipped (2026-06-28, commit `202e4fc`).**

## What shipped

- A compact **Taste explorer** panel appears after five movies and stays
  collapsed until requested.
- Opening it lazily enriches up to the first 120 ranked movies, then derives
  rank-weighted recurring signals for genre, era, and director/cast. Higher
  ranks count more, and one-off coincidences are not presented as patterns.
- Selecting a signal lists the ranked movies that produced it, preserving their
  actual ranks; each evidence row opens the existing movie-detail pane.
- **Open this ranking lens** reuses the full-screen ranking to show only those
  movies in master-list order. Search and keyboard navigation remain available;
  jump/reorder are disabled because the lens is a filtered subset.
- When pack title/subtitle/category metadata genuinely matches a signal, an
  action opens the existing pack browser with that focused query.
- Detail requests are deduplicated, partial-data states remain honest, and no
  new stored state or server schema was required.
- `lib/taste.js` owns the pure signal/lens/pack-match rules. Unit coverage and a
  deterministic desktop/mobile E2E flow ship with it. Privacy-bounded events
  measure explorer and lens opens without recording the selected signal.

This resolves the original differentiation question: Share Studio is the static
profile/export; Taste Explorer is **insight → evidence → action**.

## Original enabling context

The Share Studio build created the full rank-weighted insight engine. **`getRankingInsights()`** already computes essentially every stat listed below — decades + distribution, top/highest-ranked decade, average year, oldest/newest, genres, directors, cast, "most ranked in one day," first/last ranked dates — using the passive `rankedAt` metadata. The Share poster *is* a taste profile; it's just gated behind the share flow and rendered as an SVG.

So this feature is no longer "build a stats engine," it's **"surface the insights we already calculate on the main page"** as native HTML. That collapses the cost dramatically and removes the "rich stats need new metadata" objection (the enrichment pass already runs). The `getRankingStats(ranking)` helper proposed below is largely subsumed by `getRankingInsights()` — reuse it rather than writing a parallel one. The main new work is an unobtrusive on-page HTML layout + an empty/short-list state; the chart/callout patterns can mirror the share poster's sections.

### Product question that v1 needed to resolve

Because the Share Studio already shows all of this, **what does an on-page stats section show that the Share Studio doesn't?** If it's just the same numbers, why not point people at Share? This is the thing to answer before building. Candidate differentiators worth exploring:

- **Always-on, zero-friction** glance (no opening a modal) — stats as ambient reward, not an export step.
- **Interactive** in ways the static SVG can't be — tap a decade/genre to filter the list, drill into "your highest-ranked sci-fi", see *which* movies drove a stat.
- **Progress/streak framing** — momentum and milestones ("you've ranked 3 decades", "5 days in a row") rather than a snapshot.
- **Actionable hooks** — "you've barely ranked the 2010s — want suggestions?"
  tying stats back into the add flow (and into
  [Suggestion packs](suggestion-packs.md)).

**Direction chosen:** make this an interactive **Taste explorer**,
not a static stats duplicate. A compact summary could open drill-downs showing
which ranked movies drove each genre/decade/person result, then offer a relevant
pack or suggestion refresh. That creates a loop Share Studio cannot provide:
insight → evidence → action.

## Summary

Add a quiet stats section that summarizes the user's ranked movie list. This would turn the ranking from a pure utility into something rewarding to inspect and revisit.

## Problem

Once a user has built a meaningful list, the main page primarily lets them keep
adding and rearranging movies. Share Studio provides a rich payoff, but there is
not yet a native, interactive way to inspect the patterns behind the list.

A taste profile can make the user's work feel more valuable by reflecting patterns back to them.

## Possible stats

- Total movies ranked
- Top decade
- Average release year
- Oldest movie
- Newest movie
- Most represented genres
- Most represented directors
- Most represented actors
- Highest-ranked decade
- Distribution by decade
- Ratio of animated / documentary / foreign-language films if data is available

## Suggested first version

If this ships, start with a focused subset of the existing insight engine:

- Total ranked movies
- Oldest ranked movie
- Newest ranked movie
- Average release year
- Decade distribution

The existing detail-enrichment and rank-weighted insight paths already provide
genres, directors, and cast. The main design work is progressive loading and
drill-down—not a new stats engine.

## UI placement

This should be less prominent than the core ranking and suggestion workflows.

Candidate placements:

- A collapsible `Stats` section below the ranking.
- A small summary panel beside the ranking on desktop.
- A `Taste profile` section near the bottom of the page.

The section should feel like a reward, not a dashboard takeover.

## Why this may be worth doing

- Gives users a reason to revisit and keep improving the list.
- Makes the app feel more personal.
- Creates useful future hooks for better suggestions.
- Can be implemented incrementally from existing data.

## Why this may not be worth doing

- Early users with short lists may see sparse or uninteresting stats.
- Detail-backed stats need a graceful loading/partial-data state because
  enrichment remains asynchronous and some legacy movies may lack TMDB ids.
- If overdesigned, it could distract from the core ranking flow.

## Implementation notes

- Reuse `getRankingInsights()` / the DOM-free insight helpers rather than adding
  a parallel `getRankingStats()` implementation.
- Keep calculations defensive around missing years.
- For decade distribution, group years by floor year / 10.
- Only show the section once there are enough movies to be meaningful, or show a compact empty state.
- Avoid storing derived stats; compute from ranking state and the existing detail
  cache.

## Acceptance criteria

- User can see a compact stats section derived from their current ranking.
- Stats update immediately after ranking changes.
- Empty and short-list states do not feel broken.
- No new server schema is required for the first version.
- Mobile layout remains secondary and unobtrusive.
