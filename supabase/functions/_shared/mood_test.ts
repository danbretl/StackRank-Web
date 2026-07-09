import { interpretMood, scoreMoodMatch } from "./mood.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("interpretMood recognizes single vibes with genre weights", () => {
  const profile = interpretMood("something cozy");
  assert(profile.readable, "cozy should be readable");
  assert(profile.recognized.includes("cozy"), "cozy sense should be recognized");
  assert((profile.genres.Family || 0) > 0, "cozy should favor Family");
  assert((profile.genres.Horror || 0) < 0, "cozy should avoid Horror");
});

Deno.test("interpretMood combines multiple vibes and phrases", () => {
  const profile = interpretMood("Mind-bending, laugh-out-loud date night!");
  assert(profile.recognized.includes("mind-bending"), "should read mind-bending");
  assert(profile.recognized.includes("funny"), "should read laugh-out-loud as funny");
  assert(profile.recognized.includes("romantic"), "should read date night as romantic");
});

Deno.test("interpretMood detects eras from decade tokens and words", () => {
  assert(interpretMood("80s sci-fi").era?.from === 1980, "80s should map to 1980");
  assert(interpretMood("1990s crime").era?.from === 1990, "1990s should map to 1990");
  assert(interpretMood("something from the nineties").era?.from === 1990, "nineties should map to 1990");
  assert(interpretMood("2010s drama").era?.from === 2010, "2010s should map to 2010");
});

Deno.test("interpretMood reports runtime hints without breaking readability", () => {
  const short = interpretMood("something quick and funny");
  assert(short.runtimeHint === "short", "quick should hint short runtime");
  const long = interpretMood("epic fantasy");
  assert(long.runtimeHint === "long", "epic should hint long runtime");
});

Deno.test("interpretMood marks gibberish as unreadable", () => {
  const profile = interpretMood("zzblorp fnarglewitz");
  assert(!profile.readable, "gibberish should be unreadable");
  assert(profile.recognized.length === 0, "gibberish should recognize nothing");
  assert(interpretMood("").readable === false, "empty input should be unreadable");
});

Deno.test("scoreMoodMatch favors matching genres and keywords", () => {
  const profile = interpretMood("cozy feel good");
  const cozyMovie = scoreMoodMatch(profile, {
    genres: ["Family", "Comedy"],
    keywords: ["friendship", "small town", "bear"],
    year: 2014,
  });
  const horrorMovie = scoreMoodMatch(profile, {
    genres: ["Horror", "Thriller"],
    keywords: ["slasher", "haunted house"],
    year: 2018,
  });
  assert(cozyMovie.score > 0.5, `cozy movie should score high, got ${cozyMovie.score}`);
  assert(horrorMovie.score < 0.2, `horror movie should score low, got ${horrorMovie.score}`);
  assert(cozyMovie.score > horrorMovie.score, "cozy movie should beat horror movie");
  assert(cozyMovie.senses.includes("cozy"), "matched senses should include cozy");
  assert(cozyMovie.keywords.includes("friendship"), "matched keywords should include friendship");
});

Deno.test("scoreMoodMatch rewards era matches", () => {
  const profile = interpretMood("80s action");
  const eighties = scoreMoodMatch(profile, {
    genres: ["Action"],
    keywords: [],
    year: 1986,
  });
  const modern = scoreMoodMatch(profile, {
    genres: ["Action"],
    keywords: [],
    year: 2021,
  });
  assert(eighties.score > modern.score, "80s movie should beat modern one for an 80s vibe");
  assert(eighties.era === "1980s", "era label should be reported");
});

Deno.test("scoreMoodMatch returns zero for unreadable profiles", () => {
  const profile = interpretMood("zzblorp");
  const result = scoreMoodMatch(profile, { genres: ["Comedy"], keywords: ["feel good"], year: 2000 });
  assert(result.score === 0, "unreadable profile should score zero");
});

Deno.test("keyword matching is normalization-insensitive", () => {
  const profile = interpretMood("mind-bending");
  const match = scoreMoodMatch(profile, {
    genres: ["Science Fiction"],
    keywords: ["Time Travel", "Dream World"],
    year: 2010,
  });
  assert(match.score > 0.4, `normalized keywords should match, got ${match.score}`);
  assert(match.keywords.includes("Time Travel"), "raw keyword casing should be preserved in matches");
});
