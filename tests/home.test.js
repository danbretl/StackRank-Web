import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../home.html", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("../home.js", import.meta.url), "utf8");

test("family home remains a noindex local artifact until the root cutover is authorized", () => {
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.match(html, /href="\/movies"/);
  assert.match(html, /href="\/dogs"/);
  assert.match(html, /href="\/books"/);
  assert.doesNotMatch(html, /src="(?:app|dogs|books)\.js/);
});

test("family home reads count-only category envelopes without item names", () => {
  assert.match(script, /stackrank:movies:v1/);
  assert.match(script, /stackrank:dogs:ranking:v1/);
  assert.doesNotMatch(script, /primaryText|title|tmdbId|VBO:/);
});
