const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const reportsRoot = path.join(rootDir, "reports", "e2e");
const runsRoot = path.join(reportsRoot, "runs");
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "");
const reportDir = path.join(runsRoot, timestamp);
const screenshotsDir = path.join(reportDir, "screenshots");
const downloadsRoot = path.join(reportDir, "downloads");
const latestPath = path.join(reportsRoot, "latest");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const timestampForFile = () => new Date().toISOString();

const knownChromePaths = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const findChromePath = () => {
  for (const candidate of knownChromePaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome/Chromium not found. Set CHROME_PATH to run E2E smoke tests.");
};

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

const requestText = (url, timeoutMs = 1500) =>
  new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => resolve({ statusCode: response.statusCode, data }));
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out requesting ${url}`));
    });
    request.on("error", reject);
  });

const contentTypeFor = (filePath) => {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
};

const serveStatic = async () => {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") {
      response.writeHead(307, { location: `/movies${url.search}` });
      response.end();
      return;
    }
    if (pathname === "/movies/") {
      response.writeHead(308, { location: `/movies${url.search}` });
      response.end();
      return;
    }
    const relativePath =
      pathname === "/movies"
        ? "index.html"
        : pathname === "/privacy"
          ? "privacy.html"
          : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);

    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypeFor(filePath),
    });
    fs.createReadStream(filePath).pipe(response);
  });

  const port = await getFreePort();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

const getCdpJson = (port, route) =>
  requestText(`http://127.0.0.1:${port}${route}`, 3000).then(({ data }) => JSON.parse(data));

const connectWebSocket = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

const openChromePage = async ({ width = 1280, height = 900, name }) => {
  const chromePath = findChromePath();
  const port = await getFreePort();
  const profile = path.join("/tmp", `stackrank-e2e-${name}-${Date.now()}`);
  const downloadDir = path.join(downloadsRoot, name);
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(downloadDir, { recursive: true, force: true });
  fs.mkdirSync(downloadDir, { recursive: true });

  const proc = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  let pageTarget = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await getCdpJson(port, "/json/new?about:blank").catch(() => null);
      const tabs = await getCdpJson(port, "/json/list");
      pageTarget = tabs.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (pageTarget) break;
    } catch (_error) {
      await wait(100);
    }
  }

  if (!pageTarget) {
    proc.kill();
    throw new Error("Chrome CDP page target did not start");
  }

  const ws = await connectWebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 0;
  const events = [];
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(`${payload.error.message}: ${JSON.stringify(payload.error)}`));
      else resolve(payload.result || {});
      return;
    }
    if (payload.method === "Runtime.exceptionThrown") {
      events.push({
        type: "exception",
        message: payload.params?.exceptionDetails?.text || "Runtime exception",
      });
    }
    if (payload.method === "Network.responseReceived") {
      const response = payload.params?.response || {};
      if (response.status >= 400) {
        events.push({
          type: "network",
          level: "error",
          status: response.status,
          url: response.url || "",
        });
      }
    }
    if (payload.method === "Network.loadingFailed") {
      events.push({
        type: "network",
        level: "error",
        blockedReason: payload.params?.blockedReason || "",
        errorText: payload.params?.errorText || "",
        requestId: payload.params?.requestId || "",
      });
    }
    if (payload.method === "Log.entryAdded") {
      const entry = payload.params?.entry || {};
      if (entry.level === "error") {
        events.push({ type: "log", level: entry.level, message: entry.text || "" });
      }
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const message = { id: ++id, method, params };
      pending.set(message.id, { resolve, reject });
      ws.send(JSON.stringify(message));
    });

  const close = async () => {
    try {
      ws.close();
    } catch (_error) {
      // no-op
    }
    const exited = new Promise((resolve) => {
      proc.once("exit", resolve);
      setTimeout(resolve, 1500);
    });
    proc.kill();
    await exited;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await wait(150);
      }
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
  try {
    await send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
      eventsEnabled: true,
    });
  } catch (_error) {
    await send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });
  }

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
    }
    return result.result?.value;
  };

  const screenshot = async (fileName) => {
    const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const filePath = path.join(screenshotsDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
    return path.relative(rootDir, filePath);
  };

  return { send, evaluate, screenshot, events, downloadDir, close };
};

const waitFor = async (page, expression, timeoutMs = 8000) => {
  const started = Date.now();
  let lastValue;
  while (Date.now() - started < timeoutMs) {
    lastValue = await page.evaluate(expression);
    if (lastValue) return lastValue;
    await wait(100);
  }
  throw new Error(`Timed out waiting for: ${expression}\nLast value: ${JSON.stringify(lastValue)}`);
};

const waitForDownload = async (page, fileName, timeoutMs = 30000) => {
  const filePath = path.join(page.downloadDir, fileName);
  const partialPath = `${filePath}.crdownload`;
  const started = Date.now();
  let lastSize = -1;
  let stableChecks = 0;
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(filePath) && !fs.existsSync(partialPath)) {
      const size = fs.statSync(filePath).size;
      if (size > 0 && size === lastSize) {
        stableChecks += 1;
        if (stableChecks >= 2) return filePath;
      } else {
        lastSize = size;
        stableChecks = 0;
      }
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for download: ${fileName}`);
};

const startsWithBytes = (buffer, bytes) =>
  bytes.every((byte, index) => buffer[index] === byte);

const movie = (title, year, tmdbId) => ({
  title,
  year,
  tmdbId,
  posterPath: "",
  comparisons: 0,
  rankedAt: "2026-06-20T12:00:00.000Z",
});

const queueMovie = (title, year, tmdbId) => ({
  title,
  year,
  tmdbId,
  posterPath: "",
  comparisons: 0,
  queuedAt: "2026-06-20T13:00:00.000Z",
  savedAt: "2026-06-20T13:00:00.000Z",
});

const installPackFixtures = async (page, packs) => {
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const packs = ${JSON.stringify(packs)};
        const realFetch = window.fetch.bind(window);
        const jsonResponse = (value, extraHeaders = {}) =>
          new Response(JSON.stringify(value), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...extraHeaders
            }
          });
        window.fetch = (input, options) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.includes('/rest/v1/suggestion_packs')) {
            return Promise.resolve(jsonResponse([], { 'Content-Range': '*/0' }));
          }
          if (url.includes('data/suggestion-packs.json')) {
            return Promise.resolve(jsonResponse(packs));
          }
          if (url.includes('/functions/v1/tmdb-suggest')) {
            return Promise.resolve(jsonResponse({ results: [] }));
          }
          return realFetch(input, options);
        };
      })();
    `,
  });
};

const seedPage = async (
  page,
  baseUrl,
  name,
  {
    ranking,
    watchList = [],
    notInterestedList = [],
    packProgress = {},
    shareOptions = {},
  },
) => {
  const rankingPayload = {
    movies: ranking,
    updated_at: "2026-06-20T14:00:00.000Z",
  };
  const queuesPayload = {
    watchList,
    notInterestedList,
    updated_at: "2026-06-20T14:00:00.000Z",
  };
  const optionsPayload = {
    version: 7,
    displayName: "E2E",
    top: true,
    bottom: true,
    eras: true,
    genres: true,
    people: true,
    queues: true,
    packs: true,
    fullList: true,
    fullListStyle: "mixed",
    format: "single",
    shape: "skinny",
    theme: "classic",
    tone: "neutral",
    ...shareOptions,
  };

  await page.send("Page.navigate", { url: `${baseUrl}/?e2e=${encodeURIComponent(name)}` });
  await waitFor(page, "document.readyState === 'complete' || document.readyState === 'interactive'", 10000);
  await page.evaluate(`
    localStorage.clear();
    localStorage.setItem('stackrank:movies:v1', ${JSON.stringify(JSON.stringify(rankingPayload))});
    localStorage.setItem('stackrank:suggestion-queues:v1', ${JSON.stringify(JSON.stringify(queuesPayload))});
    localStorage.setItem(
      'stackrank:pack-progress:v1',
      ${JSON.stringify(JSON.stringify({ progress: packProgress }))}
    );
    localStorage.setItem('stackrank:share-options:v1', ${JSON.stringify(JSON.stringify(optionsPayload))});
    true;
  `);
  // Reload as a separate CDP command. Triggering location.reload() from inside
  // Runtime.evaluate can destroy the inspected execution context before the
  // evaluate response arrives, producing a nondeterministic harness failure.
  await page.send("Page.reload", { ignoreCache: true });
  await waitFor(
    page,
    `(() => document.querySelectorAll('#ranking .ranking__item').length === ${ranking.length})()`,
    12000,
  );
  await wait(250);
};

const pageHealth = async (page) => {
  const state = await page.evaluate(`(() => ({
    title: document.title,
    url: location.href,
    rankingCount: document.querySelectorAll('#ranking .ranking__item').length,
    visibleText: document.body.innerText.slice(0, 800),
    hasFrameworkOverlay: /vite|webpack|next\\.js|runtime error/i.test(document.body.innerText),
    bodyClass: document.body.className
  }))()`);
  const relevantErrors = page.events.filter((event) => {
    const message = event.message || "";
    const url = event.url || "";
    if (/favicon\.ico/i.test(message) || /favicon\.ico/i.test(url)) return false;
    if (event.type === "log" && /^Failed to load resource:/i.test(message)) return false;
    if (event.type === "network") {
      if (!url) return false;
      const isLocalAsset = /^http:\/\/127\.0\.0\.1:\d+\//.test(url);
      return isLocalAsset;
    }
    return true;
  });
  return { ...state, errors: relevantErrors };
};

const testLoadPersistence = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "load-persistence" });
  try {
    await seedPage(page, baseUrl, "load-persistence", {
      ranking: [movie("Alpha", 1990, 1001), movie("Beta", 2000, 1002), movie("Gamma", 2010, 1003)],
      watchList: [queueMovie("Delta", 2020, 1004)],
      notInterestedList: [{ ...queueMovie("Epsilon", 1980, 1005), hiddenAt: "2026-06-20T13:30:00.000Z" }],
    });
    const state = await page.evaluate(`(() => ({
      titles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      watchSub: document.querySelector('#watch-list-sub')?.textContent.trim(),
      hiddenSub: document.querySelector('#not-interested-sub')?.textContent.trim(),
      watchRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      hiddenRows: document.querySelectorAll('#not-interested-list .queue-list__item').length,
      scriptSrc: document.querySelector('script[type="module"]')?.getAttribute('src'),
      pathname: location.pathname,
      canonicalHref: document.querySelector('link[rel="canonical"]')?.href
    }))()`);
    if (
      state.pathname !== "/movies" ||
      state.canonicalHref !== "https://www.stackrankapp.com/movies"
    ) {
      throw new Error(`Movie route identity is wrong: ${JSON.stringify(state)}`);
    }
    if (state.titles.join("|") !== "Alpha|Beta|Gamma") {
      throw new Error(`Ranking did not hydrate in order: ${state.titles.join(", ")}`);
    }
    if (state.watchRows !== 1 || state.hiddenRows !== 1) {
      throw new Error(`Queue rows did not hydrate: watch=${state.watchRows}, hidden=${state.hiddenRows}`);
    }
    if (!/1 movie saved/.test(state.watchSub) || !/1 movie hidden/.test(state.hiddenSub)) {
      throw new Error(`Queue subtitles are wrong: ${state.watchSub} / ${state.hiddenSub}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return { details: state, screenshots: [await page.screenshot("load-persistence.png")] };
  } finally {
    await page.close();
  }
};

const testPrivacyAndCredits = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "privacy-and-credits", width: 1000, height: 900 });
  try {
    await page.send("Page.navigate", { url: `${baseUrl}/privacy` });
    await waitFor(
      page,
      `document.readyState === 'complete' &&
        document.querySelector('main.legal-shell') &&
        document.querySelector('#credits img[alt="TMDB"]')?.complete`,
      10000,
    );

    const desktop = await page.evaluate(`(() => ({
      pathname: location.pathname,
      title: document.title,
      canonicalHref: document.querySelector('link[rel="canonical"]')?.href,
      heading: document.querySelector('h1')?.textContent.trim(),
      tmdbNotice: document.querySelector('#credits')?.textContent.includes(
        'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      ),
      tmdbLogoSrc: document.querySelector('#credits img[alt="TMDB"]')?.getAttribute('src'),
      deletionContact: document.querySelector('a[href="mailto:stackrank@danbretl.com"]')?.textContent.trim(),
      cssHref: document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth
    }))()`);
    if (
      desktop.pathname !== "/privacy" ||
      desktop.title !== "Privacy & Credits · StackRank" ||
      desktop.canonicalHref !== "https://www.stackrankapp.com/privacy" ||
      desktop.heading !== "Privacy" ||
      !desktop.tmdbNotice ||
      desktop.tmdbLogoSrc !== "assets/tmdb-logo.svg" ||
      desktop.deletionContact !== "stackrank@danbretl.com" ||
      desktop.cssHref !== "styles.css?v=97" ||
      desktop.scrollWidth > desktop.innerWidth
    ) {
      throw new Error(`Privacy and credits page is wrong: ${JSON.stringify(desktop)}`);
    }
    const desktopShot = await page.screenshot("privacy-desktop.png");

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    await wait(200);
    const mobile = await page.evaluate(`(() => {
      const card = document.querySelector('.legal-card')?.getBoundingClientRect();
      const back = document.querySelector('.legal-back')?.getBoundingClientRect();
      return {
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        card: card ? { left: card.left, right: card.right, width: card.width } : null,
        back: back ? { height: back.height, right: back.right } : null
      };
    })()`);
    if (
      mobile.scrollWidth > mobile.innerWidth ||
      mobile.card?.left < 0 ||
      mobile.card?.right > mobile.innerWidth ||
      mobile.back?.right > mobile.innerWidth
    ) {
      throw new Error(`Mobile privacy page is clipped: ${JSON.stringify(mobile)}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Privacy browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { desktop, mobile },
      screenshots: [desktopShot, await page.screenshot("privacy-mobile.png")],
    };
  } finally {
    await page.close();
  }
};

const testBootLayoutStability = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "boot-layout-stability", width: 390, height: 844 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          window.__e2eLayoutShifts = [];
          new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (entry.hadRecentInput) return;
              window.__e2eLayoutShifts.push({
                value: entry.value,
                sources: entry.sources.map((source) => {
                  const node = source.node;
                  return {
                    node: node
                      ? \`\${node.tagName?.toLowerCase() || 'node'}\${node.id ? \`#\${node.id}\` : ''}\${node.classList?.length ? \`.\${[...node.classList].join('.')}\` : ''}\`
                      : 'unknown',
                    previousRect: source.previousRect,
                    currentRect: source.currentRect
                  };
                })
              });
            });
          }).observe({ type: 'layout-shift', buffered: true });

          const realFetch = window.fetch.bind(window);
          window.fetch = async (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/rest/v1/suggestion_packs')) {
              await new Promise((resolve) => setTimeout(resolve, 900));
              return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            if (url.includes('/functions/v1/tmdb-suggest')) {
              await new Promise((resolve) => setTimeout(resolve, 500));
              const type = new URL(url).searchParams.get('type') || 'popular';
              const start = type === 'essentials' ? 3100 : 3200;
              return new Response(JSON.stringify({
                results: [0, 1, 2].map((offset) => ({
                  tmdbId: start + offset,
                  title: type === 'essentials' ? \`Essential \${offset + 1}\` : \`Popular \${offset + 1}\`,
                  year: 2000 + offset,
                  posterPath: '',
                  genres: ['Drama']
                }))
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await page.send("Page.navigate", { url: `${baseUrl}/?e2e=boot-layout-stability` });
    await waitFor(page, "document.readyState === 'complete' || document.readyState === 'interactive'", 10000);
    await page.evaluate(`localStorage.clear(); true;`);
    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(
      page,
      `document.querySelectorAll('#pack-row .pack-card--loading').length === 3 &&
        document.querySelectorAll('.suggest-card--loading').length === 6`,
      5000,
    );
    const boot = await page.evaluate(`(() => ({
      discoveryHeight: document.querySelector('#suggest-panel')?.getBoundingClientRect().height,
      packHeight: document.querySelector('#pack-row')?.getBoundingClientRect().height,
      essentialsHeight: document.querySelector('#suggest-essentials')?.getBoundingClientRect().height,
      popularHeight: document.querySelector('#suggest-popular')?.getBoundingClientRect().height
    }))()`);

    await waitFor(
      page,
      `document.querySelectorAll('#pack-row button.pack-card').length === 3 &&
        document.querySelectorAll('.suggest-card:not(.suggest-card--loading)').length === 6`,
      10000,
    );
    await wait(250);
    const settled = await page.evaluate(`(() => ({
      discoveryHeight: document.querySelector('#suggest-panel')?.getBoundingClientRect().height,
      packHeight: document.querySelector('#pack-row')?.getBoundingClientRect().height,
      essentialsHeight: document.querySelector('#suggest-essentials')?.getBoundingClientRect().height,
      popularHeight: document.querySelector('#suggest-popular')?.getBoundingClientRect().height,
      layoutShifts: window.__e2eLayoutShifts || [],
      cls: (window.__e2eLayoutShifts || []).reduce((sum, entry) => sum + entry.value, 0),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth
    }))()`);
    if (
      Math.abs(settled.discoveryHeight - boot.discoveryHeight) > 40 ||
      Math.abs(settled.packHeight - boot.packHeight) > 4 ||
      Math.abs(settled.essentialsHeight - boot.essentialsHeight) > 4 ||
      Math.abs(settled.popularHeight - boot.popularHeight) > 4 ||
      settled.cls >= 0.1 ||
      settled.scrollWidth > settled.innerWidth
    ) {
      throw new Error(`Boot layout is unstable: ${JSON.stringify({ boot, settled })}`);
    }

    const mobileShot = await page.screenshot("boot-layout-stable-mobile.png");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 900,
    });
    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(
      page,
      `document.querySelectorAll('#pack-row button.pack-card').length === 3 &&
        document.querySelectorAll('.suggest-card:not(.suggest-card--loading)').length === 6`,
      10000,
    );
    await wait(250);
    const desktop = await page.evaluate(`(() => ({
      cls: (window.__e2eLayoutShifts || []).reduce((sum, entry) => sum + entry.value, 0),
      layoutShifts: window.__e2eLayoutShifts || [],
      rankingSkeletons: document.querySelectorAll('#ranking .skeleton-item').length,
      queueSkeletons: document.querySelectorAll('.queue-list .skeleton-queue').length,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth
    }))()`);
    if (
      desktop.cls >= 0.1 ||
      desktop.rankingSkeletons !== 0 ||
      desktop.queueSkeletons !== 0 ||
      desktop.scrollWidth > desktop.innerWidth
    ) {
      throw new Error(`Desktop boot layout is unstable: ${JSON.stringify(desktop)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Boot layout browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { mobile: { boot, settled }, desktop },
      screenshots: [mobileShot, await page.screenshot("boot-layout-stable-desktop.png")],
    };
  } finally {
    await page.close();
  }
};

const testAppShellNavigation = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "app-shell-navigation", width: 1440, height: 900 });
  try {
    await seedPage(page, baseUrl, "app-shell-navigation", {
      ranking: [
        movie("Alpha", 1990, 2001),
        movie("Beta", 1995, 2002),
        movie("Gamma", 2000, 2003),
        movie("Delta", 2005, 2004),
        movie("Epsilon", 2010, 2005),
      ],
      watchList: [queueMovie("Saved", 2020, 2006)],
      notInterestedList: [{ ...queueMovie("Hidden", 2021, 2007), hiddenAt: "2026-06-20T13:30:00.000Z" }],
    });

    const desktop = await page.evaluate(`(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds ? {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        } : null;
      };
      const rank = rect('.side-stack');
      const rail = rect('.stack');
      const total = (rank?.width || 0) + (rail?.width || 0);
      return {
        destination: document.querySelector('main.app')?.dataset.appDestination,
        currentNav: document.querySelector('.app-nav--top .app-nav__item[aria-current="page"]')?.textContent.trim(),
        rank,
        rail,
        ratio: total ? rank.width / total : 0,
        rankingLeftOfRail: rank && rail ? rank.left < rail.left : false,
        addVisible: !!rect('.panel--add'),
        continueVisible: !!rect('.panel--discovery'),
        visibleQueuePanels: [...document.querySelectorAll('.panel--queue')].filter((panel) => {
          const bounds = panel.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        }).length,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth
      };
    })()`);
    if (
      desktop.destination !== "rank" ||
      desktop.currentNav !== "Rank" ||
      desktop.ratio < 0.61 ||
      desktop.ratio > 0.67 ||
      !desktop.rankingLeftOfRail ||
      !desktop.addVisible ||
      !desktop.continueVisible ||
      desktop.visibleQueuePanels !== 0 ||
      desktop.scrollWidth > desktop.innerWidth
    ) {
      throw new Error(`Desktop app shell layout is wrong: ${JSON.stringify(desktop)}`);
    }
    const desktopShot = await page.screenshot("app-shell-desktop-rank.png");

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    await wait(250);
    const mobileRank = await page.evaluate(`(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds ? {
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        } : null;
      };
      const inFlow = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return !!bounds && bounds.width > 0 && bounds.height > 0;
      };
      return {
        destination: document.querySelector('main.app')?.dataset.appDestination,
        add: rect('.panel--add'),
        ranking: rect('.panel--list'),
        discoveryVisible: inFlow('.panel--discovery'),
        queueVisible: [...document.querySelectorAll('.panel--queue')].some((panel) => {
          const bounds = panel.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        }),
        mobileNav: rect('.app-nav--mobile'),
        topNavVisible: inFlow('.app-nav--top'),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        innerHeight
      };
    })()`);
    if (
      mobileRank.destination !== "rank" ||
      !mobileRank.add ||
      !mobileRank.ranking ||
      mobileRank.ranking.top >= mobileRank.innerHeight ||
      mobileRank.discoveryVisible ||
      mobileRank.queueVisible ||
      !mobileRank.mobileNav ||
      mobileRank.mobileNav.height < 68 ||
      mobileRank.topNavVisible ||
      mobileRank.scrollWidth > mobileRank.innerWidth
    ) {
      throw new Error(`Mobile Rank shell is wrong: ${JSON.stringify(mobileRank)}`);
    }

    await page.evaluate(`(() => {
      document.querySelectorAll('[data-app-destination-target="discover"]').forEach((button) => button.click());
      return true;
    })()`);
    await wait(100);
    await page.evaluate(`window.scrollTo(0, 520); true;`);
    await wait(50);
    const mobileDiscover = await page.evaluate(`(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds ? { top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height } : null;
      };
      const inFlow = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return !!bounds && bounds.width > 0 && bounds.height > 0;
      };
      return {
        destination: document.querySelector('main.app')?.dataset.appDestination,
        currentNav: document.querySelector('.app-nav--mobile .app-nav__item[aria-current="page"]')?.textContent.trim(),
        pack: rect('#pack-section'),
        addVisible: inFlow('.panel--add'),
        rankingVisible: inFlow('.panel--list'),
        scrollY: window.scrollY,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth
      };
    })()`);
    if (
      mobileDiscover.destination !== "discover" ||
      mobileDiscover.currentNav !== "Discover" ||
      !mobileDiscover.pack ||
      mobileDiscover.addVisible ||
      mobileDiscover.rankingVisible ||
      mobileDiscover.scrollY < 400 ||
      mobileDiscover.scrollWidth > mobileDiscover.innerWidth
    ) {
      throw new Error(`Mobile Discover shell is wrong: ${JSON.stringify(mobileDiscover)}`);
    }
    const discoverShot = await page.screenshot("app-shell-mobile-discover.png");

    await page.evaluate(`document.querySelector('.app-nav--mobile [data-app-destination-target="lists"]')?.click(); true;`);
    await wait(100);
    const mobileLists = await page.evaluate(`(() => {
      const inFlow = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return !!bounds && bounds.width > 0 && bounds.height > 0;
      };
      return {
        destination: document.querySelector('main.app')?.dataset.appDestination,
        currentNav: document.querySelector('.app-nav--mobile .app-nav__item[aria-current="page"]')?.textContent.trim(),
        watchVisible: inFlow('#watch-list'),
        hiddenVisible: inFlow('#not-interested-list'),
        addVisible: inFlow('.panel--add'),
        rankingVisible: inFlow('.panel--list'),
        discoveryVisible: inFlow('.panel--discovery'),
        scrollY: window.scrollY,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth
      };
    })()`);
    if (
      mobileLists.destination !== "lists" ||
      mobileLists.currentNav !== "Lists" ||
      !mobileLists.watchVisible ||
      !mobileLists.hiddenVisible ||
      mobileLists.addVisible ||
      mobileLists.rankingVisible ||
      mobileLists.discoveryVisible ||
      mobileLists.scrollWidth > mobileLists.innerWidth
    ) {
      throw new Error(`Mobile Lists shell is wrong: ${JSON.stringify(mobileLists)}`);
    }

    await page.evaluate(`document.querySelector('.app-nav--mobile [data-app-destination-target="discover"]')?.click(); true;`);
    await wait(100);
    const restored = await page.evaluate(`window.scrollY`);
    if (Math.abs(restored - mobileDiscover.scrollY) > 8) {
      throw new Error(`Discover scroll was not restored: ${JSON.stringify({ before: mobileDiscover.scrollY, restored })}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { desktop, mobileRank, mobileDiscover, mobileLists, restored },
      screenshots: [desktopShot, discoverShot],
    };
  } finally {
    await page.close();
  }
};

const testFirstRunQuickStart = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "first-run-quick-start", width: 1280, height: 900 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
          window.__e2eSuggestRequests = {};
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tmdb-search')) {
              const query = new URL(url).searchParams.get('q') || '';
              const second = /second/i.test(query);
              return Promise.resolve(new Response(JSON.stringify({
                results: [{
                  tmdbId: second ? 1902 : 1901,
                  title: second ? 'Second Pick' : 'First Pick',
                  year: second ? 2002 : 2001,
                  posterPath: ''
                }]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            if (url.includes('/functions/v1/tmdb-suggest')) {
              const type = new URL(url).searchParams.get('type') || 'unknown';
              window.__e2eSuggestRequests[type] = (window.__e2eSuggestRequests[type] || 0) + 1;
              return Promise.resolve(new Response(JSON.stringify({ results: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "first-run-quick-start", { ranking: [] });
    await waitFor(
      page,
      `!document.querySelector('#first-run')?.hidden &&
        document.querySelector('#first-run')?.dataset.state === 'empty' &&
        document.querySelectorAll('#pack-row .pack-card:not(.pack-card--loading)').length === 3 &&
        document.querySelectorAll('.suggest-card--loading').length === 0`,
      10000,
    );

    const empty = await page.evaluate(`(() => ({
      state: document.querySelector('#first-run')?.dataset.state,
      title: document.querySelector('#first-run-title')?.textContent.trim(),
      body: document.querySelector('#first-run-body')?.textContent.trim(),
      importHidden: !!document.querySelector('#quick-start-import')?.hidden,
      packTitle: document.querySelector('#pack-section-title')?.textContent.trim(),
      starterSlugs: [...document.querySelectorAll('#pack-row .pack-card')].map((card) => card.dataset.slug),
      moduleSrc: document.querySelector('script[type="module"]')?.getAttribute('src'),
      cssHref: document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'),
      suggestRequests: window.__e2eSuggestRequests,
      h1Text: document.querySelector('h1')?.textContent.trim(),
      h1Count: document.querySelectorAll('h1').length,
      suggestionCardCount: document.querySelectorAll('.suggest-card').length,
      suggestionPrimaryCount: document.querySelectorAll('.suggest-card > .suggest-primary').length,
      privacyHref: document.querySelector('.footnote a[href="/privacy"]')?.getAttribute('href'),
      creditsHref: document.querySelector('.footnote a[href="/privacy#credits"]')?.getAttribute('href'),
      nestedSuggestionControls: [...document.querySelectorAll('.suggest-card')].filter((card) =>
        card.matches('[role="button"], [tabindex]') && card.querySelector('button')
      ).length
    }))()`);
    const expectedStarterSlugs = [
      "fan-favorites-letterboxd-core",
      "studio-ghibli-gateways",
      "black-cinema-essentials",
    ];
    if (
      empty.state !== "empty" ||
      empty.title !== "Add two movies. Pick the one you prefer." ||
      !/exact rank/.test(empty.body || "") ||
      empty.importHidden ||
      empty.packTitle !== "Start with a movie pack" ||
      empty.starterSlugs.join("|") !== expectedStarterSlugs.join("|") ||
      empty.moduleSrc !== "app.js?v=140" ||
      empty.cssHref !== "styles.css?v=99" ||
      empty.suggestRequests?.popular !== 1 ||
      empty.suggestRequests?.essentials !== 1 ||
      empty.h1Text !== "StackRank" ||
      empty.h1Count !== 1 ||
      empty.suggestionPrimaryCount !== empty.suggestionCardCount ||
      empty.privacyHref !== "/privacy" ||
      empty.creditsHref !== "/privacy#credits" ||
      empty.nestedSuggestionControls !== 0
    ) {
      throw new Error(`Empty first-run state is wrong: ${JSON.stringify(empty)}`);
    }
    const emptyShot = await page.screenshot("first-run-empty.png");

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    await wait(200);
    const mobile = await page.evaluate(`(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds ? {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        } : null;
      };
      return {
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        input: rect('#title'),
        firstRun: rect('#first-run'),
        importButton: rect('#quick-start-import'),
        packSection: rect('#pack-section'),
        firstPack: rect('#pack-row .pack-card')
      };
    })()`);
    if (
      mobile.scrollWidth > mobile.innerWidth ||
      mobile.input?.left < 0 ||
      mobile.input?.right > mobile.innerWidth ||
      mobile.firstRun?.left < 0 ||
      mobile.firstRun?.right > mobile.innerWidth ||
      mobile.importButton?.height < 44 ||
      mobile.firstPack?.top >= mobile.innerHeight
    ) {
      throw new Error(`Mobile first-run layout is clipped or unreachable: ${JSON.stringify(mobile)}`);
    }
    const mobileShot = await page.screenshot("first-run-empty-mobile.png");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 900,
    });
    await wait(200);

    await page.evaluate(`document.querySelector('#quick-start-import')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#title-import')?.hidden &&
        document.activeElement === document.querySelector('#title-import-input')`,
      3000,
    );
    await page.evaluate(`document.querySelector('#title-import-close')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#title-import')?.hidden &&
        document.activeElement === document.querySelector('#quick-start-import')`,
      3000,
    );

    await page.evaluate(`document.querySelector('#pack-row .pack-card')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#pack-detail')?.hidden &&
        document.querySelector('#pack-detail-title')?.textContent.trim() === 'Fan Favorite Core'`,
      3000,
    );
    await page.evaluate(`document.querySelector('#pack-detail-close')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail')?.hidden &&
        document.activeElement?.dataset.slug === 'fan-favorites-letterboxd-core'`,
      3000,
    );

    await page.evaluate(`(() => {
      const input = document.querySelector('#title');
      input.focus();
      input.value = 'First';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#suggestions .suggestions__item').length === 1`, 3000);
    await page.evaluate(`document.querySelector('#suggestions .suggestions__item')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelectorAll('#ranking .ranking__item').length === 1 &&
        document.querySelector('#first-run')?.dataset.state === 'one' &&
        document.activeElement !== document.querySelector('#title')`,
      5000,
    );
    const one = await page.evaluate(`(() => ({
      state: document.querySelector('#first-run')?.dataset.state,
      title: document.querySelector('#first-run-title')?.textContent.trim(),
      importHidden: !!document.querySelector('#quick-start-import')?.hidden,
      inputBlurred: document.activeElement !== document.querySelector('#title'),
      rankingTitle: document.querySelector('#ranking .ranking__title')?.textContent.trim(),
      packTitle: document.querySelector('#pack-section-title')?.textContent.trim()
    }))()`);
    if (
      one.state !== "one" ||
      one.title !== "Add one more to start comparing." ||
      !one.importHidden ||
      !one.inputBlurred ||
      one.rankingTitle !== "First Pick" ||
      one.packTitle !== "Suggested movie packs"
    ) {
      throw new Error(`One-movie first-run state is wrong: ${JSON.stringify(one)}`);
    }
    await wait(650);
    const oneShot = await page.screenshot("first-run-one-movie.png");

    await page.evaluate(`(() => {
      const input = document.querySelector('#title');
      input.focus();
      input.value = 'Second';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#suggestions .suggestions__item').length === 1`, 3000);
    await page.evaluate(`document.querySelector('#suggestions .suggestions__item')?.click(); true;`);
    await waitFor(
      page,
      `document.body.classList.contains('is-comparing') &&
        !document.querySelector('#compare')?.classList.contains('panel--hidden')`,
      3000,
    );
    const comparing = await page.evaluate(`(() => ({
      firstRunRendered: document.querySelector('#first-run')?.getBoundingClientRect().height > 0,
      newTitle: document.querySelector('#new-title')?.textContent.trim(),
      existingTitle: document.querySelector('#existing-title')?.textContent.trim()
    }))()`);
    if (
      comparing.firstRunRendered ||
      comparing.newTitle !== "Second Pick" ||
      comparing.existingTitle !== "First Pick"
    ) {
      throw new Error(`First comparison state is wrong: ${JSON.stringify(comparing)}`);
    }
    await wait(800);
    const comparisonShot = await page.screenshot("first-run-first-comparison.png");

    await page.evaluate(`document.querySelector('#new-card')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelectorAll('#ranking .ranking__item').length === 2 &&
        document.querySelector('#first-run')?.hidden &&
        !document.body.classList.contains('is-comparing')`,
      5000,
    );
    const activated = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      firstRunHidden: !!document.querySelector('#first-run')?.hidden,
      inputBlurred: document.activeElement !== document.querySelector('#title'),
      packTitle: document.querySelector('#pack-section-title')?.textContent.trim()
    }))()`);
    if (
      activated.rankingTitles.join("|") !== "Second Pick|First Pick" ||
      !activated.firstRunHidden ||
      !activated.inputBlurred ||
      activated.packTitle !== "Suggested movie packs"
    ) {
      throw new Error(`Activated first-run state is wrong: ${JSON.stringify(activated)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { empty, mobile, one, comparing, activated },
      screenshots: [
        emptyShot,
        mobileShot,
        oneShot,
        comparisonShot,
        await page.screenshot("first-run-activated.png"),
      ],
    };
  } finally {
    await page.close();
  }
};

const testSignInExperience = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "sign-in-experience", width: 1280, height: 900 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/auth/v1/settings')) {
              return Promise.resolve(new Response(JSON.stringify({
                external: { email: true, google: true, apple: false }
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            if (url.includes('/auth/v1/otp')) {
              return Promise.reject(new TypeError('Simulated sign-in network failure'));
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "sign-in-experience", {
      ranking: [movie("Alpha", 1990, 1701)],
    });

    await page.evaluate(`document.querySelector('#auth-sign-in')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#signin-overlay')?.hidden &&
        !document.querySelector('#signin-google')?.hidden &&
        document.querySelector('#signin-apple')?.hidden`,
      3000,
    );
    const opened = await page.evaluate(`(() => ({
      activeId: document.activeElement?.id,
      googleHidden: document.querySelector('#signin-google')?.hidden,
      appleHidden: document.querySelector('#signin-apple')?.hidden,
      emailDisabled: document.querySelector('#signin-email')?.disabled,
      bodyOverflow: getComputedStyle(document.body).overflow,
      backgroundInert: document.querySelector('.topbar')?.inert,
      modalInert: document.querySelector('#signin-overlay')?.inert
    }))()`);
    if (
      opened.activeId !== "signin-close" ||
      opened.googleHidden ||
      !opened.appleHidden ||
      opened.emailDisabled ||
      opened.bodyOverflow !== "hidden" ||
      !opened.backgroundInert ||
      opened.modalInert
    ) {
      throw new Error(`Sign-in opening state is wrong: ${JSON.stringify(opened)}`);
    }

    await page.evaluate(`(() => {
      const input = document.querySelector('#signin-email');
      input.value = 'not-an-email';
      document.querySelector('#signin-magic-send')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#signin-status')?.classList.contains('is-error')`,
      1000,
    );
    const invalid = await page.evaluate(`(() => ({
      status: document.querySelector('#signin-status')?.textContent.trim(),
      activeId: document.activeElement?.id
    }))()`);
    if (!/valid email address/.test(invalid.status || "") || invalid.activeId !== "signin-email") {
      throw new Error(`Magic-link validation is wrong: ${JSON.stringify(invalid)}`);
    }

    await page.evaluate(`(() => {
      const input = document.querySelector('#signin-email');
      input.value = 'valid@example.test';
      document.querySelector('#signin-magic-send')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#signin-status')?.classList.contains('is-error') &&
        !document.querySelector('#signin-magic-send')?.disabled`,
      3000,
    );
    const networkFailure = await page.evaluate(`(() => ({
      status: document.querySelector('#signin-status')?.textContent.trim(),
      submitDisabled: document.querySelector('#signin-magic-send')?.disabled,
      inputDisabled: document.querySelector('#signin-email')?.disabled
    }))()`);
    if (
      !/sign-in failed/i.test(networkFailure.status || "") ||
      networkFailure.submitDisabled ||
      networkFailure.inputDisabled
    ) {
      throw new Error(`Magic-link network recovery is wrong: ${JSON.stringify(networkFailure)}`);
    }

    const desktopShot = await page.screenshot("sign-in-desktop.png");
    await page.evaluate(`(() => {
      const privacy = document.querySelector('.signin-fineprint a[href="/privacy"]');
      privacy.focus();
      privacy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      return true;
    })()`);
    const trappedFocus = await page.evaluate(`document.activeElement?.id`);
    if (trappedFocus !== "signin-close") {
      throw new Error(`Sign-in focus did not wrap: ${trappedFocus}`);
    }

    await page.evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#signin-overlay')?.hidden &&
        document.activeElement === document.querySelector('#auth-sign-in') &&
        !document.querySelector('.topbar')?.inert`,
      1000,
    );

    await page.evaluate(`document.querySelector('#ranking-settings-toggle')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#ranking-settings-panel')?.hidden`, 1000);
    await page.evaluate(`document.querySelector('#settings-sign-in')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#signin-overlay')?.hidden &&
        document.querySelector('#ranking-settings-panel')?.hidden`,
      1000,
    );
    await page.evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#signin-overlay')?.hidden &&
        document.activeElement === document.querySelector('#ranking-settings-toggle')`,
      1000,
    );

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    await page.evaluate(`document.querySelector('#auth-sign-in')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#signin-overlay')?.hidden`, 1000);
    const mobile = await page.evaluate(`(() => {
      const sheet = document.querySelector('#signin-overlay .signin-sheet')?.getBoundingClientRect();
      const input = document.querySelector('#signin-email')?.getBoundingClientRect();
      const submit = document.querySelector('#signin-magic-send')?.getBoundingClientRect();
      return {
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        sheet: sheet ? { left: sheet.left, right: sheet.right, top: sheet.top, bottom: sheet.bottom } : null,
        inputHeight: input?.height,
        submitHeight: submit?.height
      };
    })()`);
    if (
      mobile.scrollWidth > mobile.innerWidth ||
      mobile.sheet?.left < 0 ||
      mobile.sheet?.right > mobile.innerWidth ||
      mobile.sheet?.top < 0 ||
      mobile.sheet?.bottom > mobile.innerHeight ||
      mobile.inputHeight < 44 ||
      mobile.submitHeight < 44
    ) {
      throw new Error(`Mobile sign-in layout is clipped or too small: ${JSON.stringify(mobile)}`);
    }
    const mobileShot = await page.screenshot("sign-in-mobile.png");

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { opened, invalid, networkFailure, trappedFocus, mobile },
      screenshots: [desktopShot, mobileShot],
    };
  } finally {
    await page.close();
  }
};

const testQueueComparison = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "queue-comparison" });
  try {
    await seedPage(page, baseUrl, "queue-comparison", {
      ranking: [movie("Alpha", 1990, 1101), movie("Beta", 2000, 1102), movie("Gamma", 2010, 1103)],
      watchList: [queueMovie("Omega", 2022, 1104)],
    });
    const queueSemantics = await page.evaluate(`(() => {
      const item = document.querySelector('#watch-list .queue-list__item');
      const primary = item?.querySelector('.queue-list__primary');
      return {
        itemRole: item?.getAttribute('role'),
        itemTabIndex: item?.getAttribute('tabindex'),
        primaryTag: primary?.tagName,
        primaryLabel: primary?.getAttribute('aria-label'),
        nestedControls: item?.matches('[role="button"], [tabindex]') && !!item?.querySelector('button')
      };
    })()`);
    if (
      queueSemantics.itemRole ||
      queueSemantics.itemTabIndex ||
      queueSemantics.primaryTag !== "BUTTON" ||
      queueSemantics.primaryLabel !== "Rank Omega. Released 2022" ||
      queueSemantics.nestedControls
    ) {
      throw new Error(`Queue semantics are wrong: ${JSON.stringify(queueSemantics)}`);
    }
    const started = await page.evaluate(`(() => {
      Math.random = () => 0.5;
      document.querySelector('#watch-list .queue-list__primary')?.click();
      return !document.querySelector('#compare')?.classList.contains('panel--hidden');
    })()`);
    if (!started) throw new Error("Clicking a watch-list row did not open comparison mode");
    await waitFor(page, `!document.querySelector('#compare')?.classList.contains('panel--hidden')`, 5000);
    const comparisonShot = await page.screenshot("queue-comparison-open.png");
    for (let i = 0; i < 6; i += 1) {
      const hidden = await page.evaluate(`document.querySelector('#compare')?.classList.contains('panel--hidden')`);
      if (hidden) break;
      await page.evaluate(`document.querySelector('#existing-card')?.click(); true;`);
      await wait(150);
    }
    await waitFor(page, `document.querySelector('#compare')?.classList.contains('panel--hidden')`, 5000);
    const state = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      watchRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || ''
    }))()`);
    if (state.rankingTitles.length !== 4 || state.rankingTitles[3] !== "Omega") {
      throw new Error(`Queue movie did not settle at bottom: ${state.rankingTitles.join(", ")}`);
    }
    if (state.watchRows !== 0) throw new Error(`Watch queue should be empty after ranking; got ${state.watchRows}`);
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { queueSemantics, state },
      screenshots: [comparisonShot, await page.screenshot("queue-comparison-settled.png")],
    };
  } finally {
    await page.close();
  }
};

const testStorageFailureWarning = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "storage-failure-warning" });
  try {
    await seedPage(page, baseUrl, "storage-failure-warning", {
      ranking: [movie("Alpha", 1990, 1121), movie("Beta", 2000, 1122), movie("Gamma", 2010, 1123)],
      watchList: [queueMovie("Offline Pick", 2022, 1124)],
    });
    await page.evaluate(`(() => {
      Math.random = () => 0.5;
      Storage.prototype.setItem = function setItemFailure() {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      };
      document.querySelector('#watch-list .queue-list__primary')?.click();
      return true;
    })()`);
    await waitFor(page, `!document.querySelector('#compare')?.classList.contains('panel--hidden')`, 3000);
    for (let index = 0; index < 6; index += 1) {
      const hidden = await page.evaluate(`document.querySelector('#compare')?.classList.contains('panel--hidden')`);
      if (hidden) break;
      await page.evaluate(`document.querySelector('#existing-card')?.click(); true;`);
      await wait(120);
    }
    await waitFor(page, `document.querySelector('#compare')?.classList.contains('panel--hidden')`, 5000);
    const state = await page.evaluate(`(() => ({
      rankingCount: document.querySelectorAll('#ranking .ranking__item').length,
      storedCount: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.length || 0,
      status: document.querySelector('#api-status')?.textContent.trim(),
      backupEnabled: !document.querySelector('#download-backup')?.disabled
    }))()`);
    await page.evaluate(`(() => {
      document.querySelector('#ranking-settings-toggle')?.click();
      document.querySelector('#download-backup')?.click();
      return true;
    })()`);
    const backupName = `stackrank-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const backupPath = await waitForDownload(page, backupName);
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    state.backupRankingCount = backup.ranking?.length || 0;
    if (
      state.rankingCount !== 4 ||
      state.storedCount !== 3 ||
      !/could not save in this browser/i.test(state.status || "") ||
      !state.backupEnabled ||
      state.backupRankingCount !== 4
    ) {
      throw new Error(`Storage failure was not surfaced safely: ${JSON.stringify(state)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: state,
      screenshots: [await page.screenshot("storage-failure-warning.png")],
    };
  } finally {
    await page.close();
  }
};

const testTmdbFailureRecovery = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "tmdb-failure-recovery" });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
          window.__e2eTmdbRecovered = false;
          window.__e2eDetailRecovered = false;
          const response = (value, status = 200) => Promise.resolve(new Response(
            JSON.stringify(value),
            { status, headers: { 'Content-Type': 'application/json' } }
          ));
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tmdb-suggest')) {
              if (!window.__e2eTmdbRecovered) return response({ message: 'unavailable' }, 503);
              const type = new URL(url).searchParams.get('type') || 'popular';
              const title = type === 'recommendations' ? 'Recovered Related' :
                type === 'essentials' ? 'Recovered Essential' : 'Recovered Popular';
              const id = type === 'recommendations' ? 1141 : type === 'essentials' ? 1142 : 1143;
              return response({ results: [{ tmdbId: id, title, year: 2020, posterPath: '' }] });
            }
            if (url.includes('/functions/v1/tmdb-search')) {
              if (!window.__e2eTmdbRecovered) return response({ message: 'unavailable' }, 503);
              return response({
                results: [{ tmdbId: 1144, title: 'Recovered Search', year: 2021, posterPath: '' }]
              });
            }
            if (url.includes('/functions/v1/tmdb-detail')) {
              if (!window.__e2eDetailRecovered) return response({ message: 'unavailable' }, 503);
              const id = Number(new URL(url).searchParams.get('id'));
              return response({
                result: { tmdbId: id, runtime: 111, genres: ['Drama'], director: 'Recovered Director', cast: ['Recovered Actor'] }
              });
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "tmdb-failure-recovery", {
      ranking: [movie("Alpha", 1990, 1131)],
    });
    await waitFor(
      page,
      `document.querySelectorAll('.suggest-load-error').length === 3 &&
        !document.querySelector('#suggest-related-more')?.disabled &&
        !document.querySelector('#suggest-essentials-more')?.disabled &&
        !document.querySelector('#suggest-popular-more')?.disabled`,
      5000,
    );
    await page.evaluate(`(() => {
      const input = document.querySelector('#title');
      input.value = 'Retry search';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#suggestions .suggestions__status')?.textContent.includes('Search is unavailable')`,
      3000,
    );
    const failed = await page.evaluate(`(() => ({
      sectionErrors: [...document.querySelectorAll('.suggest-load-error')].map((element) => element.textContent.trim()),
      searchStatus: document.querySelector('#suggestions .suggestions__status')?.textContent.trim(),
      refreshEnabled: [
        '#suggest-related-more',
        '#suggest-essentials-more',
        '#suggest-popular-more'
      ].every((selector) => !document.querySelector(selector)?.disabled)
    }))()`);
    const failedShot = await page.screenshot("tmdb-failure-state.png");

    await page.evaluate(`(() => {
      window.__e2eTmdbRecovered = true;
      document.querySelector('#suggest-popular-more')?.click();
      const input = document.querySelector('#title');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = 'Retry search';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#suggest-popular .suggest-name')?.textContent.trim() === 'Recovered Popular' &&
        document.querySelector('#suggestions .suggestions__title')?.textContent.trim() === 'Recovered Search'`,
      5000,
    );
    const recoveredSearchTitle = await page.evaluate(
      `document.querySelector('#suggestions .suggestions__title')?.textContent.trim()`,
    );
    await page.evaluate(`document.querySelector('#suggest-popular .suggest-info')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#movie-detail')?.hidden &&
        !document.querySelector('#detail-retry')?.hidden`,
      3000,
    );
    await page.evaluate(`(() => {
      window.__e2eDetailRecovered = true;
      document.querySelector('#detail-retry')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#detail-sub')?.textContent.includes('1h 51m') &&
        document.querySelector('#detail-status')?.textContent.trim() === ''`,
      5000,
    );
    const recovered = await page.evaluate(`(() => ({
      popularTitle: document.querySelector('#suggest-popular .suggest-name')?.textContent.trim(),
      detailSub: document.querySelector('#detail-sub')?.textContent.trim(),
      detailStatus: document.querySelector('#detail-status')?.textContent.trim(),
      detailRetryHidden: document.querySelector('#detail-retry')?.hidden
    }))()`);
    if (
      failed.sectionErrors.length !== 3 ||
      !failed.searchStatus?.includes("Search is unavailable") ||
      !failed.refreshEnabled ||
      recovered.popularTitle !== "Recovered Popular" ||
      recoveredSearchTitle !== "Recovered Search" ||
      !recovered.detailSub?.includes("1h 51m") ||
      recovered.detailStatus ||
      !recovered.detailRetryHidden
    ) {
      throw new Error(`TMDB failure recovery is wrong: ${JSON.stringify({ failed, recovered })}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { failed, recoveredSearchTitle, recovered },
      screenshots: [failedShot, await page.screenshot("tmdb-failure-recovered.png")],
    };
  } finally {
    await page.close();
  }
};

const testComparisonUndoCancel = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "comparison-undo-cancel" });
  try {
    await seedPage(page, baseUrl, "comparison-undo-cancel", {
      ranking: [movie("Alpha", 1990, 1151), movie("Beta", 2000, 1152), movie("Gamma", 2010, 1153)],
      watchList: [queueMovie("Rewind", 2024, 1154)],
    });
    const started = await page.evaluate(`(() => {
      Math.random = () => 0.5;
      document.querySelector('#watch-list .queue-list__item')?.click();
      return !document.querySelector('#compare')?.classList.contains('panel--hidden');
    })()`);
    if (!started) throw new Error("Clicking a watch-list row did not open comparison mode");
    await page.evaluate(`document.querySelector('#existing-card')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#undo-choice')?.hidden`, 5000);
    const afterChoiceShot = await page.screenshot("comparison-undo-visible.png");
    const afterChoice = await page.evaluate(`(() => ({
      undoHidden: !!document.querySelector('#undo-choice')?.hidden,
      cancelHidden: !!document.querySelector('#cancel-ranking')?.hidden,
      compareSub: document.querySelector('#compare-sub')?.textContent.trim()
    }))()`);
    if (afterChoice.undoHidden || !afterChoice.cancelHidden) {
      throw new Error(`Undo/cancel visibility after a choice is wrong: ${JSON.stringify(afterChoice)}`);
    }

    await page.evaluate(`document.querySelector('#undo-choice')?.click(); true;`);
    await waitFor(page, `document.querySelector('#undo-choice')?.hidden && !document.querySelector('#cancel-ranking')?.hidden`, 5000);
    const afterUndo = await page.evaluate(`(() => ({
      undoHidden: !!document.querySelector('#undo-choice')?.hidden,
      cancelHidden: !!document.querySelector('#cancel-ranking')?.hidden,
      compareSub: document.querySelector('#compare-sub')?.textContent.trim()
    }))()`);
    if (!afterUndo.undoHidden || afterUndo.cancelHidden || !/Comparison 1/.test(afterUndo.compareSub || "")) {
      throw new Error(`Undo did not restore the initial comparison state: ${JSON.stringify(afterUndo)}`);
    }

    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(page, `document.querySelector('#compare')?.classList.contains('panel--hidden')`, 5000);
    const settled = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      watchRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      watchTitle: document.querySelector('#watch-list .queue-list__title')?.textContent.trim() || '',
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || ''
    }))()`);
    if (settled.rankingTitles.length !== 3 || settled.rankingTitles.some((title) => /Rewind/.test(title))) {
      throw new Error(`Canceled movie should not remain in ranking: ${settled.rankingTitles.join(", ")}`);
    }
    if (settled.watchRows !== 1 || settled.watchTitle !== "Rewind") {
      throw new Error(`Cancel should restore the watch queue item: ${JSON.stringify(settled)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return { details: { afterChoice, afterUndo, settled }, screenshots: [afterChoiceShot, await page.screenshot("comparison-canceled.png")] };
  } finally {
    await page.close();
  }
};

const testRankingReviewSession = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "ranking-review" });
  const originalTitles = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];
  try {
    await seedPage(page, baseUrl, "ranking-review", {
      ranking: originalTitles.map((title, index) => movie(title, 1990 + index, 1170 + index)),
    });
    await page.evaluate(`document.querySelector('#ranking-review')?.click(); true;`);
    await waitFor(
      page,
      `document.body.classList.contains('is-reviewing') && !document.querySelector('#review-swap')?.hidden`,
      3000,
    );
    const opened = await page.evaluate(`(() => ({
      heading: document.querySelector('#compare h2')?.textContent.trim(),
      sub: document.querySelector('#compare-sub')?.textContent.trim(),
      higher: document.querySelector('#new-title')?.textContent.trim(),
      lower: document.querySelector('#existing-title')?.textContent.trim(),
      keepVisible: !document.querySelector('#review-keep')?.hidden,
      swapVisible: !document.querySelector('#review-swap')?.hidden,
      endVisible: !document.querySelector('#review-end')?.hidden
    }))()`);
    if (
      opened.heading !== "Review your ranking" ||
      !/Pair 1 of/.test(opened.sub || "") ||
      !opened.higher ||
      !opened.lower ||
      !opened.keepVisible ||
      !opened.swapVisible ||
      !opened.endVisible
    ) {
      throw new Error(`Review mode did not expose the expected controls: ${JSON.stringify(opened)}`);
    }

    await page.evaluate(`document.querySelector('#review-swap')?.click(); true;`);
    await waitFor(
      page,
      `(() => {
        const titles = [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent);
        return titles.findIndex((title) => title.includes(${JSON.stringify(opened.lower)})) <
          titles.findIndex((title) => title.includes(${JSON.stringify(opened.higher)}));
      })()`,
      3000,
    );
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await waitFor(
      page,
      `!document.body.classList.contains('is-reviewing') &&
        !!document.querySelector('#add-feedback .feedback-toast__action')`,
      3000,
    );
    const ended = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) =>
        el.textContent.replace(/^\\d+\\.\\s*/, '').trim()
      ),
      storedTitles: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.map((entry) => entry.title) || [],
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || '',
      comparing: document.body.classList.contains('is-comparing')
    }))()`);
    if (
      ended.rankingTitles.indexOf(opened.lower) >= ended.rankingTitles.indexOf(opened.higher) ||
      ended.storedTitles.join("|") !== ended.rankingTitles.join("|") ||
      !/Review ended · 1 swap/.test(ended.feedback) ||
      ended.comparing
    ) {
      throw new Error(`Review swap/end state is wrong: ${JSON.stringify(ended)}`);
    }
    const endedShot = await page.screenshot("ranking-review-ended.png");

    await page.evaluate(`document.querySelector('#add-feedback .feedback-toast__action')?.click(); true;`);
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')].map((el) =>
        el.textContent.replace(/^\\d+\\.\\s*/, '').trim()
      ).join('|') === ${JSON.stringify(originalTitles.join("|"))}`,
      3000,
    );
    const undone = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) =>
        el.textContent.replace(/^\\d+\\.\\s*/, '').trim()
      ),
      storedTitles: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.map((entry) => entry.title) || []
    }))()`);
    if (
      undone.rankingTitles.join("|") !== originalTitles.join("|") ||
      undone.storedTitles.join("|") !== originalTitles.join("|")
    ) {
      throw new Error(`Review session undo did not restore the exact order: ${JSON.stringify(undone)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { opened, ended, undone },
      screenshots: [endedShot, await page.screenshot("ranking-review-undone.png")],
    };
  } finally {
    await page.close();
  }
};

const testAutocompleteKeyboardSelection = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "autocomplete-keyboard" });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tmdb-search')) {
              return Promise.resolve(new Response(JSON.stringify({
                results: [
                  { tmdbId: 1181, title: 'Keyboard One', year: 2001, posterPath: '' },
                  { tmdbId: 1182, title: 'Keyboard Two', year: 2002, posterPath: '' }
                ]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            if (url.includes('/functions/v1/tmdb-suggest')) {
              return Promise.resolve(new Response(JSON.stringify({ results: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "autocomplete-keyboard", {
      ranking: [movie("Alpha", 1990, 1180), movie("Beta", 2000, 1183)],
    });
    await page.evaluate(`(() => {
      const input = document.querySelector('#title');
      input.focus();
      input.value = 'Keyboard';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#suggestions .suggestions__item').length === 2`, 3000);
    for (const key of ["ArrowDown", "ArrowDown"]) {
      await page.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: key,
      });
      await page.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key,
      });
    }
    const active = await page.evaluate(
      `document.querySelector('#suggestions .suggestions__item.is-active .suggestions__title')?.textContent.trim()`,
    );
    if (active !== "Keyboard Two") {
      throw new Error(`Arrow keys selected the wrong autocomplete result: ${active}`);
    }
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await waitFor(
      page,
      `!document.querySelector('#compare')?.classList.contains('panel--hidden') &&
        document.querySelector('#new-title')?.textContent.trim() === 'Keyboard Two'`,
      3000,
    );
    const selected = await page.evaluate(`(() => ({
      inputValue: document.querySelector('#title')?.value,
      suggestionCount: document.querySelectorAll('#suggestions .suggestions__item').length,
      newTitle: document.querySelector('#new-title')?.textContent.trim(),
      comparing: document.body.classList.contains('is-comparing')
    }))()`);
    if (
      selected.inputValue !== "Keyboard Two" ||
      selected.suggestionCount !== 0 ||
      selected.newTitle !== "Keyboard Two" ||
      !selected.comparing
    ) {
      throw new Error(`Keyboard selection did not start the chosen ranking: ${JSON.stringify(selected)}`);
    }
    const selectedShot = await page.screenshot("autocomplete-keyboard-selected.png");
    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(page, `document.querySelector('#compare')?.classList.contains('panel--hidden')`, 3000);
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return { details: { active, selected }, screenshots: [selectedShot] };
  } finally {
    await page.close();
  }
};

const testComparisonResponsiveLayouts = async ({ baseUrl }) => {
  const runViewport = async ({ name, width, height, orientation }) => {
    const page = await openChromePage({ name, width, height });
    try {
      await seedPage(page, baseUrl, name, {
        ranking: [movie("Alpha", 1990, 1190), movie("Beta", 2000, 1191), movie("Gamma", 2010, 1192)],
        watchList: [queueMovie("Responsive Choice", 2024, 1193)],
      });
      await page.evaluate(`document.querySelector('#watch-list .queue-list__item')?.click(); true;`);
      await waitFor(page, `document.body.classList.contains('is-comparing')`, 3000);
      await wait(450);
      const layout = await page.evaluate(`(() => {
        const rect = (selector) => {
          const value = document.querySelector(selector)?.getBoundingClientRect();
          return value ? {
            left: Math.round(value.left),
            top: Math.round(value.top),
            right: Math.round(value.right),
            bottom: Math.round(value.bottom),
            width: Math.round(value.width),
            height: Math.round(value.height)
          } : null;
        };
        const first = rect('#new-card');
        const second = rect('#existing-card');
        const controls = rect('.compare__controls');
        const within = (value) => !!value &&
          value.left >= -1 && value.top >= -1 &&
          value.right <= innerWidth + 1 && value.bottom <= innerHeight + 1;
        const overlap = !!first && !!second &&
          first.left < second.right && first.right > second.left &&
          first.top < second.bottom && first.bottom > second.top;
        return {
          innerWidth,
          innerHeight,
          first,
          second,
          controls,
          allWithinViewport: within(first) && within(second) && within(controls),
          overlap,
          bodyClass: document.body.className
        };
      })()`);
      const isExpectedArrangement =
        orientation === "portrait"
          ? layout.second?.top >= layout.first?.bottom - 1
          : layout.second?.left >= layout.first?.right - 1;
      if (
        !layout.allWithinViewport ||
        layout.overlap ||
        !isExpectedArrangement ||
        layout.first?.width < 140 ||
        layout.first?.height < 100
      ) {
        throw new Error(`${orientation} comparison layout failed: ${JSON.stringify(layout)}`);
      }
      const health = await pageHealth(page);
      if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
      return {
        layout,
        screenshot: await page.screenshot(`comparison-${orientation}.png`),
      };
    } finally {
      await page.close();
    }
  };

  const portrait = await runViewport({
    name: "comparison-portrait",
    width: 390,
    height: 844,
    orientation: "portrait",
  });
  const landscape = await runViewport({
    name: "comparison-landscape",
    width: 844,
    height: 390,
    orientation: "landscape",
  });
  return {
    details: { portrait: portrait.layout, landscape: landscape.layout },
    screenshots: [portrait.screenshot, landscape.screenshot],
  };
};

const testShareStudio = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "share-studio" });
  try {
    await seedPage(page, baseUrl, "share-studio", {
      ranking: [movie("Solo", 1999, 1201)],
    });
    const opened = await page.evaluate(`(() => {
      document.querySelector('#share-list')?.click();
      return !document.querySelector('#share-studio')?.hidden;
    })()`);
    if (!opened) throw new Error("Share Studio did not open");
    await waitFor(page, `!!document.querySelector('#share-preview svg')`, 5000);
    const singleShot = await page.screenshot("share-studio-single.png");
    const singleState = await page.evaluate(`(() => ({
      previewSvg: !!document.querySelector('#share-preview svg'),
      bottomDisabled: !!document.querySelector('#share-include-bottom')?.disabled,
      queuesDisabled: !!document.querySelector('#share-include-queues')?.disabled,
      packsDisabled: !!document.querySelector('#share-include-packs')?.disabled,
      pngText: document.querySelector('#share-download-png')?.textContent.trim()
    }))()`);
    if (!singleState.previewSvg) throw new Error("Single-image Share preview did not render an SVG");
    if (!singleState.bottomDisabled || !singleState.queuesDisabled || !singleState.packsDisabled) {
      throw new Error(`Expected empty include toggles to be disabled: ${JSON.stringify(singleState)}`);
    }
    await page.evaluate(`document.querySelector('#share-preview svg')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    ); true;`);
    await waitFor(page, `!document.querySelector('#share-lightbox')?.hidden`, 3000);
    const singleLightbox = await page.evaluate(`(() => ({
      shareMode: document.querySelector('#share-lightbox')?.classList.contains('is-share'),
      setMode: document.querySelector('#share-lightbox')?.classList.contains('is-set'),
      imageSvg: !!document.querySelector('#share-lightbox-image svg'),
      caption: document.querySelector('#share-lightbox-caption')?.textContent.trim(),
      downloadHidden: document.querySelector('#share-lightbox-download')?.hidden,
      backgroundInert: document.querySelector('#share-studio')?.inert
    }))()`);
    if (
      !singleLightbox.shareMode ||
      singleLightbox.setMode ||
      !singleLightbox.imageSvg ||
      singleLightbox.caption ||
      singleLightbox.downloadHidden ||
      !singleLightbox.backgroundInert
    ) {
      throw new Error(`Single-image lightbox state is wrong: ${JSON.stringify(singleLightbox)}`);
    }
    await page.evaluate(`document.querySelector('#share-lightbox-image')?.click(); true;`);
    await waitFor(page, `document.querySelector('#share-lightbox')?.classList.contains('is-zoomed')`, 2000);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
    });
    await waitFor(page, `document.querySelector('#share-lightbox')?.hidden`, 2000);

    await page.evaluate(`document.querySelector('input[name="share-format"][value="set"]')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#share-preview figure svg').length >= 1`, 5000);
    const setState = await page.evaluate(`(() => ({
      cardCount: document.querySelectorAll('#share-preview figure svg').length,
      shapeHidden: !!document.querySelector('#share-shape-fieldset')?.hidden,
      pngText: document.querySelector('#share-download-png')?.textContent.trim(),
      svgText: document.querySelector('#share-download-svg')?.textContent.trim()
    }))()`);
    if (!setState.shapeHidden) throw new Error("Shape controls should hide for Image set format");
    if (setState.cardCount < 1) throw new Error("Image set preview did not render cards");
    await page.evaluate(`document.querySelector('#share-preview .share-preview-card')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#share-lightbox')?.hidden &&
        document.querySelector('#share-lightbox')?.classList.contains('is-set')`,
      3000,
    );
    const setLightboxStart = await page.evaluate(`(() => ({
      caption: document.querySelector('#share-lightbox-caption')?.textContent.trim(),
      prevDisabled: document.querySelector('#share-lightbox-prev')?.disabled,
      nextDisabled: document.querySelector('#share-lightbox-next')?.disabled,
      imageSvg: !!document.querySelector('#share-lightbox-image svg')
    }))()`);
    if (
      !setLightboxStart.caption.startsWith(`1/${setState.cardCount}`) ||
      !setLightboxStart.prevDisabled ||
      setLightboxStart.nextDisabled ||
      !setLightboxStart.imageSvg
    ) {
      throw new Error(`Image-set lightbox did not open on page 1: ${JSON.stringify(setLightboxStart)}`);
    }
    await page.evaluate(`document.querySelector('#share-lightbox-next')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#share-lightbox-caption')?.textContent.trim().startsWith('2/${setState.cardCount}')`,
      2000,
    );
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowRight",
      code: "ArrowRight",
    });
    await waitFor(
      page,
      `document.querySelector('#share-lightbox-caption')?.textContent.trim().startsWith('3/${setState.cardCount}')`,
      2000,
    );
    if (setState.cardCount >= 4) {
      await page.evaluate(`(() => {
        const stage = document.querySelector('#share-lightbox-stage');
        stage.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 17,
          clientX: 320,
          clientY: 300
        }));
        stage.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 17,
          clientX: 180,
          clientY: 305
        }));
        return true;
      })()`);
      await waitFor(
        page,
        `document.querySelector('#share-lightbox-caption')?.textContent.trim().startsWith('4/${setState.cardCount}')`,
        2000,
      );
      // Pointer-event injection does not synthesize the trailing click a real
      // swipe produces. Send it explicitly so the lightbox clears its
      // post-swipe tap suppression before testing zoom.
      await page.evaluate(`document.querySelector('#share-lightbox-image')?.click(); true;`);
    }
    await page.evaluate(`document.querySelector('#share-lightbox-image')?.click(); true;`);
    await waitFor(page, `document.querySelector('#share-lightbox')?.classList.contains('is-zoomed')`, 2000);
    const zoomedCaption = await page.evaluate(
      `document.querySelector('#share-lightbox-caption')?.textContent.trim()`,
    );
    await page.evaluate(`(() => {
      const stage = document.querySelector('#share-lightbox-stage');
      stage.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 18,
        clientX: 320,
        clientY: 300
      }));
      stage.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 18,
        clientX: 180,
        clientY: 305
      }));
      return true;
    })()`);
    const captionAfterZoomedSwipe = await page.evaluate(
      `document.querySelector('#share-lightbox-caption')?.textContent.trim()`,
    );
    if (captionAfterZoomedSwipe !== zoomedCaption) {
      throw new Error(
        `Zoomed lightbox should pan instead of paging: ${zoomedCaption} -> ${captionAfterZoomedSwipe}`,
      );
    }
    await page.evaluate(`document.querySelector('#share-lightbox-image')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#share-lightbox')?.classList.contains('is-zoomed')`,
      2000,
    );
    const lightboxShot = await page.screenshot("share-lightbox-set.png");
    await page.evaluate(`document.querySelector('#share-lightbox-download')?.click(); true;`);
    let pageDownload = null;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const files = fs.existsSync(page.downloadDir)
        ? fs.readdirSync(page.downloadDir).filter((name) => name.endsWith(".png") && !name.endsWith(".crdownload"))
        : [];
      if (files.length && fs.statSync(path.join(page.downloadDir, files[0])).size > 1000) {
        pageDownload = files[0];
        break;
      }
      await wait(100);
    }
    if (!pageDownload || fs.statSync(path.join(page.downloadDir, pageDownload)).size < 1000) {
      throw new Error(`Lightbox page download was not created: ${pageDownload || "missing"}`);
    }
    const setLightboxEnd = await page.evaluate(`(() => ({
      caption: document.querySelector('#share-lightbox-caption')?.textContent.trim(),
      status: document.querySelector('#share-export-status')?.textContent.trim(),
      feedback: document.querySelector('#add-feedback')?.textContent.trim(),
      zoomed: document.querySelector('#share-lightbox')?.classList.contains('is-zoomed')
    }))()`);
    if (
      !setLightboxEnd.status.includes("Downloaded page") &&
      !setLightboxEnd.feedback.includes("Downloaded page")
    ) {
      throw new Error(`Lightbox page download gave no success feedback: ${JSON.stringify(setLightboxEnd)}`);
    }
    await page.evaluate(`document.querySelector('#share-lightbox-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#share-lightbox')?.hidden`, 2000);
    const previewSync = await page.evaluate(`(() => ({
      page: document.querySelector('[data-share-page-label]')?.textContent.trim(),
      caption: document.querySelector('[data-share-active-name]')?.textContent.trim()
    }))()`);
    const expectedPage = setLightboxEnd.caption.split("/")[0];
    if (!previewSync.page.startsWith(`${expectedPage}/`) || !previewSync.caption) {
      throw new Error(`Closing the lightbox did not sync the preview deck: ${JSON.stringify(previewSync)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: {
        singleState,
        singleLightbox,
        setState,
        setLightboxStart,
        setLightboxEnd,
        pageDownload,
        previewSync,
      },
      screenshots: [singleShot, await page.screenshot("share-studio-set.png"), lightboxShot],
    };
  } finally {
    await page.close();
  }
};

const testBackupAndImport = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "backup-import" });
  try {
    await seedPage(page, baseUrl, "backup-import", {
      ranking: [movie("Alpha", 1990, 1301), movie("Beta", 2000, 1302)],
      watchList: [
        queueMovie("Spirited Away", 2001, 129),
        queueMovie("Delta", 2020, 1304),
      ],
    });
    await page.evaluate(`(() => {
      const realFetch = window.fetch.bind(window);
      const fixtures = {
        "The Godfather": [
          { tmdbId: 238, title: "The Godfather", year: 1972, posterPath: "" }
        ],
        "Heat": [
          { tmdbId: 949, title: "Heat", year: 1995, posterPath: "" },
          { tmdbId: 1305, title: "Heat", year: 1986, posterPath: "" }
        ],
        "Spirited Away": [
          { tmdbId: 129, title: "Spirited Away", year: 2001, posterPath: "" }
        ]
      };
      window.fetch = (input, options) => {
        const url = String(input);
        if (url.includes('/functions/v1/tmdb-search')) {
          const query = new URL(url).searchParams.get('q') || '';
          return Promise.resolve(new Response(JSON.stringify({ results: fixtures[query] || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return realFetch(input, options);
      };
      document.querySelector('#ranking-settings-toggle')?.click();
      document.querySelector('#open-title-import')?.click();
      const input = document.querySelector('#title-import-input');
      input.value = '1. The Godfather (1972)\\n2. Heat\\n3. Spirited Away (2001)';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#title-import-match')?.click();
      return true;
    })()`);
    await waitFor(page, `!document.querySelector('#title-import-review')?.hidden`, 5000);
    const reviewState = await page.evaluate(`(() => ({
      summary: document.querySelector('#title-import-summary')?.textContent.trim(),
      unresolved: document.querySelectorAll('#title-import-matches .is-unresolved').length,
      confirmHidden: !!document.querySelector('#title-import-confirm-wrap')?.hidden,
      applyDisabled: !!document.querySelector('#title-import-apply')?.disabled
    }))()`);
    // "Heat" (no year, two results) now auto-resolves to the most-popular result as
    // a flagged "best guess" rather than forcing manual disambiguation, so nothing
    // is unresolved — but replacing a non-empty ranking still requires consent.
    if (
      reviewState.unresolved !== 0 ||
      !/best guess/i.test(reviewState.summary || "") ||
      reviewState.confirmHidden ||
      !reviewState.applyDisabled
    ) {
      throw new Error(`Import review state unexpected: ${JSON.stringify(reviewState)}`);
    }
    const reviewShot = await page.screenshot("backup-import-review.png");

    await page.evaluate(`(() => {
      // Override the best guess to the 1986 result to exercise manual selection.
      const heat = document.querySelector('select[aria-label="TMDB match for Heat"]');
      heat.value = '1305';
      heat.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#title-import-confirm')?.click();
      return true;
    })()`);
    await waitFor(page, `!document.querySelector('#title-import-apply')?.disabled`, 3000);
    await page.evaluate(`document.querySelector('#title-import-apply')?.click(); true;`);
    await waitFor(page, `document.querySelector('#title-import')?.hidden`, 5000);
    const imported = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      watchTitles: [...document.querySelectorAll('#watch-list .queue-list__title')].map((el) => el.textContent.trim()),
      storedTitles: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.map((movie) => movie.title) || []
    }))()`);
    if (imported.rankingTitles.join("|") !== "The Godfather|Heat|Spirited Away") {
      throw new Error(`Imported ranking order is wrong: ${imported.rankingTitles.join(", ")}`);
    }
    if (imported.watchTitles.join("|") !== "Delta") {
      throw new Error(`Imported ranked movies were not removed from Watch next: ${imported.watchTitles.join(", ")}`);
    }
    if (imported.storedTitles.join("|") !== "The Godfather|Heat|Spirited Away") {
      throw new Error(`Exact imported ranking was not saved locally: ${imported.storedTitles.join(", ")}`);
    }

    const backup = {
      kind: "stackrank-backup",
      version: 1,
      exportedAt: "2026-06-27T15:00:00.000Z",
      ranking: [movie("Restored One", 1988, 1310)],
      queues: {
        watch: [queueMovie("Restored Watch", 1999, 1311)],
        notInterested: [{ ...queueMovie("Restored Hidden", 2009, 1312), hiddenAt: "2026-06-20T13:30:00.000Z" }]
      },
      packProgress: {},
      shareOptions: { version: 7, theme: "cinema", tone: "punchy" }
    };
    await page.evaluate(`(() => {
      window.confirm = () => true;
      document.querySelector('#ranking-settings-toggle')?.click();
      const file = new File([${JSON.stringify(JSON.stringify(backup))}], 'stackrank-backup.json', {
        type: 'application/json'
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector('#backup-file-input');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#ranking .ranking__title')?.textContent.includes('Restored One')`,
      5000,
    );
    const restored = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      watchTitles: [...document.querySelectorAll('#watch-list .queue-list__title')].map((el) => el.textContent.trim()),
      hiddenTitles: [...document.querySelectorAll('#not-interested-list .queue-list__title')].map((el) => el.textContent.trim()),
      shareTheme: JSON.parse(localStorage.getItem('stackrank:share-options:v1') || '{}').theme
    }))()`);
    if (restored.rankingTitles.join("|") !== "Restored One") {
      throw new Error(`Backup ranking did not restore exactly: ${restored.rankingTitles.join(", ")}`);
    }
    if (restored.watchTitles.join("|") !== "Restored Watch" || restored.hiddenTitles.join("|") !== "Restored Hidden") {
      throw new Error(`Backup queues did not restore: ${JSON.stringify(restored)}`);
    }
    if (restored.shareTheme !== "cinema") {
      throw new Error(`Backup Share Studio settings did not restore: ${restored.shareTheme}`);
    }

    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(
      page,
      `document.querySelector('#ranking .ranking__title')?.textContent.includes('Restored One')`,
      10000,
    );
    const afterReload = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      watchRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      hiddenRows: document.querySelectorAll('#not-interested-list .queue-list__item').length
    }))()`);
    if (afterReload.rankingTitles.join("|") !== "Restored One" || afterReload.watchRows !== 1 || afterReload.hiddenRows !== 1) {
      throw new Error(`Restored backup did not persist through reload: ${JSON.stringify(afterReload)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { reviewState, imported, restored, afterReload },
      screenshots: [reviewShot, await page.screenshot("backup-restore-complete.png")],
    };
  } finally {
    await page.close();
  }
};

const testBackupAndImageDownloads = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "downloads" });
  try {
    await seedPage(page, baseUrl, "downloads", {
      ranking: [
        movie("Alpha", 1980, 1401),
        movie("Beta", 1990, 1402),
        movie("Gamma", 2000, 1403),
        movie("Delta", 2010, 1404),
        movie("Epsilon", 2020, 1405),
        movie("Zeta", 2024, 1406),
      ],
      watchList: [queueMovie("Saved One", 2025, 1407)],
      notInterestedList: [{ ...queueMovie("Hidden One", 1975, 1408), hiddenAt: "2026-06-20T13:30:00.000Z" }],
    });
    await page.evaluate(`(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url.includes('/functions/v1/tmdb-detail')) {
          const id = Number(new URL(url).searchParams.get('id'));
          return Promise.resolve(new Response(JSON.stringify({
            result: {
              tmdbId: id,
              runtime: 110,
              genres: ['Drama'],
              director: 'E2E Director',
              cast: ['E2E Actor']
            }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (url.includes('/functions/v1/tmdb-suggest')) {
          return Promise.resolve(new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return realFetch(input, options);
      };
      return true;
    })()`);

    await page.evaluate(`(() => {
      document.querySelector('#ranking-settings-toggle')?.click();
      document.querySelector('#download-backup')?.click();
      return true;
    })()`);
    const backupName = `stackrank-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const backupPath = await waitForDownload(page, backupName);
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    if (
      backup.kind !== "stackrank-backup" ||
      backup.version !== 1 ||
      backup.ranking?.length !== 6 ||
      backup.queues?.watch?.length !== 1 ||
      backup.queues?.notInterested?.length !== 1
    ) {
      throw new Error(`Downloaded backup is incomplete: ${JSON.stringify(backup)}`);
    }

    await page.evaluate(`(() => {
      document.querySelector('#ranking-settings-close')?.click();
      document.querySelector('#share-list')?.click();
      return true;
    })()`);
    await waitFor(page, `!!document.querySelector('#share-preview svg')`, 5000);
    await page.evaluate(`document.querySelector('#share-download-png')?.click(); true;`);
    const pngPath = await waitForDownload(page, "stackrank-movies.png", 45000);
    const png = fs.readFileSync(pngPath);
    if (!startsWithBytes(png, [137, 80, 78, 71, 13, 10, 26, 10]) || png.length < 2000) {
      throw new Error(`Downloaded PNG is invalid or unexpectedly small: ${png.length} bytes`);
    }

    await page.evaluate(`document.querySelector('input[name="share-format"][value="set"]')?.click(); true;`);
    const cardCount = await waitFor(
      page,
      `document.querySelectorAll('#share-preview figure svg').length >= 2 &&
        document.querySelectorAll('#share-preview figure svg').length`,
      5000,
    );
    await page.evaluate(`document.querySelector('#share-download-png')?.click(); true;`);
    const zipPath = await waitForDownload(page, "stackrank-share-images.zip", 60000);
    const zip = fs.readFileSync(zipPath);
    const zipText = zip.toString("latin1");
    const pngNames = [...zipText.matchAll(/stackrank-[a-z0-9-]+\.png/g)].map((match) => match[0]);
    const uniquePngNames = [...new Set(pngNames)];
    if (
      !startsWithBytes(zip, [0x50, 0x4b, 0x03, 0x04]) ||
      !zipText.includes("PK\u0005\u0006") ||
      uniquePngNames.length < 2
    ) {
      throw new Error(
        `Downloaded ZIP is invalid: ${zip.length} bytes, entries=${uniquePngNames.join(",")}`,
      );
    }

    const state = {
      backupBytes: fs.statSync(backupPath).size,
      pngBytes: png.length,
      zipBytes: zip.length,
      cardCount,
      zipEntries: uniquePngNames,
    };
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: state,
      screenshots: [await page.screenshot("share-downloads-complete.png")],
    };
  } finally {
    await page.close();
  }
};

const testSignedInSupabaseMergeAndSave = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "supabase-merge-save" });
  const userId = "e2e-user";
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "e2e@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-06-20T12:00:00.000Z",
  };
  const jwtHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const jwtPayload = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const accessToken = `${jwtHeader}.${jwtPayload}.e2e-signature`;
  const authSession = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh-token",
    user,
  };
  const remoteRanking = [
    movie("Remote First", 1985, 1501),
    movie("Shared", 1995, 1502),
  ];
  const localRanking = [
    movie("Shared", 1995, 1502),
    movie("Local Only", 2005, 1503),
  ];
  const localQueue = [queueMovie("Remote Retry", 2015, 1504)];
  const localPackProgress = {
    "year-1999": {
      startedAt: "2026-06-20T10:00:00.000Z",
      packVersionSeen: 1,
      lastIndex: 1,
      updated_at: "2026-06-20T10:00:00.000Z",
    },
  };
  const remotePackProgress = {
    startedAt: "2026-06-21T10:00:00.000Z",
    packVersionSeen: 1,
    lastIndex: 4,
  };
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const authKey = 'sb-hrfhakrxsllrqmscxxpb-auth-token';
          const authSession = ${JSON.stringify(authSession)};
          if (!localStorage.getItem(authKey)) {
            localStorage.setItem(authKey, JSON.stringify(authSession));
          }
          const realFetch = window.fetch.bind(window);
          window.__e2eSupabaseRequests = [];
          window.__e2eRejectRemoteWrites = false;
          const jsonResponse = (value, status = 200, extraHeaders = {}) =>
            new Response(JSON.stringify(value), {
              status,
              headers: {
                'Content-Type': 'application/json',
                ...extraHeaders
              }
            });
          window.fetch = async (input, options = {}) => {
            const request = input instanceof Request ? input.clone() : new Request(input, options);
            const url = request.url;
            if (!url.startsWith('https://hrfhakrxsllrqmscxxpb.supabase.co/')) {
              return realFetch(input, options);
            }
            const method = request.method || 'GET';
            const body = method === 'GET' || method === 'HEAD' ? '' : await request.clone().text();
            window.__e2eSupabaseRequests.push({
              url,
              method,
              body,
              authorization: request.headers.get('authorization') || ''
            });
            if (window.__e2eRejectRemoteWrites && method !== 'GET') {
              return Promise.reject(new TypeError('Simulated offline write'));
            }
            if (url.includes('/auth/v1/user')) return jsonResponse(${JSON.stringify(user)});
            if (url.includes('/auth/v1/token')) return jsonResponse(${JSON.stringify(authSession)});
            if (url.includes('/rest/v1/rankings')) {
              if (method === 'GET') {
                const row = {
                  movies: ${JSON.stringify(remoteRanking)},
                  updated_at: '2026-06-21T14:00:00.000Z'
                };
                const accept = request.headers.get('accept') || '';
                return jsonResponse(accept.includes('object+json') ? row : [row], 200, {
                  'Content-Range': '0-0/1'
                });
              }
              return new Response(null, { status: 201 });
            }
            if (url.includes('/rest/v1/pack_progress')) {
              if (method === 'GET') {
                return jsonResponse([{
                  pack_slug: 'director-wes-anderson',
                  state: ${JSON.stringify(remotePackProgress)},
                  updated_at: '2026-06-21T14:00:00.000Z'
                }], 200, { 'Content-Range': '0-0/1' });
              }
              return new Response(null, { status: 201 });
            }
            if (
              url.includes('/rest/v1/movie_lists') ||
              url.includes('/rest/v1/suggestion_packs')
            ) {
              if (method === 'GET') {
                return jsonResponse([], 200, { 'Content-Range': '*/0' });
              }
              return new Response(null, { status: 201 });
            }
            if (url.includes('/functions/v1/tmdb-suggest')) {
              return jsonResponse({ results: [] });
            }
            if (url.includes('/functions/v1/tmdb-')) {
              return jsonResponse({ results: [] });
            }
            return jsonResponse({});
          };
        })();
      `,
    });
    await page.send("Page.navigate", { url: `${baseUrl}/missing-e2e-seed` });
    await waitFor(page, "document.readyState === 'complete'", 5000);
    await page.evaluate(`
      localStorage.clear();
      localStorage.setItem(
        'sb-hrfhakrxsllrqmscxxpb-auth-token',
        ${JSON.stringify(JSON.stringify(authSession))}
      );
      localStorage.setItem(
        'stackrank:movies:v1',
        ${JSON.stringify(
          JSON.stringify({
            movies: localRanking,
            updated_at: "2026-06-20T14:00:00.000Z",
          }),
        )}
      );
      localStorage.setItem(
        'stackrank:suggestion-queues:v1',
        ${JSON.stringify(
          JSON.stringify({
            watchList: localQueue,
            notInterestedList: [],
            updated_at: "2026-06-20T14:00:00.000Z",
          }),
        )}
      );
      localStorage.setItem(
        'stackrank:pack-progress:v1:user:${userId}',
        ${JSON.stringify(JSON.stringify({ progress: localPackProgress }))}
      );
      true;
    `);
    page.events.length = 0;
    await page.send("Page.navigate", { url: `${baseUrl}/?e2e=supabase-merge-save` });
    await waitFor(
      page,
      `(() => {
        const titles = [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim());
        return titles.join('|') === 'Remote First|Shared|Local Only' &&
          document.querySelector('#settings-auth-state')?.textContent.includes('e2e@example.test');
      })()`,
      12000,
    );
    await waitFor(
      page,
      `window.__e2eSupabaseRequests?.some((request) =>
        request.method === 'POST' && request.url.includes('/rest/v1/rankings')
      )`,
      5000,
    );
    const state = await page.evaluate(`(() => {
      const rankingWrites = (window.__e2eSupabaseRequests || [])
        .filter((request) => request.method === 'POST' && request.url.includes('/rest/v1/rankings'))
        .map((request) => ({
          ...request,
          parsedBody: request.body ? JSON.parse(request.body) : null
        }));
      const lastWrite = rankingWrites.at(-1) || null;
      const payload = Array.isArray(lastWrite?.parsedBody) ? lastWrite.parsedBody[0] : lastWrite?.parsedBody;
      return {
        rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) =>
          el.textContent.replace(/^\\d+\\.\\s*/, '').trim()
        ),
        storedTitles: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.map((entry) => entry.title) || [],
        authState: document.querySelector('#settings-auth-state')?.textContent.trim(),
        rankingGetCount: (window.__e2eSupabaseRequests || []).filter((request) =>
          request.method === 'GET' && request.url.includes('/rest/v1/rankings')
        ).length,
        rankingWriteCount: rankingWrites.length,
        writeListId: payload?.list_id || null,
        writeTitles: payload?.movies?.map((entry) => entry.title) || [],
        writeAuthorized: !!lastWrite?.authorization?.startsWith('Bearer '),
        packProgress: JSON.parse(localStorage.getItem(
          'stackrank:pack-progress:v1:user:${userId}'
        ) || '{}').progress || {},
        packProgressGetCount: (window.__e2eSupabaseRequests || []).filter((request) =>
          request.method === 'GET' && request.url.includes('/rest/v1/pack_progress')
        ).length
      };
    })()`);
    const expectedTitles = "Remote First|Shared|Local Only";
    if (
      state.rankingTitles.join("|") !== expectedTitles ||
      state.storedTitles.join("|") !== expectedTitles ||
      state.rankingGetCount < 1 ||
      state.rankingWriteCount < 1 ||
      state.writeListId !== `user:${userId}` ||
      state.writeTitles.join("|") !== expectedTitles ||
      !state.writeAuthorized ||
      state.packProgressGetCount < 1 ||
      state.packProgress["director-wes-anderson"]?.lastIndex !== 4 ||
      state.packProgress["year-1999"]?.lastIndex !== 1
    ) {
      throw new Error(`Signed-in merge/save adapter failed: ${JSON.stringify(state)}`);
    }

    await page.evaluate(`(() => {
      Math.random = () => 0.5;
      document.querySelector('#pack-row [data-slug="director-wes-anderson"]')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-title')?.textContent.trim() === 'Wes Anderson Filmography'`,
      5000,
    );
    await page.evaluate(`document.querySelector('#pack-auto-start')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#compare')?.classList.contains('panel--hidden')`,
      3000,
    );
    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-title')?.textContent.trim() === 'Wes Anderson Filmography'`,
      3000,
    );
    await waitFor(
      page,
      `window.__e2eSupabaseRequests?.some((request) =>
        request.method === 'POST' && request.url.includes('/rest/v1/pack_progress')
      )`,
      3000,
    );
    const packWrite = await page.evaluate(`(() => {
      const writes = (window.__e2eSupabaseRequests || []).filter((request) =>
        request.method === 'POST' && request.url.includes('/rest/v1/pack_progress')
      );
      const last = writes.at(-1) || null;
      const parsed = last?.body ? JSON.parse(last.body) : null;
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      return {
        count: writes.length,
        listId: payload?.list_id || null,
        slug: payload?.pack_slug || null,
        lastIndex: payload?.state?.lastIndex,
        authorized: !!last?.authorization?.startsWith('Bearer ')
      };
    })()`);
    if (
      packWrite.count < 1 ||
      packWrite.listId !== `user:${userId}` ||
      packWrite.slug !== "director-wes-anderson" ||
      packWrite.lastIndex !== 4 ||
      !packWrite.authorized
    ) {
      throw new Error(`Signed-in pack progress write failed: ${JSON.stringify(packWrite)}`);
    }
    await page.evaluate(`document.querySelector('#pack-detail-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#pack-detail')?.hidden`, 3000);

    await page.evaluate(`(() => {
      window.__e2eRejectRemoteWrites = true;
      document.querySelector('#watch-list .queue-action[data-action="move"]')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `(() => {
        const payload = JSON.parse(localStorage.getItem(
          'stackrank:suggestion-queues:v1:user:${userId}'
        ) || '{}');
        return payload.watchList?.length === 0 &&
          payload.notInterestedList?.[0]?.title === 'Remote Retry' &&
          document.querySelector('#api-status')?.textContent.includes('Sync is temporarily unavailable');
      })()`,
      5000,
    );
    const offlineWrite = await page.evaluate(`(() => {
      const payload = JSON.parse(localStorage.getItem(
        'stackrank:suggestion-queues:v1:user:${userId}'
      ) || '{}');
      return {
        watchTitles: payload.watchList?.map((entry) => entry.title) || [],
        hiddenTitles: payload.notInterestedList?.map((entry) => entry.title) || [],
        status: document.querySelector('#api-status')?.textContent.trim(),
        hiddenRows: document.querySelectorAll('#not-interested-list .queue-list__item').length
      };
    })()`);

    await page.evaluate(`(() => {
      window.__e2eRejectRemoteWrites = false;
      document.querySelector('#not-interested-list .queue-action[data-action="move"]')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#api-status')?.textContent.includes('Syncing enabled') &&
        document.querySelectorAll('#watch-list .queue-list__item').length === 1`,
      5000,
    );
    const recoveredWrite = await page.evaluate(`(() => ({
      status: document.querySelector('#api-status')?.textContent.trim(),
      watchRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      hiddenRows: document.querySelectorAll('#not-interested-list .queue-list__item').length
    }))()`);
    if (
      offlineWrite.watchTitles.length ||
      offlineWrite.hiddenTitles.join("|") !== "Remote Retry" ||
      offlineWrite.hiddenRows !== 1 ||
      !offlineWrite.status.includes("saved on this device") ||
      recoveredWrite.watchRows !== 1 ||
      recoveredWrite.hiddenRows !== 0 ||
      !recoveredWrite.status.includes("Syncing enabled")
    ) {
      throw new Error(
        `Signed-in offline write recovery failed: ${JSON.stringify({ offlineWrite, recoveredWrite })}`,
      );
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { state, packWrite, offlineWrite, recoveredWrite },
      screenshots: [await page.screenshot("supabase-merge-save.png")],
    };
  } finally {
    await page.close();
  }
};

const testFullscreenRankingInteractions = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "fullscreen-ranking", width: 1280, height: 900 });
  try {
    await seedPage(page, baseUrl, "fullscreen-ranking", {
      ranking: [
        movie("Alpha", 1990, 2001),
        movie("Beta", 1995, 2002),
        movie("Gamma", 2000, 2003),
        movie("Delta", 2005, 2004),
        movie("Epsilon", 2010, 2005),
        movie("Zeta", 2015, 2006),
      ],
    });
    await page.evaluate(`(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const url = String(input);
        if (url.includes('/functions/v1/tmdb-detail')) {
          const id = Number(new URL(url).searchParams.get('id'));
          return Promise.resolve(new Response(JSON.stringify({
            result: { tmdbId: id, runtime: 120, genres: ['Drama'], director: 'Director', cast: ['Actor'] }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch(input, options);
      };
      window.confirm = () => true;
      document.querySelector('#ranking-expand')?.click();
      return true;
    })()`);
    await waitFor(page, `!document.querySelector('#ranking-fullscreen')?.hidden && document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 5000);
    const semantics = await page.evaluate(`(() => {
      const card = document.querySelector('#fullscreen-grid .fullscreen-card');
      const primary = card?.querySelector('.fullscreen-card__primary');
      return {
        cardRole: card?.getAttribute('role'),
        cardTabIndex: card?.getAttribute('tabindex'),
        primaryTag: primary?.tagName,
        primaryLabel: primary?.getAttribute('aria-label'),
        nestedControls: !!primary?.querySelector('button, [role="button"], [tabindex]'),
        backgroundInert: document.querySelector('.topbar')?.inert,
        fullscreenInert: document.querySelector('#ranking-fullscreen')?.inert
      };
    })()`);
    if (
      semantics.cardRole ||
      semantics.cardTabIndex ||
      semantics.primaryTag !== "BUTTON" ||
      !/^Open details for #1, Alpha$/.test(semantics.primaryLabel || "") ||
      semantics.nestedControls ||
      !semantics.backgroundInert ||
      semantics.fullscreenInert
    ) {
      throw new Error(`Full-screen semantics are wrong: ${JSON.stringify(semantics)}`);
    }

    await page.evaluate(`(() => {
      const input = document.querySelector('#fullscreen-search');
      input.value = 'Gamma';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 1`, 3000);
    const filtered = await page.evaluate(`(() => ({
      title: document.querySelector('.fullscreen-card__title')?.textContent.trim(),
      subtitle: document.querySelector('#fullscreen-sub')?.textContent.trim(),
      dragHandleVisible: getComputedStyle(document.querySelector('.fullscreen-card__drag-handle')).display !== 'none'
    }))()`);
    if (filtered.title !== "Gamma" || filtered.subtitle !== "1 of 6 movies" || filtered.dragHandleVisible) {
      throw new Error(`Full-screen filtering state is wrong: ${JSON.stringify(filtered)}`);
    }

    await page.evaluate(`(() => {
      document.querySelector('#fullscreen-search-clear')?.click();
      const density = document.querySelector('#fullscreen-density');
      density.value = 'compact';
      density.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelector('#fullscreen-grid')?.classList.contains('is-compact') && document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 3000);

    await page.evaluate(`document.querySelector('#fullscreen-grid .fullscreen-card__primary')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#movie-detail')?.hidden && document.querySelector('#detail-title')?.textContent.trim() === 'Alpha'`, 3000);
    const nestedModal = await page.evaluate(`(() => {
      const layer = document.querySelector('#movie-detail');
      const focusable = [...layer.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => !element.hidden && !element.closest('[hidden]') && element.getClientRects().length);
      const last = focusable.at(-1);
      last.focus();
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      return {
        fullscreenInert: document.querySelector('#ranking-fullscreen')?.inert,
        detailInert: document.querySelector('#movie-detail')?.inert,
        activeId: document.activeElement?.id
      };
    })()`);
    if (!nestedModal.fullscreenInert || nestedModal.detailInert || nestedModal.activeId !== "detail-close") {
      throw new Error(`Nested detail modal isolation is wrong: ${JSON.stringify(nestedModal)}`);
    }
    await page.evaluate(`document.querySelector('#detail-close')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#movie-detail')?.hidden &&
        !document.querySelector('#ranking-fullscreen')?.inert &&
        document.activeElement?.classList.contains('fullscreen-card__primary')`,
      3000,
    );

    await page.evaluate(`document.querySelector('.fullscreen-card[data-index="2"] [data-action="remove"]')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 5`, 3000);
    await page.evaluate(`document.querySelector('#add-feedback .feedback-toast__action')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 3000);

    await page.evaluate(`document.querySelector('.fullscreen-card[data-index="1"] [data-action="restack"]')?.click(); true;`);
    await waitFor(page, `document.querySelector('#ranking-fullscreen')?.hidden && !document.querySelector('#compare')?.classList.contains('panel--hidden')`, 3000);
    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(page, `document.querySelector('#compare')?.classList.contains('panel--hidden') && document.querySelectorAll('#ranking .ranking__item').length === 6`, 3000);
    await page.evaluate(`document.querySelector('#ranking-expand')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#ranking-fullscreen')?.hidden && document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 3000);

    const dragPoints = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('#fullscreen-grid .fullscreen-card')];
      const first = cards[0].getBoundingClientRect();
      const last = cards.at(-1).getBoundingClientRect();
      return {
        from: { x: first.left + first.width / 2, y: first.top + first.height / 2 },
        to: { x: last.left + last.width / 2, y: last.top + last.height / 2 }
      };
    })()`);
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: dragPoints.from.x,
      y: dragPoints.from.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: (dragPoints.from.x + dragPoints.to.x) / 2,
      y: (dragPoints.from.y + dragPoints.to.y) / 2,
      button: "left",
      buttons: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: dragPoints.to.x,
      y: dragPoints.to.y,
      button: "left",
      buttons: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: dragPoints.to.x,
      y: dragPoints.to.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')].at(-1)?.textContent.includes('Alpha')`,
      5000,
    );

    const state = await page.evaluate(`(() => ({
      overlayOpen: !document.querySelector('#ranking-fullscreen')?.hidden,
      gridTitles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')].map((el) => el.textContent.trim()),
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      compact: document.querySelector('#fullscreen-grid')?.classList.contains('is-compact'),
      focusedTitle: document.activeElement?.querySelector?.('.fullscreen-card__title')?.textContent.trim() || ''
    }))()`);
    if (
      !state.overlayOpen ||
      state.gridTitles.at(-1) !== "Alpha" ||
      state.rankingTitles.at(-1) !== "Alpha" ||
      !state.compact
    ) {
      throw new Error(`Full-screen drag did not persist the new order: ${JSON.stringify(state)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { semantics, nestedModal, filtered, state },
      screenshots: [await page.screenshot("fullscreen-ranking-interactions.png")],
    };
  } finally {
    await page.close();
  }
};

const testSuggestionExplanations = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "suggestion-explanations", width: 1280, height: 1000 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
          const fixtures = {
            recommendations: [
              { tmdbId: 2101, title: 'Future Signal', year: 2018, posterPath: '' },
              { tmdbId: 2102, title: 'Neon Chase', year: 2020, posterPath: '' },
              { tmdbId: 2103, title: 'Quiet Machine', year: 2016, posterPath: '' }
            ],
            essentials: [
              { tmdbId: 2201, title: 'Classic One', year: 1974, posterPath: '' },
              { tmdbId: 2202, title: 'Classic Two', year: 1982, posterPath: '' },
              { tmdbId: 2203, title: 'Classic Three', year: 1995, posterPath: '' }
            ],
            popular: [
              { tmdbId: 2301, title: 'Popular One', year: 2026, posterPath: '' },
              { tmdbId: 2302, title: 'Popular Two', year: 2026, posterPath: '' },
              { tmdbId: 2303, title: 'Popular Three', year: 2026, posterPath: '' },
              { tmdbId: 2304, title: 'Popular Four', year: 2026, posterPath: '' },
              { tmdbId: 2305, title: 'Popular Five', year: 2026, posterPath: '' },
              { tmdbId: 2306, title: 'Popular Six', year: 2026, posterPath: '' }
            ]
          };
          const detailGenres = {
            2101: ['Drama', 'Science Fiction'],
            2102: ['Action', 'Science Fiction'],
            2103: ['Science Fiction'],
            2201: ['Drama', 'Crime'],
            2202: ['Science Fiction'],
            2203: ['Animation'],
            2301: ['Action'],
            2302: ['Comedy'],
            2303: ['Horror'],
            2304: ['Mystery'],
            2305: ['Romance'],
            2306: ['Adventure']
          };
          window.__e2eSuggestionDetailCalls = [];
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tmdb-suggest')) {
              const type = new URL(url).searchParams.get('type') || 'popular';
              const results = type === 'recommendations' ? fixtures.recommendations : fixtures[type] || fixtures.popular;
              return Promise.resolve(new Response(JSON.stringify({ results }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            }
            if (url.includes('/functions/v1/tmdb-detail')) {
              const id = Number(new URL(url).searchParams.get('id'));
              window.__e2eSuggestionDetailCalls.push(id);
              return new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify({
                result: { tmdbId: id, genres: detailGenres[id] || [] }
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              })), 1500));
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "suggestion-explanations", {
      ranking: [
        {
          ...movie("The Matrix", 1999, 603),
          genres: ["Action", "Science Fiction"],
        },
      ],
    });
    await waitFor(page, `document.querySelectorAll('.suggest-name').length === 9`, 5000);
    const pending = await page.evaluate(`(() => ({
      count: document.querySelectorAll('.suggest-reason').length,
      pendingCount: document.querySelectorAll('.suggest-reason.is-pending').length,
      text: [...document.querySelectorAll('.suggest-reason__text')].map((el) => el.textContent.trim()),
      visibility: [...document.querySelectorAll('.suggest-reason')].map((el) => getComputedStyle(el).visibility),
      primaryCount: document.querySelectorAll('.suggest-card > .suggest-primary').length,
      rankActionCount: [...document.querySelectorAll('.suggest-card .movie-item__action')].filter((button) =>
        button.textContent.trim() === 'Rank'
      ).length,
      compositeCardCount: document.querySelectorAll('.suggest-card[role="button"], .suggest-card[tabindex]').length,
      detailCount: document.querySelectorAll('.suggest-card .suggest-info').length
    }))()`);
    if (
      pending.count !== 9 ||
      pending.pendingCount !== 9 ||
      pending.text.some(Boolean) ||
      pending.visibility.some((value) => value !== "hidden") ||
      pending.primaryCount !== 9 ||
      pending.rankActionCount !== 9 ||
      pending.compositeCardCount !== 0 ||
      pending.detailCount !== 9
    ) {
      throw new Error(`Pending reasons exposed fallback content: ${JSON.stringify(pending)}`);
    }
    await waitFor(
      page,
      `(() => document.querySelectorAll('.suggest-reason__text').length === 9 &&
        document.querySelector('#suggest-related .suggest-reason__text')?.textContent.includes('science fiction'))()`,
      10000,
    );
    const initial = await page.evaluate(`(() => ({
      relatedTitle: document.querySelector('#suggest-related-title')?.textContent.trim(),
      relatedSub: document.querySelector('#suggest-related-sub')?.textContent.trim(),
      relatedReasons: [...document.querySelectorAll('#suggest-related .suggest-reason__text')].map((el) => el.textContent.trim()),
      essentialReasons: [...document.querySelectorAll('#suggest-essentials .suggest-reason__text')].map((el) => el.textContent.trim()),
      popularReasons: [...document.querySelectorAll('#suggest-popular .suggest-reason__text')].map((el) => el.textContent.trim())
    }))()`);
    if (initial.relatedTitle !== "Inspired by The Matrix" || initial.relatedSub !== "Because it's #1 on your list.") {
      throw new Error(`Related explanation source is wrong: ${JSON.stringify(initial)}`);
    }
    if (initial.relatedReasons.some((reason) => !/Shares science fiction with The Matrix/.test(reason))) {
      throw new Error(`Related reasons are not specific and truthful: ${JSON.stringify(initial.relatedReasons)}`);
    }
    if (!initial.essentialReasons.includes("A 1970s crime essential")) {
      throw new Error(`Essential explanation is missing era/genre context: ${JSON.stringify(initial.essentialReasons)}`);
    }
    if (!initial.popularReasons.includes("Popular now · Horror")) {
      throw new Error(`Popular explanation is missing source/genre context: ${JSON.stringify(initial.popularReasons)}`);
    }

    await page.evaluate(`document.querySelector('#suggest-popular-more')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#suggest-popular .suggest-name')?.textContent.trim() === 'Popular Four'`,
      5000,
    );
    const refreshedPending = await page.evaluate(`(() => ({
      pendingCount: document.querySelectorAll('#suggest-popular .suggest-reason.is-pending').length,
      text: [...document.querySelectorAll('#suggest-popular .suggest-reason__text')].map((el) => el.textContent.trim())
    }))()`);
    if (refreshedPending.pendingCount !== 3 || refreshedPending.text.some(Boolean)) {
      throw new Error(`Refreshed reasons exposed fallback content: ${JSON.stringify(refreshedPending)}`);
    }
    try {
      await waitFor(
        page,
        `document.querySelector('#suggest-popular .suggest-reason__text')?.textContent.trim() === 'Popular now · Mystery'`,
        12000,
      );
    } catch (error) {
      const diagnostic = await page.evaluate(`(() => ({
        titles: [...document.querySelectorAll('#suggest-popular .suggest-name')].map((el) => el.textContent.trim()),
        reasons: [...document.querySelectorAll('#suggest-popular .suggest-reason__text')].map((el) => el.textContent.trim()),
        pending: document.querySelectorAll('#suggest-popular .suggest-reason.is-pending').length,
        detailCalls: window.__e2eSuggestionDetailCalls || []
      }))()`);
      throw new Error(`Refreshed suggestion reasons timed out: ${JSON.stringify(diagnostic)}\\n${error.message}`);
    }
    const refreshed = await page.evaluate(`(() => ({
      titles: [...document.querySelectorAll('#suggest-popular .suggest-name')].map((el) => el.textContent.trim()),
      reasons: [...document.querySelectorAll('#suggest-popular .suggest-reason__text')].map((el) => el.textContent.trim())
    }))()`);
    if (refreshed.titles[0] !== "Popular Four" || refreshed.reasons[0] !== "Popular now · Mystery") {
      throw new Error(`Refreshed cards did not receive refreshed explanations: ${JSON.stringify(refreshed)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { pending, initial, refreshedPending, refreshed },
      screenshots: [await page.screenshot("suggestion-explanations.png")],
    };
  } finally {
    await page.close();
  }
};

const testTasteExplorer = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "taste-explorer", width: 1280, height: 900 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const details = {
            3001: { genres: ['Drama'], director: 'Director One', cast: ['Actor One'] },
            3002: { genres: ['Crime'], director: 'Director Two', cast: ['Actor Two'] },
            3003: { genres: ['Drama'], director: 'Director One', cast: ['Actor Three'] },
            3004: { genres: ['Drama'], director: 'Director Three', cast: ['Actor One'] },
            3005: { genres: ['Drama'], director: 'Director Four', cast: ['Actor Four'] }
          };
          const realFetch = window.fetch.bind(window);
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tmdb-detail')) {
              const id = Number(new URL(url).searchParams.get('id'));
              return Promise.resolve(new Response(JSON.stringify({
                result: { tmdbId: id, runtime: 110, ...(details[id] || {}) }
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "taste-explorer", {
      ranking: [
        { ...movie("Alpha", 1960, 3001), genres: ["Drama"], director: "Director One", cast: ["Actor One"] },
        { ...movie("Beta", 1971, 3002), genres: ["Crime"], director: "Director Two", cast: ["Actor Two"] },
        { ...movie("Gamma", 2012, 3003), genres: ["Drama"], director: "Director One", cast: ["Actor Three"] },
        { ...movie("Delta", 2002, 3004), genres: ["Drama"], director: "Director Three", cast: ["Actor One"] },
        { ...movie("Epsilon", 2012, 3005), genres: ["Drama"], director: "Director Four", cast: ["Actor Four"] },
      ],
    });
    const collapsed = await page.evaluate(`(() => ({
      hidden: document.querySelector('#taste-explorer')?.hidden,
      contentHidden: document.querySelector('#taste-content')?.hidden,
      expanded: document.querySelector('#taste-toggle')?.getAttribute('aria-expanded')
    }))()`);
    if (collapsed.hidden || !collapsed.contentHidden || collapsed.expanded !== "false") {
      throw new Error(`Taste Explorer collapsed state is wrong: ${JSON.stringify(collapsed)}`);
    }

    await page.evaluate(`document.querySelector('#taste-toggle')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelectorAll('#taste-signals .taste__signal:not(.taste__signal--loading)').length === 3`,
      5000,
    );
    const open = await page.evaluate(`(() => ({
      signals: [...document.querySelectorAll('#taste-signals .taste__signal:not(.taste__signal--loading) strong')]
        .map((el) => el.textContent.trim()),
      selected: document.querySelector('#taste-signals [aria-pressed="true"] strong')?.textContent.trim(),
      detailTitle: document.querySelector('#taste-detail h3')?.textContent.trim(),
      evidence: [...document.querySelectorAll('#taste-detail .taste__movie-copy strong')]
        .map((el) => el.textContent.trim()),
      lensText: document.querySelector('#taste-detail .taste__action')?.textContent.trim()
    }))()`);
    if (
      open.signals.join("|") !== "Drama|2010s|Director One" ||
      open.selected !== "Drama" ||
      open.detailTitle !== "Drama in your ranking" ||
      open.evidence.join("|") !== "Alpha|Gamma|Delta|Epsilon" ||
      open.lensText !== "Open this ranking lens"
    ) {
      throw new Error(`Taste Explorer open state is wrong: ${JSON.stringify(open)}`);
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    const mobile = await page.evaluate(`(() => {
      const panel = document.querySelector('#taste-explorer')?.getBoundingClientRect();
      const signals = [...document.querySelectorAll('#taste-signals .taste__signal:not(.taste__signal--loading)')]
        .map((el) => el.getBoundingClientRect());
      return {
        viewport: innerWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        panelLeft: panel?.left,
        panelRight: panel?.right,
        signalWidths: signals.map((rect) => Math.round(rect.width))
      };
    })()`);
    if (
      mobile.pageScrollWidth !== mobile.viewport ||
      mobile.panelLeft < 0 ||
      mobile.panelRight > mobile.viewport ||
      mobile.signalWidths.some((width) => width < 90)
    ) {
      throw new Error(`Taste Explorer mobile layout overflowed: ${JSON.stringify(mobile)}`);
    }
    const mobileShot = await page.screenshot("taste-explorer-mobile.png");

    await page.evaluate(`document.querySelector('#taste-detail .taste__action')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#ranking-fullscreen')?.hidden &&
        document.querySelector('#fullscreen-title')?.textContent.trim() === 'Drama in your ranking' &&
        document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 4`,
      5000,
    );
    const lens = await page.evaluate(`(() => ({
      title: document.querySelector('#fullscreen-title')?.textContent.trim(),
      subtitle: document.querySelector('#fullscreen-sub')?.textContent.trim(),
      ranks: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__rank')]
        .map((el) => el.textContent.trim()),
      jumpHidden: document.querySelector('#fullscreen-jump-form')?.hidden,
      filtered: document.querySelector('#fullscreen-grid')?.classList.contains('is-filtered')
    }))()`);
    if (
      lens.title !== "Drama in your ranking" ||
      lens.subtitle !== "4 movies, preserving your overall order" ||
      lens.ranks.join("|") !== "1|3|4|5" ||
      !lens.jumpHidden ||
      !lens.filtered
    ) {
      throw new Error(`Taste ranking lens is wrong: ${JSON.stringify(lens)}`);
    }
    const lensShot = await page.screenshot("taste-explorer-lens-mobile.png");
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { collapsed, open, mobile, lens },
      screenshots: [mobileShot, lensShot],
    };
  } finally {
    await page.close();
  }
};

const testPackBrowserAndActions = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "pack-browser-actions", width: 1280, height: 900 });
  const packs = [
    {
      slug: "e2e-director-head-start",
      title: "E2E Director Head Start",
      subtitle: "A discovered director pack",
      category: "Director",
      version: 1,
      sort_order: 1,
      movies: [
        movie("E2E A One", 1988, 4101),
        movie("E2E A Two", 1991, 4102),
        movie("E2E A Three", 1996, 4103),
      ],
    },
    {
      slug: "e2e-decade-progress",
      title: "E2E Decade Progress",
      subtitle: "A started decade pack",
      category: "Decade",
      version: 1,
      sort_order: 2,
      movies: [
        movie("E2E B One", 1990, 4201),
        movie("E2E B Two", 1994, 4202),
        movie("E2E B Three", 1999, 4203),
      ],
    },
    {
      slug: "e2e-director-fresh",
      title: "E2E Director Fresh",
      subtitle: "An untouched director pack",
      category: "Director",
      version: 1,
      sort_order: 3,
      movies: [
        movie("E2E C One", 2001, 4301),
        movie("E2E C Two", 2002, 4302),
        movie("E2E C Three", 2003, 4303),
      ],
    },
  ];
  try {
    await installPackFixtures(page, packs);
    await seedPage(page, baseUrl, "pack-browser-actions", {
      ranking: [movie("E2E A One", 1988, 4101), movie("Anchor", 2020, 4000)],
      watchList: [queueMovie("E2E B One", 1990, 4201)],
      packProgress: {
        "e2e-decade-progress": {
          startedAt: "2026-06-20T10:00:00.000Z",
          packVersionSeen: 1,
          lastIndex: 1,
          updated_at: "2026-06-20T10:00:00.000Z",
        },
      },
    });
    await waitFor(page, `document.querySelectorAll('#pack-row .pack-card').length === 3`, 5000);
    await page.evaluate(`document.querySelector('#pack-view-all')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelectorAll('#pack-detail-list .pack-card').length === 3 &&
        document.querySelector('#pack-detail')?.classList.contains('is-all-packs')`,
      5000,
    );
    await page.evaluate(`document.querySelector('#pack-browser-filter-toggle')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#pack-browser-filter-controls')?.hidden`, 3000);

    await page.evaluate(`(() => {
      const input = document.querySelector('#pack-browser-search');
      input.value = '1994';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelectorAll('#pack-detail-list .pack-card').length === 1 &&
        !!document.querySelector('[data-slug="e2e-decade-progress"]')`,
      3000,
    );
    const search = await page.evaluate(`(() => ({
      results: document.querySelector('#pack-browser-results')?.textContent.trim(),
      slugs: [...document.querySelectorAll('#pack-detail-list .pack-card')].map((card) => card.dataset.slug),
      badge: document.querySelector('#pack-browser-filter-badge')?.textContent.trim()
    }))()`);
    if (
      search.results !== "Showing 1 of 3 packs." ||
      search.slugs.join("|") !== "e2e-decade-progress" ||
      search.badge !== "1 active"
    ) {
      throw new Error(`Pack year search is wrong: ${JSON.stringify(search)}`);
    }

    await page.evaluate(`document.querySelector('#pack-browser-search-clear')?.click(); true;`);
    await page.evaluate(`(() => {
      const select = document.querySelector('#pack-browser-category');
      select.value = 'Director';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#pack-detail-list .pack-card').length === 2`, 3000);
    await page.evaluate(
      `document.querySelector('#pack-browser-state-options [data-state="head_start"]')?.click(); true;`,
    );
    await waitFor(
      page,
      `document.querySelectorAll('#pack-detail-list .pack-card').length === 1 &&
        !!document.querySelector('[data-slug="e2e-director-head-start"]')`,
      3000,
    );
    const headStart = await page.evaluate(`(() => ({
      results: document.querySelector('#pack-browser-results')?.textContent.trim(),
      badge: document.querySelector('#pack-browser-filter-badge')?.textContent.trim(),
      selected: document.querySelector('#pack-browser-state-options [aria-pressed="true"]')?.dataset.state,
      slug: document.querySelector('#pack-detail-list .pack-card')?.dataset.slug
    }))()`);
    if (
      headStart.results !== "Showing 1 of 3 packs." ||
      headStart.badge !== "2 active" ||
      headStart.selected !== "head_start" ||
      headStart.slug !== "e2e-director-head-start"
    ) {
      throw new Error(`Combined pack filters are wrong: ${JSON.stringify(headStart)}`);
    }

    await page.evaluate(`document.querySelector('#pack-browser-reset')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#pack-detail-list .pack-card').length === 3`, 3000);
    await page.evaluate(
      `document.querySelector('#pack-detail-list [data-slug="e2e-director-head-start"]')?.click(); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#pack-detail-title')?.textContent.trim() === 'E2E Director Head Start'`,
      3000,
    );
    const pagerBefore = await page.evaluate(`(() => ({
      hidden: document.querySelector('#pack-detail-pager')?.hidden,
      count: document.querySelector('#pack-detail-pager-count')?.textContent.trim(),
      prevDisabled: document.querySelector('#pack-detail-prev')?.disabled,
      nextDisabled: document.querySelector('#pack-detail-next')?.disabled
    }))()`);
    if (pagerBefore.hidden || pagerBefore.count !== "Pack 2 of 3" || pagerBefore.nextDisabled) {
      throw new Error(`Pack detail pager state is wrong: ${JSON.stringify(pagerBefore)}`);
    }
    await page.evaluate(`document.querySelector('#pack-detail-next')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-title')?.textContent.trim() === 'E2E Director Fresh'`,
      3000,
    );

    await page.evaluate(
      `document.querySelector('[aria-label="Save E2E C One to Watch next"]')?.click(); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#pack-detail-status')?.textContent.trim() === '1 handled · 2 to go'`,
      3000,
    );
    await page.evaluate(
      `document.querySelector('[aria-label="Hide E2E C Two in Not for me"]')?.click(); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#pack-detail-status')?.textContent.trim() === '2 handled · 1 to go'`,
      3000,
    );
    await page.evaluate(`document.querySelector('#pack-save-all')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-status')?.textContent.trim() === '3 handled · 0 to go'`,
      3000,
    );
    await page.evaluate(
      `document.querySelector('#add-feedback .feedback-toast__action')?.click(); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#pack-detail-status')?.textContent.trim() === '2 handled · 1 to go'`,
      3000,
    );
    await page.evaluate(`document.querySelector('#pack-hide-all')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-status')?.textContent.trim() === '3 handled · 0 to go' &&
        document.querySelector('#pack-detail-list')?.textContent.includes('Pack complete.')`,
      3000,
    );
    const actions = await page.evaluate(`(() => {
      const queues = JSON.parse(localStorage.getItem('stackrank:suggestion-queues:v1') || '{}');
      const progress = JSON.parse(localStorage.getItem('stackrank:pack-progress:v1') || '{}').progress || {};
      return {
        status: document.querySelector('#pack-detail-status')?.textContent.trim(),
        watch: queues.watchList?.map((entry) => entry.title) || [],
        hidden: queues.notInterestedList?.map((entry) => entry.title) || [],
        completedAt: progress['e2e-director-fresh']?.completedAt || null,
        autoDisabled: document.querySelector('#pack-auto-start')?.disabled
      };
    })()`);
    if (
      actions.watch.join("|") !== "E2E B One|E2E C One" ||
      actions.hidden.join("|") !== "E2E C Two|E2E C Three" ||
      !actions.completedAt ||
      !actions.autoDisabled
    ) {
      throw new Error(`Pack actions or completion persistence failed: ${JSON.stringify(actions)}`);
    }

    const completedShot = await page.screenshot("pack-actions-complete.png");
    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(page, `document.querySelectorAll('#ranking .ranking__item').length === 2`, 10000);
    await waitFor(page, `document.querySelectorAll('#pack-row .pack-card').length === 2`, 5000);
    await page.evaluate(`document.querySelector('#pack-view-all')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#pack-detail-list .pack-card').length === 3`, 5000);
    await page.evaluate(`document.querySelector('#pack-browser-filter-toggle')?.click(); true;`);
    await page.evaluate(
      `document.querySelector('#pack-browser-state-options [data-state="completed"]')?.click(); true;`,
    );
    await waitFor(
      page,
      `document.querySelectorAll('#pack-detail-list .pack-card').length === 1 &&
        !!document.querySelector('[data-slug="e2e-director-fresh"]')`,
      3000,
    );
    const persisted = await page.evaluate(`(() => ({
      results: document.querySelector('#pack-browser-results')?.textContent.trim(),
      slug: document.querySelector('#pack-detail-list .pack-card')?.dataset.slug,
      watchRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      hiddenRows: document.querySelectorAll('#not-interested-list .queue-list__item').length
    }))()`);
    if (
      persisted.results !== "Showing 1 of 3 packs." ||
      persisted.slug !== "e2e-director-fresh" ||
      persisted.watchRows !== 2 ||
      persisted.hiddenRows !== 2
    ) {
      throw new Error(`Completed pack did not survive reload: ${JSON.stringify(persisted)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { search, headStart, pagerBefore, actions, persisted },
      screenshots: [completedShot, await page.screenshot("pack-completed-filter.png")],
    };
  } finally {
    await page.close();
  }
};

const testPackRankAllResumeAndCompletion = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "pack-rank-all", width: 1280, height: 900 });
  const packs = [
    {
      slug: "e2e-auto-pack",
      title: "E2E Auto Pack",
      subtitle: "Rank-all persistence fixture",
      category: "Test",
      version: 1,
      sort_order: 1,
      movies: [
        movie("Auto One", 2001, 4401),
        movie("Auto Two", 2002, 4402),
        movie("Auto Three", 2003, 4403),
      ],
    },
  ];
  try {
    await installPackFixtures(page, packs);
    await seedPage(page, baseUrl, "pack-rank-all", {
      ranking: [movie("Anchor", 2000, 4400)],
    });
    await waitFor(page, `!!document.querySelector('#pack-row [data-slug="e2e-auto-pack"]')`, 5000);
    await page.evaluate(`(() => {
      Math.random = () => 0.5;
      document.querySelector('#pack-row [data-slug="e2e-auto-pack"]')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-title')?.textContent.trim() === 'E2E Auto Pack'`,
      3000,
    );
    await page.evaluate(`document.querySelector('#pack-auto-start')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#new-title')?.textContent.trim() === 'Auto One' &&
        !document.querySelector('#skip-pack-movie')?.hidden`,
      3000,
    );
    await page.evaluate(`document.querySelector('#existing-card')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#new-title')?.textContent.trim() === 'Auto Two' &&
        document.querySelector('#compare-sub')?.textContent.includes('2 of 3')`,
      3000,
    );
    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-title')?.textContent.trim() === 'E2E Auto Pack' &&
        document.querySelector('#pack-detail-status')?.textContent.trim() === '1 handled · 2 to go'`,
      3000,
    );
    const canceled = await page.evaluate(`(() => {
      const progress = JSON.parse(localStorage.getItem('stackrank:pack-progress:v1') || '{}').progress || {};
      return {
        status: document.querySelector('#pack-detail-status')?.textContent.trim(),
        ranking: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
        lastIndex: progress['e2e-auto-pack']?.lastIndex,
        startedAt: progress['e2e-auto-pack']?.startedAt || null,
        inputBlurred: document.activeElement !== document.querySelector('#title')
      };
    })()`);
    if (
      canceled.ranking.join("|") !== "Anchor|Auto One" ||
      canceled.lastIndex !== 1 ||
      !canceled.startedAt ||
      !canceled.inputBlurred
    ) {
      throw new Error(`Canceling Rank all did not preserve resumable progress: ${JSON.stringify(canceled)}`);
    }
    const canceledShot = await page.screenshot("pack-rank-all-canceled.png");

    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(page, `document.querySelectorAll('#ranking .ranking__item').length === 2`, 10000);
    await waitFor(page, `!!document.querySelector('#pack-row [data-slug="e2e-auto-pack"]')`, 5000);
    await page.evaluate(`(() => {
      Math.random = () => 0.5;
      document.querySelector('#pack-row [data-slug="e2e-auto-pack"]')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail-status')?.textContent.trim() === '1 handled · 2 to go'`,
      3000,
    );
    await page.evaluate(`document.querySelector('#pack-auto-start')?.click(); true;`);
    await waitFor(page, `document.querySelector('#new-title')?.textContent.trim() === 'Auto Two'`, 3000);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const complete = await page.evaluate(
        `!document.querySelector('#pack-detail')?.hidden &&
          document.querySelector('#pack-detail-status')?.textContent.trim() === '3 handled · 0 to go'`,
      );
      if (complete) break;
      const comparing = await page.evaluate(
        `!document.querySelector('#compare')?.classList.contains('panel--hidden')`,
      );
      if (!comparing) {
        await wait(100);
        continue;
      }
      await page.evaluate(`document.querySelector('#existing-card')?.click(); true;`);
      await wait(120);
    }
    await waitFor(
      page,
      `!document.querySelector('#pack-detail')?.hidden &&
        document.querySelector('#pack-detail-status')?.textContent.trim() === '3 handled · 0 to go'`,
      5000,
    );
    const completed = await page.evaluate(`(() => {
      const progress = JSON.parse(localStorage.getItem('stackrank:pack-progress:v1') || '{}').progress || {};
      return {
        status: document.querySelector('#pack-detail-status')?.textContent.trim(),
        ranking: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
        completedAt: progress['e2e-auto-pack']?.completedAt || null,
        lastIndex: progress['e2e-auto-pack']?.lastIndex,
        autoText: document.querySelector('#pack-auto-start')?.textContent.trim(),
        autoDisabled: document.querySelector('#pack-auto-start')?.disabled,
        inputBlurred: document.activeElement !== document.querySelector('#title')
      };
    })()`);
    if (
      completed.ranking.join("|") !== "Anchor|Auto One|Auto Two|Auto Three" ||
      !completed.completedAt ||
      completed.lastIndex !== 3 ||
      completed.autoText !== "Pack complete" ||
      !completed.autoDisabled ||
      !completed.inputBlurred
    ) {
      throw new Error(`Resumed Rank all did not complete cleanly: ${JSON.stringify(completed)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { canceled, completed },
      screenshots: [canceledShot, await page.screenshot("pack-rank-all-complete.png")],
    };
  } finally {
    await page.close();
  }
};

const testMobilePackTitleClearance = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "mobile-pack-title-clearance", width: 440, height: 956 });
  try {
    await seedPage(page, baseUrl, "mobile-pack-title-clearance", { ranking: [] });
    await waitFor(page, `document.querySelectorAll('#pack-row .pack-card').length === 3`, 10000);
    await page.evaluate(`document.querySelector('#pack-view-all')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#pack-detail')?.hidden && document.querySelector('#pack-detail')?.classList.contains('is-all-packs')`, 5000);
    await page.evaluate(`document.querySelector('#pack-browser-filter-toggle')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#pack-browser-filter-controls')?.hidden`, 5000);

    const openPack = async (slug, query, title) => {
      await page.evaluate(`(() => {
        const input = document.querySelector('#pack-browser-search');
        if (!input) return false;
        input.value = ${JSON.stringify(query)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      await waitFor(page, `!!document.querySelector('.pack-card[data-slug="${slug}"]')`, 5000);
      await page.evaluate(`document.querySelector('.pack-card[data-slug="${slug}"]')?.click(); true;`);
      await waitFor(page, `document.querySelector('#pack-detail-title')?.textContent.trim() === ${JSON.stringify(title)} && !document.querySelector('#pack-detail')?.classList.contains('is-all-packs')`, 5000);
      await wait(300);
      return page.evaluate(`(() => {
        const titleRect = document.querySelector('#pack-detail-title')?.getBoundingClientRect();
        const closeRect = document.querySelector('#pack-detail-close')?.getBoundingClientRect();
        const subRect = document.querySelector('#pack-detail-sub')?.getBoundingClientRect();
        const overlaps = (a, b) => !!a && !!b &&
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          title: document.querySelector('#pack-detail-title')?.textContent.trim(),
          titleCloseOverlap: overlaps(titleRect, closeRect),
          titleSubOverlap: overlaps(titleRect, subRect),
          closeClearance: Math.round((closeRect?.left || 0) - (titleRect?.right || 0)),
          titleHeight: Math.round(titleRect?.height || 0),
          movieRole: document.querySelector('.pack-movie')?.getAttribute('role'),
          movieTabIndex: document.querySelector('.pack-movie')?.getAttribute('tabindex'),
          movieRankLabel: document.querySelector('.pack-movie .suggest-action')?.getAttribute('aria-label'),
          backgroundInert: document.querySelector('.topbar')?.inert,
          packInert: document.querySelector('#pack-detail')?.inert
        };
      })()`);
    };

    const blockbuster = await openPack(
      "decade-1980s-blockbuster-dna",
      "1980s Blockbuster DNA",
      "1980s Blockbuster DNA",
    );
    const blockbusterShot = await page.screenshot("mobile-pack-title-blockbuster.png");
    if (
      blockbuster.titleCloseOverlap ||
      blockbuster.titleSubOverlap ||
      blockbuster.closeClearance < 8 ||
      blockbuster.movieRole !== "group" ||
      blockbuster.movieTabIndex ||
      !/^Rank /.test(blockbuster.movieRankLabel || "") ||
      !blockbuster.backgroundInert ||
      blockbuster.packInert
    ) {
      throw new Error(`Blockbuster pack title overlaps header controls: ${JSON.stringify(blockbuster)}`);
    }

    await page.evaluate(`document.querySelector('#pack-detail-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#pack-detail')?.classList.contains('is-all-packs')`, 5000);
    const tomHanks = await openPack(
      "actor-tom-hanks-comfort-canon",
      "Tom Hanks Comfort Canon",
      "Tom Hanks Comfort Canon",
    );
    const tomHanksShot = await page.screenshot("mobile-pack-title-tom-hanks.png");
    if (tomHanks.titleCloseOverlap || tomHanks.titleSubOverlap || tomHanks.closeClearance < 8) {
      throw new Error(`Tom Hanks pack title overlaps header controls: ${JSON.stringify(tomHanks)}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { blockbuster, tomHanks },
      screenshots: [blockbusterShot, tomHanksShot],
    };
  } finally {
    await page.close();
  }
};

const tests = [
  { name: "localStorage persistence round-trip", run: testLoadPersistence },
  { name: "privacy page and TMDB credits", run: testPrivacyAndCredits },
  { name: "mobile and desktop boot layout stability", run: testBootLayoutStability },
  { name: "app shell destination navigation", run: testAppShellNavigation },
  { name: "first-run quick start activation flow", run: testFirstRunQuickStart },
  { name: "dedicated sign-in view and provider availability", run: testSignInExperience },
  { name: "watch queue comparison flow", run: testQueueComparison },
  { name: "browser storage failure warning", run: testStorageFailureWarning },
  { name: "TMDB failure and recovery", run: testTmdbFailureRecovery },
  { name: "comparison undo and cancel restore origin", run: testComparisonUndoCancel },
  { name: "ranking review swap, Escape, and session undo", run: testRankingReviewSession },
  { name: "autocomplete keyboard selection", run: testAutocompleteKeyboardSelection },
  { name: "portrait and landscape comparison layouts", run: testComparisonResponsiveLayouts },
  { name: "Share Studio preview and empty toggles", run: testShareStudio },
  { name: "backup restore and title-list import", run: testBackupAndImport },
  { name: "backup, PNG, and ZIP downloads", run: testBackupAndImageDownloads },
  { name: "signed-in Supabase merge and save", run: testSignedInSupabaseMergeAndSave },
  { name: "full-screen ranking interactions", run: testFullscreenRankingInteractions },
  { name: "Taste Explorer evidence and ranking lens", run: testTasteExplorer },
  { name: "suggestion explanations and refresh", run: testSuggestionExplanations },
  { name: "pack browser filters, paging, actions, and persistence", run: testPackBrowserAndActions },
  { name: "pack Rank all cancel, resume, and completion", run: testPackRankAllResumeAndCompletion },
  { name: "mobile pack title clearance", run: testMobilePackTitleClearance },
];

const writeReports = async ({ startedAt, completedAt, baseUrl, results }) => {
  const pass = results.filter((result) => result.status === "passed").length;
  const fail = results.length - pass;
  const summary = {
    status: fail ? "failed" : "passed",
    startedAt,
    completedAt,
    durationMs: Date.parse(completedAt) - Date.parse(startedAt),
    baseUrl,
    totals: { tests: results.length, pass, fail },
    reportDir: path.relative(rootDir, reportDir),
    latest: path.relative(rootDir, latestPath),
    results,
  };
  const summaryMarkdown = [
    `# StackRank E2E Smoke Report - ${timestamp}`,
    "",
    `- Status: **${summary.status}**`,
    `- Started: ${startedAt}`,
    `- Completed: ${completedAt}`,
    `- Duration: ${((Date.parse(completedAt) - Date.parse(startedAt)) / 1000).toFixed(2)}s`,
    `- Tests: ${pass} passed / ${fail} failed / ${results.length} total`,
    `- Base URL: ${baseUrl}`,
    "",
    "## Results",
    "",
    ...results.flatMap((result) => [
      `### ${result.status === "passed" ? "PASS" : "FAIL"} - ${result.name}`,
      "",
      `Duration: ${((result.durationMs || 0) / 1000).toFixed(2)}s`,
      "",
      result.error ? `Error: ${result.error}` : `Details: \`${JSON.stringify(result.details)}\``,
      "",
      ...(result.screenshots?.length ? ["Screenshots:", ...result.screenshots.map((shot) => `- \`${shot}\``), ""] : []),
    ]),
  ].join("\n");
  const junit = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<testsuites tests="${results.length}" failures="${fail}">`,
    `  <testsuite name="StackRank E2E smoke" tests="${results.length}" failures="${fail}">`,
    ...results.map((result) => {
      const body = result.status === "failed"
        ? `<failure message="${xmlEscape(result.error || "failed")}">${xmlEscape(result.error || "")}</failure>`
        : "";
      return `    <testcase name="${xmlEscape(result.name)}" classname="e2e">${body}</testcase>`;
    }),
    "  </testsuite>",
    "</testsuites>",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(reportDir, "summary.md"), `${summaryMarkdown}\n`);
  fs.writeFileSync(path.join(reportDir, "junit.xml"), junit);
  fs.rmSync(latestPath, { recursive: true, force: true });
  try {
    fs.symlinkSync(path.relative(reportsRoot, reportDir), latestPath, "dir");
  } catch (error) {
    fs.writeFileSync(path.join(reportsRoot, "latest.txt"), `${path.relative(rootDir, reportDir)}\n`);
    console.warn(`Could not update reports/e2e/latest symlink: ${error.message}`);
  }
};

const main = async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(downloadsRoot, { recursive: true });
  const startedAt = timestampForFile();
  const only = String(process.env.E2E_ONLY || "").trim().toLowerCase();
  const selectedTests = only
    ? tests.filter((test) => test.name.toLowerCase().includes(only))
    : tests;
  if (!selectedTests.length) {
    throw new Error(`No E2E tests matched E2E_ONLY=${JSON.stringify(process.env.E2E_ONLY)}`);
  }
  const server = await serveStatic();
  const results = [];
  try {
    for (const test of selectedTests) {
      const result = { name: test.name, status: "passed", details: null, screenshots: [], durationMs: 0 };
      const testStarted = Date.now();
      process.stdout.write(`E2E ${test.name} ... `);
      try {
        const output = await test.run({ baseUrl: server.url });
        result.details = output.details || null;
        result.screenshots = output.screenshots || [];
        console.log("passed");
      } catch (error) {
        result.status = "failed";
        result.error = error.stack || error.message;
        console.log("failed");
        console.error(error);
      }
      result.durationMs = Date.now() - testStarted;
      results.push(result);
    }
  } finally {
    await server.close();
  }
  const completedAt = timestampForFile();
  await writeReports({ startedAt, completedAt, baseUrl: server.url, results });
  console.log(`E2E report saved to ${path.relative(rootDir, reportDir)}`);
  console.log(`Latest E2E report: ${path.relative(rootDir, latestPath)}`);
  if (results.some((result) => result.status === "failed")) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
