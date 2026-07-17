# StackRank Dogs artwork review workflow

Status: engineering workflow as of 2026-07-16. This is not legal advice. Every shipped image still
needs accountable human review, and provider/license terms must be rechecked before launch.

## Safety invariant

Catalog identity never depends on image availability. Search, ranking, lists, backups, and details
must work with the neutral fallback. An image is usable only when all of these are true:

1. `image-rights.json` has the exact `assetId` and canonical VBO `catalogId`.
2. Original bytes match the recorded SHA-256, Commons SHA-1, and byte count.
3. The exact file-page revision, creator, source page, original URL, license label/version/URL,
   source credit, attribution, and modifications are present.
4. A human has approved the rights chain, confirmed that the subject matches the catalog concept,
   and considered non-copyright restrictions.
5. Both optimized variants have immutable object paths and verified hashes.
6. Detail and Credits surfaces expose attribution, source/license links, and modifications.
7. The requested purpose's global gate and exact per-asset boolean are both enabled.

Openverse is discovery only. Its terms say it does not verify licensing status. An Openverse result
never enters `image-rights.json` directly and never becomes an image request in the product.

## 1. Discover candidates

Use at most one bounded Openverse page. The tool forces commercial/modification-capable advertised
licenses, excludes mature/dead results, limits anonymous requests to 20, and records every result as
unverified with all purposes denied.

```sh
node scripts/fetch-dog-artwork.mjs openverse \
  --catalog-id VBO:0000661 \
  --query "Broholmer dog" \
  --limit 10 \
  --source wikimedia \
  --out /tmp/artwork-discovery-broholmer.json
```

Search relevance is not identity evidence. Visually reject unrelated dogs, ambiguous multi-dog
scenes, misleading historic art, and images whose crop would not show the subject honestly.

## 2. Import one exact Commons file

Pass the exact `File:` title or the Commons `curid` landing URL returned by Openverse. The importer
uses an identified User-Agent and MediaWiki `maxlag`, captures the current page revision and
extended metadata, downloads that one original into a hash stream, verifies Commons' SHA-1 and byte
count, computes SHA-256, and emits a pending candidate. It refuses NC, ND, contradictory,
restricted, unsupported, provenance-free, oversized, or non-bitmap sources.

```sh
node scripts/fetch-dog-artwork.mjs commons \
  --catalog-id VBO:0000661 \
  --file "https://commons.wikimedia.org/w/index.php?curid=76249233" \
  --openverse-id 8d7545df-2bd7-4120-9023-24b9f78e315a \
  --out /tmp/artwork-candidate-broholmer.json
```

The importer cannot overwrite `data/dogs/image-rights.json`. Promotion is deliberately manual.
Public-domain claims are never auto-imported; a reviewer must document the exact basis separately.

## 3. Human source and subject review

Open the pinned `sourcePageRevision.id`, the current file page, the original at full resolution, and
the exact Creative Commons legal code. Check:

- the uploader is the creator or the upstream license chain is complete;
- the selected license is one exact allowlisted CC0, CC BY, or CC BY-SA version;
- the page has no NC, ND, editorial-only, contradictory, or deletion-warning condition;
- the image actually depicts the canonical breed/type and not merely a similar-looking dog;
- visible people, trademarks, artwork, event signage, privacy, personality, and moral-rights issues;
- the supplied creator/source credit and any special attribution request;
- whether the proposed crop is faithful and non-derogatory.

Only then set `review.status` to `approved`, identify `reviewedBy` and `reviewedAt`, write concrete
`rightsNotes`, and set both review booleans true. Purpose booleans remain false until delivery and
attribution surfaces are ready.

## 4. Generate deterministic local variants

Choose a reviewed 3:2 crop explicitly; the processor never guesses a subject crop. It redownloads
and re-verifies the exact source, auto-orients, crops, strips metadata, and generates 320×213 and
960×640 WebPs with a fixed ImageMagick recipe. It records tool version, output hashes, byte counts,
object paths, and modifications in a manifest. It never uploads or changes the ledger.

```sh
node scripts/process-dog-artwork.mjs \
  --candidate /tmp/artwork-candidate-broholmer.json \
  --crop 0,84,2916,1944 \
  --out-dir /tmp/stackrank-broholmer-art \
  --storage-prefix dogs-catalog/vbo-2026-04-15-r1/
```

Inspect both WebPs visually. Repeat the command in a fresh directory and compare hashes before
promoting a processing-tool version. Do not check large originals or an unreviewed bulk download
into git.

## 5. Deliver without browser writes

Upload only after the storage bucket, operator path, and immutable cache behavior are approved.
Browser clients must remain read-only. Verify the remote bytes against the manifest, then copy the
two variant records into the ledger and set delivery to `uploaded_verified` (or
`bundled_verified` only for a deliberately checked-in small asset).

For every ready image, add `attributionCompliance`. For BY-SA images, also add
`shareAlikeCompliance` with the same license and no additional restrictions. Only then may
`uiDisplayAllowed` become true. Public snapshots and raster exports remain false until their global
launch gates and end-to-end attribution tests are separately approved.

## 6. Validate and report exact coverage

```sh
node scripts/validate-dog-artwork.mjs
node scripts/validate-dog-artwork.mjs --strict-launch
```

Default mode validates structure, policy, runtime catalog references, and deterministic coverage
without blocking ongoing fallback-first product work. Strict mode additionally requires 95% of
current canonical concepts and 100% of promoted concepts to have approved, delivered UI artwork.
It is expected to fail until that editorial work is real.

`data/dogs/artwork-coverage-report.json` distinguishes all ledger rows, approved rights, verified
delivery, exact license/provider distributions, UI/snapshot/raster coverage, and every unresolved
catalog id. Never describe pending rows as coverage.

## Missing and broken images

- Reserve the same aspect box to prevent layout shift.
- Show a monochrome keyline plus decorative abstract paw/initial; never another breed or an
  AI-generated substitute presented as evidence.
- Keep the canonical name and all ranking actions available.
- Treat the fallback as decorative; the surrounding canonical name is the accessible label.
- On a verified image load error, remove the failed image and reveal the fallback. Do not retry an
  unverified original URL.
- Detail may say “Photo awaiting rights review.” Cards should remain quiet.
- Public snapshots and raster exports omit any photo that is not explicitly cleared for that exact
  purpose.

## Takedown or correction

Set the affected row's review status and delivery status to `retired`, turn every purpose boolean
off, remove the catalog reference, regenerate the coverage report, and purge/replace the immutable
object through an operator-only process. The catalog entity and users' ranks remain unchanged.

## Primary provider/license references

Accessed 2026-07-16:

- [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo)
- [MediaWiki API etiquette](https://www.mediawiki.org/wiki/API:Etiquette)
- [Openverse API](https://api.openverse.org/)
- [Openverse terms of service](https://docs.openverse.org/terms_of_service.html)
- [Creative Commons license overview](https://creativecommons.org/share-your-work/use-remix/cc-licenses/)
