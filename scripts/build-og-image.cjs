#!/usr/bin/env node
// Renders the static social-share preview (Open Graph / Twitter card image) to
// assets/og-preview.png at exactly 1200x630 using headless Chrome. The image
// uses the monochrome StackRank visual system and shows the ranking concept
// (a numbered list) rather than copyrighted poster artwork. Re-run after
// changing the design below: `node scripts/build-og-image.cjs`.

const fs = require("fs");
const http = require("http");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const outPath = path.join(rootDir, "assets", "og-preview.png");

const WIDTH = 1200;
const HEIGHT = 630;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => {
  try {
    return fs.statSync(candidate).isFile();
  } catch (_error) {
    return false;
  }
});

if (!chromePath) {
  throw new Error("Chrome/Chromium not found. Set CHROME_PATH to build the OG image.");
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The preview markup. Mirrors the app's monochrome tokens and the primary
// ranking list so the card reads as "an ordered movie ranking" at a glance.
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg-ink: #111;
        --bg: #f2f2f2;
        --panel: #fff;
        --ink-soft: #6b6b6b;
        --border: #111;
        --border-soft: #e2e2e2;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
      body {
        font-family: "Space Grotesk", system-ui, sans-serif;
        color: var(--bg-ink);
        background:
          radial-gradient(circle at 18% 14%, #ffffff 0%, #f4f4f4 42%, #ededed 100%);
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        align-items: center;
        gap: 56px;
        padding: 72px 80px;
      }
      .lead { display: flex; flex-direction: column; gap: 22px; }
      .eyebrow {
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      .wordmark {
        font-size: 132px;
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 0.92;
      }
      .tagline {
        font-size: 42px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .desc {
        font-size: 25px;
        font-weight: 400;
        line-height: 1.45;
        color: var(--ink-soft);
        max-width: 30ch;
      }
      .panel {
        background: var(--panel);
        border-radius: 28px;
        box-shadow: 0 26px 60px rgba(17, 17, 17, 0.16);
        padding: 30px 30px 34px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .panel__title {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-soft);
        padding-left: 4px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 14px 16px;
        border: 2px solid var(--border);
        border-radius: 16px;
        background: #fff;
      }
      .row--ghost {
        border: 2px solid var(--border-soft);
        opacity: 0.7;
      }
      .rank {
        font-size: 30px;
        font-weight: 700;
        width: 40px;
        text-align: center;
        flex: none;
      }
      .bars { display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .bar {
        height: 16px;
        border-radius: 8px;
        background: var(--bg-ink);
      }
      .bar--sub {
        height: 11px;
        background: var(--border-soft);
        border-radius: 7px;
      }
      .row--ghost .bar { background: #c7c7c7; }
    </style>
  </head>
  <body>
    <div class="lead">
      <div class="eyebrow">Movie stack-ranking</div>
      <div class="wordmark">StackRank</div>
      <div class="tagline">Build your movie ranking</div>
      <div class="desc">
        Rank movies by choosing between them, one comparison at a time.
      </div>
    </div>
    <div class="panel">
      <div class="panel__title">Your ranking</div>
      ${[
        { rank: 1, w: 72 },
        { rank: 2, w: 58 },
        { rank: 3, w: 80 },
        { rank: 4, w: 46 },
      ]
        .map(
          (r) =>
            `<div class="row"><div class="rank">${r.rank}</div><div class="bars"><div class="bar" style="width:${r.w}%"></div><div class="bar--sub" style="width:${Math.max(
              28,
              r.w - 26,
            )}%"></div></div></div>`,
        )
        .join("")}
      <div class="row row--ghost"><div class="rank">5</div><div class="bars"><div class="bar" style="width:54%"></div></div></div>
    </div>
  </body>
</html>`;

const getCdpJson = (port, route) =>
  new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: route }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
  });

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

async function main() {
  // Serve the HTML over http so remote font loading behaves normally.
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  const serverPort = await getFreePort();
  await new Promise((resolve) => server.listen(serverPort, "127.0.0.1", resolve));

  const debugPort = await getFreePort();
  const profile = path.join("/private/tmp", "stackrank-og-profile");
  fs.rmSync(profile, { recursive: true, force: true });

  const proc = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  let pageTarget = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const tabs = await getCdpJson(debugPort, "/json/list");
      pageTarget = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (pageTarget) break;
    } catch (_error) {
      // keep polling
    }
    await wait(150);
  }
  if (!pageTarget) {
    proc.kill();
    throw new Error("Chrome CDP page target did not start");
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  let id = 0;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      const onMessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.id !== messageId) return;
        ws.removeEventListener("message", onMessage);
        if (payload.error) reject(new Error(`${method}: ${JSON.stringify(payload.error)}`));
        else resolve(payload.result);
      };
      ws.addEventListener("message", onMessage);
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/` });
  await wait(400);
  // Wait for the web font to finish loading so the wordmark renders in Space Grotesk.
  await send("Runtime.evaluate", {
    expression: "document.fonts.ready.then(() => true)",
    awaitPromise: true,
  });
  await wait(300);

  const result = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
    captureBeyondViewport: true,
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(result.data, "base64"));

  ws.close();
  proc.kill();
  await new Promise((resolve) => server.close(resolve));

  // Downsample the crisp 2x capture to exactly WIDTHxHEIGHT so the file matches
  // the og:image:width/height declared in index.html.
  downscaleToExact(outPath, WIDTH, HEIGHT);

  console.log(`Wrote ${path.relative(rootDir, outPath)} (${WIDTH}x${HEIGHT}).`);
}

function downscaleToExact(file, width, height) {
  const { spawnSync } = require("child_process");
  const sips = spawnSync("sips", ["-z", String(height), String(width), file], {
    stdio: "ignore",
  });
  if (sips.status === 0) return;
  const magick = spawnSync(
    "magick",
    [file, "-resize", `${width}x${height}!`, file],
    { stdio: "ignore" },
  );
  if (magick.status === 0) return;
  console.warn(
    `Could not downscale ${file} to ${width}x${height} (no sips/magick); left at 2x.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
