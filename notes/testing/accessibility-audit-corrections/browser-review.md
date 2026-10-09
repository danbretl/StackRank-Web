# Accessibility browser verification — October 9, 2026

The final staged application passed **68/68 keyboard/browser cases** in Chromium 151.0.7922.34 and WebKit 26.5, using the already-installed Playwright 1.62.1. The run served `dist/public`, completed from 07:24:52 to 07:25:39 UTC, and exited 0. The four runtime/entry-point hashes were unchanged throughout and match the working tree. `browser-receipt.json` retains the compact case ledger, hashes, versions and completed-download evidence.

## Independent baseline

The immutable accessibility audit app was served read-only. The corrected baseline run recorded four passing Movies controls and fourteen expected failures across both engines: Dogs dialog names and return focus, Dogs queue cancellation, publish busy/completion focus, and Movies PNG completion focus. Baseline evidence: `reports/accessibility/2026-10-09T07-20-06-654Z/results.json`. The audit app hashes remained unchanged.

WebKit's real PNG download is now independently measured. Its browser-local `blob:` URL passes through Playwright's route hook; the old audit-style routing interpreted that URL as a filesystem path and returned 404. The new fixture allows browser-local blob/data/about URLs without allowing an external network request. Both engines completed the baseline PNG export, then failed the usable-focus assertion. This extends the original audit's Chromium-only completion evidence.

Earlier development receipts are preserved. They include a stale Dogs button selector, a fixture display-name mismatch, and an assertion against transient PNG status copy. The corrected tests compare the actual pre/post queue, await completed browser download bytes, and check the re-enabled action. Two full runs launched just before a release-lead hold were stopped; they are not release evidence. The final staged run was performed alone after runtime freeze.

## Final checks

| Check | Result |
| --- | --- |
| Settings Escape returns to its toggle in both apps | Pass |
| Dogs sign-in, backup and export have descriptive computed names | Pass |
| Settings-launched dialogs close through Escape and Close, repeated four times | Pass |
| Queue Rank cancellation through Escape and Cancel retains the queue and restores its Rank action | Pass |
| Forward/reverse Tab in native dialogs stays inside or takes the expected BODY/browser-chrome step | Pass, including plain native-dialog controls |
| Dogs nested About and pack cancellation restore their interrupted controls | Pass |
| Movies nested Share preview returns to its parent and original opener | Pass |
| Held publish success/failure with no movement, keyboard movement, or dialog close | Pass; no completion focus theft |
| Dogs ordinary account refresh preserves pending/error announcements | Pass |
| Old-owner queued cancellation callbacks cannot focus the new owner's same-ID queue | Pass |
| Movies single PNG download completes and keeps usable focus | Pass in both engines |
| Movies held image-set export preserves the user's selected preview card after completion | Pass in both engines |
| Phone-width sign-in dialog rendering and keyboard return | Pass at 390×844 |

The image-set probe independently reproduced an additional loss of focus in the first candidate: completion rebuilt the preview's DOM after the user had tabbed into a card. The final code preserves the currently focused semantic control through that synchronous replacement. Both engines now keep the same preview card and its visible focus indication after an actual image-set ZIP download.

The Dogs refresh probe uses the already-adopted canonical snapshots as its unchanged remote fixture. Re-serving old seed names/artwork intentionally causes placement replacement and clears pending work; that distinct persistence behavior is not classified as an ordinary UI refresh failure.

## Evidence and execution

Full final evidence is local and ignored: `reports/accessibility/2026-10-09T07-24-52-191Z/results.json`. It includes each case's focus states, computed dialog names, mock requests, console entries, screenshots, engine versions, source hashes and download receipts. Source-targeted fixes also passed 24/24 at `07-20-17-670Z`, followed by four normalized account-refresh cases at `07-24-28-187Z`.

The single-image files have valid PNG signatures and completed without browser download errors: Chromium 444,324 bytes and WebKit 396,013 bytes. Image-set ZIPs completed at 664,825 and 596,197 bytes respectively. File hashes are in the receipt. These are synthetic rankings and placeholder posters, not customer exports.

Every application action uses real Tab/Option-Tab, Enter, Arrow keys or Escape. Tests do not call runtime click handlers directly. Narrow timing instrumentation holds canvas callbacks and cancellation animation frames for the two race checks; the underlying renderer and account transition still run. Native-dialog tests permit BODY only as the browser's chrome step and reject focus on background page controls. Movies Settings remains nonmodal.

Browser plugin classification: unavailable. The frontend testing skill's fallback was followed using existing Playwright, with no dependency installation. All HTTP traffic is intercepted: local application files are served from the selected root; account, share and metadata responses use fictional fixtures. An unusable proxy and Chromium DNS denial provide additional isolation. Fonts are blocked and movie posters are synthetic placeholders. Console artifacts contain expected blocked font/preconnect errors and deliberately injected HTTP failures; there were no uncaught application exceptions.

Desktop screenshots use 1280×900. The final Chromium Dogs phone sign-in and Movies image-set preview desktop screenshots were visually inspected: meaningful content, visible focus, no error overlay, and no horizontal overflow. Phone cases also assert layout width. This is a viewport simulation, not physical-device testing.

Run with an existing Playwright installation:

```sh
A11Y_PLAYWRIGHT_PATH=/absolute/path/to/node_modules/playwright \
  A11Y_SERVE_ROOT=dist/public node scripts/test-accessibility-browser.cjs
```

Without `A11Y_PLAYWRIGHT_PATH`, the harness uses normal `require('playwright')` resolution. Omit `A11Y_SERVE_ROOT` for the working tree. `A11Y_ENGINES=chromium` selects one engine; `A11Y_ONLY` is a case-name regular expression. `A11Y_REPORT_DIR` sets the report destination. `A11Y_BASELINE=1` records expected baseline defects without presenting them as a fixed-app result. No original audit script, data file or dependency was modified.

## Limits

This proves keyboard/browser behavior and computed accessibility names, not actual screen-reader speech or compliance. Real Safari, VoiceOver/NVDA, physical devices, OS zoom, forced colors and exhaustive assistive-technology combinations remain untested. No real accounts, email delivery, customer records or production endpoint writes were used. Broad backup, recovery, security and release checks remain owned by the aggregate verification and release lead; this harness supplements them.

## Native Chrome/CDP visibility follow-up

The mandatory native CDP suite initially recorded three failures closing the Dogs utility dialogs through their Close buttons. A solo unchanged staged rerun reproduced **6 passes / 3 failures** (`reports/accessibility-cdp/2026-10-09T07-36-51-666Z/results.json`), so parallel browser contention alone did not explain the result.

A passive event diagnostic (`07-37-55-062Z`) recorded actual Enter keydown/keypress, click and native form submission. The dialog's `open` property became false, but its queued native `close` event was not delivered during the 2.5-second assertion period. The document reported `visibilityState: hidden` despite `hasFocus(): true`; focus eventually fell to BODY. The preceding Escape close had delivered its event and restored focus correctly. These are observed facts; the cause of Chrome changing that headless target's visibility is not established.

Activating the browser target with `Page.bringToFront` before each real key and requiring `document.visibilityState === 'visible'` restored native close-event delivery. This changes the harness's browser-visibility prerequisite, not application DOM focus. The three strict diagnostic cases passed (`07-39-12-821Z`). One earlier diagnostic variant threw only from its passive logger when `visibilitychange` targeted Document; that artifact (`07-38-38-123Z`) is preserved and is not a passing receipt.

The durable CDP harness now records each key's visible prerequisite, native close events and `Browser.getVersion`. Its full final staged run passed **9/9**, with unchanged runtime hashes, at `reports/accessibility-cdp/2026-10-09T07-40-02-328Z/results.json`. Both Escape and form-close events were delivered while visible for all three dialogs. The measured installed native browser was **Chrome 155.0.8059.40**, independently of Playwright Chromium 151. No product edits were made for this follow-up, and all earlier failure artifacts remain intact.
