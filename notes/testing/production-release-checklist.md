# Production release checklist

Last autonomous pass: **2026-06-30**

Use this checklist for checks that cannot be made authoritative from a local
browser or unauthenticated production session. The automated baseline is:

```sh
npm run verify
npm run test:production
```

`test:production` checks the apex/`www` redirect chain, clean routes, security
headers, canonical/social metadata, cache-busted assets, app icons, the
1200×630 OG image, privacy/TMDB credits, `robots.txt`, and `sitemap.xml`.
For rendered manual QA, use `https://www.stackrankapp.com/movies?debug=1` so
the visit does not enter either product telemetry stream.

## Current production state

- Vercel deploys `main` and the 2026-06-29 stabilization deployments reached
  `READY` with the expected production aliases.
- `/movies` and `/privacy` load under the enforced CSP without console errors.
- A real TMDB autocomplete request and poster load succeed under that policy.
- Cold production traces are within the v1 target: desktop LCP 465 ms / CLS
  0.00, and mobile Fast 4G with 4× CPU LCP 1.334 s / CLS 0.01.
- Desktop and mobile Lighthouse audits score 100 for accessibility, best
  practices, SEO, and agentic browsing.
- Cache-busted app JS, CSS, and bundled pack data are served immutable.
- The production sign-in sheet exposes email magic link.
- Google and Apple OAuth are both disabled in Supabase and therefore correctly
  hidden. Google still needs provider credentials before it can be tested;
  Apple is optional for v1.

## Controlled inbox

### Email magic link

- [ ] From `https://www.stackrankapp.com/movies`, request a link for a
  controlled address.
- [ ] Confirm Gmail and Apple Mail show the intended StackRank sender, subject,
  branding, readable plain-text fallback, and no clipping.
- [ ] Open the link once and confirm it returns to `/movies`, establishes the
  session, and does not duplicate or shrink the browser-local ranking.
- [ ] Reopen the same link and confirm the expired/used-link outcome is
  understandable and does not block signed-out local use.

### Google OAuth

- [ ] Add production Google credentials and redirect URI in the provider
  console and Supabase.
- [ ] Confirm the Google button appears only after the provider is enabled.
- [ ] Complete sign-in, cancel once, sign out, and sign in again.
- [ ] Confirm every outcome returns to `/movies` and the local/remote merge
  preserves all unique movies.

Apple OAuth remains intentionally optional. If enabled later, repeat the Google
round-trip checks with Apple’s relay-email and cancellation paths.

## Signed-in data recovery

- [ ] Download a backup before testing.
- [ ] In a signed-in production session, make one identifiable ranking change,
  one queue change, and one pack-progress change.
- [ ] Open a clean second browser/device and confirm all three arrive.
- [ ] Restore the backup, confirm the replacement/undo UI, then reload both
  clients and verify that the restored snapshot wins without resurrecting
  older local data.

## Link preview

- [ ] Paste `https://www.stackrankapp.com/movies` into Apple Messages without
  sending it first.
- [ ] Confirm the title, description, and 1200×630 image render cleanly.
- [ ] Send the message once to test the recipient-side preview cache.
- [ ] If the image is stale after a future redesign, regenerate it and bump the
  `og:image`/`twitter:image` query key before retesting.

## Physical iPhone Safari

Test one current iOS version in portrait and landscape:

- [ ] Add a title and finish, undo, and cancel a comparison without the keyboard
  reopening unexpectedly.
- [ ] Reorder the ranking with the touch handle and open/close nested detail and
  lightbox surfaces.
- [ ] Open Share Studio and download a single PNG.
- [ ] Generate an image set and confirm the ZIP downloads and opens.
- [ ] Use native Share for a PNG and confirm the correct file is handed off.
- [ ] Pinch-zoom, pan, swipe between set pages, and dismiss the lightbox.
- [ ] Confirm settings, sign-in, and the privacy page stay inside the viewport.

## Legacy-origin retirement

The GitHub Pages origin still exists only to recover browser-local data from
the old origin. Before disabling it:

- [ ] Leave it available through at least the first telemetry review
  (2026-07-12; extend to 2026-07-28 if the sample is small).
- [ ] Confirm no known user still needs to export an old local ranking.
- [ ] Keep a final static recovery notice and backup instructions available for
  an announced grace period.
- [ ] Remove legacy Auth redirect URLs only after the recovery origin is gone.
