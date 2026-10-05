# Deployment output exclusions

> Superseded in October 2026 by the allowlist deployment contract in
> `deployment-file-contract.md`: Vercel now serves only `dist/public` built from
> `deploy/public-files.json`. `.vercelignore` remains as a build-source trim. This note is the
> historical record of the ignore-list cleanup.

Validated October 4, 2026 against source commit `b31db43e`.

Vercel uses the Other preset with the repository root as static output and no build command.
`.vercelignore` excludes development artifacts without deleting or untracking their source.

The October 4 exclusion change covers five design workspaces, assistant/automation files,
portrait cohort and continuation records, regeneration manifests, profile refresh inputs,
profile authoring overrides, profile schema, and generated-artwork build policy.

Preserve:
- Application HTML/JS/CSS, `lib/`, `vendor/`, icons, OG image, robots and sitemap.
- `data/suggestion-packs.json` and the six JSON documents fetched by `dogs.js`:
  catalog, packs, image rights, artwork license policy, breed profiles and generated artwork.
- All generated WebPs referenced by `generated-artwork.json`.
- `generated-artwork-batch-*.json`, fetched by the deployed artwork-review tool for provenance,
  prompts, scene sources and QA. Excluding these requires a separate review-tool change.

Local validation confirmed 1,567 required files remained included, including 1,404 WebPs
and 79 artwork-review batch files. The Git-style ignore-rule comparison excludes 304
additional tracked paths: 37,896,528 bytes. Estimated tracked output falls from
177,070,428 to 139,173,900 bytes (21.4%). Vercel defaults and retained deployments can
make actual deployment storage differ; this is not a guaranteed billing reduction.

`npm run verify` passed: 533 Node tests, 31 Python tests, 24 Deno tests, 41 local browser
flows, and syntax/cache/data validation. Static inclusion checks are separate from a
Vercel build and production verification. Validate excluded URLs return 404 and runtime
URLs remain available after deployment; source removal does not delete older deployments.
