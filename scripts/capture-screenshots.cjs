const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const outputDirArg = process.argv.find((arg) => arg.startsWith("--output-dir="));
const screenshotRoot = outputDirArg
  ? path.resolve(rootDir, outputDirArg.slice("--output-dir=".length))
  : path.join(rootDir, "debug", "screenshots");
const runLabelArg = process.argv.find((arg) => arg.startsWith("--label="));
const runLabel = runLabelArg ? runLabelArg.slice("--label=".length) : "";
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const onlyNames = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
  : null;
const timestampForPath = (date = new Date()) =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const runStamp = timestampForPath();
const runName = runLabel ? `${runStamp}-${slug(runLabel)}` : runStamp;
const archiveDir = outputDirArg ? screenshotRoot : path.join(screenshotRoot, "runs", runName);
const latestDir = outputDirArg ? screenshotRoot : path.join(screenshotRoot, "latest");
const chromePath =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const seedMovies = [
  {
    title: "Parasite",
    year: 2019,
    posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    tmdbId: 496243,
    comparisons: 0,
    rankedAt: "2026-06-20T18:20:00.000Z",
  },
  {
    title: "My Neighbor Totoro",
    year: 1988,
    posterPath: "/rtGDOeG9LzoerkDGZF9dnVeLppL.jpg",
    tmdbId: 8392,
    comparisons: 0,
    rankedAt: "2026-06-20T18:36:00.000Z",
  },
  {
    title: "Django Unchained",
    year: 2012,
    posterPath: "/7oWY8VDWW7thTzWh3OKYRkWUlD5.jpg",
    tmdbId: 68718,
    comparisons: 0,
    rankedAt: "2026-06-21T02:15:00.000Z",
  },
];

const seedQueues = {
  watchList: [
    {
      title: "Cinema Paradiso",
      year: 1988,
      posterPath: "/8SRUfRUi6x4O68n0VCbDNRa6iGL.jpg",
      tmdbId: 11216,
      comparisons: 0,
      queuedAt: "2026-06-21T04:30:00.000Z",
      savedAt: "2026-06-21T04:30:00.000Z",
    },
  ],
  notInterestedList: [
    {
      title: "A Clockwork Orange",
      year: 1971,
      posterPath: "/4sHeTAp65WrSSuc05nRBKddhBxO.jpg",
      tmdbId: 185,
      comparisons: 0,
      queuedAt: "2026-06-21T04:45:00.000Z",
      hiddenAt: "2026-06-21T04:45:00.000Z",
    },
  ],
};

const DEVICE_PROFILES = Object.freeze({
  desktop: Object.freeze({
    device: "desktop",
    orientation: "landscape",
    input: "fine",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    touch: false,
  }),
  ipadLandscape: Object.freeze({
    device: "ipad",
    orientation: "landscape",
    input: "coarse-touch",
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    mobile: true,
    touch: true,
  }),
  ipadPortrait: Object.freeze({
    device: "ipad",
    orientation: "portrait",
    input: "coarse-touch",
    width: 820,
    height: 1180,
    deviceScaleFactor: 2,
    mobile: true,
    touch: true,
  }),
  iphonePortrait: Object.freeze({
    device: "iphone",
    orientation: "portrait",
    input: "coarse-touch",
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    touch: true,
  }),
  iphoneLandscape: Object.freeze({
    device: "iphone",
    orientation: "landscape",
    input: "coarse-touch",
    width: 844,
    height: 390,
    deviceScaleFactor: 3,
    mobile: true,
    touch: true,
  }),
});

const createShot = (name, profileName, state) => ({
  name,
  profileName,
  state,
  ...DEVICE_PROFILES[profileName],
});

const allShots = [
  createShot("desktop-main", "desktop", "main"),
  createShot("ipad-main-landscape", "ipadLandscape", "main"),
  createShot("ipad-main-portrait", "ipadPortrait", "main"),
  createShot("mobile-main", "iphonePortrait", "main"),
  createShot("mobile-main-landscape", "iphoneLandscape", "main"),
  createShot("desktop-comparison", "desktop", "comparison"),
  createShot("ipad-comparison-landscape", "ipadLandscape", "comparison"),
  createShot("ipad-comparison-portrait", "ipadPortrait", "comparison"),
  createShot("mobile-comparison-portrait", "iphonePortrait", "comparison"),
  createShot("mobile-comparison-landscape", "iphoneLandscape", "comparison"),
  createShot("desktop-all-packs", "desktop", "all-packs"),
  createShot("ipad-all-packs-landscape", "ipadLandscape", "all-packs"),
  createShot("ipad-all-packs-portrait", "ipadPortrait", "all-packs"),
  createShot("mobile-all-packs", "iphonePortrait", "all-packs"),
  createShot("desktop-pack-detail", "desktop", "pack-detail"),
  createShot("ipad-pack-detail-portrait", "ipadPortrait", "pack-detail"),
  createShot("mobile-pack-detail", "iphonePortrait", "pack-detail"),
  createShot("desktop-movie-detail", "desktop", "movie-detail"),
  createShot("ipad-movie-detail-portrait", "ipadPortrait", "movie-detail"),
  createShot("mobile-movie-detail", "iphonePortrait", "movie-detail"),
  createShot("desktop-share-studio", "desktop", "share"),
  createShot("ipad-share-studio-landscape", "ipadLandscape", "share"),
  createShot("ipad-share-studio-portrait", "ipadPortrait", "share"),
  createShot("mobile-share-studio", "iphonePortrait", "share"),
];
const shots = onlyNames ? allShots.filter((shot) => onlyNames.has(shot.name)) : allShots;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const getCdpJson = (port, route) =>
  requestText(`http://127.0.0.1:${port}${route}`, 3000).then(({ data }) => JSON.parse(data));

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

const serveStatic = async (preferredPort = 4173) => {
  try {
    const existing = await requestText(`http://127.0.0.1:${preferredPort}/movies`, 500);
    if (existing.data.includes("StackRank")) {
      return { url: `http://127.0.0.1:${preferredPort}`, close: async () => {} };
    }
  } catch (_error) {
    // No existing server; start one below.
  }

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
    const relativePath = pathname === "/movies" ? "index.html" : pathname.replace(/^\/+/, "");
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

  const listen = (port) =>
    new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => resolve(port));
    });

  let port = preferredPort;
  try {
    await listen(port);
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    port = await getFreePort();
    await listen(port);
  }

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

const connectWebSocket = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

const openChromePage = async ({ width, height, name }) => {
  const port = await getFreePort();
  const profile = path.join("/private/tmp", `stackrank-${name}-profile`);
  fs.rmSync(profile, { recursive: true, force: true });

  const proc = spawn(
    chromePath,
    [
      "--headless",
      "--disable-gpu",
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
      await wait(150);
    }
  }

  if (!pageTarget) {
    proc.kill();
    throw new Error("Chrome CDP page target did not start");
  }

  const ws = await connectWebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 0;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const message = { id: ++id, method, params };
      const onMessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.id !== message.id) return;
        ws.removeEventListener("message", onMessage);
        if (payload.error) reject(new Error(`${method}: ${JSON.stringify(payload.error)}`));
        else resolve(payload.result);
      };
      ws.addEventListener("message", onMessage);
      ws.send(JSON.stringify(message));
    });

  const close = async () => {
    try {
      ws.close();
    } catch (_error) {
      // no-op
    }
    proc.kill();
  };

  return { send, close };
};

const captureShot = async (baseUrl, shot) => {
  const page = await openChromePage(shot);
  try {
    const archivePath = path.join(archiveDir, `${shot.name}.png`);
    const latestPath = path.join(latestDir, `${shot.name}.png`);
    const payload = {
      movies: seedMovies,
      updated_at: new Date().toISOString(),
    };
    const queues = {
      ...seedQueues,
      updated_at: new Date().toISOString(),
    };
    const shareOptions = {
      version: 7,
      displayName: "Dan",
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
      theme: "pop",
      tone: "neutral",
    };

    await page.send("Page.enable");
    await page.send("Runtime.enable");
    if (!shot.touch) {
      await page.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    }
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: shot.width,
      height: shot.height,
      deviceScaleFactor: shot.deviceScaleFactor,
      mobile: shot.mobile,
      screenWidth: shot.width,
      screenHeight: shot.height,
      screenOrientation: {
        type: shot.orientation === "portrait" ? "portraitPrimary" : "landscapePrimary",
        angle: shot.orientation === "portrait" ? 0 : 90,
      },
    });
    if (shot.touch) {
      await page.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      });
    }
    await page.send("Page.navigate", { url: `${baseUrl}/?screenshot=${encodeURIComponent(shot.name)}` });
    await wait(600);
    await page.send("Runtime.evaluate", {
      expression: `
        localStorage.setItem('stackrank:movies:v1', ${JSON.stringify(JSON.stringify(payload))});
        localStorage.setItem('stackrank:suggestion-queues:v1', ${JSON.stringify(JSON.stringify(queues))});
        localStorage.setItem('stackrank:share-options:v1', ${JSON.stringify(JSON.stringify(shareOptions))});
        location.reload();
      `,
      awaitPromise: false,
    });
    await wait(1800);

    if (shot.state === "comparison") {
      const result = await page.send("Runtime.evaluate", {
        expression: `
          (() => {
            const button = document.querySelector('.ranking__restack');
            if (!button) return { clicked: false };
            button.click();
            return { clicked: true };
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      if (!result.result.value.clicked) {
        throw new Error(`Could not enter comparison state for ${shot.name}`);
      }
      await wait(800);
    }

    if (shot.state === "share") {
      const result = await page.send("Runtime.evaluate", {
        expression: `
          (() => {
            const button = document.querySelector('#share-list');
            if (!button) return { clicked: false };
            button.click();
            return { clicked: true };
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      if (!result.result.value.clicked) {
        throw new Error(`Could not open share studio for ${shot.name}`);
      }
      await wait(1000);
    }

    if (shot.state === "all-packs" || shot.state === "pack-detail") {
      const result = await page.send("Runtime.evaluate", {
        expression: `
          (() => {
            const button = document.querySelector('#pack-view-all');
            if (!button) return { clicked: false };
            button.click();
            return { clicked: true };
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      if (!result.result.value.clicked) {
        throw new Error(`Could not open all packs for ${shot.name}`);
      }
      await wait(800);
    }

    if (shot.state === "pack-detail") {
      const result = await page.send("Runtime.evaluate", {
        expression: `
          (() => {
            const card = document.querySelector('#pack-detail-list .pack-card');
            if (!card) return { clicked: false };
            card.click();
            return { clicked: true };
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      if (!result.result.value.clicked) {
        throw new Error(`Could not open a pack detail for ${shot.name}`);
      }
      await wait(800);
    }

    if (shot.state === "movie-detail") {
      const result = await page.send("Runtime.evaluate", {
        expression: `
          (() => {
            const button = document.querySelector('.queue-info');
            if (!button) return { clicked: false };
            button.click();
            return { clicked: true };
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
      });
      if (!result.result.value.clicked) {
        throw new Error(`Could not open movie details for ${shot.name}`);
      }
      await wait(1000);
    }

    const metrics = await page.send("Runtime.evaluate", {
      expression: `
        (() => ({
          bodyClass: document.body.className,
          title: document.title,
          url: location.href,
          viewport: { width: innerWidth, height: innerHeight },
          capabilities: {
            orientation: matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape',
            pointerCoarse: matchMedia('(pointer: coarse)').matches,
            pointerFine: matchMedia('(pointer: fine)').matches,
            anyPointerCoarse: matchMedia('(any-pointer: coarse)').matches,
            hoverHover: matchMedia('(hover: hover)').matches,
            hoverNone: matchMedia('(hover: none)').matches,
            maxTouchPoints: navigator.maxTouchPoints,
            devicePixelRatio
          },
          scroll: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight
          },
          hasComparison: !document.querySelector('#compare')?.classList.contains('panel--hidden'),
          hasShareStudio: !document.querySelector('#share-studio')?.hidden,
          hasPackBrowser: document.querySelector('#pack-detail')?.classList.contains('is-all-packs'),
          hasPackDetail: !document.querySelector('#pack-detail')?.hidden &&
            !document.querySelector('#pack-detail')?.classList.contains('is-all-packs'),
          hasMovieDetail: !document.querySelector('#movie-detail')?.hidden,
          visibleText: document.body.innerText.slice(0, 500)
        }))()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const observed = metrics.result.value;
    const expectedTouchCapabilities =
      observed.capabilities.pointerCoarse &&
      observed.capabilities.anyPointerCoarse &&
      observed.capabilities.hoverNone &&
      !observed.capabilities.hoverHover &&
      observed.capabilities.maxTouchPoints > 0;
    const expectedFineCapabilities =
      observed.capabilities.pointerFine &&
      observed.capabilities.hoverHover &&
      !observed.capabilities.pointerCoarse &&
      observed.capabilities.maxTouchPoints === 0;
    if (
      observed.viewport.width !== shot.width ||
      observed.viewport.height !== shot.height ||
      observed.capabilities.orientation !== shot.orientation ||
      (shot.touch ? !expectedTouchCapabilities : !expectedFineCapabilities)
    ) {
      throw new Error(
        `Device profile mismatch for ${shot.name}: ${JSON.stringify({
          expected: {
            viewport: { width: shot.width, height: shot.height },
            orientation: shot.orientation,
            input: shot.input,
          },
          observed: {
            viewport: observed.viewport,
            capabilities: observed.capabilities,
          },
        })}`,
      );
    }

    const screenshot = await page.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    const bytes = Buffer.from(screenshot.data, "base64");
    fs.writeFileSync(archivePath, bytes);
    fs.writeFileSync(latestPath, bytes);

    return {
      name: shot.name,
      archivePath,
      latestPath,
      state: shot.state,
      profile: shot.profileName,
      device: shot.device,
      orientation: shot.orientation,
      input: shot.input,
      viewport: `${shot.width}x${shot.height}`,
      deviceScaleFactor: shot.deviceScaleFactor,
      capabilities: observed.capabilities,
      shareOptionsVersion: shareOptions.version,
      bodyClass: observed.bodyClass,
      scroll: observed.scroll,
      hasComparison: observed.hasComparison,
      hasShareStudio: observed.hasShareStudio,
      hasPackBrowser: observed.hasPackBrowser,
      hasPackDetail: observed.hasPackDetail,
      hasMovieDetail: observed.hasMovieDetail,
    };
  } finally {
    await page.close();
  }
};

const main = async () => {
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}. Set CHROME_PATH to override.`);
  }
  if (!shots.length) {
    const names = allShots.map((shot) => shot.name).join(", ");
    throw new Error(`No screenshots matched --only. Available names: ${names}`);
  }

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(latestDir, { recursive: true });
  const server = await serveStatic();
  const captured = [];

  try {
    for (const shot of shots) {
      captured.push(await captureShot(server.url, shot));
    }
  } finally {
    await server.close();
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    label: runLabel || null,
    baseUrl: server.url,
    archiveDir,
    latestDir,
    screenshots: captured,
  };
  fs.writeFileSync(path.join(archiveDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(latestDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
