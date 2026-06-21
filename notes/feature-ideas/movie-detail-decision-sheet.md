# Feature: Movie detail pane

Status: v1 done

## Summary

Add an optional movie detail pane for suggestion cards without slowing down the primary ranking flow.

The shipped v1 keeps the fast behavior intact:

- Tapping a suggestion card body still starts ranking immediately.
- Save and Hide remain inline on suggestion cards.
- A compact info icon in the title row opens movie details.
- The detail pane includes Rank, Save, Hide, and Close actions.

This replaces the earlier idea of putting a required detail step between tapping a suggestion and ranking it. That required-step version was rejected because it would make obvious ranking choices take two taps instead of one.

## Shipped v1

Implemented in commit `64ff621 Add movie detail pane`.

### Card behavior

- Suggestion cards now include a compact info icon in the title row.
- Card-body tap still calls the existing ranking flow.
- Inline Save and Hide buttons still perform immediate queue actions.
- Info icon tap opens the detail pane and stops event propagation so it does not accidentally start ranking.
- Keyboard handling avoids Enter / Space on the info button bubbling into the card ranking handler.

### Detail pane content

The pane shows:

- Poster
- Title
- Release year
- Runtime
- Genres
- Overview
- Director
- Main cast, first 2-3 names

### Detail pane actions

- Rank: closes the pane and starts the existing ranking flow.
- Save: closes the pane and moves the movie to Watch next.
- Hide: closes the pane and moves the movie to Not for me.
- Close: dismisses the pane without changing state.

### Layout

- Mobile uses a bottom sheet with reachable action buttons at the bottom.
- Desktop uses a compact centered modal.
- The background is dimmed and blurred.
- Body scrolling is disabled while the pane is open.
- Escape and backdrop click close the pane.

### Data implementation

Added a Supabase Edge Function:

- `supabase/functions/tmdb-detail/index.ts`
- Endpoint path: `/functions/v1/tmdb-detail`
- Input: TMDB movie id
- Output: normalized movie detail payload with runtime, genres, overview, director, and cast

The client fetches details by TMDB id only when the pane opens, then caches details in-memory by TMDB id for the current session.

## Why this version works

- It gives users more context for unfamiliar movies.
- It preserves one-tap ranking for obvious choices.
- It keeps Save and Hide quick.
- It avoids cluttering the poster area.
- It gives the detail feature a natural place to grow later.

## Product decisions made

- Use Option C: title-row info icon.
- Do not make details a required step before ranking.
- Do not include trailers in v1.
- Include director and 2-3 main cast in v1.
- Keep ratings out of v1 to avoid over-weighting consensus instead of personal preference.

## Validation performed

- `tmdb-detail` deployed and listed as active in Supabase.
- Direct function call returned expected data for The Godfather.
- Headless mobile and desktop checks verified:
  - Detail pane opens from suggestion info icon.
  - Runtime, genres, director, cast, and overview render.
  - Close returns to suggestions.
  - Card-body tap still starts ranking.
  - Detail Rank starts ranking.
  - Detail Save moves movie to Watch next.
  - Detail Hide moves movie to Not for me.

Known unrelated warning during browser checks:

- Missing favicon 404.

## Potential next steps

### Add trailer link

Add a subtle `Watch trailer` link or icon-text button below the metadata.

Implementation likely needs one of:

- Extend `tmdb-detail` with `append_to_response=videos`.
- Pick the best YouTube trailer from TMDB video results.
- Hide the link when no trailer is available.

Keep this subtle; the pane should remain a decision surface, not a media viewer.

### Reuse details for queue items

Consider adding the same info icon to Watch next and Not for me items.

This would let users inspect saved or hidden movies before ranking, moving, or removing them.

### Improve focus management

Current v1 focuses the close button when the pane opens and restores focus to the info icon when closed. Potential improvements:

- Trap focus inside the dialog while open.
- Move initial focus to the heading or first meaningful action depending on platform.
- Add stronger automated accessibility checks.

### Add loading and error polish

Current v1 shows simple status text while loading details.

Possible improvements:

- Skeleton state for detail metadata.
- More graceful error copy if TMDB details fail.
- Retry control for detail fetch failures.

### Cache detail data more persistently

Current v1 uses in-memory session cache only.

Potential future options:

- Store recent detail payloads in localStorage with a short TTL.
- Store enriched movie fields when a movie is ranked or saved.
- Avoid over-storing volatile TMDB data until there is a clear need.

### Enrich suggestion explanations

The detail pane could later include a compact explanation such as:

- `Because you ranked Django Unchained`
- `Popular among similar picks`
- `Classic you have not ranked`

This overlaps with the separate Better suggestion explanations feature idea.

### Consider title icon refinements

Watch real usage for whether the info icon is discoverable and easy to tap.

Possible tweaks:

- Slightly larger hit target on mobile.
- Tooltip on desktop.
- Different icon treatment if it feels too visually quiet.

## V1 acceptance criteria

- Suggestion card body still starts ranking with one tap. Done.
- Info icon opens a movie detail pane. Done.
- Detail pane shows poster, title, year, runtime, genres, director, cast, and overview. Done.
- Detail pane supports Rank, Save, Hide, and Close. Done.
- Save and Hide from the pane reuse existing queue behavior. Done.
- Rank from the pane reuses existing stack ranking behavior. Done.
- Mobile uses a bottom sheet and desktop uses a compact modal. Done.

