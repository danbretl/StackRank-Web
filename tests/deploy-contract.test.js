import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILD_MARKER,
  ContractError,
  buildDeployment,
  checkPublicPaths,
  extractCssReferences,
  extractHtmlReferences,
  extractJsReferences,
  findDestinationCollisions,
  globToRegExp,
  modelIgnoreOutput,
  normalizeRepoPath,
  planDeployment,
  resolveSiteReference,
  verifyOutput,
} from "../deploy/contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const portraitBytes = Buffer.from("RIFF fixture portrait one WEBP");

const baseFiles = () => ({
  "vercel.json": JSON.stringify({
    redirects: [{ source: "/", destination: "/app", permanent: false }],
    rewrites: [
      { source: "/app", destination: "/index.html" },
      { source: "/review", destination: "/review.html" },
      { source: "/s/:slug", destination: "/shared.html" },
    ],
  }),
  "index.html": [
    '<link rel="stylesheet" href="styles.css?v=2#top">',
    '<link rel="icon" href="./assets/icon.svg">',
    '<meta property="og:image" content="https://example.test/assets/og.png?v=1">',
    '<link rel="preconnect" href="https://fonts.example">',
    '<a href="/review">Review</a> <a href="mailto:x@example.test">Mail</a> <a href="#main">Skip</a>',
    '<script type="module" src="app.js?v=3"></script>',
  ].join("\n"),
  "styles.css": '@import "./theme.css?v=1";\nbody { background: url("img/bg.png?x=1#frag"); }\n',
  "theme.css": 'body { font: url("https://fonts.example/a.woff2"); }\n',
  "app.js": [
    'import { a } from "./lib/a.js?v=1#frag";',
    "const manifest = \"data/manifest.json?v=4\";",
    'const analytics = "/_platform/script.js";',
    'const download = "export.png";',
    "export { a, manifest, analytics, download };",
  ].join("\n"),
  "lib/a.js": 'import { b } from "../lib/b.js";\nexport const a = b;\n',
  "lib/b.js": "export const b = 1;\n",
  "assets/icon.svg": "<svg/>",
  "assets/og.png": "png",
  "img/bg.png": "png",
  "data/manifest.json": JSON.stringify({
    assets: [{ variants: [{ url: "assets/portraits/one.webp", bytes: portraitBytes.length, sha256: sha256(portraitBytes) }] }],
  }),
  "assets/portraits/one.webp": portraitBytes,
  "review.html": '<script type="module" src="/review.js?v=1"></script>\n<a href="/app">Back</a>\n',
  "review.js": [
    'const ROOT = ["/data/batch-root.json"];',
    "const SERIES = Array.from({ length: 2 }, (_, index) => `/data/batch-s${String(index + 1).padStart(2, \"0\")}.json`);",
    "export { ROOT, SERIES };",
  ].join("\n"),
  "data/batch-root.json": "{}",
  "data/batch-s01.json": "{}",
  "data/batch-s02.json": "{}",
  "shared.html": '<script type="module" src="/shared.js"></script>\n',
  "shared.js": "export const shared = true;\n",
  "notes/plan.md": "# plan\n",
  "data/authoring-ledger.json": "{}",
});

const baseDeclaration = () => ({
  schemaVersion: 1,
  siteOrigins: ["https://example.test"],
  entries: [
    { path: "index.html", product: "movies", reason: "app" },
    { path: "review.html", product: "dogs", reason: "review" },
    { path: "shared.html", product: "movies", reason: "viewer" },
  ],
  families: [
    {
      id: "portraits",
      type: "json-manifest",
      product: "dogs",
      manifest: "data/manifest.json",
      items: "assets[].variants[]",
      urlField: "url",
      bytesField: "bytes",
      sha256Field: "sha256",
      pathPattern: "^assets/portraits/[a-z0-9-]+\\.webp$",
      reason: "manifest portraits",
    },
    {
      id: "review-series",
      type: "sequence",
      product: "dogs",
      template: "data/batch-s{n}.json",
      start: 1,
      end: 2,
      pad: 2,
      acknowledges: { file: "review.js", literal: '/data/batch-s${String(index + 1).padStart(2, "0")}.json' },
      reason: "constructed batch URLs",
    },
  ],
  acknowledgedConstructions: [],
  nonFileLiterals: [{ file: "app.js", literal: "export.png", reason: "download filename" }],
  platformPaths: [{ path: "/_platform/script.js", reason: "platform analytics" }],
  opaqueModules: [],
  excluded: [
    { pattern: "deploy/**", class: "tooling", reason: "contract" },
    { pattern: "vercel.json", class: "hosting-config", reason: "routing" },
    { pattern: "notes/**", class: "documentation", reason: "notes" },
    { pattern: "data/authoring-*.json", class: "authoring", reason: "authoring records" },
  ],
});

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const writeFile = (root, file, content) => {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
};

const makeFixture = ({ files = baseFiles(), declaration = baseDeclaration(), track = true } = {}) => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "stackrank-contract-")));
  const root = path.join(parent, "site");
  fs.mkdirSync(root);
  for (const [file, content] of Object.entries(files)) writeFile(root, file, content);
  writeFile(root, "deploy/public-files.json", JSON.stringify(declaration, null, 2));
  if (track) {
    git(root, "-c", "init.defaultBranch=main", "init", "-q");
    git(root, "add", "-A");
  }
  return { parent, root, cleanup: () => fs.rmSync(parent, { recursive: true, force: true }) };
};

const treeDigest = (dir) => {
  const lines = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name === ".git") continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(dir, absolute);
      if (entry.isSymbolicLink()) lines.push(`${relative} -> ${fs.readlinkSync(absolute)}`);
      else if (entry.isDirectory()) walk(absolute);
      else lines.push(`${relative} ${sha256(fs.readFileSync(absolute))}`);
    }
  };
  walk(dir);
  return lines.join("\n");
};

const expectProblems = (fn, code, pattern) => {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ContractError, `expected ContractError, got ${caught}`);
  const matches = caught.problems.filter((entry) => entry.code === code && (!pattern || pattern.test(entry.message)));
  assert.ok(matches.length, `expected ${code} ${pattern || ""} in:\n${caught.message}`);
  return caught;
};

const updateDeclaration = (root, update) => {
  const file = path.join(root, "deploy/public-files.json");
  const declaration = JSON.parse(fs.readFileSync(file, "utf8"));
  update(declaration);
  fs.writeFileSync(file, JSON.stringify(declaration, null, 2));
};

test("resolves the declared closure with normalized query strings, fragments, relative paths and families", () => {
  const fixture = makeFixture();
  try {
    const plan = planDeployment({ root: fixture.root });
    assert.deepEqual(plan.inventory.map((entry) => entry.path), [
      "app.js",
      "assets/icon.svg",
      "assets/og.png",
      "assets/portraits/one.webp",
      "data/batch-root.json",
      "data/batch-s01.json",
      "data/batch-s02.json",
      "data/manifest.json",
      "img/bg.png",
      "index.html",
      "lib/a.js",
      "lib/b.js",
      "review.html",
      "review.js",
      "shared.html",
      "shared.js",
      "styles.css",
      "theme.css",
    ]);
    const byPath = new Map(plan.inventory.map((entry) => [entry.path, entry]));
    assert.equal(byPath.get("assets/portraits/one.webp").sha256, sha256(portraitBytes));
    assert.equal(byPath.get("assets/portraits/one.webp").reason, "family:portraits");
    assert.deepEqual(byPath.get("lib/b.js").chain, ["index.html", "app.js", "lib/a.js", "lib/b.js"]);
    assert.deepEqual(byPath.get("data/batch-s02.json").products, ["dogs"]);
    assert.deepEqual(byPath.get("lib/a.js").products, ["movies"], "links between documents do not leak products");
    assert.deepEqual(plan.closure.externals.map((entry) => entry.url), ["https://fonts.example/", "https://fonts.example/a.woff2"]);
    assert.deepEqual(plan.closure.platformUses.map((entry) => entry.pathname), ["/_platform/script.js"]);
    assert.deepEqual(plan.classification.excluded.map((entry) => entry.path), [
      "data/authoring-ledger.json",
      "deploy/public-files.json",
      "notes/plan.md",
      "vercel.json",
    ]);
    assert.deepEqual(plan.classification.unclassified, []);
  } finally {
    fixture.cleanup();
  }
});

test("a missing manifest-referenced portrait fails with the family, manifest and path", () => {
  const fixture = makeFixture();
  try {
    fs.rmSync(path.join(fixture.root, "assets/portraits/one.webp"));
    expectProblems(() => planDeployment({ root: fixture.root }), "missing-reference", /family portraits references .*assets\/portraits\/one\.webp/);
  } finally {
    fixture.cleanup();
  }
});

test("a missing dynamically constructed review batch fails with its family", () => {
  const fixture = makeFixture();
  try {
    fs.rmSync(path.join(fixture.root, "data/batch-s02.json"));
    expectProblems(() => planDeployment({ root: fixture.root }), "missing-reference", /family review-series references .*data\/batch-s02\.json/);
  } finally {
    fixture.cleanup();
  }
});

test("manifest integrity mismatches and traversal URLs are rejected", () => {
  const files = baseFiles();
  const manifest = JSON.parse(files["data/manifest.json"]);
  manifest.assets[0].variants[0].bytes += 1;
  manifest.assets.push({ variants: [{ url: "assets/portraits/../../../outside.webp" }] });
  files["data/manifest.json"] = JSON.stringify(manifest);
  const fixture = makeFixture({ files });
  try {
    const error = expectProblems(() => planDeployment({ root: fixture.root }), "family-integrity", /declares 31/);
    assert.ok(error.problems.some((entry) => entry.code === "traversal" && /outside\.webp/.test(entry.message)));
  } finally {
    fixture.cleanup();
  }
});

test("a forbidden authoring file forced into the public set is rejected", () => {
  const files = baseFiles();
  files["app.js"] += '\nexport const ledger = "data/authoring-ledger.json";\n';
  const fixture = makeFixture({ files });
  try {
    expectProblems(
      () => planDeployment({ root: fixture.root }),
      "forbidden-public-file",
      /data\/authoring-ledger\.json is excluded by "data\/authoring-\*\.json" \(authoring: authoring records\).*index\.html → app\.js → data\/authoring-ledger\.json/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("a newly tracked unclassified path fails until it is deliberately classified", () => {
  const fixture = makeFixture();
  try {
    writeFile(fixture.root, "misc/todo.txt", "later");
    planDeployment({ root: fixture.root });
    git(fixture.root, "add", "misc/todo.txt");
    expectProblems(() => planDeployment({ root: fixture.root }), "unclassified-path", /misc\/todo\.txt is tracked .*add an exclusion rule/);
    updateDeclaration(fixture.root, (declaration) => {
      declaration.excluded.push({ pattern: "misc/**", class: "documentation", reason: "scratch notes" });
    });
    const plan = planDeployment({ root: fixture.root });
    assert.ok(plan.classification.excluded.some((entry) => entry.path === "misc/todo.txt" && entry.class === "documentation"));
  } finally {
    fixture.cleanup();
  }
});

test("a newly referenced asset is included through the manifest family only once tracked", () => {
  const fixture = makeFixture();
  try {
    const twoBytes = Buffer.from("RIFF fixture portrait two WEBP");
    writeFile(fixture.root, "assets/portraits/two.webp", twoBytes);
    const manifestPath = path.join(fixture.root, "data/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.assets.push({ variants: [{ url: "assets/portraits/two.webp", bytes: twoBytes.length, sha256: sha256(twoBytes) }] });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    expectProblems(() => planDeployment({ root: fixture.root }), "untracked-reference", /assets\/portraits\/two\.webp, which exists but is not tracked/);
    git(fixture.root, "add", "assets/portraits/two.webp");
    const entry = planDeployment({ root: fixture.root }).inventory.find((item) => item.path === "assets/portraits/two.webp");
    assert.deepEqual(
      { bytes: entry.bytes, sha256: entry.sha256, reason: entry.reason, products: entry.products },
      { bytes: twoBytes.length, sha256: sha256(twoBytes), reason: "family:portraits", products: ["dogs", "movies"] },
    );
  } finally {
    fixture.cleanup();
  }
});

test("an explicit sequence family includes exactly its declared members", () => {
  const fixture = makeFixture();
  try {
    writeFile(fixture.root, "data/batch-s03.json", "{}");
    git(fixture.root, "add", "data/batch-s03.json");
    const error = expectProblems(() => planDeployment({ root: fixture.root }), "unclassified-path", /data\/batch-s03\.json/);
    assert.equal(error.problems.length, 1);
    updateDeclaration(fixture.root, (declaration) => {
      declaration.families[1].end = 3;
    });
    const plan = planDeployment({ root: fixture.root });
    assert.deepEqual(plan.closure.families.find((family) => family.id === "review-series").files, [
      "data/batch-s01.json",
      "data/batch-s02.json",
      "data/batch-s03.json",
    ]);
  } finally {
    fixture.cleanup();
  }
});

test("undeclared dynamic paths, stale declarations and undeclared documents fail", () => {
  const files = baseFiles();
  files["shared.js"] += "export const url = (id) => `/data/item-${id}.json`;\n";
  files["index.html"] += '\n<a href="/other.html">Other</a>\n';
  files["other.html"] = "<p>other</p>";
  const fixture = makeFixture({ files });
  try {
    updateDeclaration(fixture.root, (declaration) => {
      declaration.excluded.push({ pattern: "nothing/**", class: "tooling", reason: "matches nothing" });
      declaration.platformPaths.push({ path: "/_unused.js", reason: "unused" });
    });
    const error = expectProblems(() => planDeployment({ root: fixture.root }), "undeclared-dynamic-path", /shared\.js:2 builds a local path .*\/data\/item-\$\{id\}\.json/);
    assert.ok(error.problems.some((entry) => entry.code === "undeclared-document" && /other\.html is linked from index\.html/.test(entry.message)));
    assert.ok(error.problems.some((entry) => entry.code === "stale-declaration" && /nothing\/\*\*/.test(entry.message)));
    assert.ok(error.problems.some((entry) => entry.code === "stale-declaration" && /_unused\.js/.test(entry.message)));
  } finally {
    fixture.cleanup();
  }
});

test("document-relative literals must resolve the same from every route that serves the document", () => {
  const files = baseFiles();
  files["shared.js"] = 'export const data = "data/batch-root.json";\n';
  const fixture = makeFixture({ files });
  try {
    expectProblems(() => planDeployment({ root: fixture.root }), "inconsistent-resolution", /shared\.js:1 reference "data\/batch-root\.json" resolves differently from \/s\/contract-sample, \/shared\.html/);
  } finally {
    fixture.cleanup();
  }
});

test("tracked symbolic links and links escaping the repository are rejected", () => {
  const fixture = makeFixture();
  try {
    fs.mkdirSync(path.join(fixture.parent, "outside"));
    fs.writeFileSync(path.join(fixture.parent, "outside/one.webp"), portraitBytes);
    fs.rmSync(path.join(fixture.root, "assets/portraits"), { recursive: true });
    fs.symlinkSync(path.join(fixture.parent, "outside"), path.join(fixture.root, "assets/portraits"));
    expectProblems(() => planDeployment({ root: fixture.root }), "escaping-symlink", /assets\/portraits\/one\.webp .*outside the repository/);
    expectProblems(() => planDeployment({ root: fixture.root, inputMode: "filesystem" }), "escaping-symlink", /assets\/portraits\/one\.webp/);
  } finally {
    fixture.cleanup();
  }
  const linked = makeFixture();
  try {
    fs.rmSync(path.join(linked.root, "lib/b.js"));
    fs.symlinkSync("a.js", path.join(linked.root, "lib/b.js"));
    git(linked.root, "add", "lib/b.js");
    expectProblems(() => planDeployment({ root: linked.root }), "symlink", /lib\/b\.js .*symbolic link/);
  } finally {
    linked.cleanup();
  }
});

test("duplicate and non-portable destinations are rejected", () => {
  assert.deepEqual(findDestinationCollisions(["assets/Logo.png", "assets/logo.png", "lib/a.js"]), [["assets/Logo.png", "assets/logo.png"]]);
  assert.deepEqual(findDestinationCollisions(["café.css", "café.css"]).length, 1);
  assert.deepEqual(checkPublicPaths(["assets/bad name.png", "ok/file.js"]).map((entry) => entry.code), ["non-portable-path"]);
  const fixture = makeFixture();
  try {
    updateDeclaration(fixture.root, (declaration) => {
      declaration.entries.push({ path: "index.html", product: "movies", reason: "duplicate" });
    });
    expectProblems(() => planDeployment({ root: fixture.root }), "duplicate-destination", /index\.html is declared more than once/);
    updateDeclaration(fixture.root, (declaration) => {
      declaration.entries.pop();
      declaration.entries.push({ path: "../escape.html", product: "movies", reason: "traversal" });
    });
    expectProblems(() => planDeployment({ root: fixture.root }), "traversal", /\.\.\/escape\.html/);
  } finally {
    fixture.cleanup();
  }
});

test("unsafe build directories fail before any destructive write", () => {
  const fixture = makeFixture();
  try {
    fs.mkdirSync(path.join(fixture.parent, "keep"));
    fs.writeFileSync(path.join(fixture.parent, "keep/precious.txt"), "do not delete");
    fs.symlinkSync(path.join(fixture.parent, "keep"), path.join(fixture.parent, "linked-out"));
    const before = treeDigest(fixture.parent);
    const cases = [
      [fixture.root, /source root or one of its ancestors/],
      [fixture.parent, /source root or one of its ancestors/],
      [path.join(fixture.root, "lib"), /contains tracked source/],
      [path.join(fixture.root, "assets/out"), /overlaps a public source directory/],
      [path.join(fixture.parent, "keep"), /not empty and was not created by the deployment builder/],
      [path.join(fixture.parent, "linked-out"), /symbolic link/],
    ];
    for (const [buildDir, pattern] of cases) {
      expectProblems(() => buildDeployment({ root: fixture.root, buildDir }), "unsafe-output", pattern);
    }
    assert.equal(treeDigest(fixture.parent), before, "failed builds leave the source and neighboring directories untouched");
  } finally {
    fixture.cleanup();
  }
});

test("clean builds are deterministic, verified and preserve the source tree", () => {
  const fixture = makeFixture();
  try {
    const before = treeDigest(fixture.root);
    const first = buildDeployment({ root: fixture.root, buildDir: path.join(fixture.parent, "out-a") });
    const second = buildDeployment({ root: fixture.root, buildDir: path.join(fixture.parent, "out-b") });
    assert.equal(treeDigest(fixture.root), before);
    assert.equal(treeDigest(first.publicDir), treeDigest(second.publicDir));
    for (const name of fs.readdirSync(first.reportDir)) {
      assert.equal(fs.readFileSync(path.join(first.reportDir, name), "utf8"), fs.readFileSync(path.join(second.reportDir, name), "utf8"), name);
    }
    assert.ok(fs.existsSync(path.join(first.buildDir, BUILD_MARKER)));
    assert.equal(fs.existsSync(path.join(first.publicDir, BUILD_MARKER)), false, "the ownership marker is not published");
    assert.equal(fs.existsSync(path.join(first.publicDir, "notes")), false);
    // Rebuilding into an owned directory replaces it.
    fs.writeFileSync(path.join(first.publicDir, "stale.txt"), "old");
    buildDeployment({ root: fixture.root, buildDir: first.buildDir });
    assert.equal(fs.existsSync(path.join(first.publicDir, "stale.txt")), false);
    // A failed plan leaves the previous build and the source untouched.
    fs.rmSync(path.join(fixture.root, "data/batch-s01.json"));
    const sourceAfterDelete = treeDigest(fixture.root);
    const builtBefore = treeDigest(first.buildDir);
    expectProblems(() => buildDeployment({ root: fixture.root, buildDir: first.buildDir }), "missing-reference");
    assert.equal(treeDigest(first.buildDir), builtBefore);
    assert.equal(treeDigest(fixture.root), sourceAfterDelete);
  } finally {
    fixture.cleanup();
  }
});

test("staged-output verification fails when a required asset is omitted, altered or extra", () => {
  const fixture = makeFixture();
  try {
    const { publicDir, plan } = buildDeployment({ root: fixture.root, buildDir: path.join(fixture.parent, "out") });
    assert.deepEqual(verifyOutput(publicDir, plan.inventory), []);
    fs.rmSync(path.join(publicDir, "assets/portraits/one.webp"));
    fs.rmSync(path.join(publicDir, "data/batch-s02.json"));
    fs.appendFileSync(path.join(publicDir, "app.js"), "\n// tampered\n");
    fs.writeFileSync(path.join(publicDir, "extra.txt"), "x");
    const messages = verifyOutput(publicDir, plan.inventory).map((entry) => entry.message).sort();
    assert.deepEqual(messages, [
      "Staged app.js differs from its inventory bytes/SHA-256",
      "Staged output contains undeclared file extra.txt",
      "Staged output is missing required assets/portraits/one.webp",
      "Staged output is missing required data/batch-s02.json",
    ]);
  } finally {
    fixture.cleanup();
  }
});

test("missing Git fails by default; explicit local filesystem mode cannot classify", () => {
  const fixture = makeFixture({ track: false });
  try {
    expectProblems(() => planDeployment({ root: fixture.root }), "unsafe-input", /must be the Git top level/);
    const plan = planDeployment({ root: fixture.root, inputMode: "filesystem" });
    assert.equal(plan.inputs.mode, "filesystem");
    assert.equal(plan.classification.status, "not-run");
    assert.ok(plan.inventory.some((entry) => entry.path === "assets/portraits/one.webp"));
  } finally {
    fixture.cleanup();
  }
});

test("build CLI fails closed without usable Git before replacing output", () => {
  for (const scenario of ["no metadata", "git unavailable"]) {
    const fixture = makeFixture({ track: scenario !== "no metadata" });
    try {
      for (const file of ["deploy/build.mjs", "deploy/contract.mjs"]) {
        writeFile(fixture.root, file, fs.readFileSync(path.join(repoRoot, file)));
      }
      const output = path.join(fixture.parent, "output");
      writeFile(output, BUILD_MARKER, "owned output");
      writeFile(output, "sentinel.txt", "preserve on failed build");
      const before = treeDigest(fixture.parent);
      const result = spawnSync(process.execPath, [path.join(fixture.root, "deploy/build.mjs"), "--build-dir", output], {
        encoding: "utf8",
        env: { ...process.env, VERCEL: "1", ...(scenario === "git unavailable" ? { PATH: path.join(fixture.parent, "missing-bin") } : {}) },
      });
      assert.notEqual(result.status, 0, scenario);
      assert.match(result.stderr, /must be the Git top level/, scenario);
      assert.equal(treeDigest(fixture.parent), before, "failed Git validation must not alter source or previous output");
    } finally {
      fixture.cleanup();
    }
  }
});

test("Vercel rejects fallback overrides; local filesystem mode remains explicit", () => {
  const fixture = makeFixture({ track: false });
  try {
    for (const file of ["deploy/build.mjs", "deploy/contract.mjs"]) {
      writeFile(fixture.root, file, fs.readFileSync(path.join(repoRoot, file)));
    }
    const output = path.join(fixture.parent, "output");
    for (const inputs of ["auto", "filesystem"]) {
      for (const host of [{ VERCEL: "1", VERCEL_ENV: "preview" }, { VERCEL: "", VERCEL_ENV: "production" }]) {
        const result = spawnSync(process.execPath, [path.join(fixture.root, "deploy/build.mjs"), "--build-dir", output, "--inputs", inputs], {
          encoding: "utf8", env: { ...process.env, ...host },
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Vercel builds require --inputs git/);
        assert.equal(fs.existsSync(output), false);
      }
    }
    const local = spawnSync(process.execPath, [path.join(fixture.root, "deploy/build.mjs"), "--build-dir", output, "--inputs", "filesystem"], {
      encoding: "utf8", env: { ...process.env, VERCEL: "", VERCEL_ENV: "" },
    });
    assert.equal(local.status, 0, local.stderr);
    assert.match(local.stdout, /classification not-run/);
  } finally {
    fixture.cleanup();
  }
});

test("JS discovery documents its supported templates and computed-path blind spots", () => {
  for (const literal of ["/data/${id}.json", "./assets/${name}.webp", "${base}${name}.json"]) {
    assert.ok(extractJsReferences("fetch(`" + literal + "`)").constructions.some((entry) => entry.literal === literal));
  }
  // These expressions are deliberately not claimed to be covered by the regex scanner.
  for (const source of ['fetch(`${base}/${name}`)', 'fetch(`/data/\n${id}.json`)', 'fetch(base + name)', 'fetch("settings")']) {
    const extracted = extractJsReferences(source);
    assert.deepEqual(extracted.refs, [], source);
    assert.deepEqual(extracted.constructions, [], source);
    assert.deepEqual(extracted.problems, [], source);
  }
});

test("an explicit manifest family protects a dependency whose consumer uses variables", () => {
  const files = baseFiles();
  files["app.js"] += '\nconst image = `${base}/${name}`;\n';
  const fixture = makeFixture({ files });
  try {
    const portrait = "assets/portraits/one.webp";
    const plan = planDeployment({ root: fixture.root });
    assert.ok(plan.inventory.some((entry) => entry.path === portrait));
    fs.rmSync(path.join(fixture.root, portrait));
    expectProblems(() => planDeployment({ root: fixture.root }), "missing-reference", /family portraits/);
  } finally {
    fixture.cleanup();
  }
});

test("reference extraction and resolution helpers normalize consistently", () => {
  assert.equal(normalizeRepoPath("./a/b.js"), "a/b.js");
  assert.equal(normalizeRepoPath("a/../../b.js"), null);
  assert.equal(normalizeRepoPath("/etc/passwd"), null);
  assert.equal(normalizeRepoPath("a\\b.js"), null);
  assert.ok(globToRegExp("data/dogs/portrait-cohort-*.json").test("data/dogs/portrait-cohort-m.json"));
  assert.equal(globToRegExp("data/dogs/*.json").test("data/dogs/sources/x.json"), false);
  assert.ok(globToRegExp("notes/**").test("notes/a/b.md"));

  const js = extractJsReferences([
    'import { a } from "./lib/a.js?v=2";',
    "import {",
    "  b,",
    '} from "../b.js";',
    'import "./side.js";',
    'const lazy = import("/lazy.js");',
    'const data = fetch("data/x.json?v=1#frag");',
    'import bad from "pkg";',
    "const url = `/data/${id}.json`;",
  ].join("\n"));
  assert.deepEqual(js.refs.map((ref) => [ref.kind, ref.specifier]), [
    ["js-import", "./lib/a.js?v=2"],
    ["js-import", "../b.js"],
    ["js-import", "./side.js"],
    ["js-import", "/lazy.js"],
    ["js-literal", "data/x.json?v=1#frag"],
  ]);
  assert.deepEqual(js.problems.map((entry) => entry.code), ["bare-specifier"]);
  assert.deepEqual(js.constructions.map((entry) => entry.literal), ["/data/${id}.json"]);

  assert.deepEqual(extractCssReferences('@import url("a.css"); x { background: url(img/b.png#x) }').map((ref) => ref.specifier), ["a.css", "img/b.png#x"]);
  assert.deepEqual(
    extractHtmlReferences('<img srcset="a.png 1x, b.png 2x"><meta content="width=device-width"><meta content="/og.png">').map((ref) => ref.specifier),
    ["a.png", "b.png", "/og.png"],
  );

  const routing = { rewrites: [{ source: "/dogs/artwork-review", destination: "/dogs-artwork-review.html" }, { source: "/s/:slug", destination: "/shared.html" }], redirects: [{ source: "/", destination: "/movies" }] };
  const options = { siteOrigins: ["https://www.stackrankapp.com"], routing, platformPaths: new Set() };
  assert.deepEqual(resolveSiteReference("../x.js?v=1#y", "/lib/sub/a.js", options), { type: "file", file: "lib/x.js", route: null, via: "path" });
  assert.equal(resolveSiteReference("data/x.json", "/dogs/artwork-review", options).file, "dogs/data/x.json");
  assert.equal(resolveSiteReference("/s/abc123", "/index.html", options).file, "shared.html");
  assert.equal(resolveSiteReference("https://www.stackrankapp.com/assets/og.png?v=1", "/index.html", options).file, "assets/og.png");
  assert.equal(resolveSiteReference("https://cdn.example/x.js", "/index.html", options).type, "external");
  assert.equal(resolveSiteReference("../../../etc/passwd", "/index.html", options).file, "etc/passwd", "URL resolution clamps traversal at the site root");
  assert.equal(resolveSiteReference("%2e%2e/%2e%2e/secret.json", "/a/b.html", options).file, "secret.json");
  assert.equal(resolveSiteReference("mailto:x@example.test", "/index.html", options).type, "ignored");
});

// ---------------------------------------------------------------------------
// The real repository contract.

const realPlan = planDeployment({ root: repoRoot });
const realPaths = new Set(realPlan.inventory.map((entry) => entry.path));
const readRepoJson = (file) => JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));

test("the repository contract classifies every tracked path with no unclassified files", () => {
  assert.equal(realPlan.inputs.mode, "git");
  assert.equal(realPlan.classification.status, "complete");
  assert.deepEqual(realPlan.classification.unclassified, []);
  const tracked = git(repoRoot, "ls-files", "-z").split("\0").filter(Boolean);
  assert.equal(realPlan.classification.included.length + realPlan.classification.excluded.length, tracked.length);
});

test("the repository contract publishes every Dogs portrait, batch and runtime document", () => {
  const artwork = readRepoJson("data/dogs/generated-artwork.json");
  const variants = artwork.assets.flatMap((asset) => asset.variants);
  assert.ok(variants.length >= 1604);
  for (const variant of variants) assert.ok(realPaths.has(variant.url), `${variant.url} must be public`);
  const batches = git(repoRoot, "ls-files", "data/dogs/generated-artwork-batch-*.json").split("\n").filter(Boolean);
  assert.ok(batches.length >= 178);
  for (const batch of batches) assert.ok(realPaths.has(batch), `${batch} must be public for /dogs/artwork-review`);
  for (const file of [
    "dogs.html",
    "dogs.js",
    "dogs.css",
    "dogs-explore.js",
    "dogs-explore.css",
    "dogs-comparison.css",
    "dogs-shared.html",
    "dogs-shared.js",
    "dogs-shared.css",
    "dogs-artwork-review.html",
    "dogs-artwork-review.js",
    "dogs-artwork-review.css",
    "lib/dogs-artwork-review.js",
    "lib/dogs-public-visibility.js",
    "data/dogs/dog-catalog.json",
    "data/dogs/breed-profiles.json",
    "data/dogs/packs.json",
    "data/dogs/image-rights.json",
    "data/dogs/artwork-license-policy.json",
    "data/dogs/generated-artwork.json",
  ]) {
    assert.ok(realPaths.has(file), `${file} must be public`);
  }
});

test("the repository contract publishes the Movies, shared, Books and site runtime", () => {
  for (const file of [
    "index.html",
    "app.js",
    "styles.css",
    "shared.html",
    "shared.js",
    "category-switcher.js",
    "category-switcher.css",
    "data/suggestion-packs.json",
    "books.html",
    "books.js",
    "books.css",
    "home.html",
    "home.js",
    "home.css",
    "privacy.html",
    "robots.txt",
    "sitemap.xml",
    "assets/favicon.ico",
    "assets/favicon.svg",
    "assets/apple-touch-icon.png",
    "assets/og-preview.png",
    "assets/tmdb-logo.svg",
    "vendor/supabase-js-2.108.2.js",
  ]) {
    assert.ok(realPaths.has(file), `${file} must be public`);
  }
  const appImports = [...fs.readFileSync(path.join(repoRoot, "app.js"), "utf8").matchAll(/from\s+"\.\/(lib\/[^"?]+)/g)].map((match) => match[1]);
  assert.ok(appImports.length > 20);
  for (const file of appImports) assert.ok(realPaths.has(file), `${file} is imported by app.js`);
});

test("the repository contract keeps authoring, tooling and assistant files out of public output", () => {
  for (const file of [
    "AGENTS.md",
    "CLAUDE.md",
    "package.json",
    "vercel.json",
    ".vercelignore",
    "deploy/public-files.json",
    "deploy/contract.mjs",
    "data/asset-versions.json",
    "data/suggestion-packs.source.json",
    "data/dogs/portrait-cohort-m.json",
    "data/dogs/profile-refresh-m01.json",
    "data/dogs/regeneration-manifest-m01.json",
    "data/dogs/generated-artwork-policy.json",
    "data/dogs/classification.json",
    "lib/dog-profile-copy.js",
    "notes/testing/deployment-file-contract.md",
    "tests/deploy-contract.test.js",
    "scripts/run-e2e-smoke.cjs",
    "supabase/config.toml",
  ]) {
    assert.equal(realPaths.has(file), false, `${file} must not be public`);
  }
  for (const prefix of ["notes/", "tests/", "scripts/", "supabase/", "deploy/", "data/dogs/sources/", "design-review-site/"]) {
    assert.equal([...realPaths].some((file) => file.startsWith(prefix)), false, `${prefix} must not be public`);
  }
});

test("Vercel builds the staged contract output and .vercelignore keeps the builder and public inputs", () => {
  const vercel = readRepoJson("vercel.json");
  assert.equal(vercel.buildCommand, "node deploy/build.mjs --build-dir dist --inputs git");
  assert.equal(vercel.outputDirectory, "dist/public");
  assert.equal(vercel.installCommand, "");
  const buildSource = new Set(modelIgnoreOutput(repoRoot, ".vercelignore").map((entry) => entry.path));
  for (const file of ["deploy/build.mjs", "deploy/contract.mjs", "deploy/public-files.json"]) {
    assert.ok(buildSource.has(file), `${file} must reach the Vercel build`);
  }
  for (const file of realPaths) assert.ok(buildSource.has(file), `${file} must not be removed by .vercelignore`);
  const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
  assert.match(gitignore, /^dist\/$/m);
});
