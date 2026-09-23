# Dogs discovery and comparison refinement

Implemented and pushed in `cd85278c` on September 22, 2026 at Dan's request after comparing the live Movies, Dogs, and
internal artwork-review pages. The starting Dogs hero occupied most of the first screen before
any discovery portraits; its large search control competed with the more useful browsing paths.

## Product behavior

- The 64px desktop / 52px phone header keeps the brand, Rank / Ranking / You, and settings.
  A shared category dropdown beside the brand offers Movies and Dogs on both sites, with ordinary
  links, current-category indication, keyboard focus, Escape, and outside dismissal.
- “Find your kind of dog” keeps the bold typographic character in a compact, unboxed introduction.
  The redundant field-guide eyebrow, ranking instruction paragraph, and three repeated catalog
  counts are removed. Loading and error status remain visible when relevant.
- Browse all dogs and Surprise me lead; a smaller search field still ranks canonical/alias results
  directly. Four shuffled, unhandled breed portraits open profiles without changing a ranking.
  Recently ranked now uses plain typography and small portraits, followed by editorial packs.
- Browse all dogs is an inline mode within Rank, with 24 portraits per page, alphabetical ordering,
  name/alias search, dog-family and ranking/list filters, and an empty-state reset. It includes all
  completed identities, including already ranked or deliberately hidden entries when browsing all;
  the discovery rail and Surprise me exclude handled entries.
- A gallery portrait opens the existing full profile with a larger image. Previous/next controls
  and arrow keys follow the filtered sequence across page boundaries. Closing returns focus and
  visibility to the current portrait. Text inputs keep their normal arrow-key behavior. Gallery
  filters/page stay in the current page session, including after ranking or canceling a comparison.
- Comparisons show the full sourced summary plus supported size/origin facts on desktop.
  Responsive images use contain sizing so ears, feet, and tails remain visible. Choice and
  About this dog are separate controls with no overlapping/nested actions.
- Phone comparisons keep both choices within the portrait or landscape viewport. About this dog
  opens the full profile separately, suppresses ranking/list mutations within that temporary view,
  and returns to the same pair and control. Ranking choices retain keyboard focus as cards update.
  Review order uses the same profile disclosure.

No short-description field was added. The current summaries fit the desktop comparison layout;
compact phone cards intentionally defer prose to the full profile. If a future surface needs an
independent one-sentence hook, author and review it explicitly instead of slicing paragraphs.

## Implementation boundaries

New browser modules/styles: `dogs-explore.js`, `dogs-explore.css`, `dogs-comparison.css`,
and shared `category-switcher.js` / `category-switcher.css`. Pure filtering and pagination live in
`lib/dogs-explore.js`. The runtime syntax/cache checks include these dependencies.

The 307 completed profile/portrait pairs, 1,239 source identities, account tables, persistence
namespaces, ranking mechanics, and artwork-purpose gates are unchanged. The gallery receives
only identities that pass the existing public completion gate. No new artwork was generated.
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
