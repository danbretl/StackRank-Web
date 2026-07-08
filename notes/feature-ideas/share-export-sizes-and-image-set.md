# Feature idea: Share export sizes and a multi-image "image set"

Status: **v1 shipped Jun 2026.** Built and refined across several review rounds. The
implementation now includes the original format/shape work plus the later Share
Suite polish: ZIP delivery, in-studio image-set labels, the Movie packs section,
general empty-section hiding/disabled toggles, and Jul 2026 public snapshot
links.

- Phase 0 enabling refactor — `buildShareImages()` dispatcher, width-agnostic `shareSectionBuilders()`, `buildShareHeader`, `placeSectionFlow`, shared SVG wrapper.
- **Shape: Skinny / Wide** (renamed from Portrait/Landscape). Wide = 2-col masonry of the non-list sections + the whole list full-width below at 4/4/11 cols (mixed/text/posters), with the inter-column gutter set equal to the page padding.
- **Image set** — header + grouped cards (top&bottom, eras, genres, cast&crew, saved&hidden = 5 most-recent of each by `savedAt`/`hiddenAt` in a 2-col mixed grid, **Movie packs**, whole-list paginated). Cards shrink-to-content (max 1200×2600); page kicker shows "… Page X/Y" and the list title postfixes "…, Ranks X–Y". A 2+-card export downloads as one stored `.zip`; a 1-card set downloads as a plain file.
- Polish landed: symmetric left/right content padding (86 ↔ 1114), larger section titles/subtitles, blue `people-heading` chart captions, eras values matched to genre/cast size, genre chart ordered alphabetically, animated loading skeletons for detail-backed sections, and a preview-rewrite guard that fixed a per-batch flicker.
- **Movie packs section** — toggle labelled "Movie packs", default on, inserted between Saved/hidden and Whole list. It renders a 4-up pack meta strip plus up to four pack cards across Skinny SVG, Wide SVG masonry, image-set cards, and Markdown/JSON/Text exports. It is derived from pack progress only; no schema change.
- **Empty-section handling** — every export surface omits sections with no content after detail loading settles, and the matching Include toggle is disabled with an "(empty)" label. Detail-backed Genres and Cast & crew remain available while their async enrichment is still loading.
- **Full-resolution preview lightbox** — tapping a Single-image preview or any Image-set card opens the generated SVG in a shared overlay with native pinch-zoom/pan, tap-to-enlarge, and close via ×/backdrop/Escape. Share mode includes explicit **Download PNG** / **Share PNG** actions. Image sets add previous/next buttons, arrow-key navigation, horizontal swipe while zoomed out, and the same `i/total CAPTION` counter used in the studio. Navigating the lightbox keeps the studio deck index synchronized.
- **Shared poster viewer** — the same overlay is reused without share chrome for the original-resolution TMDB poster opened from the movie-detail pane.
- **Public snapshot links** — signed-in users can publish/update/copy/revoke a short `/s/:slug` link from Share Studio. It stores a static minimal snapshot in `shared_lists` and renders a read-only monochrome poster grid with a "Make your own stack" CTA; signed-out users are prompted to sign in before publishing.

`SHARE_OPTIONS_VERSION` is now 7 (v6 migrated `portrait`/`landscape` → `skinny`/`wide`; v7 added the `packs` toggle). Current cache keys: `app.js?v=173`, `styles.css?v=132`, `shared.js?v=2`.

**Phase 3 polish — shipped except iPad page size (Jun 2026):**
- **ZIP delivery — SHIPPED.** Image-set PNG and SVG exports now bundle into a single `.zip` (`stackrank-share-images.zip` / `stackrank-share-svg.zip`) instead of N staggered downloads (which fired a browser "download multiple files?" prompt and scattered files). Implemented with a hand-rolled, dependency-free **stored (uncompressed) ZIP writer** (`createStoredZipBlob` + `crc32` + `concatBytes` + `dosDateTime`) — no deflate, just CRC32 and fixed headers — staying inside the no-npm-deps constraint. A 1-card set downloads as a single plain file (no pointless zip). The PNG button reads "Download zip (N)" / SVG "SVG zip". Validated against system `unzip -t` and Python `zipfile.testzip()` (CRCs + binary/UTF-8 round-trip).
- **Richer in-studio per-card previews/labels — SHIPPED.** The image-set studio preview now renders each card as a `<figure>` with a numbered caption pill ("1/7 · Top & bottom picks" … "6/7 · Packs" … "7/7 · Whole list"; whole-list pages show "Whole list · 2/3"), so the deck reads as an ordered, navigable set instead of an anonymous stack. Cards carry a `caption` field; `.share-preview-card__{media,label,num,name}` styles in `styles.css`.
- **Pack-focused share section — SHIPPED.** The `packs` section appears across all export modes after Saved/hidden. It self-hides when there is no pack engagement, uses the label "Movie packs" in the Share Studio, and defaults on in migrated share options.
- **General empty-section omission — SHIPPED.** `shareSectionAvailability()` and `updateShareIncludeAvailability()` now make empty sections disappear from generated output and disable their toggles in the UI; this applies to all sections, not just packs or queues.
- **iPad page size — still deferred.** The single-image **Wide** shape already delivers the landscape/iPad-dashboard layout (the width-parameterized half of this item). An iPad-shaped *image-set* (multiple groups packed per landscape page with fixed-height masonry pagination) remains a meaningful redesign of the one-group-per-card model and the carefully-tuned whole-list pagination — kept parked rather than rushed, per this doc's own "defer to a later phase" note and the regression-risk caveat below.

The original spec below is kept as the design record. Some terms changed during
implementation: **Portrait/Landscape became Skinny/Wide**, sequential downloads
became ZIP delivery, and the Image set gained a Movie packs card.

## Summary

Two upgrades to the Share Studio **image** exports (the PNG, and the SVG it is built from). Today there is exactly one image shape: a single, very tall 1200px-wide poster that scrolls forever. We want:

1. **A size/shape option for the single-image poster** — let the user pick a tall, phone-width column **or** a short, wide landscape (iPad-ish) layout.
2. **A new multi-image "image set" format** — instead of one giant image, export a set of same-width images, one per content group (header + one or more sections), ideally all at one fixed device-sized page (iPhone Pro Max portrait, or iPad), paginating the whole list across as many pages as needed.

Both only touch the **image** exports. Markdown / JSON / Text exports, the tones, the looks, the section toggles, and the insight engine are unchanged.

## Why

The single tall poster is awkward to share. It is a fine file, but on social it gets downscaled to a sliver, it is clumsy in messages, and it does not print. A wide layout reads like a dashboard/poster; a set of phone-sized cards is ideal for Stories / posts / messages and lets people share just the part they care about (only "Eras," or only the Top 10). This is a "make the thing we already generate actually shareable" upgrade.

## Original baseline (pre-build)

- One builder, `buildShareSvg(options)` (`app.js` ~2618), produces a single SVG: **fixed `width = 1200`**, **height grows vertically** (`height = Math.max(1600, y + 200)`, ~3069) as sections stack.
- Layout is a **single-column vertical flow**: a shared `y` cursor is advanced by `addSection(title, sub, body, height)` (~2651). Two-up sub-layouts exist only *within* sections (Eras' four metric cards 2×2, People's Directors|Cast columns) via absolute `x = marginX + col*520` (`marginX = 86`, column unit `520`, bars at `barTrackX = 398` / `barTrackWidth = 520`).
- Section builders are already modular closures: `topPicks`, `bottomPicks`, `eras`, `genres`, `people`, `queues`, `fullList`, composed at ~3062 with `sections.push(topPicks(), bottomPicks(), eras(), genres(), people(), queues(), fullList())`. **But** they close over the shared mutating `y` and the fixed `width`/`marginX`, so they cannot yet be re-placed independently.
- PNG export `downloadSharePng()` (~3440): serialize SVG → `<img>` → draw onto one canvas sized to the SVG's width/height → overlay cross-origin TMDB posters via `getSvgPosterOverlays` / `drawPosterOverlays` (the proxy dance) → one `toBlob` → one file `stackrank-movies.png`.
- Options lived in `shareOptions` (~155): `top, bottom, eras, genres, people, queues, fullList, fullListStyle ("posters"|"text"|"mixed"), theme, tone`. `SHARE_OPTIONS_VERSION = 5`. UI controls in `index.html` (~267–362): section checkboxes, full-list-style radios, theme/tone radios, and the `#share-download-png` / `#share-download-svg` buttons.
- The "poster + title" mode the request references = `fullListStyle: "mixed"`.

## Part 1 — Single-image size/shape option

Add one new Share Studio control that sets the poster's shape:

- **Portrait** (default; = today's output): phone-column width, long vertical scroll. Single column; the existing 2-up sub-sections may collapse to 1-up so it feels genuinely phone-width.
- **Landscape**: wide, iPad-landscape-ish canvas; whole sections flow into a **multi-column grid** so the result is short and wide (a one-screen dashboard/poster).

### Naming (the request asked for better than "skinny / wide")

- Control label: **"Shape"** (or keep "Size").
- Values — recommendation: **Portrait / Landscape** (instantly understood, matches device orientation).
- Fun on-brand alternative: **Strip / Spread** — "Strip" evokes a film strip (on-theme for a movie app); "Spread" is the magazine term for a wide layout.
- Other candidates: Tall / Wide · Column / Spread · Phone / Tablet.
- **Originally decided (2026-06-24): Portrait / Landscape. Implemented as Skinny / Wide.** (Strip / Spread kept on file as the more characterful alternative.)

### What it touches

- Parameterize the hardcoded `width = 1200`.
- Make the column unit (`520`), `marginX`, and bar geometry (`barTrackX`, `barTrackWidth`) derive from width.
- Portrait: collapse in-section 2-up blocks to 1-up at narrow width.
- Landscape: pack whole sections into a 2–3 column grid (a row/masonry pass over the section list) — which means the layout can no longer be a single `y` cursor.

## Part 2 — Multi-image "image set" format

Add a **Format** control: **Single image** (today's scroll) vs **Image set** (a set of same-width images). In Image set mode, export one image per content group; each image = the **header** (hero + brand) + one or more sections.

### Groups (one card each)

1. **Top & bottom picks**
2. **Eras**
3. **Genres**
4. **Cast & crew** (the People section)
5. **Saved & hidden** — needs more content than today's counts: show **up to 5 saved + up to 5 hidden**, rendered like the whole-list **"mixed" (poster + title)** rows.
6. **Whole list** — **paginated** across as many images as needed.

Respect the existing section toggles: a group whose sections are all toggled off produces no card.

### The delightful version: one fixed page size for every card

Every card is the **exact same fixed size** (a real device page), like a deck of cards.

- **Phone-portrait (recommended first target):** author each page at the existing **1200 × ~2600** (≈ iPhone Pro Max's 19.5:9), so all current section math at width 1200 is reused unchanged; optionally upscale on export to device pixels (~1320 wide). **This is the cheap win — no width refactor required.**
- **iPad option:** a 3:4 portrait (or 4:3 landscape) page at a *different* width → needs the same width-parameterization as Part 1's Landscape. Defer to a later phase.

Fixed size forces two behaviors:

- **Pagination** (Whole list, and any group that overflows one page): see "Pagination must produce complete-looking pages" below. Compute rows-per-page from `pageHeight − header − footer`, and label pages ("Whole list 2/3").
- **Header per page:** extract the hero/brand/divider into a reusable `buildShareHeader(options, { pageLabel })` so every card is self-contained and branded.

**Decided: fixed-size it is.** Variable-height cards (each as tall as its content, all sharing one width) remain only as an escape hatch if a specific group proves too costly.

### Pagination must produce complete-looking pages

Pagination here is a design decision, not a mechanical line-break. Two distinct cases:

- **Finite groups** (Top & bottom, Eras, Genres, Cast & crew, Saved & hidden): each should feel *complete* on its card. When content is close to fitting, first **adjust the design to fit one page** (tighten spacing, show fewer items, resize). Only when it genuinely cannot fit do we **consciously split across pages**, and each resulting page must be designed to look intentional and finished on its own — never cut off mid-thought.
- **Whole list**: inherently many pages, so the work is different — design **one repeatable single-page template** (a full page of ranked rows) that tiles cleanly for as many pages as the list needs, with the counter ("Whole list 2/3") providing orientation.

### Delivering multiple files (constraint: no npm deps)

- **Originally decided — v1: sequential downloads**, clearly named (`stackrank-1-top-bottom.png`, `stackrank-2-eras.png`, …). This shipped briefly, then was replaced by ZIP delivery.
- **Shipped delivery:** 2+ cards bundle into a single **.zip**. No bundler/deps were added; the app hand-rolls a *stored* (uncompressed) zip.
- Each page still needs its own poster-overlay pass (`getSvgPosterOverlays` + `drawPosterOverlays`) before its `toBlob`.

## The shared refactor (do this first)

Both Part 1 (Landscape) and Part 2 (iPad + clean per-page composition) need the same enabling refactor, so do it once up front:

1. **Reusable header**: `buildShareHeader(options, { pageLabel })`.
2. **Standalone section builders**: each takes `(width, startY)` and returns `{ svg, height }` instead of closing over the shared mutating `y` / fixed `width`. They already report their heights to `addSection`, so this is mostly threading params through.
3. **A page composer**: given a width, an optional fixed height, a header, and an ordered list of section keys, lay them out (single-column flow for Portrait, grid for Landscape) and emit one SVG.

Once that exists: Single-image-Skinny = "compose all sections, variable height"; Single-image-Wide = "compose all sections, grid, wide"; Image-set = "compose N pages, one group each."

## UI & options

- New controls in Share Studio (`index.html` ~267–362, near the existing radios): a **Format** segmented control (Single image / Image set) and a **Shape** segmented control (Skinny / Wide). **When Format = Image set the Shape control is hidden** — every card uses the fixed image-set layout.
- Extend `shareOptions` with `format: "single" | "set"` and `shape: "skinny" | "wide"`; bump `SHARE_OPTIONS_VERSION` 5 → 6 with a migration that defaults existing users to `single` / `skinny` and maps older `portrait` / `landscape` values.
- The PNG button adapts: Single image → "Download PNG"; Image set → "Download zip (N)" for 2+ cards or "Download image" for one card.

## Suggested phasing

- **Phase 0 — enabling refactor** (header builder, standalone section builders, page composer). No visible change; validate output matches the old Skinny/portrait poster.
- **Phase 1 — Part 1 Shape**: Skinny + Wide; add Shape control, option, migration.
- **Phase 2 — Part 2 Image set, fixed cards**: Format control; grouped cards; per-page header; Saved & hidden expansion; whole-list pagination.
- **Phase 3 — polish**: ZIP delivery; page counters; previews; Movie packs card; empty-section disabling. iPad page size remains deferred.

## Decisions (settled 2026-06-24)

1. **Shape names: Skinny / Wide.** Earlier `portrait` / `landscape` saved values migrate to these. (Alternatives on file: Strip / Spread, Tall / Wide.)
2. **Format names: Single image / Image set.**
3. **Image set cards are shrink-to-content with a 1200×2600 max**, giving a uniform-width deck without forcing empty space on short cards.
4. **v1 targets the 1200px-wide card layout only**; iPad is a later phase. The Shape control therefore does **not** apply inside the image set.
5. **Delivery: ZIP for 2+ cards**, single file for a 1-card set.
6. **Overflow: paginate — as a deliberate design act, not a mechanical split.** Finite groups should be redesigned to fit one page when close, and split only when truly necessary with each page looking complete; the whole list gets one repeatable page template. See "Pagination must produce complete-looking pages."
7. **Cards show a quiet label + counter** (e.g. "Eras", "Whole list 2/3").

## Why this may be worth doing

- Turns a hard-to-share artifact into genuinely shareable assets.
- Lets users share just the part they want.
- The fixed-card "deck" is delightful and on-brand.

## Why this may not be worth doing

- Sizable build; the layout-engine refactor is non-trivial.
- Multi-file delivery within the no-deps constraint is fiddly.
- Risk of regressing the carefully-tuned existing poster during the refactor.

## What stays unchanged

Markdown / JSON / Text exports; tones; looks; section toggles; insight engine; poster proxy pipeline. Size & Format affect the image exports only.

## Acceptance criteria (v1 target)

- Share Studio offers a **Shape** choice; Skinny reproduces the original poster, Wide produces a wide multi-column poster.
- Share Studio offers an **Image set** format that exports header + grouped sections as multiple same-width images.
- The Saved & hidden card shows up to 5 saved and up to 5 hidden in poster+title style.
- The Whole list paginates across multiple images without clipping.
- Each image-set card reads as a complete, intentional page (nothing looks cut off); the whole list tiles across repeatable pages with counters.
- Existing single-image Skinny PNG/SVG output is unchanged for users who do not touch the new controls (migration defaults preserved).
- Posters still render in PNG via the proxy/overlay pipeline on every page.
- Mobile Share Studio remains usable; no regression to tones / looks / toggles.
