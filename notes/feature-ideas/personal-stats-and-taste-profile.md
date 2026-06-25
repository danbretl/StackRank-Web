# Feature idea: Personal stats and taste profile

Status: exploratory — **but the hard part is already built.**

## Update (Jun 2026): the engine exists

The Share Studio build created the full rank-weighted insight engine. **`getRankingInsights()`** already computes essentially every stat listed below — decades + distribution, top/highest-ranked decade, average year, oldest/newest, genres, directors, cast, "most ranked in one day," first/last ranked dates — using the passive `rankedAt` metadata. The Share poster *is* a taste profile; it's just gated behind the share flow and rendered as an SVG.

So this feature is no longer "build a stats engine," it's **"surface the insights we already calculate on the main page"** as native HTML. That collapses the cost dramatically and removes the "rich stats need new metadata" objection (the enrichment pass already runs). The `getRankingStats(ranking)` helper proposed below is largely subsumed by `getRankingInsights()` — reuse it rather than writing a parallel one. The main new work is an unobtrusive on-page HTML layout + an empty/short-list state; the chart/callout patterns can mirror the share poster's sections.

### Open question that's blocking priority (Dan, Jun 2026)

Because the Share Studio already shows all of this, **what does an on-page stats section show that the Share Studio doesn't?** If it's just the same numbers, why not point people at Share? This is the thing to answer before building. Candidate differentiators worth exploring:

- **Always-on, zero-friction** glance (no opening a modal) — stats as ambient reward, not an export step.
- **Interactive** in ways the static SVG can't be — tap a decade/genre to filter the list, drill into "your highest-ranked sci-fi", see *which* movies drove a stat.
- **Progress/streak framing** — momentum and milestones ("you've ranked 3 decades", "5 days in a row") rather than a snapshot.
- **Actionable hooks** — "you've barely ranked the 2010s — want suggestions?" tying stats back into the add flow (and into [[suggestion-packs]]).

Until there's a crisp answer here, this stays lower priority than the others.

## Summary

Add a quiet stats section that summarizes the user's ranked movie list. This would turn the ranking from a pure utility into something rewarding to inspect and revisit.

## Problem

Once a user has built a meaningful list, the app primarily lets them keep adding and rearranging movies. There is not yet much payoff for having created the list beyond the list itself.

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

Start with stats that can be derived from existing local data:

- Total ranked movies
- Oldest ranked movie
- Newest ranked movie
- Average release year
- Decade distribution

This avoids needing a new data enrichment pass.

Later versions can fetch richer TMDB details for genres, directors, runtime, and language.

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
- Rich stats require richer movie metadata than the app currently stores.
- If overdesigned, it could distract from the core ranking flow.

## Implementation notes

- Add a derived `getRankingStats(ranking)` helper.
- Keep calculations defensive around missing years.
- For decade distribution, group years by floor year / 10.
- Only show the section once there are enough movies to be meaningful, or show a compact empty state.
- Avoid storing derived stats initially; compute from ranking state.

## Acceptance criteria

- User can see a compact stats section derived from their current ranking.
- Stats update immediately after ranking changes.
- Empty and short-list states do not feel broken.
- No new server schema is required for the first version.
- Mobile layout remains secondary and unobtrusive.

