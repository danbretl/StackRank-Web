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

## Next depth pass

The immediate priority is the illustrated cohort: research the 254 portrait-bearing breeds that
lack individually written profiles, using official standards and breed organizations. Broader
catalog entries retain concise sourced summaries until their own research is complete.
