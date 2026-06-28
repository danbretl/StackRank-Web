# Feature idea: First-run quick start

Status: **exploratory — documented Jun 2026.**

## Summary

Give people with an empty ranking two direct ways to reach StackRank's useful
state:

- **Start with a movie pack** — open a small, approachable starter pack and let
  the existing Rank/Save/Hide flow do the work.
- **Import an existing ranking** — open the shipped title-list import flow
  directly instead of making a new user discover it inside Settings.

Keep the title field as the primary action. The quick start is a compact
empty-list aid, not a setup wizard or product tour.

## Problem

The empty state currently explains where to type a movie, but it does not set
expectations for the core interaction or expose the fastest paths to a useful
list. The first movie is inserted immediately; the product's defining
comparison flow only becomes visible after adding a second movie. A new user can
therefore add one title and still not understand what StackRank does.

The app already has the two strongest activation tools:

- curated packs that provide a finite project and remove "what should I add?"
  friction;
- ordered-title import for people who already maintain a ranking elsewhere.

Both are harder to discover than the title input during the first session.

## Proposed first version

When the ranking is empty, show a compact quick-start block near the title
field:

1. A one-sentence explanation:
   `Add two movies, then choose between them. StackRank finds the exact order.`
2. A primary or equal-weight action:
   `Start with a movie pack`
3. A quieter secondary action:
   `Import an existing ranking`

`Start with a movie pack` should open an intentionally small starter selection,
not the full 100+ pack browser with no guidance. Candidate starter packs should:

- be recognizable without assuming one specific taste;
- contain roughly 8–15 movies;
- span more than one era or genre;
- already exist in the curated library whenever possible.

The pack action may either open a small chooser or open one rotating/recommended
starter pack. Prefer the chooser if a single default feels editorially narrow.

`Import an existing ranking` should call the existing `openTitleImport()` flow.
Do not create a second import implementation.

After the first movie is ranked, the quick-start block can collapse to a small
prompt explaining that adding one more movie starts comparisons. Once the list
contains two movies, remove the first-run treatment entirely.

## Placement and hierarchy

- Keep the existing title input visually dominant and first in keyboard order.
- Place the quick-start block directly below the input and above suggestion
  sections.
- On mobile, actions must remain thumb-friendly without pushing the first useful
  pack/suggestion content far below the fold.
- Do not add a carousel, multi-step modal, coach marks, or a dismissible tour.
- Do not require sign-in.

## Reuse

This should be mostly wiring:

- existing pack browser/detail and Rank-all flows;
- existing title-import overlay and matching logic;
- existing empty-ranking state;
- existing suggestion-card and button styles;
- the shipped privacy-bounded product instrumentation layer.

No schema or persistence changes should be required.

## Measurement

Assess activation as a small funnel, without titles, TMDB ids, emails, or raw
user ids:

- empty-session quick start shown;
- pack quick start opened;
- import quick start opened;
- first movie ranked;
- first comparison started;
- second movie placed;
- five movies ranked in the same local session.

Compare the source of the first ranked movies (`search`, `pack`, `import`) and
the rate at which an empty session reaches two and five ranked movies. If the
quick-start actions receive little use or do not improve completion, remove or
demote them rather than expanding onboarding.

## Why this may be worth doing

- Makes the binary-comparison value proposition visible earlier.
- Gives indecisive users a finite starting project.
- Gives experienced list-makers a fast path that respects work they already did.
- Reuses shipped systems instead of introducing onboarding-only machinery.
- Creates a clean activation funnel for evaluating future first-run changes.

## Risks

- Too much empty-state UI could compete with the simplest path: type a movie.
- A single featured starter pack could make the app feel narrower than it is.
- Import is powerful but visually heavy; it should remain secondary to starting
  naturally.
- Pack data loads asynchronously, so the starter action needs a stable loading
  and fallback state.

## Acceptance criteria

- With an empty ranking, the user sees a concise explanation of when
  comparisons begin.
- The user can open a starter pack or title import directly from the empty state.
- The normal title input remains the most prominent and first-focus action.
- The quick-start treatment disappears once the ranking has at least two
  movies.
- The feature works signed out and does not create new stored state.
- Desktop and mobile layouts avoid overlap, excessive height, and keyboard
  focus traps.
- Instrumentation measures the activation funnel without collecting movie or
  identity data.
