import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductEvent,
  countBucket,
  sanitizeProductEventProperties,
  shouldCollectProductTelemetry,
} from "../lib/telemetry.js";

const sessionId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

test("countBucket groups counts without exposing exact list sizes", () => {
  assert.equal(countBucket(0), "0");
  assert.equal(countBucket(1), "1");
  assert.equal(countBucket(4), "2_4");
  assert.equal(countBucket(9), "5_9");
  assert.equal(countBucket(24), "10_24");
  assert.equal(countBucket(49), "25_49");
  assert.equal(countBucket(99), "50_99");
  assert.equal(countBucket(100), "100_plus");
  assert.equal(countBucket(-4), "0");
});

test("sanitizeProductEventProperties keeps only bounded non-identifying fields", () => {
  assert.deepEqual(
    sanitizeProductEventProperties({
      source: "suggestion_related",
      list_size: "10_24",
      count: "2_4",
      signed_in: true,
      title: "The Matrix",
      tmdb_id: 603,
      outcome: "contains spaces",
      format: "unknown_token",
    }),
    {
      source: "suggestion_related",
      list_size: "10_24",
      count: "2_4",
      signed_in: true,
    },
  );
});

test("buildProductEvent rejects unknown events and invalid session ids", () => {
  assert.equal(buildProductEvent({ eventName: "movie_viewed", sessionId }), null);
  assert.equal(buildProductEvent({ eventName: "session_started", sessionId: "stable-user-id" }), null);
});

test("buildProductEvent returns the storage row shape", () => {
  assert.deepEqual(
    buildProductEvent({
      eventName: "ranking_completed",
      sessionId,
      properties: { source: "search", list_size: "5_9", signed_in: false },
    }),
    {
      event_name: "ranking_completed",
      session_id: sessionId,
      properties: { source: "search", list_size: "5_9", signed_in: false },
    },
  );
});

test("quick-start events accept only the bounded quick-start source", () => {
  assert.deepEqual(
    buildProductEvent({
      eventName: "quick_start_pack_opened",
      sessionId,
      properties: { source: "quick_start", list_size: "0", pack_slug: "private-pack" },
    }),
    {
      event_name: "quick_start_pack_opened",
      session_id: sessionId,
      properties: { source: "quick_start", list_size: "0" },
    },
  );
});

test("taste explorer events retain only bounded context", () => {
  assert.deepEqual(
    buildProductEvent({
      eventName: "taste_lens_opened",
      sessionId,
      properties: { source: "home", list_size: "25_49", signal: "Drama" },
    }),
    {
      event_name: "taste_lens_opened",
      session_id: sessionId,
      properties: { source: "home", list_size: "25_49" },
    },
  );
});

test("telemetry runs only on production and honors DNT/GPC", () => {
  assert.equal(shouldCollectProductTelemetry({ hostname: "www.stackrankapp.com" }), true);
  assert.equal(shouldCollectProductTelemetry({ hostname: "localhost" }), false);
  assert.equal(
    shouldCollectProductTelemetry({ hostname: "www.stackrankapp.com", doNotTrack: "1" }),
    false,
  );
  assert.equal(
    shouldCollectProductTelemetry({ hostname: "www.stackrankapp.com", globalPrivacyControl: true }),
    false,
  );
});
