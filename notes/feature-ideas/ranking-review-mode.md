# Feature idea: Ranking review mode

Status: exploratory

## Current implementation leverage (2026-06-27)

This remains unbuilt, but recent work lowered its risk:

- Comparison cards, mobile ballot layouts, and ranking persistence already exist.
- `rankedAt` and comparison counts can help choose useful review pairs.
- The new single-level undo controller can make each accepted swap reversible.
- The E2E harness can seed deterministic rankings and exercise a complete review
  session.

The product question is now narrower: which pairs produce enough value to avoid
review feeling like random busywork? Adjacent pairs near recent additions are
still the safest v1.

## Summary

Add a lightweight review flow that helps users refine an existing ranking without needing to manually choose individual movies to restack. The app would surface pairs or small local neighborhoods from the current ranking and ask whether the order still feels right.

## Problem

The core value of StackRank is a ranked list the user trusts. The current comparison flow is good for inserting one movie at a time, but it does not give the user an easy way to audit the list once it grows.

Common user questions this could answer:

- Do I still agree with the top 10?
- Are there obvious mistakes in the middle?
- Did an accidentally chosen comparison put something too high or too low?
- Has my taste shifted since I first ranked these?

## Proposed flow

1. User clicks a `Review ranking` control near the current ranking section.
2. App creates a short review queue from the current list.
3. User sees one comparison at a time, similar to the existing ranking UI:
   - Movie A
   - Movie B
   - Prompt: `Still prefer this order?`
4. Actions:
   - Keep order
   - Swap
   - Skip
   - End review
5. At the end, show a short summary:
   - Number reviewed
   - Number changed
   - Optional toast: `Ranking review complete. 3 swaps made.`

## Candidate review strategies

### Adjacent pair review

Compare neighboring movies such as #4 vs #5 or #18 vs #19.

Pros:
- Simple mental model.
- Swapping has obvious consequences.
- Low implementation risk.

Cons:
- May require many comparisons to produce meaningful changes.
- Only catches local mistakes.

### Confidence-gap review

Prioritize placements that were made with fewer comparisons or older decisions.

Pros:
- Feels smarter and less random.
- Makes use of existing `comparisons` metadata.

Cons:
- Current metadata may not be rich enough to identify true uncertainty.

### Section review

Let the user choose a section to review: top 10, middle, bottom, or recent additions.

Pros:
- Gives user control.
- Natural fit for long lists.

Cons:
- More UI decisions up front.

## Suggested first version

Start with adjacent pair review:

- Add a `Review ranking` button.
- Generate 5 to 10 adjacent pairs from the current ranking.
- Favor pairs near recently added or recently moved movies.
- Keep the UI visually close to the current comparison screen.
- Implement only `Keep`, `Swap`, and `End review`.

This gives the feature a narrow first release while still testing whether list review feels valuable.

## Why this may be worth doing

- Makes the ranked list feel more trustworthy.
- Creates a reason to return after the user has already ranked many movies.
- Uses the product's central interaction pattern instead of introducing a new mode.
- Helps users improve the list without needing to know which item is wrong.

## Why this may not be worth doing

- Could feel tedious if the app asks too many low-value comparisons.
- Swapping adjacent pairs may not be enough to fix major ranking errors.
- Adds another mode to an already interaction-heavy app.

## Implementation notes

- Add review state separate from `pending` ranking state:
  - `reviewQueue`
  - `currentReviewPair`
  - `reviewChanges`
- Disable or hide add/search controls while review mode is active.
- Reuse the compact comparison card styling if possible.
- Keep review operations local and save the whole ranking after each swap.
- Make swaps undoable through the existing action toast.
- Toast after completion with a concise summary.

## Acceptance criteria

- User can start a ranking review from the current ranking section.
- User can compare two existing ranked movies without adding a new movie.
- User can keep order, swap order, skip, or end review.
- Swaps persist locally and server-side for signed-in users.
- User can leave review mode without losing the current ranking.
- Mobile layout fits the active comparison without requiring unnecessary scrolling.
