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
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
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

const seedPage = async (page, baseUrl, name, { ranking, watchList = [], notInterestedList = [], shareOptions = {} }) => {
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
    localStorage.setItem('stackrank:share-options:v1', ${JSON.stringify(JSON.stringify(optionsPayload))});
    location.reload();
    true;
  `);
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
      scriptSrc: document.querySelector('script[type="module"]')?.getAttribute('src')
    }))()`);
    if (state.titles.join("|") !== "1. Alpha|2. Beta|3. Gamma") {
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

const testFirstRunQuickStart = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "first-run-quick-start", width: 1280, height: 900 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
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
        document.querySelectorAll('#pack-row .pack-card').length === 3`,
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
      cssHref: document.querySelector('link[rel="stylesheet"]')?.getAttribute('href')
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
      empty.moduleSrc !== "app.js?v=128" ||
      empty.cssHref !== "styles.css?v=85"
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
      one.rankingTitle !== "1. First Pick" ||
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
      activated.rankingTitles.join("|") !== "1. Second Pick|2. First Pick" ||
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
      bodyOverflow: getComputedStyle(document.body).overflow
    }))()`);
    if (
      opened.activeId !== "signin-close" ||
      opened.googleHidden ||
      !opened.appleHidden ||
      opened.emailDisabled ||
      opened.bodyOverflow !== "hidden"
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

    const desktopShot = await page.screenshot("sign-in-desktop.png");
    await page.evaluate(`(() => {
      const submit = document.querySelector('#signin-magic-send');
      submit.focus();
      submit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
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
        document.activeElement === document.querySelector('#auth-sign-in')`,
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
      details: { opened, invalid, trappedFocus, mobile },
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
    const started = await page.evaluate(`(() => {
      Math.random = () => 0.5;
      document.querySelector('#watch-list .queue-list__item')?.click();
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
    if (state.rankingTitles.length !== 4 || state.rankingTitles[3] !== "4. Omega") {
      throw new Error(`Queue movie did not settle at bottom: ${state.rankingTitles.join(", ")}`);
    }
    if (state.watchRows !== 0) throw new Error(`Watch queue should be empty after ranking; got ${state.watchRows}`);
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return { details: state, screenshots: [comparisonShot, await page.screenshot("queue-comparison-settled.png")] };
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
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return { details: { singleState, setState }, screenshots: [singleShot, await page.screenshot("share-studio-set.png")] };
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
    if (imported.rankingTitles.join("|") !== "1. The Godfather|2. Heat|3. Spirited Away") {
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
    if (restored.rankingTitles.join("|") !== "1. Restored One") {
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
    if (afterReload.rankingTitles.join("|") !== "1. Restored One" || afterReload.watchRows !== 1 || afterReload.hiddenRows !== 1) {
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
            if (
              url.includes('/rest/v1/movie_lists') ||
              url.includes('/rest/v1/pack_progress') ||
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
      true;
    `);
    page.events.length = 0;
    await page.send("Page.navigate", { url: `${baseUrl}/?e2e=supabase-merge-save` });
    await waitFor(
      page,
      `(() => {
        const titles = [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim());
        return titles.join('|') === '1. Remote First|2. Shared|3. Local Only' &&
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
        writeAuthorized: !!lastWrite?.authorization?.startsWith('Bearer ')
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
      !state.writeAuthorized
    ) {
      throw new Error(`Signed-in merge/save adapter failed: ${JSON.stringify(state)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: state,
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

    await page.evaluate(`document.querySelector('#fullscreen-grid .fullscreen-card')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#movie-detail')?.hidden && document.querySelector('#detail-title')?.textContent.trim() === 'Alpha'`, 3000);
    await page.evaluate(`document.querySelector('#detail-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#movie-detail')?.hidden`, 3000);

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
      state.rankingTitles.at(-1) !== "6. Alpha" ||
      !state.compact
    ) {
      throw new Error(`Full-screen drag did not persist the new order: ${JSON.stringify(state)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { filtered, state },
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
      visibility: [...document.querySelectorAll('.suggest-reason')].map((el) => getComputedStyle(el).visibility)
    }))()`);
    if (
      pending.count !== 9 ||
      pending.pendingCount !== 9 ||
      pending.text.some(Boolean) ||
      pending.visibility.some((value) => value !== "hidden")
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
    await waitFor(
      page,
      `document.querySelector('#suggest-popular .suggest-reason__text')?.textContent.trim() === 'Popular now · Mystery'`,
      5000,
    );
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
          titleHeight: Math.round(titleRect?.height || 0)
        };
      })()`);
    };

    const blockbuster = await openPack(
      "decade-1980s-blockbuster-dna",
      "1980s Blockbuster DNA",
      "1980s Blockbuster DNA",
    );
    const blockbusterShot = await page.screenshot("mobile-pack-title-blockbuster.png");
    if (blockbuster.titleCloseOverlap || blockbuster.titleSubOverlap || blockbuster.closeClearance < 8) {
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
  { name: "first-run quick start activation flow", run: testFirstRunQuickStart },
  { name: "dedicated sign-in view and provider availability", run: testSignInExperience },
  { name: "watch queue comparison flow", run: testQueueComparison },
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
  const server = await serveStatic();
  const results = [];
  try {
    for (const test of tests) {
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
