# Rank Bar density follow-up

Status: **bounded fixes shipped; both private briefs approved; approved Rank,
Ranking, and You redesign implemented and verified; private responsive
implementation review published (Jul 2026).**

This is the handoff record for the first review of the shipped Rank Bar density
redesign. It supplements, and does not replace,
`notes/feature-ideas/rank-bar-density-redesign.md`.

## Baseline

- Production commit: `79a62329eaeef851a93672db3f6d61bc9b9f4479`
  (`Fix iPhone Rank shelf scrolling`).
- Earlier redesign commits:
  - `948c97d` — `Replace Rank hero with compact Rank Bar`
  - `2a5e308` — `Add Rank Bar density design brief`
- Production CSS cache key: `styles.css?v=152`.
- Production app: <https://www.stackrankapp.com/movies>
- Approved private brief:
  <https://stackrank-density-brief.danbretl.chatgpt.site>
- Brief source: `density-design-brief/`.
- Earlier home-strategy source: `design-review-site/`.
- Original desktop problem capture:
  `/Users/danbretl/Desktop/Screenshot 2026-07-10 at 5.41.39 PM.png`.
- Responsive evidence: `debug/screenshots/latest/`.
- Full E2E evidence, including Ranking layouts:
  `reports/e2e/latest/screenshots/`.
- The worktree was clean when this feedback was reviewed.

Treat the shipped Rank Bar implementation as the baseline. Do not restore the
old hero or casually undo unrelated action-first work.

## Product guardrails that remain approved

- Keep `Rank / Ranking / Lists` until an approved follow-up design explicitly
  renames the third destination.
- Rank remains the action launchpad; Ranking remains the ordered artifact.
- Packs and individual movies remain equally first-class ranking entry points.
- Keep six rotating packs and all three individual suggestion sources.
- Preserve one search input, autocomplete/combobox accessibility, comparison
  and placement flows, first-run activation, pack actions/progress, suggestion
  actions, overlays, persistence, telemetry, and phone-landscape behavior.
- Preserve the bounded flex scrollports, no snap-back behavior, and iOS momentum
  scrolling shipped in `79a6232`.
- Do not add a framework, build system, or app dependency.

## Complete review feedback

1. Increase the header wordmark and tab font sizes. Add `MOVIES` beside
   `STACKRANK` in a slightly more charcoal color.
2. Make the search action more prominent. Center a max-width group containing
   the `Rank another` label and search field; probably center placeholder and
   entered text too. Explore three sizes—slightly bigger, significantly bigger,
   and purposefully oversized—and evaluate resting, focused/typed, loading, and
   results states together and separately. Celebrate the hero action without
   returning to the old ceremonial hero.
3. The suggested-movie area still has many boxes within boxes. Explore whether
   containment can be reduced, but do not change it casually.
4. Hover/lifted elements often lose their top one or two border pixels because
   an ancestor clips them. Audit and fix this systematically.
5. The first pack card's left double keyline and last card's right double
   keyline are clipped at the shelf edges.
6. Home pack cards use space inefficiently. `Start`/`Continue` is repeated in
   the status and explicit action. Explore ways to combine state, progress, and
   affordance. The whole card is already the button, so a separate visible
   button may be unnecessary.
7. Canceling a comparison started from a suggested movie must preserve the
   exact suggestion set instead of refreshing it.
8. Explore progress that distinguishes ranked, saved, and hidden movies. Also
   compare a circular indicator with the horizontal bar.
9. Explore a keyboard shortcut that focuses movie search, with a visible hint
   at the field's right edge on keyboard-capable layouts.
10. The Desktop Ranking page wastes too much space. Produce responsive design
    treatments for Desktop, iPad, and iPhone like the earlier home-page briefs.
11. Remove or replace the circular `>` action on mobile pack cards; this is
    coupled to the pack-card work in items 6 and 8.
12. Fix the clipped thick primary border around `Rank` in mobile suggestion
    cards.
13. Show the total number of ranked movies near the top of the Ranking page.
14. Deeply redesign the Ranking list's responsive action behavior. The current
    actions change too strangely as a Desktop window narrows. Review row
    actions, header actions, mouse drag, keyboard reorder, touch Move mode,
    overflow menus, size, and input modality while changing as little as
    necessary to make every state coherent.
15. Keep the same movie search control available on Ranking and Lists. The
    Ranking-page `Add` action should then disappear permanently.
16. Move `Your taste` out of Ranking, probably into a generalized and renamed
    third destination that contains more than watch/hidden lists.
17. Move `Recently ranked` elsewhere. Explore a compact reminder near the top
    of Rank versus ownership by the generalized personal destination.

## Synthesized workstreams

### Global shell and Rank Bar prominence

Feedback items: 1, 2, 9, 15.

- Enlarge the brand/navigation typography and add the charcoal category label.
- Explore a centered, bounded, more prominent Rank Bar without recreating the
  old oversized panel.
- Model all search states, not only the empty field.
- Explore a visible keyboard shortcut.
- Determine how one real DOM input can remain available across all normal
  destinations while remaining hidden during comparison/overlay takeovers.

### Visual integrity and containment

Feedback items: 3, 4, 5, 12.

- Remove clipped keylines caused by hover translation, overflow clipping, and
  edge-aligned scroll rails.
- Fix mobile primary-action clipping.
- Explore fewer suggestion surfaces only after comparing clear alternatives;
  interactive cards must retain meaningful boundaries.

### Pack-card efficiency and progress

Feedback items: 6, 8, 11.

- Eliminate repeated state/action copy.
- Remove the mobile circular arrow treatment.
- Compare compact horizontal, circular, and segmented progress treatments.
- Keep the whole card accessible and visibly interactive even if it no longer
  looks like a card containing another button.

### State continuity

Feedback item: 7.

- Preserve suggestions after cancellation and add a regression test that fails
  on the current behavior.

### Ranking and personal-space architecture

Feedback items: 10, 13, 14, 15, 16, 17.

- Redesign Ranking density and actions across Desktop, iPad, and iPhone.
- Surface the total count.
- Define stable width-driven composition plus modality-driven interaction.
- Add the shared search surface and remove `Add`.
- Rename/generalize the third destination and place Taste Explorer and Recently
  ranked deliberately.

## Findings from the current implementation

- `cancelComparison()` currently calls `updateSuggestions()` unconditionally.
  This directly explains feedback item 7. The existing DOM/state can be
  preserved on cancellation instead.
- A home pack card is already one semantic `<button>` created by
  `createPackCard()`. Its inner `.pack-card__action` is only a visual span.
- Pack progress is derived from all handled movies: ranked, Watch next, and Not
  for me. The home card currently labels that aggregate as `X of Y ranked`,
  which is inaccurate whenever saved or hidden movies contribute.
- Pack completion currently means every pack movie has been handled, not that
  every movie has been ranked. Preserve that behavior unless an approved
  product decision changes it.
- The mobile suggestion action group uses `overflow: hidden` around a primary
  action with an inset keyline, which is implicated in the clipped Rank
  treatment.
- Hoverable cards translate upward inside containers with tight overflow/edge
  bounds, which is implicated in the missing top and side keylines.
- Search currently lives inside the Rank-only `.stack`; Ranking and Lists hide
  that stack. Making search global should reuse/move this one control rather
  than duplicate it.
- Ranking action behavior is spread across width and modality queries. At
  different thresholds labels disappear, Add/Move appear, row actions collapse
  into overflow, and Share disappears below 400px. This needs one deliberate
  interaction contract rather than more patch overrides.
- Taste Explorer and Recently ranked currently live in the Ranking
  `.side-stack`; their relocation is an information-architecture change, not a
  CSS-only reorder.

## Straightforward implementation tranche

These outcomes are sufficiently specified to implement before approving new
design directions:

1. Preserve the current suggestion set after canceling suggestion-origin
   ranking; add focused E2E regression coverage.
2. Audit and fix the known clipped hover/keyline cases, including pack shelf
   edges and mobile suggestion Rank actions. Verify fine-pointer hover, iPad,
   iPhone portrait, and phone landscape without regressing shelf scrolling.
3. Apply a calibrated header type increase and add the charcoal `MOVIES` label.
4. Add the ranking total near `Current ranking` in a form that can survive the
   later page redesign.

Suggested commits:

1. `Preserve suggestions after canceled ranking`
2. `Polish Rank and Ranking chrome`

Run `npm run verify`, inspect focused responsive screenshots, commit the
intentional files directly to `main`, and push. The requested push will enter
the normal connected Vercel workflow; do not invoke a separate manual
deployment unless explicitly requested.

## Design explorations to create before implementation

### Brief A: Rank surface refinement

Create a private responsive brief that shows:

- slightly bigger, significantly bigger, and purposefully oversized Rank Bars;
- resting, focused, typed, loading, results, and error states;
- centered versus mixed-alignment text treatments;
- brand/category typography and shortcut treatments;
- lower-containment suggestion-lane alternatives;
- multiple pack-card state/action treatments;
- horizontal, circular, and ranked/saved/hidden segmented progress;
- Desktop, iPad portrait/landscape, and iPhone portrait/landscape adaptations.

### Brief B: Ranking and personal-space redesign

Create a private responsive brief with at least three coherent directions for:

- Desktop/iPad/iPhone Ranking composition and density;
- count placement and search placement;
- header action hierarchy at representative widths;
- mouse drag, keyboard reorder, touch Move mode, and overflow behavior;
- keeping the visual model as stable as possible across widths;
- removing Add once shared search exists;
- renaming/generalizing Lists;
- relocating Taste Explorer and Recently ranked.

Commit/push each brief and present its private review URL. Do not implement the
unapproved design directions in the production app.

## Delivery record

The bounded implementation tranche is complete on `main`:

- `49fcbdd` — `Preserve suggestions after canceled ranking`
  - preserves the exact rendered suggestion set when canceling a
    suggestion-origin comparison;
  - adds an E2E regression that verifies titles and suggestion request counts.
- `0c1d441` — `Polish Rank and Ranking chrome`
  - fixes the known pack-shelf and mobile suggestion keyline clipping without
    changing the shipped phone flex shelves or momentum scrolling;
  - increases header typography, adds the charcoal `MOVIES` category label,
    and shows the ranking total beside `Current ranking` with a narrow-phone
    stacked form;
  - adds responsive assertions for typography, count placement, edge hover
    paint, shelf insets, and the mobile Rank keyline.

Validation passed with `npm run verify`: 231 Node tests, 21 Deno edge-function
tests, pack validation, syntax/cache checks, and all 29 E2E browser flows. The
latest E2E evidence is in `reports/e2e/runs/2026-07-11T062703Z/`; focused
Desktop, iPad portrait/landscape, and iPhone portrait/landscape captures were
reviewed for the changed surfaces.

The two requested explorations are also complete, committed, and privately
published:

- `7738cdb` — `Add Rank surface refinement brief`
  - source: `rank-surface-refinement-brief/`
  - review: <https://stackrank-rank-surface-brief.danbretl.chatgpt.site>
- `57418f6` — `Add Ranking personal space brief`
  - source: `ranking-personal-space-brief/`
  - review: <https://stackrank-ranking-personal-brief.danbretl.chatgpt.site>

The design review is now complete. The approved implementation direction is:

- Rank owns movie search and the repeatable rank/discover loop. Its v1 uses a
  72px desktop Rank Bar, `/` shortcut, ruled suggestion lanes, simplified
  whole-card packs with segmented ranked/saved/hidden progress, and a compact
  Recently ranked orientation rail.
- Ranking owns list viewing and management. The separate fullscreen mode is
  removed in favor of remembered Detailed, Posters, and Compact views on the
  native page. Display and filtering share one panel; Jump to rank is removed;
  reordering is disabled while filtered.
- Ranking action priority is active view, Move on touch, and Share, with Review
  order kept quiet near the title. Mouse drag works across items; touch uses
  explicit Move mode and handles; keyboard handles retain Arrow Up/Down.
- Search belongs to Rank for now. `/` from another normal destination returns
  to Rank and focuses it. Ranking does not carry a separate Add action.
- The third destination is `You` for v1. It is a fixed-order modular dashboard
  of Your progress, Tonight, Taste Explorer, and Watch next. Hidden movies are
  secondary management rather than a peer widget. Customization can follow
  only if usage justifies it.
- Taste Explorer moves to You; its ranking lens opens Posters with the native
  Ranking filter contract. Recently ranked moves to Rank only.

The requested post-implementation review artifact must use real responsive app
screenshots and zoomed views of the changed elements across Desktop, iPad
landscape/portrait, and iPhone landscape/portrait.

Implementation verification passed with `npm run verify`: 234 Node tests, 21
Deno edge-function tests, pack validation, syntax/cache checks, and all 29 E2E
browser flows. The responsive capture matrix is archived under
`debug/screenshots/runs/2026-07-12T08-16-12Z-approved-redesign/`; a subsequent
focused iPhone-landscape capture verifies the corrected full-width Rank Bar.
Runtime cache keys are `app.js?v=186` and `styles.css?v=158`.

The screenshot-led implementation review is complete and privately published:

- app implementation: `5dd8a08` — `Unify Ranking and add You dashboard`
- brief source: `ranking-redesign-review-brief/`
- private review: <https://stackrank-ranking-you-review.danbretl.chatgpt.site>
- coverage: Rank, Ranking, Display & filters, Detailed/Posters/Compact views,
  reorder contracts, and You across Desktop, iPad landscape/portrait, and
  iPhone landscape/portrait using real app captures

The brief calls out the five highest-value review questions: whether Rank
creates the intended loop, whether `You` is the right name, whether the view
labels and action order are intuitive, whether Review order is quiet enough,
and whether the v1 You widget order is credible.

## Material product decisions for the briefs

1. The earlier brief's deliberately compact Rank Bar and its instruction not to
   add a shortcut are intentionally reopened by this feedback.
2. Decide whether centered alignment applies only while resting or also to
   entered text and result rows. Centered resting copy with left-aligned active
   scanning is a useful option to compare.
3. Compare `/` with `Command/Ctrl+K`. The former conflicts less with browser
   chrome; the latter is more familiar but more collision-prone.
4. Decide whether the shared Rank Bar uses identical label/geometry on all
   destinations.
5. Decide where a search-origin ranking returns after placement when initiated
   from Ranking or the generalized third destination.
6. Keep pack completion based on all handled states unless explicitly changed;
   decide how ranked/saved/hidden components are communicated.
7. Ensure a pack remains obviously clickable and keyboard-focusable after
   removing the inner button-like treatment.
8. Choose the third destination's name and ownership model.
9. Choose one home for Recently ranked, or define clearly different compact and
   full versions if it appears in two places.

## Recommended order

1. Complete, verify, commit, and push the straightforward tranche.
2. Create, verify, commit, push, and present the Rank surface brief.
3. Create, verify, commit, push, and present the Ranking/personal-space brief.
4. Wait for explicit design approval.
5. Implement the approved Rank/pack direction.
6. Implement the approved Ranking/navigation direction with full responsive,
   modality, accessibility, and regression coverage.
