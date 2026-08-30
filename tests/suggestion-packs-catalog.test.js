import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = JSON.parse(
  readFileSync(new URL("../data/suggestion-packs.source.json", import.meta.url), "utf8"),
);
const generated = JSON.parse(
  readFileSync(new URL("../data/suggestion-packs.json", import.meta.url), "utf8"),
);

const bySlug = (packs, slug) => packs.find((pack) => pack.slug === slug);
const titles = (pack) => pack.movies.map((movie) => movie.title);

test("superhero catalog includes the complete released MCU phases One through Five", () => {
  const expected = new Map([
    [
      "franchise-marvel-phase-one",
      [
        "Iron Man",
        "The Incredible Hulk",
        "Iron Man 2",
        "Thor",
        "Captain America: The First Avenger",
        "The Avengers",
      ],
    ],
    [
      "superhero-marvel-phase-two",
      [
        "Iron Man 3",
        "Thor: The Dark World",
        "Captain America: The Winter Soldier",
        "Guardians of the Galaxy",
        "Avengers: Age of Ultron",
        "Ant-Man",
      ],
    ],
    [
      "superhero-marvel-phase-three",
      [
        "Captain America: Civil War",
        "Doctor Strange",
        "Guardians of the Galaxy Vol. 2",
        "Spider-Man: Homecoming",
        "Thor: Ragnarok",
        "Black Panther",
        "Avengers: Infinity War",
        "Ant-Man and the Wasp",
        "Captain Marvel",
        "Avengers: Endgame",
        "Spider-Man: Far From Home",
      ],
    ],
    [
      "superhero-marvel-phase-four",
      [
        "Black Widow",
        "Shang-Chi and the Legend of the Ten Rings",
        "Eternals",
        "Spider-Man: No Way Home",
        "Doctor Strange in the Multiverse of Madness",
        "Thor: Love and Thunder",
        "Black Panther: Wakanda Forever",
      ],
    ],
    [
      "superhero-marvel-phase-five",
      [
        "Ant-Man and the Wasp: Quantumania",
        "Guardians of the Galaxy Vol. 3",
        "The Marvels",
        "Deadpool & Wolverine",
        "Captain America: Brave New World",
        "Thunderbolts*",
      ],
    ],
  ]);

  expected.forEach((movieTitles, slug) => {
    const pack = bySlug(source, slug);
    assert.ok(pack, `${slug} should be present`);
    assert.equal(pack.category, "Superhero / comics");
    assert.deepEqual(titles(pack), movieTitles);
  });
});

test("superhero catalog has broad Marvel, DC, animation, and independent coverage", () => {
  const superheroPacks = source.filter((pack) => pack.category === "Superhero / comics");
  const slugs = new Set(superheroPacks.map((pack) => pack.slug));

  assert.equal(superheroPacks.length, 19);
  [
    "superhero-spider-man-on-film",
    "superhero-fox-x-men-universe",
    "superhero-sony-spider-man-universe",
    "superhero-fantastic-four-on-film",
    "superhero-blade-trilogy",
    "superhero-dc-extended-universe",
    "superhero-superman-on-film",
    "superhero-dc-animated-movie-universe",
    "superhero-dc-tomorrowverse",
    "superhero-tmnt-on-film",
    "superhero-hellboy-on-film",
    "superhero-animated-essentials",
    "superhero-offbeat-and-deconstructed",
  ].forEach((slug) => assert.ok(slugs.has(slug), `${slug} should be present`));

  assert.equal(bySlug(source, "superhero-dc-extended-universe").movies.length, 15);
  assert.equal(bySlug(source, "superhero-dc-animated-movie-universe").movies.length, 15);
  assert.equal(bySlug(source, "superhero-dc-tomorrowverse").movies.length, 10);
  assert.equal(bySlug(source, "franchise-batman-on-film").version, 2);
  assert.equal(titles(bySlug(source, "franchise-batman-on-film"))[0], "Batman: The Movie");
});

test("generated superhero packs stay synchronized and export-ready", () => {
  assert.equal(generated.length, source.length);

  source
    .filter((pack) => pack.category === "Superhero / comics")
    .forEach((sourcePack) => {
      const generatedPack = bySlug(generated, sourcePack.slug);
      assert.ok(generatedPack, `${sourcePack.slug} should be generated`);
      assert.equal(generatedPack.category, sourcePack.category);
      assert.equal(generatedPack.version, sourcePack.version);
      assert.deepEqual(titles(generatedPack), titles(sourcePack));
      assert.ok(
        generatedPack.movies.every((movie) => movie.tmdbId != null && movie.posterPath),
        `${sourcePack.slug} should have TMDB identities and posters`,
      );
    });
});
