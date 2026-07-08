# Supabase JS Vendor Bundle

StackRank serves `@supabase/supabase-js` from `vendor/supabase-js-2.108.2.js` so the app does not execute third-party CDN JavaScript at runtime. `app.js` imports it as:

```js
import { createClient } from "./vendor/supabase-js-2.108.2.js?v=1";
```

## Current Pin

- Package: `@supabase/supabase-js`
- Version: `2.108.2`
- Bundle file: `vendor/supabase-js-2.108.2.js`
- Generator used: Deno 2 `deno bundle --platform=browser --node-modules-dir=auto --no-lock --minify npm:@supabase/supabase-js@2.108.2`

## Upgrade Procedure

1. Check Supabase's changelog and docs for breaking changes relevant to auth, PostgREST, realtime, and edge-function invocation.
2. Generate the new bundle outside the repo, then move the output into `vendor/`:

   ```bash
   rm -rf /tmp/stackrank-supabase-bundle
   mkdir -p /tmp/stackrank-supabase-bundle
   cd /tmp/stackrank-supabase-bundle
   deno bundle --platform=browser --node-modules-dir=auto --no-lock --minify npm:@supabase/supabase-js@VERSION -o supabase-js-VERSION.js
   cp supabase-js-VERSION.js /Users/danbretl/src/stackrank/vendor/
   ```

3. Update the import in `app.js` to the new filename and bump the vendor `?v=`.
4. Bump `app.js?v=N` in `index.html` and update exact-version smoke assertions.
5. Run `npm run check:cache`; commit the updated `data/asset-versions.json`.
6. Run `npm run verify`, then `npm run test:production` after the deploy reaches production.

Do not add `https://cdn.jsdelivr.net` or another package CDN back to `script-src`.
