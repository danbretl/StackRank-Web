import assert from "node:assert/strict";
import fs from "node:fs";

const productionOrigin = "https://www.stackrankapp.com";
const apexOrigin = "https://stackrankapp.com";
const localIndex = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const localDogs = fs.readFileSync(new URL("../dogs.html", import.meta.url), "utf8");
const localShared = fs.readFileSync(new URL("../shared.html", import.meta.url), "utf8");
const localApp = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
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

const assetPath = (asset) => (asset.startsWith("/") ? asset : `/${asset}`);

await expectRedirect("http://stackrankapp.com/", 308, "https://stackrankapp.com/");
await expectRedirect(`${apexOrigin}/`, 308, `${productionOrigin}/`);
await expectRedirect(`${productionOrigin}/`, 307, "/movies");
await expectRedirect(`${productionOrigin}/movies/`, 308, "/movies");
await expectRedirect(`${productionOrigin}/dogs/`, 308, "/dogs");
await expectRedirect(`${productionOrigin}/privacy/`, 308, "/privacy");

const moviesResponse = await expectOk("/movies");
const moviesHtml = await moviesResponse.text();
const dogsResponse = await expectOk("/dogs");
const dogsHtml = await dogsResponse.text();
const privacyResponse = await expectOk("/privacy");
const privacyHtml = await privacyResponse.text();
const sharedResponse = await expectOk("/s/prodsmoke1");
const sharedHtml = await sharedResponse.text();

const configuredHeaders = Object.fromEntries(
  vercelConfig.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]),
);
for (const [key, expected] of Object.entries(configuredHeaders)) {
  assert.equal(moviesResponse.headers.get(key), expected, `/movies ${key}`);
  assert.equal(dogsResponse.headers.get(key), expected, `/dogs ${key}`);
  assert.equal(privacyResponse.headers.get(key), expected, `/privacy ${key}`);
  assert.equal(sharedResponse.headers.get(key), expected, `/s/prodsmoke1 ${key}`);
}
assert.match(moviesResponse.headers.get("strict-transport-security") || "", /max-age=/);
record("security headers match vercel.json on /movies, /dogs, /privacy, and /s/:slug");

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
const expectedSharedCss = attribute(
  localShared,
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i,
  "href",
);
const expectedSharedModule = attribute(
  localShared,
  /<script\b[^>]*\btype=["']module["'][^>]*>/i,
  "src",
);
const expectedDogsCanonical = attribute(
  localDogs,
  /<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
  "href",
);
const expectedDogsCss = attribute(
  localDogs,
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i,
  "href",
);
const expectedDogsModule = attribute(
  localDogs,
  /<script\b[^>]*\btype=["']module["'][^>]*>/i,
  "src",
);
const expectedVendorModule = localApp.match(
  /from\s+["']\.\/(vendor\/supabase-js-2\.108\.2\.js\?v=\d+)["']/,
)?.[1];
assert.ok(expectedVendorModule, "Supabase vendor module import should be versioned");

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

assert.match(dogsHtml, /<html\b[^>]*\bdata-stackrank-category=["']dogs["']/i);
assert.equal(
  attribute(dogsHtml, /<link\b[^>]*\brel=["']canonical["'][^>]*>/i, "href"),
  expectedDogsCanonical,
);
assert.equal(
  attribute(dogsHtml, /<meta\b[^>]*\bproperty=["']og:title["'][^>]*>/i, "content"),
  "StackRank Dogs — Rank the dog breeds you love",
);
assert.equal(
  attribute(dogsHtml, /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i, "href"),
  expectedDogsCss,
);
assert.equal(
  attribute(dogsHtml, /<script\b[^>]*\btype=["']module["'][^>]*>/i, "src"),
  expectedDogsModule,
);
assert.equal(attribute(dogsHtml, /<meta\b[^>]*\bname=["']robots["'][^>]*>/i, "content"), "");
record("Dogs route serves public canonical metadata and cache-busted assets");

assert.equal(
  attribute(sharedHtml, /<meta\b[^>]*\bproperty=["']og:title["'][^>]*>/i, "content"),
  "Shared StackRank movie list",
);
assert.equal(
  attribute(sharedHtml, /<meta\b[^>]*\bname=["']robots["'][^>]*>/i, "content"),
  "noindex, nofollow",
);
assert.equal(
  attribute(sharedHtml, /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i, "href"),
  expectedSharedCss,
);
assert.equal(
  attribute(sharedHtml, /<script\b[^>]*\btype=["']module["'][^>]*>/i, "src"),
  expectedSharedModule,
);
record("shared-list route serves generic noindex metadata and cache-busted assets");

for (const asset of [
  expectedCss,
  expectedModule,
  expectedSharedModule,
  expectedDogsCss,
  expectedDogsModule,
  expectedVendorModule,
  "assets/favicon.ico",
  "assets/favicon.svg",
  "assets/apple-touch-icon.png",
  "assets/tmdb-logo.svg",
]) {
  const response = await expectOk(assetPath(asset));
  assert.ok(response.headers.get("content-type"), `${asset} should have a content type`);
}

for (const asset of [
  expectedCss,
  expectedModule,
  expectedSharedModule,
  expectedDogsCss,
  expectedDogsModule,
  expectedVendorModule,
  "data/suggestion-packs.json?v=5",
  "data/dogs/dog-catalog.json?v=2",
  "data/dogs/packs.json?v=2",
  "data/dogs/image-rights.json?v=3",
  "data/dogs/artwork-license-policy.json?v=1",
]) {
  const response = await request(new URL(assetPath(asset), productionOrigin).toString());
  assert.equal(response.status, 200, `${asset} should return 200`);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
    `${asset} should be immutable`,
  );
}
record("cache-busted app, vendor, CSS, and pack data are immutable");

const dogCatalogResponse = await request(new URL("/data/dogs/dog-catalog.json?v=2", productionOrigin));
const dogCatalog = await dogCatalogResponse.json();
assert.equal(dogCatalog.catalogId, "stackrank-dogs");
assert.equal(dogCatalog.entities?.length, 1264);
assert.equal(dogCatalog.source?.release, "2026-04-15");
const dogPacksResponse = await request(new URL("/data/dogs/packs.json?v=2", productionOrigin));
const dogPacks = await dogPacksResponse.json();
assert.equal(dogPacks.packs?.length, 46);
assert.equal(dogPacks.packs?.filter((pack) => pack.placements?.includes("starter")).length, 3);
record("Dogs production catalog and editorial packs match the validated release artifacts");

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
assert.match(privacyHtml, /Dogs data is not yet included in account sync or public sharing/);
assert.match(privacyHtml, /Vertebrate Breed Ontology/);
record("privacy controls plus Movies, Books, and Dogs credits are present");

const robotsResponse = await expectOk("/robots.txt");
const robots = await robotsResponse.text();
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Disallow: \/s\//);
assert.match(robots, /Sitemap: https:\/\/www\.stackrankapp\.com\/sitemap\.xml/);

const sitemapResponse = await expectOk("/sitemap.xml");
const sitemap = await sitemapResponse.text();
assert.match(sitemap, /https:\/\/www\.stackrankapp\.com\/movies/);
assert.match(sitemap, /https:\/\/www\.stackrankapp\.com\/dogs/);
assert.match(sitemap, /https:\/\/www\.stackrankapp\.com\/privacy/);
assert.doesNotMatch(sitemap, /\/s\//);
record("robots.txt and sitemap.xml expose the canonical routes");

for (const label of checks) console.log(`PASS ${label}`);
console.log(`Production smoke passed (${checks.length} checks).`);
