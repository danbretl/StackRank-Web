# Movies and Dogs accessibility corrections

The supported focus and naming defects are corrected without visual redesign.
Baseline: `d4eb829631065d6d070475d569e1ec1aebb43a1d`; original accessibility audit:
`849fb5b924d4c66255fd66c326959f7c7f35861d`. Security cutover completed first: both
approved SQL migrations are live, exact CI37897518567 passed and Vercel is READY
at d4eb8296. Its final receipts are committed alongside this follow-on.

## Behavior and adjudication

- Dogs Settings → sign-in/backup/export returns focus to the Settings toggle after
  Escape or Close; Settings Escape also restores its toggle. The dialogs are named
  using their existing visible headings. Restoration is limited to these utility
  dialogs so pack and comparison/About paths keep their specialized behavior.
- Cancelling queue-started Dogs ranking returns focus to the initiating Rank action.
  Stable ID/list lookup handles rerendered rows. Deferred scroll/focus callbacks
  check the account-owner generation before acting; queue data stays unchanged.
- Movies and Dogs publishing, and Movies PNG actions, hand focus to an enabled
  Close control before disabling the action. Async completion never returns focus
  to a stale initiating control or reopens a closed dialog. Movies synchronous
  preview replacement preserves the semantic control the user currently selected.
- Dogs pending/error sharing messages survive ordinary same-owner UI refreshes.
  Status is held in transient share state, cleared on success or owner reset.
  Network requests, account writes, snapshot payloads and security rules are unchanged.

`dispositions.json` covers all7 audit findings,9 rejected alerts and3 discoveries.
Dogs01/02/03/07 and Both04 are fixed. General comparison-completion focus (Both05)
and Movies search-cancel behavior (Movies06) are retained: placement is announced
in existing status regions and search cancellation avoids reopening a mobile keyboard.
These are explicit retained limitations/intent, not claims of comprehensive conformity.
The audit's combined publish/download final measurement did not isolate publish
completion; the new probes test those stages separately.

## Verification

Final staged Playwright coverage:68/68 passed in Chromium151.0.7922.34 and WebKit26.5
(Playwright1.62.1), with stable runtime hashes. Coverage includes forward/reverse
Tab (Option-Tab for WebKit), repeated utility-dialog opening/closing, Escape/cancel,
computed dialog names, queue retention, nested About/pack/share restoration, held
publishing success/failure, navigation/closure during a request, owner-switch callback
rejection, ordinary unchanged-account refresh, desktop/phone viewports and actual
PNG/ZIP completion. Image-set completion preserves the chosen preview card.

Nine zero-dependency Chrome/CDP keyboard cases are part of `npm run verify` and CI.
Their original-baseline failures were demonstrated; synthetic records only, with
no DOM click used as keyboard proof. The broader two-engine suite runs using
`A11Y_PLAYWRIGHT_PATH=<installed playwright> A11Y_SERVE_ROOT=dist/public npm run test:accessibility:browser`.
No app/browser dependency was installed. Browser plugin was unavailable.

Final `npm run verify` passed with exit 0: **660 Node, 58 Python, 27 Deno plus
12 steps, 44 staged smoke flows, 45 data-safety, 24 security-browser and 9 native
keyboard cases**. All validators, cache checks and deterministic deployment checks
passed. See `local-verification.json`; the 2,172-file staged site contains 173,234,357
bytes. Commit/CI/production receipts are pending publication. An earlier frozen-tree aggregate
run passed all 44 smoke cases but one of 45 data-safety cases timed out awaiting its
second account PATCH. The latest `[900003]` device state remained durable, sync stayed
visibly pending, and no newer payload was sent before local saving. Two unchanged focused
reruns passed, including network diagnostics. No supported fixture or runtime cause was
isolated; recorded network aborts lacked URL correlation. The failed aggregate and both
passing reruns are retained under `reports/data-safety/`; no speculative persistence fix
was made. A later native CDP run had three utility-close focus failures despite the
68-case staged two-engine pass; the solo reproduction traced a hidden browser target deferring native close-event delivery.
The CDP harness now brings the target to the foreground and asserts visibility before
each actual key. No DOM focus override or relaxed assertion was added; all nine cases
passed on Chrome 155.0.8059.40, with native close events recorded. The reason Chrome
hid the target remains unproven. See `browser-review.md` and `aggregate-attempts.json`.
A pre-freeze aggregate run sampled an empty boot shell after a phone-layout reload.
The test now waits for the existing persistence-ready signal, six fixture movies and
six loaded packs before measuring; geometry assertions were not weakened. Earlier
probe setup issues (canonical fixture labels and browser-local blob routing) are
recorded separately from product defects. Independent review found no remaining
material source blocker; see `independent-review.md` and its exact hashes.

## Limits, preservation and rollback

No real accounts, emails, customer records or production writes are used by browser
verification. Synthetic transport tests do not certify real Auth delivery or screen-reader
speech. VoiceOver/NVDA, physical devices, actual Safari, OS zoom and forced colors
remain untested. This is not a WCAG conformance certification. Fonts/provider content
are blocked in isolated fixtures and read-only production renders as documented.

All14,272 original audit/source/dependency entries rehashed unchanged. Original archives,
prior worktrees and unrelated main untracked files remain in place; off-Mac backup is
unverified. Reports/screenshots/native browser profiles stay outside public output.
Vercel continues to deploy `dist/public`; GitHub Pages remains disabled.

Rollback of these UI changes can revert the accessibility product commit while preserving
the security cutover and its RPC-capable viewers. No schema or data rollback is required
or authorized. Never apply the earlier weakening SQL rollback without separate approval.
