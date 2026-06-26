import { xmlEscape, wrapText, svgTextLines } from "./text.js";

export const IMAGE_SET_WIDTH = 1200;
export const IMAGE_SET_HEIGHT = 2600;

export function getShareDisplayName(options = {}) {
  return String(options.displayName || "").trim();
}

export function possessiveName(name) {
  if (!name) return "";
  return `${name}${name.toLowerCase().endsWith("s") ? "'" : "'s"}`;
}

export function lowercaseFirst(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "";
}

export function shareSvgStyles(theme, heroFontSize, heroFill, sectionFill) {
  return `
    .brand { font: 700 32px Arial, Helvetica, sans-serif; letter-spacing: 7px; text-transform: uppercase; fill: ${theme.ink}; }
    .kicker { font: 500 24px Arial, Helvetica, sans-serif; letter-spacing: 5px; text-transform: uppercase; fill: ${theme.muted}; }
    .hero { font: 700 ${heroFontSize}px Arial, Helvetica, sans-serif; fill: ${heroFill}; }
    .section-title { font: 700 38px Arial, Helvetica, sans-serif; letter-spacing: 4px; text-transform: uppercase; fill: ${sectionFill}; }
    .section-sub { font: 500 27px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .pick-title { font: 700 36px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .pick-meta, .stat-label, .bar-label, .bar-count, .range-span, .footer { font: 500 25px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .rank-number { font: 700 27px Arial, Helvetica, sans-serif; fill: ${theme.bg}; }
    .deep-rank { font: 700 24px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-value { font: 700 54px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-value-small { font: 700 30px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-card-label { font: 700 21px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .stat-card-value { font: 700 25px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .stat-card-value-emphasis { font: 700 30px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .chart-caption { font: 700 22px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .queue-runtime { font: 700 40px Arial, Helvetica, sans-serif; }
    .queue-runtime-small { font: 700 30px Arial, Helvetica, sans-serif; }
    .people-heading { font: 700 27px Arial, Helvetica, sans-serif; fill: ${theme.section || theme.ink}; text-transform: uppercase; letter-spacing: 4px; }
    .people-label { font: 500 21px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .range-year { font: 700 42px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .range-title { font: 700 31px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .range-title-small { font: 700 25px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .poster-title { font: 700 20px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-text-title { font: 700 22px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .poster-title-compact { font: 700 18px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-30 { font: 700 30px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-28 { font: 700 28px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-26 { font: 700 26px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-24 { font: 700 24px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-22 { font: 700 22px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .full-list-row-title-20 { font: 700 20px Arial, Helvetica, sans-serif; fill: ${theme.ink}; }
    .poster-rank { font: 400 20px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
    .poster-number-badge { font: 700 15px Arial, Helvetica, sans-serif; fill: ${theme.muted}; }
  `;
}

// Wraps composed inner content in the outer SVG frame (background + border).
// width/height are the page dimensions; the border insets 44px on every side,
// matching the original single-poster geometry (1112 = 1200 - 88).
export function renderShareSvg({ width, height, theme, heroFontSize, heroFill, sectionFill, inner }) {
  const frameStroke = theme.frame || theme.line;
  const borderHeight = height - 88;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="StackRank movie list share image">
  <style>${shareSvgStyles(theme, heroFontSize, heroFill, sectionFill)}</style>
  <rect width="${width}" height="${height}" fill="${theme.bg}" />
  <rect x="44" y="44" width="${width - 88}" height="${borderHeight}" rx="38" fill="none" stroke="${frameStroke}" stroke-width="4" />
  ${inner}
</svg>`;
}

// The shared hero/brand/divider header. `kicker` defaults to "Movies" (the
// single-poster look); image-set cards pass a group label + counter instead.
// Returns the header SVG plus the geometry the page composer needs.
export function buildShareHeader(width, theme, tone, options = {}, { kicker = "Movies" } = {}) {
  const displayName = getShareDisplayName(options);
  const heroTitle = displayName ? `${possessiveName(displayName)} ${lowercaseFirst(tone.heroLead)}` : tone.heroLead;
  const topTitleLines = wrapText(heroTitle, 24, 3);
  const heroFontSize = topTitleLines.length >= 3 ? 58 : topTitleLines.length === 2 ? 68 : 78;
  const heroLineHeight = Math.round(heroFontSize * 1.08);
  const dividerY = 286 + (topTitleLines.length - 1) * heroLineHeight + 72;
  const sectionsStartY = dividerY + 96;
  const frameStroke = theme.frame || theme.line;
  const svg = `<text x="86" y="122" class="brand">StackRank</text>
  <text x="86" y="168" class="kicker">${xmlEscape(kicker)}</text>
  ${svgTextLines(topTitleLines, 86, 280, "hero", heroLineHeight)}
  <path d="M86 ${dividerY}H${width - 86}" stroke="${frameStroke}" stroke-width="4" />`;
  return {
    svg,
    heroFontSize,
    heroFill: theme.hero || theme.ink,
    sectionFill: theme.section || theme.muted,
    dividerY,
    sectionsStartY,
  };
}

// Places a single section descriptor in single-column flow at `startY`.
// This reproduces the original addSection() math exactly.
export function placeSectionFlow(desc, startY, marginX = 86) {
  // Roomier offsets to suit the larger section title (38px) and subtitle (27px).
  const bodyOffset = desc.subtitle ? 88 : 64;
  const bodyY = startY + bodyOffset;
  const nextY = bodyY + desc.height + 72;
  const titleSvg = `<text x="${marginX}" y="${startY}" class="section-title">${xmlEscape(desc.title)}</text>`;
  const subSvg = desc.subtitle
    ? `<text x="${marginX}" y="${startY + 44}" class="section-sub">${xmlEscape(desc.subtitle)}</text>`
    : "";
  const svg = `${titleSvg}${subSvg}<g transform="translate(0 ${bodyY})">${desc.body}</g>`;
  return { svg, nextY };
}

export function shareFooterSvg(width, height, { generatedDate } = {}) {
  const generated = generatedDate || new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const footerY = height - 100;
  return `<text x="86" y="${footerY}" class="footer">Generated ${xmlEscape(generated)}</text>
  <text x="${width - 86}" y="${footerY}" class="footer" text-anchor="end">stackrank movies</text>`;
}

export function composeShareSingleSvg({ theme, tone, options = {}, descriptors = [], width = 1200, minHeight = 1600, generatedDate }) {
  const header = buildShareHeader(width, theme, tone, options);
  let y = header.sectionsStartY;
  let sectionsSvg = "";
  descriptors.filter(Boolean).forEach((desc) => {
    const placed = placeSectionFlow(desc, y);
    sectionsSvg += placed.svg;
    y = placed.nextY;
  });

  const height = Math.max(minHeight, y + 200);
  const inner = `${header.svg}
  ${sectionsSvg}
  ${shareFooterSvg(width, height, { generatedDate })}`;
  return renderShareSvg({
    width,
    height,
    theme,
    heroFontSize: header.heroFontSize,
    heroFill: header.heroFill,
    sectionFill: header.sectionFill,
    inner,
  });
}

export function composeShareWideSvg({ theme, tone, options = {}, sectionDescriptors = [], listDescriptor = null, generatedDate }) {
  // Two columns whose internal content is the 1200 layout (86..1114). The
  // gutter between columns is set equal to the page padding (86) so all three
  // gaps — left, middle, right — match.
  const marginX = 86;
  const colContentW = 1200 - marginX * 2; // 1028
  const gutter = marginX; // 86
  const cols = 2;
  const colStride = colContentW + gutter; // 1114
  const width = marginX * 2 + cols * colContentW + (cols - 1) * gutter; // 2314
  const header = buildShareHeader(width, theme, tone, options);

  const descriptors = sectionDescriptors.filter(Boolean);
  const colHeights = new Array(cols).fill(header.sectionsStartY);
  let sectionsSvg = "";
  descriptors.forEach((desc) => {
    let target = 0;
    for (let col = 1; col < cols; col += 1) {
      if (colHeights[col] < colHeights[target]) target = col;
    }
    const placed = placeSectionFlow(desc, colHeights[target]);
    sectionsSvg += `<g transform="translate(${target * colStride} 0)">${placed.svg}</g>`;
    colHeights[target] = placed.nextY;
  });

  let contentBottom = descriptors.length ? Math.max(...colHeights) : header.sectionsStartY;
  if (listDescriptor) {
    const startY = descriptors.length ? contentBottom + 24 : contentBottom;
    const placed = placeSectionFlow(listDescriptor, startY);
    sectionsSvg += placed.svg;
    contentBottom = placed.nextY;
  }

  const height = Math.max(1200, contentBottom + 200);
  const inner = `${header.svg}
  ${sectionsSvg}
  ${shareFooterSvg(width, height, { generatedDate })}`;
  return renderShareSvg({
    width,
    height,
    theme,
    heroFontSize: header.heroFontSize,
    heroFill: header.heroFill,
    sectionFill: header.sectionFill,
    inner,
  });
}

// Renders one image-set card (fixed width, target-fixed height that grows only
// if a finite group genuinely overflows) from a label and section descriptors.
export function composeShareCard(theme, tone, options = {}, label, descriptors, counter = "", { generatedDate } = {}) {
  const width = IMAGE_SET_WIDTH;
  const kicker = counter ? `${label} ${counter}` : label;
  const header = buildShareHeader(width, theme, tone, options, { kicker });
  let y = header.sectionsStartY;
  let sectionsSvg = "";
  descriptors.filter(Boolean).forEach((desc) => {
    const placed = placeSectionFlow(desc, y);
    sectionsSvg += placed.svg;
    y = placed.nextY;
  });
  // Shrink each card to its content; the page height is a maximum, not a floor,
  // so finite groups and the final list page don't carry blank space. The +120
  // is a snug footer zone (the footer baseline sits at height - 100).
  const height = Math.min(IMAGE_SET_HEIGHT, y + 120);
  const inner = `${header.svg}
  ${sectionsSvg}
  ${shareFooterSvg(width, height, { generatedDate })}`;
  return renderShareSvg({
    width,
    height,
    theme,
    heroFontSize: header.heroFontSize,
    heroFill: header.heroFill,
    sectionFill: header.sectionFill,
    inner,
  });
}
