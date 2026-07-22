# StackRank Dogs catalog review workflow

Status: local editorial workflow as of 2026-07-21. The generated report is a review aid, not a
catalog editor. It cannot change `classification.json`, `catalog-overrides.json`, the pinned VBO
artifact, or any compiled catalog output.

The accepted full-queue editorial audit and its primary-source correction evidence are recorded in
`notes/testing/dogs-catalog-editorial-audit-2026-07-21.md`. This workspace remains useful for future
VBO releases and proposed follow-up changes; browser-local drafts are never accepted decisions.

## Build and open the workspace

```sh
npm run review:dogs:catalog
open reports/dogs-catalog-review/index.html
```

The report is noindex and generated under the gitignored `reports/` directory. It contains all 698
entries from the seven deterministic queues in `classification-review.json`:

- alias, variety, crossbreed, historical, and excluded decisions;
- regional/landrace candidates;
- retained ambiguous search names.

Each row carries its exact queue entry, current classification and relation, pinned VBO label,
parents, synonyms, cross-references, source URLs, runtime entity context, and every relevant explicit
classification/entity/search-alias override already in `catalog-overrides.json`.

## Draft outcomes

Draft decisions are intentionally narrower than a source edit:

- **Not reviewed** — no editorial conclusion recorded;
- **Accept current classification** — the evidence currently supports the generated result;
- **Propose an override** — record the proposed disposition and target/parent VBO id, then explain
  the evidence in notes;
- **Defer for follow-up** — more evidence or a second reviewer is needed.

The workspace stores unfinished decisions under
`stackrank:dogs-catalog-review:v1` in that browser's `localStorage`. Filters, pagination, and sorting
do not modify the draft. “Clear local drafts” removes only this review key after confirmation.

## Export boundary

**Export review notes** downloads a JSON file with:

- the pinned catalog/source versions;
- the exact queue key, current disposition, reason, relation, and subject ids for every drafted row;
- the browser-local decision, proposed disposition/target, notes, follow-up flag, and timestamp.

The export has no import/apply counterpart. It is deliberately not shaped as
`catalog-overrides.json`, and no script consumes it automatically. An accountable editor must review
the evidence again, translate accepted conclusions into the source override schema by hand, rebuild
the catalog, inspect the resulting diff, and run:

```sh
npm run validate:dogs:catalog
npm test
```

Never describe a local draft or exported review aid as an accepted catalog decision.
