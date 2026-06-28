import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSuggestionReason,
  buildSuggestionSectionSubtitle,
  isSuggestionReasonReady,
} from "../lib/suggestions.js";

test("related reasons prefer a distinctive shared genre", () => {
  assert.equal(
    buildSuggestionReason({
      sectionKey: "related",
      movie: { title: "Arrival", genres: ["Drama", "Science Fiction"] },
      seed: { title: "The Matrix", rank: 1, genres: ["Action", "Science Fiction"] },
    }),
    "Shares science fiction with The Matrix",
  );
});

test("related reasons fall back to an honest ranked-seed explanation", () => {
  assert.equal(
    buildSuggestionReason({
      sectionKey: "related",
      movie: { title: "Singin' in the Rain" },
      seed: { title: "The Matrix", rank: 1 },
    }),
    "Recommended from The Matrix, your #1",
  );
});

test("related reasons do not overstate a generic genre overlap", () => {
  assert.equal(
    buildSuggestionReason({
      sectionKey: "related",
      movie: { title: "Another Drama", genres: ["Drama", "Comedy"] },
      seed: { title: "Parasite", rank: 2, genres: ["Drama", "Comedy", "Thriller"] },
    }),
    "Recommended from Parasite, your #2",
  );
});

test("essential reasons combine decade with a useful genre", () => {
  assert.equal(
    buildSuggestionReason({
      sectionKey: "essentials",
      movie: { title: "Alien", year: 1979, genres: ["Drama", "Science Fiction", "Horror"] },
    }),
    "A 1970s science fiction essential",
  );
});

test("essential and popular reasons remain useful without enrichment", () => {
  assert.equal(
    buildSuggestionReason({
      sectionKey: "essentials",
      movie: { title: "Casablanca", year: 1942 },
    }),
    "A 1940s essential you haven't ranked",
  );
  assert.equal(
    buildSuggestionReason({
      sectionKey: "popular",
      movie: { title: "A New Release" },
    }),
    "Currently popular on TMDB",
  );
});

test("popular reasons add genre context without exposing ratings", () => {
  assert.equal(
    buildSuggestionReason({
      sectionKey: "popular",
      movie: { title: "A New Release", genres: ["Action", "Adventure"] },
    }),
    "Popular now · Action",
  );
});

test("reason readiness waits for final genre metadata", () => {
  assert.equal(
    isSuggestionReasonReady({
      sectionKey: "essentials",
      movie: { title: "Casablanca", year: 1942 },
    }),
    false,
  );
  assert.equal(
    isSuggestionReasonReady({
      sectionKey: "essentials",
      movie: { title: "Casablanca", year: 1942, genres: [] },
    }),
    true,
  );
  assert.equal(
    isSuggestionReasonReady({
      sectionKey: "popular",
      movie: { title: "A New Release", genres: ["Action"] },
    }),
    true,
  );
});

test("related reason readiness waits for both movie and seed metadata", () => {
  assert.equal(
    isSuggestionReasonReady({
      sectionKey: "related",
      movie: { title: "Arrival", genres: ["Science Fiction"] },
      seed: { title: "The Matrix" },
    }),
    false,
  );
  assert.equal(
    isSuggestionReasonReady({
      sectionKey: "related",
      movie: { title: "Arrival", genres: ["Science Fiction"] },
      seed: { title: "The Matrix", genres: ["Science Fiction"] },
    }),
    true,
  );
});

test("section subtitles explain each source in plain language", () => {
  assert.equal(
    buildSuggestionSectionSubtitle("related", {
      seed: { title: "Parasite", rank: 2, source: "ranking" },
    }),
    "Because it's #2 on your list.",
  );
  assert.equal(
    buildSuggestionSectionSubtitle("related", {
      seed: { title: "Parasite", rank: 4, source: "recent" },
    }),
    "Because you just ranked it #4.",
  );
  assert.equal(
    buildSuggestionSectionSubtitle("essentials"),
    "Recognized favorites released before 2016.",
  );
  assert.equal(buildSuggestionSectionSubtitle("popular"), "Movies currently popular on TMDB.");
});
