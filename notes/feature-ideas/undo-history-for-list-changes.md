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

