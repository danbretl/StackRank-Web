#!/usr/bin/env node
// Rendered, read-only checks of a deployed origin in a fresh headless Chrome
// profile. Every page uses ?debug=1 (and navigator.webdriver) so neither
// telemetry stream records the visit; no account is used and only the
// throwaway profile's localStorage is seeded.
//
//   node scripts/check-production-rendered.cjs [--origin https://www.stackrankapp.com]
//
// Service fixtures: Movies tmdb-detail/tmdb-suggest/tmdb-search responses are
// stubbed in-page; posters are omitted from the seeded ranking. Dogs, the
// artwork review and the shared viewers use only deployed static files plus
// read-only public Supabase reads made by the pages themselves.
//
// If the host answers with a bot/DDoS mitigation challenge (x-vercel-mitigated),
// the run stops as "blocked" before or during browsing; it never lets the
// browser work through a challenge page. Wait for the mitigation to expire.

const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const originIndex = args.indexOf("--origin");
const origin = (originIndex >= 0 ? args[originIndex + 1] : "https://www.stackrankapp.com").replace(/\/$/, "");
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "");
const reportDir = path.join(root, "reports", "deployment-contract", "production-rendered", timestamp);
const downloadDir = path.join(reportDir, "downloads");
fs.mkdirSync(downloadDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chromePath = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((candidate) => fs.existsSync(candidate));
if (!chromePath) throw new Error("Chrome not found; set CHROME_PATH");

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
  server.on("error", reject);
});

const getJson = (url) => new Promise((resolve, reject) => {
  http.get(url, (response) => {
    let data = "";
    response.on("data", (chunk) => { data += chunk; });
    response.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  }).on("error", reject);
});

const openBrowser = async () => {
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "stackrank-prod-rendered-"));
  const proc = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1366,900", "about:blank",
  ], { stdio: "ignore" });
  let target;
  for (let attempt = 0; attempt < 100 && !target; attempt += 1) {
    try {
      target = (await getJson(`http://127.0.0.1:${port}/json/list`)).find((entry) => entry.type === "page");
    } catch {
      // Chrome is still starting.
    }
    if (!target) await wait(100);
  }
  if (!target) throw new Error("Chrome did not expose a page target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  const responses = [];
  ws.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result || {});
      return;
    }
    if (payload.method === "Runtime.exceptionThrown") events.push({ type: "exception", message: payload.params.exceptionDetails?.exception?.description || payload.params.exceptionDetails?.text });
    if (payload.method === "Log.entryAdded" && payload.params.entry.level === "error") events.push({ type: "log", message: payload.params.entry.text, url: payload.params.entry.url || "" });
    if (payload.method === "Network.responseReceived") {
      const headers = Object.fromEntries(Object.entries(payload.params.response.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
      responses.push({ url: payload.params.response.url, status: payload.params.response.status, mitigated: headers["x-vercel-mitigated"] || null });
    }
    if (payload.method === "Network.loadingFailed" && !payload.params.canceled) events.push({ type: "loading-failed", message: payload.params.errorText, requestId: payload.params.requestId });
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const message = { id: ++id, method, params };
    pending.set(message.id, { resolve, reject });
    ws.send(JSON.stringify(message));
  });
  for (const domain of ["Page", "Runtime", "Log", "Network"]) await send(`${domain}.enable`);
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  };
  const waitFor = async (expression, timeoutMs = 20000) => {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeoutMs) {
      last = await evaluate(expression).catch(() => undefined);
      if (last) return last;
      await wait(150);
    }
    throw new Error(`Timed out waiting for ${expression} (last ${JSON.stringify(last)})`);
  };
  const navigate = async (url) => {
    events.length = 0;
    responses.length = 0;
    await send("Page.navigate", { url });
    await waitFor(`document.readyState === 'complete' || ${JSON.stringify(origin)} === ''`);
    const mitigated = responses.find((entry) => entry.mitigated);
    if (mitigated) {
      await send("Page.navigate", { url: "about:blank" });
      throw new Error(`BLOCKED: ${mitigated.url} answered ${mitigated.status} with x-vercel-mitigated: ${mitigated.mitigated}`);
    }
  };
  const screenshot = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const file = path.join(reportDir, name);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    return path.relative(root, file);
  };
  const close = async () => {
    ws.close();
    proc.kill();
    await wait(300);
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return { send, evaluate, waitFor, navigate, screenshot, close, events, responses };
};

// Browsers request /favicon.ico by default on pages without an icon link (privacy.html);
// that path has never been part of the site, so it is reported but not failed.
const isDefaultFaviconProbe = (entry) => new URL(entry.url).pathname === "/favicon.ico";
const sameOriginFailures = (browser) => browser.responses.filter((entry) => entry.url.startsWith(origin) && entry.status >= 400 && !isDefaultFaviconProbe(entry));

const run = async () => {
  const preflight = await fetch(`${origin}/robots.txt`, { method: "HEAD", redirect: "manual" });
  if (preflight.headers.get("x-vercel-mitigated")) {
    console.log(`BLOCKED: ${origin} is answering this client with x-vercel-mitigated: ${preflight.headers.get("x-vercel-mitigated")} (${preflight.status}); not starting a browser. Wait for the mitigation to expire.`);
    process.exitCode = 2;
    return;
  }
  const artwork = JSON.parse(fs.readFileSync(path.join(root, "data/dogs/generated-artwork.json"), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/dogs/dog-catalog.json"), "utf8"));
  const profiles = JSON.parse(fs.readFileSync(path.join(root, "data/dogs/breed-profiles.json"), "utf8"));
  const { completedDogCatalogIds } = await import("../lib/dogs-public-visibility.js");
  const publicCatalogCount = completedDogCatalogIds({ entities: catalog.entities, profiles, artwork }).size;
  const batchCount = fs.readdirSync(path.join(root, "data/dogs")).filter((name) => /^generated-artwork-batch-[a-z0-9]+\.json$/.test(name)).length;
  const results = [];
  const browser = await openBrowser();
  const check = async (name, product, fn) => {
    const started = Date.now();
    try {
      const details = await fn();
      const failures = sameOriginFailures(browser);
      const exceptions = browser.events.filter((event) => event.type === "exception");
      if (failures.length || exceptions.length) throw new Error(`same-origin failures ${JSON.stringify(failures)}; exceptions ${JSON.stringify(exceptions)}`);
      results.push({ name, product, status: "passed", durationMs: Date.now() - started, details, consoleErrors: browser.events.filter((event) => event.type !== "exception") });
      console.log(`PASS [${product}] ${name}`);
    } catch (error) {
      results.push({ name, product, status: "failed", durationMs: Date.now() - started, error: error.message, events: [...browser.events] });
      console.log(`FAIL [${product}] ${name}: ${error.message}`);
    }
  };

  try {
    await check("Movies app shell and Share Studio PNG download", "movies", async () => {
      await browser.navigate(`${origin}/movies?debug=1`);
      await browser.evaluate(`(() => {
        localStorage.clear();
        const movie = (title, year, tmdbId) => ({ title, year, tmdbId, posterPath: "", comparisons: 0, rankedAt: "2026-06-20T12:00:00.000Z" });
        localStorage.setItem('stackrank:movies:v1', JSON.stringify({ movies: [movie('Alpha', 1980, 1401), movie('Beta', 1990, 1402), movie('Gamma', 2000, 1403)], updated_at: '2026-06-20T14:00:00.000Z' }));
        return true;
      })()`);
      await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
        const realFetch = window.fetch.bind(window);
        const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        window.fetch = (input, options) => {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (url.includes('/functions/v1/tmdb-detail')) return json({ result: { tmdbId: Number(new URL(url).searchParams.get('id')), runtime: 110, genres: ['Drama'], director: 'Fixture Director', cast: ['Fixture Actor'] } });
          if (url.includes('/functions/v1/tmdb-suggest') || url.includes('/functions/v1/tmdb-search')) return json({ results: [] });
          return realFetch(input, options);
        };
      })();` });
      await browser.navigate(`${origin}/movies?debug=1`);
      await browser.waitFor("document.querySelectorAll('#ranking .ranking__item').length === 3");
      const shell = await browser.evaluate(`({ title: document.title, webdriver: navigator.webdriver, items: document.querySelectorAll('#ranking .ranking__item').length })`);
      const shellShot = await browser.screenshot("movies.png");
      await browser.evaluate(`document.querySelector('#share-list')?.click(); true`);
      await browser.waitFor("!!document.querySelector('#share-preview svg')");
      await browser.evaluate(`document.querySelector('#share-download-png')?.click(); true`);
      const pngPath = path.join(downloadDir, "stackrank-movies.png");
      await browser.waitFor(`true`, 1);
      const started = Date.now();
      while (!(fs.existsSync(pngPath) && !fs.existsSync(`${pngPath}.crdownload`)) && Date.now() - started < 45000) await wait(200);
      const png = fs.existsSync(pngPath) ? fs.readFileSync(pngPath) : Buffer.alloc(0);
      if (png.length < 2000 || png.readUInt32BE(0) !== 0x89504e47) throw new Error(`Share Studio PNG missing or invalid (${png.length} bytes)`);
      const shareShot = await browser.screenshot("movies-share-studio.png");
      return { shell, pngBytes: png.length, screenshots: [shellShot, shareShot] };
    });

    await check("Movies shared viewer for an unknown slug", "movies", async () => {
      await browser.navigate(`${origin}/s/prodsmoke1?debug=1`);
      await browser.waitFor("document.body.innerText.trim().length > 0 && !document.querySelector('[aria-busy=\"true\"]')");
      await wait(1500);
      return { text: (await browser.evaluate("document.body.innerText")).slice(0, 200), screenshot: await browser.screenshot("movies-shared.png") };
    });

    await check("Dogs completed-pair catalog and portraits", "dogs", async () => {
      await browser.navigate(`${origin}/dogs?debug=1`);
      await browser.waitFor(`document.querySelector('#dogs-catalog-status')?.dataset.ready === 'true' && Number(document.querySelector('#dogs-catalog-status')?.dataset.count) === ${publicCatalogCount}`, 30000);
      await browser.waitFor(`(() => { const imgs = [...document.querySelectorAll('img')].filter((img) => img.currentSrc.includes('/assets/dogs/generated/')); return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0); })()`, 20000);
      const portraits = await browser.evaluate(`[...document.querySelectorAll('img')].filter((img) => img.currentSrc.includes('/assets/dogs/generated/')).length`);
      return { catalogCount: publicCatalogCount, visiblePortraits: portraits, screenshot: await browser.screenshot("dogs.png") };
    });

    await check("Dogs artwork review with every provenance batch", "dogs", async () => {
      await browser.navigate(`${origin}/dogs/artwork-review?debug=1`);
      await browser.waitFor(`document.querySelector('#asset-count')?.textContent === '${artwork.assets.length}' && document.querySelectorAll('#artwork-gallery .artwork-card').length === 24`, 30000);
      await browser.evaluate(`document.querySelector('[data-asset-id]')?.click(); true`);
      await browser.waitFor(`document.querySelector('#artwork-dialog')?.open && document.querySelector('#dialog-image')?.naturalWidth >= 900 && document.querySelector('#generation-loading')?.hidden`, 30000);
      const batches = browser.responses.filter((entry) => /\/data\/dogs\/generated-artwork-batch-[a-z0-9]+\.json$/.test(new URL(entry.url).pathname));
      const served = new Set(batches.filter((entry) => entry.status === 200).map((entry) => new URL(entry.url).pathname));
      if (served.size !== batchCount || batches.some((entry) => entry.status !== 200)) throw new Error(`Artwork review batches served ${served.size}/${batchCount}`);
      const prompt = await browser.evaluate(`document.querySelector('#generation-extra')?.innerText || ''`);
      if (!/Exact prompt/.test(prompt)) throw new Error("Artwork provenance prompt block missing");
      return { assets: artwork.assets.length, batchesServed: served.size, screenshot: await browser.screenshot("dogs-artwork-review.png") };
    });

    await check("Dogs shared viewer for an unknown slug", "dogs", async () => {
      await browser.navigate(`${origin}/s/dogs/prodsmoke123?debug=1`);
      await wait(2000);
      return { text: (await browser.evaluate("document.body.innerText")).slice(0, 200), screenshot: await browser.screenshot("dogs-shared.png") };
    });

    await check("Books preview, privacy and family home render", "site", async () => {
      const pages = {};
      for (const route of ["/books?debug=1", "/privacy?debug=1", "/home.html?debug=1"]) {
        await browser.navigate(`${origin}${route}`);
        await wait(800);
        const failures = sameOriginFailures(browser);
        const exceptions = browser.events.filter((event) => event.type === "exception");
        if (failures.length || exceptions.length) throw new Error(`${route}: ${JSON.stringify({ failures, exceptions })}`);
        pages[route] = { title: await browser.evaluate("document.title"), robots: await browser.evaluate("document.querySelector('meta[name=robots]')?.content || ''") };
      }
      return pages;
    });
  } finally {
    await browser.close();
  }

  const report = { origin, startedAt: timestamp, chrome: chromePath, status: results.every((entry) => entry.status === "passed") ? "passed" : "failed", results };
  fs.writeFileSync(path.join(reportDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Rendered production check ${report.status}; evidence ${path.relative(root, reportDir)}`);
  if (report.status !== "passed") process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
