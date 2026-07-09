# Pick something for tonight

Status: **shipped (2026-07-09).** Design record for the Watch next decision
helper, extending the concept sketched in `next-product-ideas.md` with an
optional free-text mood/vibe input.

## What it is

A compact "Decision helper" panel at the top of the **Watch next** pane
(Lists destination) that turns the queue into a choice: the user says how much
time they have (Any length / Under 90m / Around 2h / Over 2½h) and optionally
types a vibe ("cozy", "mind-bending 80s sci-fi", "laugh-out-loud date night"),
and StackRank surfaces **three explained candidates** from the queue. Choosing
"Watch this" collapses to a single confirmation card with **Rank it** /
**Change pick** actions. Nothing is persisted on the user's behalf — the run
lives in memory only — and no TMDB ratings are consulted or shown.

This closes the discover → save → **choose** → watch → rank loop and gives
Watch next a purpose beyond storage.

## Architecture

Three layers, mirroring the app's established split:

1. **`tonight-pick` edge function** (`supabase/functions/tonight-pick/`,
   GET, origin-allowlist + publishable-key gated like the other JSON proxies,
   plus a per-IP token bucket of 60 requests / 5 min because each request fans
   out to TMDB):
   - takes `ids` (1–80 comma-separated TMDB ids from the queue) and an
     optional `mood` (≤160 chars);
   - enriches each candidate from TMDB (`append_to_response=keywords,credits`)
     with a per-instance 12-hour cache — runtime, genres, up to 14 keywords,
     director, top-3 cast; **no vote data is returned**;
   - interprets the mood through the shared lexicon and scores each
     candidate's mood fit server-side, returning `moodScore` (0–1) and the
     matched senses/keywords/era so the client can explain picks.
2. **Mood interpreter** (`supabase/functions/_shared/mood.ts`, Deno-tested in
   `mood_test.ts`): a curated ~33-sense lexicon (cozy, feel-good, funny,
   romantic, scary, tense, mind-bending, chill, dark, whimsical, nostalgic,
   genre words, etc.) mapping normalized free text to TMDB genre weights
   (positive and negative), keyword fragments, decade detection ("80s",
   "nineties"), runtime hints ("quick", "epic"), and an older-movie bias for
   nostalgia. Gibberish is reported as unreadable rather than guessed at.
3. **Client scoring** (`lib/tonight.js`, unit-tested in `tests/tonight.test.js`):
   blends the server's mood fit with **rank-weighted taste affinity**
   (normalized genre/director/cast signals from `lib/insights.js` output),
   soft-edged runtime-window fit, and a mild freshness boost for movies that
   have waited in the queue, plus a deterministic seeded jitter so reshuffles
   reorder near-ties. Weights shift when a mood is readable (mood 0.38 / taste
   0.30 / runtime 0.22 / freshness 0.10) vs not (taste 0.55 / runtime 0.30 /
   freshness 0.15). `pickTonightSlate` applies a light diversity guard (a
   third consecutive same-lead-genre pick yields to a close alternative) and
   supports "Show different picks" via an exclusion set with backfill.
   Reason strings cite concrete signals ("Matches your vibe — funny, buddy",
   "You rank crime high", "Fits your window at 1h 56m", "Directed by Michael
   Mann, a favorite of yours") and never mention ratings.

**Fallback:** if the edge function is unreachable, the client enriches up to
24 queue movies through the existing `tmdb-detail` cache path and scores
without keywords or mood, with an honest status line ("Vibe matching is
unavailable right now — picked from your taste instead.").

## UI behavior

- Panel appears only when the queue has ≥ 2 candidates with TMDB ids; it is
  collapsed by default (Start/Close toggle mirroring the Taste Explorer).
- Vibe transparency: the status line echoes the interpretation ("Vibe read as
  funny · feel-good.") or admits it couldn't read it, so the input never feels
  like a black box.
- The rendered slate is kept stable across queue re-renders; it only recomputes
  when a shown movie leaves the queue (ranked / hidden / removed). Window-chip
  changes re-rank instantly from the cached run without refetching.
- "Rank it" enters the normal comparison flow (`ranking_started` source
  `tonight`); cancel restores the queue and the panel re-offers picks.
- Mobile: mood row stacks, run button is full-width 44px, chips grow to 44px
  on coarse pointers, no horizontal overflow at 375px.

## Measurement

`tonight_opened` (panel expanded; bucketed queue size) and `tonight_picked`
("Watch this" committed; `source` = `tonight_mood` / `tonight_no_mood`,
bucketed queue size). See `product-instrumentation.md`. Review after a few
weeks: expansion rate from Lists visits, mood usage share, pick → rank
conversion (tonight-source `ranking_started` within the session).

## Follow-up ideas (not committed)

- Persist the last time-window choice (session-only today).
- Mood suggestion chips seeded from the user's top genres.
- Where-to-watch providers on the pick cards (improvement-plan item 16 feeds
  this directly).
- Let the server's `runtimeHint` ("something quick") auto-narrow the window
  when the user left it on Any length.
