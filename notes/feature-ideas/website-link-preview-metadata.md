# Feature idea: Website link preview metadata

Status: shipped (2026-06-27)

## What shipped

- Static metadata added to `index.html` `<head>`: page `description`, `link rel="canonical"`, Open Graph (`og:type`/`og:site_name`/`og:url`/`og:title`/`og:description`/`og:image` plus `og:image:type`/`width`/`height`/`alt`), and a `summary_large_image` Twitter/X card fallback. All URLs are absolute HTTPS under `https://danbretl.github.io/StackRank-Web/`.
- A 1200x630 preview image at `assets/og-preview.png` in the monochrome StackRank system (wordmark + tagline + a numbered ranking-list illustration; no copyrighted posters). It is generated reproducibly by `scripts/build-og-image.cjs` (`npm run build:og`), which rasterizes the design with headless Chrome and downsamples a 2x capture to exactly 1200x630.
- The `og:image`/`twitter:image` URLs carry a `?v=N` query so the design can be re-rendered and unfurler caches busted by bumping `N`.

To change the preview: edit the markup in `scripts/build-og-image.cjs`, run `npm run build:og`, then bump the `?v=` on the image meta tags in `index.html`.

## Remaining verification (post-deploy)

Crawlers cache aggressively, so confirm after the change is live on GitHub Pages: share the production URL in Apple Messages (and one other unfurler) and check the card shows the title, description, and image. If a stale preview is cached, share the URL with a throwaway query string to force a re-fetch.

---

Original idea below.

Status: wishlist

## Summary

Give shared StackRank URLs a useful visual preview in Apple Messages and other apps that generate link cards.

## Problem

Sharing the live site currently produces a plain URL bubble or an unhelpful generic preview. That makes StackRank feel less finished and gives recipients no immediate sense of what the site is.

## Proposed first version

Add static metadata to `index.html`:

- A concise page title and description.
- Open Graph `og:type`, `og:title`, `og:description`, `og:url`, and `og:image`.
- Explicit `og:image:width`, `og:image:height`, and `og:image:alt`.
- A canonical URL.
- A large-image Twitter/X card as a compatible secondary fallback.

Create a public 1200x630 preview image that:

- Uses the existing monochrome StackRank visual system.
- Makes the StackRank name immediately readable.
- Shows the ranking concept rather than a generic movie collage.
- Remains legible when cropped or displayed as a small Messages card.
- Avoids copyrighted poster artwork unless there is a clear licensing basis.

The image URL must be absolute and HTTPS, for example under the GitHub Pages site.

## Implementation notes

- This is compatible with the current static GitHub Pages architecture; no server rendering is required.
- Metadata must be present in the initial HTML because link crawlers may not execute JavaScript.
- The production URL and repository path casing need to match the canonical and Open Graph URLs exactly.
- Keep the favicon and Apple touch icon work separate; they improve bookmarks/home-screen presentation but do not replace `og:image`.
- Link preview services cache aggressively. Verification may require sharing a URL with a temporary query string after deployment.

## Suggested copy

- Title: `StackRank - Build your movie ranking`
- Description: `Rank movies by choosing between them. StackRank finds the exact order, one comparison at a time.`

Copy should be reviewed against the final preview image before shipping.

## Acceptance criteria

- Sharing the production URL in Apple Messages produces a card with the intended title, description, and image.
- The same URL produces a useful preview in at least one additional unfurler.
- The image loads from a public absolute HTTPS URL without authentication.
- The preview remains legible at small mobile card sizes.
- Normal app loading and GitHub Pages deployment remain unchanged.
