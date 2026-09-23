# Dogs breed-profile quality

## September 22, 2026 correction

Dan flagged a research-process sentence appearing inline in customer-facing breed descriptions.
It came from the shared fallback generator, not from the age of the images. Before this correction,
28 profiles were individually written; 1,211 used structured-data templates. The exact reported
sentence appeared in 849 canonical-breed summaries.

Product commit `82a69801` removes process and catalog filler across all fallback classes, removes
repeated editorial caveats from existing prose, permits genuinely brief entries without padding,
and hides the optional “Worth knowing” callout when no distinct sourced fact exists. Coverage notes
remain under the closed-by-default Sources & image notes disclosure. Both the main app and artwork
reviewer use the refreshed profile artifact.

## Writing contract

- Lead with the dog: origin, historical work, appearance, or another distinctive supported fact.
- Put research status, catalog mechanics, and editorial process in source notes, never in summaries.
- Do not pad an unknown history with app promotion or a generic “interesting fact.”
- Preserve precise breed/variety/crossbreed/historical identity and avoid unsupported certainty.
- Individually written copy requires traceable sources; generated portraits and their prompts are
  not evidence for breed history or morphology.
- Keep the general individual-dog caveat in its shared footnote rather than repeating it in each profile.

## Verification

The complete verification suite passed for the cleanup: 441 Node tests, 24 function tests,
all catalog/profile/artwork/pack validators, and 38 browser flows. A rendered Affenpinscher detail
check confirmed that the short description contains no process commentary, the empty fact box is
hidden, and the coverage explanation appears only after expanding Sources & image notes.

## Illustrated-cohort depth pass

Product commit `3dd3957a` adds individually written profiles for all 254 previously templated portrait-bearing breeds,
bringing the total to 282. The source artifacts are `data/dogs/profile-refresh-a.json` (85),
`profile-refresh-b.json` (85), and `profile-refresh-c.json` (84). They preserve 265 primary-source
references with evidence supporting the original prose. Sources include FCI/AKC/UKC standards,
national kennel and breed organizations, regional authorities, and original field studies.

The main app and artwork reviewer display direct breed-source links in closed-by-default notes.
Profile authors can omit a separate fact when it would repeat the summary; 49 individually written
entries do so. The compiler rejects duplicate or unknown identities and incomplete source records,
keeps review dates accurate, and gives explicit researched origins priority over structured matches.

The compiled artifact is `dogs-field-guide-2026-09-22.4`, loaded with cache version 3 by both apps.
All 1,239 records normalize successfully, all 282 portrait identities have written profiles, and
none contains the reported process boilerplate. The remaining 957 entries are deliberately brief
(314 structured-source matches and 643 catalog baselines); their full editorial research is still
open.

A source audit corrected the Bakharwal size against a regional survey, scoped Poodle sizes to the
FCI scheme, and omitted a disputed year in the Chinook expedition story. Indian Spitz retains
a conservative account of companion identity and native-breed show context rather than adding
unsupported morphology or an origin legend.

## Release verification

The final `npm run verify` passed 443 Node tests, 24 Deno tests, all validators, and all 38 Chrome
flows, including Dogs desktop/phone layouts and the artwork review workflow. Reports:
`reports/runs/2026-09-23T004138Z` and `reports/e2e/runs/2026-09-23T004156Z`.

Vercel deployed `3dd3957a` successfully; `npm run test:production` passed all 44 checks.
A direct production payload check confirmed profile version `.4` and 282 written profiles.
A rendered production Affenpinscher dialog showed the new breed-specific copy with a separate,
expandable FCI source link. The source-record schema, URL filtering, identity matching, blank-fact
behavior, and boilerplate exclusion have focused regression coverage.
