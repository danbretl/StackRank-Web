import assert from "node:assert/strict";
import fs from "node:fs";

const productionOrigin = "https://www.stackrankapp.com";
const apexOrigin = "https://stackrankapp.com";
const localIndex = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const vercelConfig = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

const checks = [];
const record = (label) => checks.push(label);

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    ...options,
  });
  return response;
};

const expectRedirect = async (url, status, location) => {
  const response = await request(url);
  assert.equal(response.status, status, `${url} should return ${status}`);
  assert.equal(response.headers.get("location"), location, `${url} redirect target`);
  record(`${url} redirects to ${location}`);
};

const expectOk = async (path) => {
  const response = await request(`${productionOrigin}${path}`);
  assert.equal(response.status, 200, `${path} should return 200`);
  record(`${path} returns 200`);
  return response;
};

const attribute = (html, tagPattern, name) => {
  const tag = html.match(tagPattern)?.[0] || "";
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] || "";
};

await expectRedirect("http://stackrankapp.com/", 308, "https://stackrankapp.com/");
await expectRedirect(`${apexOrigin}/`, 308, `${productionOrigin}/`);
await expectRedirect(`${productionOrigin}/`, 307, "/movies");
await expectRedirect(`${productionOrigin}/movies/`, 308, "/movies");
await expectRedirect(`${productionOrigin}/privacy/`, 308, "/privacy");

const moviesResponse = await expectOk("/movies");
const moviesHtml = await moviesResponse.text();
const privacyResponse = await expectOk("/privacy");
const privacyHtml = await privacyResponse.text();

const configuredHeaders = Object.fromEntries(
  vercelConfig.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]),
);
for (const [key, expected] of Object.entries(configuredHeaders)) {
  assert.equal(moviesResponse.headers.get(key), expected, `/movies ${key}`);
  assert.equal(privacyResponse.headers.get(key), expected, `/privacy ${key}`);
}
assert.match(moviesResponse.headers.get("strict-transport-security") || "", /max-age=/);
record("security headers match vercel.json on /movies and /privacy");

const expectedCanonical = attribute(
  localIndex,
  /<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
  "href",
);
const expectedOgImage = attribute(
  localIndex,
  /<meta\b[^>]*\bproperty=["']og:image["'][^>]*>/i,
  "content",
);
const expectedCss = attribute(
  localIndex,
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i,
  "href",
);
const expectedModule = attribute(
  localIndex,
  /<script\b[^>]*\btype=["']module["'][^>]*>/i,
  "src",
);

assert.equal(
  attribute(moviesHtml, /<link\b[^>]*\brel=["']canonical["'][^>]*>/i, "href"),
  expectedCanonical,
);
assert.equal(
  attribute(moviesHtml, /<meta\b[^>]*\bproperty=["']og:image["'][^>]*>/i, "content"),
  expectedOgImage,
);
assert.equal(
  attribute(moviesHtml, /<meta\b[^>]*\bname=["']twitter:card["'][^>]*>/i, "content"),
  "summary_large_image",
);
assert.equal(
  attribute(moviesHtml, /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i, "href"),
  expectedCss,
);
assert.equal(
  attribute(moviesHtml, /<script\b[^>]*\btype=["']module["'][^>]*>/i, "src"),
  expectedModule,
);
record("canonical, social metadata, and cache-busted assets match the repository");

for (const asset of [
  expectedCss,
  expectedModule,
  "assets/favicon.ico",
  "assets/favicon.svg",
  "assets/apple-touch-icon.png",
  "assets/tmdb-logo.svg",
]) {
  const response = await expectOk(`/${asset}`);
  assert.ok(response.headers.get("content-type"), `${asset} should have a content type`);
}

const ogResponse = await request(expectedOgImage);
assert.equal(ogResponse.status, 200, "Open Graph image should return 200");
assert.match(ogResponse.headers.get("content-type") || "", /^image\/png\b/);
const ogBytes = new Uint8Array(await ogResponse.arrayBuffer());
assert.deepEqual(
  [...ogBytes.slice(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
  "Open Graph image should be a PNG",
);
const ogView = new DataView(ogBytes.buffer, ogBytes.byteOffset, ogBytes.byteLength);
assert.equal(ogView.getUint32(16), 1200, "Open Graph image width");
assert.equal(ogView.getUint32(20), 630, "Open Graph image height");
record("Open Graph image is a valid 1200x630 PNG");

assert.match(privacyHtml, /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']https:\/\/www\.stackrankapp\.com\/privacy["']/i);
assert.match(privacyHtml, /This product uses the TMDB API but is not endorsed or certified by TMDB\./);
assert.match(privacyHtml, /assets\/tmdb-logo\.svg/);
assert.match(privacyHtml, /mailto:stackrank@danbretl\.com/);
record("privacy controls and TMDB credits are present");

const robotsResponse = await expectOk("/robots.txt");
const robots = await robotsResponse.text();
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Sitemap: https:\/\/www\.stackrankapp\.com\/sitemap\.xml/);

const sitemapResponse = await expectOk("/sitemap.xml");
const sitemap = await sitemapResponse.text();
assert.match(sitemap, /https:\/\/www\.stackrankapp\.com\/movies/);
assert.match(sitemap, /https:\/\/www\.stackrankapp\.com\/privacy/);
record("robots.txt and sitemap.xml expose the canonical routes");

for (const label of checks) console.log(`PASS ${label}`);
console.log(`Production smoke passed (${checks.length} checks).`);
