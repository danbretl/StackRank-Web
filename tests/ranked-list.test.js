import { test } from "node:test";
import assert from "node:assert/strict";

import { createRankedEntity, entityRefKey } from "../lib/entity.js";
import {
  mergeRankedListPayloads,
  parseRankedListPayload,
  serializeRankedListPayload,
} from "../lib/ranked-list.js";

const item = (id) =>
  createRankedEntity({
    entityRef: { domain: "books", type: "work", source: "openlibrary", id },
    snapshot: { primaryText: id },
  });

test("ranked-list payloads round-trip and fail closed", () => {
  const raw = serializeRankedListPayload([item("OL1W")], "2026-07-13T12:00:00.000Z");
  assert.deepEqual(parseRankedListPayload(raw), {
    items: [item("OL1W")],
    updated_at: "2026-07-13T12:00:00.000Z",
  });
  assert.deepEqual(parseRankedListPayload("{"), { items: [], updated_at: null });
  assert.deepEqual(parseRankedListPayload('{"movies":[]}'), { items: [], updated_at: null });
});

test("ranked-list merge uses newest order and appends older-only entities", () => {
  const merged = mergeRankedListPayloads([
    {
      items: [item("OL1W"), item("OL2W"), item("OL3W")],
      updated_at: "2026-07-12T12:00:00.000Z",
    },
    {
      items: [item("OL2W"), item("OL1W")],
      updated_at: "2026-07-13T12:00:00.000Z",
    },
  ]);
  assert.deepEqual(merged.items.map(entityRefKey), [
    "books:work:openlibrary:OL2W",
    "books:work:openlibrary:OL1W",
    "books:work:openlibrary:OL3W",
  ]);
  assert.deepEqual(merged.appendedItems.map(entityRefKey), ["books:work:openlibrary:OL3W"]);
});
