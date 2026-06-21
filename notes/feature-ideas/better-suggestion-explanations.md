# Feature idea: Better suggestion explanations

Status: exploratory

## Summary

Make movie suggestions more legible by explaining why each section, and eventually each movie, is being shown. The goal is to make suggestions feel intentional rather than mysterious.

## Problem

Suggestions currently appear in useful buckets, but the reason behind a specific recommendation is not always clear. When a user sees an unfamiliar movie, they may not know whether it is popular, similar to something they ranked, an all-time essential, or just filler.

That ambiguity matters because the user is being asked to make a decision:

- Rank it now
- Save it for later
- Hide it
- Ignore it

Better explanation text can make those choices easier.

## Proposed improvements

### Section-level explanations

Improve section titles or subtitles so each row has a clear reason:

- `Because you ranked Django Unchained`
- `All-time essentials you have not ranked`
- `Popular now`
- `More like your top 10`
- `Recent picks similar to your list`

This is the easiest first version because the app already has section-level context.

### Movie-level explanations

Add a short reason on individual suggestion cards:

- `Same director as Parasite`
- `Often liked by fans of City of God`
- `High-rated classic from the 1970s`
- `Trending this week`
- `Animated favorite you have not ranked`

This would likely require richer TMDB data or a recommendation endpoint that returns reason metadata.

## Suggested first version

Start with better section-level explanations:

- Make the related section title dynamic and explicit.
- Keep `All-time essentials` and `Popular now`, but consider adding subtle subtitles.
- Do not add extra text to every card yet; mobile cards are already compact.

Example:

- Section title: `Because you ranked Django Unchained`
- Section title: `All-time essentials`
- Section title: `Popular now`

## Why this may be worth doing

- Builds user trust in suggestions.
- Makes Save and Hide feel more purposeful.
- Helps users understand what feedback they are giving the recommendation system.
- Can improve the perceived intelligence of the app without major new interaction design.

## Why this may not be worth doing

- Too much explanatory text can clutter mobile suggestion rows.
- Weak or generic explanations may be worse than no explanations.
- Movie-level explanations may require more data modeling and API work than expected.

## Implementation notes

- Current related suggestions already know the seed movie in many cases.
- Favor section-level copy first.
- Keep text short enough for mobile:
  - `Because you ranked {movie}`
  - `More like your top picks`
  - `Classics you have not ranked`
- Avoid wrapping long titles into huge section headers if possible.
- Consider truncating long seed movie titles.

## Acceptance criteria

- Each suggestion section has a clear, user-facing reason for existing.
- Dynamic related sections mention the relevant seed or ranking context when available.
- Mobile layout remains clean and does not add excessive vertical height.
- Explanations update when suggestions refresh or when the seed movie changes.

