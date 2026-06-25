# Feature idea: Share export sizes and a multi-image "image set"

Status: **v1 shipped 2026-06-24** — Phase 0 (enabling refactor), Phase 1 (Shape: Portrait/Landscape) and Phase 2 (Image set: 6 groups, saved&hidden 5+5, paginated whole list, sequential downloads) are built. `SHARE_OPTIONS_VERSION` is now 6. Remaining: **Phase 3 polish** (ZIP delivery, iPad page size, in-studio per-card previews/labels beyond the stacked deck). The notes below are the original spec; the "Suggested phasing" and "Acceptance criteria" sections still describe the intended end state.

## Summary

Two upgrades to the Share Studio **image** exports (the PNG, and the SVG it is built from). Today there is exactly one image shape: a single, very tall 1200px-wide poster that scrolls forever. We want:

1. **A size/shape option for the single-image poster** — let the user pick a tall, phone-width column **or** a short, wide landscape (iPad-ish) layout.
2. **A new multi-image "image set" format** — instead of one giant image, export a set of same-width images, one per content group (header + one or more sections), ideally all at one fixed device-sized page (iPhone Pro Max portrait, or iPad), paginating the whole list across as many pages as needed.

Both only touch the **image** exports. Markdown / JSON / Text exports, the tones, the looks, the section toggles, and the insight engine are unchanged.

## Why

The single tall poster is awkward to share. It is a fine file, but on social it gets downscaled to a sliver, it is clumsy in messages, and it does not print. A wide layout reads like a dashboard/poster; a set of phone-sized cards is ideal for Stories / posts / messages and lets people share just the part they care about (only "Eras," or only the Top 10). This is a "make the thing we already generate actually shareable" upgrade.

## Current state (what exists today)

- One builder, `buildShareSvg(options)` (`app.js` ~2618), produces a single SVG: **fixed `width = 1200`**, **height grows vertically** (`height = Math.max(1600, y + 200)`, ~3069) as sections stack.
- Layout is a **single-column vertical flow**: a shared `y` cursor is advanced by `addSection(title, sub, body, height)` (~2651). Two-up sub-layouts exist only *within* sections (Eras' four metric cards 2×2, People's Directors|Cast columns) via absolute `x = marginX + col*520` (`marginX = 86`, column unit `520`, bars at `barTrackX = 398` / `barTrackWidth = 520`).
- Section builders are already modular closures: `topPicks`, `bottomPicks`, `eras`, `genres`, `people`, `queues`, `fullList`, composed at ~3062 with `sections.push(topPicks(), bottomPicks(), eras(), genres(), people(), queues(), fullList())`. **But** they close over the shared mutating `y` and the fixed `width`/`marginX`, so they cannot yet be re-placed independently.
- PNG export `downloadSharePng()` (~3440): serialize SVG → `<img>` → draw onto one canvas sized to the SVG's width/height → overlay cross-origin TMDB posters via `getSvgPosterOverlays` / `drawPosterOverlays` (the proxy dance) → one `toBlob` → one file `stackrank-movies.png`.
- Options live in `shareOptions` (~155): `top, bottom, eras, genres, people, queues, fullList, fullListStyle ("posters"|"text"|"mixed"), theme, tone`. `SHARE_OPTIONS_VERSION = 5`. UI controls in `index.html` (~267–362): section checkboxes, full-list-style radios, theme/tone radios, and the `#share-download-png` / `#share-download-svg` buttons.
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
- **Decided (2026-06-24): Portrait / Landscape.** (Strip / Spread kept on file as the more characterful alternative.)

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

- **Decided — v1: sequential downloads**, clearly named (`stackrank-1-top-bottom.png`, `stackrank-2-eras.png`, …). Browsers show a "download multiple files" prompt — acceptable but slightly clunky.
- v2: bundle into a single **.zip**. No bundler/deps allowed, so either vendor a tiny dependency-free zip writer or hand-roll a *stored* (uncompressed) zip (~100 lines). Nicer UX.
- Each page still needs its own poster-overlay pass (`getSvgPosterOverlays` + `drawPosterOverlays`) before its `toBlob`.

## The shared refactor (do this first)

Both Part 1 (Landscape) and Part 2 (iPad + clean per-page composition) need the same enabling refactor, so do it once up front:

1. **Reusable header**: `buildShareHeader(options, { pageLabel })`.
2. **Standalone section builders**: each takes `(width, startY)` and returns `{ svg, height }` instead of closing over the shared mutating `y` / fixed `width`. They already report their heights to `addSection`, so this is mostly threading params through.
3. **A page composer**: given a width, an optional fixed height, a header, and an ordered list of section keys, lay them out (single-column flow for Portrait, grid for Landscape) and emit one SVG.

Once that exists: Single-image-Portrait = "compose all sections, variable height"; Single-image-Landscape = "compose all sections, grid, wide"; Image-set = "compose N pages, one group each, fixed height."

## UI & options

- New controls in Share Studio (`index.html` ~267–362, near the existing radios): a **Format** segmented control (Single image / Image set) and a **Shape** segmented control (Portrait / Landscape). **In v1, when Format = Image set the Shape control is hidden** — every card is phone-portrait.
- Extend `shareOptions` with `format: "single" | "set"` and `shape: "portrait" | "landscape"`; bump `SHARE_OPTIONS_VERSION` 5 → 6 with a migration that defaults existing users to `single` / `portrait` (preserves today's behavior).
- The PNG button adapts: Single image → "Download PNG"; Image set → "Download images" (with a count, e.g. "6 images").

## Suggested phasing

- **Phase 0 — enabling refactor** (header builder, standalone section builders, page composer). No visible change; validate output matches today's Portrait.
- **Phase 1 — Part 1 Shape**: Portrait + Landscape; add Shape control, option, migration.
- **Phase 2 — Part 2 Image set, phone-portrait fixed pages**: Format control; the 6 groups; per-page header; Saved & hidden expansion; whole-list pagination; sequential multi-download.
- **Phase 3 — polish**: ZIP delivery; iPad page size (reuses Phase 0/1 width work); page counters; previews.

## Decisions (settled 2026-06-24)

1. **Shape names: Portrait / Landscape.** (Alternatives on file: Strip / Spread, Tall / Wide.)
2. **Format names: Single image / Image set.**
3. **Image set cards are fixed-size**, not variable-height — a uniform "deck." Variable height stays only as a fallback if a specific group proves too costly.
4. **v1 targets phone-portrait only** (author at 1200 × ~2600, reusing the existing layout); iPad is a later phase. The Shape control therefore does **not** apply inside the image set in v1 — every card is phone-portrait.
5. **Delivery: sequential downloads** (one named file per image) in v1; ZIP is a later polish.
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

- Share Studio offers a **Shape** choice; Portrait reproduces today's poster, Landscape produces a wide multi-column poster.
- Share Studio offers an **Image set** format that exports header + grouped sections as multiple same-width images.
- The Saved & hidden card shows up to 5 saved and up to 5 hidden in poster+title style.
- The Whole list paginates across multiple images without clipping.
- Each image-set card reads as a complete, intentional page (nothing looks cut off); the whole list tiles across repeatable pages with counters.
- Existing single-image Portrait PNG/SVG output is unchanged for users who do not touch the new controls (migration defaults preserved).
- Posters still render in PNG via the proxy/overlay pipeline on every page.
- Mobile Share Studio remains usable; no regression to tones / looks / toggles.
