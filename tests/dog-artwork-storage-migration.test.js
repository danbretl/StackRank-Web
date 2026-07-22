import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260716090038_add_dog_artwork_storage.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Dogs artwork storage migration creates one bounded public WebP bucket", () => {
  assert.match(migration, /insert\s+into\s+storage\.buckets/iu);
  assert.match(migration, /'dogs-catalog'\s*,\s*'dogs-catalog'\s*,\s*true/iu);
  assert.match(migration, /5242880/iu);
  assert.match(migration, /array\s*\[\s*'image\/webp'\s*\]::text\[\]/iu);
  assert.doesNotMatch(migration, /on\s+conflict/iu);
});

test("Dogs artwork storage uses public URLs without browser list or write policies", () => {
  assert.doesNotMatch(
    migration,
    /create\s+policy[\s\S]*on\s+storage\.objects/iu,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*to\s+(?:anon|authenticated)/iu,
  );
});

test("Dogs artwork storage migration does not touch mature Movies data", () => {
  for (const table of ["rankings", "movie_lists", "pack_progress", "shared_lists"]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`(?:alter|drop|truncate|delete\\s+from|update)\\s+(?:table\\s+)?public\\.${table}\\b`, "iu"),
    );
  }
});
