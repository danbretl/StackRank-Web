# Public-share browser regression review — October 9, 2026

Scope: SR-01 and SR-04 client changes, with hostile-text and session-isolation controls. The flow under test is opening a Movies or Dogs shared link with synthetic session/API states and confirming a read-only snapshot or a clear unavailable state. This is the new security correction, not Dogs catalog adjudication.

## Result

The source-tree run passed **24/24 cases**, with unchanged hashes for both viewers, their HTML entry points and `lib/public-share-reader.js` throughout the run. The final staged-tree repeat is owned by the release lead through `npm run verify`; this initial result alone does not certify the release or live database protection.

Command: `node scripts/test-security-browser.cjs`.

Local, ignored evidence: `reports/security-browser/2026-10-09T05-27-42-422Z/results.json`. This records request traces, DOM state, console events, timestamps, source hashes and the effective CSP. Eight adjacent PNGs cover Movies/Dogs at 1280×900 and 390×844, with and without CSP. The Movies CSP phone and Dogs CSP desktop screenshots were visually inspected: content renders, hostile strings remain literal text, and there is no horizontal overflow or application error overlay. Movie card labels retain their existing compact truncation; the detail dialog shows the text safely.

## Cases and evidence

Each viewer passed these eleven no-CSP cases:

- Anonymous session, present stored session, expired stored session, and URL magic-link fragment all render the successful RPC response.
- A missing-function `PGRST202` response alone permits the scoped legacy table lookup, with only public columns and exact slug/category/revocation filters.
- Missing and revoked RPC results render unavailable states without a table fallback.
- Permission and server errors render error states without a table fallback.
- Owner-bearing and wrong-slug responses are rejected without rendering a card or falling back.

Two additional cases render hostile content under the production CSP. The only CSP change is adding the loopback synthetic API origin to `connect-src`; script, attribute and DOM protection directives are unchanged. No-CSP cases prove that CSP is not masking unsafe text insertion.

Every case verifies page title/path/state, exact request arguments, anonymous publishable-key authorization, absence of Auth requests, unchanged local/session storage, and unchanged token fragments. Successful rows contain `<img ... onerror=...>` text; no injected element is created and no handler executes. The Movies interaction opens the real detail dialog, safely renders hostile returned detail strings, then closes it. The Dogs CTA destination remains `/dogs`.

Console checks found no uncaught exceptions or unexplained warnings. Deliberately failed share requests produce the expected viewer warning. External font attempts are blocked and recorded; no unexpected application fetch or other external request is permitted.

## Implementation and environment

`scripts/test-security-browser.cjs` uses the existing `scripts/testing/data-safety-browser.cjs` Chrome/CDP launcher and static server, with a separate bounded synthetic HTTP service. The actual vendored Supabase client and application modules run unchanged. Chrome has fresh profiles, external DNS denial, and a CDP origin allowlist. The transport wrapper redirects only production Supabase URLs to the local mock. No customer data, credentials, real account writes, dependencies, original audit scripts or original audit fixtures are used.

Browser plugin classification: **not available**. Following the frontend testing skill's preference for an existing repository E2E workflow, the repository's dependency-free CDP workflow was reused; no Playwright installation was required. Localhost binding/Chrome launch required the normal sandbox escalation. The first focused draft run had a harness-only failure because it treated an explicitly blocked font as unexpected traffic; the corrected assertion still rejects all other external attempts.

Two narrow RPC fixture branches were added to `scripts/run-e2e-smoke.cjs`. They project public fields and filter revoked snapshots while preserving the existing owner publishing, update and revoke table behavior. Existing full E2E and data-safety suites remain the release lead's validation for publishing, backup, recovery and account isolation; this viewer-focused harness does not replace them.

The package's staged command uses `SECURITY_SERVE_ROOT=dist/public`. The harness aliases that to the shared helper's serve-root setting and records the actual served root and hashes. `SECURITY_BROWSER_ONLY` permits a targeted case selection, while `SECURITY_BROWSER_REPORT_DIR` chooses an evidence directory.

## Limits

The HTTP service is a client behavior fixture, not a PostgreSQL/PostgREST emulator or evidence that grants/RLS/functions are deployed. Native database tests and action-time approval of live security settings are separate release requirements. Production headers, live query restrictions, older cached viewers and cross-browser behavior are not proven by this run. Screenshot fonts use browser fallback because remote font retrieval is intentionally blocked. No customer snapshot was opened and no production enumeration or attack was performed.
