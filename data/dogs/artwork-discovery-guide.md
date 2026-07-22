# StackRank Dogs artwork discovery queue

Status: review-only operator aid as of 2026-07-17. It is not a rights decision, an approval list, or
legal advice.

`artwork-discovery-queue.json` accounts for every current-canonical Dogs concept that has no row in
`image-rights.json`. It is derived deterministically from the catalog, rights ledger, packs, and
license policy. Exact source versions and byte-level SHA-256 digests are embedded in the artifact.

## Build and verify

```sh
node scripts/build-dog-artwork-discovery-queue.mjs
node scripts/build-dog-artwork-discovery-queue.mjs --check
```

The builder makes no network request and does not edit the catalog, rights ledger, packs, policy, or
any remote system. It only writes the generated queue. `--check` is read-only and fails if the
tracked artifact is stale.

The current priority order is:

1. concepts in promoted/starter packs;
2. remaining concepts ordered by the number of editorial packs containing them;
3. the current-canonical long tail, ordered by canonical display name and VBO id.

Priority indicates editorial surface area only. It is not evidence that a search result is the
right dog, is reusable, or should be approved. Concepts that already have a ledger row are absent
even when that row is pending or quarantined; those belong in the separate human-review workspace.

## Use one queue item

Each item contains one deliberately narrow canonical-name query and two bounded, read-only discovery
inputs:

- Openverse page 1, at most 10 Wikimedia results, advertised `cc0`, `pdm`, `by`, or `by-sa`, with
  commercial use and modifications required and mature/dead results excluded;
- Wikimedia Commons image-namespace search, at most 10 results.

Openverse metadata is discovery-only and Commons search has no trustworthy license filter. Neither
result list establishes identity or reuse rights. Work one item at a time and use the existing
create-only importer only after choosing one exact Commons `File:` page or `curid` URL:

```sh
node scripts/fetch-dog-artwork.mjs openverse \
  --catalog-id "<catalogId>" \
  --query "<discovery.query>" \
  --limit 10 \
  --source wikimedia \
  --out "/tmp/<create-only-discovery-file>.json"

node scripts/fetch-dog-artwork.mjs commons \
  --catalog-id "<catalogId>" \
  --file "<exact Commons File title or curid URL>" \
  --out "/tmp/<create-only-candidate-file>.json"
```

Do not automate the queue into bulk requests or downloads. Provider rate limits, search ambiguity,
and the required per-file judgment make that both operationally unsafe and editorially unsound.

## Evidence contract

The artifact embeds the exact `dogs-artwork-ledger-v1` candidate-field contract. Before a candidate
can even be considered for manual ledger promotion, the workflow must capture:

- the exact Commons source page and revision id/timestamp;
- the original URL, title, creator, source credit, and attribution requirement;
- the exact allowlisted license label, version, and canonical URL;
- Commons SHA-1, byte count, MIME, and dimensions plus a locally streamed SHA-256;
- the canonical VBO id and a human subject-identity decision;
- a concrete review of upstream rights and non-copyright restrictions;
- modifications and delivery state.

Every discovery item and every imported candidate begins with UI display, public snapshot, and raster
export denied. The existing importer cannot edit `image-rights.json`, and a human must separately
review any pending candidate. Public-domain-marked files require additional manual evidence; they
are never auto-imported.

Regenerate the queue whenever the catalog, packs, policy, or ledger changes. A smaller queue can mean
only that a ledger row exists—not that rights were approved, assets were processed, or launch
coverage improved.
