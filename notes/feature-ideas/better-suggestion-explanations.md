# Feature idea: Better suggestion explanations

Status: **shipped (2026-06-27)**

## What shipped

Suggestion sources are explained at both the section and movie level:

- The related row is titled **Inspired by [movie]**, using a rank-weighted seed
  from the user's top ten or the movie they just ranked. Its subtitle identifies
  that movie's current rank and whether it was just added.
- Each related card prefers a distinctive shared genre (`Shares science fiction
  with The Matrix`) and otherwise uses the honest TMDB recommendation source
  (`Recommended from The Matrix, your #1`).
- Each essential card combines its release decade and a useful genre when
  available (`A 1970s crime essential`), with truthful decade/genre/source
  fallbacks.
- Each popular card identifies the TMDB source and adds genre context when
  available (`Popular now · Horror`).
- Reason lines remain hidden while `tmdb-detail` genre enrichment is pending, so
  users never see a generic fallback flash and then change underneath them.
- Reasons refresh with their cards and never expose TMDB ratings.

The pure policy lives in `lib/suggestions.js`; focused unit coverage is in
`tests/suggestions.test.js`, and the E2E smoke verifies pending, enriched, and
refreshed card states.

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

## Original proposed improvements

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

The shipped version uses data the app can state truthfully: TMDB recommendation
provenance plus detail-backed genre overlap. It does not invent collaborative
filtering claims such as "fans also liked."

## Shipped first version

The original first step was better section-level explanations:

- Make the related section title dynamic and explicit.
- Give all three sections plain-language source subtitles.
- Add one visually subordinate reason line to every movie card.
- Enrich asynchronously, holding the line hidden until its final metadata is
  ready.

Example:

- Section title: `Because you ranked Django Unchained`
- Section title: `All-time essentials`
- Section title: `Popular now`

## Why this may be worth doing

- Builds user trust in suggestions.
- Makes Save and Hide feel more purposeful.
- Helps users understand what feedback they are giving the recommendation system.
- Can improve the perceived intelligence of the app without major new interaction design.

## Guardrails retained

- Keep each reason to one concise line on mobile.
- Prefer a truthful source fallback over a weak causal claim.
- Do not claim director, cast, audience, or behavioral similarity unless the
  upstream data actually proves it.
- Do not surface TMDB ratings.

## Potential follow-ups

- Director/cast overlap could produce more specific reasons using the existing
  detail payload, but only if mobile cards remain uncluttered.
- Better upstream provenance could support stronger recommendation explanations;
  do not add "fans also liked" language without that evidence.

## Acceptance criteria

- Each suggestion section has a clear, user-facing reason for existing.
- Dynamic related sections mention the relevant seed or ranking context when available.
- Each rendered movie card receives a concise source/context reason once
  enrichment settles.
- Mobile layout remains clean and does not add excessive vertical height.
- Explanations update when suggestions refresh or when the seed movie changes.
