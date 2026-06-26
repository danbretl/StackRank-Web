// Text + SVG-text utilities shared by the app and the test suite.
//
// All pure and DOM-free. The `*ToSvgWidth` family is the width-aware wrapping
// used by the share poster: titles must wrap to fit inside their content box and
// never spill past the right margin (a recurring "titles touch the border" bug),
// so its invariant — no returned line estimates wider than `maxWidth` — is worth
// pinning down in tests.

export function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Character-count wrapping (used where a rough monospace-ish budget is enough).
export function wrapText(value, maxChars, maxLines = 2) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.,;:!?]+$/, "")}...`;
  return clipped;
}

// Approximate the rendered width of a string at a given font size, by summing
// per-character widths bucketed by glyph class. Deliberately conservative-ish;
// the wrappers below rely only on it being monotonic in added characters.
export function estimateSvgTextWidth(value, fontSize) {
  return Array.from(String(value || "")).reduce((width, char) => {
    if (char === " ") return width + fontSize * 0.36;
    if (/[MW@#%&]/.test(char)) return width + fontSize * 0.88;
    if (/[A-Z0-9]/.test(char)) return width + fontSize * 0.7;
    if (/[ilI.,'!:;]/.test(char)) return width + fontSize * 0.34;
    return width + fontSize * 0.6;
  }, 0);
}

// Truncate a string with an ellipsis so it fits within maxWidth at fontSize.
export function trimTextToSvgWidth(value, maxWidth, fontSize) {
  const ellipsis = "...";
  const chars = Array.from(String(value || "").trim());
  while (chars.length && estimateSvgTextWidth(`${chars.join("").trimEnd()}${ellipsis}`, fontSize) > maxWidth) {
    chars.pop();
  }
  return `${chars.join("").trimEnd().replace(/[.,;:!?]+$/, "")}${ellipsis}`;
}

// Width-aware wrapping. Greedily fills lines up to maxWidth; breaks a single word
// that is itself too wide. With a finite maxLines, the last line is ellipsized.
// Pass maxLines = Infinity to keep every line.
export function wrapTextToSvgWidth(value, maxWidth, fontSize, maxLines = 2) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  const pushCurrent = () => {
    if (!current) return;
    lines.push(current);
    current = "";
  };

  words.forEach((word) => {
    let remainingWord = word;
    while (remainingWord) {
      const candidate = current ? `${current} ${remainingWord}` : remainingWord;
      if (estimateSvgTextWidth(candidate, fontSize) <= maxWidth) {
        current = candidate;
        remainingWord = "";
        continue;
      }

      if (current) {
        pushCurrent();
        continue;
      }

      let segment = "";
      for (const char of Array.from(remainingWord)) {
        const nextSegment = `${segment}${char}`;
        if (segment && estimateSvgTextWidth(nextSegment, fontSize) > maxWidth) break;
        segment = nextSegment;
      }
      lines.push(segment || remainingWord[0]);
      remainingWord = remainingWord.slice(segment.length || 1);
    }
  });

  pushCurrent();
  if (!Number.isFinite(maxLines)) return lines;
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = trimTextToSvgWidth(clipped[maxLines - 1], maxWidth, fontSize);
  return clipped;
}

// Renders an array of lines into stacked SVG <text> elements.
export function svgTextLines(lines, x, y, className, lineHeight, extra = "") {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}" ${extra}>${xmlEscape(line)}</text>`,
    )
    .join("");
}
