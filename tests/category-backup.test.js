import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryBackup,
  CATEGORY_BACKUP_KIND,
  parseCategoryBackup,
} from "../lib/category-backup.js";

test("category backups round-trip without hiding their category", () => {
  const ranking = [{ entityRef: { domain: "books", id: "OL1W" } }];
  const backup = buildCategoryBackup("books", ranking, "2026-07-13T12:00:00.000Z");
  assert.equal(backup.kind, CATEGORY_BACKUP_KIND);
  assert.deepEqual(parseCategoryBackup(JSON.stringify(backup), "books"), {
    category: "books",
    exportedAt: "2026-07-13T12:00:00.000Z",
    ranking,
  });
});

test("category backup restore rejects cross-category and malformed input", () => {
  const backup = buildCategoryBackup("books", []);
  assert.equal(parseCategoryBackup(backup, "movies"), null);
  assert.equal(parseCategoryBackup('{"kind":"stackrank-category-backup"}', "books"), null);
  assert.equal(buildCategoryBackup("Not Valid", []), null);
});
