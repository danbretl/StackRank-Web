# Social features (friends, shared rankings, friend packs)

**Status: parked — explicitly "someday, not now"** (Catie). Captured here so the idea isn't lost and so we design current features without painting ourselves into a corner.

Note: public read-only snapshot links now ship separately via Share Studio and `/s/:slug`. Those links are opt-in, unlisted, revocable, and contain a static snapshot rather than any account-to-account relationship. This note remains about the larger friend graph: profiles, consented friend access, per-title comparison, and friend-derived packs.

## The vision

StackRank today is single-player: your list, your queues, your packs. The social layer turns it into something you do *with* people:

1. **Friends** — find/add friends (by handle, email, or invite link); accept/decline; a friends list.
2. **See a friend's ranking** — view any friend's full stack-ranked list (read-only), ideally with the same poster/list presentation as your own.
3. **Compare on any title, in zero-to-one clicks** — anywhere you've ranked a movie (ranking row, detail pane, recently-ranked), surface where your friends ranked it. "You: #4 · Catie: #1 · Sam: #12." This is the killer interaction — instant taste comparison on shared films.
4. **A friend pack per friend** — every friend automatically becomes a suggestion pack containing all the movies they've ranked, so you can work through a friend's taste the same way you work through a curated pack. Reuses the entire pack browse/detail/Rank-all flow.

## Why it's a big build (and why it's later)

- **Identity & sharing model.** Today data is per-user (`user:<auth.uid()>`) and **private by RLS**. Social requires a sharing/visibility model: which users can read which lists, friend-request state, and per-list or per-account privacy. New tables (`friendships`, maybe `profiles` with a public handle) and **new RLS policies that intentionally expose data to non-owners** — a meaningful security surface to get right (the current policies are strictly owner-only; don't loosen them casually).
- **Read paths for other users' data.** `loadRanking`/`mergeRankings` assume one owner. Friend views need read-only fetches of *another* `list_id`, plus the `movie_lists` queues if those are ever shown.
- **Auth maturity.** Magic-link auth is origin-scoped and email-only today; social implies profiles, display names, discoverability, and abuse/blocking considerations.
- **Privacy & consent.** Rankings can be personal. Need explicit opt-in to be visible, granular controls, blocking, and a clear story for what a friend can/can't see.
- **Scale/ranking-merge questions.** A friend pack derived from a large list needs the same dedupe/identity logic (`tmdbId` + title/year fallback) we already use — reusable, but worth confirming at friend-list scale.

## What we already have that helps

- **Pack infrastructure** — a "friend pack" is mostly a pack whose `movies` come from a friend's ranking instead of curation. Browse/detail/Rank-all/progress/Share all reuse.
- **Insight engine** — `getRankingInsights()` could power "how your tastes compare" summaries.
- **Identity/merge logic** (`lib/movie.js`, `lib/persistence.js`) — stable movie identity for cross-user comparison.
- **Detail pane & recently-ranked surfaces** — natural homes for the "friends' ranks of this title" chip.

## Suggested phasing (when we pick it up)

1. **Profiles + handles + privacy flag** (account is public/discoverable or not). Foundation; no social UI yet.
2. **Friendships** (request/accept, list, block) with RLS that exposes a ranking only to accepted friends of an opted-in user.
3. **Read-only friend ranking view** (reuse the full-screen ranking view from `ranking-fullscreen-view.md`).
4. **Per-title comparison chip** in detail/ranking/recently-ranked.
5. **Auto friend packs** built from a friend's ranking, slotted into the existing pack browser (clearly sourced/attributed).
6. Later: activity feed, notifications, group/blended rankings, "rank this with a friend" co-sessions.

## Design guardrails (decide before building)

- Default to **private**; sharing is opt-in and reversible.
- Never surface a friend's list without their consent, and make "what friends can see" obvious.
- Keep the comparison framing about *taste*, not leaderboards/competition — StackRank is personal preference, not consensus (same reason we don't show TMDB ratings).
- Reuse pack/list presentation rather than inventing a parallel UI.
