import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatRuntime,
  formatRuntimeTotal,
  formatShareRuntimeTotal,
  decadeLabel,
  rankedCountLabel,
  dayKey,
  formatShortDate,
} from "../lib/format.js";

test("formatRuntime renders h/m, dropping zero parts", () => {
  assert.equal(formatRuntime(0), "");
  assert.equal(formatRuntime(45), "45m");
  assert.equal(formatRuntime(60), "1h");
  assert.equal(formatRuntime(90), "1h 30m");
  assert.equal(formatRuntime(125), "2h 5m");
});

test("formatRuntimeTotal shows a dash for empty totals", () => {
  assert.equal(formatRuntimeTotal(0), "--");
  assert.equal(formatRuntimeTotal(150), "2h 30m");
});

test("formatShareRuntimeTotal picks duration / loading / unavailable / dash", () => {
  assert.deepEqual(formatShareRuntimeTotal({ minutes: 200 }, 3, false), { value: "3h 20m", isDuration: true });
  assert.deepEqual(formatShareRuntimeTotal({ minutes: 0 }, 4, true), { value: "Loading", isDuration: false });
  assert.deepEqual(formatShareRuntimeTotal({ minutes: 0 }, 4, false), { value: "Unavailable", isDuration: false });
  assert.deepEqual(formatShareRuntimeTotal({ minutes: 0 }, 0, false), { value: "--", isDuration: false });
});

test("decadeLabel and rankedCountLabel format as expected", () => {
  assert.equal(decadeLabel(1990), "1990s");
  assert.equal(rankedCountLabel(1), "1 ranked");
  assert.equal(rankedCountLabel(12), "12 ranked");
});

test("dayKey returns ISO day or null on bad input", () => {
  assert.equal(dayKey("2026-06-26T08:30:00.000Z"), "2026-06-26");
  assert.equal(dayKey(null), null);
  assert.equal(dayKey(""), null);
  assert.equal(dayKey("not a date"), null);
});

test("formatShortDate returns Unknown for missing/invalid dates", () => {
  assert.equal(formatShortDate(null), "Unknown");
  assert.equal(formatShortDate("nonsense"), "Unknown");
  // A real date formats to a non-empty, non-"Unknown" string (locale-dependent).
  const formatted = formatShortDate("2026-06-26T12:00:00.000Z");
  assert.notEqual(formatted, "Unknown");
  assert.ok(formatted.length > 0);
});
