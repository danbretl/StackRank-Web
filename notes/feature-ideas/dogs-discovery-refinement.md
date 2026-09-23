# Dogs discovery and comparison refinement

Initially pushed in `cd85278c`, with ranking-priority feedback addressed in `d989cb7c`, on
September 22, 2026 at Dan's request after comparing the live Movies, Dogs, and
internal artwork-review pages. The starting Dogs hero occupied most of the first screen before
any discovery portraits; its large search control competed with the more useful browsing paths.

## Product behavior

- The 64px desktop / 52px phone header keeps the brand, Rank / Ranking / You, and settings.
  A shared category dropdown beside the brand offers Movies and Dogs on both sites, with ordinary
  links, current-category indication, keyboard focus, Escape, and outside dismissal.
- “Find your kind of dog” keeps the bold typographic character in a compact, unboxed introduction.
  The redundant field-guide eyebrow, ranking instruction paragraph, and three repeated catalog
  counts are removed. Loading and error status remain visible when relevant.
- Ranking remains primary. “A few dogs to meet” groups a full-width search row with Surprise me
  and Shuffle dogs on its right and a highlighted Browse all dogs button above. Search results,
  the four discovery portraits, and Surprise me rank directly; only the All dogs gallery opens
  profiles first. On phones search gets a full row, with Surprise me and Shuffle dogs beneath it.
  Profile Rank this breed is visually primary. Search and Browse remain available when the
  portrait rail is exhausted. Recently ranked uses plain typography.
- The section is plainly titled Dog packs. Previews use pictures and names without tags or Meet
  links. See all dogs opens every eligible dog in that pack; clicking an unranked portrait/name
  ranks it. Full packs show unranked dogs first, then ranked dogs with grayscale, dimmed portraits.
  Rank next skips ranked and Not for me entries. Settling or canceling returns to that pack's
  scroll/focus, with refreshed progress.
  Back returns to discovery or the filtered pack browser. Progress reports actual ranked counts;
  Curious and Not for me remain separately identified. No user-facing “handled” language remains.
- The redundant “Rank by affection or curiosity…” profile disclaimer is removed.
- Browse all dogs is an inline mode within Rank, with 24 portraits per page, alphabetical ordering,
  name/alias search, dog-family and ranking/list filters, and an empty-state reset. It includes all
  completed identities, including already ranked or deliberately hidden entries when browsing all;
  the discovery rail and Surprise me exclude handled entries.
- A gallery portrait opens the existing full profile with a larger image. Previous/next controls
  and arrow keys follow the filtered sequence across page boundaries. Closing returns focus and
  visibility to the current portrait. Text inputs keep their normal arrow-key behavior. Gallery
  filters/page stay in the current page session, including after ranking or canceling a comparison.
- Comparisons show the full sourced summary plus supported size/origin facts on desktop.
  Responsive images use contain sizing so ears, feet, and tails remain visible. A native choice
  button covers the whole card; a small circled info icon sits in the portrait corner, with a
  separate 44px hit area above the choice. There are no visible footer buttons. Clicking the image,
  text, or surrounding card selects the dog. Keyboard focus covers the card.
- Phone comparisons keep both choices within the portrait or landscape viewport. About this dog
  opens the full profile separately, suppresses ranking/list mutations within that temporary view,
  and returns to the same pair and control. Escape closes About first; Escape from the active
  comparison cancels. Ranking choices retain keyboard focus as cards update.
  Review order uses the same profile disclosure.

Ranking Detailed uses an independently authored `shortDescription`, displayed completely without
line clamping. Photos contains portraits, names, rank badges and quiet info controls. Compact is
a dense list with small thumbnails and names. Keyboard Move handles retain focus across rerenders
so consecutive arrow presses work in every view. Full summaries remain in desktop comparisons and
profile details; phone comparisons defer prose to the separate About view.

## Implementation boundaries

New browser modules/styles: `dogs-explore.js`, `dogs-explore.css`, `dogs-comparison.css`,
and shared `category-switcher.js` / `category-switcher.css`. Pure filtering and pagination live in
`lib/dogs-explore.js`. The runtime syntax/cache checks include these dependencies.

The 307 completed profile/portrait pairs, 1,239 source identities, account tables, persistence
namespaces, ranking mechanics, and artwork-purpose gates are unchanged. All 307 completed profiles
now have reviewed short descriptions; their existing full summaries and supporting fields are
unchanged. The gallery receives only identities that pass the existing public completion gate. No new artwork was generated.
The production root continues to redirect to Movies.

## Validation

The browser regression covers exact gallery membership, non-mutating portrait browsing,
aliases/families/empty results, page boundaries, detail return focus, rank/cancel context,
category round trips with ranking preservation, compact first-screen geometry, and mobile
navigation remaining at the viewport bottom. Comparison checks cover full desktop descriptions,
uncropped portraits, separate actions, profile return, keyboard focus, and exact phone
390×844 / 844×390 viewports. Existing iPad, failure recovery, sync, snapshot, backup, and export
flows remain covered.

The full `npm run verify` passed: 455 Node tests, 24 Deno tests, syntax/cache checks,
all data validators, and 40 browser flows (`reports/e2e/runs/2026-09-23T052801Z`).
The gallery flow passed again after tightening scroll restoration
(`reports/e2e/runs/2026-09-23T053021Z`). Vercel deployed `cd85278c`; all 49 production smoke checks passed. Rendered production
gallery/profile checks were clean. See the implementation status for versions and evidence.


The ranking-priority follow-up adds real pointer checks on comparison images/names, real Escape
checks from About during comparisons/review and both phone orientations, full-pack membership,
rank/cancel return with scroll/focus, progress refresh, and the grouped discovery/action hierarchy.
Release and production evidence is recorded in `notes/testing/dogs-implementation-status.md`.

The `610c2eea` refinement covers direct discovery/Surprise ranking, full-pack ranked-last ordering and
grayscale treatment, image-corner info controls, untruncated authored short descriptions, simplified
Photos/Compact layouts, and repeated keyboard moves with focus retention. Exact phone portrait and
landscape checks also require useful image height, not just cards that fit inside the viewport.

The final refinement passed full verification (455 Node, 24 Deno, all validators, 41 browser
flows; `reports/e2e/runs/2026-09-23T064410Z`). Vercel deployed `610c2eea`, all 49 production
checks passed, and a rendered live ranking/profile check confirmed separate short/full copy.
