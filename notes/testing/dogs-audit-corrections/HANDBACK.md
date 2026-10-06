# Dogs audit correction release

The released catalog contains 806 public profiles/portraits and 433 hidden identities. All 1,239
stable IDs and source-ID mappings remain intact. 902 completed pairs are preserved; 96 completed
pairs receive editorial holds, and 337 remain incomplete. N contributes 60 public additions and 40
held completed pairs. Counts are review outcomes, not publication quotas.

Baseline main: `c3ba4b030f7ad587e8a11cfc264c86b2543e5ab1`. Original N hand-back:
`7de19455`, product `34dc547d`; original checkout and historical evidence remain untouched.
Release product: `4f24601df3a20b7189692c07deeeaf3dd9cf31fa` (two-parent merge, safely fast-forwarded into main).
Release branch: `dogs/audit-corrections-release`. The final documentation follow-up leaves the
public deployment bytes unchanged.

## Decisions and coverage

All 81 audit proposals and 19 open issues have independent dispositions in
[evidence/coverage-index.json](evidence/coverage-index.json). The review covered every 20 medium
individual finding, the medium systemic cross issue, all remaining individual findings (including
more than 10 diverse lows), 9 clear-profile samples spanning old/new cohorts and hidden templates,
and representative systemic claims. All 100 N full/short/surfaced facts and actual portraits were
reviewed; 214 original systemic identity leads were adjudicated. This is a stratified audit of the
audit plus full N delta review, not a new factual certification of every 7,741 historical claim.

- 86 profiles across 38 authoring files were corrected or supplemented. Exact guarded field changes
 and review evidence are in [applied-profile-fields.json](applied-profile-fields.json).
- 71 baseline anecdotal-cross findings now yield 16 supported rewrites and 55 evidence holds.
 Additional N review finds 16 cross holds and several supported exemptions. Seven initial holds
 were reopened after targeted primary/program research established useful concise descriptions.
- Display aliases are curated separately from search synonyms; unsupported nicknames and the
 Nanny Dog endorsement no longer appear. A demonstrably erroneous Tahltan/Kyrgyz synonym is
 removed from search, while both existing source IDs still resolve.
- Registry origin is attributed separately from historical geography. Empty optional facts remain
 empty when evidence is insufficient; no country is guessed from a word in the prose. Registry
 groups and semantic editorial families are distinct; utility/heritage/coat tags no longer drive
 family taste signals. Size bands have documented meanings and 35 explicit adjudications.
- 13 supported classification edits retain all identities. Regional/historical domestic types and
 specific varieties remain eligible without requiring one registry’s recognition. American Akita
 stays public. The hidden Japanese Akitainu synonym remains distinct in storage and suppressed
 pending a useful distinct scope.

The six portrait findings were checked against actual 960px and 1536px images plus full standards.
Campeiro Bulldog and King Charles Spaniel Tricolour received targeted replacements. Jack Russell,
Bucovina, Cursinu and Gorbeiakoa regeneration proposals were rejected as unproven or source-scope
errors. In particular, Gorbeiakoa’s very-short hair clause describes the head, not its whole coat.
Two built-in text-only calls produced two accepted native 1536×1024 originals; 0 retries/failures.
All old natives/variants remain preserved. Four superseded WebPs are excluded from deployment;
four new variants are bound to additive correction records and reviewed native hashes.

## Holds and preservation

[holds-and-reopening.md](holds-and-reopening.md) separates 96 completed holds into 70 remediable
cross-copy/evidence gaps, 23 redundant N umbrellas, 2 broad wild/domestic hybrid concepts and 1
Labrador Husky exact-identity conflict. There are 251 total editorial holds including 155 already
incomplete entries. Each identity retains a specific authored reason and evidence pointer.

Suppression is reversible and does not falsify previous copy/art approval. Full local/account
rankings, both lists and JSON backups retain hidden records and ordering. Reorder changes only
visible slots; new shares/exports use the public projection. Existing published snapshots remain
historical user payloads. No automatic merge, deduplication, renumbering, deletion or real-account
write occurred. [combined-reconciliation.json](combined-reconciliation.json) records per-ID
changes, all N outcomes and unchanged identity mappings.

The immutable audit’s 558 input hashes matched at baseline; 5,617 audit files were independently
rehashed unchanged after review. Original N native/source bindings passed the historical private
validator again. The clean-checkout release validator verifies committed identity/native/copy
commitments and explicit correction receipts; it does not pretend to re-read private source bytes.
See [N-validation-boundary.md](N-validation-boundary.md). Private sources, native masters, rejects,
archives and main’s unrelated untracked files remain in their original locations. Ignored read
links made existing natives available to the isolated builder; none enter the public deployment.
Off-Mac backup remains unverified; no originals were deleted or relocated.

## Verification and release boundary

[final-independent-review.json](final-independent-review.json) records the independent all 1,239-ID
compatibility fixtures, source-ID preservation and corrected public projection. New regression
coverage ties accepted authoring to compiled outputs, rejects malformed policies, tests origin
precedence and semantic taste effects, and verifies suppressed ranking/list/backup/account/share
behavior. N’s inherited tests were repaired to use disposable synthetic fixtures instead of ignored
private working files; production generation guards remain unchanged.

The staged deployment contains 2,167 files, 1,804 portrait variants, no private research/notes/native
paths, no symlinks and no unclassified files. Vercel continues to serve only `dist/public`; GitHub
Pages remains disabled. Full local verification passed: 609 Node, 58 Python, 24 Deno and 43 staged browser tests.
See [local-verification.json](local-verification.json). A localhost bind was blocked in the restricted sandbox;
the approved elevated run used a disposable Chrome profile and isolated account fixtures.

Exact-product [GitHub Test / Verify](https://github.com/danbretl/StackRank-Web/actions/runs/37419305667)
completed successfully. [CI receipt](product-ci.json) binds its result to the product SHA.

Production passed 49 paced smoke checks, 19 exact live byte matches, eight exclusion checks and
five bounded rendered flows covering Movies PNG/sharing, Dogs, Books, privacy and home.
[Production verification](production-verification.json), [byte/exclusion receipts](production-hashes.json)
and [rendered results](production-rendered.json) record their scope. Vercel deployment
`dpl_Dcm2tgBnKijiC3eK5DGHAyADB8WF` is READY for the exact product SHA and production aliases;
see [independent Vercel receipt](production-vercel.json). No firewall challenge occurred.
The full-site production contract crawl was deliberately not run; staged closure covered every
public file, while production used bounded byte and exclusion probes. GitHub Pages API returns 404.

## Residual limits and rollback

Some external sources remain inaccessible; retained originals or safely narrowed copy were used
where supported. Exact Grey Collie, Maltese Terrier, Aryan Molossus and Labrador Husky meanings
remain unresolved and safely hidden. Historical/regional research candidates are not declared
fictional because recognition or stronger evidence is absent. Optional origin coverage is not
complete. Source/registry accounts are attributed; no native-master license clearance or universal
behavioral prediction is inferred from structural validation.

Rollback should use `git revert -m 1 4f24601df3a20b7189692c07deeeaf3dd9cf31fa`, without resetting user data or
removing archives; verify the resulting cache versions, CI and production before declaring success.
Removing a documented editorial hold after adequate evidence review restores the existing ID.
N’s original branch, historical inputs and all accepted/rejected artwork remain available for
recovery. This hand-back’s own final documentation revision can be obtained with
`git log -1 --format=%H -- notes/testing/dogs-audit-corrections/HANDBACK.md`.
