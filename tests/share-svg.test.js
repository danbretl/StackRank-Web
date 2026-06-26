import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_SET_HEIGHT,
  IMAGE_SET_WIDTH,
  getShareDisplayName,
  possessiveName,
  lowercaseFirst,
  buildShareHeader,
  composeShareSingleSvg,
  composeShareWideSvg,
  composeShareCard,
} from "../lib/share-svg.js";

const THEME = {
  bg: "#f6f6f2",
  ink: "#111111",
  muted: "#6f6f68",
  line: "#111111",
  panel: "#ffffff",
  accent: "#2f6f73",
  accent2: "#b4432f",
  faint: "#e4e1d9",
  hero: "#111111",
  section: "#6f6f68",
  frame: "#111111",
  panelLine: "#111111",
};

const TONE = {
  heroLead: "Movie ranking",
  topTitle: "The best",
  topSub: "Top ranked",
};

const descriptor = (title, height = 140, body = '<text x="86" y="28" class="pick-title">Body</text>', subtitle = "Sub") => ({
  key: title.toLowerCase().replaceAll(" ", "-"),
  title,
  subtitle,
  body,
  height,
});

const dimensions = (svg) => {
  const match = svg.match(/^<svg[^>]* width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(match, "svg dimensions are present");
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    viewWidth: Number(match[3]),
    viewHeight: Number(match[4]),
  };
};

const assertXmlBalanced = (svg) => {
  const stack = [];
  const tags = svg.match(/<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?>/g) || [];
  for (const tag of tags) {
    if (tag.startsWith("<?") || tag.startsWith("<!")) continue;
    const name = tag.match(/^<\/?([A-Za-z][\w:-]*)/)?.[1];
    if (!name || tag.endsWith("/>")) continue;
    if (tag.startsWith("</")) {
      assert.equal(stack.pop(), name, `closing tag ${name} matches`);
    } else {
      stack.push(name);
    }
  }
  assert.deepEqual(stack, [], "all svg tags close");
};

const textXValues = (svg) => [...svg.matchAll(/<text\b[^>]*\bx="([0-9.]+)"/g)].map((match) => Number(match[1]));

test("share title helpers trim, possessivize, and lowercase predictably", () => {
  assert.equal(getShareDisplayName({ displayName: "  Chris  " }), "Chris");
  assert.equal(getShareDisplayName({ displayName: "   " }), "");
  assert.equal(possessiveName("Dan"), "Dan's");
  assert.equal(possessiveName("Jess"), "Jess'");
  assert.equal(lowercaseFirst("Movie ranking"), "movie ranking");
});

test("buildShareHeader escapes custom name and card kicker", () => {
  const header = buildShareHeader(1200, THEME, TONE, { displayName: "A&B" }, { kicker: "Top & bottom" });
  assert.match(header.svg, /A&amp;B's movie ranking/);
  assert.match(header.svg, /Top &amp; bottom/);
  assert.ok(header.sectionsStartY > header.dividerY, "sections start after divider");
  assert.equal(header.heroFill, THEME.hero);
});

test("composeShareSingleSvg emits balanced svg with expected sections and min height", () => {
  const svg = composeShareSingleSvg({
    theme: THEME,
    tone: TONE,
    options: { displayName: "Dan" },
    descriptors: [descriptor("Top picks"), null, descriptor("Full list", 180, '<text x="1114" y="20">Edge</text>', "")],
    generatedDate: "Jun 26, 2026",
  });
  assertXmlBalanced(svg);
  const dims = dimensions(svg);
  assert.deepEqual(dims, { width: 1200, height: 1600, viewWidth: 1200, viewHeight: 1600 });
  assert.match(svg, /Dan's movie ranking/);
  assert.match(svg, /Top picks/);
  assert.match(svg, /Full list/);
  assert.doesNotMatch(svg, /null/);
  assert.match(svg, /Generated Jun 26, 2026/);
  assert.ok(textXValues(svg).every((x) => x >= 86 && x <= 1114), "single-image text stays inside horizontal padding");
});

test("composeShareSingleSvg grows beyond the minimum for tall content", () => {
  const svg = composeShareSingleSvg({
    theme: THEME,
    tone: TONE,
    descriptors: [descriptor("Long section", 1800)],
    generatedDate: "Jun 26, 2026",
  });
  const dims = dimensions(svg);
  assert.equal(dims.width, 1200);
  assert.ok(dims.height > 1600, "height grows to fit content");
  assert.equal(dims.height, dims.viewHeight);
});

test("composeShareWideSvg uses the wide canvas and masonry column transforms", () => {
  const svg = composeShareWideSvg({
    theme: THEME,
    tone: TONE,
    sectionDescriptors: [
      descriptor("First", 500),
      descriptor("Second", 120),
      descriptor("Third", 120),
    ],
    listDescriptor: descriptor("Whole list", 220),
    generatedDate: "Jun 26, 2026",
  });
  assertXmlBalanced(svg);
  const dims = dimensions(svg);
  assert.equal(dims.width, 2314);
  assert.equal(dims.viewWidth, 2314);
  assert.match(svg, /transform="translate\(0 0\)"/);
  assert.match(svg, /transform="translate\(1114 0\)"/);
  assert.match(svg, /Whole list/);
  assert.match(svg, /Generated Jun 26, 2026/);
});

test("composeShareCard uses image-set dimensions, label counters, and shrink-to-content height", () => {
  const svg = composeShareCard(
    THEME,
    TONE,
    { displayName: "Dan" },
    "Whole list",
    [descriptor("Ranks 1-10", 260)],
    "Page 1/2",
    { generatedDate: "Jun 26, 2026" },
  );
  assertXmlBalanced(svg);
  const dims = dimensions(svg);
  assert.equal(dims.width, IMAGE_SET_WIDTH);
  assert.equal(dims.viewWidth, IMAGE_SET_WIDTH);
  assert.ok(dims.height < IMAGE_SET_HEIGHT, "short cards shrink to content");
  assert.match(svg, /Whole list Page 1\/2/);
  assert.match(svg, /Ranks 1-10/);
});

test("composeShareCard caps very tall cards at the image-set maximum", () => {
  const svg = composeShareCard(
    THEME,
    TONE,
    {},
    "Oversized",
    [descriptor("Huge", IMAGE_SET_HEIGHT * 2)],
    "",
    { generatedDate: "Jun 26, 2026" },
  );
  const dims = dimensions(svg);
  assert.equal(dims.height, IMAGE_SET_HEIGHT);
  assert.equal(dims.viewHeight, IMAGE_SET_HEIGHT);
});
