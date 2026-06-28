# Full-screen ranking view

**Status: v2 shipped (interactive) — Jun 2026.** Requested by Catie: a way to see the whole ranked list "all at once" in a roomy multi-column layout, rather than scrolling the single-column side panel.

## What shipped

- An **expand icon button** in the Current ranking panel header (next to Filter / Share / Settings), disabled when the list is empty.
- Opens a full-viewport modal overlay (`#ranking-fullscreen`) titled "Current ranking" with a subtitle count, a close (×) button, and a responsive grid of compact movie cards.
- Each card is a poster (2:3) with a rank-number badge top-left, the title, and the year. Posters lazy-load; missing posters fall back to a titled placeholder tile.
- Grid is `repeat(auto-fill, minmax(132px, 1fr))` (104px on mobile) so it fills however many columns the screen allows.
- Dismiss via × button, backdrop click, or Esc. Reuses the share-studio body scroll lock (`lockShareScroll`/`unlockShareScroll`) and restores focus to the trigger on close.
- Tapping/clicking a card opens the existing movie-detail pane; closing detail
  returns focus to that grid card.
- Every card has **Re-rank** and **Remove** actions. Re-rank enters the normal
  binary-insertion flow; Remove keeps the grid open and is undoable.
- The header has title/year filtering, Comfortable/Compact density, and **Jump
  to rank**. Reordering is disabled while filtered so hidden movies cannot make
  the drop result ambiguous.
- Arrow keys traverse the responsive grid; Home/End jump to its bounds;
  Enter/Space open details. Tab focus is contained inside the modal.
- **2-D pointer drag reorder ships:** drag anywhere on desktop or use the poster
  handle on touch. Nearest-card hit testing maps the pointer back to a linear
  rank, edge proximity scrolls the grid, and the resulting move is persisted and
  undoable.

Code: `openFullscreenRanking` / `closeFullscreenRanking` /
`renderFullscreenRanking` and the fullscreen drag handlers in `app.js`; pure
filter/navigation/drop/reorder helpers in `lib/fullscreen-ranking.js`; markup in
`index.html` (`.fullscreen-overlay`); styles under `.fullscreen-*` in
`styles.css`.

## Validation

- `tests/fullscreen-ranking.test.js` covers filtering, keyboard target math,
  immutable moves, and 2-D drop targeting.
- The E2E smoke covers open/filter/density/detail/remove+undo/re-rank+cancel/drag
  persistence against the real app.
- Interactive browser QA passed at desktop 1280×720 and mobile 390×844 with no
  overflow or console errors.

## Potential follow-ups

- Add a keyboard-accessible reorder command if pointer drag proves insufficient
  for accessibility.
- Persist the last density selection if users repeatedly change it.
- Additional entry points (Share Studio or long-press) remain intentionally
  unbuilt; neither currently improves the primary ranking workflow enough to
  justify extra modal coupling.
- Keep the "after ranking, `blur()` not `focus()`" rule for Re-rank changes.
