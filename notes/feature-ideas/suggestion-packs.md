# Feature idea: Suggestion packs

Status: **built (v1, Jun 2026) — shipped Phases 0–3.** Originally written Jun 2026 as a parked spec; the design record below is preserved. The **Implementation status** section directly under this line records what was actually built and where it diverged from the spec, and **What's left / follow-ups** tracks remaining work (incl. a packs-focused Share Suite section). The rest of the document is the original design intent.

## Implementation status (as built, Jun 2026)

Built across the codebase in `app.js` (pack state/flows), `styles.css` (`.pack-*` UI), `index.html` (panel + two overlays), `supabase/migrations/20260625071336_add_suggestion_packs.sql` (both tables), `scripts/author-suggestion-packs.mjs` (authoring tool), and `data/suggestion-packs.{source,}.json` (the curated library). **Library currently = 50 packs / 578 movies across 19 categories.**

**Matches the spec:**
- **Two tables** `suggestion_packs` (public-read via RLS `active = true`) and `pack_progress` (per-user, `list_id = user:<uid>`, RLS scoped like rankings/queues). `state` jsonb is exactly `{ startedAt, packVersionSeen, lastIndex, completedAt, discoveryDismissedAt }`.
- **Derived progress** — handled = movie's `tmdbId` is in ranking / watch / not-interested (`getMovieHandledState`, `getPackStats`). Only `startedAt` / `packVersionSeen` / `lastIndex` / the two timestamps are persisted.
- **Derived statuses** `completed` / `started` / `discovered` / `resurfaced`, with `packStatusRank` ordering: resurfaced → started → discovered → not-completed.
- **Fourth panel** above the three suggestion sections (`#pack-section`), showing a relevant subset (`PACK_PANEL_SIZE = 3`) ordered by status, hidden during comparison, with a **"View all packs"** overlay.
- **Pack detail overlay** with per-card Rank/Save/Hide + info, "show handled" toggle, header progress bar, and **auto mode** ("Rank all").
- **Auto mode** feeds remaining movies in curated order through the normal comparison flow, no cap, continuous state-save (`lastIndex`), one-tap resume, cancel returns to detail.
- **Organic discovery** — client-side reverse index (`packIndexByMovieId`), dismissible post-rank nudge (`maybeShowPackDiscoveryNudge`) gated to `discovered` packs and a 30-min cooldown (`PACK_DISCOVERY_NUDGE_COOLDOWN_MS`); opening a pack promotes it to `started`.
- **Resurfacing** via `version > packVersionSeen` (`getPackStats.resurfaced` / `syncPackCompletion`).
- **Signed-out** — progress in `stackrank:pack-progress:v1`, merged on sign-in by `updated_at`.
- **Cover art** — auto 4-mini-poster collage (`createPackCover`) with `cover_path` override supported.

**Diverged from / extended the spec:**
- **Transient "Skip for now" exists** (the `#skip-pack-movie` button + `autoPackSession.skippedKeys`). This is in-session only and never persisted, so it honors decision 3's "no stored skip state" while implementing the UX section's transient skip. The auto-mode counter ("x of y") counts skipped movies toward position so it climbs on skip too.
- **Bundled JSON fallback** (`data/suggestion-packs.json`, `PACK_FALLBACK_PATH`) — the client loads packs from Supabase but falls back to the bundled file if Supabase is empty/unreachable. Not in the original spec; it means the feature works even before packs are uploaded.
- **"Save all" / "Hide all"** bulk actions in pack detail (`addPackRemainingToQueue`) — not in the spec; a convenience for clearing a pack.
- **No separate "Your packs" side panel.** The spec envisioned a dedicated always-reachable surface with three labeled sub-sections ("Pick up where you left off" / "New in packs you've finished" / "You've already started these"). Instead this is folded into the single main panel's status ordering + the "View all packs" overlay. See follow-ups.
- **Toast/auto-advance polish** — completing an auto-pack ranking advances to the next comparison immediately (`queueMicrotask`) with the placement toast decoupled (it no longer gets cleared by the next comparison).

## What's left / follow-ups

- **Deploy step (required for cross-device sync):** apply `20260625071336_add_suggestion_packs.sql` to Supabase, and decide whether to **upload the curated packs** (`node scripts/author-suggestion-packs.mjs --upload`, service-role key in env) or keep serving the bundled JSON fallback. Until the tables exist in Supabase, `pack_progress` writes fail silently and progress stays localStorage-only; packs render from the JSON fallback.
- **Packs-focused Share Suite section — SHIPPED (Jun 2026).** A toggleable `packs` section (between Saved/hidden and Whole list) across all four export surfaces — Skinny SVG, Wide SVG masonry, image-set card, and Markdown/JSON/Text. Content: a 4-up meta strip (`Packs completed` / `In progress` / `Movies ranked` / `Most explored` category) above up to four pack cards rendered roughly like the in-app cards (2×2 poster collage cover, title, subtitle, status, progress bar; completed packs get a ✓ over the collage). All derived from new aggregate helpers `getSharePackSummary()` / `getSharePackFeatured()` / `sharePackCardStatus()` over the existing `getPackStats` (no schema change); featured ordering is in-progress-first by progress, then completed by recency. Self-hides when there is no pack engagement. New share option `packs` (default on), `SHARE_OPTIONS_VERSION` bumped 6 → 7 with a default-on migration.
- **"View all packs" filtering/search (Phase 4).** The overlay currently lists every pack sorted by status with category labels, but has no category/progress filters, search, or featured row.
- **Dedicated "Your packs" surface** — if the folded-into-panel approach proves insufficient, build the standalone three-state surface the spec describes.
- **Resurfacing not yet exercised in production** — the `version > packVersionSeen` path is implemented but won't fire until a pack is actually re-curated and re-uploaded with a bumped `version`.

## Summary

A **suggestion pack** is a curated, themed set of movies — e.g. "Directed by Wes Anderson", "Movies from 1999", "Best Picture winners", "A24 horror", "Studio Ghibli". The customer browses packs, picks one, and works through it: ranking, saving, or hiding each movie. Movies drop out of the pack as they're handled. There's a one-at-a-time **browse** mode and a hands-off **auto** mode that feeds each remaining movie through the normal ranking comparison. Progress is saved, so packs can be resumed; finished packs are remembered; and when a pack's contents are updated (Wes Anderson makes another film → we re-curate it), the pack **resurfaces** as unfinished.

Packs are **pre-fabricated** — hand-curated offline (with AI help, using TMDB and any internet source), stored in Supabase, and served read-only to the client. Nothing is generated live in production.

## Decisions (settled with Dan, Jun 2026)

1. **Entry point: a new, fourth panel above the existing three suggestion sections** (Inspired by / All-time essentials / Popular now). Packs **coexist permanently** with those — they're expected to be far more effective at getting people to rank, so they get the top, weightier-but-subtle slot, but they don't replace the others.
2. **Packs are pre-fabricated, never live-generated.** Curate offline using whatever resources we want (TMDB, Wikipedia, critic lists, award archives). No production cron / build edge function. Updating a pack = re-curate offline and re-upload (bump `version`).
3. **No "skip" action / no skip state.** A movie is handled only if the user ranks, saves, or hides it. If they don't want to act on one, it simply stays in the pack, waiting. There's nothing to mark and nothing to store for "skipped."
4. **Launch with a lot of packs — target ~50+.** Exact count depends on curation cost. Think *meta first*: enumerate the categories of packs (below), then fill them in.
5. **Auto mode is unlimited — no cap, no "save the rest" escape.** Ranking is addictive; a 30-movie pack is ~30 minutes even on a decent-sized list, and that's fine. The requirement is the opposite: **save pack state continuously as they go, and make resuming trivial** so a partially-done pack is always one tap from being continued (an easy "your packs in progress" surface — see UX).
6. **Auto-mode order = the pack's curated order.** Curation controls the sequence.
7. **Un-completing is fine.** Because progress is derived, removing a movie from the ranked list flips a completed pack back to in-progress. Expected and acceptable — the customer can re-enter the pack and re-rank or hide it.
8. **"View all packs" + filtering is a later wave.** The panel shows a relevant subset up front with a **"View all packs"** button that opens a browse window with filters (by category, etc.). The full browse/filter UI does not need to ship in v1.
9. **Pack size: full set by default, but within reason — break large sets up.** A director pack includes all their films (skip weird shorts); a franchise includes the whole saga. But no packs of hundreds: split broad sets into sensible sub-packs (e.g. award winners by era/period; a prolific actor by decade). **Soft cap ~30 movies/pack; ~50 is a hard guideline.** Broad criteria packs (a single year, a genre) also get a TMDB vote-count floor so they're the recognizable set, not obscurities. This is an authoring-tool knob, not user-facing.
10. **Cover art = auto 4-mini-poster collage** from the pack's top movies (zero curation overhead). Optional hand-set `cover_path` override available later for special packs.
11. **Large-pack rendering: render all, lazy-load posters** (reuse the existing `tmdb-image` proxy + the share-enrichment batch pattern). Avoid pagination unless a pack exceeds ~40.
12. **Signed-out:** packs are public-readable; progress lives in localStorage and merges on sign-in, exactly like rankings/queues.
13. **Curation autonomy:** the build session owns *both* the authoring tooling *and* the content — generate packs using your own research/intelligence (TMDB + public lists). **Pack ideas/contents do NOT need pre-approval** — fly, ship a strong batch, and Dan gives feedback / prunes afterward if he has strong feelings.

## Why this is the priority

The weakest part of StackRank today is the "what should I rank next?" moment. The current suggestion engine (Inspired by / Essentials / Popular) is fine but generic — it doesn't give people a *project* to work on or a strong reason to keep going. Packs turn ranking into a series of satisfying, finishable goals ("rank all of 1999", "settle the Tarantino question"), which is exactly the engagement loop the app lacks. It's also a content surface we fully control and can grow indefinitely.

## Current state (what we can build on)

This feature is mostly **assembly of existing parts**, not new core systems:

- **Ranking flow** — `startRankingMovie(movie)` → `startComparison()` → binary-insertion `handleDecision`. Auto mode is "feed a queue of movies through this, one after another."
- **Queues** — Save → Watch next, Hide → Not for me, synced via the `movie_lists` table; existing queue helpers. Save/Hide in a pack reuse these directly.
- **Identity & dedup** — movie identity is `tmdbId`; `isDuplicateMovie()` already prevents re-adding. A pack movie's "handled" state is *derivable* from the user's existing ranking + queues by `tmdbId` (see Progress).
- **TMDB proxies (edge functions)** — `tmdb-search`, `tmdb-suggest`, `tmdb-detail`, `tmdb-image`. The offline authoring tool uses TMDB to resolve titles → ids; posters render through the existing `tmdb-image` proxy.
- **Suggestion card UI** — pack movies can render with the existing suggestion-card component (poster, title, Rank/Save/Hide, info → detail pane).
- **Persistence pattern** — `rankings` (jsonb) + `movie_lists`, per-user `list_id = user:<uid>`, RLS scoped to `list_id = 'user:' || (select auth.uid())`, localStorage fallback + merge for signed-out. Pack progress follows the same pattern.
- **Passive metadata** — `rankedAt` / `savedAt` / `hiddenAt` already stamped; useful for "completed pack" timelines.

## Data model (Supabase)

Two new tables.

### `suggestion_packs` (public-read content)

One row per pack. Read by anyone (anon-readable via RLS); writes restricted to the service role / dev tooling.

- `slug` (text PK) — e.g. `director-wes-anderson`, `year-1999`, `best-picture-winners`.
- `title` (text) — "Directed by Wes Anderson".
- `subtitle` (text) — short hook, e.g. "Every feature, ready to rank".
- `category` (text) — one of the taxonomy categories below, for grouping/browse.
- `movies` (jsonb) — ordered array of `{ tmdbId, title, year, posterPath }` (the same stored-movie shape the app already uses).
- `version` (int) — bumped whenever `movies` changes; drives resurfacing.
- `provenance` (jsonb, nullable) — optional authoring notes for re-curation (e.g. `{ source: "tmdb-director", personId: 5655 }` or `{ source: "wikipedia-best-picture" }`). **Informational only** — used by the offline authoring tool when refreshing a pack, never resolved live in production.
- `active` (bool), `sort_order` (int), `cover_path` (text, optional override; default cover is an auto 4-mini-poster collage of the pack's top movies — decision 10), `created_at`, `updated_at`.

Storing `movies` as jsonb on the row matches the existing `rankings.movies` pattern and keeps reads to a single query. (Alternative: a `suggestion_pack_items` table — only worth it if packs get very large or need per-item metadata.)

### `pack_progress` (per-user)

Mirrors the rankings/queues persistence. Composite key `(list_id, pack_slug)`, `list_id = user:<uid>`, RLS scoped like the other tables; localStorage fallback for signed-out (`stackrank:pack-progress:v1`), merged on sign-in.

- `state` (jsonb): `{ startedAt, packVersionSeen, lastIndex, completedAt, discoveryDismissedAt }`.
  - `startedAt`: the **explicit-engagement** marker — set when the user opens the pack / acts inside it / auto-ranks it. Separates a *started* pack from a merely *discovered* one (see below).
  - `packVersionSeen`: the `version` the user last engaged with; if the pack's `version` is newer and adds unhandled movies, the pack resurfaces.
  - `lastIndex`: auto-mode cursor for resume.
  - `completedAt`, `discoveryDismissedAt`: timestamps for the completed state and for dismissing a discovery nudge.
- `updated_at` for the timestamp-guard merge.

**Key insight — progress is derived, not stored.** A pack movie is "handled" iff its `tmdbId` is in the user's ranking, watch list, or not-interested list. (No "skipped" — see decision 3.) So the client computes `handled / total` live from data it already has. The only *new* persisted state is `startedAt`, `packVersionSeen`, the auto cursor, and the two timestamps. This keeps the feature light and avoids drift.

**Derived status** (computed, not stored as a field):

- `completed` — every movie handled.
- `started` — `startedAt` set, not complete (the user explicitly chose this pack).
- `discovered` — `startedAt` *not* set, but `handled > 0` from organic ranking. The user never opened it; they just happen to have ranked some of its movies. Surfaced softly (see "Organic pack discovery"), **not** treated as an in-progress commitment.
- `not_started` — `startedAt` not set and `handled == 0`.

The `started` vs `discovered` split is the whole point of the discovery feature: only `started` packs are "things I'm working on"; `discovered` packs are gentle invitations.

## Pack authoring (pre-fabricated, offline)

All packs are built offline and uploaded — there is **no live generation**. A small authoring tool (Deno/Node script, service-role key in env, **never** in the client):

- Takes a curated list of titles (from anywhere — TMDB discover/credits, Wikipedia award lists, critic canons, hand lists) and resolves each to a TMDB record (`tmdbId`, title, year, posterPath) via the TMDB API.
- Applies the size/quality rules from decision 9: full canonical set for finite packs (director, franchise), but split overly-large sets into sub-packs; soft cap ~30 (~50 hard guideline); vote-count floor on broad criteria packs so they're recognizable, not exhaustive dumps.
- Upserts the `suggestion_packs` row, setting `movies`, `provenance`, and bumping `version` if contents changed.

**Updates / resurfacing** are also offline: when a pack should change (a director's new film, an awards cycle), re-run the authoring tool for that pack and re-upload with a bumped `version`. Clients that had completed it see the new `version` > `packVersionSeen`, with new unhandled movies → it resurfaces. No scheduled jobs required.

Seeding the library (target ~50+) is real, ongoing curation work — an AI-assisted authoring pass per category. Budget for it explicitly.

> No-secrets rule: TMDB key and service-role key stay in the authoring tool's env, never in `app.js`. The client reads packs with the public anon key + RLS read policy only.

## UX

### Entry point & visual treatment (decided: a fourth panel above the three suggestion sections)
Packs get a **new fourth panel above** Inspired by / All-time essentials / Popular now — visually a notch more substantial than those lists, but still subtle. It does not replace them; it leads. Treatment options for the panel (open to taste):

- A **horizontal scroll row of pack cards** with small poster-collage covers and a progress chip — feels like a "shelf" of projects, distinct from the vertical suggestion lists. (Lean.)
- A **slightly elevated panel** (own border/background accent, a quiet "PACKS" eyebrow label, marginally larger cards).

The panel shows a **relevant subset** of packs, not the whole library — ordered: started/in-progress (incl. resurfaced) → **discovered** (head start from organic ranking; softer styling) → a few suggested not-started → with completed tucked away. Each card: cover, title, subtitle, progress chip ("Not started" / "12 / 20 ranked" / "Completed" / "★ New movies").

A **"View all packs"** button opens a browse window with **filtering** (by category, maybe by progress) to find packs by interest. This full browse/filter UI is a **later wave** — v1 can ship with just the relevant-subset panel and a simple "view all" list.

### "Your packs" surface — one home for unfinished business (resume + discovered + updated)
Because auto mode is an open-ended sitting (decision 5), packs with unfinished business must be effortless to return to. This is the surface Dan floated as "a side panel or something." It holds **three distinct states, each with its own subtle treatment** — implemented either as a few labeled sub-sections or as one list sorted by state with per-state badges:

1. **In progress — explicitly started** (`startedAt` set, not complete). Primary treatment. "Continue · 12/20", drops you on the next unhandled movie. State saved continuously (`startedAt`, `lastIndex`, derived handled set), so resume is one tap.
2. **Discovered — you ranked a movie that's in them** (`startedAt` unset, derived `handled > 0` from organic ranking, not dismissed). Softer, quieter treatment — an invitation, not a commitment: "You've already ranked 4 of these · Jump in?". Opening it promotes it to in-progress. (Defined in *Organic pack discovery*.)
3. **Updated since you finished — resurfaced** (was completed; pack `version` > `packVersionSeen` adds new unhandled movies). Treatment: "★ Updated · 3 new to rank". (Defined in *Completion & resurfacing*.)

Suggested ordering as a single list: in progress → updated/resurfaced → discovered (softest, last). As sub-sections: **"Pick up where you left off"** / **"New in packs you've finished"** / **"You've already started these"**. The three derived statuses (`started` / `discovered` / `completed`-but-resurfaced) come straight from the data-model status logic, so this surface is just presentation over state the client already computes.

This is the same set of states the main packs panel orders to the top; the "Your packs" surface is the focused, always-reachable version of it.

### Pack detail
Opens a pack: its movies as suggestion cards, each showing its state (unhandled, or "Ranked #14" / "Saved" / "Hidden"). Per-card actions: **Rank**, **Save**, **Hide**, info → detail pane. Handled movies drop off (or grey out behind a "show handled" toggle); movies the user doesn't act on simply remain. A header progress bar and a prominent **"Auto-rank this pack"** button.

### Modes
- **Browse:** pick movies from the pack in any order; each Rank/Save/Hide removes it from the remaining set. Reuses existing card interactions. Not acting on a movie just leaves it there.
- **Auto:** feeds the remaining (unhandled) movies one at a time into the comparison flow. After each ranking resolves, auto-advance to the next; show "3 of 20". A per-movie **"Skip for now"** is just transient navigation — it advances to the next movie and leaves the current one unhandled in the pack (nothing stored). Cancel returns to pack detail with progress saved (`lastIndex`). Hook into the existing post-ranking completion path to advance. Honor the existing "hide suggestions/UI during comparison" behavior.

### Completion & resurfacing
Finishing the last movie → celebratory "Pack complete" state, recorded with `completedAt`. Completed packs live in a "Completed" area. If the pack's `version` later advances (offline re-curation) with new unhandled movies, it flips back to started/in-progress and resurfaces with a "New movies added" badge.

## Organic pack discovery (reverse surfacing)

When a customer ranks a movie *organically* (not from inside a pack) that happens to belong to one or more packs, gently surface those packs as ones they might want to jump into. Because progress is derived, such a pack already shows a real head start ("you've ranked 4 of these"), which makes the nudge feel earned rather than salesy.

**This is deliberately softer than an explicitly-started pack.** A discovered pack:
- is **not** marked `started` (no `startedAt`), so it never clutters the "things I'm working on" area;
- never auto-starts or pulls the user into a flow;
- is dismissible, and a dismissal (`discoveryDismissedAt`) stops the nudge for that pack.

**Reverse lookup (movie → packs).** Need "which packs contain `tmdbId` X." Options:
- *Client-side index (recommended for v1):* packs are public and not enormous; load a lightweight `{ slug → Set<tmdbId> }` index once (either the full pack rows or a slim `pack_index` view exposing just `slug` + `movie_ids`) and compute membership in JS. No per-rank query.
- *Server-side containment:* `select slug,title from suggestion_packs where movies @> '[{"tmdbId": X}]'` with a GIN index — fine if the library grows large enough that shipping an index to the client is wasteful.

**Surfacing, kept non-pushy:**
- After ranking a movie, if it belongs to undiscovered/un-dismissed pack(s), show a quiet, dismissible hint near the existing add-feedback toast — e.g. *"Fight Club is in 2 packs: 1999 · Best Picture nominees → Explore"*. Non-modal, trivially ignorable.
- In the packs browser, a soft **"You've already started these"** row (distinct styling from explicitly-started packs) listing discovered packs with their derived progress.
- **Frequency-cap it:** don't nudge on every rank. Prefer packs where the head start crosses a threshold (≥ N or ≥ X% already handled), nudge at most occasionally, and respect per-pack dismissals and a global "stop suggesting packs" preference.

Opening a discovered pack (or acting on the nudge) is what promotes it to `started` (sets `startedAt`) — at which point it behaves like any explicitly-chosen pack.

## Pack taxonomy (think meta first)

Decision 4 says enumerate categories, then fill them. The `category` column groups these for browse. Each category easily yields several packs, so ~50+ is comfortable.

- **Director** — Wes Anderson, Tarantino, Nolan, Kubrick, Greta Gerwig, Bong Joon-ho, the Coens, Villeneuve, Jordan Peele, Scorsese, Spielberg, Miyazaki…
- **Actor / star** — a star's essential roles (DiCaprio, Denzel, Toshiro Mifune, Saoirse Ronan, Florence Pugh…).
- **Single year** — 1999, 1994, 2007, 1939… ("the year that broke cinema" framing).
- **Decade** — 1970s New Hollywood, 1980s blockbusters, 1990s indies, 2010s A24-era.
- **Genre** — horror, sci-fi, rom-com, western, musical, noir.
- **Micro-genre / sub-genre** — neo-noir, folk horror, heist, slasher, courtroom drama, one-location thriller, time-travel, body horror.
- **Awards** — Best Picture winners, Best Picture nominees, Best Director winners, acting-Oscar winners, Palme d'Or, Cannes/Venice/Berlin top prizes.
- **Franchise / saga / universe** — Star Wars, MCU, James Bond, Alien, Mission: Impossible, LOTR/Hobbit.
- **Studio / label** — A24, Pixar, Studio Ghibli, Blumhouse, Criterion staples, Disney Renaissance.
- **National cinema / country** — Korean New Wave, French New Wave, Italian neorealism, Japanese classics, Bollywood essentials.
- **Source / format** — animation, stop-motion, documentaries, silent era, black-and-white, foreign-language gateways.
- **Based on** — book adaptations, true stories, comic-book movies, video-game movies, remakes vs originals.
- **Canon / lists** — AFI Top 100, Sight & Sound greats, IMDb Top 250, "film literacy 101", "before you die" sets.
- **Mood / vibe** — comfort rewatches, tearjerkers, feel-good, mind-benders, cozy rainy-Sunday, date night, "turn your brain off".
- **Occasion / seasonal** — Halloween horror, Christmas movies, summer blockbusters, New Year's.
- **Collaborations / pairings** — Scorsese × De Niro, Burton × Depp, director-composer or director-DP pairs (Deakins-shot, Zimmer-scored, Williams-scored).
- **Runtime / shape** — under-90-minutes, 3-hour epics, single-take/long-take, ensemble casts.

## Suggested phasing

- **Phase 0 — data + seed + authoring tool.** `suggestion_packs` table + RLS read policy; the offline authoring script; a first batch of hand-curated packs (one or two per several categories) inserted. Client read path.
- **Phase 1 — the panel + browse mode.** The fourth packs panel (relevant-subset, with the entry treatment) + a simple "view all" list, pack detail with Rank/Save/Hide, derived progress, the "Continue [pack]" resume affordance, `pack_progress` persistence (Supabase + localStorage + merge). No auto mode yet.
- **Phase 2 — auto mode + organic discovery.** Sequential ranking through a pack (pack-curated order) with a cursor, continuous state-save + trivial resume, completion state, and "skip for now" navigation. Add the reverse index + the "discovered" panel bucket (cheap, since derived progress already exists) and the dismissible post-rank nudge.
- **Phase 3 — scale the library + resurfacing.** Curate toward ~50+ across the taxonomy; wire the `version` > `packVersionSeen` resurfacing + "New movies added" badge; offline re-curation workflow for updates.
- **Phase 4 — "View all packs" + filtering, and polish.** The full browse window with category/progress filters, featured row, search, nicer covers.

## Open questions

None outstanding — all product and implementation defaults are settled in the Decisions section above. Use judgement on incidental details and surface anything that genuinely blocks.

## Acceptance criteria (v1 = Phases 0–2)

- A fourth packs panel sits above the three suggestion sections (distinct, weightier-but-subtle), shows a relevant subset with per-pack progress at a glance, and has a "View all packs" entry.
- Opening a pack shows its movies with current state; handled movies drop off; un-acted movies remain.
- Rank / Save / Hide from within a pack work and persist (and reuse the existing ranking + queue paths — no duplicate logic).
- Auto mode ranks each remaining pack movie in turn (pack-curated order), with no cap, supports "skip for now" (transient), can be cancelled, saves state continuously, and resumes one tap away on the next unhandled movie.
- Started and completed packs are remembered across sessions (signed-in via Supabase, signed-out via localStorage, merged on sign-in).
- Movies already in the user's list/queues before opening a pack are correctly shown as handled.
- Organically ranking a movie that's in a pack surfaces that pack as **discovered** (with its real head start), softly and dismissibly — distinct from packs the user explicitly started, and never auto-starting one.
- No secrets in the client; pack reads use anon key + RLS.

## Why this may be worth doing

- Directly fixes the weakest surface (what to rank next) with finishable goals.
- Almost entirely assembles existing systems (ranking, queues, TMDB, dedup).
- Infinitely extensible content we control; great re-engagement hook (resurfacing, discovery).

## Why this may not be worth doing

- Authoring + curating ~50+ good packs is real, ongoing work, not a one-time build.
- Pre-fab updates are manual (re-curate + re-upload) — fine at this scale, but it's a content chore.
- Risk of overbuilding before validating that people want "projects" vs. free-form adding.
