# StackRank UX design audit

## Document status

- **Initiative:** Core product design-system and experience redesign
- **Priority:** Critical
- **Product owner approval:** Approved in principle on 2026-06-30; minor adjustments may be made during implementation
- **Implementation status:** Phase 2 complete; ranking-first app shell and destination navigation established
- **Current phase:** Phase 3 — shared content components (ready, not started)
- **Last updated:** 2026-06-30
- **Source of truth:** This document governs the redesign unless a later product decision is recorded in the decision log

### Progress at a glance

- [x] Audit the existing desktop and mobile experience
- [x] Define the product outcomes and recommended visual direction
- [x] Receive approval for the ranking-first, editorial-monochrome direction
- [x] Create a phased implementation and verification plan
- [x] Generate and approve desktop/mobile visual reference concepts
- [x] Phase 1 — design foundations
- [x] Phase 2 — information architecture and app shell
- [ ] Phase 3 — shared movie and pack components
- [ ] Phase 4 — core ranking flows
- [ ] Phase 5 — discovery, lists, and Taste Explorer
- [ ] Phase 6 — overlay and workspace system
- [ ] Phase 7 — Share Studio controls
- [ ] Phase 8 — comprehensive responsive and regression QA
- [ ] Production release and post-release review

## Executive assessment

StackRank is functionally strong, fast, accessible, and unusually complete for a static app. The comparison experience is the design highlight, especially on mobile. The visual system around it has not kept pace with the product’s growth.

The central issue is not that the site looks bad. It is that it looks like a collection of well-made feature panels rather than one deliberately designed product. Rounded white cards, thin gray borders, pills, and small labels recur everywhere, but without enough hierarchy or a distinctive visual idea. The most memorable surfaces are currently the Share Studio artwork and the privacy-page hero—not the ranking experience itself.

My recommended direction is an **editorial ranking studio**:

- Monochrome, confident, and cinematic without film-reel clichés.
- Strong typographic hierarchy and oversized rank numbers.
- Poster artwork supplies the color.
- Black “ink” surfaces create deliberate focal points.
- Fewer containers, borders, shadows, and pills.
- The ranking—not discovery—is the visual and structural center of the app.

This preserves the original product taste while making StackRank recognizable rather than generically polished.

## The outcomes the design should optimize

The experience should help users:

1. Understand StackRank and rank their first two movies.
2. Make comparisons quickly and confidently.
3. See and trust the ordered list they are building.
4. Find worthwhile movies to rank next.
5. Feel rewarded by the accumulated ranking and share it.

The current design supports outcomes 1, 2, and 4 reasonably well. It weakens outcome 3 by visually demoting the ranking, and therefore also weakens the payoff in outcome 5.

## Highest-priority findings

### 1. The product hierarchy is inverted

On desktop, the add/discovery panel is 599 px wide and approximately 1,416 px tall in the audited state. The current-ranking panel is 443 px wide and only 216 px tall. Discovery feels like the product; the actual ranking feels like a sidebar widget.

On a 390×844 phone, the current ranking begins around **2,187 px from the top—roughly 2.6 viewports down**. Users must pass:

- Add a movie
- First-run guidance
- Three packs
- Inspired suggestions
- Essentials
- Popular movies

before seeing the thing they are building.

This is the biggest experience problem.

Proposal:

- Desktop: make the ranking the primary 60–65% workspace. Put compact add/search and “continue ranking” discovery in the secondary column.
- Mobile: introduce three stable top-level destinations:
  - **Rank** — add/search, current ranking, recent activity, Taste Explorer.
  - **Discover** — packs, Inspired, Essentials, Popular.
  - **Lists** — Watch next and Not for me.
- Comparison mode remains a focused takeover.
- Preserve state when switching sections.

A mobile tab bar is appropriate because these are now genuinely distinct top-level tasks, not merely sections in one document. Apple’s guidance recommends labeled tabs for stable top-level areas and cautions against hiding them unpredictably. [Apple tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars?trk=public_post_comment-text)

### 2. There is no actual component system yet

The stylesheet contains:

- 18 distinct border-radius declarations
- 50 distinct font-size values
- 16 shadow definitions
- Approximately 78 button/action selector families

Examples include `detail-action`, `suggest-action`, `queue-action`, `pack-card__action`, `undo-button`, `ghost`, `cta`, `pack-pager-btn`, `taste__action`, and several unrelated icon-button implementations.

This creates subtle but pervasive drift:

- Save/Hide/Remove have different sizes and spacing by surface.
- Close controls vary between 34 and 44 px.
- Inputs use pills, 10 px corners, 12 px corners, and custom backgrounds.
- Some primary actions are outlined, some filled, and some only bold.
- Disabled, muted, completed, and secondary states are often communicated with similar opacity changes.

Proposal: create a small semantic design system rather than continuing to normalize individual selectors.

Core primitives:

- `Button`: primary, secondary, tertiary, danger, icon.
- `IconButton`: compact desktop and touch-safe mobile sizes.
- `SegmentedControl`.
- `TextField`, `SearchField`, `Select`.
- `SectionHeader`.
- `Surface`: base, raised, inverted.
- `MovieItem`: compact, standard, comparison.
- `PackCard`.
- `Progress`.
- `DialogHeader`, `ActionFooter`.
- `Toast`.
- `Chip`.

One action should look and behave the same everywhere.

### 3. Mobile controls are technically accessible but not comfortably touchable

At the mobile viewport, 40 of 55 rendered buttons were smaller than 44×44. None were below WCAG’s 24×24 minimum, but many important controls were 24–34 px:

- Save/Hide pills: about 24 px tall.
- Suggestion detail buttons: 28×28.
- Refresh controls: 28×28.
- Ranking toolbar actions: 34×34.
- Queue detail controls: 28×28.

WCAG 2.2 describes 24×24 as a minimum and explicitly recommends larger targets for important controls. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) Apple recommends at least 44×44 and warns that inconsistent neighboring button sizes make interfaces harder to understand. [Apple button guidance](https://developer.apple.com/design/human-interface-guidelines/buttons?changes=latest_1)

Proposal:

- All touch actions: 44 px minimum interactive area.
- Cards may retain compact visual buttons by using invisible target padding.
- Mobile card actions should become a deliberate action row, not clusters of miniature pills.
- Keep desktop compact density behind fine-pointer media queries.

## Recommended visual direction

### Editorial monochrome

The current privacy page demonstrates stronger hierarchy than the app: a decisive black hero, oversized type, clean white body, and strong section rules. Share Studio’s Cinema treatment also feels more branded than the core UI.

Bring that confidence into the app:

- Warm-neutral canvas rather than a generic gray radial gradient.
- White working surfaces and selective black/inverted anchor surfaces.
- Poster artwork remains the only routine color.
- Semantic red/amber only for danger and warnings.
- Large rank numerals—`01`, `02`, `03`—become a recognizable brand motif.
- Thin rules and whitespace replace many nested borders.
- Shadows are reserved for overlays or truly floating objects.

This remains monochrome but becomes visually distinctive.

### Typography

Space Grotesk is appropriate and should stay. The problem is the lack of a controlled scale.

Recommended roles:

- Display: 40/44, bold
- Page title: 28/32, bold
- Section title: 20/26, bold
- Item title: 15/20, semibold
- Body: 15/22
- Metadata: 13/18
- Eyebrow: 11/16, uppercase, tracked

Avoid dozens of near-identical sizes such as 0.68, 0.70, 0.72, 0.74, 0.76, 0.78, and 0.79 rem.

### Layout and shape tokens

Recommended scales:

- Spacing: 4, 8, 12, 16, 24, 32, 48.
- Radii: 10 controls, 16 cards, 24 major surfaces, pill only for chips/actions.
- Elevation: flat, raised, overlay.
- Motion: 120 ms feedback, 180 ms transition, 240 ms modal.
- One consistent 2 px focus ring with adequate offset.

The existing token layer in [styles.css (line 10)](/Users/danbretl/src/stackrank/styles.css:10) is too small to govern the actual interface.

## Surface-by-surface recommendations

### Header and app shell

Current issues:

- “Movies” floats in the center without acting as navigation or useful context.
- Sign in and Settings are clear, but the header does little to establish the brand.
- On mobile, the shell disappears into a long document.

Changes:

- Treat the header as an app bar.
- Keep StackRank left aligned.
- Use “Movies” as a concise section title only where needed.
- Add stable mobile navigation beneath or at the bottom of the viewport.
- Give Sign in lower visual weight than the primary product action.
- Standardize the settings control with the rest of the icon system.

### Add/search and first run

What works:

- Search is front and center.
- TMDB-only selection prevents bad data.
- First-run copy is concise and contextual.
- Import is available without forcing onboarding.

Issues:

- The oversized capsule and rotating movie-title placeholder can look like a prefilled value.
- The add panel continues into every discovery section, making it an enormous single surface.
- “Add a movie” is mechanically accurate but not very motivating.

Changes:

- Rename the section **Add to your ranking**.
- Use a search icon and a stable placeholder such as “Search for a movie.”
- Retain the movie examples as lightweight prompt text elsewhere if desired.
- Separate Add/Search from Discover structurally.
- Empty state can use one stronger sentence and two clear paths: search or start a pack.
- Reduce vertical space before the first meaningful result.

### Comparison

This is the strongest part of the product and should remain the visual benchmark.

What works:

- Two large, obvious targets.
- Excellent portrait and landscape adaptation.
- Minimal distraction.
- Clear progress and cancel control.

Changes:

- Give both movie cards identical surfaces. The gray “Existing” card introduces subtle visual bias.
- Consider removing “New entry” and “Existing”; those labels describe system mechanics, not the user’s decision.
- Use a neutral prompt: **Which belongs higher?** or retain **Pick your favorite**.
- Add consistent pressed/selected feedback before advancing.
- Move Undo, Cancel, Keep, Swap, and End review into one shared comparison action bar.
- On desktop, vertically center or constrain the comparison area so it does not leave a large unfinished blank region.

### Current ranking

The ranking needs to feel like the product’s hero artifact.

Changes:

- Make it the dominant desktop surface.
- Put Add/Search adjacent to it rather than above a long discovery feed.
- Replace `1. Title` with a more deliberate rank column: large `01`, poster, title/year.
- Reveal re-rank/remove on hover for desktop, but provide a touch-safe overflow menu on mobile.
- Make filtering and sharing visibly labeled at narrow widths.
- Keep Review prominent only when useful.
- Remove the arbitrary 380 px feeling of a widget; the list should own the workspace.

Apple recommends keeping toolbars deliberately small and moving lower-priority commands into overflow when width becomes constrained. [Apple toolbar guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars?changes=_2)

### Suggestions and movie rows

The same movie currently has different anatomy depending on whether it appears in Suggestions, Packs, Watch next, Not for me, Full-screen ranking, or Recent.

Most importantly, suggestion cards rank when their main body is tapped, but there is no visible “Rank” label. Pack rows expose Rank explicitly. Queue rows again make the title area the Rank control.

Changes:

- Establish one `MovieItem`.
- Always show poster, title, year, and detail affordance in the same positions.
- Make the primary Rank behavior visible rather than implied.
- Recommended card action hierarchy:
  - Primary: Rank
  - Secondary: Save
  - Tertiary: Hide or overflow
- Preserve source-specific explanation text as a metadata slot.
- Use one mobile action row with touch-safe targets.
- Use an overflow menu for destructive/rare actions such as Remove.

This improves consistency, recognition, and error prevention—the same principles highlighted in Nielsen Norman Group’s usability heuristics. [NN/g heuristic summary](https://media.nngroup.com/media/articles/attachments/Heuristic_Summary1_A4_compressed.pdf)

### Pack shelf and browser

The shelf communicates progress well, but card states rely on subtle border-weight and gray-tone differences.

Changes:

- Standardize status language:
  - Start
  - Continue
  - Updated
  - Complete
- Retire “Pick up,” which is less precise.
- Use a visible status label rather than border thickness to communicate state.
- Make the progress bar thicker and label it textually.
- On mobile, the All Packs experience should be full-screen, not an inset modal containing a cramped two-column grid.
- Use either:
  - One-column horizontal cards with poster collage, title, category, progress, or
  - Two-column visual cards with descriptions omitted until detail.
- Keep search/filter controls sticky.
- Present “In progress” and “Updated” before the full catalog.
- The pack-detail action grid should have one primary action—Rank all—and place Save all/Hide all in an overflow or secondary menu.
- Pack movie rows should use the shared `MovieItem`.

### Movie detail

The information architecture is sound, but the presentation is utilitarian.

Changes:

- Increase poster prominence, especially on desktop.
- Use a dark or edge-to-edge poster header treatment to make the sheet feel cinematic.
- Keep metadata in a compact, consistent definition pattern.
- Use the shared action footer.
- Rank should be filled/primary; Save secondary; Hide tertiary.
- Preserve the nested return behavior from pack detail.

### Recently ranked, Taste Explorer, and lists

Recently ranked is often redundant with the ranking, especially for small lists. Watch next and Not for me receive equal panel weight despite differing importance.

Changes:

- Integrate recent activity into the Rank destination as a compact collapsible log or “Recently added” filter.
- Do not show a large Recently ranked panel when it simply duplicates a one- or two-item ranking.
- Elevate Taste Explorer as a reward inside the ranking experience after five movies, perhaps as a compact “Your taste” summary row.
- In the Lists destination, use a segmented control:
  - Watch next
  - Hidden
- Keep Watch next visually primary.
- Empty hidden state should be a compact message, not a full panel.
- Standardize row actions and terminology.

### Full-screen ranking and review

Full-screen ranking has the right capabilities but too much card chrome.

Changes:

- Poster and rank should dominate.
- Move Re-rank/Remove behind a contextual menu until hover/focus/selection.
- Keep density and filter controls in one consistent toolbar.
- Persist density only if usage supports it.
- Review should look like a deliberate mode of the same comparison system, not a separate collection of button variants.
- Provide clear session progress and an explicit completion state.

### Share Studio

Share Studio contains some of StackRank’s best visual work, but its control experience feels like an advanced settings form.

Issues:

- Native radios and checkboxes do not match the rest of the app.
- The sidebar is long and undifferentiated.
- On mobile, the preview appears first while the actual Download/Share controls can be far below.
- Technical exports compete visually with common exports.

Changes:

- Use segmented controls for Format and Shape.
- Show Look as visual thumbnail swatches/cards.
- Show Tone as chips.
- Put Include options inside a collapsible Content section.
- Place Markdown/JSON/Text under Advanced exports.
- Add a sticky action footer with Download PNG and Share.
- On mobile, keep the current preview compact enough that export actions remain reachable.
- Reuse Share Studio’s stronger editorial visual language in the main app.

### Settings, import, and sign-in

Sign-in and import are already among the more coherent flows.

Changes:

- Define a consistent overlay taxonomy:
  - Popover: Settings
  - Sheet: Detail, Sign in, Import
  - Workspace: All Packs, Full-screen ranking, Share Studio
  - Lightbox: artwork/image preview
- Use one dialog header and close control.
- Make workspaces full-screen on mobile.
- Use one sticky action-footer pattern.
- Make destructive actions semantically distinct.
- Avoid wrapped two-line action labels like the current mobile Download backup/Restore backup buttons.
- Import’s Match titles and Import ranking actions should use the filled primary style.
- Keep the sign-in sheet’s current concise copy and passwordless framing.

### Privacy and credits

The privacy page is visually successful:

- Strong black hero.
- Clear typography.
- Good reading width.
- Confident hierarchy.

It should become a visual reference for the rest of StackRank rather than an isolated style.

## Interaction-system improvements

### Icons

The app mixes custom SVGs with `×`, `↻`, `≡`, `↕`, and arrow characters. Their stroke weights and visual alignment differ.

Use one internally bundled icon set with:

- 20 px standard icon canvas.
- 1.75–2 px stroke.
- Shared close, info, search, filter, share, overflow, drag, undo, and rank-review icons.
- Text labels whenever an icon is not universally clear.

### Motion

Motion is modest, which is appropriate, but reduced-motion behavior currently appears focused on skeletons rather than the whole interface.

Proposal:

- Define motion tokens.
- Use pressed states for immediate feedback.
- Limit translation animations to 2–4 px.
- Disable nonessential transitions and entrance movement under `prefers-reduced-motion`.
- Avoid animating every card independently during long lists.

### Feedback and system states

Create shared treatments for:

- Loading
- Empty
- Offline/local-only
- Warning
- Error with retry
- Success
- Undo toast

Currently these states are individually styled across suggestions, storage errors, details, auth, packs, and feedback toasts.

## Approved foundational decisions

The product owner approved the audit direction in principle on 2026-06-30:

1. Make the ranking the primary workspace.
2. Introduce mobile Rank / Discover / Lists navigation.
3. Adopt the editorial-monochrome visual direction, with poster artwork as the primary color.
4. Execute the redesign as a critical, high-quality, phased initiative rather than a quick reskin.
5. Resolve minor product and visual adjustments during implementation, recording consequential changes below.

## Scope and implementation constraints

### In scope

- App shell, information architecture, navigation, responsive layout, visual hierarchy, and interaction hierarchy.
- A real shared design system implemented in the existing static HTML/CSS/JavaScript architecture.
- All primary and secondary product surfaces described in this audit.
- Accessibility improvements, including touch targets, focus states, reduced motion, readable control typography, and consistent semantic states.
- Necessary markup and JavaScript changes to support top-level navigation and shared interaction patterns.
- Focused tests for any new DOM-free state logic and regression coverage for changed workflows.
- Updated cache-busting query strings for every changed CSS, JavaScript, library, or data asset.

### Constraints

- Preserve the plain static SPA architecture: no framework, bundler, or app dependency migration.
- Preserve existing data, persistence, Supabase, TMDB, ranking, queue, pack, auth, backup, import, export, and telemetry behavior unless a change is explicitly documented.
- Preserve binary-insertion ranking correctness.
- Never surface TMDB ratings.
- Keep comparison choices visible in one screen in mobile portrait and landscape.
- After ranking finishes or is canceled, blur the title input; never focus it.
- Keep poster artwork as the routine source of color.
- Use the approved TMDB logo unmodified.
- Do not add secrets or new third-party runtime origins without deliberate review.
- Do not commit or push unless explicitly requested.

### Non-goals

- Rewriting the application in React or another framework.
- Replacing the product’s core ranking model.
- Adding social features, public profiles, collaborative lists, or new categories.
- Reworking generated Share Studio artwork unless needed to support the control redesign.
- Adding animation for its own sake.
- Using a design-system dependency or remote icon dependency.

## Implementation strategy

The redesign must change hierarchy and components together. A CSS-only reskin would preserve the main product problem: discovery would still dominate while the ranking remains structurally secondary.

Work in vertical slices. Each phase must leave the app functional, pass its relevant automated tests, and receive rendered desktop/mobile inspection before the next phase starts. Avoid allowing an extended sequence of phases to accumulate without browser verification.

### Working rules for every phase

1. Re-read this document and inspect `git status` before editing.
2. Preserve unrelated user changes.
3. Define the phase’s target user flow in one sentence.
4. Make the smallest coherent architectural change that fully establishes the intended pattern.
5. Bump relevant cache keys in `index.html` and any changed `app.js` imports.
6. Run focused tests while iterating.
7. Run rendered QA through the in-app browser at desktop and mobile widths.
8. Record material decisions, deviations, and completed checklist items in this document.
9. Run `npm run verify` before a phase handoff when the phase is complete.
10. Do not start a later phase to conceal unfinished quality problems in the current phase.

## Phase 0 — visual specification and baseline

**Goal:** Convert the approved written direction into concrete desktop and mobile reference designs, and preserve a measurable baseline.

### Tasks

- [x] Capture representative before screenshots:
  - [x] Desktop populated Rank view
  - [x] Mobile populated home
  - [x] Desktop comparison
  - [x] Mobile portrait comparison
  - [x] Mobile landscape comparison
  - [x] All Packs browser and pack detail
  - [x] Movie detail
  - [x] Share Studio desktop and mobile
- [x] Generate a complete desktop primary-workspace concept.
- [x] Generate a complete mobile Rank view concept with persistent Rank / Discover / Lists navigation.
- [x] Generate focused concepts if needed for:
  - [x] Shared movie row/card anatomy
  - [x] All Packs mobile workspace
  - [x] Movie-detail sheet
  - [x] Share Studio controls
- [x] Extract the exact visual specification:
  - [x] Color tokens
  - [x] Type roles
  - [x] Spacing and container rules
  - [x] Radii and elevation
  - [x] Button and field variants
  - [x] Icon inventory
  - [x] Motion rules
  - [x] Desktop and mobile responsive behavior
- [x] Establish an allowed above-the-fold copy list.
- [x] Record baseline layout and touch-target measurements.

### Acceptance gate

- Desktop and mobile concepts cover the complete primary screen rather than only a header.
- Concepts preserve all approved information architecture and do not invent unrelated product areas.
- The design can be implemented with code-native HTML/CSS controls.
- The visual direction is specific enough that another engineer would make the same major layout, type, color, and component decisions.

### Approved reference assets

The concepts below are approved as the visual references for implementation. They were generated as design mockups, then inspected at full resolution. The exact written specification in this document controls implementation details; where generated labels conflict with existing behavior or the written rules below, the written rules win.

| Reference | Purpose |
| --- | --- |
| [`desktop-primary-workspace.png`](design-audit-assets/concepts/desktop-primary-workspace.png) | Desktop ranking-first shell, hierarchy, row anatomy, and continuation rail |
| [`mobile-rank-view.png`](design-audit-assets/concepts/mobile-rank-view.png) | Mobile Rank destination and persistent Rank / Discover / Lists navigation |
| [`shared-movie-item-anatomy.png`](design-audit-assets/concepts/shared-movie-item-anatomy.png) | Shared movie slots, density, actions, and coarse-pointer targets |
| [`responsive-comparison.png`](design-audit-assets/concepts/responsive-comparison.png) | Equal comparison surfaces and portrait/landscape geometry |
| [`mobile-all-packs-workspace.png`](design-audit-assets/concepts/mobile-all-packs-workspace.png) | Full-screen mobile pack browser and progress-led cards |
| [`mobile-movie-detail-sheet.png`](design-audit-assets/concepts/mobile-movie-detail-sheet.png) | Cinematic detail treatment and sticky action footer |
| [`mobile-share-studio-controls.png`](design-audit-assets/concepts/mobile-share-studio-controls.png) | Share control hierarchy, compact preview, and sticky export actions |

The generated movie-detail reference includes illustrative device chrome; implementation must render the sheet inside the actual browser viewport without that chrome. The shared MovieItem reference is anatomical, not a literal action matrix: an already-ranked movie uses detail, re-rank, drag, and remove/overflow actions rather than Save. The comparison reference establishes geometry and equal surfaces; the live action bar continues to show Undo or Cancel according to state, never both by default.

### Baseline evidence

The preserved before-state set lives under [`design-audit-assets/baseline/`](design-audit-assets/baseline/) and is reproducible with:

```bash
npm run screenshots -- --label=phase-0-before --output-dir=notes/feature-ideas/design-audit-assets/baseline
```

The set contains desktop and mobile main views, desktop and both mobile comparison layouts, All Packs browser/detail, movie detail, and Share Studio. The manifest records each viewport and expected open state.

Measured on the current populated app through the in-app browser:

| Measurement | Baseline |
| --- | --- |
| Desktop viewport | 1440×900 |
| Desktop app content width | 1100 px |
| Desktop add/discovery panel | 599×1326 px |
| Desktop ranking column | 443 px wide; 518 px for the five-movie ranking panel |
| Mobile viewport | 390×844 |
| Mobile add/discovery panel | 366×1966 px |
| Mobile ranking panel start | 2046 px from the document top, about 2.42 viewports down |
| Mobile document height | 4175 px in the measured populated state |
| Mobile visible buttons below 44 px in either dimension | 45 of 60 |
| Comparison geometry | No document overflow at 390×844 portrait or 844×390 landscape |

The comparison geometry is a protected baseline strength. The hierarchy and target-size measurements are the primary redesign deltas.

### Exact visual specification

#### Color tokens

| Token role | Value | Use |
| --- | --- | --- |
| Canvas | `#f2f1ee` | App background and workspace gutters |
| Surface | `#ffffff` | Primary working surfaces and sheets |
| Surface subtle | `#f7f7f5` | Quiet selected/hover rows and secondary wells |
| Surface inverted | `#111111` | Search anchor surfaces and deliberate focal regions |
| Ink | `#111111` | Primary text, strong rules, filled actions |
| Ink muted | `#666662` | Metadata and secondary copy |
| Rule | `#d8d7d3` | Row separators and quiet control borders |
| Rule strong | `#111111` | Major boundaries and selected outlines |
| Focus | `#0b63ce` | Accessible focus ring only |
| Danger | `#b42318` | Destructive actions and errors |
| Warning | `#8a5a00` | Warnings and local-only caution states |
| Success | `#187243` | Completed/success states |
| Scrim | `rgba(17, 17, 17, 0.48)` | Modal and workspace backdrop |

Poster artwork remains the only routine content color. Focus and semantic colors appear only when their meaning is active.

#### Typography roles

Space Grotesk remains the product typeface. All controls explicitly inherit it. Letter spacing is `0` for every role.

| Role | Desktop | Mobile | Weight |
| --- | --- | --- | --- |
| Display | 40/44 | 32/36 | 700 |
| Page title | 28/32 | 28/32 | 700 |
| Section title | 20/26 | 20/26 | 700 |
| Item title | 15/20 | 15/20 | 600 |
| Body | 15/22 | 15/22 | 400 |
| Metadata | 13/18 | 13/18 | 400 |
| Control | 14/20 | 14/20 | 600 |
| Eyebrow | 11/16 uppercase | 11/16 uppercase | 600 |
| Rank numeral | 56/56 | 48/48 | 500 |

Font size never scales directly with viewport width. Long titles wrap within their content slot without changing row geometry unexpectedly.

#### Spacing and containers

- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32 / 48`.
- Desktop app bar: 64 px.
- Desktop content: maximum 1200 px wide with 32 px outer gutters and a 24 px column gap.
- Desktop primary workspace at 1100 px and wider: 64% ranking / 36% continuation rail.
- Ranking rows use separators and whitespace, not individual cards.
- Major sections may use one surface boundary; sections do not become floating cards and cards do not nest inside cards.
- Tablet 721–1099 px: ranking remains first and full width; the continuation rail follows below in a two-column supporting layout where space permits.
- Mobile 720 px and below: 12 px outer gutter, 16 px section spacing, 56 px app bar, and a 68 px navigation bar plus safe-area inset.
- Mobile Rank order: app bar → Add to your ranking → Current ranking → Taste/recent support. Discovery and lists are separate destinations.
- Fixed navigation and sticky action footers reserve their own content padding and never cover the final row.

#### Radii and elevation

- Control radius: 10 px.
- Card radius: 16 px.
- Major surface/sheet radius: 24 px on desktop; mobile full-screen workspaces have no outer radius.
- Pills are limited to compact status chips and tone choices.
- Flat: no shadow.
- Raised: `0 12px 32px rgba(17, 17, 17, 0.08)`.
- Overlay: `0 24px 64px rgba(17, 17, 17, 0.18)`.
- Ranking rows, navigation, and standard controls stay flat.

#### Buttons and fields

Buttons share one semantic hierarchy:

- Primary: filled ink background, white text.
- Secondary: white/transparent background, 1 px ink border.
- Tertiary: no container until hover/focus; muted text becomes ink.
- Danger: danger text/border, filled only for final destructive confirmation.
- Icon: 44×44 coarse-pointer target; 36×36 fine-pointer compact target.

All mobile/coarse-pointer interactive targets are at least 44×44. Desktop fine-pointer actions may render visually compact while retaining clear focus and hover treatment.

Fields:

- Text field: 44 px desktop / 48 px mobile minimum height, 10 px radius.
- Search field: search icon at the leading edge, stable placeholder, and no rotating title placeholder.
- Select: same height, type, border, and focus ring as text fields.
- Segmented control: one bordered group, equal-height options, filled ink selected state.
- Checkbox/toggle: custom visible control paired with the native input; minimum 44 px label target on coarse pointers.
- Focus: 2 px `Focus` ring with 2 px offset; never clipped.

#### Shared content anatomy

`MovieItem` always uses the same ordered slots:

1. Optional two-digit rank numeral.
2. Stable poster frame.
3. Title and year.
4. Optional source/reason/status metadata.
5. Detail affordance.
6. Contextual actions.

Action rules:

- Discovery and packs: Rank primary, Save secondary, Hide tertiary/overflow.
- Watch next: Rank primary, Hide secondary, Remove in overflow.
- Hidden: Rank primary, Save secondary, Remove in overflow.
- Ranking: detail and drag are persistent; re-rank/remove move to hover/focus or overflow.
- Recent and Taste evidence: open detail is primary; no unrelated queue actions.

Desktop standard poster: 48×72 px. Mobile standard poster: 48×72 px. Ranking hero rows may use 64×96 px on desktop and 56×84 px on mobile. Row heights are stable per variant.

`PackCard` uses a stable two-poster collage, title, category/subtitle, explicit progress text, a 4 px progress bar, status language Start / Continue / Updated / Complete, and one obvious next action.

#### Icon inventory

Use an internally bundled outline SVG family with a 20 px canvas, `1.8` px stroke, round caps/joins, and `currentColor`. Required icons:

- Search, settings, close, info.
- Review, filter, full screen, share.
- Overflow, drag, undo, swap, refresh.
- Rank/up arrow, bookmark/save, hide/eye-off, remove.
- Chevron/disclosure, previous, next.
- Rank tab, discover/search tab, lists tab.
- Download, image, image set/grid.

Text labels accompany unfamiliar or primary toolbar icons. Text glyphs such as `×`, `↻`, `≡`, `↕`, and arrow characters are replaced on migrated surfaces.

#### Motion rules

- Feedback: 120 ms.
- State/layout transition: 180 ms.
- Sheet/workspace transition: 240 ms.
- Pressed movement is limited to 2 px; no spring or bounce.
- Long lists do not stagger card entrances.
- `prefers-reduced-motion: reduce` removes nonessential transforms, smooth scrolling, and entrance/exit movement while preserving immediate state changes.

#### Responsive and surface behavior

Desktop:

- Rank / Discover / Lists are stable text destinations in the app bar, with Rank selected by default.
- Current ranking owns the left 64% workspace and the first visual read.
- The right rail starts with Add to your ranking, then Continue ranking, then a compact Taste reward.
- Lists remain directly reachable from the app bar and do not occupy equal first-viewport panel weight.

Mobile:

- Rank / Discover / Lists use a persistent labeled bottom navigation.
- Rank shows search and the start of the ranking in the first viewport.
- Discover owns packs and suggestion sections.
- Lists uses Watch next / Hidden segmented navigation.
- Bottom navigation hides only for comparison, sheets, workspaces, and lightboxes.

Comparison:

- Prompt: `Which belongs higher?`
- Both choices use identical neutral surfaces.
- `New entry` and `Existing` labels are removed.
- The shared action bar displays Cancel before a choice, Undo after a reversible choice, and the correct review or Rank All controls for those modes.
- Portrait 390×844 and landscape 844×390 remain scroll-free.

Overlays:

- Popover: Settings.
- Sheet: Detail, Sign in, Import.
- Workspace: All Packs, Full-screen ranking, Share Studio.
- Lightbox: poster/share artwork.
- Mobile workspaces are edge-to-edge; sheets may retain top corner radii when they do not fill the viewport.
- One shared header, close control, scroll model, and sticky action footer are used per taxonomy.

Share Studio:

- Preview is compact enough that primary export actions are reachable.
- Format and Shape use segmented controls.
- Look uses visual swatches; Tone uses chips.
- Content and Advanced exports are collapsible sections.
- Download PNG and Share live in a sticky action footer.
- Generated artwork and export semantics do not change.

### Allowed above-the-fold copy

No additional visible first-viewport copy may be introduced without a decision-log entry.

Desktop Rank:

- `STACKRANK`
- `Rank`
- `Discover`
- `Lists`
- `Sign in`
- `Current ranking`
- Dynamic movie count
- `Review`
- `Filter`
- `Full screen`
- `Share`
- `Add to your ranking`
- `Search for a movie`
- `Continue ranking`
- Existing pack titles and `Start` / `Continue` / `Updated` / `Complete`
- `Your taste`
- `Explore`

Mobile Rank:

- `STACKRANK`
- `Sign in`
- `Add to your ranking`
- `Search for a movie`
- `Current ranking`
- Dynamic movie count
- `Review`
- `Share`
- Existing ranked movie titles and years
- `Your taste`
- `Explore`
- `Rank`
- `Discover`
- `Lists`

## Phase 1 — design foundations

**Goal:** Establish a small semantic design system without changing feature behavior.

### Tasks

- [x] Expand `:root` tokens:
  - [x] Canvas, surface, inverted surface, primary ink, muted ink, rules, focus, danger, warning, and success
  - [x] Typography roles
  - [x] Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48
  - [x] Radii: control / card / major surface
  - [x] Elevation: flat / raised / overlay
  - [x] Motion: 120 / 180 / 240 ms
- [x] Normalize base control typography.
- [x] Establish semantic button variants:
  - [x] Primary
  - [x] Secondary
  - [x] Tertiary
  - [x] Danger
  - [x] Icon
- [x] Establish semantic fields:
  - [x] Text field
  - [x] Search field
  - [x] Select
  - [x] Segmented control
  - [x] Checkbox/toggle treatment
- [x] Create one focus-ring treatment.
- [x] Establish 44 px coarse-pointer targets and compact fine-pointer variants.
- [x] Create the shared icon rules and replace inconsistent high-visibility glyphs first.
- [x] Add comprehensive `prefers-reduced-motion` treatment.
- [x] Add shared loading, empty, warning, error, success, and disabled-state styling.

### Acceptance gate

- Repeated actions have the same visual hierarchy on every migrated surface.
- No important mobile action has an interactive target smaller than 44×44.
- Controls do not depend on browser-default typography.
- The phase does not regress ranking, queue, pack, auth, import, or export behavior.

### Phase 1 fidelity ledger

This ledger evaluates the approved concepts only for the foundations in Phase 1. Structural composition and feature-specific component migration remain governed by their later phases.

| Reference | Foundation comparison points | Phase 1 result |
| --- | --- | --- |
| Desktop primary workspace | Warm canvas; white/ink surfaces; Space Grotesk hierarchy; 10/16/24 px radius grammar; restrained raised elevation | Matched in the live desktop shell; ranking dominance and app-bar destinations remain Phase 2 |
| Mobile Rank view | Warm canvas; compact app-bar type; 44 px touch targets; ink/white control hierarchy; poster-led color | Matched in the current mobile shell; first-viewport ranking and bottom navigation remain Phase 2 |
| Shared MovieItem anatomy | 20 px outline icon canvas; 1.8 px stroke; explicit primary/secondary/tertiary semantics; metadata type role; flat row treatment | Shared rules are established and high-visibility glyphs are migrated; full MovieItem unification remains Phase 3 |
| Responsive comparison | Neutral monochrome surfaces; strong page-heading role; consistent card radius/rules; restrained feedback motion; scroll-free 390×844 and 844×390 geometry | Matched without changing comparison semantics; prompt/labels/action-bar migration remains Phase 4 |
| Mobile All Packs workspace | Major-surface radius; consistent close icon; muted metadata role; focus treatment; 44 px pack/filter targets | Matched within the existing modal; edge-to-edge workspace and card restructuring remain Phases 3 and 6 |
| Mobile movie-detail sheet | Overlay scrim/elevation; 24 px major radius; clear title/body/eyebrow roles; semantic action hierarchy; touch-safe close/actions | Matched within the existing sheet; immersive poster composition and sticky footer remain Phase 6 |
| Mobile Share Studio controls | Overlay treatment; consistent close icon; explicit field typography; custom checkbox targets; shared focus/disabled states | Matched at the foundation level; segmented Format/Shape, swatches, chips, and sticky actions remain Phase 7 |

## Phase 2 — information architecture and app shell

**Goal:** Make ranking the primary product surface and split top-level tasks cleanly.

### Desktop structure

- [x] Ranking owns approximately 60–65% of the primary workspace.
- [x] Add/search and a compact continuation/discovery rail occupy the secondary column.
- [x] Recently ranked and Taste Explorer become supporting ranking content rather than equal standalone panels.
- [x] Discovery sections no longer live inside one enormous Add panel.
- [x] Lists are accessible without competing with the ranking in the first viewport.

### Mobile structure

- [x] Add stable Rank / Discover / Lists navigation.
- [x] Rank contains:
  - [x] Add/search
  - [x] Current ranking
  - [x] Relevant recent activity
  - [x] Taste Explorer when available
- [x] Discover contains:
  - [x] Suggested packs
  - [x] Inspired
  - [x] Essentials
  - [x] Popular
- [x] Lists contains:
  - [x] Watch next
  - [x] Hidden
- [x] Preserve each destination’s state and scroll position when switching.
- [x] Keep navigation reachable, safe-area aware, and hidden only during true focused takeovers.

### App bar

- [x] Keep StackRank left aligned.
- [x] Remove the nonfunctional floating “Movies” treatment.
- [x] Maintain clear account/settings access.
- [x] Ensure the app bar and mobile navigation share one icon and typography system.

### Acceptance gate

- Current ranking appears in the first mobile viewport for a populated list.
- Desktop ranking is visually and structurally dominant.
- Rank / Discover / Lists switching is keyboard and screen-reader operable.
- Comparison, full-screen ranking, detail, settings, sign-in, packs, and Share Studio open and close correctly from the new shell.

### Phase 2 fidelity ledger

| Reference | Phase 2 comparison points | Phase 2 result |
| --- | --- | --- |
| Desktop primary workspace | App-bar Rank / Discover / Lists destinations; ranking left of the rail; ranking owns roughly 60–65% of the workspace; Add/Search and continuation support live in the secondary column | Matched structurally. E2E measures the ranking workspace at ~64% of the combined primary/rail width, hides queues from Rank, and keeps Add plus Continue ranking in the rail. Full MovieItem rank numerals remain Phase 4. |
| Mobile Rank view | Header with account/settings access; Add to your ranking first; Current ranking visible in the first viewport; fixed labeled Rank / Discover / Lists bottom navigation; discovery and queues removed from Rank | Matched structurally. The app-shell E2E verifies Add and Current ranking appear in the 390×844 first viewport, bottom navigation is safe-area-aware, and no horizontal overflow occurs. Full row anatomy remains Phase 3/4. |
| Shared MovieItem anatomy | Shell should not add new row semantics before the shared component phase | Preserved. Ranking, suggestion, queue, pack, recent, and Taste row internals remain governed by existing behavior; Phase 2 only relocates surfaces and adds navigation. |
| Responsive comparison | Focused takeover hides app navigation and preserves 390×844 portrait and 844×390 landscape geometry | Matched. Screenshot harness reports exact viewport scroll dimensions for desktop, mobile portrait, and mobile landscape comparison captures after the shell change. |
| Mobile All Packs / detail / Share references | Existing workspaces, sheets, and lightboxes should still open and close from the new shell, with mobile navigation hidden under true takeovers | Matched at the app-shell level. Focused and full E2E cover packs, detail, full-screen ranking, sign-in/import/settings, and Share Studio opening/closing without changing those Phase 6/7 presentations. |

## Phase 3 — shared content components

**Goal:** Give every movie and pack a consistent anatomy and action hierarchy.

### MovieItem

- [ ] Define variants: ranking, discovery, queue, pack, recent, Taste evidence.
- [ ] Consistent slots:
  - [ ] Rank number where applicable
  - [ ] Poster
  - [ ] Title
  - [ ] Year
  - [ ] Source/reason metadata
  - [ ] Detail affordance
  - [ ] Primary and secondary actions
- [ ] Make Rank visible wherever tapping the item ranks it.
- [ ] Use Rank as primary, Save as secondary, and Hide/Remove as tertiary or overflow.
- [ ] Add touch-safe overflow behavior for rare/destructive actions.

### PackCard

- [ ] Standardize Start / Continue / Updated / Complete.
- [ ] Use explicit status text rather than border-weight differences.
- [ ] Increase progress-bar clarity and include textual progress.
- [ ] Define shelf, browser, and compact variants from one component grammar.

### Supporting primitives

- [ ] SectionHeader
- [ ] Progress
- [ ] Status/metadata line
- [ ] Empty state
- [ ] Action footer
- [ ] Toast

### Acceptance gate

- A user can recognize how to rank, save, inspect, hide, or remove a movie without relearning each surface.
- Common actions have consistent labels, ordering, size, and pressed/disabled states.
- Pack progress remains accurate and persists.

## Phase 4 — core ranking flows

**Goal:** Make adding, comparing, reviewing, and reading the ranking feel like one coherent signature experience.

### Add/search

- [ ] Rename to “Add to your ranking.”
- [ ] Use a stable “Search for a movie” placeholder.
- [ ] Add a consistent search icon.
- [ ] Preserve autocomplete, keyboard navigation, TMDB-only selection, and immediate ranking.
- [ ] Tighten first-run content while preserving search, packs, and import paths.

### Current ranking

- [ ] Introduce deliberate `01`, `02`, `03` rank numerals.
- [ ] Establish clear poster/title/year alignment.
- [ ] Make filter, review, full screen, and share understandable at narrow widths.
- [ ] Use contextual re-rank/remove controls.
- [ ] Ensure drag behavior remains correct on desktop and touch.

### Comparison and review

- [ ] Use equal visual surfaces for both choices.
- [ ] Remove or reduce “New entry” / “Existing” system-language bias.
- [ ] Consolidate comparison actions into one action bar.
- [ ] Add consistent pressed feedback before advancing.
- [ ] Preserve one-screen mobile portrait and landscape layouts.
- [ ] Preserve Undo, Cancel, Rank all skip, review Keep/Swap/End, Escape behavior, and scroll restoration.
- [ ] Keep the title input blurred after finish/cancel.

### Acceptance gate

- Binary insertion and review behavior pass automated tests.
- Both mobile comparison choices and necessary controls fit without scrolling in portrait and landscape target viewports.
- The ranking is the strongest visual artifact in the core app.
- Drag, filter, share, full-screen, re-rank, remove, undo, and cancel remain functional.

## Phase 5 — discovery, lists, and Taste Explorer

**Goal:** Make secondary paths useful and coherent without competing with the ranking.

### Discovery

- [ ] Apply shared MovieItem patterns to Inspired, Essentials, and Popular.
- [ ] Preserve reason enrichment and stale-request protection.
- [ ] Keep per-section refresh clear and touch-safe.
- [ ] Ensure suggestion cards never imply TMDB ratings.

### Packs

- [ ] Redesign the shelf around progress and next action.
- [ ] Make All Packs a full-screen mobile workspace.
- [ ] Use sticky search/filter controls.
- [ ] Prioritize In progress and Updated states.
- [ ] Use one-column or appropriately simplified two-column mobile cards.
- [ ] Make Rank all primary; move bulk Save all/Hide all to secondary treatment.
- [ ] Preserve filtered prev/next pack paging and keyboard arrows.

### Lists

- [ ] Use Watch next / Hidden segmented navigation.
- [ ] Keep Watch next primary.
- [ ] Use compact empty states.
- [ ] Apply shared movie actions and terminology.

### Taste Explorer and recent activity

- [ ] Present Taste Explorer as a reward within Rank.
- [ ] Keep rank-weighted language precise.
- [ ] Preserve lazy enrichment, evidence, ranking lens, and pack links.
- [ ] Collapse or integrate Recently ranked so it does not duplicate the list.

### Acceptance gate

- Discovery remains easy to browse but cannot visually outrank the ranking workspace.
- All pack, suggestion, queue, and Taste interactions pass focused browser QA.
- Queue and pack persistence behavior remains unchanged.

## Phase 6 — overlay and workspace system

**Goal:** Make every transient surface follow a predictable model.

### Taxonomy

- [ ] Popover: Settings
- [ ] Sheet: Detail, Sign in, Import
- [ ] Workspace: All Packs, Full-screen ranking, Share Studio
- [ ] Lightbox: Artwork/image preview

### Shared behavior

- [ ] One dialog/workspace header pattern.
- [ ] One close-control treatment and placement.
- [ ] One sticky action-footer pattern.
- [ ] Correct focus entry, focus containment where appropriate, Escape, backdrop, and focus return.
- [ ] Safe-area-aware mobile full-screen layouts.
- [ ] No nested scroll traps.

### Surface work

- [ ] Movie detail: stronger poster treatment, concise metadata, shared action footer.
- [ ] Settings: prevent wrapped backup/import actions and separate destructive controls.
- [ ] Import: primary Match titles / Import ranking hierarchy.
- [ ] Sign in: preserve concise passwordless framing and provider availability behavior.
- [ ] Full-screen ranking: reduce card chrome and use contextual actions.
- [ ] Pack browser/detail: apply workspace and sheet rules consistently.

### Acceptance gate

- Overlay type is visually predictable from its purpose.
- Keyboard focus and dismissal are correct.
- Returning from a nested detail/lightbox restores the right parent surface and state.
- Auth, backup, restore, import, detail, full-screen ranking, and packs pass E2E coverage.

## Phase 7 — Share Studio controls

**Goal:** Bring Share Studio’s configuration UI up to the quality of its generated artwork without changing export output semantics.

### Tasks

- [ ] Use segmented controls for Format and Shape.
- [ ] Present Look as visual swatches/cards.
- [ ] Present Tone as clear selectable chips.
- [ ] Group Include options under collapsible Content.
- [ ] Move Markdown, JSON, and Text under Advanced exports.
- [ ] Add a sticky Download PNG / Share action footer.
- [ ] Keep mobile preview and primary export actions reachable.
- [ ] Preserve empty-section disabling and labels.
- [ ] Preserve single-image, image-set, ZIP, per-page, native share, and lightbox behavior.
- [ ] Preserve saved Share options and migrations.

### Acceptance gate

- Existing export fixtures and E2E downloads remain valid.
- Common image export actions are visible without traversing the entire mobile configuration form.
- Control selection, disabled states, and focus treatment match the main design system.

## Phase 8 — comprehensive verification and release readiness

**Goal:** Validate the redesign as a coherent product, not merely a collection of passing features.

### Automated checks

- [ ] `npm test`
- [ ] `node --check app.js`
- [ ] Deno checks for all edge functions
- [ ] `npm run test:e2e`
- [ ] `npm run verify`
- [ ] `npm run test:production` after deployment

### Required responsive matrix

- [ ] Desktop 1440×900
- [ ] Small desktop/laptop 1280×720
- [ ] Tablet portrait around 768×1024
- [ ] Mobile 390×844
- [ ] Small mobile around 360×800
- [ ] Mobile landscape around 844×390
- [ ] Coarse pointer
- [ ] Fine pointer and hover
- [ ] Keyboard-only navigation
- [ ] Reduced motion

### Required state matrix

- [ ] Empty ranking / first run
- [ ] One movie
- [ ] Two to four movies
- [ ] Five-plus movies with Taste Explorer
- [ ] Long ranking
- [ ] Active comparison
- [ ] Ranking review
- [ ] Filtered ranking
- [ ] Populated and empty queues
- [ ] Pack not started / in progress / updated / complete
- [ ] Suggestions loading / loaded / failed
- [ ] Signed out / signed in / auth unavailable
- [ ] Local-only/offline or Supabase failure
- [ ] Detail loading / loaded / failed
- [ ] Share content available / empty sections / image set

### Visual-quality checks

- [ ] Ranking is the first clear focal point on desktop and mobile.
- [ ] Poster artwork is the routine source of color.
- [ ] No generic nested-card dashboard feel remains.
- [ ] No accidental type-scale drift or browser-default control text.
- [ ] No touch target under 44×44 for important coarse-pointer actions.
- [ ] No clipped text, accidental wrapping, overlap, horizontal overflow, or layout shift.
- [ ] Icon stroke, size, alignment, and selected/disabled states are consistent.
- [ ] Focus indicators are visible and never clipped.
- [ ] Empty/loading/error/success states use shared patterns.
- [ ] No comparison geometry regression.
- [ ] No mobile keyboard pop-up after ranking finish/cancel.

### Fidelity requirement

Before final handoff:

1. Capture final screenshots at the same dimensions as the approved reference concepts.
2. Inspect each reference and final screenshot with `view_image`.
3. Maintain a fidelity ledger with at least five concrete comparison points per primary reference.
4. Fix every material mismatch that does not have an explicit recorded reason.
5. Remove temporary QA artifacts from the repository.

## Success measures

The redesign is successful when:

- A populated ranking is visible without scrolling on mobile Rank.
- The ranking owns the majority of the desktop primary workspace.
- Users can identify Rank / Discover / Lists as distinct top-level tasks.
- Comparison remains fast, neutral, and fully visible in mobile portrait and landscape.
- Shared actions are visually and behaviorally consistent across suggestions, packs, queues, detail, and ranking.
- Important mobile actions use at least a 44×44 target.
- The core app looks as intentional and distinctive as the best Share Studio and privacy-page surfaces.
- `npm run verify` passes.
- Production smoke passes after deployment.

Quantitative product effects should be evaluated against the existing telemetry cutoff and event definitions. Do not add movie/account identifiers or expand telemetry beyond the privacy-bounded model merely to measure the redesign.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Large `app.js` makes structural DOM changes error-prone | Keep DOM-bound changes thin; extract only genuinely reusable pure state logic into `lib/` with tests |
| Mobile tabs accidentally reset state or scroll | Store active destination and per-destination scroll positions; add browser coverage |
| New shell breaks overlays or body state classes | Test every overlay from each relevant destination; keep takeover state rules explicit |
| Component normalization changes feature semantics | Migrate one surface family at a time and verify actions after each slice |
| CSS cascade causes hidden legacy styles to leak | Introduce semantic primitives deliberately, remove or isolate superseded rules, inspect computed styles |
| Touch target expansion creates cramped layouts | Separate visual size from interactive target; simplify action count and use overflow |
| Share Studio redesign breaks exports | Keep rendering/export logic untouched where possible; change controls and wiring only |
| Cache makes QA appear inconsistent | Bump every relevant query string and hard reload during rendered QA |
| Visual concept drifts during long implementation | Compare each phase to the approved references rather than waiting until the end |
| Scope expands into unrelated features | Enforce the non-goals and record any proposed expansion before implementing it |

## Decision log

Record material product, interaction, or visual decisions here. Minor CSS adjustments do not require entries.

| Date | Decision | Reason | Impact |
| --- | --- | --- | --- |
| 2026-06-30 | Ranking becomes the primary workspace | The existing hierarchy visually demotes the product’s core artifact | Desktop shell and mobile information architecture |
| 2026-06-30 | Mobile uses Rank / Discover / Lists top-level navigation | The current long document buries the ranking more than two viewports down | New navigation state and responsive shell |
| 2026-06-30 | Adopt editorial monochrome with posters as routine color | Preserves original intent while creating a more distinctive product identity | Tokens, typography, surfaces, and component treatment |
| 2026-06-30 | Execute as a phased critical initiative | Quality and regression risk are too high for a single reskin pass | Phase gates, visual concepts, verification after each slice |
| 2026-06-30 | Approve the Phase 0 reference set with the written specification as final authority | Generated concepts establish composition and component language but can contain illustrative labels or device framing | Implementation follows the linked references plus the exact rules in this document |
| 2026-06-30 | Use Rank / Discover / Lists as stable desktop destinations as well as mobile destinations | The same task model should remain recognizable across breakpoints while mobile uses a persistent bottom bar | Desktop app bar gains text navigation; mobile retains labeled bottom navigation |
| 2026-06-30 | Preserve existing action semantics when a generated component sheet is broader than the live context | Ranking rows should not gain Save, and comparison should not show Undo and Cancel simultaneously | Shared components normalize visuals without changing feature behavior |
| 2026-06-30 | Lock the Phase 1 token targets to the exact values in the visual specification | A precise palette, type scale, spacing system, and motion scale are required before surface migration | Phase 1 can be implemented and reviewed without subjective token drift |
| 2026-06-30 | Build Phase 1 as a compatibility-first semantic layer with an internal SVG symbol sprite | Existing behavior and selectors must remain stable while later phases migrate surfaces incrementally | Tokens and semantic primitives govern legacy controls now; high-visibility glyphs share one bundled icon grammar without a runtime dependency |
| 2026-06-30 | Implement Phase 2 as a CSS-gated destination shell over the existing static DOM | The large `app.js` surface makes behavior regressions more likely than relocating every feature renderer at once | Existing ranking, suggestions, queues, packs, auth, import, and export handlers keep their IDs and semantics while Rank / Discover / Lists own the visible IA |
| 2026-06-30 | Stabilize the add/search placeholder during Phase 2 | The approved app-shell specification requires “Search for a movie” and the rotating title examples could read like prefilled values | Placeholder rotation calls remain no-ops around overlays; no ranking or search behavior changes |

## Progress log

Add one concise entry after each completed implementation phase.

| Date | Phase | Summary | Verification | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-06-30 | Audit and planning | Completed full UX audit, approved direction, and durable implementation plan | Read-only browser audit; no product files changed | Begin Phase 0 in a fresh session |
| 2026-06-30 | Phase 0 | Preserved 13 baseline states, approved seven coordinated references, and locked the visual/component/responsive specification and copy list | In-app browser at 1440×900 and 390×844; full-resolution `view_image` inspection; `npm run verify` passed | Begin Phase 1 design foundations without changing information architecture yet |
| 2026-06-30 | Phase 1 | Added the exact token/type/spacing/radius/elevation/motion system, semantic controls and states, unified focus/touch behavior, bundled icon grammar, reduced-motion coverage, and layout-stable loading geometry | In-app and deterministic browser inspection at desktop, mobile portrait, and mobile landscape; touch emulation found zero visible sub-44 px targets across main/settings/packs/detail/share/sign-in; `npm run verify` passed (190 Node, 3 Deno, 22 E2E) | Begin Phase 2 with desktop ranking ownership at approximately 60–65% of the primary workspace |
| 2026-06-30 | Phase 2 | Rebuilt the app shell around Rank / Discover / Lists destinations, made the ranking the desktop primary workspace, moved Add/Search and continuation support into the rail, separated mobile discovery and lists, and added tested per-destination scroll restoration | In-app browser at desktop and mobile widths; deterministic screenshots for desktop/mobile main and comparison geometry; `npm run verify` passed (194 Node, 3 Deno, 23 E2E) | Begin Phase 3 shared MovieItem and PackCard anatomy without changing ranking/search/persistence semantics |

## Fresh-session handoff

Start a new implementation session with this instruction:

> Read `AGENTS.md` and `notes/feature-ideas/design-audit.md` in full. Treat the approved Phase 0 references and exact written specification as the source of truth. Phase 2 is complete and shipped locally; begin at the first unchecked task in Phase 3, preserve product behavior, and do not start Phase 4 until the shared content component acceptance gate passes rendered desktop/mobile verification and `npm run verify`. Update the checklist, decision log, and progress log; bump every relevant cache key. Do not commit or push unless I explicitly ask.

The audit, reference assets, and baseline capture changes remain uncommitted. Preserve them and include them only if the product owner later requests a commit.
