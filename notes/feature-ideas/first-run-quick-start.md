# Feature idea: First-run quick start

Status: **shipped (2026-06-28, product commit `bc44eab`).**

## What shipped

- With an empty ranking, a compact inline explanation directly below the title
  field says when comparisons begin and why they produce an exact rank.
- The existing pack shelf becomes a starter shelf with three deliberately
  different, approachable choices: Fan Favorite Core, Studio Ghibli Gateways,
  and Black Cinema Essentials. It falls back deterministically if one is
  unavailable.
- A secondary `Import a ranking` action opens the existing title-import flow
  and returns focus to the same trigger when dismissed.
- After one movie, the block collapses to one instruction: add another movie
  to start comparing. At two movies it disappears.
- Autocomplete now releases focus both immediately and after click activation,
  preventing the mobile keyboard from reopening after a placement.
- `lib/ftue.js` owns the pure state/copy and starter-selection rules.
  `tests/ftue.test.js` covers state progression, curated ordering, deterministic
  fallback, filtering, and non-mutation.
- The browser suite covers empty → import open/close → starter pack open/close →
  first movie → first comparison → second placement, including focus return,
  input blur, cache keys, a 390×844 geometry pass, screenshots, and clean
  runtime health.

The implementation follows the research-backed constraint that onboarding
should be contextual and interactive, not a prerequisite tour: Apple recommends
teaching through real actions and placing tips near the relevant interface;
GOV.UK start guidance recommends only enough context to understand and begin;
empty-state guidance from Canva recommends concise, actionable copy; and WCAG
requires focus order to preserve meaning. Sources:
[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/onboarding),
[GOV.UK Design System](https://design-system.service.gov.uk/patterns/start-using-a-service/),
[Canva empty states](https://www.canva.dev/docs/apps/design-guidelines/empty-states/),
[WCAG focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).

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

## Measurement and decision contract

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

### Recorded baseline

The production baseline query was run immediately before rollout on
2026-06-28. It returned **0 instrumented empty sessions** because product
telemetry had only just shipped. There is therefore no honest pre/post control
cohort. The first rollout establishes StackRank's activation baseline; future
FTUE variants must compare against it.

### Metrics

The denominator is distinct page sessions with `quick_start_shown`.

| Metric | Definition | Initial success target |
| --- | --- | --- |
| First meaningful action | Search ranking starts at list size 0, starter pack opens, or quick import opens | ≥50% |
| First movie | `ranking_completed` reaches list size 1 | ≥45% |
| Core aha | The first comparison completes and list size reaches `2_4` | ≥35% |
| Useful list | Core aha, or an import completes with at least 2 movies | ≥40% |
| Five-movie depth | Ranking reaches `5_9`, or import completes with at least 5 movies | ≥15% |
| Time to useful list | Median minutes from `quick_start_shown` to useful list | ≤5 minutes |
| Meaningful actions | Median ranking completions, pack opens, and completed imports per exposed session | Record baseline; optimize upward |

Starter-pack and import-open rates are diagnostic path-adoption metrics, not
standalone success criteria. Low CTA use is acceptable if search-driven core
activation is strong.

These are provisional product thresholds, not industry benchmarks:

- **Success:** core aha ≥35%, five-movie depth ≥15%, and first action ≥50%.
- **Iterate:** core aha 20–34% or five-movie depth 8–14%, with evidence that a
  specific step or path is losing people.
- **Not successful:** core aha <20%, first action <35%, or more than 60% of
  first-movie sessions fail to complete the first comparison. Demote/remove
  underperforming FTUE UI before adding more onboarding.

Review on **2026-07-12** (14 days). Require at least 50 exposed empty sessions
for a preliminary call. If there are fewer, extend through **2026-07-28**
(30 days). A confident product decision should use at least 100 exposures;
smaller samples are directional and should be paired with observed usability.
The canonical SQL lives in
[product-instrumentation.md](product-instrumentation.md).

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
