import { test } from "node:test";
import assert from "node:assert/strict";
import {
  xmlEscape,
  wrapText,
  estimateSvgTextWidth,
  trimTextToSvgWidth,
  wrapTextToSvgWidth,
  svgTextLines,
} from "../lib/text.js";

test("xmlEscape escapes the five SVG/XML-significant characters", () => {
  assert.equal(xmlEscape(`a & b < c > d "e"`), "a &amp; b &lt; c &gt; d &quot;e&quot;");
  assert.equal(xmlEscape(null), "");
  assert.equal(xmlEscape(undefined), "");
  assert.equal(xmlEscape(2026), "2026");
  // Ampersand is escaped first so we never double-escape entities.
  assert.equal(xmlEscape("&lt;"), "&amp;lt;");
});

test("estimateSvgTextWidth is zero for empty and grows with content", () => {
  assert.equal(estimateSvgTextWidth("", 30), 0);
  assert.ok(estimateSvgTextWidth("WW", 30) > estimateSvgTextWidth("ii", 30), "wide glyphs cost more than thin");
  assert.ok(estimateSvgTextWidth("aaa", 30) > estimateSvgTextWidth("aa", 30), "monotonic in length");
  assert.ok(estimateSvgTextWidth("a", 40) > estimateSvgTextWidth("a", 20), "scales with font size");
});

test("wrapText splits on word budget and ellipsizes past maxLines", () => {
  assert.deepEqual(wrapText("one two three", 100, 2), ["one two three"]);
  assert.deepEqual(wrapText("alpha beta gamma delta", 11, 2)[0], "alpha beta");
  const clipped = wrapText("alpha beta gamma delta epsilon zeta", 11, 2);
  assert.equal(clipped.length, 2);
  assert.ok(clipped[1].endsWith("..."), "last line ellipsized when over maxLines");
});

test("wrapText never loses the first word even if it exceeds maxChars", () => {
  // A single over-long word still starts a line rather than vanishing.
  assert.deepEqual(wrapText("supercalifragilistic", 5, 2), ["supercalifragilistic"]);
});

// The core invariant that prevents the recurring "title touches the border" bug.
test("wrapTextToSvgWidth: no line exceeds maxWidth (multi-char lines)", () => {
  const titles = [
    "The Lord of the Rings: The Fellowship of the Ring",
    "Everything Everywhere All at Once",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "Pneumonoultramicroscopicsilicovolcanoconiosis",
    "A B C D E F G H I J K L M N O P",
    "Mad Max: Fury Road",
  ];
  for (const fontSize of [20, 28, 36]) {
    for (const maxWidth of [120, 300, 500, 930]) {
      for (const title of titles) {
        const lines = wrapTextToSvgWidth(title, maxWidth, fontSize, Infinity);
        for (const line of lines) {
          // A line may exceed only if it is a single unbreakable character.
          if (Array.from(line).length > 1) {
            assert.ok(
              estimateSvgTextWidth(line, fontSize) <= maxWidth + 1e-9,
              `"${line}" (${estimateSvgTextWidth(line, fontSize).toFixed(1)}) <= ${maxWidth} @${fontSize}`,
            );
          }
        }
      }
    }
  }
});

test("wrapTextToSvgWidth respects maxLines and ellipsizes the last line", () => {
  const lines = wrapTextToSvgWidth("The Lord of the Rings: The Return of the King", 160, 28, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith("..."), "overflow ellipsized");
  assert.ok(estimateSvgTextWidth(lines[1], 28) <= 160 + 1e-9, "ellipsized line still fits");
});

test("wrapTextToSvgWidth with Infinity returns all lines, none clipped", () => {
  const lines = wrapTextToSvgWidth("alpha beta gamma delta epsilon", 80, 24, Infinity);
  assert.ok(lines.length >= 2);
  assert.ok(!lines.some((l) => l.endsWith("...")), "no ellipsis when unbounded");
});

test("wrapTextToSvgWidth breaks a single word too wide to fit", () => {
  const lines = wrapTextToSvgWidth("Supercalifragilisticexpialidocious", 120, 30, Infinity);
  assert.ok(lines.length > 1, "long word split across lines");
  assert.equal(lines.join(""), "Supercalifragilisticexpialidocious", "no characters lost in the break");
});

test("wrapTextToSvgWidth handles empty / whitespace input", () => {
  assert.deepEqual(wrapTextToSvgWidth("", 100, 30), []);
  assert.deepEqual(wrapTextToSvgWidth("   ", 100, 30), []);
});

test("trimTextToSvgWidth fits within maxWidth and ends with ellipsis", () => {
  const out = trimTextToSvgWidth("The Shawshank Redemption", 80, 28);
  assert.ok(out.endsWith("..."));
  assert.ok(estimateSvgTextWidth(out, 28) <= 80 + 1e-9);
});

test("svgTextLines stacks lines by lineHeight and escapes content", () => {
  const svg = svgTextLines(["A & B", "C"], 10, 100, "title", 40);
  assert.match(svg, /<text x="10" y="100" class="title" >A &amp; B<\/text>/);
  assert.match(svg, /<text x="10" y="140" class="title" >C<\/text>/);
  assert.equal((svg.match(/<text /g) || []).length, 2);
});
