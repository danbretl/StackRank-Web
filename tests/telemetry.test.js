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

test("tonight events keep only bounded context and never the mood text", () => {
  assert.deepEqual(
    buildProductEvent({
      eventName: "tonight_opened",
      sessionId,
      properties: { list_size: "5_9", mood: "cozy 80s sci-fi" },
    }),
    {
      event_name: "tonight_opened",
      session_id: sessionId,
      properties: { list_size: "5_9" },
    },
  );
  assert.deepEqual(
    buildProductEvent({
      eventName: "tonight_picked",
      sessionId,
      properties: { source: "tonight_mood", count: "2_4", title: "Heat" },
    }),
    {
      event_name: "tonight_picked",
      session_id: sessionId,
      properties: { source: "tonight_mood", count: "2_4" },
    },
  );
  assert.deepEqual(
    buildProductEvent({
      eventName: "ranking_started",
      sessionId,
      properties: { source: "tonight", list_size: "10_24" },
    }).properties,
    { source: "tonight", list_size: "10_24" },
  );
});

test("public share-link events keep only aggregate context", () => {
  assert.deepEqual(
    buildProductEvent({
      eventName: "share_link_published",
      sessionId,
      properties: { list_size: "5_9", slug: "23456789ab", signed_in: true },
    }),
    {
      event_name: "share_link_published",
      session_id: sessionId,
      properties: { list_size: "5_9", signed_in: true },
    },
  );
  assert.deepEqual(
    buildProductEvent({
      eventName: "shared_list_viewed",
      sessionId,
      properties: { list_size: "10_24", slug: "23456789ab", signed_in: false },
    }),
    {
      event_name: "shared_list_viewed",
      session_id: sessionId,
      properties: { list_size: "10_24", signed_in: false },
    },
  );
});

test("telemetry runs only for real production visits and honors privacy controls", () => {
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
  assert.equal(
    shouldCollectProductTelemetry({ hostname: "www.stackrankapp.com", debug: true }),
    false,
  );
  assert.equal(
    shouldCollectProductTelemetry({ hostname: "www.stackrankapp.com", automated: true }),
    false,
  );
});
