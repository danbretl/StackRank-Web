# Feature idea: Movie detail decision sheet

Status: exploratory

## Summary

Add a lightweight detail / decision sheet between tapping a movie suggestion and starting the ranking flow. Instead of a suggestion card immediately starting comparison, tapping the card would open a compact movie detail view with clear actions:

- Rank it
- Save
- Hide
- Close

This is not yet a committed direction. The main question is whether the added interaction cost is worth the clarity and accident prevention.

## Problem

Suggestion cards currently carry too much behavioral weight:

- A tap on the card starts stack ranking immediately.
- Save and Hide are available as compact inline actions.
- On mobile, taps are imprecise and it is easy to start ranking unintentionally.
- Users may not recognize a suggested movie well enough to decide from title/year/poster alone.

The recent Cancel ranking work makes accidental starts recoverable, but it still means the user temporarily falls into a heavier flow than intended.

## Proposed flow

1. User taps a suggested movie card body.
2. App opens a detail sheet or modal.
3. Sheet shows:
   - Poster
   - Title
   - Year
   - Short overview, if available from TMDB data
   - Optional metadata if already available or cheap to fetch: runtime, genres, original language
4. Sheet actions:
   - Rank it: starts the current comparison flow.
   - Save: moves the movie to Watch next.
   - Hide: moves the movie to Not for me.
   - Close: returns to suggestions with no state change.

Inline Save / Hide buttons on suggestion cards could remain or be removed. If kept, the card body opens details and the buttons remain direct actions. If removed, the sheet becomes the single decision surface.

## Why this may be worth doing

- Prevents accidental ranking starts by making Rank it an explicit action.
- Gives users more context before deciding what to do with an unfamiliar title.
- Makes Save / Hide clearer because they live in a richer decision context.
- Reduces pressure on suggestion card layout, especially on mobile.
- Creates a natural future home for explanation text such as "Because you ranked City of God" or richer metadata.

## Why this may not be worth doing

- Adds one more tap for users who already know they want to rank a movie.
- Could make the app feel heavier if the sheet is too modal or too detailed.
- Requires either expanding the suggestion payload or fetching details on demand.
- The current compact cards are fast and direct; this could reduce that speed.

## UX options

### Option A: Card opens sheet, Save / Hide stay inline

Suggested first experiment.

- Keeps fast Save / Hide behavior.
- Makes accidental ranking less likely because ranking is no longer the card default.
- Slightly more complex because card body and card buttons do different things.

### Option B: Card opens sheet, all actions move into sheet

Cleaner interaction model.

- Cards become purely informational.
- Sheet is the single decision point.
- Main suggestion rows get visually calmer.
- Costs an extra tap for Save and Hide.

### Option C: Long-press or info icon opens sheet

Probably not ideal.

- Preserves current direct card-to-rank behavior.
- Does not solve accidental ranking starts well.
- Info icons add visual clutter and are easy to miss.

## Implementation notes

- Add `selectedDetailMovie` state.
- Render a sheet/modal component near the existing compare panel or at the end of the main app.
- Reuse existing `startRankingMovie(movie)` for Rank it.
- Reuse existing `addSuggestionToQueue(movie, "watch")` and `addSuggestionToQueue(movie, "notInterested")`.
- Close the sheet after any action.
- If card body opens sheet, stop event propagation from inline Save / Hide buttons.
- Keep keyboard support:
  - Escape closes the sheet.
  - Focus starts on the sheet heading or first action.
  - Focus returns to the originating card when closed where practical.

## Data notes

Current suggestion cards appear to have enough data for poster/title/year/TMDB id. Overview, runtime, and genres likely require either:

- Adding fields to the Supabase suggestion function response, or
- Adding a detail fetch endpoint/call by TMDB id when the sheet opens.

The simplest first version can use poster/title/year only, but that may not justify the sheet. A short overview is probably the minimum useful addition.

## Mobile considerations

- Sheet should feel like a bottom sheet or full-width modal, not a tiny centered dialog.
- Primary actions should be large enough for thumb taps.
- Avoid stacking too many controls above the fold.
- Closing should be obvious and not require browser back.

## Open questions

- Does adding a sheet make suggestions feel more deliberate or just slower?
- Should inline Save / Hide remain on cards?
- Is "Rank it" the right label, or should it be "Start ranking"?
- Should the sheet be used for search autocomplete selections too, or only recommendation cards?
- Should Not for me / Watch next list items also open the same detail sheet, or keep current direct row actions?

## Possible acceptance criteria

- Tapping a suggestion card body does not start ranking immediately.
- User can start ranking from the detail sheet with one clear action.
- User can Save or Hide from the sheet.
- User can close the sheet without changing state.
- Existing Cancel ranking behavior remains available once ranking starts.
- Mobile layout has no overlapping controls and does not show the text input during comparison.
