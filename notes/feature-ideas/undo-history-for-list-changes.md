# Feature idea: Undo history for list changes

Status: exploratory

## Summary

Add short-lived undo for meaningful list changes. Toast notifications already provide feedback; this would make them actionable when the user wants to reverse a recent change.

## Problem

The app now has several actions that move or remove movies:

- Rank a movie
- Save a suggestion to Watch next
- Hide a suggestion as Not for me
- Move between Watch next and Not for me
- Remove from a queue
- Remove from the ranked list
- Clear the ranking

Some of these actions are easy to tap accidentally on mobile. Current feedback confirms what happened, but it does not offer a direct recovery path.

## Proposed flow

1. User performs an action.
2. Toast appears in the bottom-left corner.
3. Toast includes a compact `Undo` action when the change is reversible.
4. User taps `Undo`.
5. App restores the previous state and shows a confirmation toast.

Example messages:

- `"The Matrix" moved to Watch next. Undo`
- `"Jaws" moved to Not for me. Undo`
- `"Moonlight" removed. Undo`
- `Ranking cleared. Undo`

## Suggested first version

Implement a single-level undo stack for queue and ranking list actions:

- Store the previous state snapshot before an action.
- Show undo in the toast for 4 to 5 seconds.
- If another action happens, replace the previous undo.
- Do not attempt multi-step history at first.

## Why this may be worth doing

- Makes the app feel safer.
- Reduces frustration from accidental taps.
- Pairs naturally with the new toast system.
- Avoids extra confirmation dialogs for common actions.

## Why this may not be worth doing

- Snapshotting too much state could become messy if not kept simple.
- Undo after server sync needs careful ordering.
- A visible action inside the toast may complicate the current passive toast design.

## Implementation notes

- Add `lastUndoAction` state with:
  - `label`
  - `restore`
  - `expiresAt`
- Extend `setAddFeedback` to optionally render an action button.
- Keep the toast non-blocking and avoid trapping focus.
- For server-backed lists, restore locally immediately and then save the restored state.
- Start with easy reversible actions:
  - Save suggestion
  - Hide suggestion
  - Remove from Watch next
  - Remove from Not for me
  - Remove from ranking

Avoid implementing undo for comparison decisions until the interaction model is clear, because the ranking flow already has `Undo last choice`.

## Acceptance criteria

- Recent queue/ranking changes can be undone from the toast.
- Undo restores the movie to the correct previous list and position where practical.
- Undo action expires after the toast disappears.
- A second action replaces the previous undo rather than creating a complex history.
- Signed-in users get the restored state synced server-side.

---

## Implementation plan (2026-06-26)

### Design decisions

- **Single-level, snapshot-based.** Before any undoable mutation, snapshot the
  affected module arrays (`ranking`, and/or `watchList` + `notInterestedList`).
  Undo = reassign the array(s) to the snapshot, persist, re-render. Snapshotting
  the *whole* affected list (not a diff) makes position-restore free and keeps the
  restore closures dead simple. Lists are small; the cost is negligible.
- **Reuse the existing action-toast.** `setAddFeedback(msg, duration, actions)`
  already renders action buttons (the pack-discovery nudge proves it, and the
  click bug there is now fixed). Undo is just an `actions: [{label:"Undo", …}]`
  entry — no new toast system, no focus trap.
- **Lifecycle lives in a pure `lib/` module.** `lib/undo.js` exports
  `createUndoController()` — a DOM-free single-level store of
  `{ label, restore, expiresAt, token }` with `set / peek / consume / clear`.
  Token + expiry guard against double-consume and stale clicks. The *restore
  closures* stay in `app.js` (they reassign module-level `ranking` /
  `watchList` / `notInterestedList`, which a `lib/` module can't reach).
- **Restore re-saves.** Restore calls the same `saveRanking()` /
  `saveSuggestionQueues()` paths, which stamp a fresh `updated_at`. Because the
  merge-on-load keeps the newest snapshot, the restored state wins on next load
  for signed-in users — no special server ordering needed.
- **Scope:** save suggestion, hide suggestion, move between queues, remove from a
  queue, remove from ranking, clear ranking. **Not** comparison decisions — the
  ranking flow already owns *Undo last choice* / *Cancel ranking*.
- **Mobile:** restore must never `focus()` the title input (keyboard-pop bug);
  `blur()` only.

### Phases

0. **`lib/undo.js` + `tests/undo.test.js`** — pure controller; invariants:
   set→consume returns the fn; second consume is null; expired returns null; a
   new `set` invalidates the old token; `peek` reflects active/expired.
1. **app.js plumbing** — import controller, add `UNDO_TOAST_MS` (5000), a
   `setUndoableFeedback(message, restore, duration?)` helper, and two snapshot
   helpers (`snapshotQueues()`/`restoreQueuesTo(snap)`,
   `snapshotRanking()`/`restoreRankingTo(snap)`), each ending in a
   `"Change undone."` confirmation toast and a full surface re-render.
2. **Wire the six actions** — snapshot before mutation; swap the trailing
   `setAddFeedback(...)` for `setUndoableFeedback(...)`. Add a toast to the two
   actions that currently have none (remove-from-ranking, clear-ranking).
3. **Diligence pass** — verify both-list snapshots for moves; guard restore when
   a comparison is `pending` where it would conflict; confirm no `focus()` on the
   restore path; confirm suggestions/pack surfaces re-render.
4. **Validate** — `npm run verify` (unit incl. new test, `node --check`, deno,
   e2e) + browser smoke of each undoable action.

### Touch points (line numbers drift — grep to confirm)

- `addSuggestionToQueue` (~5384) — save/hide.
- `moveQueueMovie` (~5470) — queue↔queue.
- `removeQueueMovie` (~5506) — queue remove.
- ranking delete handler (~1532) — remove from ranking (no toast today).
- clear handler (~1399) — clear ranking (no toast today).
- `setAddFeedback` (~1723) — action-button host (unchanged).

### Follow-up shipped: undo a completed ranking (2026-06-26)

The original note deferred undo for the ranking flow. We added it for the
**completed placement** (not single comparison choices — those keep *Undo last
choice* / *Cancel ranking*). A completed ranking's "before" state depends on the
movie's origin (fresh add vs. a queue row vs. a restack), so instead of
reconstructing the origin we snapshot **all three lists** (`ranking` + both
queues) at the moment ranking *starts* — captured in `startRankingMovie` (before
the movie is pulled from its queue) and in the restack handler (before the
splice) into `pendingRankingSnapshot`. Both settle points (the immediate
top-pick branch in `startComparison` and the binary-search settle in
`handleDecision`) route their placement toast through `announcePlacement()`,
which offers undo via `restoreListsTo(snapshot)`. Undo is suppressed during an
**auto-pack** run (the flow advances to the next comparison immediately, so a
single-level undo can't apply cleanly). The snapshot is cleared on cancel and on
each settle. Verified in-browser including the cross-list case (rank a Watch-next
movie → undo returns it to Watch next and removes it from the ranking).

### Follow-up shipped: pack-specific undo cases (2026-06-26)

Two cases the whole-list snapshot couldn't cover:

- **Auto-pack ("rank all") placement.** By the time the placement toast is
  tappable the flow has already advanced to the NEXT movie's comparison (which
  may itself have been pulled from a queue), so restoring a whole-list snapshot
  would clobber it. Instead `announcePlacement` routes auto-pack placements to
  `undoAutoPackPlacement(movie, origin)`, which surgically unranks just that
  movie (and returns it to its origin queue if it had one), leaving
  `autoPackSession` and the in-progress comparison intact — the user keeps
  ranking the next movie. Because removing a movie shifts the ranking the active
  comparison is binary-searching, we restart that movie's search against the
  corrected list (free in the common case: undo is tapped right after placement,
  before any new comparisons are answered). If the list empties under the
  in-progress movie, the empty-list path re-places it as the new top pick. Pack
  completion self-heals via `syncPackCompletion` on re-render, so pack progress
  doesn't need snapshotting. Verified: rank pack movies via Rank all → undo the
  prior one → it leaves the ranking, the next movie keeps comparing and then
  settles correctly via a fresh multi-step search; no errors.
- **Bulk "Save all" / "Hide all"** (`addPackRemainingToQueue`). Snapshots all
  lists before the bulk move and offers undo via `restoreListsTo`, reverting
  every save/hide the action made back to the prior queue state — however many
  moved (verified: 11 → undo → 0). `restoreListsTo`'s confirmation toast is the
  neutral "Change undone." since it now serves both completed-ranking and
  bulk-queue undos.

