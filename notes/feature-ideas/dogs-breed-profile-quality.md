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

- Personality and character come first. Most readers will not know the breed and want to understand
  what it is like: sociability, independence, sensitivity, playfulness, watchfulness, persistence,
  attachment, learning style, vocal habits, and instincts, when the sources support them.
- Usually open with character, then develop it through a distinctive habit, working skill, or
  memorable piece of history. Do not replace an appearance catalog with a list of historical jobs.
- Prefer two or three natural sentences, usually 230–650 characters, with at least two useful
  nonvisual takeaways. The test is: **what does this teach someone who already sees the portrait?**
- Appearance is a minor supporting detail only when it explains something meaningful about the
  breed. Avoid opening with size, coat, color, body shape, or a conformation-standard inventory.
- Describe documented tendencies naturally (“often,” “tends to,” “can be”), without turning every
  sentence into a disclaimer. Personality is welcome; individual behavior guarantees, household
  suitability claims, and unsupported intelligence/trainability rankings are not.
- Prefer primary breed organizations, standards' behavior and utilization sections, and original
  research. Record evidence for the actual personality/history claims, not just physical identity.
  Thinly documented regional populations may need a work/history-led note; do not invent character
  or generalize a finding about one local population to every related dog.
- Put research status, catalog mechanics, and editorial process in source notes, never in summaries.
- Do not pad an unknown history with app promotion or a generic “interesting fact.”
- Preserve precise breed/variety/crossbreed/historical identity and avoid unsupported certainty.
- Individually written copy requires traceable sources; generated portraits and their prompts are
  not evidence for breed history or morphology.
- Keep the general individual-dog caveat in its shared footnote rather than repeating it in each profile.
- The optional fact should add a distinct nonvisual insight; leave it empty when it would repeat the
  summary. Recognition dates and name etymologies should not displace richer character information.
- Apply this contract to the main app and artwork reviewer. Image prompts still need accurate
  morphology; customer-facing prose has a different purpose.

## Authoring workflow

Use the project-specific `stackrank-dog-profiles` skill when writing or revising these profiles.
Its installed entry point is `/Users/danbretl/.codex/skills/stackrank-dog-profiles/SKILL.md`;
this document remains the versioned writing contract for every collaborator.

Edit the exact VBO identity in `data/dogs/profile-overrides.json` or the assigned
`data/dogs/profile-refresh-{a,b,c}.json`, preserving unrelated fields. Keep `sources` records with
HTTPS URL, title, and claim-specific evidence and accurate review dates. Build the compiled artifact
with `npm run build:dogs:profiles`; do not hand-edit it. Update dataset/entry-point cache versions,
run `npm run verify`, and inspect both rendered detail surfaces. During editorial review, read every
opening and compare nearby entries for repeated adjective lists or interchangeable prose.

## Verification

The complete verification suite passed for the cleanup: 441 Node tests, 24 function tests,
all catalog/profile/artwork/pack validators, and 38 browser flows. A rendered Affenpinscher detail
check confirmed that the short description contains no process commentary, the empty fact box is
hidden, and the coverage explanation appears only after expanding Sources & image notes.

## Illustrated-cohort depth pass

This section records the first depth pass. The personality-first revision below supersedes its prose.

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

## Personality-first revision

Dan approved the revised descriptions. This is the default direction for subsequent breeds and
future revisions; retain personality and character as the main content rather than drifting back
to appearance descriptions or history-led introductions.

Dan clarified that personality and character are the primary reason people unfamiliar with a breed
read its description. All 282 developed profiles, including the original 28, have therefore been
rewritten. Documented character usually leads; habits, instincts, working techniques and history
support it. Thinly documented regional populations stay within their evidence, and details about a
subgroup are explicitly scoped. Appearance-only callouts and generic closing sentences were removed.
The crossbreed fallback also drops its generic appearance/size sentence.

Product commit `ce6687ff` preserves 310 direct breed-source records with evidence for the new claims; 41 profiles
retain a distinct optional fact, and the other 241 omit the callout. The compiled artifact is
`dogs-field-guide-2026-09-22.5`, dataset cache version 4, shared by both Dogs detail surfaces.
All 282 developed summaries differ from the previous artifact, and the FCI source-number audit
found no mismatch with the exact catalog identities. The remaining 957 profiles are still brief;
future editorial expansion must use this character-first contract.

The project brief, launch plan, product/artwork handoffs and both kickoff prompts now state the
priority explicitly and distinguish sourced breed tendencies from predictions about individual
dogs. The installed `stackrank-dog-profiles` skill passed the skill validator.

The final `npm run verify` passed 443 Node tests, 24 Deno tests, all validators and all 38 Chrome
flows. Reports: `reports/runs/2026-09-23T011459Z` and `reports/e2e/runs/2026-09-23T011516Z`.
A rendered Basenji review dialog confirms the new character-led copy, no redundant fact box and
a separate FCI source disclosure. The generated fallback regression now checks a concise
crossbreed identity sentence without generic physical-description padding.

Vercel deployed `ce6687ff` successfully, and all 44 production smoke checks passed. The live
payload reports `.5` with 282 developed profiles. A rendered production Chinese Crested detail
panel leads with affection/playfulness, high-perching habits and engagement in agility, with the
distinct historical fact below it. Production verification log:
`/tmp/stackrank-character-profiles-production.log`.
