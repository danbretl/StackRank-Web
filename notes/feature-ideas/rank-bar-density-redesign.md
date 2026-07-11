# Rank Bar density redesign

Status: **implemented and locally verified (Jul 2026); production QA is recorded in the delivery report.**

## Implementation outcome

- The existing Add/Search surface now renders as one 65–69px Rank Bar directly
  beneath navigation, with the single existing combobox preserved.
- The Discovery and pack-section shells are open canvas regions; interactive
  pack cards and individual suggestion lanes retain their meaningful surfaces.
- Desktop uses 24px working gutters and six packs in one row; iPad uses 20px
  gutters, a 52px search target, and a 3×2 pack grid; the phone shell uses 12px
  gutters, one 56px search target, and horizontally peeking pack/movie rails.
- Browser regression coverage now guards Rank Bar height/adjacency, first-pack
  position, open containment, one-input semantics, iPad touch targets, and
  autocomplete overlay behavior. The responsive screenshot harness covers all
  five required Desktop/iPad/iPhone orientations.
- Finishing or canceling ranking no longer allows deferred focus restoration to
  re-focus the title field and reopen the mobile software keyboard.

## Decision

Adopt **Option 2: The Rank Bar**, together with the responsive spacing system
from **Option 1: Calibrated compression**.

The prior action-first redesign remains the product foundation:

- `Rank` is the place to do the recurring action.
- `Ranking` is the resulting ordered-list artifact.
- `Lists` contains Watch next and Not for me.
- Packs and individual movies are both first-class ways to start ranking.
- The Rank page continues to show six fresh, rotating packs plus three
  individual-movie suggestion sources.

This work is a density and composition correction, not a product revert and not
another information-architecture change.

## Design references

- Approved private brief:
  <https://stackrank-density-brief.danbretl.chatgpt.site>
- Brief source (reference artifact, separate nested repository):
  `/Users/danbretl/src/stackrank/density-design-brief/`
- Desktop problem capture:
  `/Users/danbretl/Desktop/Screenshot 2026-07-10 at 5.41.39 PM.png`
- The action-first launchpad shipped in commit `1289cca`.
- The first design-review site is committed under `design-review-site/`.

The private brief is the visual source of truth for the approved direction.
This document is the implementation and acceptance source of truth when a
mockup simplification conflicts with real application behavior.

## Problem

The Rank page now prioritizes the correct task, but it uses landing-page or
hero-page spacing for a high-frequency work surface. On the supplied desktop
capture, most of the first 450 pixels are navigation, a centered heading, a
large bordered search container, and empty internal space. The next useful
choices arrive only after several nested containment layers:

1. page margin;
2. the large Add/Search panel;
3. the large Discovery panel;
4. the inset Pack section;
5. the actual pack cards.

The problem is not the search field's target size and not whitespace in
general. The problem is **ceremonial whitespace**: air and repeated boundaries
that delay a frequent action without clarifying the interface.

## Design philosophy

### Density follows frequency

Search, packs, and suggested movies are repeated working controls. They should
use utility/workspace spacing, not marketing-page spacing.

### One boundary per idea

A page panel, an inset section, and a row of cards should not all restate the
same grouping. Borders and white surfaces should identify a meaningful unit,
not every level of the DOM.

### Compress air, not targets

Mouse layouts may be visually compact. Touch targets must remain comfortable:
at least 48 pixels on iPad and 52–56 pixels for the primary iPhone search
control. Reclaim surrounding padding, duplicated headings, and redundant
wrappers before shrinking controls.

### The first viewport is a product budget

On a normal desktop viewport, the user should see the primary search action,
all six fresh packs, and the beginning of the individual-movie suggestions
without scrolling.

### Width and modality remain separate concerns

Available width determines composition and column count. Pointer capability
determines touch targets, hover, and drag affordances. Do not use coarse-pointer
queries to choose the page's column structure.

## Approved composition

### 1. Replace the Add hero with a Rank Bar

In the normal Rank-page state, search becomes a dedicated horizontal action
bar immediately below the global topbar.

- It spans the same working width as discovery content.
- It contains a compact `Rank another` label on desktop/iPad and the existing
  movie-search combobox.
- On iPhone, the visible label may disappear; `Search for a movie` and the
  accessible label provide enough context.
- The search field remains the visually strongest routine action, using the
  existing editorial keyline treatment.
- Do not add a keyboard shortcut merely because the concept mockup shows one.
- Do not duplicate the search control for sticky behavior. One DOM control
  should move/stick responsively so focus, autocomplete, and form state remain
  singular.

The existing IDs and behavior (`#movie-form`, `#title`, `#suggestions`) should
remain stable unless a change is demonstrably safer. The ARIA combobox
contract, keyboard navigation, debounce behavior, and click-to-rank behavior
must be preserved.

### 2. Let discovery become the page body

Remove the large outer white Discovery shell on the Rank destination.

- `Find something to rank` should no longer consume a large visible header
  row. It may become screen-reader-only if it remains useful as the section's
  accessible name.
- `Fresh movie packs` becomes the first visible content heading beneath the
  Rank Bar.
- Section headings sit directly on the page canvas.
- Individual pack and movie cards may remain white surfaces; their boundaries
  identify real interactive units.
- Avoid replacing the removed outer panel with another full-width inset card.

### 3. Preserve the wide top of the funnel

- Desktop: six packs in one row where width permits.
- iPad: three columns by two rows in both orientations when space supports it.
- iPhone: a horizontally scrollable/snap-friendly pack rail with a clear next
  card peeking into view.
- Keep `Refresh` and `View all packs` visible and understandable.
- Keep all three individual suggestion sources visible as parallel lanes on
  desktop and serial/rail layouts on smaller screens.
- Preserve the existing fresh-per-visit selection, continuation prioritization,
  progress, Rank/Save/Hide behavior, and async suggestion reasons.

### 4. Use the calibrated spacing system

These are target tokens, not a requirement to create duplicate variables when
an existing semantic token already serves the same role.

| Token | Desktop | iPad | iPhone |
| --- | ---: | ---: | ---: |
| Page edge | 24px | 20px | 12px |
| Section gap | 16px | 16px | 12px |
| Content/panel padding | 20px | 20px | 16px |
| Primary search target | 44–48px | 52px | 56px |
| Section radius | 16px | 16px | 0–14px |

Use the smallest spacing scale that preserves grouping. A single empty vertical
run between major Rank-page regions should normally not exceed 24 pixels on
desktop or iPad.

## Responsive behavior

### Desktop (large screen, keyboard and fine pointer)

- Keep the global topbar compact (currently approximately 64px).
- Place the Rank Bar directly under it; total Rank Bar height should normally
  stay at or below 72px.
- Use the full working canvas with modest 24px outer gutters. Do not reintroduce
  a 960px or 1200px content cap on the Rank launchpad when the viewport can
  support six useful pack cards.
- Align the Rank Bar, pack shelf, and individual suggestion lanes to a common
  content grid.
- Hover affordances remain gated to fine pointers.
- Autocomplete should overlay following content rather than pushing the pack
  shelf down while results load or change.

Design targets at a 1440×900 CSS-pixel viewport:

- top of the first pack cards at or above roughly 190px from the app viewport
  top;
- the full pack row plus the beginning of individual movie suggestions visible
  without scrolling;
- no large blank block between navigation, search, and packs.

Treat the numbers as regression targets with a small tolerance, not reasons to
break typography or content.

### iPad (large screen, coarse pointer)

- Keep the same hierarchy as desktop: topbar, Rank Bar, packs, movie lanes.
- Do not introduce the desktop-only side rail from design Option 3.
- The search target is at least 52px; other tap targets remain at least 48px.
- The Rank Bar may stick beneath the topbar as content scrolls, provided it does
  not duplicate the input, obscure autocomplete, or conflict with overlays.
- Use the width-based three-by-two pack layout rather than a pointer-based
  layout fork.
- Test portrait and landscape explicitly.

### iPhone (small screen, coarse pointer)

- Keep the current compact header and bottom `Rank / Ranking / Lists`
  navigation.
- Present one 56px search field immediately below the header; a separate large
  `Rank another movie` heading is unnecessary.
- The Rank Bar may remain sticky beneath the header while browsing discovery.
- Autocomplete must fit the visual viewport, respect safe areas, and appear
  above pack/movie content and below modal/overlay chrome.
- Packs remain a horizontal rail; suggestion sources stack vertically.
- Do not create horizontal page overflow.
- Phone landscape must continue to receive the existing mobile-shell treatment
  based on the combined width/height rule.

## Important application states

### Comparison and review

The normal-state Rank Bar must not weaken the comparison takeover.

- `body.is-comparing` continues to hide navigation and discovery and dedicate
  the viewport to the comparison flow.
- `#compare`, undo, cancel, Rank all, review Keep/Swap/End, scroll restoration,
  and keyboard/Escape behavior remain unchanged.
- It is acceptable for the same outer Add section to look like a compact Rank
  Bar normally and become the comparison surface in comparison mode.

### First-run states

Do not solve returning-user density by damaging activation for an empty list.

- Empty list: the Rank Bar may expand with the existing compact explanation,
  varied starter packs, and import path.
- One ranked movie: preserve the compact `add one more` guidance.
- Two or more ranked movies: no onboarding copy should reserve space beneath
  the Rank Bar.
- Even when expanded, first-run content should use the calibrated spacing scale
  and avoid recreating the current empty hero block.

### Detail, packs, Share Studio, full-screen ranking, settings, and auth

Preserve existing body-state visibility, stacking, scroll lock, focus, and
Escape behavior. Sticky Rank Bar chrome must sit below all overlays and must be
hidden whenever the existing flow requires the app shell to disappear.

## Accessibility requirements

- Preserve the search field's label, combobox roles, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, selected option semantics, and
  keyboard navigation.
- Keep a logical focus order: primary navigation, Rank search, pack actions,
  individual movie actions.
- Do not create two focusable copies of the search input.
- Preserve visible focus treatment and reduced-motion behavior.
- Keep touch targets at the sizes above; compact visual spacing is not
  permission to shrink hit areas.
- Ensure sticky elements do not cover the focused control when the viewport or
  software keyboard changes.

## Engineering guidance

This remains a static, framework-free application. Do not add a framework,
build system, or dependency for this work.

Likely touch points:

- `index.html`: semantic wrapper/label changes around the existing Add/Search
  and Discovery regions; preserve stable IDs.
- `styles.css`: Rank Bar, open discovery canvas, calibrated tokens, and the
  desktop/iPad/iPhone adaptations.
- `app.js`: only if small state/class changes are genuinely needed. Avoid
  rewriting working search, pack, suggestion, or comparison behavior.
- `tests/e2e.test.mjs` and/or the E2E harness: layout regression assertions and
  affected flow expectations.

Clean up stale `Discover`-era comments/selectors in the touched shell area when
safe. Avoid adding another large override layer whose only purpose is to fight
the previous phase's CSS.

No persistence, Supabase schema, edge-function, TMDB, telemetry event, or data
model change is expected. Existing ranking-start source attribution must remain
intact.

## Acceptance criteria

### Visual and responsive

- [ ] Normal returning-user Desktop Rank page no longer has a hero-sized Add
      panel or a large blank block above discovery.
- [ ] Desktop shows search, six pack choices, and the beginning of individual
      suggestions in a 1440×900 first viewport.
- [ ] Rank Bar and discovery sections share one clear content grid.
- [ ] Discovery no longer has redundant full-page white-panel containment.
- [ ] iPad portrait and landscape use comfortable touch targets and the 3×2
      pack layout without desktop-only hover assumptions.
- [ ] iPhone portrait and landscape use one compact search control, horizontal
      packs, stacked suggestion sources, and no page-level horizontal overflow.
- [ ] Empty and one-item first-run states remain understandable and useful.

### Functional regression

- [ ] Mouse, touch, and keyboard search/autocomplete still start ranking.
- [ ] Ranking completion returns to the Rank loop and placement feedback still
      offers `View ranking`.
- [ ] Pack refresh, View all, Start/Continue, Rank all, progress, Save, and Hide
      remain functional.
- [ ] All three individual suggestion sources refresh and retain Rank/Save/Hide
      behavior and explanation copy.
- [ ] Comparison, review, detail, full-screen ranking, Share Studio, queues,
      settings, auth, backup/import, and Escape behavior still pass.
- [ ] No new console errors or warnings in normal `?debug=1` QA.

### Tests and evidence

- [ ] Add or update a browser regression assertion that would fail if the
      hero-sized blank region returns. Prefer bounding-box/layout assertions at
      the existing desktop and iPad profiles with sensible tolerance.
- [ ] Update affected E2E selectors/expectations without weakening unrelated
      coverage.
- [ ] Run `npm run verify` successfully.
- [ ] Run responsive screenshots for at least desktop main, iPad portrait,
      iPad landscape, iPhone portrait, and iPhone landscape. Inspect them for
      density, clipping, overlap, overflow, and touch-target regressions.
- [ ] If JS or CSS changes, bump the corresponding cache-busting query string
      in `index.html`; ensure `npm run check:cache` passes.
- [ ] After production deployment, run `npm run test:production` and manually
      smoke `https://www.stackrankapp.com/movies?debug=1` at desktop plus at
      least one touch-sized viewport.

## Delivery requirements

The implementation session is authorized to complete the normal end-to-end
delivery workflow:

1. inspect the current clean `main` and preserve unrelated user work;
2. implement the approved direction;
3. validate and capture responsive evidence;
4. update this spec if implementation details materially change;
5. commit the intentional application/spec changes;
6. push `main` to GitHub;
7. ensure the matching commit reaches Vercel production (trigger a direct
   production deployment if Git integration fails or stalls);
8. run the production smoke suite and confirm the custom domain serves the new
   cache-busted assets.

Do not add the local nested `density-design-brief/` repository to the main
StackRank repository as a gitlink or ordinary directory. It is a private design
reference, not part of the production application commit.
