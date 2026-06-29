# V1 stabilization

Status: **in progress (started 2026-06-29).**

This is the active release-quality plan after the initial Movies feature set
shipped. The goal is to improve correctness, accessibility, resilience, trust,
and operational confidence without adding speculative product surface.

## Working rules

- Complete and verify one area at a time.
- Commit and push each finished area independently.
- Prefer fixes that protect the core rank/save/sync/export flows.
- Do not deepen packs, review, sharing, recommendations, or onboarding until
  usage evidence supports it.
- Preserve the no-build, no-framework browser architecture.
- Keep this file current so work can resume after a context reset.

## Baseline (2026-06-29)

- `main` was clean and matched `origin/main` at `5ab31d1`.
- Production `/` redirects to `/movies`; `/movies` returns the current app.
- A production browser smoke rendered the empty-list experience with no console
  warnings or errors.
- The repository had no actionable `TODO` / `FIXME` markers.
- Existing automated coverage was green at the Movies URL rollout: 171 unit
  tests plus 16 deterministic browser flows.

Initial gaps found:

- The document has no `h1`.
- Suggestion, queue, pack-movie, and full-screen cards use focusable
  `role="button"` containers that also contain real buttons.
- Focus trapping is implemented for sign-in and the full-screen ranking, but
  not consistently for the other modal surfaces.
- Production responses do not yet send a project-defined CSP or the baseline
  `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers.
- There is no public privacy page despite optional account sync and anonymous
  product telemetry.
- Production magic-link rendering, signed-in restore, social-preview clients,
  and iPhone Safari export behavior still need real-service/device checks.

## Area 1 — accessibility and interaction correctness

Status: **complete (2026-06-29).**

Scope:

- Establish one `h1` and a coherent heading outline.
- Remove nested interactive semantics from movie cards while preserving the
  fast whole-card pointer affordance.
- Give every card action a native keyboard-reachable control.
- Share one modal focus-trap implementation across detail, packs/import, Share
  Studio, full-screen ranking, sign-in, and the lightbox.
- Prevent focus from reaching background content while a modal is active.
- Verify focus restoration for nested modal flows.
- Add deterministic E2E assertions for semantic structure and focus behavior.
- Run desktop and mobile rendered QA with clean console output.

Acceptance:

- No focusable interactive element contains another focusable interactive
  element in the tested home, queue, pack, and full-screen states.
- Every modal wraps Tab/Shift+Tab and returns focus to its opener.
- Core Rank, Details, Save/Hide, Re-rank, and Remove actions remain operable.
- `npm run verify` passes.

Shipped implementation:

- The StackRank brand is the document's single `h1`.
- Suggestions and queue rows expose a native primary Rank button; full-screen
  cards expose a native primary Details button; pack movie groups keep their
  explicit Rank/Save/Hide buttons with movie-specific accessible names.
- Whole-card pointer affordances remain, without placing real buttons inside a
  focusable `role="button"` container.
- One focus-trap/isolation path now covers every modal layer. Background
  siblings become `inert`, nested detail/lightbox flows isolate the top layer,
  and closing restores focus after removing inertness.
- Full-screen arrow navigation and pointer drag now target the native primary
  control; drag ghosts are inert and hidden from assistive technology.
- E2E assertions cover the heading, suggestion/queue/pack/full-screen
  semantics, sign-in isolation, nested detail focus wrapping/restoration,
  desktop/mobile geometry, and clean runtime health.
- Rendered QA passed at 1280×720 and 390×844 with no overflow or console
  warnings/errors. `npm run verify` passed with 171 unit tests, all function
  checks/tests, pack validation, and 16 browser flows.

## Area 2 — service and network resilience

Status: **complete (2026-06-29).**

Scope:

- Exercise TMDB search/suggest/detail/image failures and recovery.
- Exercise Supabase auth/read/write timeouts and rejected writes.
- Confirm local-first behavior never blocks ranking or loses a newer snapshot.
- Improve only user-visible failure states exposed by those tests.
- Add regression coverage for each corrected case.

Acceptance:

- Core local ranking remains usable with Supabase unavailable.
- Search/detail/suggestion failures are honest, bounded, and recoverable.
- Failed remote writes cannot silently discard a local change.
- `npm run verify` passes.

Shipped implementation:

- Browser-storage reads/writes are tracked by surface (ranking, queues, packs,
  Share options). A failed core write keeps the in-memory app usable and shows
  `Could not save in this browser. Download a backup before leaving.` until
  that surface successfully persists again.
- The storage-failure E2E forces `QuotaExceededError`, completes a ranking,
  proves the older local snapshot was not overwritten, and validates that the
  downloadable in-memory backup contains the new movie.
- User-data Supabase reads/writes share a rejection-safe wrapper. Network
  rejection or API errors cannot escape as unhandled promises; the UI says
  changes are saved locally, and a later successful write clears the warning.
- Signed-in E2E now moves a queue item while remote writes reject, verifies the
  user-scoped local snapshot, then restores the connection and proves the next
  write resyncs.
- TMDB suggestion sections replace failed skeletons with an honest error state
  and leave the existing refresh control enabled. Autocomplete shows a bounded
  unavailable message, and movie details expose a Retry action.
- Magic-link/OAuth/sign-out network calls and anonymous telemetry writes now
  catch thrown network failures and reset their busy/error UI safely.
- The E2E seeding reload is issued as a separate CDP command, removing a
  nondeterministic execution-context teardown race.
- Rendered failure/normal-state QA passed with clean console output.
  `npm run verify` passed with 171 unit tests, all function checks/tests, pack
  validation, and 18 browser flows.

## Area 3 — security and privacy

Status: **pending.**

Scope:

- Add and test baseline production security headers.
- Build a CSP from the app's actual script, font, image, connection, worker,
  blob, and data requirements; avoid breaking Supabase Auth or image export.
- Add a concise public privacy page covering browser storage, optional Supabase
  sync, TMDB requests, product telemetry, DNT/GPC, and data recovery/removal.
- Link it quietly from the footer and sign-in view.

Acceptance:

- Route/header tests cover `/movies` and `/privacy`.
- Auth, posters, fonts, analytics, and export continue to work under the policy.
- Public privacy copy matches the implementation.
- `npm run verify` passes.

## Area 4 — production rollout closeout

Status: **pending; some checks require account/device access.**

Autonomous checks:

- Re-run production route, metadata, asset, and console smoke tests.
- Verify deploy output after each pushed area.
- Document exact manual checks that cannot be completed without a controlled
  inbox, OAuth console access, or physical Apple device.

External checks:

- Branded magic link in Gmail and Apple Mail.
- Google OAuth configuration and round trip; Apple remains optional.
- Signed-in production backup restore, including remote pack progress.
- Link preview in Apple Messages.
- iPhone Safari ranking, canvas PNG, ZIP download, native share, and lightbox.
- Decide when the legacy GitHub Pages recovery origin can be retired.

## Area 5 — surface simplification review

Status: **pending until the initial telemetry window matures.**

- Inventory every home-page surface and its entry conditions.
- Review activation and feature adoption on 2026-07-12; extend to 2026-07-28
  if fewer than 50 first-run exposures exist.
- Prefer hiding, collapsing, or removing weak surfaces over adding new ones.
- Record recommendations separately from implementation so pruning remains an
  explicit product decision.

## Progress log

- **2026-06-29:** Created the stabilization plan and production baseline.
- **2026-06-29:** Completed Area 1 accessibility and interaction correctness;
  full verification and rendered desktop/mobile QA passed.
- **2026-06-29:** Completed Area 2 service/network resilience; storage,
  TMDB/auth, and rejected Supabase write recovery are covered by browser tests.
