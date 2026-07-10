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
          : /^\/s\/[a-z0-9]{10}$/.test(pathname)
            ? "shared.html"
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
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromeExit = null;
  let chromeStderr = "";
  proc.stderr.on("data", (chunk) => {
    chromeStderr = `${chromeStderr}${chunk.toString()}`.slice(-4000);
  });
  proc.once("exit", (code, signal) => {
    chromeExit = { code, signal };
  });

  let pageTarget = null;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const tabs = await getCdpJson(port, "/json/list");
      pageTarget = tabs.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (pageTarget) break;
    } catch (_error) {
      // Chrome may need a moment before the debugging endpoint is listening.
    }
    if (chromeExit) break;
    await wait(100);
  }

  if (!pageTarget) {
    proc.kill();
    throw new Error(
      `Chrome CDP page target did not start${chromeExit ? `; Chrome exited ${JSON.stringify(chromeExit)}` : ""}${
        chromeStderr.trim() ? `\nChrome stderr:\n${chromeStderr.trim()}` : ""
      }`,
    );
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

const clickAt = async (page, x, y) => {
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
};

const DEVICE_INPUT_PROFILE = Object.freeze({
  fine: "fine",
  coarseTouch: "coarse-touch",
});

const setDeviceProfile = async (
  page,
  {
    width,
    height,
    input = DEVICE_INPUT_PROFILE.fine,
    deviceScaleFactor = input === DEVICE_INPUT_PROFILE.coarseTouch ? 2 : 1,
  },
) => {
  const touch = input === DEVICE_INPUT_PROFILE.coarseTouch;
  if (!touch) {
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  }
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor,
    mobile: touch,
    screenWidth: width,
    screenHeight: height,
  });
  if (touch) {
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  }
  await wait(150);
  return page.evaluate(`(() => ({
    innerWidth,
    innerHeight,
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    pointerFine: matchMedia('(pointer: fine)').matches,
    anyPointerCoarse: matchMedia('(any-pointer: coarse)').matches,
    hoverHover: matchMedia('(hover: hover)').matches,
    hoverNone: matchMedia('(hover: none)').matches,
    maxTouchPoints: navigator.maxTouchPoints
  }))()`);
};

const tapAt = async (page, x, y) => {
  const point = {
    x: Math.round(x),
    y: Math.round(y),
    radiusX: 1,
    radiusY: 1,
    force: 1,
  };
  await page.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await page.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
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
      desktop.cssHref !== "styles.css?v=146" ||
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
    const boot = await page.evaluate(`(() => {
      const display = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).display : '';
      };
      return {
        discoveryHeight: document.querySelector('#suggest-panel')?.getBoundingClientRect().height,
        discoveryDisplay: display('#suggest-panel'),
        packHeight: document.querySelector('#pack-row')?.getBoundingClientRect().height,
        packDisplay: display('#pack-row'),
        essentialsHeight: document.querySelector('#suggest-essentials')?.getBoundingClientRect().height,
        essentialsDisplay: display('#suggest-essentials'),
        popularHeight: document.querySelector('#suggest-popular')?.getBoundingClientRect().height,
        popularDisplay: display('#suggest-popular')
      };
    })()`);

    await waitFor(
      page,
      `document.querySelectorAll('#pack-row button.pack-card').length === 3 &&
        document.querySelectorAll('.suggest-card:not(.suggest-card--loading)').length === 6`,
      10000,
    );
    await wait(250);
    const settled = await page.evaluate(`(() => {
      const display = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).display : '';
      };
      return {
        discoveryHeight: document.querySelector('#suggest-panel')?.getBoundingClientRect().height,
        discoveryDisplay: display('#suggest-panel'),
        packHeight: document.querySelector('#pack-row')?.getBoundingClientRect().height,
        packDisplay: display('#pack-row'),
        essentialsHeight: document.querySelector('#suggest-essentials')?.getBoundingClientRect().height,
        essentialsDisplay: display('#suggest-essentials'),
        popularHeight: document.querySelector('#suggest-popular')?.getBoundingClientRect().height,
        popularDisplay: display('#suggest-popular'),
        layoutShifts: window.__e2eLayoutShifts || [],
        cls: (window.__e2eLayoutShifts || []).reduce((sum, entry) => sum + entry.value, 0),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth
      };
    })()`);
    const visibleHeightChanged = (afterDisplay, beforeHeight, afterHeight, tolerance) =>
      afterDisplay !== "none" && Math.abs(afterHeight - beforeHeight) > tolerance;
    if (
      visibleHeightChanged(settled.discoveryDisplay, boot.discoveryHeight, settled.discoveryHeight, 40) ||
      visibleHeightChanged(settled.packDisplay, boot.packHeight, settled.packHeight, 4) ||
      visibleHeightChanged(settled.essentialsDisplay, boot.essentialsHeight, settled.essentialsHeight, 4) ||
      visibleHeightChanged(settled.popularDisplay, boot.popularHeight, settled.popularHeight, 4) ||
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
      watchList: [
        queueMovie("Saved", 2020, 2006),
        queueMovie("Later Pick", 2019, 2008),
        queueMovie("Queued Drama", 2018, 2009),
        queueMovie("Weekend Watch", 2017, 2010),
      ],
      notInterestedList: [
        { ...queueMovie("Hidden", 2021, 2007), hiddenAt: "2026-06-20T13:30:00.000Z" },
        { ...queueMovie("Buried Pick", 2016, 2011), hiddenAt: "2026-06-20T13:40:00.000Z" },
      ],
    });
    await page.evaluate(`(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const url = typeof input === 'string' ? input : input?.url || String(input);
        if (url.includes('/functions/v1/tmdb-detail')) {
          const id = Number(new URL(url).searchParams.get('id'));
          return Promise.resolve(new Response(JSON.stringify({
            result: {
              tmdbId: id,
              runtime: 100,
              genres: ['Drama'],
              director: 'E2E Director',
              cast: ['E2E Actor'],
              overview: 'E2E detail fixture.'
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return realFetch(input, options);
      };
      return true;
    })()`);

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
        visibleQueuePanels: [...document.querySelectorAll('.panel--queues')].filter((panel) => {
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

    const readRankingActionStyle = async (selector) =>
      page.evaluate(`(() => {
        const button = document.querySelector('#ranking .ranking__item ${selector}');
        if (!button) return null;
        const bounds = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          selector: ${JSON.stringify(selector)},
          centerX: bounds.left + bounds.width / 2,
          centerY: bounds.top + bounds.height / 2,
          width: bounds.width,
          height: bounds.height,
          borderTopColor: style.borderTopColor,
          backgroundColor: style.backgroundColor,
          color: style.color,
          transform: style.transform
      };
    })()`);
    const desktopHasFineHover = await page.evaluate(
      `matchMedia('(hover: hover) and (pointer: fine)').matches`,
    );
    const desktopActionHoverStates = [];
    let desktopInfoHoverShot = null;
    for (const selector of [".ranking__info", ".ranking__restack", ".ranking__handle", ".ranking__delete"]) {
      await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1, button: "none" });
      await wait(30);
      const before = await readRankingActionStyle(selector);
      if (!before) throw new Error(`Missing ranking action for hover check: ${selector}`);
      await page.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: Math.round(before.centerX),
        y: Math.round(before.centerY),
        button: "none",
      });
      await wait(180);
      const hover = await readRankingActionStyle(selector);
      if (selector === ".ranking__info") {
        desktopInfoHoverShot = await page.screenshot("app-shell-desktop-ranking-info-hover.png");
      }
      desktopActionHoverStates.push({ selector, before, hover });
    }
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1, button: "none" });
    const missingHoverState = desktopActionHoverStates.filter(({ before, hover }) =>
      !hover ||
      hover.width < 35.5 ||
      hover.height < 35.5 ||
      (desktopHasFineHover &&
        (hover.borderTopColor === before.borderTopColor ||
          hover.backgroundColor === before.backgroundColor ||
          hover.borderTopColor === "rgba(0, 0, 0, 0)" ||
          hover.backgroundColor === "rgba(0, 0, 0, 0)" ||
          hover.transform === "none"))
    );
    if (missingHoverState.length) {
      throw new Error(
        `Desktop ranking action hover state is inconsistent: ${JSON.stringify({
          desktopHasFineHover,
          states: desktopActionHoverStates,
        })}`,
      );
    }
    const desktopShot = await page.screenshot("app-shell-desktop-rank.png");

    const switchAppDestination = async (destination) => {
      await page.evaluate(`(() => {
        document.querySelectorAll('[data-app-destination-target="${destination}"]').forEach((button) => button.click());
        return true;
      })()`);
      await waitFor(
        page,
        `document.querySelector('main.app')?.dataset.appDestination === ${JSON.stringify(destination)}`,
        3000,
      );
      await wait(100);
    };
    const tapSelector = async (selector) => {
      const point = await page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        const bounds = element?.getBoundingClientRect();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
        const x = Math.round(bounds.left + bounds.width / 2);
        const y = Math.round(bounds.top + bounds.height / 2);
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          hit: hit === element || element?.contains(hit)
        };
      })()`);
      if (!point?.hit) {
        throw new Error(`Touch target is not hittable: ${selector} ${JSON.stringify(point)}`);
      }
      await tapAt(page, point.x, point.y);
      return point;
    };
    const readRankModalityLayout = async () =>
      page.evaluate(`(() => {
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? {
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : null;
        };
        const visible = (element) => {
          const bounds = element?.getBoundingClientRect();
          const style = element ? getComputedStyle(element) : null;
          return !!bounds &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            style?.display !== 'none' &&
            style?.visibility !== 'hidden' &&
            style?.opacity !== '0' &&
            style?.pointerEvents !== 'none';
        };
        const item = document.querySelector('#ranking .ranking__item');
        const appStyle = getComputedStyle(document.querySelector('.app'));
        const side = rect(document.querySelector('.side-stack'));
        const rail = rect(document.querySelector('.stack'));
        const directActions = [...(item?.querySelectorAll('.movie-item__actions > .movie-item__action') || [])]
          .map((button) => ({
            text: button.textContent.trim(),
            className: button.className,
            visible: visible(button),
            rect: rect(button)
          }));
        const toolbarControls = [...document.querySelectorAll('.panel--list .panel__actions .icon-button')]
          .filter((button) => visible(button))
          .map((button) => ({
            id: button.id,
            label: button.querySelector('.icon-button__label')?.textContent.trim() || button.getAttribute('aria-label') || '',
            rect: rect(button)
          }));
        const overflow = item?.querySelector('.ranking__overflow');
        const overflowToggle = overflow?.querySelector('.movie-item__overflow-toggle');
        const handle = item?.querySelector('.ranking__handle');
        return {
          destination: document.querySelector('main.app')?.dataset.appDestination,
          pointerCoarse: matchMedia('(pointer: coarse)').matches,
          pointerFine: matchMedia('(pointer: fine)').matches,
          anyPointerCoarse: matchMedia('(any-pointer: coarse)').matches,
          hoverHover: matchMedia('(hover: hover)').matches,
          hoverNone: matchMedia('(hover: none)').matches,
          maxTouchPoints: navigator.maxTouchPoints,
          appColumns: appStyle.gridTemplateColumns,
          appAreas: appStyle.gridTemplateAreas,
          side,
          rail,
          sideLeftOfRail: !!side && !!rail && side.left < rail.left && side.right <= rail.left,
          topNavVisible: visible(document.querySelector('.app-nav--top')),
          mobileNavVisible: visible(document.querySelector('.app-nav--mobile')),
          toolbarControls,
          directActions,
          visibleDirectActionLabels: directActions.filter((action) => action.visible).map((action) => action.text),
          overflow: {
            visible: visible(overflowToggle),
            rect: rect(overflowToggle),
            display: overflow ? getComputedStyle(overflow).display : ''
          },
          handle: {
            visible: visible(handle),
            rect: rect(handle),
            touchAction: handle ? getComputedStyle(handle).touchAction : ''
          },
          rowTouchAction: item ? getComputedStyle(item).touchAction : '',
          body: rect(item?.querySelector('.movie-item__body')),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth,
          innerHeight
        };
      })()`);
    const assertCoarseRankLayout = (label, layout, toolbarLabels, { twoColumn = true } = {}) => {
      if (
        layout.destination !== "rank" ||
        !layout.pointerCoarse ||
        layout.pointerFine ||
        !layout.anyPointerCoarse ||
        layout.hoverHover ||
        !layout.hoverNone ||
        layout.maxTouchPoints < 1 ||
        (twoColumn && !layout.sideLeftOfRail) ||
        (twoColumn && !layout.topNavVisible) ||
        (!twoColumn && !layout.mobileNavVisible) ||
        layout.toolbarControls.map((control) => control.label).join("|") !== toolbarLabels ||
        layout.toolbarControls.some((control) => control.rect.width < 44 || control.rect.height < 44) ||
        layout.visibleDirectActionLabels.length !== 0 ||
        !layout.overflow.visible ||
        layout.overflow.rect?.width < 44 ||
        layout.overflow.rect?.height < 44 ||
        layout.handle.visible ||
        layout.rowTouchAction !== "pan-y" ||
        layout.handle.touchAction !== "none" ||
        layout.body?.width < 80 ||
        layout.body?.height < 44 ||
        layout.scrollWidth > layout.innerWidth
      ) {
        throw new Error(`${label} coarse Rank layout is wrong: ${JSON.stringify(layout)}`);
      }
    };
    const readVisibleControlTargets = async (rootSelectors) =>
      page.evaluate(`(() => {
        const roots = ${JSON.stringify(rootSelectors)}
          .map((selector) => document.querySelector(selector))
          .filter(Boolean);
        const controls = [...new Set(roots.flatMap((root) => [
          ...(root.matches('button, summary, a[href], [role="button"]') ? [root] : []),
          ...root.querySelectorAll('button, summary, a[href], [role="button"]')
        ]))].filter((element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return bounds.width > 0 &&
            bounds.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            style.pointerEvents !== 'none';
        }).map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            id: element.id || '',
            className: element.className || '',
            text: element.getAttribute('aria-label') || element.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          };
        });
        return {
          pointerCoarse: matchMedia('(pointer: coarse)').matches,
          count: controls.length,
          controls,
          bad: controls.filter((control) => control.width < 44 || control.height < 44)
        };
      })()`);
    const assertCoarseControlTargets = (label, audit) => {
      if (!audit.pointerCoarse || audit.count < 2 || audit.bad.length) {
        throw new Error(`${label} has undersized coarse controls: ${JSON.stringify(audit)}`);
      }
    };
    const readCoarseHoverSuppression = async (selector) => {
      await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1, button: "none" });
      await wait(30);
      const readStyle = () =>
        page.evaluate(`(() => {
          const element = document.querySelector(${JSON.stringify(selector)});
          const bounds = element?.getBoundingClientRect();
          const style = element ? getComputedStyle(element) : null;
          return element && bounds && style ? {
            x: Math.round(bounds.left + bounds.width / 2),
            y: Math.round(bounds.top + bounds.height / 2),
            transform: style.transform,
            backgroundColor: style.backgroundColor,
            borderTopColor: style.borderTopColor,
            hovered: element.matches(':hover'),
            pointerCoarse: matchMedia('(pointer: coarse)').matches,
            hoverHover: matchMedia('(hover: hover)').matches
          } : null;
        })()`);
      const before = await readStyle();
      if (!before) throw new Error(`Missing coarse hover target: ${selector}`);
      await page.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: before.x,
        y: before.y,
        button: "none",
      });
      await wait(120);
      const after = await readStyle();
      return { selector, before, after };
    };
    const assertCoarseHoverSuppressed = (label, evidence) => {
      if (
        !evidence.before.pointerCoarse ||
        evidence.before.hoverHover ||
        evidence.after.transform !== evidence.before.transform ||
        evidence.after.backgroundColor !== evidence.before.backgroundColor ||
        evidence.after.borderTopColor !== evidence.before.borderTopColor
      ) {
        throw new Error(`${label} retained a hover-only visual state: ${JSON.stringify(evidence)}`);
      }
    };
    const exerciseCoarseRankControls = async (label) => {
      await page.evaluate(`document.querySelector('#ranking .ranking__item')?.scrollIntoView({ block: 'center' }); true;`);
      await wait(50);
      await tapSelector("#ranking .ranking__item .movie-item__body");
      await waitFor(page, `!document.querySelector('#movie-detail')?.hidden`, 3000);
      const rowTap = await page.evaluate(`(() => ({
        title: document.querySelector('#detail-title')?.textContent.trim(),
        detailHidden: document.querySelector('#movie-detail')?.hidden,
        openMenus: document.querySelectorAll('.movie-item__overflow[open]').length
      }))()`);
      if (rowTap.detailHidden || !rowTap.title || rowTap.openMenus !== 0) {
        throw new Error(`${label} row tap did not open detail cleanly: ${JSON.stringify(rowTap)}`);
      }
      await page.evaluate(`document.querySelector('#detail-close')?.click(); true;`);
      await waitFor(page, `document.querySelector('#movie-detail')?.hidden`, 3000);

      await tapSelector("#ranking .ranking__item .ranking__overflow > summary");
      await waitFor(page, `document.querySelector('#ranking .ranking__item .ranking__overflow')?.open`, 3000);
      const overflow = await page.evaluate(`(() => ({
        labels: [...document.querySelectorAll('#ranking .ranking__item:first-child .ranking__overflow .movie-item__overflow-action')]
          .map((button) => button.textContent.trim()),
        targets: [...document.querySelectorAll('#ranking .ranking__item:first-child .ranking__overflow .movie-item__overflow-action')]
          .map((button) => {
            const bounds = button.getBoundingClientRect();
            return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
          })
      }))()`);
      if (
        overflow.labels.join("|") !== "Info|Re-rank|Remove" ||
        overflow.targets.some((target) => target.width < 44 || target.height < 44)
      ) {
        throw new Error(`${label} overflow semantics are wrong: ${JSON.stringify(overflow)}`);
      }
      await tapSelector("#ranking .ranking__item .ranking__overflow > summary");
      await waitFor(page, `!document.querySelector('#ranking .ranking__item .ranking__overflow')?.open`, 3000);

      await tapSelector("#ranking-move-toggle");
      await waitFor(page, `document.querySelector('#ranking')?.classList.contains('is-move-mode')`, 3000);
      const moveMode = await page.evaluate(`(() => {
        const handle = document.querySelector('#ranking .ranking__item .ranking__handle');
        const bounds = handle?.getBoundingClientRect();
        return {
          pressed: document.querySelector('#ranking-move-toggle')?.getAttribute('aria-pressed'),
          handleDisplay: handle ? getComputedStyle(handle).display : '',
          handleWidth: Math.round(bounds?.width || 0),
          handleHeight: Math.round(bounds?.height || 0),
          overflowDisplay: getComputedStyle(document.querySelector('#ranking .ranking__item .ranking__overflow')).display
        };
      })()`);
      if (
        moveMode.pressed !== "true" ||
        moveMode.handleDisplay === "none" ||
        moveMode.handleWidth < 44 ||
        moveMode.handleHeight < 44 ||
        moveMode.overflowDisplay !== "none"
      ) {
        throw new Error(`${label} Move mode is wrong: ${JSON.stringify(moveMode)}`);
      }
      await tapSelector("#ranking-move-toggle");
      await waitFor(page, `!document.querySelector('#ranking')?.classList.contains('is-move-mode')`, 3000);
      return { rowTap, overflow, moveMode };
    };
    const readPackShelfLayout = async () =>
      page.evaluate(`(() => {
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? {
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : null;
        };
        const columnCount = (value) => String(value || '').split(' ').filter(Boolean).length;
        const row = document.querySelector('#pack-row');
        const rowStyle = row ? getComputedStyle(row) : null;
        const pointerCoarse = matchMedia('(pointer: coarse)').matches;
        const range = (values) => {
          const numeric = values.filter((value) => Number.isFinite(value));
          return numeric.length ? Math.round(Math.max(...numeric) - Math.min(...numeric)) : null;
        };
        const cards = [...document.querySelectorAll('#pack-row .pack-card')].map((card) => {
          const action = card.querySelector('.pack-card__action');
          const actionStyle = action ? getComputedStyle(action) : null;
          const title = card.querySelector('.pack-card__title');
          const subtitle = card.querySelector('.pack-card__subtitle');
          return {
            slug: card.dataset.slug,
            card: rect(card),
            cover: rect(card.querySelector('.pack-cover')),
            title: rect(title),
            subtitle: rect(subtitle),
            status: rect(card.querySelector('.pack-card__status')),
            progress: rect(card.querySelector('.pack-card__progress')),
            action: rect(action),
            actionText: action?.textContent.trim() || '',
            actionFontSize: actionStyle?.fontSize || '',
            actionScrollWidth: action?.scrollWidth || 0,
            actionClientWidth: action?.clientWidth || 0,
            titleText: title?.textContent.trim() || '',
            titleScrollHeight: title?.scrollHeight || 0,
            titleClientHeight: title?.clientHeight || 0,
            subtitleScrollHeight: subtitle?.scrollHeight || 0,
            subtitleClientHeight: subtitle?.clientHeight || 0
          };
        });
        const firstThree = cards.slice(0, 3);
        const overlaps = (a, b) => !!a && !!b &&
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        return {
          destination: document.querySelector('main.app')?.dataset.appDestination,
          pointerCoarse,
          portrait: matchMedia('(orientation: portrait)').matches,
          row: rect(row),
          gridTemplateColumns: rowStyle?.gridTemplateColumns || '',
          gridColumnCount: columnCount(rowStyle?.gridTemplateColumns),
          cardCount: cards.length,
          firstThreeShareRow: firstThree.length === 3 &&
            firstThree.every((card) => Math.abs(card.card.top - firstThree[0].card.top) < 3),
          cards,
          brokenCards: cards.filter((card) =>
            !card.card ||
            !card.cover ||
            !card.action ||
            card.card.width < 210 ||
            card.card.height > 260 ||
            card.cover.width < 60 ||
            card.cover.width > 92 ||
            card.cover.height < 64 ||
            card.cover.height > 86 ||
            (pointerCoarse
              ? card.action.height < 44 || card.action.width < 44
              : card.action.height < 34 || card.action.height > 40 || card.action.width < 104 || card.action.width > 150) ||
            card.actionFontSize === '0px' ||
            card.actionScrollWidth > card.actionClientWidth + 1 ||
            overlaps(card.action, card.progress) ||
            overlaps(card.cover, card.title) ||
            overlaps(card.cover, card.subtitle)
          ).map((card) => ({
            slug: card.slug,
            card: card.card,
            cover: card.cover,
            action: card.action,
            actionText: card.actionText,
            actionFontSize: card.actionFontSize,
            actionScrollWidth: card.actionScrollWidth,
            actionClientWidth: card.actionClientWidth
          })),
          firstThreeActionTopRange: range(firstThree.map((card) => card.action?.top)),
          firstThreeActionBottomRange: range(firstThree.map((card) => card.action?.bottom)),
          firstThreeActionHeightRange: range(firstThree.map((card) => card.action?.height)),
          firstThreeActionWidthRange: range(firstThree.map((card) => card.action?.width)),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth
        };
      })()`);
    const assertLargeScreenDiscoverPackShelf = (label, layout, options = {}) => {
      const expectedPointerCoarse = options.expectedPointerCoarse ?? true;
      if (
        layout.destination !== "discover" ||
        layout.pointerCoarse !== expectedPointerCoarse ||
        layout.gridColumnCount !== 3 ||
        layout.cardCount !== 3 ||
        !layout.firstThreeShareRow ||
        !layout.row ||
        layout.row.height > 260 ||
        layout.brokenCards.length ||
        layout.firstThreeActionTopRange > 2 ||
        layout.firstThreeActionBottomRange > 2 ||
        layout.firstThreeActionHeightRange > 1 ||
        layout.firstThreeActionWidthRange > 6 ||
        layout.scrollWidth > layout.innerWidth
      ) {
        throw new Error(`${label} pack shelf is wrong: ${JSON.stringify(layout)}`);
      }
    };
    const readAllPacksLayout = async () =>
      page.evaluate(`(() => {
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? {
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : null;
        };
        const range = (values) => {
          const numeric = values.filter((value) => Number.isFinite(value));
          return numeric.length ? Math.round(Math.max(...numeric) - Math.min(...numeric)) : null;
        };
        const list = document.querySelector('#pack-detail-list');
        const listStyle = list ? getComputedStyle(list) : null;
        const pointerCoarse = matchMedia('(pointer: coarse)').matches;
        const cards = [...document.querySelectorAll('#pack-detail-list .pack-card')]
          .filter((card) => {
            const bounds = card.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
          })
          .slice(0, 12)
          .map((card) => {
            const action = card.querySelector('.pack-card__action');
            const actionStyle = action ? getComputedStyle(action) : null;
            return {
              slug: card.dataset.slug,
              card: rect(card),
              title: rect(card.querySelector('.pack-card__title')),
              subtitle: rect(card.querySelector('.pack-card__subtitle')),
              status: rect(card.querySelector('.pack-card__status')),
              progress: rect(card.querySelector('.pack-card__progress')),
              action: rect(action),
              actionFontSize: actionStyle?.fontSize || '',
              actionScrollWidth: action?.scrollWidth || 0,
              actionClientWidth: action?.clientWidth || 0
            };
          });
        const rows = [];
        for (const card of cards) {
          if (!card.card) continue;
          const row = rows.find((item) => Math.abs(item.top - card.card.top) < 4);
          if (row) {
            row.items.push(card);
          } else {
            rows.push({ top: card.card.top, items: [card] });
          }
        }
        const rowSummaries = rows.map((row) => ({
          top: row.top,
          count: row.items.length,
          actionTopRange: range(row.items.map((card) => card.action?.top)),
          actionBottomRange: range(row.items.map((card) => card.action?.bottom)),
          actionHeightRange: range(row.items.map((card) => card.action?.height)),
          actionWidthRange: range(row.items.map((card) => card.action?.width)),
          progressTopRange: range(row.items.map((card) => card.progress?.top)),
          progressBottomRange: range(row.items.map((card) => card.progress?.bottom))
        }));
        return {
          overlayOpen: !document.querySelector('#pack-detail')?.hidden &&
            document.querySelector('#pack-detail')?.classList.contains('is-all-packs'),
          pointerCoarse,
          list: rect(list),
          gridTemplateColumns: listStyle?.gridTemplateColumns || '',
          gridColumnCount: String(listStyle?.gridTemplateColumns || '').split(' ').filter(Boolean).length,
          totalCards: document.querySelectorAll('#pack-detail-list .pack-card').length,
          cards,
          rows: rowSummaries,
          brokenCards: cards.filter((card) =>
            !card.card ||
            !card.action ||
            card.action.height < 34 ||
            card.action.height > 40 ||
            card.action.width < 104 ||
            card.action.width > 150 ||
            card.actionFontSize === '0px' ||
            card.actionScrollWidth > card.actionClientWidth + 1
          ).map((card) => ({
            slug: card.slug,
            card: card.card,
            action: card.action,
            actionFontSize: card.actionFontSize,
            actionScrollWidth: card.actionScrollWidth,
            actionClientWidth: card.actionClientWidth
          })),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth
        };
      })()`);
    const assertAllPacksPackGrid = (label, layout, shelfLayout) => {
      const badRows = layout.rows.filter((row) =>
        row.count > 1 &&
        (
          row.actionTopRange > 2 ||
          row.actionBottomRange > 2 ||
          row.actionHeightRange > 1 ||
          row.actionWidthRange > 6 ||
          row.progressTopRange > 2 ||
          row.progressBottomRange > 2
        )
      );
      const shelfAction = shelfLayout?.cards?.[0]?.action;
      const allPacksAction = layout.cards?.[0]?.action;
      const mismatchedShelfAction = !layout.pointerCoarse && !!shelfAction && !!allPacksAction &&
        (
          Math.abs(shelfAction.width - allPacksAction.width) > 8 ||
          Math.abs(shelfAction.height - allPacksAction.height) > 1
        );
      if (
        !layout.overlayOpen ||
        !layout.pointerCoarse ||
        layout.gridColumnCount < 3 ||
        layout.totalCards < 12 ||
        layout.brokenCards.length ||
        badRows.length ||
        mismatchedShelfAction ||
        layout.scrollWidth > layout.innerWidth
      ) {
        throw new Error(`${label} pack grid is wrong: ${JSON.stringify({ ...layout, badRows, mismatchedShelfAction, shelfAction, allPacksAction })}`);
      }
    };
    const readLargeScreenListsLayout = async () =>
      page.evaluate(`(() => {
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? {
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : null;
        };
        const visible = (element) => {
          const bounds = element?.getBoundingClientRect();
          const style = element ? getComputedStyle(element) : null;
          return !!bounds &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            style?.display !== 'none' &&
            style?.visibility !== 'hidden';
        };
        const list = document.querySelector('#watch-list');
        const listStyle = list ? getComputedStyle(list) : null;
        const first = document.querySelector('#watch-list .queue-list__item');
        const cards = [...document.querySelectorAll('#watch-list .queue-list__item')].slice(0, 4).map((card) => rect(card));
        const actionMetrics = [...(first?.querySelectorAll('.queue-list__actions > .movie-item__action') || [])].map((button) => {
          const bounds = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return {
            text: button.textContent.trim(),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
            display: style.display,
            visibility: style.visibility
          };
        });
        const visibleActions = actionMetrics.filter((action) =>
          action.width > 0 &&
          action.height > 0 &&
          action.display !== 'none' &&
          action.visibility !== 'hidden'
        );
        return {
          destination: document.querySelector('main.app')?.dataset.appDestination,
          pointerCoarse: matchMedia('(pointer: coarse)').matches,
          portrait: matchMedia('(orientation: portrait)').matches,
          panel: rect(document.querySelector('.panel--queues')),
          sideStack: rect(document.querySelector('.side-stack')),
          watchVisible: visible(document.querySelector('#watch-list')),
          hiddenVisible: visible(document.querySelector('#not-interested-list')),
          watchSelected: document.querySelector('#watch-list-tab')?.getAttribute('aria-selected'),
          hiddenSelected: document.querySelector('#hidden-list-tab')?.getAttribute('aria-selected'),
          listStyle: {
            maxHeight: listStyle?.maxHeight || '',
            overflowY: listStyle?.overflowY || '',
            gridTemplateColumns: listStyle?.gridTemplateColumns || '',
            gridColumnCount: String(listStyle?.gridTemplateColumns || '').split(' ').filter(Boolean).length
          },
          listClientHeight: list?.clientHeight || 0,
          listScrollHeight: list?.scrollHeight || 0,
          cardCount: document.querySelectorAll('#watch-list .queue-list__item').length,
          cards,
          firstRowCount: cards.length
            ? cards.filter((card) => Math.abs(card.top - cards[0].top) < 3).length
            : 0,
          firstTwoShareRow: cards.length >= 2 && Math.abs(cards[0].top - cards[1].top) < 3,
          firstThirdStartsNewRow: cards.length >= 3 && cards[2].top > cards[0].bottom,
          visibleActionLabels: visibleActions.map((action) => action.text),
          visibleActions,
          hiddenActions: actionMetrics.filter((action) => action.width === 0 || action.height === 0 || action.display === 'none'),
          overflowVisible: visible(first?.querySelector('.movie-item__overflow-toggle')),
          detailVisible: visible(first?.querySelector('.movie-item__detail')),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth
        };
      })()`);
    const assertLargeScreenListsLayout = (label, layout, options = {}) => {
      const expectedPointerCoarse = options.expectedPointerCoarse ?? true;
      const minPanelWidth = options.minPanelWidth ?? layout.innerWidth * 0.84;
      const hasBadVisibleAction = layout.visibleActions.some((action) =>
        expectedPointerCoarse
          ? action.width < 44 || action.height < 44
          : action.width < 60 || action.height < 34 || action.width > 92 || action.height > 42
      );
      if (
        layout.destination !== "lists" ||
        layout.pointerCoarse !== expectedPointerCoarse ||
        !layout.watchVisible ||
        layout.hiddenVisible ||
        layout.watchSelected !== "true" ||
        layout.hiddenSelected !== "false" ||
        !layout.panel ||
        layout.panel.width < minPanelWidth ||
        layout.listStyle.maxHeight !== "none" ||
        layout.listStyle.overflowY !== "visible" ||
        layout.listStyle.gridColumnCount < 2 ||
        layout.listStyle.gridColumnCount > 3 ||
        layout.cardCount < 4 ||
        !layout.firstTwoShareRow ||
        layout.firstRowCount !== layout.listStyle.gridColumnCount ||
        layout.visibleActionLabels.join("|") !== "Rank" ||
        !layout.overflowVisible ||
        layout.detailVisible ||
        hasBadVisibleAction ||
        layout.listScrollHeight > layout.listClientHeight + 2 ||
        layout.scrollWidth > layout.innerWidth
      ) {
        throw new Error(`${label} Lists layout is wrong: ${JSON.stringify(layout)}`);
      }
    };
    const readOverflowVisibilityGuard = async () =>
      page.evaluate(`(() => {
        const overflow = document.createElement('details');
        overflow.className = 'movie-item__overflow';
        overflow.open = true;
        const summary = document.createElement('summary');
        const menu = document.createElement('div');
        menu.className = 'movie-item__overflow-menu';
        menu.textContent = 'Overflow';
        overflow.append(summary, menu);
        document.body.append(overflow);
        const unpositionedStyle = getComputedStyle(menu);
        const unpositioned = {
          display: unpositionedStyle.display,
          visibility: unpositionedStyle.visibility
        };
        menu.classList.add('is-positioned');
        const positionedStyle = getComputedStyle(menu);
        const positioned = {
          display: positionedStyle.display,
          visibility: positionedStyle.visibility
        };
        overflow.remove();
        return { unpositioned, positioned };
      })()`);
    const assertOverflowVisibilityGuard = (layout) => {
      if (
        layout.unpositioned.display === "none" ||
        layout.unpositioned.visibility !== "hidden" ||
        layout.positioned.display === "none" ||
        layout.positioned.visibility !== "visible"
      ) {
        throw new Error(`Overflow visibility guard is wrong: ${JSON.stringify(layout)}`);
      }
    };
    const readOpenQueueOverflowLayout = async (listSelector) =>
      page.evaluate(`(() => {
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? {
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : null;
        };
        const item = document.querySelector(${JSON.stringify(`${listSelector} .queue-list__item:first-child`)});
        const overflow = item?.querySelector('.queue-list__overflow');
        const toggle = overflow?.querySelector('summary');
        const menu = overflow?.querySelector('.movie-item__overflow-menu');
        const menuRect = rect(menu);
        const toggleRect = rect(toggle);
        const hit = menuRect ? document.elementFromPoint(menuRect.left + 12, menuRect.top + 12) : null;
        return {
          destination: document.querySelector('main.app')?.dataset.appDestination,
          open: !!overflow?.open,
          itemRaised: !!item?.classList.contains('is-overflow-open'),
          itemTransform: item ? getComputedStyle(item).transform : '',
          menuPosition: menu ? getComputedStyle(menu).position : '',
          menuDisplay: menu ? getComputedStyle(menu).display : '',
          menuVisibility: menu ? getComputedStyle(menu).visibility : '',
          menuPositioned: !!menu?.classList.contains('is-positioned'),
          item: rect(item),
          toggle: toggleRect,
          menu: menuRect,
          labels: [...(menu?.querySelectorAll('.movie-item__overflow-action') || [])]
            .map((button) => button.textContent.trim()),
          menuTopGap: menuRect && toggleRect ? menuRect.top - toggleRect.bottom : null,
          menuRightGap: menuRect && toggleRect ? toggleRect.right - menuRect.right : null,
          menuWithinItemColumn: !!menuRect && !!rect(item) &&
            menuRect.left >= rect(item).left - 1 &&
            menuRect.right <= rect(item).right + 1,
          hitInMenu: !!hit?.closest('.movie-item__overflow-menu'),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth
        };
      })()`);
    const assertDesktopQueueOverflowLayout = (label, layout, expectedLabels) => {
      if (
        layout.destination !== "lists" ||
        !layout.open ||
        !layout.itemRaised ||
        layout.itemTransform !== "none" ||
        layout.menuPosition !== "fixed" ||
        layout.menuDisplay === "none" ||
        layout.menuVisibility !== "visible" ||
        !layout.menuPositioned ||
        !layout.item ||
        !layout.toggle ||
        !layout.menu ||
        layout.labels.join("|") !== expectedLabels ||
        layout.menuTopGap < 0 ||
        layout.menuTopGap > 8 ||
        Math.abs(layout.menuRightGap) > 3 ||
        !layout.menuWithinItemColumn ||
        !layout.hitInMenu ||
        layout.scrollWidth > layout.innerWidth
      ) {
        throw new Error(`${label} queue overflow menu is detached: ${JSON.stringify(layout)}`);
      }
    };

    await switchAppDestination("lists");
    await wait(100);
    const desktopOverflowVisibilityGuard = await readOverflowVisibilityGuard();
    assertOverflowVisibilityGuard(desktopOverflowVisibilityGuard);
    const desktopLists = await readLargeScreenListsLayout();
    assertLargeScreenListsLayout("Desktop", desktopLists, {
      expectedPointerCoarse: false,
      minPanelWidth: 1000,
    });
    const desktopListsShot = await page.screenshot("app-shell-desktop-lists.png");
    await page.evaluate(`document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow > summary')?.click(); true;`);
    await waitFor(page, `document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow')?.open`, 3000);
    const desktopWatchOverflow = await readOpenQueueOverflowLayout("#watch-list");
    assertDesktopQueueOverflowLayout("Desktop Watch next", desktopWatchOverflow, "Info|Hide|Remove");
    const desktopWatchOverflowShot = await page.screenshot("app-shell-desktop-watch-overflow.png");
    await page.evaluate(`document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow > summary')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow')?.open`, 3000);
    await page.evaluate(`document.querySelector('#hidden-list-tab')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#hidden-list-tab')?.getAttribute('aria-selected') === 'true' &&
        document.querySelector('#not-interested-list')?.getBoundingClientRect().height > 0`,
      3000,
    );
    await page.evaluate(`document.querySelector('#not-interested-list .queue-list__item:first-child .queue-list__overflow > summary')?.click(); true;`);
    await waitFor(page, `document.querySelector('#not-interested-list .queue-list__item:first-child .queue-list__overflow')?.open`, 3000);
    const desktopHiddenOverflow = await readOpenQueueOverflowLayout("#not-interested-list");
    assertDesktopQueueOverflowLayout("Desktop Hidden", desktopHiddenOverflow, "Info|Save|Remove");
    await page.evaluate(`document.querySelector('#not-interested-list .queue-list__item:first-child .queue-list__overflow > summary')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#not-interested-list .queue-list__item:first-child .queue-list__overflow')?.open`, 3000);
    await page.evaluate(`document.querySelector('#watch-list-tab')?.click(); true;`);
    await waitFor(page, `document.querySelector('#watch-list-tab')?.getAttribute('aria-selected') === 'true'`, 3000);
    await switchAppDestination("rank");

    await switchAppDestination("discover");
    await page.evaluate(`document.querySelector('#pack-section')?.scrollIntoView({ block: 'start' }); true;`);
    await wait(100);
    const desktopDiscoverPacks = await readPackShelfLayout();
    assertLargeScreenDiscoverPackShelf("Desktop Discover", desktopDiscoverPacks, {
      expectedPointerCoarse: false,
    });
    const desktopDiscoverPacksShot = await page.screenshot("app-shell-desktop-discover-packs.png");
    await switchAppDestination("rank");

    const fineTabletCapabilities = await setDeviceProfile(page, {
      width: 1024,
      height: 768,
      input: DEVICE_INPUT_PROFILE.fine,
    });
    await page.evaluate(`window.scrollTo(0, 0); true;`);
    const fineTabletLandscape = await readRankModalityLayout();
    // Linux headless Chrome can report pointer:none / hover:none after touch
    // emulation is disabled. The non-touch state plus rendered direct-action
    // contract is the portable authority for this synthetic desktop profile.
    if (
      fineTabletCapabilities.pointerCoarse ||
      fineTabletCapabilities.maxTouchPoints !== 0 ||
      !fineTabletLandscape.sideLeftOfRail ||
      !fineTabletLandscape.topNavVisible ||
      fineTabletLandscape.mobileNavVisible ||
      fineTabletLandscape.toolbarControls.map((control) => control.label).join("|") !== "Review|Filter|Full screen|Share" ||
      fineTabletLandscape.visibleDirectActionLabels.join("|") !== "Info|Re-rank|Move|Remove" ||
      fineTabletLandscape.overflow.visible ||
      fineTabletLandscape.scrollWidth > fineTabletLandscape.innerWidth
    ) {
      throw new Error(`1024px fine-pointer Rank layout is wrong: ${JSON.stringify({ fineTabletCapabilities, fineTabletLandscape })}`);
    }
    const fineTabletLandscapeShot = await page.screenshot("app-shell-desktop-1024-rank.png");

    const ipadLandscapeCapabilities = await setDeviceProfile(page, {
      width: 1024,
      height: 768,
      input: DEVICE_INPUT_PROFILE.coarseTouch,
      deviceScaleFactor: 2,
    });
    const ipadLandscape = await readRankModalityLayout();
    assertCoarseRankLayout("iPad landscape", ipadLandscape, "Review|Filter|Full screen|Move|Share");
    const sameLandscapeTopology =
      fineTabletLandscape.appColumns === ipadLandscape.appColumns &&
      fineTabletLandscape.appAreas === ipadLandscape.appAreas &&
      Math.abs(fineTabletLandscape.side.width - ipadLandscape.side.width) <= 1 &&
      Math.abs(fineTabletLandscape.rail.width - ipadLandscape.rail.width) <= 1 &&
      fineTabletLandscape.sideLeftOfRail &&
      ipadLandscape.sideLeftOfRail;
    if (!sameLandscapeTopology) {
      throw new Error(`1024px layout changed with input modality: ${JSON.stringify({ fineTabletLandscape, ipadLandscape })}`);
    }
    const ipadRankTargetsLandscape = await readVisibleControlTargets([".panel--list", ".app-nav--top"]);
    assertCoarseControlTargets("iPad landscape Rank", ipadRankTargetsLandscape);
    const ipadHoverSuppression = await readCoarseHoverSuppression(
      "#ranking .ranking__item .movie-item__overflow-toggle",
    );
    assertCoarseHoverSuppressed("iPad landscape Rank", ipadHoverSuppression);
    const ipadRankInteractionsLandscape = await exerciseCoarseRankControls("iPad landscape Rank");
    const ipadLandscapeShot = await page.screenshot("app-shell-ipad-landscape-rank.png");

    await switchAppDestination("discover");
    await page.evaluate(`document.querySelector('#pack-section')?.scrollIntoView({ block: 'start' }); true;`);
    await wait(100);
    const ipadDiscoverPacksLandscape = await readPackShelfLayout();
    assertLargeScreenDiscoverPackShelf("iPad landscape Discover", ipadDiscoverPacksLandscape);
    const ipadDiscoverTargetsLandscape = await readVisibleControlTargets([
      ".panel--discovery",
      "#pack-section",
      ".app-nav--top",
    ]);
    assertCoarseControlTargets("iPad landscape Discover", ipadDiscoverTargetsLandscape);
    const ipadDiscoverPacksLandscapeShot = await page.screenshot("app-shell-ipad-landscape-discover-packs.png");
    await page.evaluate(`document.querySelector('#pack-view-all')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail')?.classList.contains('is-all-packs') &&
        document.querySelectorAll('#pack-detail-list .pack-card').length >= 12`,
      5000,
    );
    await wait(100);
    const ipadAllPacksLandscape = await readAllPacksLayout();
    assertAllPacksPackGrid("iPad landscape All Packs", ipadAllPacksLandscape, ipadDiscoverPacksLandscape);
    const ipadAllPacksLandscapeShot = await page.screenshot("app-shell-ipad-landscape-all-packs.png");
    await page.evaluate(`document.querySelector('#pack-detail-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#pack-detail')?.hidden`, 3000);
    await switchAppDestination("lists");
    await wait(100);
    const ipadListsLandscape = await readLargeScreenListsLayout();
    assertLargeScreenListsLayout("iPad landscape", ipadListsLandscape);
    const ipadListsTargetsLandscape = await readVisibleControlTargets([".panel--queues", ".app-nav--top"]);
    assertCoarseControlTargets("iPad landscape Lists", ipadListsTargetsLandscape);
    const ipadListsLandscapeShot = await page.screenshot("app-shell-ipad-landscape-lists.png");
    await switchAppDestination("rank");

    const ipadPortraitCapabilities = await setDeviceProfile(page, {
      width: 980,
      height: 1180,
      input: DEVICE_INPUT_PROFILE.coarseTouch,
      deviceScaleFactor: 2,
    });
    const ipadPortrait = await readRankModalityLayout();
    assertCoarseRankLayout("iPad portrait", ipadPortrait, "Review|Filter|Full screen|Move|Share");
    if (!ipadPortrait.sideLeftOfRail || !ipadPortrait.appAreas.includes('"list stack"')) {
      throw new Error(`iPad portrait did not keep the large-screen two-column topology: ${JSON.stringify(ipadPortrait)}`);
    }
    const ipadRankTargetsPortrait = await readVisibleControlTargets([".panel--list", ".app-nav--top"]);
    assertCoarseControlTargets("iPad portrait Rank", ipadRankTargetsPortrait);
    const ipadPortraitShot = await page.screenshot("app-shell-ipad-portrait-rank.png");

    await switchAppDestination("discover");
    await page.evaluate(`document.querySelector('#pack-section')?.scrollIntoView({ block: 'start' }); true;`);
    await wait(100);
    const ipadDiscoverPacksPortrait = await readPackShelfLayout();
    assertLargeScreenDiscoverPackShelf("iPad portrait Discover", ipadDiscoverPacksPortrait);
    const ipadDiscoverTargetsPortrait = await readVisibleControlTargets([
      ".panel--discovery",
      "#pack-section",
      ".app-nav--top",
    ]);
    assertCoarseControlTargets("iPad portrait Discover", ipadDiscoverTargetsPortrait);
    const ipadDiscoverPacksPortraitShot = await page.screenshot("app-shell-ipad-portrait-discover-packs.png");
    await page.evaluate(`document.querySelector('#pack-view-all')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail')?.classList.contains('is-all-packs') &&
        document.querySelectorAll('#pack-detail-list .pack-card').length >= 12`,
      5000,
    );
    await wait(100);
    const ipadAllPacksPortrait = await readAllPacksLayout();
    assertAllPacksPackGrid("iPad portrait All Packs", ipadAllPacksPortrait, ipadDiscoverPacksPortrait);
    const ipadAllPacksPortraitShot = await page.screenshot("app-shell-ipad-portrait-all-packs.png");
    await page.evaluate(`document.querySelector('#pack-detail-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#pack-detail')?.hidden`, 3000);
    await switchAppDestination("lists");
    await wait(100);
    const ipadListsPortrait = await readLargeScreenListsLayout();
    assertLargeScreenListsLayout("iPad portrait", ipadListsPortrait);
    const ipadListsTargetsPortrait = await readVisibleControlTargets([".panel--queues", ".app-nav--top"]);
    assertCoarseControlTargets("iPad portrait Lists", ipadListsTargetsPortrait);
    const ipadListsPortraitShot = await page.screenshot("app-shell-ipad-portrait-lists.png");
    await switchAppDestination("rank");

    const iphoneCapabilities = await setDeviceProfile(page, {
      width: 390,
      height: 844,
      input: DEVICE_INPUT_PROFILE.coarseTouch,
      deviceScaleFactor: 3,
    });
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
        pointerCoarse: matchMedia('(pointer: coarse)').matches,
        pointerFine: matchMedia('(pointer: fine)').matches,
        anyPointerCoarse: matchMedia('(any-pointer: coarse)').matches,
        hoverHover: matchMedia('(hover: hover)').matches,
        hoverNone: matchMedia('(hover: none)').matches,
        maxTouchPoints: navigator.maxTouchPoints,
        add: rect('.panel--add'),
        ranking: rect('.panel--list'),
        discoveryVisible: inFlow('.panel--discovery'),
        queueVisible: [...document.querySelectorAll('.panel--queues')].some((panel) => {
          const bounds = panel.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        }),
        mobileNav: rect('.app-nav--mobile'),
        topNavVisible: inFlow('.app-nav--top'),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        innerHeight,
        toolbarControls: (() => {
          const expectedIds = ['ranking-add-jump', 'ranking-review', 'ranking-filter-toggle', 'ranking-expand', 'ranking-move-toggle'];
          return expectedIds.map((id) => {
            const button = document.getElementById(id);
            const label = button?.querySelector('.icon-button__label');
            const bounds = button?.getBoundingClientRect();
            const labelBounds = label?.getBoundingClientRect();
            const buttonStyle = button ? getComputedStyle(button) : null;
            const labelStyle = label ? getComputedStyle(label) : null;
            return {
              id,
              label: label?.textContent.trim() || button?.getAttribute('aria-label') || '',
              ariaLabel: button?.getAttribute('aria-label') || '',
              buttonWidth: bounds?.width || 0,
              buttonHeight: bounds?.height || 0,
              labelWidth: labelBounds?.width || 0,
              labelHeight: labelBounds?.height || 0,
              display: buttonStyle?.display || '',
              visibility: buttonStyle?.visibility || '',
              opacity: buttonStyle?.opacity || '',
              labelDisplay: labelStyle?.display || '',
              scrollWidth: button?.scrollWidth || 0
            };
          });
        })(),
        toolbarRows: (() => {
          const controls = [...document.querySelectorAll('.panel--list .panel__actions .icon-button')].filter((button) => {
            const bounds = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return bounds.width > 0 && bounds.height > 0 && style.display !== 'none';
          });
          return [...new Set(controls.map((button) => Math.round(button.getBoundingClientRect().top)))];
        })(),
        rowControls: (() => {
          const first = document.querySelector('#ranking .ranking__item');
          const visible = (selector) => {
            const element = first?.querySelector(selector);
            const bounds = element?.getBoundingClientRect();
            const style = element ? getComputedStyle(element) : null;
            return !!bounds &&
              bounds.width >= 44 &&
              bounds.height >= 44 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              style.pointerEvents !== 'none';
          };
          const rank = first?.querySelector('.movie-item__rank');
          const poster = first?.querySelector('.movie-item__poster');
          const actions = first?.querySelector('.movie-item__actions');
          const originalRank = rank?.textContent || '';
          if (rank) rank.textContent = '113';
          const rankRect = rank?.getBoundingClientRect();
          const posterRect = poster?.getBoundingClientRect();
          if (rank) rank.textContent = originalRank;
          const actionRects = [...(actions?.querySelectorAll('.movie-item__action') || [])].map((button) => {
            const bounds = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return {
              text: button.textContent.trim(),
              width: bounds.width,
              height: bounds.height,
              display: style.display,
              visibility: style.visibility,
              pointerEvents: style.pointerEvents
            };
          });
          const overflow = first?.querySelector('.ranking__overflow');
          const overflowToggle = first?.querySelector('.movie-item__overflow-toggle');
          const overflowBounds = overflowToggle?.getBoundingClientRect();
          const visibleRows = [...document.querySelectorAll('#ranking .ranking__item')].filter((item) => {
            const bounds = item.getBoundingClientRect();
            return bounds.bottom < window.innerHeight - 72;
          }).length;
          return {
            rowTouchAction: first ? getComputedStyle(first).touchAction : '',
            handleTouchAction: first?.querySelector('.ranking__handle')
              ? getComputedStyle(first.querySelector('.ranking__handle')).touchAction
              : '',
            infoVisible: visible('.ranking__info'),
            restackVisible: visible('.ranking__restack'),
            handleVisible: visible('.ranking__handle'),
            removeVisible: visible('.ranking__delete'),
            overflowVisible: !!overflowBounds &&
              overflowBounds.width >= 44 &&
              overflowBounds.height >= 44 &&
              getComputedStyle(overflow).display !== 'none',
            overflowCount: first?.querySelectorAll('.movie-item__overflow-toggle').length ?? 0,
            actionLabels: actionRects.map((action) => action.text),
            actionRects,
            visibleRows,
            tripleRankClearance: rankRect && posterRect ? posterRect.left - rankRect.right : null
          };
        })()
      };
    })()`);
    if (
      mobileRank.destination !== "rank" ||
      !mobileRank.pointerCoarse ||
      mobileRank.pointerFine ||
      !mobileRank.anyPointerCoarse ||
      mobileRank.hoverHover ||
      !mobileRank.hoverNone ||
      mobileRank.maxTouchPoints < 1 ||
      !mobileRank.add ||
      !mobileRank.ranking ||
      mobileRank.ranking.top >= mobileRank.innerHeight ||
      mobileRank.discoveryVisible ||
      mobileRank.queueVisible ||
      !mobileRank.mobileNav ||
      mobileRank.mobileNav.height < 68 ||
      mobileRank.topNavVisible ||
      mobileRank.scrollWidth > mobileRank.innerWidth ||
      mobileRank.toolbarControls.map((control) => control.label).join("|") !== "Add|Review|Filter|Full screen|Move" ||
      mobileRank.toolbarRows.length !== 1 ||
      mobileRank.toolbarControls.some((control) =>
        control.buttonWidth < 44 ||
        control.buttonHeight < 44 ||
        control.labelWidth !== 0 ||
        control.labelHeight !== 0 ||
        control.display === "none" ||
        control.visibility === "hidden" ||
        control.opacity === "0" ||
        control.labelDisplay !== "none" ||
        control.scrollWidth > Math.ceil(control.buttonWidth)
      ) ||
      mobileRank.rowControls.rowTouchAction !== "pan-y" ||
      mobileRank.rowControls.handleTouchAction !== "none" ||
      mobileRank.rowControls.infoVisible ||
      mobileRank.rowControls.restackVisible ||
      mobileRank.rowControls.handleVisible ||
      mobileRank.rowControls.removeVisible ||
      !mobileRank.rowControls.overflowVisible ||
      mobileRank.rowControls.overflowCount !== 1 ||
      mobileRank.rowControls.visibleRows < 4 ||
      mobileRank.rowControls.tripleRankClearance < 4
    ) {
      throw new Error(`Mobile Rank shell is wrong: ${JSON.stringify({ iphoneCapabilities, mobileRank })}`);
    }

    const iphoneRankTargets = await readVisibleControlTargets([".panel--list", ".app-nav--mobile"]);
    assertCoarseControlTargets("iPhone Rank", iphoneRankTargets);

    await tapSelector("#ranking .ranking__item .ranking__overflow > summary");
    await waitFor(
      page,
      `(() => {
        const menu = document.querySelector('#ranking .ranking__item .ranking__overflow .movie-item__overflow-menu');
        const rect = menu?.getBoundingClientRect();
        return document.querySelector('#ranking .ranking__item .ranking__overflow')?.open && rect && rect.top > 0 && rect.height > 80;
      })()`,
      3000,
    );
    const mobileRankOverflow = await page.evaluate(`(() => {
      const item = document.querySelector('#ranking .ranking__item');
      const menu = item?.querySelector('.ranking__overflow .movie-item__overflow-menu');
      const toggle = item?.querySelector('.ranking__overflow > summary');
      const menuRect = menu?.getBoundingClientRect();
      const toggleRect = toggle?.getBoundingClientRect();
      const hit = menuRect ? document.elementFromPoint(menuRect.left + 12, menuRect.top + 12) : null;
      const occlusionSamples = menuRect ? [
        { name: 'top-right', x: menuRect.right - 16, y: menuRect.top + 18 },
        { name: 'middle-right', x: menuRect.right - 16, y: menuRect.top + menuRect.height / 2 },
        { name: 'bottom-right', x: menuRect.right - 16, y: menuRect.bottom - 18 }
      ].map((point) => {
        const target = document.elementFromPoint(point.x, point.y);
        return {
          name: point.name,
          className: target?.className || '',
          text: target?.textContent?.trim() || '',
          inMenu: !!target?.closest('.movie-item__overflow-menu')
        };
      }) : [];
      return {
        open: item?.querySelector('.ranking__overflow')?.open,
        itemRaised: item?.classList.contains('is-overflow-open'),
        labels: [...(item?.querySelectorAll('.ranking__overflow .movie-item__overflow-action') || [])]
          .map((button) => button.textContent.trim()),
        actionMetrics: [...(item?.querySelectorAll('.ranking__overflow .movie-item__overflow-action') || [])]
          .map((button) => ({
            text: button.textContent.trim(),
            width: Math.round(button.getBoundingClientRect().width),
            height: Math.round(button.getBoundingClientRect().height),
            scrollWidth: button.scrollWidth,
            clientWidth: button.clientWidth,
            whiteSpace: getComputedStyle(button).whiteSpace
          })),
        position: menu ? getComputedStyle(menu).position : '',
        display: menu ? getComputedStyle(menu).display : '',
        rect: menuRect ? {
          left: Math.round(menuRect.left),
          top: Math.round(menuRect.top),
          right: Math.round(menuRect.right),
          bottom: Math.round(menuRect.bottom),
          width: Math.round(menuRect.width),
          height: Math.round(menuRect.height)
        } : null,
        toggleBottom: toggleRect ? Math.round(toggleRect.bottom) : null,
        hitText: hit?.textContent?.trim() || '',
        occlusionSamples,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    })()`);
    if (
      !mobileRankOverflow.open ||
      !mobileRankOverflow.itemRaised ||
      mobileRankOverflow.labels.join("|") !== "Info|Re-rank|Remove" ||
      mobileRankOverflow.position !== "fixed" ||
      mobileRankOverflow.display === "none" ||
      !mobileRankOverflow.rect ||
      mobileRankOverflow.rect.width < 152 ||
      mobileRankOverflow.rect.height < 100 ||
      mobileRankOverflow.rect.left < 0 ||
      mobileRankOverflow.rect.right > mobileRankOverflow.viewport.width ||
      mobileRankOverflow.rect.top < 0 ||
      mobileRankOverflow.rect.bottom > mobileRankOverflow.viewport.height ||
      !mobileRankOverflow.hitText.includes("Info") ||
      !mobileRankOverflow.actionMetrics.every((action) =>
        action.whiteSpace === "nowrap" &&
        action.scrollWidth <= action.clientWidth + 1 &&
        action.width >= 120 &&
        action.height >= 44
      ) ||
      !mobileRankOverflow.occlusionSamples.every((sample) => sample.inMenu)
    ) {
      throw new Error(`Mobile Rank overflow menu is wrong: ${JSON.stringify(mobileRankOverflow)}`);
    }
    const mobileRankOverflowShot = await page.screenshot("app-shell-mobile-ranking-overflow.png");
    const mobileRankInfoTap = await page.evaluate(`(() => {
      const action = document.querySelector('#ranking .ranking__item .ranking__overflow .movie-item__overflow-action.ranking__info');
      const rect = action?.getBoundingClientRect();
      if (!rect) return null;
      const point = { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        ...point,
        hitInfo: hit === action || hit?.closest('.movie-item__overflow-action.ranking__info') === action,
        hitText: hit?.textContent?.trim() || '',
        hitClass: hit?.className || ''
      };
    })()`);
    if (!mobileRankInfoTap?.hitInfo) {
      throw new Error(`Missing mobile ranking overflow Info target: ${JSON.stringify(mobileRankInfoTap)}`);
    }
    await tapAt(page, mobileRankInfoTap.x, mobileRankInfoTap.y);
    await waitFor(page, `!document.querySelector('#movie-detail')?.hidden`, 3000);
    const mobileRankDetailLayer = await page.evaluate(`(() => {
      const point = ${JSON.stringify(mobileRankInfoTap)};
      const target = document.elementFromPoint(point.x, point.y);
      const detail = document.querySelector('#movie-detail');
      const overflowZ = getComputedStyle(document.querySelector('.movie-item__overflow-menu')).zIndex;
      const visibleMenus = [...document.querySelectorAll('.movie-item__overflow-menu')].filter((menu) => {
        const style = getComputedStyle(menu);
        const rect = menu.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      return {
        detailHidden: detail?.hidden,
        detailZ: Number(getComputedStyle(detail).zIndex),
        overflowZ: Number(overflowZ),
        openMenus: document.querySelectorAll('.movie-item__overflow[open]').length,
        visibleMenus: visibleMenus.length,
        raisedRows: document.querySelectorAll('.ranking__item.is-overflow-open, .queue-list__item.is-overflow-open, .fullscreen-card.is-overflow-open').length,
        topInDetail: !!target?.closest('#movie-detail'),
        topClass: target?.className || '',
        activeElementLabel: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || ''
      };
    })()`);
    if (
      mobileRankDetailLayer.detailHidden ||
      mobileRankDetailLayer.detailZ <= 1250 ||
      mobileRankDetailLayer.overflowZ >= mobileRankDetailLayer.detailZ ||
      mobileRankDetailLayer.openMenus !== 0 ||
      mobileRankDetailLayer.visibleMenus !== 0 ||
      mobileRankDetailLayer.raisedRows !== 0 ||
      !mobileRankDetailLayer.topInDetail
    ) {
      throw new Error(`Mobile Rank overflow Info detail is layered wrong: ${JSON.stringify(mobileRankDetailLayer)}`);
    }
    const mobileRankOverflowDetailShot = await page.screenshot("app-shell-mobile-ranking-overflow-detail.png");
    await tapSelector("#detail-close");
    await waitFor(page, `document.querySelector('#movie-detail')?.hidden`, 3000);
    await tapSelector("#ranking .ranking__item .ranking__overflow > summary");
    await waitFor(
      page,
      `document.querySelector('#ranking .ranking__item .ranking__overflow')?.open`,
      3000,
    );
    const mobileRankOutsideTap = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('#ranking .ranking__item')].slice(1);
      for (const row of rows) {
        const targets = [
          row.querySelector('.movie-item__poster'),
          row.querySelector('.movie-item__rank'),
          row.querySelector('.movie-item__body')
        ].filter(Boolean);
        for (const target of targets) {
          const rect = target.getBoundingClientRect();
          const points = [
            { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
            { x: Math.round(rect.left + Math.min(rect.width - 4, 12)), y: Math.round(rect.top + rect.height / 2) }
          ];
          for (const point of points) {
            const hit = document.elementFromPoint(point.x, point.y);
            if (
              hit?.closest('.ranking__item') === row &&
              !hit.closest('.movie-item__overflow') &&
              point.y > 0 &&
              point.y < window.innerHeight - 80
            ) {
              return point;
            }
          }
        }
      }
      return null;
    })()`);
    if (!mobileRankOutsideTap) throw new Error("Missing mobile ranking outside-tap target");
    await tapAt(page, mobileRankOutsideTap.x, mobileRankOutsideTap.y);
    await waitFor(page, `!document.querySelector('.movie-item__overflow[open]')`, 3000);
    const mobileRankDismissState = await page.evaluate(`(() => ({
      detailHidden: document.querySelector('#movie-detail')?.hidden,
      detailTitle: document.querySelector('#detail-title')?.textContent.trim(),
      openMenus: document.querySelectorAll('.movie-item__overflow[open]').length
    }))()`);
    if (!mobileRankDismissState.detailHidden || mobileRankDismissState.openMenus !== 0) {
      throw new Error(`Mobile Rank outside-tap dismissal opened detail: ${JSON.stringify(mobileRankDismissState)}`);
    }
    await page.evaluate(`document.querySelector('#ranking .ranking__item .ranking__overflow')?.removeAttribute('open'); true;`);

    await tapSelector("#ranking-move-toggle");
    await wait(100);
    const mobileMoveMode = await page.evaluate(`(() => {
      const first = document.querySelector('#ranking .ranking__item');
      const handle = first?.querySelector('.ranking__handle');
      const handleBounds = handle?.getBoundingClientRect();
      return {
        active: document.querySelector('#ranking')?.classList.contains('is-move-mode'),
        pressed: document.querySelector('#ranking-move-toggle')?.getAttribute('aria-pressed'),
        handleDisplay: handle ? getComputedStyle(handle).display : '',
        handleWidth: Math.round(handleBounds?.width || 0),
        handleHeight: Math.round(handleBounds?.height || 0),
        overflowDisplay: first ? getComputedStyle(first.querySelector('.ranking__overflow')).display : ''
      };
    })()`);
    if (
      !mobileMoveMode.active ||
      mobileMoveMode.pressed !== "true" ||
      mobileMoveMode.handleDisplay === "none" ||
      mobileMoveMode.handleWidth < 44 ||
      mobileMoveMode.handleHeight < 44 ||
      mobileMoveMode.overflowDisplay !== "none"
    ) {
      throw new Error(`Mobile move mode controls are wrong: ${JSON.stringify(mobileMoveMode)}`);
    }
    await page.evaluate(`document.querySelector('#ranking .ranking__item[data-index="0"] .ranking__handle')?.focus(); true;`);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      windowsVirtualKeyCode: 40,
      code: "ArrowDown",
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')][1]?.textContent.trim() === 'Alpha' &&
        document.activeElement?.closest('.ranking__item')?.dataset.index === '1'`,
      3000,
    );
    const mobileKeyboardMoveDown = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      focusedIndex: document.activeElement?.closest('.ranking__item')?.dataset.index || '',
      focusedLabel: document.activeElement?.getAttribute('aria-label') || '',
      keyshortcuts: document.activeElement?.getAttribute('aria-keyshortcuts') || '',
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || ''
    }))()`);
    if (
      mobileKeyboardMoveDown.rankingTitles.slice(0, 2).join("|") !== "Beta|Alpha" ||
      mobileKeyboardMoveDown.focusedIndex !== "1" ||
      !mobileKeyboardMoveDown.focusedLabel.includes("Move Alpha") ||
      mobileKeyboardMoveDown.keyshortcuts !== "ArrowUp ArrowDown" ||
      !mobileKeyboardMoveDown.feedback.includes('"Alpha" moved to #2 of 5.')
    ) {
      throw new Error(`Mobile keyboard move down is wrong: ${JSON.stringify(mobileKeyboardMoveDown)}`);
    }
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowUp",
      windowsVirtualKeyCode: 38,
      code: "ArrowUp",
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')][0]?.textContent.trim() === 'Alpha' &&
        document.activeElement?.closest('.ranking__item')?.dataset.index === '0'`,
      3000,
    );
    const mobileKeyboardMoveUp = await page.evaluate(`(() => ({
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      focusedIndex: document.activeElement?.closest('.ranking__item')?.dataset.index || '',
      focusedLabel: document.activeElement?.getAttribute('aria-label') || '',
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || ''
    }))()`);
    if (
      mobileKeyboardMoveUp.rankingTitles.slice(0, 2).join("|") !== "Alpha|Beta" ||
      mobileKeyboardMoveUp.focusedIndex !== "0" ||
      !mobileKeyboardMoveUp.focusedLabel.includes("Move Alpha") ||
      !mobileKeyboardMoveUp.feedback.includes('"Alpha" moved to #1 of 5.')
    ) {
      throw new Error(`Mobile keyboard move up is wrong: ${JSON.stringify(mobileKeyboardMoveUp)}`);
    }
    await tapSelector("#ranking-move-toggle");
    await wait(100);

    await tapSelector('.app-nav--mobile [data-app-destination-target="discover"]');
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
        packShelf: (() => {
          const row = document.querySelector('#pack-row');
          const rowStyle = row ? getComputedStyle(row) : null;
          const columnCount = String(rowStyle?.gridTemplateColumns || '').split(' ').filter(Boolean).length;
          const cards = [...document.querySelectorAll('#pack-row .pack-card')].map((card) => {
            const bounds = card.getBoundingClientRect();
            return { top: Math.round(bounds.top), width: Math.round(bounds.width), height: Math.round(bounds.height) };
          });
          const firstThreeShareRow = cards.slice(0, 3).length === 3 &&
            cards.slice(0, 3).every((card) => Math.abs(card.top - cards[0].top) < 3);
          return { columnCount, cardCount: cards.length, firstThreeShareRow, minCardWidth: Math.min(...cards.map((card) => card.width)) };
        })(),
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
      mobileDiscover.packShelf.columnCount !== 1 ||
      mobileDiscover.packShelf.cardCount !== 3 ||
      mobileDiscover.packShelf.firstThreeShareRow ||
      mobileDiscover.packShelf.minCardWidth < 300 ||
      mobileDiscover.scrollY < 400 ||
      mobileDiscover.scrollWidth > mobileDiscover.innerWidth
    ) {
      throw new Error(`Mobile Discover shell is wrong: ${JSON.stringify(mobileDiscover)}`);
    }
    const iphoneDiscoverTargets = await readVisibleControlTargets([
      ".panel--discovery",
      "#pack-section",
      ".app-nav--mobile",
    ]);
    assertCoarseControlTargets("iPhone Discover", iphoneDiscoverTargets);
    const discoverShot = await page.screenshot("app-shell-mobile-discover.png");

    await tapSelector('.app-nav--mobile [data-app-destination-target="lists"]');
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
        watchSelected: document.querySelector('#watch-list-tab')?.getAttribute('aria-selected'),
        hiddenSelected: document.querySelector('#hidden-list-tab')?.getAttribute('aria-selected'),
        firstActionLabels: [...document.querySelectorAll('#watch-list .queue-list__item:first-child .movie-item__action')]
          .map((button) => button.textContent.trim()),
        overflowCount: document.querySelectorAll('#watch-list .queue-list__item:first-child .movie-item__overflow-toggle').length,
        firstActionRects: [...document.querySelectorAll('#watch-list .queue-list__item:first-child .movie-item__action')]
          .map((button) => {
            const bounds = button.getBoundingClientRect();
            return { text: button.textContent.trim(), width: bounds.width, height: bounds.height };
          }),
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
      mobileLists.hiddenVisible ||
      mobileLists.watchSelected !== "true" ||
      mobileLists.hiddenSelected !== "false" ||
      mobileLists.firstActionLabels.join("|") !== "Rank|Hide|Remove" ||
      mobileLists.overflowCount !== 1 ||
      !mobileLists.firstActionRects.some((action) => action.text === "Rank" && action.width >= 44 && action.height >= 44) ||
      mobileLists.firstActionRects.some((action) => action.text !== "Rank" && (action.width > 0 || action.height > 0)) ||
      mobileLists.addVisible ||
      mobileLists.rankingVisible ||
      mobileLists.discoveryVisible ||
      mobileLists.scrollWidth > mobileLists.innerWidth
    ) {
      throw new Error(`Mobile Lists shell is wrong: ${JSON.stringify(mobileLists)}`);
    }
    const iphoneListsTargets = await readVisibleControlTargets([".panel--queues", ".app-nav--mobile"]);
    assertCoarseControlTargets("iPhone Lists", iphoneListsTargets);

    await page.evaluate(`document.querySelector('#watch-list .queue-list__item:first-child')?.scrollIntoView({ block: 'center' }); true;`);
    await wait(50);
    await tapSelector("#watch-list .queue-list__item:first-child .queue-list__overflow > summary");
    await waitFor(
      page,
      `document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow')?.open`,
      3000,
    );
    await waitFor(
      page,
      `(() => {
        const action = document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow .movie-item__overflow-action.queue-info-action');
        const rect = action?.getBoundingClientRect();
        return !!rect && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth;
      })()`,
      3000,
    );
    const iphoneQueueMenuTargets = await readVisibleControlTargets([
      "#watch-list .queue-list__item:first-child .queue-list__overflow .movie-item__overflow-menu",
    ]);
    assertCoarseControlTargets("iPhone Watch next overflow", iphoneQueueMenuTargets);
    const mobileQueueInfoTap = await page.evaluate(`(() => {
      const action = document.querySelector('#watch-list .queue-list__item:first-child .queue-list__overflow .movie-item__overflow-action.queue-info-action');
      const rect = action?.getBoundingClientRect();
      if (!rect) return null;
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    })()`);
    if (!mobileQueueInfoTap) throw new Error("Missing mobile queue overflow Info target");
    await tapAt(page, mobileQueueInfoTap.x, mobileQueueInfoTap.y);
    await waitFor(page, `!document.querySelector('#movie-detail')?.hidden`, 3000);
    const mobileQueueDetailLayer = await page.evaluate(`(() => {
      const point = ${JSON.stringify(mobileQueueInfoTap)};
      const target = document.elementFromPoint(point.x, point.y);
      const detail = document.querySelector('#movie-detail');
      return {
        detailHidden: detail?.hidden,
        detailZ: Number(getComputedStyle(detail).zIndex),
        openMenus: document.querySelectorAll('.movie-item__overflow[open]').length,
        raisedRows: document.querySelectorAll('.ranking__item.is-overflow-open, .queue-list__item.is-overflow-open, .fullscreen-card.is-overflow-open').length,
        topInDetail: !!target?.closest('#movie-detail'),
        topClass: target?.className || ''
      };
    })()`);
    if (
      mobileQueueDetailLayer.detailHidden ||
      mobileQueueDetailLayer.detailZ <= 1250 ||
      mobileQueueDetailLayer.openMenus !== 0 ||
      mobileQueueDetailLayer.raisedRows !== 0 ||
      !mobileQueueDetailLayer.topInDetail
    ) {
      throw new Error(`Mobile Queue overflow Info detail is layered wrong: ${JSON.stringify(mobileQueueDetailLayer)}`);
    }
    const mobileQueueOverflowDetailShot = await page.screenshot("app-shell-mobile-queue-overflow-detail.png");
    await tapSelector("#detail-close");
    await waitFor(page, `document.querySelector('#movie-detail')?.hidden`, 3000);

    await tapSelector('.app-nav--mobile [data-app-destination-target="discover"]');
    await wait(100);
    const restored = await page.evaluate(`window.scrollY`);
    if (Math.abs(restored - mobileDiscover.scrollY) > 8) {
      throw new Error(`Discover scroll was not restored: ${JSON.stringify({ before: mobileDiscover.scrollY, restored })}`);
    }

    await switchAppDestination("rank");
    const iphoneLandscapeCapabilities = await setDeviceProfile(page, {
      width: 844,
      height: 390,
      input: DEVICE_INPUT_PROFILE.coarseTouch,
      deviceScaleFactor: 3,
    });
    const iphoneLandscape = await readRankModalityLayout();
    assertCoarseRankLayout(
      "iPhone landscape",
      iphoneLandscape,
      "Add|Review|Filter|Full screen|Move|Share",
      { twoColumn: false },
    );
    if (iphoneLandscape.topNavVisible) {
      throw new Error(`iPhone landscape retained desktop navigation: ${JSON.stringify(iphoneLandscape)}`);
    }
    const iphoneLandscapeTargets = await readVisibleControlTargets([
      ".panel--list",
      ".app-nav--mobile",
    ]);
    assertCoarseControlTargets("iPhone landscape Rank", iphoneLandscapeTargets);
    const iphoneLandscapeShot = await page.screenshot("app-shell-iphone-landscape-rank.png");

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: {
        desktop,
        desktopLists,
        desktopOverflowVisibilityGuard,
        desktopWatchOverflow,
        desktopHiddenOverflow,
        desktopDiscoverPacks,
        fineTabletCapabilities,
        fineTabletLandscape,
        ipadLandscapeCapabilities,
        ipadLandscape,
        ipadRankTargetsLandscape,
        ipadHoverSuppression,
        ipadRankInteractionsLandscape,
        ipadDiscoverPacksLandscape,
        ipadDiscoverTargetsLandscape,
        ipadListsLandscape,
        ipadListsTargetsLandscape,
        ipadPortraitCapabilities,
        ipadPortrait,
        ipadRankTargetsPortrait,
        ipadDiscoverPacksPortrait,
        ipadDiscoverTargetsPortrait,
        ipadListsPortrait,
        ipadListsTargetsPortrait,
        iphoneCapabilities,
        mobileRank,
        iphoneRankTargets,
        mobileRankOverflow,
        mobileRankDetailLayer,
        mobileDiscover,
        iphoneDiscoverTargets,
        mobileLists,
        iphoneListsTargets,
        iphoneQueueMenuTargets,
        mobileQueueDetailLayer,
        restored,
        iphoneLandscapeCapabilities,
        iphoneLandscape,
        iphoneLandscapeTargets,
      },
      screenshots: [
        desktopShot,
        desktopInfoHoverShot,
        desktopListsShot,
        desktopWatchOverflowShot,
        desktopDiscoverPacksShot,
        fineTabletLandscapeShot,
        ipadLandscapeShot,
        ipadDiscoverPacksLandscapeShot,
        ipadAllPacksLandscapeShot,
        ipadListsLandscapeShot,
        ipadPortraitShot,
        ipadDiscoverPacksPortraitShot,
        ipadAllPacksPortraitShot,
        ipadListsPortraitShot,
        iphoneLandscapeShot,
        mobileRankOverflowShot,
        mobileRankOverflowDetailShot,
        discoverShot,
        mobileQueueOverflowDetailShot,
      ].filter(Boolean),
    };
  } finally {
    await page.close();
  }
};

const testPrimaryActionVisualSystem = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "primary-action-visual-system", width: 1440, height: 900 });
  try {
    await seedPage(page, baseUrl, "primary-action-visual-system", {
      ranking: [
        movie("Alpha", 1990, 2101),
        movie("Beta", 1995, 2102),
        movie("Gamma", 2000, 2103),
        movie("Delta", 2005, 2104),
        movie("Epsilon", 2010, 2105),
      ],
      watchList: [queueMovie("Saved", 2020, 2106), queueMovie("Later Pick", 2019, 2107)],
    });
    await waitFor(
      page,
      `document.querySelectorAll('#pack-row .pack-card__action').length === 3 &&
        document.querySelector('.suggest-card .movie-item__action--primary')`,
      10000,
    );

    const primarySelectors = {
      addSearch: ".panel--add .field input",
      packStartOrContinue: "#pack-row .pack-card:not(.pack-card--completed) .pack-card__action",
      movieRank: ".suggest-card .movie-item__action--primary",
      tonightPicker: "#tonight-run",
      fullscreenJump: "#fullscreen-jump-button",
      sharePublish: "#share-link-publish",
      shareDownload: "#share-download-png",
      detailRank: "#detail-rank",
      packRankAll: "#pack-auto-start",
      importMatch: "#title-import-match",
      importApply: "#title-import-apply",
      signInMagicLink: "#signin-magic-send",
    };
    const primaryActions = await page.evaluate(`(() => {
      const selectors = ${JSON.stringify(primarySelectors)};
      return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [name, null];
        const style = getComputedStyle(element);
        return [name, {
          selector,
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderTopColor: style.borderTopColor,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
          fontWeight: style.fontWeight
        }];
      }));
    })()`);
    const invalidPrimaryActions = Object.entries(primaryActions).filter(([name, style]) =>
      !style ||
      style.backgroundColor !== "rgb(255, 255, 255)" ||
      style.color !== "rgb(17, 17, 17)" ||
      style.borderTopColor !== "rgb(17, 17, 17)" ||
      style.borderTopWidth !== "1px" ||
      !style.boxShadow.includes("inset") ||
      (name !== "addSearch" && Number.parseInt(style.fontWeight, 10) < 650)
    );
    if (invalidPrimaryActions.length) {
      throw new Error(
        `High-value actions do not share the editorial keyline treatment: ${JSON.stringify({
          invalidPrimaryActions,
          primaryActions,
        })}`,
      );
    }

    const reservedInkStates = await page.evaluate(`(() => {
      const read = (selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return { backgroundColor: style.backgroundColor, color: style.color };
      };
      return {
        selectedListTab: read('#watch-list-tab'),
        packProgress: read('#pack-row .pack-card__progress span')
      };
    })()`);
    if (
      reservedInkStates.selectedListTab.backgroundColor !== "rgb(17, 17, 17)" ||
      reservedInkStates.selectedListTab.color !== "rgb(255, 255, 255)" ||
      reservedInkStates.packProgress.backgroundColor !== "rgb(17, 17, 17)"
    ) {
      throw new Error(`Black is not reserved for selection and progress states: ${JSON.stringify(reservedInkStates)}`);
    }
    const appShot = await page.screenshot("primary-actions-app.png");

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844,
    });
    await wait(100);
    const mobileAddSearch = await page.evaluate(`(() => {
      const element = document.querySelector('.panel--add .field input');
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        height: bounds.height
      };
    })()`);
    if (
      mobileAddSearch.backgroundColor !== "rgb(255, 255, 255)" ||
      mobileAddSearch.color !== "rgb(17, 17, 17)" ||
      mobileAddSearch.borderTopColor !== "rgb(17, 17, 17)" ||
      mobileAddSearch.borderTopWidth !== "1px" ||
      !mobileAddSearch.boxShadow.includes("inset") ||
      mobileAddSearch.height < 48
    ) {
      throw new Error(`Mobile Add search does not use the touch-sized keyline treatment: ${JSON.stringify(mobileAddSearch)}`);
    }
    const mobileShot = await page.screenshot("primary-actions-mobile.png");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1440,
      screenHeight: 900,
    });

    await page.send("Page.navigate", { url: `${baseUrl}/shared.html` });
    await waitFor(page, `document.readyState === 'complete' && document.querySelector('.shared-cta')`, 10000);
    const sharedCta = await page.evaluate(`(() => {
      const style = getComputedStyle(document.querySelector('.shared-cta'));
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        fontWeight: style.fontWeight,
        textTransform: style.textTransform
      };
    })()`);
    if (
      sharedCta.backgroundColor !== "rgb(255, 255, 255)" ||
      sharedCta.color !== "rgb(17, 17, 17)" ||
      sharedCta.borderTopColor !== "rgb(17, 17, 17)" ||
      sharedCta.borderTopWidth !== "1px" ||
      !sharedCta.boxShadow.includes("inset") ||
      Number.parseInt(sharedCta.fontWeight, 10) < 650 ||
      sharedCta.textTransform !== "none"
    ) {
      throw new Error(`Shared-list CTA does not use the editorial keyline treatment: ${JSON.stringify(sharedCta)}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { primaryActions, reservedInkStates, mobileAddSearch, sharedCta },
      screenshots: [appShot, mobileShot, await page.screenshot("primary-actions-shared-list.png")],
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
      empty.body !== "Search above, start a pack below, or import an ordered list." ||
      empty.importHidden ||
      empty.packTitle !== "Start with a movie pack" ||
      empty.starterSlugs.join("|") !== expectedStarterSlugs.join("|") ||
      empty.moduleSrc !== "app.js?v=179" ||
      empty.cssHref !== "styles.css?v=146" ||
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
    await waitFor(page, `document.activeElement?.id === 'new-card'`, 3000);
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
    await waitFor(
      page,
      `document.querySelector('#add-feedback')?.textContent.includes(
        'Browser storage is having trouble. Download a backup before leaving.'
      )`,
      3000,
    );
    const state = await page.evaluate(`(() => ({
      rankingCount: document.querySelectorAll('#ranking .ranking__item').length,
      storedCount: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.length || 0,
      status: document.querySelector('#api-status')?.textContent.trim(),
      backupEnabled: !document.querySelector('#download-backup')?.disabled,
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || '',
      feedbackActions: [...document.querySelectorAll('#add-feedback button')].map((button) =>
        button.textContent.trim()
      )
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
      !state.feedback.includes("Browser storage is having trouble. Download a backup before leaving.") ||
      state.feedbackActions.join("|") !== "Download backup|Sign in to sync" ||
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
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    await wait(250);
    const mobileDetail = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('#movie-detail .detail-meta > div')];
      const lastRow = rows.at(-1);
      const sheet = document.querySelector('#movie-detail .detail-sheet');
      return {
        rowCount: rows.length,
        lastRowBorderBottom: lastRow ? getComputedStyle(lastRow).borderBottomWidth : null,
        detailHidden: document.querySelector('#movie-detail')?.hidden,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        sheetRight: sheet?.getBoundingClientRect().right ?? null
      };
    })()`);
    if (
      failed.sectionErrors.length !== 3 ||
      !failed.searchStatus?.includes("Search is unavailable") ||
      !failed.refreshEnabled ||
      recovered.popularTitle !== "Recovered Popular" ||
      recoveredSearchTitle !== "Recovered Search" ||
      !recovered.detailSub?.includes("1h 51m") ||
      recovered.detailStatus ||
      !recovered.detailRetryHidden ||
      mobileDetail.detailHidden ||
      mobileDetail.rowCount < 2 ||
      mobileDetail.lastRowBorderBottom !== "0px" ||
      mobileDetail.scrollWidth > mobileDetail.innerWidth ||
      mobileDetail.sheetRight > mobileDetail.innerWidth
    ) {
      throw new Error(`TMDB failure recovery is wrong: ${JSON.stringify({ failed, recovered, mobileDetail })}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { failed, recoveredSearchTitle, recovered, mobileDetail },
      screenshots: [failedShot, await page.screenshot("tmdb-failure-recovered-mobile-detail.png")],
    };
  } finally {
    await page.close();
  }
};

const testMovieDetailClearsBetweenRankedMovies = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "movie-detail-clears-between-ranked-movies" });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const realFetch = window.fetch.bind(window);
          const response = (value, status = 200) => Promise.resolve(new Response(
            JSON.stringify(value),
            { status, headers: { 'Content-Type': 'application/json' } }
          ));
          window.__e2eSecondDetailRequested = false;
          window.__e2eResolveSecondDetail = null;
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tmdb-detail')) {
              const id = Number(new URL(url).searchParams.get('id'));
              if (id === 2131) {
                return response({
                  result: {
                    tmdbId: id,
                    runtime: 101,
                    genres: ['Drama'],
                    overview: 'First detail overview must not linger.',
                    director: 'First Director',
                    cast: ['First Actor']
                  }
                });
              }
              if (id === 2132) {
                window.__e2eSecondDetailRequested = true;
                return new Promise((resolve) => {
                  window.__e2eResolveSecondDetail = () => resolve(new Response(JSON.stringify({
                    result: {
                      tmdbId: id,
                      runtime: 102,
                      genres: ['Comedy'],
                      overview: 'Second detail overview loaded.',
                      director: 'Second Director',
                      cast: ['Second Actor']
                    }
                  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                });
              }
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "movie-detail-clears-between-ranked-movies", {
      ranking: [movie("First Detail", 2001, 2131), movie("Second Detail", 2002, 2132)],
    });
    await page.evaluate(`document.querySelector('#ranking .ranking__item:first-child .movie-item__body')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#detail-director')?.textContent.trim() === 'First Director'`,
      5000,
    );
    const firstLoaded = await page.evaluate(`(() => ({
      title: document.querySelector('#detail-title')?.textContent.trim(),
      director: document.querySelector('#detail-director')?.textContent.trim(),
      overview: document.querySelector('#detail-overview')?.textContent.trim()
    }))()`);
    const firstShot = await page.screenshot("movie-detail-first-loaded.png");
    await page.evaluate(`document.querySelector('#detail-close')?.click(); true;`);
    await waitFor(page, `document.querySelector('#movie-detail')?.hidden`, 3000);
    await page.evaluate(`document.querySelectorAll('#ranking .ranking__item')[1]?.querySelector('.movie-item__body')?.click(); true;`);
    await waitFor(
      page,
      `!document.querySelector('#movie-detail')?.hidden && window.__e2eSecondDetailRequested === true`,
      3000,
    );
    const secondLoading = await page.evaluate(`(() => ({
      title: document.querySelector('#detail-title')?.textContent.trim(),
      sub: document.querySelector('#detail-sub')?.textContent.trim(),
      genres: document.querySelector('#detail-genres')?.textContent.trim(),
      overview: document.querySelector('#detail-overview')?.textContent.trim(),
      director: document.querySelector('#detail-director')?.textContent.trim(),
      cast: document.querySelector('#detail-cast')?.textContent.trim(),
      status: document.querySelector('#detail-status')?.textContent.trim(),
      retryHidden: document.querySelector('#detail-retry')?.hidden
    }))()`);
    const loadingShot = await page.screenshot("movie-detail-second-loading-cleared.png");
    await page.evaluate(`window.__e2eResolveSecondDetail?.(); true;`);
    await waitFor(
      page,
      `document.querySelector('#detail-director')?.textContent.trim() === 'Second Director'`,
      5000,
    );
    const secondLoaded = await page.evaluate(`(() => ({
      title: document.querySelector('#detail-title')?.textContent.trim(),
      director: document.querySelector('#detail-director')?.textContent.trim(),
      overview: document.querySelector('#detail-overview')?.textContent.trim()
    }))()`);
    if (
      firstLoaded.title !== "First Detail" ||
      firstLoaded.director !== "First Director" ||
      secondLoading.title !== "Loading details" ||
      secondLoading.sub ||
      secondLoading.genres ||
      secondLoading.overview ||
      secondLoading.director ||
      secondLoading.cast ||
      secondLoading.status !== "Loading details..." ||
      !secondLoading.retryHidden ||
      JSON.stringify(secondLoading).includes("First") ||
      secondLoaded.title !== "Second Detail" ||
      secondLoaded.director !== "Second Director" ||
      !secondLoaded.overview?.includes("Second detail")
    ) {
      throw new Error(`Movie detail stale state was not cleared: ${JSON.stringify({ firstLoaded, secondLoading, secondLoaded })}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { firstLoaded, secondLoading, secondLoaded },
      screenshots: [firstShot, loadingShot, await page.screenshot("movie-detail-second-loaded.png")],
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
      swapHasIcon: !!document.querySelector('#review-swap svg, #review-swap .ui-icon'),
      endVisible: !document.querySelector('#review-end')?.hidden
    }))()`);
    if (
      opened.heading !== "Review your ranking" ||
      !/Pair 1 of/.test(opened.sub || "") ||
      !opened.higher ||
      !opened.lower ||
      !opened.keepVisible ||
      !opened.swapVisible ||
      opened.swapHasIcon ||
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
    const combobox = await page.evaluate(`(() => ({
      role: document.querySelector('#title')?.getAttribute('role'),
      autocomplete: document.querySelector('#title')?.getAttribute('aria-autocomplete'),
      expanded: document.querySelector('#title')?.getAttribute('aria-expanded'),
      controls: document.querySelector('#title')?.getAttribute('aria-controls'),
      popup: document.querySelector('#title')?.getAttribute('aria-haspopup'),
      activeDescendant: document.querySelector('#title')?.getAttribute('aria-activedescendant') || '',
      listboxRole: document.querySelector('#suggestions')?.getAttribute('role'),
      optionIds: [...document.querySelectorAll('#suggestions .suggestions__item')].map((item) => item.id),
      optionRoles: [...document.querySelectorAll('#suggestions .suggestions__item')].map((item) =>
        item.getAttribute('role')
      ),
      optionSelected: [...document.querySelectorAll('#suggestions .suggestions__item')].map((item) =>
        item.getAttribute('aria-selected')
      )
    }))()`);
    if (
      combobox.role !== "combobox" ||
      combobox.autocomplete !== "list" ||
      combobox.expanded !== "true" ||
      combobox.controls !== "suggestions" ||
      combobox.popup !== "listbox" ||
      combobox.activeDescendant ||
      combobox.listboxRole !== "listbox" ||
      combobox.optionIds.join("|") !== "suggestions-option-0|suggestions-option-1" ||
      combobox.optionRoles.join("|") !== "option|option" ||
      combobox.optionSelected.join("|") !== "false|false"
    ) {
      throw new Error(`Autocomplete combobox semantics are wrong: ${JSON.stringify(combobox)}`);
    }
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
    const active = await page.evaluate(`(() => {
      const activeId = document.querySelector('#title')?.getAttribute('aria-activedescendant') || '';
      const activeOption = activeId ? document.getElementById(activeId) : null;
      return {
        title: activeOption?.querySelector('.suggestions__title')?.textContent.trim() || '',
        activeId,
        selectedValues: [...document.querySelectorAll('#suggestions .suggestions__item')].map((item) =>
          item.getAttribute('aria-selected')
        )
      };
    })()`);
    if (
      active.title !== "Keyboard Two" ||
      active.activeId !== "suggestions-option-1" ||
      active.selectedValues.join("|") !== "false|true"
    ) {
      throw new Error(`Arrow keys selected the wrong autocomplete result: ${JSON.stringify(active)}`);
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
      expanded: document.querySelector('#title')?.getAttribute('aria-expanded'),
      activeDescendant: document.querySelector('#title')?.getAttribute('aria-activedescendant') || '',
      newTitle: document.querySelector('#new-title')?.textContent.trim(),
      comparing: document.body.classList.contains('is-comparing')
    }))()`);
    if (
      selected.inputValue !== "Keyboard Two" ||
      selected.suggestionCount !== 0 ||
      selected.expanded !== "false" ||
      selected.activeDescendant ||
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
    return { details: { combobox, active, selected }, screenshots: [selectedShot] };
  } finally {
    await page.close();
  }
};

const testComparisonResponsiveLayouts = async ({ baseUrl }) => {
  const runViewport = async ({ name, width, height, orientation }) => {
    const page = await openChromePage({ name, width, height });
    try {
      await page.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `
          (() => {
            const realFetch = window.fetch.bind(window);
            const jsonResponse = (value) => Promise.resolve(new Response(JSON.stringify(value), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
            window.fetch = (input, options) => {
              const url = typeof input === 'string' ? input : input?.url || '';
              if (url.includes('/functions/v1/tmdb-suggest')) {
                return jsonResponse({ results: [] });
              }
              return realFetch(input, options);
            };
          })();
        `,
      });
      const withPoster = (base, posterPath) => ({ ...base, posterPath });
      await seedPage(page, baseUrl, name, {
        ranking: [
          withPoster(movie("Alpha", 1990, 1190), "/wby9315QzVKdW9BonAefg8jGTTb.jpg"),
          withPoster(movie("Beta", 2000, 1191), "/5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg"),
          withPoster(movie("Gamma", 2010, 1192), "/8OKmBV5BUFzmozIC3pPWKHy17kx.jpg"),
        ],
        watchList: [withPoster(queueMovie("Responsive Choice", 2024, 1193), "/15uOEfqBNTVtDUT7hGBVCka0rZz.jpg")],
      });
      await page.evaluate(`document.querySelector('#watch-list .queue-list__item')?.click(); true;`);
      await waitFor(page, `document.body.classList.contains('is-comparing')`, 3000);
      await waitFor(
        page,
        `Array.from(document.querySelectorAll('#compare .card__poster')).every((img) => img.complete && img.naturalWidth > 0)`,
        5000,
      );
      await wait(200);
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
        const firstPoster = rect('#new-poster');
        const secondPoster = rect('#existing-poster');
        const firstTitle = rect('#new-title');
        const firstMeta = rect('#new-meta');
        const secondTitle = rect('#existing-title');
        const secondMeta = rect('#existing-meta');
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
          firstPoster,
          secondPoster,
          firstTitle,
          firstMeta,
          secondTitle,
          secondMeta,
          firstHasPoster: document.querySelector('#new-card')?.classList.contains('has-poster'),
          secondHasPoster: document.querySelector('#existing-card')?.classList.contains('has-poster'),
          firstPosterShare: first && firstPoster ? firstPoster.height / first.height : 0,
          secondPosterShare: second && secondPoster ? secondPoster.height / second.height : 0,
          firstTitleMetaGap: firstTitle && firstMeta ? firstMeta.top - firstTitle.bottom : null,
          secondTitleMetaGap: secondTitle && secondMeta ? secondMeta.top - secondTitle.bottom : null,
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
        !layout.firstHasPoster ||
        !layout.secondHasPoster ||
        layout.firstPosterShare < 0.68 ||
        layout.secondPosterShare < 0.68 ||
        Math.abs(layout.firstTitleMetaGap ?? 999) > 8 ||
        Math.abs(layout.secondTitleMetaGap ?? 999) > 8 ||
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
      previewRole: document.querySelector('.share-preview-single')?.getAttribute('role'),
      previewTabIndex: document.querySelector('.share-preview-single')?.tabIndex,
      bottomDisabled: !!document.querySelector('#share-include-bottom')?.disabled,
      queuesDisabled: !!document.querySelector('#share-include-queues')?.disabled,
      packsDisabled: !!document.querySelector('#share-include-packs')?.disabled,
      nativeShareHidden: !!document.querySelector('#share-native-share')?.hidden,
      nativeShareAvailable: document.querySelector('#share-native-share')?.dataset.available,
      nativeShareDisabled: !!document.querySelector('#share-native-share')?.disabled,
      pngText: document.querySelector('#share-download-png')?.textContent.trim()
    }))()`);
    if (
      !singleState.previewSvg ||
      singleState.previewRole !== "button" ||
      singleState.previewTabIndex !== 0 ||
      singleState.nativeShareHidden === (singleState.nativeShareAvailable === "true") ||
      (singleState.nativeShareAvailable === "true" && singleState.nativeShareDisabled)
    ) {
      throw new Error(`Single-image Share preview semantics are wrong: ${JSON.stringify(singleState)}`);
    }
    if (!singleState.bottomDisabled || !singleState.queuesDisabled || !singleState.packsDisabled) {
      throw new Error(`Expected empty include toggles to be disabled: ${JSON.stringify(singleState)}`);
    }
    await page.evaluate(`document.querySelector('.share-preview-single')?.focus(); true;`);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await waitFor(page, `!document.querySelector('#share-lightbox')?.hidden`, 3000);
    const singleLightbox = await page.evaluate(`(() => ({
      shareMode: document.querySelector('#share-lightbox')?.classList.contains('is-share'),
      setMode: document.querySelector('#share-lightbox')?.classList.contains('is-set'),
      imageSvg: !!document.querySelector('#share-lightbox-image svg'),
      dialogRole: document.querySelector('#share-lightbox')?.getAttribute('role'),
      activeId: document.activeElement?.id,
      caption: document.querySelector('#share-lightbox-caption')?.textContent.trim(),
      downloadHidden: document.querySelector('#share-lightbox-download')?.hidden,
      backgroundInert: document.querySelector('#share-studio')?.inert
    }))()`);
    if (
      !singleLightbox.shareMode ||
      singleLightbox.setMode ||
      !singleLightbox.imageSvg ||
      singleLightbox.dialogRole !== "dialog" ||
      singleLightbox.activeId !== "share-lightbox-close" ||
      singleLightbox.caption ||
      singleLightbox.downloadHidden ||
      !singleLightbox.backgroundInert
    ) {
      throw new Error(`Single-image lightbox state is wrong: ${JSON.stringify(singleLightbox)}`);
    }
    await page.evaluate(`document.querySelector('#share-lightbox-image')?.focus(); true;`);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await waitFor(page, `document.querySelector('#share-lightbox')?.classList.contains('is-zoomed')`, 2000);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
    });
    await waitFor(page, `document.querySelector('#share-lightbox')?.hidden`, 2000);
    await waitFor(page, `document.activeElement?.classList.contains('share-preview-single')`, 2000);

    await page.evaluate(`document.querySelector('input[name="share-format"][value="set"]')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#share-preview figure svg').length >= 1`, 5000);
    const setState = await page.evaluate(`(() => ({
      cardCount: document.querySelectorAll('#share-preview figure svg').length,
      cardRole: document.querySelector('#share-preview figure')?.getAttribute('role'),
      cardTabIndex: document.querySelector('#share-preview figure')?.tabIndex,
      shapeHidden: !!document.querySelector('#share-shape-fieldset')?.hidden,
      pngText: document.querySelector('#share-download-png')?.textContent.trim(),
      svgText: document.querySelector('#share-download-svg')?.textContent.trim()
    }))()`);
    if (!setState.shapeHidden) throw new Error("Shape controls should hide for Image set format");
    if (setState.cardCount < 1 || setState.cardRole !== "button" || setState.cardTabIndex !== 0) {
      throw new Error(`Image set preview semantics are wrong: ${JSON.stringify(setState)}`);
    }
    await page.evaluate(`document.querySelector('#share-preview .share-preview-card')?.focus(); true;`);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
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
          isPrimary: true,
          button: 0,
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
        isPrimary: true,
        button: 0,
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
          if (query === 'Slow Close') {
            return new Promise((resolve) => {
              window.__resolveSlowImport = () => resolve(new Response(JSON.stringify({
                results: [{ tmdbId: 1306, title: 'Slow Close', year: 2024, posterPath: '' }]
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            });
          }
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
      input.value = 'Slow Close';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#title-import-match')?.click();
      return true;
    })()`);
    await waitFor(page, `document.querySelector('#title-import-match')?.textContent.trim() === 'Matching…'`, 3000);
    await page.evaluate(`(() => {
      document.querySelector('#title-import-close')?.click();
      window.__resolveSlowImport?.();
      return true;
    })()`);
    await wait(150);
    const canceledMatch = await page.evaluate(`(() => ({
      overlayHidden: document.querySelector('#title-import')?.hidden,
      reviewHidden: document.querySelector('#title-import-review')?.hidden,
      matchDisabled: document.querySelector('#title-import-match')?.disabled,
      matchText: document.querySelector('#title-import-match')?.textContent.trim(),
      status: document.querySelector('#title-import-status')?.textContent.trim()
    }))()`);
    if (
      !canceledMatch.overlayHidden ||
      !canceledMatch.reviewHidden ||
      canceledMatch.matchDisabled ||
      canceledMatch.matchText !== "Match titles" ||
      canceledMatch.status
    ) {
      throw new Error(`Closing import did not invalidate matching work: ${JSON.stringify(canceledMatch)}`);
    }
    await page.evaluate(`(() => {
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
      details: { canceledMatch, reviewState, imported, restored, afterReload },
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
            if (url.startsWith('https://image.tmdb.org/')) {
              const png = Uint8Array.from(
                atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='),
                (char) => char.charCodeAt(0)
              );
              return new Response(png, {
                status: 200,
                headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' }
              });
            }
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
        mergeNotice: document.querySelector('#add-feedback')?.textContent.trim() || '',
        mergeNoticeActions: [...document.querySelectorAll('#add-feedback button')].map((button) =>
          button.textContent.trim()
        ),
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
      !state.mergeNotice.includes("1 movie merged from another device was added to the bottom.") ||
      state.mergeNoticeActions.join("|") !== "Review order" ||
      state.packProgressGetCount < 1 ||
      state.packProgress["director-wes-anderson"]?.lastIndex !== 4 ||
      state.packProgress["year-1999"]?.lastIndex !== 1
    ) {
      throw new Error(`Signed-in merge/save adapter failed: ${JSON.stringify(state)}`);
    }

    await page.evaluate(`document.querySelector('#add-feedback button')?.click(); true;`);
    await waitFor(
      page,
      `document.body.classList.contains('is-reviewing') &&
        document.querySelector('#compare-sub')?.textContent.includes('Pair 1 of')`,
      3000,
    );
    const reviewStart = await page.evaluate(`(() => ({
      isReviewing: document.body.classList.contains('is-reviewing'),
      subtitle: document.querySelector('#compare-sub')?.textContent.trim() || '',
      firstLabel: document.querySelector('#new-card .card__label')?.textContent.trim() || '',
      secondLabel: document.querySelector('#existing-card .card__label')?.textContent.trim() || ''
    }))()`);
    if (
      !reviewStart.isReviewing ||
      !reviewStart.subtitle.includes('Still prefer #2 over #3?') ||
      reviewStart.firstLabel !== 'Currently #2' ||
      reviewStart.secondLabel !== 'Currently #3'
    ) {
      throw new Error(`Merge review action did not focus appended placement: ${JSON.stringify(reviewStart)}`);
    }
    await page.evaluate(`document.querySelector('#review-end')?.click(); true;`);
    await waitFor(page, `!document.body.classList.contains('is-reviewing')`, 3000);

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

    await page.evaluate(`(() => {
      window.__e2eConfirmCalls = [];
      window.__e2eConfirmResult = false;
      window.confirm = (message) => {
        window.__e2eConfirmCalls.push(message);
        return window.__e2eConfirmResult;
      };
      if (document.querySelector('#ranking-settings-panel')?.hidden) {
        document.querySelector('#ranking-settings-toggle')?.click();
      }
      document.querySelector('#settings-sign-out')?.click();
      return true;
    })()`);
    const cancelledSignOut = await page.evaluate(`(() => ({
      confirmCalls: window.__e2eConfirmCalls || [],
      rankingRows: document.querySelectorAll('#ranking .ranking__item').length,
      authTokenPresent: !!localStorage.getItem('sb-hrfhakrxsllrqmscxxpb-auth-token'),
      logoutCount: (window.__e2eSupabaseRequests || []).filter((request) =>
        request.url.includes('/auth/v1/logout')
      ).length
    }))()`);
    if (
      cancelledSignOut.confirmCalls.join("|") !==
        "Sign out? Your list stays in your account; this device will show an empty list." ||
      cancelledSignOut.rankingRows !== 3 ||
      !cancelledSignOut.authTokenPresent ||
      cancelledSignOut.logoutCount !== 0
    ) {
      throw new Error(`Cancelled sign-out did not preserve signed-in state: ${JSON.stringify(cancelledSignOut)}`);
    }

    await page.evaluate(`(() => {
      window.__e2eConfirmResult = true;
      document.querySelector('#settings-sign-out')?.click();
      return true;
    })()`);
    await waitFor(
      page,
      `(() => {
        const stored = JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}');
        return document.querySelectorAll('#ranking .ranking__item').length === 0 &&
          (stored.movies || []).length === 0 &&
          !localStorage.getItem('sb-hrfhakrxsllrqmscxxpb-auth-token');
      })()`,
      5000,
    );
    const signedOutState = await page.evaluate(`(() => ({
      confirmCalls: window.__e2eConfirmCalls || [],
      authState: document.querySelector('#settings-auth-state')?.textContent.trim(),
      authSignInVisible: !document.querySelector('#auth-sign-in')?.hidden,
      rankingRows: document.querySelectorAll('#ranking .ranking__item').length,
      storedTitles: JSON.parse(localStorage.getItem('stackrank:movies:v1') || '{}').movies?.map((entry) => entry.title) || [],
      logoutCount: (window.__e2eSupabaseRequests || []).filter((request) =>
        request.url.includes('/auth/v1/logout')
      ).length,
      rankingWriteCount: (window.__e2eSupabaseRequests || []).filter((request) =>
        request.method === 'POST' && request.url.includes('/rest/v1/rankings')
      ).length
    }))()`);
    if (
      signedOutState.confirmCalls.length !== 2 ||
      signedOutState.confirmCalls.some(
        (message) =>
          message !== "Sign out? Your list stays in your account; this device will show an empty list.",
      ) ||
      !signedOutState.authState.includes("Not signed in") ||
      !signedOutState.authSignInVisible ||
      signedOutState.rankingRows !== 0 ||
      signedOutState.storedTitles.length !== 0 ||
      signedOutState.logoutCount !== 1 ||
      signedOutState.rankingWriteCount !== state.rankingWriteCount
    ) {
      throw new Error(`Confirmed sign-out did not clear only the device-local state: ${JSON.stringify(signedOutState)}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { state, packWrite, offlineWrite, recoveredWrite, cancelledSignOut, signedOutState },
      screenshots: [await page.screenshot("supabase-merge-save.png")],
    };
  } finally {
    await page.close();
  }
};

const testPublicShareLink = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "public-share-link", width: 1280, height: 900 });
  const userId = "share-link-user";
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "share@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-07-08T10:00:00.000Z",
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
  const authSession = {
    access_token: `${jwtHeader}.${jwtPayload}.e2e-signature`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "share-e2e-refresh-token",
    user,
  };
  const ranking = [
    { ...movie("Spirited Away", 2001, 129), posterPath: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg" },
    { ...movie("Moonlight", 2016, 376867), posterPath: "/4911T5FbJ9eD2Faz5Z8cT3SUhUq.jpg" },
    { ...movie("Heat", 1995, 949), posterPath: "/obpPQskaVpSiC9RcJRB6iWDTCXS.jpg" },
  ];
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const authKey = 'sb-hrfhakrxsllrqmscxxpb-auth-token';
          const authSession = ${JSON.stringify(authSession)};
          const readRows = () => JSON.parse(localStorage.getItem('__e2eSharedRows') || '{}');
          const writeRows = (rows) => localStorage.setItem('__e2eSharedRows', JSON.stringify(rows));
          const eqValue = (params, name) => {
            const raw = params.get(name) || '';
            return raw.startsWith('eq.') ? raw.slice(3) : raw;
          };
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText: async (value) => {
                localStorage.setItem('__e2eCopiedText', value);
              }
            }
          });
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
            if (url.startsWith('https://image.tmdb.org/')) {
              const png = Uint8Array.from(
                atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='),
                (char) => char.charCodeAt(0)
              );
              return new Response(png, {
                status: 200,
                headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' }
              });
            }
            if (!url.startsWith('https://hrfhakrxsllrqmscxxpb.supabase.co/')) {
              return realFetch(input, options);
            }
            const method = request.method || 'GET';
            const body = method === 'GET' || method === 'HEAD' ? '' : await request.clone().text();
            window.__e2eSupabaseRequests.push({ url, method, body });
            if (url.includes('/auth/v1/user')) return jsonResponse(${JSON.stringify(user)});
            if (url.includes('/auth/v1/token')) return jsonResponse(${JSON.stringify(authSession)});
            if (url.includes('/rest/v1/rankings')) {
              if (method === 'GET') {
                const row = {
                  movies: ${JSON.stringify(ranking)},
                  updated_at: '2026-07-08T10:00:00.000Z'
                };
                const accept = request.headers.get('accept') || '';
                return jsonResponse(accept.includes('object+json') ? row : [row], 200, {
                  'Content-Range': '0-0/1'
                });
              }
              return new Response(null, { status: 201 });
            }
            if (url.includes('/rest/v1/shared_lists')) {
              const parsedUrl = new URL(url);
              const params = parsedUrl.searchParams;
              const rows = readRows();
              if (method === 'GET') {
                const slug = eqValue(params, 'slug');
                const listId = eqValue(params, 'list_id');
                const revoked = eqValue(params, 'revoked');
                let matches = Object.values(rows);
                if (slug) matches = matches.filter((row) => row.slug === slug);
                if (listId) matches = matches.filter((row) => row.list_id === listId);
                if (revoked === 'false') matches = matches.filter((row) => row.revoked === false);
                matches.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
                const accept = request.headers.get('accept') || '';
                return jsonResponse(accept.includes('object+json') ? (matches[0] || null) : matches, 200, {
                  'Content-Range': matches.length ? \`0-\${matches.length - 1}/\${matches.length}\` : '*/0'
                });
              }
              if (method === 'POST') {
                const payload = JSON.parse(body || '{}');
                const row = {
                  ...payload,
                  created_at: '2026-07-08T10:01:00.000Z',
                  updated_at: payload.updated_at || '2026-07-08T10:01:00.000Z',
                  revoked: payload.revoked === true ? true : false
                };
                rows[row.slug] = row;
                writeRows(rows);
                return jsonResponse(row, 201, { 'Content-Range': '0-0/1' });
              }
              if (method === 'PATCH') {
                const slug = eqValue(params, 'slug');
                const updates = body ? JSON.parse(body) : {};
                const row = rows[slug];
                if (!row) return jsonResponse(null, 200, { 'Content-Range': '*/0' });
                rows[slug] = { ...row, ...updates };
                writeRows(rows);
                if (params.has('select')) {
                  return jsonResponse(rows[slug], 200, { 'Content-Range': '0-0/1' });
                }
                return new Response(null, { status: 204 });
              }
            }
            if (
              url.includes('/rest/v1/movie_lists') ||
              url.includes('/rest/v1/pack_progress') ||
              url.includes('/rest/v1/suggestion_packs')
            ) {
              if (method === 'GET') return jsonResponse([], 200, { 'Content-Range': '*/0' });
              return new Response(null, { status: 201 });
            }
            if (url.includes('/rest/v1/product_events')) {
              return new Response(null, { status: 201 });
            }
            if (url.includes('/functions/v1/tmdb-detail')) {
              const id = Number(new URL(url).searchParams.get('id'));
              return jsonResponse({
                result: {
                  tmdbId: id,
                  title: id === 129 ? 'Spirited Away' : 'Shared Detail',
                  year: id === 129 ? 2001 : 2020,
                  posterPath: id === 129 ? '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg' : '',
                  runtime: 125,
                  genres: ['Animation', 'Fantasy'],
                  director: 'Hayao Miyazaki',
                  cast: ['Rumi Hiiragi', 'Miyu Irino'],
                  overview: 'A detail fixture for the public shared list.'
                }
              });
            }
            if (url.includes('/functions/v1/tmdb-')) {
              return jsonResponse({ results: [] });
            }
            return jsonResponse({});
          };
        })();
      `,
    });

    await page.send("Page.navigate", { url: `${baseUrl}/share-link-seed` });
    await waitFor(page, "document.readyState === 'complete'", 5000);
    await page.evaluate(`
      localStorage.clear();
      localStorage.setItem(
        'sb-hrfhakrxsllrqmscxxpb-auth-token',
        ${JSON.stringify(JSON.stringify(authSession))}
      );
      localStorage.setItem(
        'stackrank:share-options:v1',
        ${JSON.stringify(
          JSON.stringify({
            version: 7,
            displayName: "E2E Link",
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
          }),
        )}
      );
      true;
    `);
    page.events.length = 0;
    await page.send("Page.navigate", { url: `${baseUrl}/?e2e=public-share-link` });
    await waitFor(
      page,
      `document.querySelectorAll('#ranking .ranking__item').length === 3 &&
        document.querySelector('#settings-auth-state')?.textContent.includes('share@example.test')`,
      12000,
    );
    await page.evaluate(`(() => {
      document.querySelector('#share-list')?.click();
      document.querySelector('.share-disclosure--link').open = true;
      return true;
    })()`);
    await waitFor(
      page,
      `!document.querySelector('#share-studio')?.hidden &&
        document.querySelector('#share-link-meta')?.textContent.trim() === 'No link yet'`,
      8000,
    );
    await page.evaluate(`document.querySelector('#share-link-publish')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#share-link-status')?.textContent.includes('published') &&
        document.querySelector('#share-link-url')?.textContent.includes('/s/')`,
      8000,
    );
    const published = await page.evaluate(`(() => {
      const href = document.querySelector('#share-link-url')?.href || '';
      const slug = href.split('/s/')[1] || '';
      const rows = JSON.parse(localStorage.getItem('__e2eSharedRows') || '{}');
      const row = rows[slug] || null;
      return {
        href,
        slug,
        meta: document.querySelector('#share-link-meta')?.textContent.trim(),
        status: document.querySelector('#share-link-status')?.textContent.trim(),
        row,
        payloadKeys: row ? Object.keys(row.payload.movies[0]).sort() : [],
        privateRankedAt: row?.payload.movies?.some((entry) => 'rankedAt' in entry) || false
      };
    })()`);
    if (
      !/\/s\/[a-z0-9]{10}$/.test(published.href) ||
      published.meta !== "Published snapshot" ||
      !published.row ||
      published.row.list_id !== `user:${userId}` ||
      published.row.payload.displayName !== "E2E Link" ||
      published.row.payload.movies.map((entry) => entry.title).join("|") !== "Spirited Away|Moonlight|Heat" ||
      published.payloadKeys.join("|") !== "posterPath|title|tmdbId|year" ||
      published.privateRankedAt
    ) {
      throw new Error(`Publish link state is wrong: ${JSON.stringify(published)}`);
    }

    await page.evaluate(`document.querySelector('#share-link-update')?.click(); true;`);
    await waitFor(page, `document.querySelector('#share-link-status')?.textContent.includes('updated')`, 8000);
    await page.evaluate(`document.querySelector('#share-link-copy-button')?.click(); true;`);
    await waitFor(
      page,
      `localStorage.getItem('__e2eCopiedText') === ${JSON.stringify(published.href)}`,
      3000,
    );
    const updateCopy = await page.evaluate(`(() => ({
      copied: localStorage.getItem('__e2eCopiedText'),
      updateCount: (window.__e2eSupabaseRequests || []).filter((request) =>
        request.method === 'PATCH' && request.url.includes('/rest/v1/shared_lists')
      ).length
    }))()`);
    if (updateCopy.copied !== published.href || updateCopy.updateCount < 1) {
      throw new Error(`Update/copy link failed: ${JSON.stringify(updateCopy)}`);
    }

    await page.send("Page.navigate", { url: published.href });
    try {
      await waitFor(page, `document.querySelectorAll('.shared-card').length === 3`, 8000);
    } catch (error) {
      const debug = await page.evaluate(`(() => ({
        href: location.href,
        pathname: location.pathname,
        title: document.title,
        status: document.querySelector('#shared-status')?.textContent.trim(),
        cards: document.querySelectorAll('.shared-card').length,
        rows: JSON.parse(localStorage.getItem('__e2eSharedRows') || '{}'),
        body: document.body.innerText.slice(0, 500),
        requests: window.__e2eSupabaseRequests || []
      }))()`);
      throw new Error(`Shared public page did not render cards: ${JSON.stringify(debug)}`);
    }
    const publicView = await page.evaluate(`(() => ({
      pathname: location.pathname,
      title: document.title,
      heading: document.querySelector('#shared-title')?.textContent.trim(),
      meta: document.querySelector('#shared-meta')?.textContent.trim(),
      cards: [...document.querySelectorAll('.shared-card h2')].map((el) => el.textContent.trim()),
      cta: document.querySelector('.shared-cta')?.getAttribute('href'),
      ctaText: document.querySelector('.shared-cta')?.textContent.trim(),
      ctaDecoration: getComputedStyle(document.querySelector('.shared-cta')).textDecorationLine,
      ctaWidth: Math.round(document.querySelector('.shared-cta')?.getBoundingClientRect().width || 0),
      titleAlign: getComputedStyle(document.querySelector('#shared-title')).textAlign,
      appControls: !!document.querySelector('#share-list, #movie-form')
    }))()`);
    if (
      publicView.pathname !== `/s/${published.slug}` ||
      publicView.title !== "Shared StackRank movie list" ||
      publicView.heading !== "E2E Link's movie ranking" ||
      !publicView.meta.includes("3 ranked movies") ||
      publicView.cards.join("|") !== "Spirited Away|Moonlight|Heat" ||
      publicView.cta !== "/movies" ||
      publicView.ctaText !== "Rank your own movies" ||
      publicView.ctaDecoration !== "none" ||
      publicView.ctaWidth > 260 ||
      publicView.titleAlign !== "center" ||
      publicView.appControls
    ) {
      throw new Error(`Public shared view is wrong: ${JSON.stringify(publicView)}`);
    }

    const sharedModalBefore = await page.evaluate(`(() => {
      document.body.style.minHeight = '2600px';
      window.scrollTo(0, 1200);
      const bodyStyle = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        paddingRight: document.body.style.paddingRight
      };
      const state = { scrollX, scrollY, bodyStyle };
      document.querySelector('.shared-card')?.click();
      return state;
    })()`);
    if (sharedModalBefore.scrollY < 1000) {
      throw new Error(`Shared modal scroll fixture did not move off-screen: ${JSON.stringify(sharedModalBefore)}`);
    }
    await waitFor(
      page,
      `!document.querySelector('#shared-detail')?.hidden &&
        document.querySelector('#shared-detail-status')?.textContent.trim() === '' &&
        document.querySelector('#shared-detail-title')?.textContent.trim() === 'Spirited Away'`,
      8000,
    );
    const sharedDetail = await page.evaluate(`(() => ({
      rank: document.querySelector('#shared-detail-rank')?.textContent.trim(),
      title: document.querySelector('#shared-detail-title')?.textContent.trim(),
      sub: document.querySelector('#shared-detail-sub')?.textContent.trim(),
      genres: document.querySelector('#shared-detail-genres')?.textContent.trim(),
      overview: document.querySelector('#shared-detail-overview')?.textContent.trim(),
      director: document.querySelector('#shared-detail-director')?.textContent.trim(),
      cast: document.querySelector('#shared-detail-cast')?.textContent.trim(),
      ctaText: document.querySelector('#shared-detail-cta')?.textContent.trim(),
      cta: document.querySelector('#shared-detail-cta')?.getAttribute('href'),
      backgroundInert: document.querySelector('.shared-page')?.inert,
      activeId: document.activeElement?.id,
      bodyLocked: document.body.classList.contains('is-shared-detail-open'),
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top
    }))()`);
    if (
      sharedDetail.rank !== "Ranked #1" ||
      sharedDetail.title !== "Spirited Away" ||
      sharedDetail.sub !== "2001 - 2h 5m" ||
      sharedDetail.genres !== "Animation, Fantasy" ||
      sharedDetail.overview !== "A detail fixture for the public shared list." ||
      sharedDetail.director !== "Hayao Miyazaki" ||
      sharedDetail.cast !== "Rumi Hiiragi, Miyu Irino" ||
      sharedDetail.ctaText !== "Rank this movie" ||
      sharedDetail.cta !== "/movies" ||
      !sharedDetail.backgroundInert ||
      sharedDetail.activeId !== "shared-detail-close" ||
      !sharedDetail.bodyLocked ||
      sharedDetail.bodyPosition !== "fixed" ||
      sharedDetail.bodyTop !== `-${sharedModalBefore.scrollY}px`
    ) {
      throw new Error(`Shared detail view is wrong: ${JSON.stringify(sharedDetail)}`);
    }
    const sharedModalFocus = await page.evaluate(`(() => {
      const close = document.querySelector('#shared-detail-close');
      const cta = document.querySelector('#shared-detail-cta');
      close.focus({ preventScroll: true });
      close.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      const backwardActiveId = document.activeElement?.id;
      cta.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true
      }));
      return {
        backwardActiveId,
        forwardActiveId: document.activeElement?.id,
        backgroundInert: document.querySelector('.shared-page')?.inert
      };
    })()`);
    if (
      sharedModalFocus.backwardActiveId !== "shared-detail-cta" ||
      sharedModalFocus.forwardActiveId !== "shared-detail-close" ||
      !sharedModalFocus.backgroundInert
    ) {
      throw new Error(`Shared detail focus did not wrap: ${JSON.stringify(sharedModalFocus)}`);
    }
    await page.evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })); true;`,
    );
    await waitFor(
      page,
      `document.querySelector('#shared-detail')?.hidden &&
        !document.querySelector('.shared-page')?.inert &&
        document.activeElement === document.querySelector('.shared-card')`,
      3000,
    );
    const sharedModalClosed = await page.evaluate(`(() => ({
      scrollX,
      scrollY,
      bodyStyle: {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        paddingRight: document.body.style.paddingRight
      },
      bodyLocked: document.body.classList.contains('is-shared-detail-open'),
      backgroundInert: document.querySelector('.shared-page')?.inert,
      triggerFocused: document.activeElement === document.querySelector('.shared-card')
    }))()`);
    if (
      Math.abs(sharedModalClosed.scrollX - sharedModalBefore.scrollX) > 1 ||
      Math.abs(sharedModalClosed.scrollY - sharedModalBefore.scrollY) > 1 ||
      JSON.stringify(sharedModalClosed.bodyStyle) !== JSON.stringify(sharedModalBefore.bodyStyle) ||
      sharedModalClosed.bodyLocked ||
      sharedModalClosed.backgroundInert ||
      !sharedModalClosed.triggerFocused
    ) {
      throw new Error(
        `Shared detail modal did not restore its page state: ${JSON.stringify({ sharedModalBefore, sharedModalClosed })}`,
      );
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844,
    });
    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(page, `document.querySelectorAll('.shared-card').length === 3`, 8000);
    const mobilePublicView = await page.evaluate(`(() => {
      const grid = document.querySelector('.shared-grid');
      const cta = document.querySelector('.shared-cta');
      const firstCard = document.querySelector('.shared-card');
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const cardRect = firstCard.getBoundingClientRect();
      const visibleCards = [...document.querySelectorAll('.shared-card')].filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      }).length;
      return {
        columns,
        cardHeight: Math.round(cardRect.height),
        visibleCards,
        ctaWidth: Math.round(cta.getBoundingClientRect().width),
        ctaDecoration: getComputedStyle(cta).textDecorationLine,
        titleAlign: getComputedStyle(document.querySelector('#shared-title')).textAlign,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth
      };
    })()`);
    if (
      mobilePublicView.columns !== 3 ||
      mobilePublicView.cardHeight > 230 ||
      mobilePublicView.visibleCards < 3 ||
      mobilePublicView.ctaWidth > 230 ||
      mobilePublicView.ctaDecoration !== "none" ||
      mobilePublicView.titleAlign !== "center" ||
      mobilePublicView.scrollWidth > mobilePublicView.innerWidth
    ) {
      throw new Error(`Mobile shared view is not compact enough: ${JSON.stringify(mobilePublicView)}`);
    }
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 900,
    });

    await page.send("Page.navigate", { url: `${baseUrl}/?e2e=public-share-link-revoke` });
    await waitFor(
      page,
      `document.querySelectorAll('#ranking .ranking__item').length === 3 &&
        document.querySelector('#settings-auth-state')?.textContent.includes('share@example.test')`,
      12000,
    );
    await page.evaluate(`(() => {
      window.confirm = () => true;
      document.querySelector('#share-list')?.click();
      document.querySelector('.share-disclosure--link').open = true;
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('#share-link-url')?.textContent === ${JSON.stringify(published.href)}`,
      8000,
    );
    await page.evaluate(`document.querySelector('#share-link-revoke')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#share-link-status')?.textContent.includes('revoked') &&
        document.querySelector('#share-link-card')?.hidden`,
      8000,
    );
    const revoked = await page.evaluate(`(() => {
      const rows = JSON.parse(localStorage.getItem('__e2eSharedRows') || '{}');
      const revokeRequest = [...(window.__e2eSupabaseRequests || [])].reverse().find((request) =>
        request.method === 'PATCH' &&
        request.url.includes('/rest/v1/shared_lists') &&
        (request.body || '').includes('"revoked":true')
      );
      return {
        revoked: rows[${JSON.stringify(published.slug)}]?.revoked,
        publishVisible: !document.querySelector('#share-link-publish')?.hidden,
        revokeHidden: document.querySelector('#share-link-revoke')?.hidden,
        revokeSelect: revokeRequest ? new URL(revokeRequest.url).searchParams.get('select') : null
      };
    })()`);
    if (
      revoked.revoked !== true ||
      !revoked.publishVisible ||
      !revoked.revokeHidden ||
      revoked.revokeSelect !== "slug"
    ) {
      throw new Error(`Revoke link state is wrong: ${JSON.stringify(revoked)}`);
    }

    await page.send("Page.navigate", { url: published.href });
    await waitFor(
      page,
      `document.querySelector('#shared-status')?.textContent.includes('no longer available')`,
      8000,
    );
    const revokedPublic = await page.evaluate(`(() => ({
      cards: document.querySelectorAll('.shared-card').length,
      status: document.querySelector('#shared-status')?.textContent.trim(),
      cta: document.querySelector('.shared-cta')?.getAttribute('href')
    }))()`);
    if (revokedPublic.cards !== 0 || !revokedPublic.status.includes("no longer available") || revokedPublic.cta !== "/movies") {
      throw new Error(`Revoked shared link still renders: ${JSON.stringify(revokedPublic)}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: {
        published,
        updateCopy,
        publicView,
        sharedDetail,
        sharedModalBefore,
        sharedModalFocus,
        sharedModalClosed,
        mobilePublicView,
        revoked,
        revokedPublic,
      },
      screenshots: [await page.screenshot("public-share-link-revoked.png")],
    };
  } finally {
    await page.close();
  }
};

const testRankingPointerTransactions = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "ranking-pointer-transactions", width: 1280, height: 900 });
  const originalTitles = Array.from({ length: 30 }, (_, index) => `Movie ${String(index + 1).padStart(2, "0")}`);
  try {
    await seedPage(page, baseUrl, "ranking-pointer-transactions", {
      ranking: originalTitles.map((title, index) => movie(title, 1990 + index, 1600 + index)),
    });

    const dragPoints = await page.evaluate(`(() => {
      const list = document.querySelector('#ranking');
      const first = list?.querySelector('.ranking__item .movie-item__body')?.getBoundingClientRect();
      const listRect = list?.getBoundingClientRect();
      return first && listRect ? {
        from: { x: first.left + first.width / 2, y: first.top + first.height / 2 },
        edge: {
          x: first.left + first.width / 2,
          y: list.scrollHeight > list.clientHeight ? listRect.bottom - 5 : innerHeight - 5
        },
        listScrollable: list.scrollHeight > list.clientHeight,
        listScrollTop: list.scrollTop,
        windowScrollY: window.scrollY
      } : null;
    })()`);
    if (!dragPoints) throw new Error("Desktop ranking drag points were unavailable");
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
      x: dragPoints.edge.x,
      y: dragPoints.edge.y,
      button: "left",
      buttons: 1,
    });
    await wait(450);
    const autoScrolled = await page.evaluate(`(() => ({
      listScrollTop: document.querySelector('#ranking')?.scrollTop || 0,
      windowScrollY: window.scrollY,
      dragging: document.querySelectorAll('#ranking .ranking__item.is-dragging').length
    }))()`);
    const correctOwnerScrolled = dragPoints.listScrollable
      ? autoScrolled.listScrollTop >= 30 && Math.abs(autoScrolled.windowScrollY - dragPoints.windowScrollY) <= 4
      : autoScrolled.windowScrollY >= dragPoints.windowScrollY + 30 && autoScrolled.listScrollTop <= 4;
    if (!correctOwnerScrolled || autoScrolled.dragging !== 1) {
      throw new Error(`Long ranking drag scrolled the wrong surface: ${JSON.stringify({ dragPoints, autoScrolled })}`);
    }
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: dragPoints.edge.x,
      y: dragPoints.edge.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')][0]?.textContent.trim() !== 'Movie 01' &&
        document.querySelector('#add-feedback .feedback-toast__action')?.textContent.trim() === 'Undo'`,
      5000,
    );
    await page.evaluate(`document.querySelector('#add-feedback .feedback-toast__action')?.click(); true;`);
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')].map((node) => node.textContent.trim()).join('|') === ${JSON.stringify(originalTitles.join("|"))}`,
      5000,
    );

    await page.evaluate(`(() => {
      document.querySelector('#ranking').scrollTop = 0;
      const feedback = document.querySelector('#add-feedback');
      if (feedback) feedback.innerHTML = '';
      return true;
    })()`);
    const noOpPoints = await page.evaluate(`(() => {
      const body = document.querySelector('#ranking .ranking__item .movie-item__body')?.getBoundingClientRect();
      return body ? {
        from: { x: body.left + body.width / 2, y: body.top + body.height / 2 },
        to: { x: body.left + body.width / 2 + 12, y: body.top + body.height / 2 }
      } : null;
    })()`);
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: noOpPoints.from.x,
      y: noOpPoints.from.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: noOpPoints.to.x,
      y: noOpPoints.to.y,
      button: "left",
      buttons: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: noOpPoints.to.x,
      y: noOpPoints.to.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await wait(120);
    const noOp = await page.evaluate(`(() => ({
      titles: [...document.querySelectorAll('#ranking .ranking__title')].map((node) => node.textContent.trim()),
      detailHidden: document.querySelector('#movie-detail')?.hidden,
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || '',
      dragging: document.querySelectorAll('#ranking .ranking__item.is-dragging').length
    }))()`);
    if (
      noOp.titles.join("|") !== originalTitles.join("|") ||
      !noOp.detailHidden ||
      noOp.feedback ||
      noOp.dragging
    ) {
      throw new Error(`No-op mouse drag committed or opened detail: ${JSON.stringify(noOp)}`);
    }

    const escapePoints = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('#ranking .ranking__item')];
      const first = rows[0]?.querySelector('.movie-item__body')?.getBoundingClientRect();
      const third = rows[2]?.getBoundingClientRect();
      return first && third ? {
        from: { x: first.left + first.width / 2, y: first.top + first.height / 2 },
        to: { x: third.left + third.width / 2, y: third.top + third.height / 2 }
      } : null;
    })()`);
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: escapePoints.from.x,
      y: escapePoints.from.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: escapePoints.to.x,
      y: escapePoints.to.y,
      button: "left",
      buttons: 1,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: escapePoints.to.x,
      y: escapePoints.to.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await wait(120);
    const escaped = await page.evaluate(`(() => ({
      titles: [...document.querySelectorAll('#ranking .ranking__title')].map((node) => node.textContent.trim()),
      detailHidden: document.querySelector('#movie-detail')?.hidden,
      dragging: document.querySelectorAll('#ranking .ranking__item.is-dragging').length,
      bodyDragging: document.body.classList.contains('is-dragging')
    }))()`);
    if (
      escaped.titles.join("|") !== originalTitles.join("|") ||
      !escaped.detailHidden ||
      escaped.dragging ||
      escaped.bodyDragging
    ) {
      throw new Error(`Escape did not cancel the main drag transaction: ${JSON.stringify(escaped)}`);
    }

    await setDeviceProfile(page, {
      width: 1024,
      height: 768,
      input: DEVICE_INPUT_PROFILE.coarseTouch,
      deviceScaleFactor: 2,
    });
    await page.evaluate(`(() => {
      document.querySelector('#ranking').scrollTop = 0;
      document.querySelector('#ranking-move-toggle')?.click();
      return true;
    })()`);
    await waitFor(page, `document.querySelector('#ranking')?.classList.contains('is-move-mode')`, 3000);
    const touchPoints = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('#ranking .ranking__item')];
      const handle = rows[0]?.querySelector('.ranking__handle')?.getBoundingClientRect();
      const fourth = rows[3]?.getBoundingClientRect();
      return handle && fourth ? {
        from: { x: handle.left + handle.width / 2, y: handle.top + handle.height / 2 },
        to: { x: fourth.left + fourth.width / 2, y: fourth.top + fourth.height / 2 }
      } : null;
    })()`);
    const touchStart = {
      x: Math.round(touchPoints.from.x),
      y: Math.round(touchPoints.from.y),
      radiusX: 2,
      radiusY: 2,
      force: 1,
      id: 7,
    };
    await page.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchStart] });
    await page.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...touchStart, x: Math.round(touchPoints.to.x), y: Math.round(touchPoints.to.y) }],
    });
    await page.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await wait(150);
    const touchCanceled = await page.evaluate(`(() => ({
      titles: [...document.querySelectorAll('#ranking .ranking__title')].map((node) => node.textContent.trim()),
      dragging: document.querySelectorAll('#ranking .ranking__item.is-dragging').length,
      bodyDragging: document.body.classList.contains('is-dragging'),
      moveMode: document.querySelector('#ranking')?.classList.contains('is-move-mode')
    }))()`);
    if (
      touchCanceled.titles.join("|") !== originalTitles.join("|") ||
      touchCanceled.dragging ||
      touchCanceled.bodyDragging ||
      !touchCanceled.moveMode
    ) {
      throw new Error(`Touch cancellation committed the main drag: ${JSON.stringify(touchCanceled)}`);
    }

    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { dragPoints, autoScrolled, noOp, escaped, touchCanceled },
      screenshots: [await page.screenshot("ranking-pointer-transactions.png")],
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
        movie("Alpha", 1990, null),
        movie("Beta", 1995, null),
        movie("Gamma", 2000, null),
        movie("Delta", 2005, null),
        movie("Epsilon", 2010, null),
        movie("Zeta", 2015, null),
      ],
    });
    await page.evaluate(`(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const url = typeof input === 'string' ? input : input?.url || String(input);
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
    const actionState = await page.evaluate(`(() => {
      const card = document.querySelector('#fullscreen-grid .fullscreen-card');
      const actions = [...card.querySelectorAll('.fullscreen-card__action')];
      const overflow = card.querySelector('.fullscreen-card__overflow');
      const overflowToggle = overflow?.querySelector('.movie-item__overflow-toggle');
      const moveToggle = document.querySelector('#fullscreen-move-toggle');
      return {
        gridMoveMode: document.querySelector('#fullscreen-grid')?.classList.contains('is-move-mode'),
        moveTogglePressed: moveToggle?.getAttribute('aria-pressed'),
        moveToggleDisabled: moveToggle?.disabled,
        moveToggleLabel: moveToggle?.textContent.trim().replace(/\\s+/g, ' '),
        labels: actions.map((button) => button.textContent.trim().replace(/\\s+/g, ' ')),
        visibleLabels: actions
          .filter((button) => getComputedStyle(button).display !== 'none')
          .map((button) => button.textContent.trim().replace(/\\s+/g, ' ')),
        overflowLabels: [...card.querySelectorAll('.fullscreen-card__overflow .movie-item__overflow-action')]
          .map((button) => button.textContent.trim().replace(/\\s+/g, ' ')),
        handles: actions.map((button) => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            hasIcon: !!button.querySelector('.ui-icon'),
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        }),
        overflowVisible: (() => {
          const style = overflowToggle ? getComputedStyle(overflowToggle) : null;
          const rect = overflowToggle?.getBoundingClientRect();
          return style && rect ? {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          } : null;
        })(),
        handleInsidePoster: !!card.querySelector('.fullscreen-card__poster .fullscreen-card__drag-handle'),
        handleInsideActions: !!card.querySelector('.fullscreen-card__actions .fullscreen-card__drag-handle'),
        handlePosition: getComputedStyle(card.querySelector('.fullscreen-card__drag-handle')).position
      };
    })()`);
    if (
      actionState.gridMoveMode ||
      actionState.moveTogglePressed !== "false" ||
      actionState.moveToggleDisabled ||
      actionState.moveToggleLabel !== "Move" ||
      actionState.labels.join("|") !== "Move" ||
      actionState.visibleLabels.join("|") !== "" ||
      actionState.overflowLabels.join("|") !== "Info|Re-rank|Remove" ||
      !actionState.handles.every((item) =>
        item.hasIcon &&
        item.display === "none" &&
        item.visibility === "visible" &&
        Number(item.opacity) === 1 &&
        item.width === 0 &&
        item.height === 0
      ) ||
      !actionState.overflowVisible ||
      actionState.overflowVisible.display === "none" ||
      actionState.overflowVisible.visibility !== "visible" ||
      Number(actionState.overflowVisible.opacity) !== 1 ||
      actionState.overflowVisible.width < 30 ||
      actionState.overflowVisible.height < 30 ||
      actionState.handleInsidePoster ||
      !actionState.handleInsideActions ||
      actionState.handlePosition === "absolute"
    ) {
      throw new Error(`Full-screen action row is wrong: ${JSON.stringify(actionState)}`);
    }

    await page.evaluate(`(() => {
      const overflow = document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow');
      overflow?.setAttribute('open', '');
      overflow?.closest('.fullscreen-card')?.classList.add('is-overflow-open');
      return true;
    })()`);
    await waitFor(
      page,
      `document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow')?.open`,
      3000,
    );
    const fullscreenOverflowFocus = await page.evaluate(`(() => {
      const card = document.querySelector('.fullscreen-card[data-index="2"]');
      const menu = card?.querySelector('.fullscreen-card__overflow .movie-item__overflow-menu');
      const cardStyle = card ? getComputedStyle(card) : null;
      return {
        open: card?.querySelector('.fullscreen-card__overflow')?.open,
        cardBorderColor: cardStyle?.borderColor || '',
        cardBoxShadow: cardStyle?.boxShadow || '',
        labels: [...(menu?.querySelectorAll('.movie-item__overflow-action') || [])]
          .map((button) => button.textContent.trim()),
        actionMetrics: [...(menu?.querySelectorAll('.movie-item__overflow-action') || [])]
          .map((button) => ({
            text: button.textContent.trim(),
            width: Math.round(button.getBoundingClientRect().width),
            height: Math.round(button.getBoundingClientRect().height),
            scrollWidth: button.scrollWidth,
            clientWidth: button.clientWidth,
            whiteSpace: getComputedStyle(button).whiteSpace
          }))
      };
    })()`);
    if (
      !fullscreenOverflowFocus.open ||
      fullscreenOverflowFocus.cardBorderColor === "rgb(17, 17, 17)" ||
      fullscreenOverflowFocus.cardBoxShadow !== "none" ||
      fullscreenOverflowFocus.labels.join("|") !== "Info|Re-rank|Remove" ||
      !fullscreenOverflowFocus.actionMetrics.every((action) =>
        action.whiteSpace === "nowrap" &&
        action.scrollWidth <= action.clientWidth + 1 &&
        action.width >= 120 &&
        action.height <= 40
      )
    ) {
      throw new Error(`Full-screen overflow focus/menu styling is wrong: ${JSON.stringify(fullscreenOverflowFocus)}`);
    }
    await page.evaluate(`(() => {
      const overflow = document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow');
      overflow?.removeAttribute('open');
      overflow?.closest('.fullscreen-card')?.classList.remove('is-overflow-open');
      return true;
    })()`);
    await waitFor(
      page,
      `!document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow')?.open`,
      3000,
    );

    await page.evaluate(`document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow > summary')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow')?.open`,
      3000,
    );
    const fullscreenOutsideTap = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('#fullscreen-grid .fullscreen-card')]
        .filter((card) => card.dataset.index !== '2');
      for (const card of cards) {
        const targets = [
          card.querySelector('.fullscreen-card__primary'),
          card.querySelector('.fullscreen-card__poster')
        ].filter(Boolean);
        for (const target of targets) {
          const rect = target.getBoundingClientRect();
          const points = [
            { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + Math.min(rect.height / 2, 96)) },
            { x: Math.round(rect.left + 14), y: Math.round(rect.top + 14) }
          ];
          for (const point of points) {
            const hit = document.elementFromPoint(point.x, point.y);
            if (
              hit?.closest('.fullscreen-card') === card &&
              !hit.closest('.movie-item__overflow') &&
              point.y > 0 &&
              point.y < window.innerHeight - 80
            ) {
              return point;
            }
          }
        }
      }
      return null;
    })()`);
    if (!fullscreenOutsideTap) throw new Error("Missing fullscreen outside-tap target");
    // A raw CDP mouse press can focus-scroll the card before the click on
    // Linux headless Chrome, which invokes the separate scroll-dismiss path.
    // Dispatch the click at the already hit-tested target so this assertion
    // isolates the capture-phase outside-click contract. The real coordinate
    // touch path is covered by the mobile Rank outside-tap regression.
    await page.evaluate(`(() => {
      const point = ${JSON.stringify(fullscreenOutsideTap)};
      const target = document.elementFromPoint(point.x, point.y);
      target?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      }));
      return true;
    })()`);
    await waitFor(page, `!document.querySelector('.movie-item__overflow[open]')`, 3000);
    const fullscreenDismissState = await page.evaluate(`(() => ({
      detailHidden: document.querySelector('#movie-detail')?.hidden,
      detailTitle: document.querySelector('#detail-title')?.textContent.trim(),
      fullscreenHidden: document.querySelector('#ranking-fullscreen')?.hidden,
      cardCount: document.querySelectorAll('#fullscreen-grid .fullscreen-card').length,
      openMenus: document.querySelectorAll('.movie-item__overflow[open]').length
    }))()`);
    if (
      !fullscreenDismissState.detailHidden ||
      fullscreenDismissState.fullscreenHidden ||
      fullscreenDismissState.cardCount !== 6 ||
      fullscreenDismissState.openMenus !== 0
    ) {
      throw new Error(`Full-screen outside-tap dismissal opened detail: ${JSON.stringify(fullscreenDismissState)}`);
    }

    await page.evaluate(`document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow > summary')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow')?.open`,
      3000,
    );
    const fullscreenInfoTap = await page.evaluate(`(() => {
      const action = document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow [data-action="detail"]');
      const rect = action?.getBoundingClientRect();
      if (!rect) return null;
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    })()`);
    if (!fullscreenInfoTap) throw new Error("Missing full-screen overflow Info target");
    await page.evaluate(`document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow [data-action="detail"]')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#movie-detail')?.hidden`, 3000);
    const fullscreenDetailLayer = await page.evaluate(`(() => {
      const point = ${JSON.stringify(fullscreenInfoTap)};
      const target = document.elementFromPoint(point.x, point.y);
      const detail = document.querySelector('#movie-detail');
      return {
        detailHidden: detail?.hidden,
        detailZ: Number(getComputedStyle(detail).zIndex),
        openMenus: document.querySelectorAll('.movie-item__overflow[open]').length,
        raisedRows: document.querySelectorAll('.ranking__item.is-overflow-open, .queue-list__item.is-overflow-open, .fullscreen-card.is-overflow-open').length,
        topInDetail: !!target?.closest('#movie-detail'),
        fullscreenHidden: document.querySelector('#ranking-fullscreen')?.hidden,
        topClass: target?.className || ''
      };
    })()`);
    if (
      fullscreenDetailLayer.detailHidden ||
      fullscreenDetailLayer.detailZ <= 1250 ||
      fullscreenDetailLayer.openMenus !== 0 ||
      fullscreenDetailLayer.raisedRows !== 0 ||
      !fullscreenDetailLayer.topInDetail ||
      fullscreenDetailLayer.fullscreenHidden
    ) {
      throw new Error(`Full-screen overflow Info detail is layered wrong: ${JSON.stringify(fullscreenDetailLayer)}`);
    }
    const fullscreenOverflowDetailShot = await page.screenshot("fullscreen-ranking-overflow-detail.png");
    await page.evaluate(`document.querySelector('#detail-close')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#movie-detail')?.hidden && !document.querySelector('#ranking-fullscreen')?.inert`,
      3000,
    );

    await page.evaluate(`document.querySelector('#fullscreen-move-toggle')?.click(); true;`);
    await waitFor(page, `document.querySelector('#fullscreen-grid')?.classList.contains('is-move-mode')`, 3000);
    const moveModeState = await page.evaluate(`(() => {
      const grid = document.querySelector('#fullscreen-grid');
      const handles = [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__drag-handle')];
      const overflowToggles = [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__overflow .movie-item__overflow-toggle')];
      const moveToggle = document.querySelector('#fullscreen-move-toggle');
      return {
        gridMoveMode: grid?.classList.contains('is-move-mode'),
        moveTogglePressed: moveToggle?.getAttribute('aria-pressed'),
        visibleHandles: handles.map((button) => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            text: button.textContent.trim().replace(/\\s+/g, ' '),
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hasIcon: !!button.querySelector('.ui-icon')
          };
        }),
        visibleOverflowToggles: overflowToggles.filter((toggle) => getComputedStyle(toggle).display !== 'none').length,
        handleInsidePosters: document.querySelectorAll('#fullscreen-grid .fullscreen-card__poster .fullscreen-card__drag-handle').length,
        handleInsideActions: document.querySelectorAll('#fullscreen-grid .fullscreen-card__actions .fullscreen-card__drag-handle').length
      };
    })()`);
    if (
      !moveModeState.gridMoveMode ||
      moveModeState.moveTogglePressed !== "true" ||
      moveModeState.visibleOverflowToggles !== 0 ||
      moveModeState.handleInsidePosters !== 0 ||
      moveModeState.handleInsideActions !== 6 ||
      !moveModeState.visibleHandles.every((item) =>
        item.text === "Move" &&
        item.display !== "none" &&
        item.visibility === "visible" &&
        Number(item.opacity) === 1 &&
        item.width >= 30 &&
        item.height >= 30 &&
        item.hasIcon
      )
    ) {
      throw new Error(`Full-screen move mode controls are wrong: ${JSON.stringify(moveModeState)}`);
    }
    await page.evaluate(`document.querySelector('#fullscreen-move-toggle')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#fullscreen-grid')?.classList.contains('is-move-mode')`, 3000);

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 430,
      height: 932,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 430,
      screenHeight: 932,
    });
    await waitFor(page, `document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 3000);
    await page.evaluate(`(() => {
      const density = document.querySelector('#fullscreen-density');
      density.value = 'comfortable';
      density.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    const mobileComfortable = await page.evaluate(`(() => {
      const grid = document.querySelector('#fullscreen-grid');
      const card = document.querySelector('#fullscreen-grid .fullscreen-card');
      const title = card?.querySelector('.fullscreen-card__title');
      const overlay = document.querySelector('#ranking-fullscreen');
      const mobileNav = document.querySelector('.app-nav--mobile');
      return {
        bodyFullscreenOpen: document.body.classList.contains('is-fullscreen-open'),
        mobileNavDisplay: mobileNav ? getComputedStyle(mobileNav).display : null,
        overlayZ: Number(getComputedStyle(overlay).zIndex),
        mobileNavZ: mobileNav ? Number(getComputedStyle(mobileNav).zIndex) : null,
        compact: grid?.classList.contains('is-compact'),
        moveMode: grid?.classList.contains('is-move-mode'),
        movePressed: document.querySelector('#fullscreen-move-toggle')?.getAttribute('aria-pressed'),
        visibleHandles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__drag-handle')]
          .filter((button) => getComputedStyle(button).display !== 'none').length,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        cardHeight: Math.round(card?.getBoundingClientRect().height || 0),
        titleDisplay: title ? getComputedStyle(title).display : ''
      };
    })()`);
    await page.evaluate(`(() => {
      const density = document.querySelector('#fullscreen-density');
      density.value = 'compact';
      density.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(page, `document.querySelector('#fullscreen-grid')?.classList.contains('is-compact')`, 3000);
    const mobileCompact = await page.evaluate(`(() => {
      const grid = document.querySelector('#fullscreen-grid');
      const card = document.querySelector('#fullscreen-grid .fullscreen-card');
      const title = card?.querySelector('.fullscreen-card__title');
      const header = document.querySelector('.fullscreen-header');
      return {
        compact: grid?.classList.contains('is-compact'),
        moveMode: grid?.classList.contains('is-move-mode'),
        movePressed: document.querySelector('#fullscreen-move-toggle')?.getAttribute('aria-pressed'),
        visibleHandles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__drag-handle')]
          .filter((button) => getComputedStyle(button).display !== 'none').length,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        headerHeight: Math.round(header?.getBoundingClientRect().height || 0),
        cardHeight: Math.round(card?.getBoundingClientRect().height || 0),
        titleDisplay: title ? getComputedStyle(title).display : ''
      };
    })()`);
    if (
      !mobileComfortable.bodyFullscreenOpen ||
      mobileComfortable.mobileNavDisplay !== "none" ||
      mobileComfortable.overlayZ <= mobileComfortable.mobileNavZ ||
      mobileComfortable.compact ||
      mobileComfortable.moveMode ||
      mobileComfortable.movePressed !== "false" ||
      mobileComfortable.visibleHandles !== 0 ||
      !mobileCompact.compact ||
      mobileCompact.moveMode ||
      mobileCompact.movePressed !== "false" ||
      mobileCompact.visibleHandles !== 0 ||
      mobileComfortable.columns < 3 ||
      mobileCompact.columns <= mobileComfortable.columns ||
      mobileCompact.headerHeight > 150 ||
      mobileCompact.cardHeight >= mobileComfortable.cardHeight ||
      mobileCompact.titleDisplay !== "none"
    ) {
      throw new Error(`Mobile full-screen density is wrong: ${JSON.stringify({ mobileComfortable, mobileCompact })}`);
    }
    await page.evaluate(`(() => {
      const density = document.querySelector('#fullscreen-density');
      density.value = 'comfortable';
      density.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 900,
    });
    await waitFor(page, `!document.querySelector('#fullscreen-grid')?.classList.contains('is-compact')`, 3000);

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
      moveMode: document.querySelector('#fullscreen-grid')?.classList.contains('is-move-mode'),
      movePressed: document.querySelector('#fullscreen-move-toggle')?.getAttribute('aria-pressed'),
      moveDisabled: document.querySelector('#fullscreen-move-toggle')?.disabled,
      dragHandleVisible: getComputedStyle(document.querySelector('.fullscreen-card__drag-handle')).display !== 'none',
      actionLabels: [...document.querySelectorAll('.fullscreen-card__action')]
        .filter((button) => getComputedStyle(button).display !== 'none')
        .map((button) => button.textContent.trim().replace(/\\s+/g, ' ')),
      overflowLabels: [...document.querySelectorAll('.fullscreen-card__overflow .movie-item__overflow-action')]
        .map((button) => button.textContent.trim().replace(/\\s+/g, ' '))
    }))()`);
    if (
      filtered.title !== "Gamma" ||
      filtered.subtitle !== "1 of 6 movies" ||
      filtered.moveMode ||
      filtered.movePressed !== "false" ||
      !filtered.moveDisabled ||
      filtered.dragHandleVisible ||
      filtered.actionLabels.join("|") !== "" ||
      filtered.overflowLabels.join("|") !== "Info|Re-rank|Remove"
    ) {
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

    await page.evaluate(`(() => {
      const jump = document.querySelector('#fullscreen-jump');
      jump.value = '4';
      document.querySelector('#fullscreen-jump-form')?.requestSubmit();
      return true;
    })()`);
    await waitFor(
      page,
      `document.activeElement === document.querySelector('.fullscreen-card[data-index="3"] .fullscreen-card__primary')`,
      3000,
    );
    const jumpFocus = await page.evaluate(`(() => {
      const target = document.querySelector('.fullscreen-card[data-index="3"] .fullscreen-card__primary');
      const card = target?.closest('.fullscreen-card');
      const targetStyle = getComputedStyle(target);
      const cardStyle = getComputedStyle(card);
      return {
        activeTitle: card?.querySelector('.fullscreen-card__title')?.textContent.trim(),
        primaryOutlineColor: targetStyle.outlineColor,
        primaryOutlineStyle: targetStyle.outlineStyle,
        primaryBoxShadow: targetStyle.boxShadow,
        cardBorderColor: cardStyle.borderColor,
        cardBoxShadow: cardStyle.boxShadow,
        focusToken: getComputedStyle(document.documentElement).getPropertyValue('--focus').trim()
      };
    })()`);
    if (
      jumpFocus.activeTitle !== "Delta" ||
      jumpFocus.primaryOutlineColor === "rgb(11, 99, 206)" ||
      jumpFocus.cardBoxShadow !== "none" ||
      jumpFocus.primaryBoxShadow.includes("rgb(11, 99, 206)") ||
      jumpFocus.focusToken !== "#111111"
    ) {
      throw new Error(`Full-screen jump focus style is wrong: ${JSON.stringify(jumpFocus)}`);
    }
    const jumpFocusShot = await page.screenshot("fullscreen-ranking-jump-focus.png");

    const detailClickTarget = await page.evaluate(`(() => {
      const card = document.querySelector('#fullscreen-grid .fullscreen-card[data-index="0"]');
      card?.querySelector('.fullscreen-card__primary')?.click();
      return {
        clickedIndex: card?.dataset.index,
        clickedTitle: card?.querySelector('.fullscreen-card__title')?.textContent.trim(),
        gridTitles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')]
          .map((title) => title.textContent.trim())
      };
    })()`);
    await waitFor(page, `!document.querySelector('#movie-detail')?.hidden`, 8000);
    try {
      await waitFor(page, `document.querySelector('#detail-title')?.textContent.trim() === 'Alpha'`, 8000);
    } catch (error) {
      const detailState = await page.evaluate(`(() => ({
        hidden: document.querySelector('#movie-detail')?.hidden,
        title: document.querySelector('#detail-title')?.textContent.trim(),
        sub: document.querySelector('#detail-sub')?.textContent.trim(),
        status: document.querySelector('#detail-status')?.textContent.trim(),
        fullscreenHidden: document.querySelector('#ranking-fullscreen')?.hidden
      }))()`);
      throw new Error(
        `Full-screen detail did not open Alpha: ${JSON.stringify({ detailClickTarget, detailState })}`,
        { cause: error },
      );
    }
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
        document.activeElement?.matches('.fullscreen-card__primary, [data-action="detail"]')`,
      3000,
    );

    await page.evaluate(`(() => {
      document.querySelector('.fullscreen-card[data-index="2"] .fullscreen-card__overflow > summary')?.click();
      document.querySelector('.fullscreen-card[data-index="2"] [data-action="remove"]')?.click();
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 5`, 3000);
    await page.evaluate(`document.querySelector('#add-feedback .feedback-toast__action')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 3000);

    await page.evaluate(`(() => {
      document.querySelector('.fullscreen-card[data-index="1"] .fullscreen-card__overflow > summary')?.click();
      document.querySelector('.fullscreen-card[data-index="1"] [data-action="restack"]')?.click();
      return true;
    })()`);
    await waitFor(page, `document.querySelector('#ranking-fullscreen')?.hidden && !document.querySelector('#compare')?.classList.contains('panel--hidden')`, 3000);
    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(page, `document.querySelector('#compare')?.classList.contains('panel--hidden') && document.querySelectorAll('#ranking .ranking__item').length === 6`, 3000);
    await page.evaluate(`document.querySelector('#ranking-expand')?.click(); true;`);
    await waitFor(page, `!document.querySelector('#ranking-fullscreen')?.hidden && document.querySelectorAll('#fullscreen-grid .fullscreen-card').length === 6`, 3000);
    await page.evaluate(`document.querySelector('#fullscreen-move-toggle')?.click(); true;`);
    await waitFor(page, `document.querySelector('#fullscreen-grid')?.classList.contains('is-move-mode')`, 3000);

    const fullscreenEscapePoints = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('#fullscreen-grid .fullscreen-card')];
      const first = cards[0]?.querySelector('.fullscreen-card__primary')?.getBoundingClientRect();
      const third = cards[2]?.getBoundingClientRect();
      return first && third ? {
        from: { x: first.left + first.width / 2, y: first.top + first.height / 2 },
        to: { x: third.left + third.width / 2, y: third.top + third.height / 2 }
      } : null;
    })()`);
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: fullscreenEscapePoints.from.x,
      y: fullscreenEscapePoints.from.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: fullscreenEscapePoints.to.x,
      y: fullscreenEscapePoints.to.y,
      button: "left",
      buttons: 1,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: fullscreenEscapePoints.to.x,
      y: fullscreenEscapePoints.to.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await wait(120);
    const fullscreenEscapeDrag = await page.evaluate(`(() => ({
      overlayOpen: !document.querySelector('#ranking-fullscreen')?.hidden,
      gridTitles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')].map((node) => node.textContent.trim()),
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((node) => node.textContent.trim()),
      dragging: document.querySelectorAll('#fullscreen-grid .fullscreen-card.is-dragging').length,
      bodyDragging: document.body.classList.contains('is-fullscreen-dragging'),
      detailHidden: document.querySelector('#movie-detail')?.hidden
    }))()`);
    if (
      !fullscreenEscapeDrag.overlayOpen ||
      fullscreenEscapeDrag.gridTitles.join("|") !== "Alpha|Beta|Gamma|Delta|Epsilon|Zeta" ||
      fullscreenEscapeDrag.rankingTitles.join("|") !== "Alpha|Beta|Gamma|Delta|Epsilon|Zeta" ||
      fullscreenEscapeDrag.dragging ||
      fullscreenEscapeDrag.bodyDragging ||
      !fullscreenEscapeDrag.detailHidden
    ) {
      throw new Error(`Escape closed or committed the full-screen drag: ${JSON.stringify(fullscreenEscapeDrag)}`);
    }

    await page.evaluate(`document.querySelector('#fullscreen-grid .fullscreen-card[data-index="0"] .fullscreen-card__drag-handle')?.focus(); true;`);
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      windowsVirtualKeyCode: 40,
      code: "ArrowDown",
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')][1]?.textContent.trim() === 'Alpha' &&
        document.activeElement?.closest('.fullscreen-card')?.dataset.index === '1'`,
      3000,
    );
    const fullscreenKeyboardMoveDown = await page.evaluate(`(() => ({
      gridTitles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')].map((el) => el.textContent.trim()),
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      focusedIndex: document.activeElement?.closest('.fullscreen-card')?.dataset.index || '',
      focusedLabel: document.activeElement?.getAttribute('aria-label') || '',
      keyshortcuts: document.activeElement?.getAttribute('aria-keyshortcuts') || '',
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || ''
    }))()`);
    if (
      fullscreenKeyboardMoveDown.gridTitles.slice(0, 2).join("|") !== "Beta|Alpha" ||
      fullscreenKeyboardMoveDown.rankingTitles.slice(0, 2).join("|") !== "Beta|Alpha" ||
      fullscreenKeyboardMoveDown.focusedIndex !== "1" ||
      !fullscreenKeyboardMoveDown.focusedLabel.includes("Move Alpha") ||
      fullscreenKeyboardMoveDown.keyshortcuts !== "ArrowUp ArrowDown" ||
      !fullscreenKeyboardMoveDown.feedback.includes('"Alpha" moved to #2 of 6.')
    ) {
      throw new Error(`Full-screen keyboard move down is wrong: ${JSON.stringify(fullscreenKeyboardMoveDown)}`);
    }
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowUp",
      windowsVirtualKeyCode: 38,
      code: "ArrowUp",
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')][0]?.textContent.trim() === 'Alpha' &&
        document.activeElement?.closest('.fullscreen-card')?.dataset.index === '0'`,
      3000,
    );
    const fullscreenKeyboardMoveUp = await page.evaluate(`(() => ({
      gridTitles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')].map((el) => el.textContent.trim()),
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      focusedIndex: document.activeElement?.closest('.fullscreen-card')?.dataset.index || '',
      focusedLabel: document.activeElement?.getAttribute('aria-label') || '',
      feedback: document.querySelector('#add-feedback')?.textContent.trim() || ''
    }))()`);
    if (
      fullscreenKeyboardMoveUp.gridTitles.slice(0, 2).join("|") !== "Alpha|Beta" ||
      fullscreenKeyboardMoveUp.rankingTitles.slice(0, 2).join("|") !== "Alpha|Beta" ||
      fullscreenKeyboardMoveUp.focusedIndex !== "0" ||
      !fullscreenKeyboardMoveUp.focusedLabel.includes("Move Alpha") ||
      !fullscreenKeyboardMoveUp.feedback.includes('"Alpha" moved to #1 of 6.')
    ) {
      throw new Error(`Full-screen keyboard move up is wrong: ${JSON.stringify(fullscreenKeyboardMoveUp)}`);
    }

    const dragPoints = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('#fullscreen-grid .fullscreen-card')];
      const firstHandle = cards[0].querySelector('.fullscreen-card__drag-handle').getBoundingClientRect();
      const last = cards.at(-1).getBoundingClientRect();
      return {
        from: { x: firstHandle.left + firstHandle.width / 2, y: firstHandle.top + firstHandle.height / 2 },
        to: { x: last.right - 2, y: last.top + last.height / 2 }
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
    const undoHit = await page.evaluate(`(() => {
      const button = document.querySelector('#add-feedback .feedback-toast__action');
      if (!button) return { found: false };
      const rect = button.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const hit = document.elementFromPoint(center.x, center.y);
      return {
        found: true,
        text: button.textContent.trim(),
        center,
        hitMatches: hit === button || hit?.closest?.('.feedback-toast__action') === button,
        hitText: hit?.textContent?.trim() || '',
        toastPointerEvents: getComputedStyle(document.querySelector('#add-feedback')).pointerEvents,
        actionPointerEvents: getComputedStyle(button).pointerEvents,
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    })()`);
    if (
      !undoHit.found ||
      undoHit.text !== "Undo" ||
      !undoHit.hitMatches ||
      undoHit.toastPointerEvents !== "auto" ||
      undoHit.actionPointerEvents !== "auto" ||
      undoHit.rect.width < 44 ||
      undoHit.rect.height < 28
    ) {
      throw new Error(`Full-screen drag undo toast is not click-safe: ${JSON.stringify(undoHit)}`);
    }
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: undoHit.center.x,
      y: undoHit.center.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: undoHit.center.x,
      y: undoHit.center.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await waitFor(
      page,
      `[...document.querySelectorAll('#ranking .ranking__title')][0]?.textContent.includes('Alpha')`,
      5000,
    );

    const state = await page.evaluate(`(() => ({
      overlayOpen: !document.querySelector('#ranking-fullscreen')?.hidden,
      gridTitles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__title')].map((el) => el.textContent.trim()),
      rankingTitles: [...document.querySelectorAll('#ranking .ranking__title')].map((el) => el.textContent.trim()),
      compact: document.querySelector('#fullscreen-grid')?.classList.contains('is-compact'),
      moveMode: document.querySelector('#fullscreen-grid')?.classList.contains('is-move-mode'),
      movePressed: document.querySelector('#fullscreen-move-toggle')?.getAttribute('aria-pressed'),
      focusedTitle: document.activeElement?.querySelector?.('.fullscreen-card__title')?.textContent.trim() || '',
      draggingCards: document.querySelectorAll('#fullscreen-grid .fullscreen-card.is-dragging').length,
      staleDraggedCards: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card')]
        .filter((card) => card.dataset.dragged === 'true').length,
      actionRowsVisible: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__actions')]
        .every((actions) => {
          const style = getComputedStyle(actions);
          const rect = actions.getBoundingClientRect();
          return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity || 1) === 1 && rect.height >= 30;
        }),
      visibleHandles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__drag-handle')]
        .filter((button) => getComputedStyle(button).display !== 'none').length,
      visibleOverflowToggles: [...document.querySelectorAll('#fullscreen-grid .fullscreen-card__overflow .movie-item__overflow-toggle')]
        .filter((button) => getComputedStyle(button).display !== 'none').length,
      handleInsidePosters: document.querySelectorAll('#fullscreen-grid .fullscreen-card__poster .fullscreen-card__drag-handle').length
    }))()`);
    if (
      !state.overlayOpen ||
      state.gridTitles[0] !== "Alpha" ||
      state.rankingTitles[0] !== "Alpha" ||
      !state.compact ||
      !state.moveMode ||
      state.movePressed !== "true" ||
      state.draggingCards ||
      state.staleDraggedCards ||
      !state.actionRowsVisible ||
      state.visibleHandles !== 6 ||
      state.visibleOverflowToggles !== 0 ||
      state.handleInsidePosters
    ) {
      throw new Error(`Full-screen drag undo did not restore the original order: ${JSON.stringify(state)}`);
    }
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: {
        semantics,
        nestedModal,
        fullscreenDetailLayer,
        filtered,
        fullscreenKeyboardMoveDown,
        fullscreenKeyboardMoveUp,
        fullscreenEscapeDrag,
        state,
      },
      screenshots: [jumpFocusShot, fullscreenOverflowDetailShot, await page.screenshot("fullscreen-ranking-interactions.png")],
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

    const readSuggestionResponsiveLayout = async () =>
      page.evaluate(`(() => {
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? {
            top: Math.round(bounds.top),
            right: Math.round(bounds.right),
            bottom: Math.round(bounds.bottom),
            left: Math.round(bounds.left),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : null;
        };
        const overlaps = (a, b) => !!a && !!b &&
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        const columnCount = (value) =>
          String(value || '').split(' ').map((part) => part.trim()).filter(Boolean).length;
        const rows = [...document.querySelectorAll('.panel--discovery .suggest-row')].map((row) => {
          const rowStyle = getComputedStyle(row);
          const cards = [...row.querySelectorAll('.suggest-card:not(.suggest-card--loading)')].map((card) => {
            const cardRect = rect(card);
            const title = rect(card.querySelector('.suggest-name'));
            const year = rect(card.querySelector('.suggest-meta'));
            const reason = rect(card.querySelector('.suggest-reason'));
            const poster = rect(card.querySelector('.suggest-poster'));
            const detail = rect(card.querySelector('.suggest-info'));
            const actions = rect(card.querySelector('.suggest-actions'));
            const actionsStyle = card.querySelector('.suggest-actions')
              ? getComputedStyle(card.querySelector('.suggest-actions'))
              : null;
            return {
              rowId: row.id,
              titleText: card.querySelector('.suggest-name')?.textContent.trim(),
              card: cardRect,
              title,
              year,
              reason,
              poster,
              detail,
              actions,
              actionColumnCount: columnCount(actionsStyle?.gridTemplateColumns),
              titleOverlapsReason: overlaps(title, reason),
              titleOverlapsPoster: overlaps(title, poster),
              reasonOverlapsPoster: overlaps(reason, poster),
              detailOverlapsTitle: overlaps(detail, title),
              actionsOverlapsContent:
                overlaps(actions, title) ||
                overlaps(actions, year) ||
                overlaps(actions, reason) ||
                overlaps(actions, poster),
              actionsBelowReason: actions && reason ? actions.top >= reason.bottom - 1 : false,
              titleWithinCard: cardRect && title ? title.left >= cardRect.left && title.right <= cardRect.right : false,
              reasonWithinCard: cardRect && reason ? reason.left >= cardRect.left && reason.right <= cardRect.right : false,
              actionsWithinCard: cardRect && actions ? actions.left >= cardRect.left && actions.right <= cardRect.right : false
            };
          });
          const firstThree = cards.slice(0, 3);
          return {
            id: row.id,
            row: rect(row),
            gridTemplateColumns: rowStyle.gridTemplateColumns,
            gridColumnCount: columnCount(rowStyle.gridTemplateColumns),
            cardCount: cards.length,
            firstThreeShareRow: firstThree.length === 3 &&
              firstThree.every((card) => Math.abs(card.card.top - firstThree[0].card.top) < 3),
            cards
          };
        });
        const visibleCards = rows
          .flatMap((row) => row.cards)
          .filter((card) => card.card?.width > 0 && card.card?.height > 0);
        return {
          destination: document.querySelector('main.app')?.dataset.appDestination,
          currentNav: document.querySelector('.app-nav--top .app-nav__item[aria-current="page"]')?.textContent.trim() ||
            document.querySelector('.app-nav--mobile .app-nav__item[aria-current="page"]')?.textContent.trim(),
          pointerCoarse: matchMedia('(pointer: coarse)').matches,
          portrait: matchMedia('(orientation: portrait)').matches,
          landscape: matchMedia('(orientation: landscape)').matches,
          panel: rect(document.querySelector('.panel--discovery')),
          stack: rect(document.querySelector('.stack')),
          sideStack: rect(document.querySelector('.side-stack')),
          rows: rows.map(({ cards, ...row }) => row),
          cardCount: visibleCards.length,
          minCardWidth: visibleCards.length ? Math.min(...visibleCards.map((card) => card.card.width)) : 0,
          brokenCards: visibleCards.filter((card) =>
            card.card.width < 238 ||
            card.titleOverlapsReason ||
            card.titleOverlapsPoster ||
            card.reasonOverlapsPoster ||
            card.detailOverlapsTitle ||
            card.actionsOverlapsContent ||
            !card.actionsBelowReason ||
            !card.titleWithinCard ||
            !card.reasonWithinCard ||
            !card.actionsWithinCard ||
            card.actionColumnCount < 3
          ).map((card) => ({
            rowId: card.rowId,
            titleText: card.titleText,
            card: card.card,
            actionColumnCount: card.actionColumnCount,
            titleOverlapsReason: card.titleOverlapsReason,
            titleOverlapsPoster: card.titleOverlapsPoster,
            reasonOverlapsPoster: card.reasonOverlapsPoster,
            detailOverlapsTitle: card.detailOverlapsTitle,
            actionsOverlapsContent: card.actionsOverlapsContent,
            actionsBelowReason: card.actionsBelowReason,
            titleWithinCard: card.titleWithinCard,
            reasonWithinCard: card.reasonWithinCard,
            actionsWithinCard: card.actionsWithinCard
          })),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth
        };
      })()`);
    const assertSuggestionResponsiveLayout = (label, layout, options) => {
      const rows = layout.rows.filter((row) => row.cardCount > 0);
      const wrongRowFlow = options.stacked
        ? rows.filter((row) => row.firstThreeShareRow || row.gridColumnCount !== 1)
        : rows.filter((row) => !row.firstThreeShareRow || row.gridColumnCount < 3);
      if (
        layout.destination !== options.destination ||
        !layout.pointerCoarse ||
        layout.cardCount !== 9 ||
        layout.minCardWidth < options.minCardWidth ||
        layout.scrollWidth > layout.innerWidth ||
        layout.brokenCards.length ||
        wrongRowFlow.length
      ) {
        throw new Error(`${label} suggestion layout is broken: ${JSON.stringify({ layout, wrongRowFlow })}`);
      }
    };
    const setTouchTabletViewport = async (width, height) => {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: true,
        screenWidth: width,
        screenHeight: height,
      });
      await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await wait(250);
    };
    const setDestination = async (destination) => {
      await page.evaluate(`(() => {
        document.querySelectorAll('[data-app-destination-target="${destination}"]').forEach((button) => button.click());
        return true;
      })()`);
      await waitFor(
        page,
        `document.querySelector('main.app')?.dataset.appDestination === ${JSON.stringify(destination)}`,
        3000,
      );
      await wait(150);
    };
    const responsiveScreenshots = [];
    const captureSuggestionSection = async (filename) => {
      await page.evaluate(`document.querySelector('#suggest-related-title')?.scrollIntoView({ block: 'start' }); true;`);
      await wait(100);
      return page.screenshot(filename);
    };

    await setTouchTabletViewport(1024, 768);
    const ipadRankLandscape = await readSuggestionResponsiveLayout();
    assertSuggestionResponsiveLayout("iPad landscape Rank rail", ipadRankLandscape, {
      destination: "rank",
      stacked: true,
      minCardWidth: 260,
    });
    responsiveScreenshots.push(await captureSuggestionSection("suggestions-ipad-landscape-rank.png"));

    await setDestination("discover");
    const ipadDiscoverLandscape = await readSuggestionResponsiveLayout();
    assertSuggestionResponsiveLayout("iPad landscape Discover", ipadDiscoverLandscape, {
      destination: "discover",
      stacked: false,
      minCardWidth: 250,
    });
    responsiveScreenshots.push(await captureSuggestionSection("suggestions-ipad-landscape-discover.png"));

    await setTouchTabletViewport(980, 1180);
    const ipadDiscoverPortrait = await readSuggestionResponsiveLayout();
    assertSuggestionResponsiveLayout("iPad portrait Discover", ipadDiscoverPortrait, {
      destination: "discover",
      stacked: false,
      minCardWidth: 250,
    });
    responsiveScreenshots.push(await captureSuggestionSection("suggestions-ipad-portrait-discover.png"));

    await setDestination("rank");
    const ipadRankPortrait = await readSuggestionResponsiveLayout();
    // Rank keeps the same two-column composition as a fine-pointer viewport at
    // this width, so its suggestion rail remains a single-card column. Input
    // modality changes the controls, not the available-width layout.
    assertSuggestionResponsiveLayout("iPad portrait Rank rail", ipadRankPortrait, {
      destination: "rank",
      stacked: true,
      minCardWidth: 250,
    });
    responsiveScreenshots.push(await captureSuggestionSection("suggestions-ipad-portrait-rank.png"));

    await setDestination("discover");
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 390,
      screenHeight: 844,
    });
    await wait(250);
    const mobileLayout = await page.evaluate(`(() => {
      const rect = (element) => {
        const bounds = element?.getBoundingClientRect();
        return bounds ? {
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height
        } : null;
      };
      const overlaps = (a, b) => !!a && !!b &&
        a.left < b.right - 1 &&
        a.right > b.left + 1 &&
        a.top < b.bottom - 1 &&
        a.bottom > b.top + 1;
      const cards = [...document.querySelectorAll('.suggest-card:not(.suggest-card--loading)')]
        .slice(0, 9)
        .map((card) => {
          const cardRect = rect(card);
          const title = rect(card.querySelector('.suggest-name'));
          const year = rect(card.querySelector('.suggest-meta'));
          const reason = rect(card.querySelector('.suggest-reason'));
          const poster = rect(card.querySelector('.suggest-poster'));
          const detail = rect(card.querySelector('.suggest-info'));
          const actions = rect(card.querySelector('.suggest-actions'));
          return {
            titleText: card.querySelector('.suggest-name')?.textContent.trim(),
            card: cardRect,
            title,
            year,
            reason,
            poster,
            detail,
            actions,
            titleOverlapsReason: overlaps(title, reason),
            titleOverlapsPoster: overlaps(title, poster),
            reasonOverlapsPoster: overlaps(reason, poster),
            detailOverlapsTitle: overlaps(detail, title),
            actionsOverlapsContent: overlaps(actions, title) || overlaps(actions, year) || overlaps(actions, reason) || overlaps(actions, poster),
            actionsBelowReason: actions && reason ? actions.top >= reason.bottom - 1 : false,
            titleWithinCard: cardRect && title ? title.left >= cardRect.left && title.right <= cardRect.right : false,
            reasonWithinCard: cardRect && reason ? reason.left >= cardRect.left && reason.right <= cardRect.right : false
          };
        });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        cardCount: cards.length,
        cards
      };
    })()`);
    const brokenMobileCards = mobileLayout.cards.filter((card) =>
      card.titleOverlapsReason ||
      card.titleOverlapsPoster ||
      card.reasonOverlapsPoster ||
      card.detailOverlapsTitle ||
      card.actionsOverlapsContent ||
      !card.actionsBelowReason ||
      !card.titleWithinCard ||
      !card.reasonWithinCard
    );
    if (
      mobileLayout.scrollWidth > mobileLayout.innerWidth ||
      mobileLayout.cardCount !== 9 ||
      brokenMobileCards.length
    ) {
      throw new Error(`Mobile suggestion card layout is broken: ${JSON.stringify({ ...mobileLayout, brokenMobileCards })}`);
    }

    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1280,
      screenHeight: 1000,
    });
    await wait(250);

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
      details: {
        pending,
        initial,
        ipadRankLandscape,
        ipadDiscoverLandscape,
        ipadDiscoverPortrait,
        ipadRankPortrait,
        refreshedPending,
        refreshed,
      },
      screenshots: [...responsiveScreenshots, await page.screenshot("suggestion-explanations.png")],
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

const testTonightPicker = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "tonight-picker", width: 1280, height: 900 });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          const facts = {
            4101: { tmdbId: 4101, title: 'Queue Crime', year: 2004, posterPath: '', runtime: 120,
              genres: ['Crime', 'Thriller'], keywords: ['heist'], director: 'Director One', cast: ['Actor One'],
              moodScore: 0.2, moodMatches: { senses: [], keywords: [], era: null } },
            4102: { tmdbId: 4102, title: 'Queue Comedy', year: 2016, posterPath: '', runtime: 105,
              genres: ['Comedy'], keywords: ['buddy'], director: '', cast: [],
              moodScore: 0.9, moodMatches: { senses: ['funny'], keywords: ['buddy'], era: null } },
            4103: { tmdbId: 4103, title: 'Queue Epic', year: 2012, posterPath: '', runtime: 195,
              genres: ['War'], keywords: ['battle'], director: '', cast: [],
              moodScore: 0.1, moodMatches: { senses: [], keywords: [], era: null } },
            4104: { tmdbId: 4104, title: 'Queue Feelgood', year: 2019, posterPath: '', runtime: 98,
              genres: ['Comedy', 'Family'], keywords: ['feel good'], director: '', cast: [],
              moodScore: 0.75, moodMatches: { senses: ['funny', 'feel-good'], keywords: ['feel good'], era: null } }
          };
          const realFetch = window.fetch.bind(window);
          window.fetch = (input, options) => {
            const url = typeof input === 'string' ? input : input?.url || '';
            if (url.includes('/functions/v1/tonight-pick')) {
              const params = new URL(url).searchParams;
              const mood = params.get('mood') || '';
              const ids = (params.get('ids') || '').split(',').map(Number);
              window.__tonightRequests = (window.__tonightRequests || []).concat([{ ids, mood }]);
              return Promise.resolve(new Response(JSON.stringify({
                mood: mood ? { readable: true, recognized: ['funny'], era: null, runtimeHint: null } : null,
                results: ids.map((id) => {
                  if (!facts[id]) return null;
                  return mood ? facts[id] : { ...facts[id], moodScore: null, moodMatches: null };
                }).filter(Boolean)
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            if (url.includes('/functions/v1/tmdb-detail')) {
              const id = Number(new URL(url).searchParams.get('id'));
              return Promise.resolve(new Response(JSON.stringify({
                result: { tmdbId: id, runtime: 110, genres: ['Drama'], director: '', cast: [], overview: 'E2E.' }
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            return realFetch(input, options);
          };
        })();
      `,
    });
    await seedPage(page, baseUrl, "tonight-picker", {
      ranking: [
        { ...movie("Ranked Crime", 1995, 4001), genres: ["Crime"] },
        { ...movie("Ranked Crime Two", 2006, 4002), genres: ["Crime"] },
        { ...movie("Ranked Comedy", 2007, 4003), genres: ["Comedy"] },
      ],
      watchList: [
        queueMovie("Queue Crime", 2004, 4101),
        queueMovie("Queue Comedy", 2016, 4102),
        queueMovie("Queue Epic", 2012, 4103),
        queueMovie("Queue Feelgood", 2019, 4104),
      ],
    });

    await page.evaluate(
      `document.querySelector('.app-nav--top .app-nav__item[data-app-destination-target="lists"]')?.click(); true;`,
    );
    const collapsed = await page.evaluate(`(() => ({
      panelHidden: document.querySelector('#tonight-panel')?.hidden,
      contentHidden: document.querySelector('#tonight-content')?.hidden,
      expanded: document.querySelector('#tonight-toggle')?.getAttribute('aria-expanded')
    }))()`);
    if (collapsed.panelHidden || !collapsed.contentHidden || collapsed.expanded !== "false") {
      throw new Error(`Tonight panel collapsed state is wrong: ${JSON.stringify(collapsed)}`);
    }

    await page.evaluate(`document.querySelector('#tonight-toggle')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#tonight-time .tonight__chip').length === 4`, 5000);
    await page.evaluate(`(() => {
      document.querySelector('.tonight__chip[data-window="standard"]')?.click();
      const mood = document.querySelector('#tonight-mood');
      mood.value = 'funny feel good';
      document.querySelector('#tonight-run')?.click();
      return true;
    })()`);
    await waitFor(page, `document.querySelectorAll('#tonight-results .tonight-card').length === 3`, 5000);
    const picks = await page.evaluate(`(() => ({
      request: (window.__tonightRequests || [])[0] || null,
      status: document.querySelector('#tonight-status')?.textContent.trim(),
      titles: [...document.querySelectorAll('.tonight-card__title')].map((el) => el.textContent.trim()),
      firstReasons: [...document.querySelectorAll('.tonight-card .tonight-card__reasons')][0]?.textContent || '',
      footerHidden: document.querySelector('#tonight-footer')?.hidden
    }))()`);
    if (
      !picks.request ||
      picks.request.mood !== "funny feel good" ||
      picks.request.ids.join("|") !== "4101|4102|4103|4104" ||
      picks.status !== "Vibe read as funny." ||
      picks.titles[0] !== "Queue Comedy (2016)" ||
      picks.titles.length !== 3 ||
      picks.titles.includes("Queue Epic (2012)") ||
      !/Matches your vibe — funny, buddy/.test(picks.firstReasons) ||
      picks.footerHidden
    ) {
      throw new Error(`Tonight picks are wrong: ${JSON.stringify(picks)}`);
    }

    await page.evaluate(`document.querySelector('.tonight-card .tonight-card__watch')?.click(); true;`);
    await waitFor(page, `document.querySelectorAll('#tonight-results .tonight-card').length === 1`, 5000);
    const chosen = await page.evaluate(`(() => ({
      title: document.querySelector('.tonight-card__title')?.textContent.trim(),
      hasRank: !!document.querySelector('.tonight-card__rank'),
      hasBack: !!document.querySelector('.tonight-card__back'),
      status: document.querySelector('#tonight-status')?.textContent.trim(),
      footerHidden: document.querySelector('#tonight-footer')?.hidden
    }))()`);
    if (
      chosen.title !== "Queue Comedy (2016)" ||
      !chosen.hasRank ||
      !chosen.hasBack ||
      !/Enjoy “Queue Comedy”/.test(chosen.status) ||
      !chosen.footerHidden
    ) {
      throw new Error(`Tonight chosen state is wrong: ${JSON.stringify(chosen)}`);
    }

    await page.evaluate(`document.querySelector('.tonight-card__rank')?.click(); true;`);
    await waitFor(page, `document.body.classList.contains('is-comparing')`, 5000);
    await page.evaluate(`document.querySelector('#cancel-ranking')?.click(); true;`);
    await waitFor(page, `!document.body.classList.contains('is-comparing')`, 5000);
    const afterCancel = await page.evaluate(`(() => ({
      queueRows: document.querySelectorAll('#watch-list .queue-list__item').length,
      cards: document.querySelectorAll('#tonight-results .tonight-card').length
    }))()`);
    if (afterCancel.queueRows !== 4 || afterCancel.cards !== 3) {
      throw new Error(`Tonight rank/cancel round trip is wrong: ${JSON.stringify(afterCancel)}`);
    }

    const desktopShot = await page.screenshot("tonight-picker-desktop.png");
    const health = await pageHealth(page);
    if (health.errors.length) throw new Error(`Browser errors: ${JSON.stringify(health.errors)}`);
    return {
      details: { collapsed, picks, chosen, afterCancel },
      screenshots: [desktopShot],
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
    const allPacksCloseStyle = await page.evaluate(`(() => {
      const close = document.querySelector('#pack-detail-close');
      const style = getComputedStyle(close);
      const bounds = close.getBoundingClientRect();
      return {
        text: close.textContent.trim(),
        aria: close.getAttribute('aria-label'),
        icon: close.querySelector('use')?.getAttribute('href'),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        padding: style.padding,
        borderColor: style.borderTopColor,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        color: style.color
      };
    })()`);
    if (
      allPacksCloseStyle.text ||
      allPacksCloseStyle.aria !== "Close suggestion packs" ||
      allPacksCloseStyle.icon !== "#icon-close" ||
      allPacksCloseStyle.width < 43 ||
      allPacksCloseStyle.height < 43 ||
      allPacksCloseStyle.padding !== "0px"
    ) {
      throw new Error(`All Packs close control is wrong: ${JSON.stringify(allPacksCloseStyle)}`);
    }
    const allPacksCloseVisual = {
      text: allPacksCloseStyle.text,
      width: allPacksCloseStyle.width,
      height: allPacksCloseStyle.height,
      padding: allPacksCloseStyle.padding,
      borderColor: allPacksCloseStyle.borderColor,
      borderRadius: allPacksCloseStyle.borderRadius,
      background: allPacksCloseStyle.background,
      color: allPacksCloseStyle.color,
    };
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
    const pagerBefore = await page.evaluate(`(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector)?.getBoundingClientRect();
        return bounds ? {
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          top: Math.round(bounds.top),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height)
        } : null;
      };
      const close = document.querySelector('#pack-detail-close');
      const sheet = rect('#pack-detail .pack-sheet');
      const closeRect = rect('#pack-detail-close');
      const prevRect = rect('#pack-detail-prev');
      const nextRect = rect('#pack-detail-next');
      const closeStyle = getComputedStyle(close);
      return {
        hidden: document.querySelector('#pack-detail-pager')?.hidden,
        count: document.querySelector('#pack-detail-pager-count')?.textContent.trim(),
        prevDisabled: document.querySelector('#pack-detail-prev')?.disabled,
        nextDisabled: document.querySelector('#pack-detail-next')?.disabled,
        closeText: close?.textContent.trim(),
        closeAria: close?.getAttribute('aria-label'),
        closeIcon: close?.querySelector('use')?.getAttribute('href'),
        closeRect,
        prevRect,
        nextRect,
        closeRightInset: closeRect && sheet ? sheet.right - closeRect.right : null,
        closeTopInset: closeRect && sheet ? closeRect.top - sheet.top : null,
        controlsAligned: closeRect && prevRect && nextRect
          ? Math.abs(closeRect.top - prevRect.top) <= 1 &&
            Math.abs(closeRect.top - nextRect.top) <= 1 &&
            Math.abs(closeRect.height - prevRect.height) <= 1 &&
            Math.abs(closeRect.height - nextRect.height) <= 1
          : false,
        pagerBeforeClose: closeRect && nextRect ? nextRect.right + 8 <= closeRect.left : false,
        closeStyle: {
          text: close?.textContent.trim(),
          width: Math.round(closeRect?.width || 0),
          height: Math.round(closeRect?.height || 0),
          padding: closeStyle.padding,
          borderColor: closeStyle.borderTopColor,
          borderRadius: closeStyle.borderRadius,
          background: closeStyle.backgroundColor,
          color: closeStyle.color
        }
      };
    })()`);
    if (
      pagerBefore.hidden ||
      pagerBefore.count !== "Pack 2 of 3" ||
      pagerBefore.nextDisabled ||
      pagerBefore.closeText ||
      pagerBefore.closeAria !== "Close pack and return to all suggestion packs" ||
      pagerBefore.closeIcon !== "#icon-close" ||
      pagerBefore.closeRightInset < 16 ||
      pagerBefore.closeRightInset > 30 ||
      pagerBefore.closeTopInset < 16 ||
      pagerBefore.closeTopInset > 30 ||
      !pagerBefore.controlsAligned ||
      !pagerBefore.pagerBeforeClose ||
      JSON.stringify(pagerBefore.closeStyle) !== JSON.stringify(allPacksCloseVisual)
    ) {
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
    await page.evaluate(`document.querySelector('#pack-detail-close')?.click(); true;`);
    await waitFor(
      page,
      `document.querySelector('#pack-detail')?.classList.contains('is-all-packs') &&
        document.activeElement?.dataset.slug === 'e2e-director-fresh'`,
      3000,
    );
    const closeReturn = await page.evaluate(`(() => ({
      browserOpen: document.querySelector('#pack-detail')?.classList.contains('is-all-packs'),
      title: document.querySelector('#pack-detail-title')?.textContent.trim(),
      focusedSlug: document.activeElement?.dataset.slug || null,
      closeAria: document.querySelector('#pack-detail-close')?.getAttribute('aria-label'),
      closeIcon: document.querySelector('#pack-detail-close use')?.getAttribute('href')
    }))()`);
    if (
      !closeReturn.browserOpen ||
      closeReturn.title !== "All suggestion packs" ||
      closeReturn.focusedSlug !== "e2e-director-fresh" ||
      closeReturn.closeAria !== "Close suggestion packs" ||
      closeReturn.closeIcon !== "#icon-close"
    ) {
      throw new Error(`Pack Close did not return to All Packs: ${JSON.stringify(closeReturn)}`);
    }
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
      details: { search, headStart, pagerBefore, actions, closeReturn, persisted },
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
    await page.evaluate(`(() => {
      const button = document.querySelector('.app-nav--mobile [data-app-destination-target="discover"]');
      button?.click();
      return true;
    })()`);
    await waitFor(page, `document.querySelector('main.app')?.dataset.appDestination === 'discover'`, 5000);
    const navClickState = await page.evaluate(`(() => {
      const button = document.querySelector('.app-nav--mobile [data-app-destination-target="discover"]');
      const topButton = document.querySelector('.app-nav--top [data-app-destination-target="discover"]');
      return {
        found: Boolean(button),
        topFound: Boolean(topButton),
        destination: document.querySelector('main.app')?.dataset.appDestination,
        mobileDisplay: button ? getComputedStyle(button.closest('.app-nav--mobile')).display : null,
        inert: document.querySelector('main.app')?.inert,
        bodyClass: document.body.className,
        buttonText: button?.textContent.trim() || null,
      };
    })()`);
    if (navClickState.destination !== "discover") {
      throw new Error(`Mobile Discover nav did not activate: ${JSON.stringify(navClickState)}`);
    }
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
        const pager = document.querySelector('#pack-detail-pager');
        const pagerRect = pager?.getBoundingClientRect();
        const pagerVisible = !!pagerRect && !pager.hidden && pagerRect.width > 0 && pagerRect.height > 0;
        const sheetRect = document.querySelector('#pack-detail .pack-sheet')?.getBoundingClientRect();
        const subRect = document.querySelector('#pack-detail-sub')?.getBoundingClientRect();
        const overlaps = (a, b) => !!a && !!b &&
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          title: document.querySelector('#pack-detail-title')?.textContent.trim(),
          titleCloseOverlap: overlaps(titleRect, closeRect),
          titleSubOverlap: overlaps(titleRect, subRect),
          closeText: document.querySelector('#pack-detail-close')?.textContent.trim(),
          closeAria: document.querySelector('#pack-detail-close')?.getAttribute('aria-label'),
          closeIcon: document.querySelector('#pack-detail-close use')?.getAttribute('href'),
          closeRightInset: Math.round((sheetRect?.right || 0) - (closeRect?.right || 0)),
          closeAboveTitle: !!closeRect && !!titleRect && closeRect.bottom + 8 <= titleRect.top,
          pagerVisible,
          controlsAligned: !pagerVisible || (!!closeRect && Math.abs(closeRect.top - pagerRect.top) <= 1 && Math.abs(closeRect.height - pagerRect.height) <= 1),
          pagerBeforeClose: !pagerVisible || (!!closeRect && pagerRect.right + 8 <= closeRect.left),
          pagerAboveTitle: !pagerVisible || (!!titleRect && pagerRect.bottom + 8 <= titleRect.top),
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
      blockbuster.closeText ||
      blockbuster.closeAria !== "Close pack and return to all suggestion packs" ||
      blockbuster.closeIcon !== "#icon-close" ||
      blockbuster.closeRightInset < 16 ||
      blockbuster.closeRightInset > 30 ||
      !blockbuster.closeAboveTitle ||
      !blockbuster.controlsAligned ||
      !blockbuster.pagerBeforeClose ||
      !blockbuster.pagerAboveTitle ||
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
    if (
      tomHanks.titleCloseOverlap ||
      tomHanks.titleSubOverlap ||
      tomHanks.closeText ||
      tomHanks.closeIcon !== "#icon-close" ||
      !tomHanks.closeAboveTitle ||
      !tomHanks.controlsAligned ||
      !tomHanks.pagerBeforeClose ||
      !tomHanks.pagerAboveTitle
    ) {
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
  { name: "high-value primary action visual system", run: testPrimaryActionVisualSystem },
  { name: "first-run quick start activation flow", run: testFirstRunQuickStart },
  { name: "dedicated sign-in view and provider availability", run: testSignInExperience },
  { name: "watch queue comparison flow", run: testQueueComparison },
  { name: "browser storage failure warning", run: testStorageFailureWarning },
  { name: "TMDB failure and recovery", run: testTmdbFailureRecovery },
  { name: "movie detail clears between ranked movies", run: testMovieDetailClearsBetweenRankedMovies },
  { name: "comparison undo and cancel restore origin", run: testComparisonUndoCancel },
  { name: "ranking review swap, Escape, and session undo", run: testRankingReviewSession },
  { name: "autocomplete keyboard selection", run: testAutocompleteKeyboardSelection },
  { name: "portrait and landscape comparison layouts", run: testComparisonResponsiveLayouts },
  { name: "Share Studio preview and empty toggles", run: testShareStudio },
  { name: "backup restore and title-list import", run: testBackupAndImport },
  { name: "backup, PNG, and ZIP downloads", run: testBackupAndImageDownloads },
  { name: "signed-in Supabase merge and save", run: testSignedInSupabaseMergeAndSave },
  { name: "public shareable list link", run: testPublicShareLink },
  { name: "ranking pointer drag transactions", run: testRankingPointerTransactions },
  { name: "full-screen ranking interactions", run: testFullscreenRankingInteractions },
  { name: "Taste Explorer evidence and ranking lens", run: testTasteExplorer },
  { name: "tonight picker mood, choice, and rank round trip", run: testTonightPicker },
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
