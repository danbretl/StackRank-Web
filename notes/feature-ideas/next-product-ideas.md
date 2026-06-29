# Three product ideas to revisit

Status: **brief concepts, not roadmap commitments (2026-06-28).**

## Pick something for tonight

Turn **Watch next** into a small decision tool. The user supplies the time they
have and, optionally, a genre; StackRank returns three queue candidates using
runtime and the rank-weighted taste signals already in the app. This would close
the loop from discovery → save → choose → watch → rank without using TMDB
ratings. The first version should make no persistent choice on the user's
behalf.

## Automatic list lenses

Derive focused rankings such as **My horror ranking**, **My 1990s ranking**, or
**Christopher Nolan in my ranking** from the master list. A lens preserves the
movies' existing relative order, so it needs no second ranking or persistence
model. The first slice now ships inside Taste Explorer for recurring
genre/era/person signals. Possible follow-ups are independently addressable
lenses and Share Studio exports.

## Comparison trail / placement receipt

The existing completion message already says where a movie landed and names its
neighbors. Extend that into an optional receipt showing the comparisons that
produced the placement, with immediate **Undo** and **Re-rank** actions. This
would make binary insertion easier to understand and help catch accidental taps
while the decisions are still fresh. Avoid retaining a permanent behavioral
history unless there is a clear product need.
