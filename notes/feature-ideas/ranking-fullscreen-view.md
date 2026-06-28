# Full-screen ranking view

**Status: v1 shipped (read-only) — Jun 2026.** Requested by Catie: a way to see the whole ranked list "all at once" in a roomy multi-column layout, rather than scrolling the single-column side panel.

## What shipped (v1, read-only)

- An **expand icon button** in the Current ranking panel header (next to Filter / Share / Settings), disabled when the list is empty.
- Opens a full-viewport modal overlay (`#ranking-fullscreen`) titled "Current ranking" with a subtitle count, a close (×) button, and a responsive grid of compact movie cards.
- Each card is a poster (2:3) with a rank-number badge top-left, the title, and the year. Posters lazy-load; missing posters fall back to a titled placeholder tile.
- Grid is `repeat(auto-fill, minmax(132px, 1fr))` (104px on mobile) so it fills however many columns the screen allows.
- Dismiss via × button, backdrop click, or Esc. Reuses the share-studio body scroll lock (`lockShareScroll`/`unlockShareScroll`) and restores focus to the trigger on close.
- **Intentionally view-only**: no drag, re-rank, remove, or detail-open from this view yet (kept simple to ship; interaction adds real complexity around the shared drag/restack code paths).

Code: `openFullscreenRanking` / `closeFullscreenRanking` / `renderFullscreenRanking` in `app.js`; markup in `index.html` (`.fullscreen-overlay`); styles under `.fullscreen-*` in `styles.css`.

## Planned follow-ups (not built)

1. **Interaction parity with the side panel.** Allow opening the movie detail pane from a card (cheapest first step — detail is already modal-friendly), then Re-rank (restack) and Remove. These reuse existing per-movie handlers keyed by ranking index, so they're low-risk once the click targets exist.
2. **Drag-to-reorder in the grid.** The hard one. The current pointer-drag logic (`updateDragLayout`) assumes a single vertical column and computes drop position from item midpoints. A 2-D grid needs new hit-testing (row/column → linear index) and a different insertion animation. Treat as its own project; consider whether reordering across many columns is even desirable vs. confusing.
3. **Honor / surface the inline filter.** v1 always shows the entire list. Could mirror the panel's text filter, or add its own search box in the header, so users can full-screen a filtered subset.
4. **Density / size controls.** A toggle for poster size (compact ↔ large) or posters-only vs. posters+titles, echoing Share Studio's whole-list styles.
5. **Jump-to and keyboard nav.** Arrow-key focus traversal between cards; "scroll to #N" affordance for very long lists.
6. **Entry points.** Consider opening full-screen from the Share Studio or from a long-press on the panel, and remembering the last-used view.

## Notes / gotchas

- Keep it read-only until interaction is explicitly scoped — half-wired drag in a grid is worse than none.
- If detail-open is added, make sure closing detail returns focus into the full-screen overlay, not the underlying page.
- Watch the "after ranking, `blur()` not `focus()`" rule if Re-rank is ever launched from here (recurring mobile-keyboard bug).
