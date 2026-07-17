import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL(
  "../supabase/migrations/20260716090037_add_category_data_tables.sql",
  import.meta.url,
), "utf8");

const TABLES = [
  "category_rankings",
  "category_lists",
  "category_pack_progress",
  "category_shared_lists",
];

test("new-category migration is additive and never alters mature Movies tables", () => {
  TABLES.forEach((table) => {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "i"));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  });
  ["rankings", "movie_lists", "pack_progress", "shared_lists"].forEach((legacyTable) => {
    assert.doesNotMatch(migration, new RegExp(`(?:alter|drop|truncate) table public\\.${legacyTable}\\b`, "i"));
  });
});

test("every owner table has SELECT, INSERT, UPDATE, and DELETE RLS policies", () => {
  TABLES.forEach((table) => {
    ["select", "insert", "update", "delete"].forEach((operation) => {
      assert.match(
        migration,
        new RegExp(`on public\\.${table} for ${operation}[\\s\\S]*?to authenticated`, "i"),
      );
    });
  });
  assert.equal(
    (migration.match(/list_id = \('user:' \|\| \(select auth\.uid\(\)\)::text\)/g) || []).length,
    20,
  );
});

test("all UPDATE policies carry both ownership USING and WITH CHECK clauses", () => {
  TABLES.forEach((table) => {
    assert.match(
      migration,
      new RegExp(
        `on public\\.${table} for update[\\s\\S]*?using \\(list_id = [\\s\\S]*?with check \\(list_id =`,
        "i",
      ),
    );
  });
});

test("Data API grants are explicit and anonymous reads are snapshot-only", () => {
  TABLES.forEach((table) => {
    assert.match(
      migration,
      new RegExp(`grant select, insert, update, delete on table public\\.${table}[\\s\\S]*?to authenticated, service_role`, "i"),
    );
  });
  assert.match(
    migration,
    /grant select \(slug, category, payload, created_at, updated_at\)[\s\S]*?category_shared_lists to anon/i,
  );
  assert.doesNotMatch(migration, /grant select, insert[^;]+category_shared_lists[^;]+to anon/i);
  assert.match(
    migration,
    /on public\.category_shared_lists for select\s+to anon\s+using \(revoked_at is null\)/i,
  );
});

test("JSON payloads and generic identifiers are bounded in Postgres", () => {
  assert.match(migration, /category_rankings_items_size[\s\S]*?1048576/i);
  assert.match(migration, /category_lists_items_size[\s\S]*?1048576/i);
  assert.match(migration, /category_pack_progress_state_size[\s\S]*?8192/i);
  assert.match(migration, /category_shared_lists_payload_size[\s\S]*?1048576/i);
  assert.match(migration, /category_shared_lists_payload_fields/i);
  assert.equal((migration.match(/list_id_format check/g) || []).length, 4);
  assert.match(migration, /primary key \(list_id, category, list_type\)/i);
  assert.match(migration, /unique \(list_id, category\)/i);
});
