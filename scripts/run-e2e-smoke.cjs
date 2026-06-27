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
  fs.rmSync(profile, { recursive: true, force: true });

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

  return { send, evaluate, screenshot, events, close };
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

const testQueueComparison = async ({ baseUrl }) => {
  const page = await openChromePage({ name: "queue-comparison" });
  try {
    await seedPage(page, baseUrl, "queue-comparison", {
      ranking: [movie("Alpha", 1990, 1101), movie("Beta", 2000, 1102), movie("Gamma", 2010, 1103)],
      watchList: [queueMovie("Omega", 2022, 1104)],
    });
    const started = await page.evaluate(`(() => {
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
    if (reviewState.unresolved !== 1 || reviewState.confirmHidden || !reviewState.applyDisabled) {
      throw new Error(`Import review did not require disambiguation + replacement consent: ${JSON.stringify(reviewState)}`);
    }
    const reviewShot = await page.screenshot("backup-import-review.png");

    await page.evaluate(`(() => {
      const heat = document.querySelector('select[aria-label="TMDB match for Heat"]');
      heat.value = '949';
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

const tests = [
  { name: "localStorage persistence round-trip", run: testLoadPersistence },
  { name: "watch queue comparison flow", run: testQueueComparison },
  { name: "comparison undo and cancel restore origin", run: testComparisonUndoCancel },
  { name: "Share Studio preview and empty toggles", run: testShareStudio },
  { name: "backup restore and title-list import", run: testBackupAndImport },
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
