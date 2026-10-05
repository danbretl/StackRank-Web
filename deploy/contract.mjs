// StackRank deployment-file contract.
//
// The public deployment is the dependency closure of a small declaration
// (deploy/public-files.json): declared entry documents, the static references
// they make (HTML attributes, native module imports, CSS url()/@import and
// path-like JS string literals), and explicitly declared dynamic families
// (manifest-driven portraits, the constructed artwork-review batch series).
// Every tracked path must end up included or excluded by a reasoned rule.
//
// Reference discovery is deliberately regex based, not a JavaScript parser.
// Template literals that build local paths must be acknowledged in the
// declaration, so unknown dynamic construction fails instead of being missed.

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CONTRACT_SCHEMA_VERSION = 1;
export const DEFAULT_DECLARATION = "deploy/public-files.json";
export const DEFAULT_ROUTING = "vercel.json";
export const BUILD_MARKER = ".stackrank-deploy-output";
export const PUBLIC_DIR_NAME = "public";
export const REPORT_DIR_NAME = "contract";

const ASSET_EXTENSIONS =
  "css|js|mjs|json|html|png|svg|ico|webp|avif|jpe?g|gif|webmanifest|woff2?|txt|xml|zip|pdf";
const LITERAL_PATTERN = new RegExp(
  String.raw`(["'\x60])((?:https?:)?//[^"'\x60\s]+|[A-Za-z0-9_.@~+/-]*\.(?:${ASSET_EXTENSIONS})(?:[?#][^"'\x60\s]*)?)\1`,
  "g",
);
const STATIC_IMPORT_PATTERN =
  /(?:^|[\n;])[ \t]*(?:import|export)\s[^;'"`]*?\bfrom\s*(["'])([^"'\n]+)\1/g;
const SIDE_EFFECT_IMPORT_PATTERN = /(?:^|[\n;])[ \t]*import\s*(["'])([^"'\n]+)\1/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g;
const NON_LITERAL_IMPORT_PATTERN = /\bimport\s*\(\s*(?!["'\s])/g;
const TEMPLATE_PATTERN = /`([^`\n]*\$\{[^`\n]*)`/g;
const HTML_ATTRIBUTE_PATTERN =
  /\b(src|href|srcset|poster|content|action|data)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const CSS_URL_PATTERN = /url\(\s*(["']?)([^"')]+?)\1\s*\)/g;
const CSS_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?(["'])([^"']+)\1/g;
const SITEMAP_LOC_PATTERN = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
const ROBOTS_SITEMAP_PATTERN = /^\s*Sitemap:\s*(\S+)\s*$/gim;
const PORTABLE_PATH = /^[A-Za-z0-9._@+-]+(?:\/[A-Za-z0-9._@+-]+)*$/;
const NON_FETCH_SCHEME = /^(?:mailto|tel|sms|javascript|data|blob|about):/i;
const RESOLUTION_HOST = "https://contract.invalid";

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUnique = (values) => [...new Set(values)].sort(compare);
const toPosix = (value) => value.split(path.sep).join("/");
export const sha256Hex = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export class ContractError extends Error {
  constructor(problems) {
    const list = [...problems].sort((a, b) => compare(a.code, b.code) || compare(a.path || "", b.path || ""));
    super(
      `Deployment contract failed with ${list.length} problem${list.length === 1 ? "" : "s"}:\n` +
        list.map((problem) => `- [${problem.code}] ${problem.message}`).join("\n"),
    );
    this.name = "ContractError";
    this.problems = list;
  }
}

const problem = (code, message, extra = {}) => ({ code, message, ...extra });

const lineAt = (text, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
};

// ---------------------------------------------------------------------------
// Path helpers

/** Normalize a repository-relative POSIX path, or return null when unsafe. */
export const normalizeRepoPath = (value) => {
  if (typeof value !== "string" || !value || value.includes("\0") || value.includes("\\")) return null;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return null;
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  if (normalized !== value.replace(/^\.\//, "")) return null;
  return normalized;
};

/** Minimal glob: `**` spans directories, `*` stays within one segment. */
export const globToRegExp = (pattern) => {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      const slash = pattern[i + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
};

/** Paths that would land on the same destination on case-insensitive or Unicode-normalizing file systems. */
export const findDestinationCollisions = (paths) => {
  const seen = new Map();
  const collisions = [];
  for (const value of [...paths].sort(compare)) {
    const key = value.normalize("NFC").toLowerCase();
    if (seen.has(key)) collisions.push([seen.get(key), value]);
    else seen.set(key, value);
  }
  return collisions;
};

const isInside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

// ---------------------------------------------------------------------------
// Declaration and routing

export const loadDeclaration = (root, declarationPath = DEFAULT_DECLARATION) => {
  const declaration = JSON.parse(fs.readFileSync(path.join(root, declarationPath), "utf8"));
  const problems = [];
  if (declaration.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    problems.push(problem("declaration", `${declarationPath} schemaVersion must be ${CONTRACT_SCHEMA_VERSION}`));
  }
  for (const key of ["entries", "families", "acknowledgedConstructions", "nonFileLiterals", "platformPaths", "opaqueModules", "excluded"]) {
    if (!Array.isArray(declaration[key])) problems.push(problem("declaration", `${declarationPath} must declare an array "${key}"`));
  }
  if (!Array.isArray(declaration.siteOrigins) || !declaration.siteOrigins.length) {
    problems.push(problem("declaration", `${declarationPath} must declare siteOrigins`));
  }
  const entryPaths = new Set();
  for (const entry of declaration.entries || []) {
    if (!normalizeRepoPath(entry.path)) problems.push(problem("traversal", `Entry path ${JSON.stringify(entry.path)} is not a safe repository-relative path`, { path: entry.path }));
    if (entryPaths.has(entry.path)) problems.push(problem("duplicate-destination", `Entry ${entry.path} is declared more than once`, { path: entry.path }));
    entryPaths.add(entry.path);
    if (!entry.reason || !entry.product) problems.push(problem("declaration", `Entry ${entry.path} needs a product and reason`, { path: entry.path }));
  }
  for (const rule of declaration.excluded || []) {
    if (!rule.pattern || !rule.reason || !rule.class) problems.push(problem("declaration", `Exclusion rule ${JSON.stringify(rule)} needs pattern, class and reason`));
  }
  if (problems.length) throw new ContractError(problems);
  return declaration;
};

const routeSegmentsMatch = (pattern, pathname) => {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) =>
    part.startsWith(":") ? /^[^/]+$/.test(pathParts[index]) : part === pathParts[index]);
};

export const loadRouting = (root, routingPath = DEFAULT_ROUTING) => {
  const config = JSON.parse(fs.readFileSync(path.join(root, routingPath), "utf8"));
  const problems = [];
  const supported = (source) => /^\/[A-Za-z0-9._~/:-]*$/.test(source) && !/:[A-Za-z]+[*+?(]/.test(source);
  const rewrites = (config.rewrites || []).map(({ source, destination }) => ({ source, destination }));
  const redirects = (config.redirects || []).map(({ source, destination }) => ({ source, destination }));
  for (const route of [...rewrites, ...redirects]) {
    if (!supported(route.source) || !route.destination?.startsWith("/")) {
      problems.push(problem("routing", `${routingPath} route ${JSON.stringify(route)} uses syntax the contract resolver does not model`));
    }
  }
  if (problems.length) throw new ContractError(problems);
  return { rewrites, redirects, file: routingPath };
};

/** URL paths at which an HTML document is served: its own file path plus rewrite sources. */
export const servingPathsFor = (file, routing) => {
  const paths = new Set([`/${file}`]);
  for (const rewrite of routing.rewrites) {
    if (rewrite.destination === `/${file}`) paths.add(rewrite.source.replace(/:[A-Za-z]+/g, "contract-sample"));
  }
  return [...paths].sort(compare);
};

// ---------------------------------------------------------------------------
// Input discovery

/**
 * Lists deployment input candidates. In git mode the candidates are the index
 * (tracked files plus anything explicitly `git add`-ed), never untracked or
 * ignored files. Filesystem mode exists for hosted builds without Git metadata;
 * it cannot classify the tree and only answers existence questions.
 */
const gitTopLevel = (root) => {
  try {
    return fs.realpathSync(execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch {
    return null;
  }
};

export const listInputs = (root, { mode = "auto" } = {}) => {
  let resolvedMode = mode;
  let reason = `requested ${mode}`;
  if (mode === "auto") {
    const topLevel = fs.existsSync(path.join(root, ".git")) ? gitTopLevel(root) : null;
    resolvedMode = topLevel === fs.realpathSync(root) ? "git" : "filesystem";
    reason = resolvedMode === "git" ? "auto: Git index available" : "auto: no usable Git metadata at the contract root";
  }
  if (resolvedMode === "filesystem") {
    return {
      mode: "filesystem",
      reason,
      tracked: null,
      symlinks: new Set(),
      has: (file) => {
        try {
          return fs.lstatSync(path.join(root, file)).isFile() || fs.lstatSync(path.join(root, file)).isSymbolicLink();
        } catch {
          return false;
        }
      },
    };
  }
  if (resolvedMode !== "git") throw new Error(`Unknown input mode ${mode}`);
  const topLevel = gitTopLevel(root);
  if (topLevel !== fs.realpathSync(root)) {
    throw new ContractError([problem("unsafe-input", `Contract root ${root} must be the Git top level (${topLevel || "no repository"})`)]);
  }
  const raw = execFileSync("git", ["-C", root, "ls-files", "-z", "-s", "--cached"], {
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024,
  }).toString("utf8");
  const tracked = new Set();
  const symlinks = new Set();
  for (const record of raw.split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    const [modeBits] = record.slice(0, tab).split(" ");
    const file = record.slice(tab + 1);
    tracked.add(file);
    if (modeBits === "120000") symlinks.add(file);
  }
  return { mode: "git", reason, tracked, symlinks, has: (file) => tracked.has(file) };
};

// ---------------------------------------------------------------------------
// Reference extraction (pure, exported for tests)

const htmlReferenceValues = (attribute, value) => {
  const name = attribute.toLowerCase();
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (name === "srcset") return trimmed.split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
  if (name === "content") return /^(?:https?:)?\/\/|^\//.test(trimmed) ? [trimmed] : [];
  return [trimmed];
};

export const extractHtmlReferences = (text) => {
  const refs = [];
  for (const match of text.matchAll(HTML_ATTRIBUTE_PATTERN)) {
    for (const value of htmlReferenceValues(match[1], match[2] ?? match[3] ?? "")) {
      refs.push({ specifier: value, kind: `html-${match[1].toLowerCase()}`, line: lineAt(text, match.index), base: "document" });
    }
  }
  for (const ref of extractCssReferences(text)) refs.push({ ...ref, kind: `html-inline-${ref.kind}`, base: "document" });
  return refs;
};

export const extractCssReferences = (text) => {
  const refs = [];
  const importSpans = [];
  for (const match of text.matchAll(CSS_IMPORT_PATTERN)) {
    importSpans.push([match.index, match.index + match[0].length]);
    refs.push({ specifier: match[2], kind: "css-import", line: lineAt(text, match.index), base: "self" });
  }
  for (const match of text.matchAll(CSS_URL_PATTERN)) {
    if (importSpans.some(([start, end]) => match.index >= start && match.index < end)) continue;
    refs.push({ specifier: match[2].trim(), kind: "css-url", line: lineAt(text, match.index), base: "self" });
  }
  return refs;
};

/**
 * Module specifiers resolve against the module URL; other path-like string
 * literals are treated as document-relative requests (fetch, element src).
 */
export const extractJsReferences = (text) => {
  const refs = [];
  const importOffsets = new Set();
  const problems = [];
  for (const pattern of [STATIC_IMPORT_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN]) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[2];
      const offset = match.index + match[0].lastIndexOf(match[1] + specifier);
      if (importOffsets.has(offset)) continue;
      importOffsets.add(offset);
      if (!/^(?:\.{1,2}\/|\/|https?:)/.test(specifier)) {
        problems.push({ code: "bare-specifier", specifier, line: lineAt(text, match.index) });
        continue;
      }
      refs.push({ specifier, kind: "js-import", line: lineAt(text, offset), base: "self" });
    }
  }
  for (const match of text.matchAll(NON_LITERAL_IMPORT_PATTERN)) {
    problems.push({ code: "non-literal-import", specifier: text.slice(match.index, match.index + 40), line: lineAt(text, match.index) });
  }
  for (const match of text.matchAll(LITERAL_PATTERN)) {
    // Template-literal pieces are handled as constructions below.
    if (importOffsets.has(match.index) || match[2].includes("${")) continue;
    refs.push({ specifier: match[2], kind: "js-literal", line: lineAt(text, match.index), base: "document" });
  }
  const constructions = [];
  for (const match of text.matchAll(TEMPLATE_PATTERN)) {
    const literal = match[1];
    const staticPrefix = literal.slice(0, literal.indexOf("${"));
    const staticSuffix = literal.slice(literal.lastIndexOf("}") + 1);
    const localPrefix = /^(?:\.{1,2}\/|\/(?!\/)|(?:assets|data|lib|vendor)\/)/.test(staticPrefix);
    const assetSuffix = new RegExp(`\\.(?:${ASSET_EXTENSIONS})(?:[?#].*)?$`).test(staticSuffix);
    if (localPrefix || (assetSuffix && !/^(?:https?:)?\/\//.test(staticPrefix) && !staticPrefix.startsWith("${"))) {
      constructions.push({ literal, line: lineAt(text, match.index) });
    }
  }
  return { refs, constructions, problems };
};

// ---------------------------------------------------------------------------
// URL resolution

/**
 * Resolve a reference to a deployed file, route, platform path or external URL.
 * WHATWG URL resolution clamps `..` at the site root, matching the browser.
 */
export const resolveSiteReference = (specifier, basePath, { siteOrigins, routing, platformPaths }) => {
  if (!specifier || specifier.startsWith("#") || NON_FETCH_SCHEME.test(specifier)) return { type: "ignored" };
  let url;
  try {
    url = new URL(specifier, `${RESOLUTION_HOST}${basePath}`);
  } catch {
    return { type: "invalid", specifier };
  }
  const local = url.origin === RESOLUTION_HOST || siteOrigins.includes(url.origin);
  if (!local) return { type: "external", url: `${url.origin}${url.pathname}` };
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return { type: "invalid", specifier };
  }
  for (let hop = 0; hop < 5; hop += 1) {
    if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    if (platformPaths.has(pathname)) return { type: "platform", pathname };
    const rewrite = routing.rewrites.find((route) => routeSegmentsMatch(route.source, pathname));
    if (rewrite) return { type: "file", file: rewrite.destination.slice(1), route: pathname, via: "rewrite" };
    const redirect = routing.redirects.find((route) => routeSegmentsMatch(route.source, pathname));
    if (!redirect) break;
    pathname = redirect.destination;
  }
  if (pathname === "/") return { type: "invalid", specifier, reason: "resolves to the site root without a rewrite" };
  return { type: "file", file: pathname.slice(1), route: null, via: "path" };
};

// ---------------------------------------------------------------------------
// Closure

const selectItems = (document, selector) => {
  let current = [document];
  for (const part of selector.split(".")) {
    const iterate = part.endsWith("[]");
    const key = iterate ? part.slice(0, -2) : part;
    const next = [];
    for (const value of current) {
      const child = key ? value?.[key] : value;
      if (iterate) {
        if (Array.isArray(child)) next.push(...child);
      } else if (child !== undefined) {
        next.push(child);
      }
    }
    current = next;
  }
  return current;
};

const expandSequence = (family) => {
  const files = [];
  for (let n = family.start; n <= family.end; n += 1) {
    files.push(family.template.replace("{n}", String(n).padStart(family.pad || 0, "0")));
  }
  return files;
};

const kindOfFile = (file) => {
  const ext = path.posix.extname(file).toLowerCase();
  if (ext === ".html") return "document";
  if (ext === ".js" || ext === ".mjs") return "module";
  if (ext === ".css") return "stylesheet";
  if (ext === ".xml" || ext === ".txt") return "text";
  return "asset";
};

/**
 * Resolve the public dependency closure. Returns nodes, typed edges, external
 * and platform references, and every problem found (never throws for content
 * problems so callers can report all of them at once).
 */
export const resolveClosure = ({ root, declaration, routing, inputs }) => {
  const problems = [];
  const siteOrigins = declaration.siteOrigins;
  const platformPaths = new Set(declaration.platformPaths.map((entry) => entry.path));
  const resolveOptions = { siteOrigins, routing, platformPaths };
  const nodes = new Map();
  const edges = [];
  const externals = new Map();
  const platformUses = [];
  const usedNonFileLiterals = new Set();
  const usedConstructions = new Set();
  const textCache = new Map();
  const moduleDocuments = new Map();
  const nonFileLiterals = new Map(declaration.nonFileLiterals.map((entry) => [`${entry.file}\0${entry.literal}`, entry]));
  const opaqueRules = declaration.opaqueModules.map((entry) => ({ ...entry, regex: globToRegExp(entry.pattern) }));
  const opaqueFiles = new Set();
  const acknowledgements = new Map();
  for (const entry of declaration.acknowledgedConstructions) acknowledgements.set(`${entry.file}\0${entry.literal}`, { ...entry, source: "acknowledgedConstructions" });
  for (const family of declaration.families) {
    if (family.acknowledges) acknowledgements.set(`${family.acknowledges.file}\0${family.acknowledges.literal}`, { ...family.acknowledges, family: family.id, source: "family" });
  }

  const readText = (file) => {
    if (!textCache.has(file)) textCache.set(file, fs.readFileSync(path.join(root, file), "utf8"));
    return textCache.get(file);
  };

  const fileStatus = (file) => {
    const normalized = normalizeRepoPath(file);
    if (!normalized) return "traversal";
    if (inputs.symlinks.has(normalized)) return "symlink";
    const absolute = path.join(root, normalized);
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch {
      return inputs.mode === "git" && inputs.tracked.has(normalized) ? "missing-worktree" : "missing";
    }
    if (stat.isSymbolicLink()) return isInside(fs.realpathSync(root), safeRealpath(absolute)) ? "symlink" : "escaping-symlink";
    if (!stat.isFile()) return "not-a-file";
    if (!isInside(fs.realpathSync(root), safeRealpath(absolute))) return "escaping-symlink";
    if (!inputs.has(normalized)) return "untracked";
    return "ok";
  };

  const addEdge = (from, to, details) => {
    edges.push({ from, to, ...details });
  };

  const addNode = (file, origin) => {
    const status = fileStatus(file);
    if (status !== "ok") {
      const where = origin.from ? `${origin.from}${origin.line ? `:${origin.line}` : ""}` : origin.family ? `family ${origin.family}` : "declaration";
      const messages = {
        traversal: `${where} references ${JSON.stringify(origin.specifier ?? file)}, which escapes or is not a normalized repository path`,
        symlink: `${file} (from ${where}) is a symbolic link; public files must be regular files`,
        "escaping-symlink": `${file} (from ${where}) resolves through a symbolic link outside the repository`,
        missing: `${where} references ${JSON.stringify(origin.specifier ?? file)} → ${file}, which does not exist`,
        "missing-worktree": `${where} references ${file}, which is tracked but missing from the working tree`,
        untracked: `${where} references ${file}, which exists but is not tracked; git add it to make it a deployment candidate`,
        "not-a-file": `${where} references ${file}, which is not a regular file`,
      };
      const code = status === "missing-worktree" ? "missing-reference" : status === "missing" ? "missing-reference" : status === "untracked" ? "untracked-reference" : status;
      problems.push(problem(code, messages[status], { path: file, from: origin.from || origin.family || null }));
      return false;
    }
    if (!nodes.has(file)) nodes.set(file, { file, kind: kindOfFile(file), products: new Set(), roots: new Set() });
    return true;
  };

  const noteExternal = (url, from) => {
    if (!externals.has(url)) externals.set(url, new Set());
    externals.get(url).add(from);
  };

  const handleResolution = (resolution, from, ref) => {
    if (resolution.type === "ignored") return null;
    if (resolution.type === "external") {
      noteExternal(resolution.url, from);
      return null;
    }
    if (resolution.type === "platform") {
      platformUses.push({ from, pathname: resolution.pathname, line: ref.line });
      return null;
    }
    if (resolution.type === "invalid") {
      problems.push(problem("invalid-reference", `${from}:${ref.line} has unresolvable reference ${JSON.stringify(ref.specifier)}${resolution.reason ? ` (${resolution.reason})` : ""}`, { path: from }));
      return null;
    }
    if (!addNode(resolution.file, { from, line: ref.line, specifier: ref.specifier })) return null;
    addEdge(from, resolution.file, { kind: ref.kind, specifier: ref.specifier, line: ref.line, ...(resolution.route ? { route: resolution.route } : {}) });
    return resolution.file;
  };

  const processedRefs = new Set();
  const processRef = (from, ref, basePaths) => {
    const key = `${from}\0${ref.kind}\0${ref.line}\0${ref.specifier}\0${basePaths.join("|")}`;
    if (processedRefs.has(key)) return [];
    processedRefs.add(key);
    if (ref.kind === "js-literal" && nonFileLiterals.has(`${from}\0${ref.specifier}`)) {
      usedNonFileLiterals.add(`${from}\0${ref.specifier}`);
      return [];
    }
    const resolutions = basePaths.map((base) => resolveSiteReference(ref.specifier, base, resolveOptions));
    const signatures = new Set(resolutions.map((resolution) => JSON.stringify({ ...resolution, route: undefined, via: undefined })));
    if (signatures.size > 1) {
      problems.push(problem(
        "inconsistent-resolution",
        `${from}:${ref.line} reference ${JSON.stringify(ref.specifier)} resolves differently from ${basePaths.join(", ")}; use a root-absolute path`,
        { path: from },
      ));
      return [];
    }
    const file = handleResolution(resolutions[0], from, ref);
    return file ? [file] : [];
  };

  const queue = [];
  const enqueue = (file) => {
    if (nodes.has(file) && !nodes.get(file).queued) {
      nodes.get(file).queued = true;
      queue.push(file);
    }
  };

  for (const entry of [...declaration.entries].sort((a, b) => compare(a.path, b.path))) {
    if (addNode(entry.path, { specifier: entry.path })) {
      nodes.get(entry.path).roots.add(`entry:${entry.path}`);
      nodes.get(entry.path).products.add(entry.product);
      enqueue(entry.path);
    }
  }

  const documentsOf = (file) => moduleDocuments.get(file) || new Set();
  const addModuleDocuments = (file, documents) => {
    const current = documentsOf(file);
    let changed = false;
    for (const document of documents) {
      if (!current.has(document)) {
        current.add(document);
        changed = true;
      }
    }
    moduleDocuments.set(file, current);
    return changed;
  };

  const processFile = (file) => {
    const node = nodes.get(file);
    const text = node.kind === "asset" ? null : readText(file);
    if (node.kind === "document") {
      const basePaths = servingPathsFor(file, routing);
      for (const ref of extractHtmlReferences(text)) {
        for (const target of processRef(file, ref, basePaths)) {
          const targetNode = nodes.get(target);
          if (targetNode.kind === "module" && addModuleDocuments(target, [file])) targetNode.queued = false;
          enqueue(target);
        }
      }
    } else if (node.kind === "stylesheet") {
      for (const ref of extractCssReferences(text)) for (const target of processRef(file, ref, [`/${file}`])) enqueue(target);
    } else if (node.kind === "module" && opaqueRules.some((rule) => rule.regex.test(file))) {
      // Declared third-party bundle: shipped as-is, its internal URLs are not modeled.
      opaqueFiles.add(file);
    } else if (node.kind === "module") {
      const { refs, constructions, problems: jsProblems } = extractJsReferences(text);
      for (const jsProblem of jsProblems) {
        problems.push(problem(jsProblem.code, `${file}:${jsProblem.line} ${jsProblem.code === "bare-specifier" ? `imports bare specifier ${JSON.stringify(jsProblem.specifier)}, which browsers cannot resolve without an import map` : `uses a non-literal dynamic import (${jsProblem.specifier.trim()}…), which the contract cannot resolve`}`, { path: file }));
      }
      for (const construction of constructions) {
        const key = `${file}\0${construction.literal}`;
        if (acknowledgements.has(key)) usedConstructions.add(key);
        else problems.push(problem("undeclared-dynamic-path", `${file}:${construction.line} builds a local path with a template literal \`${construction.literal}\`; declare it as a family or acknowledged construction in ${DEFAULT_DECLARATION}`, { path: file }));
      }
      const documentBases = [...documentsOf(file)].sort(compare).flatMap((document) => servingPathsFor(document, routing));
      for (const ref of refs) {
        const bases = ref.base === "self" ? [`/${file}`] : documentBases.length ? sortedUnique(documentBases) : [`/${file}`];
        for (const target of processRef(file, ref, bases)) {
          const targetNode = nodes.get(target);
          if (ref.kind === "js-import" && targetNode.kind === "module" && addModuleDocuments(target, documentsOf(file))) targetNode.queued = false;
          if (targetNode.kind === "module" && ref.kind !== "js-import" && addModuleDocuments(target, documentsOf(file))) targetNode.queued = false;
          enqueue(target);
        }
      }
    } else if (node.kind === "text") {
      const pattern = file.endsWith(".xml") ? SITEMAP_LOC_PATTERN : ROBOTS_SITEMAP_PATTERN;
      for (const match of text.matchAll(pattern)) {
        const ref = { specifier: match[1], kind: file.endsWith(".xml") ? "sitemap-loc" : "robots-sitemap", line: lineAt(text, match.index) };
        for (const target of processRef(file, ref, [`/${file}`])) enqueue(target);
      }
    }
  };

  const drain = () => {
    while (queue.length) processFile(queue.shift());
  };
  drain();

  // Declared dynamic families. Their source manifest or constructing module must
  // already be part of the closure, otherwise the declaration is stale.
  const familyReports = [];
  for (const family of [...declaration.families].sort((a, b) => compare(a.id, b.id))) {
    const report = { id: family.id, type: family.type, product: family.product, files: [] };
    const anchor = family.type === "json-manifest" ? family.manifest : family.acknowledges?.file;
    if (!anchor || !nodes.has(anchor)) {
      problems.push(problem("stale-declaration", `Family ${family.id} is anchored to ${anchor}, which is not part of the public closure`, { path: anchor }));
      familyReports.push(report);
      continue;
    }
    let files = [];
    if (family.type === "json-manifest") {
      const manifest = JSON.parse(readText(family.manifest));
      const items = selectItems(manifest, family.items);
      const pattern = new RegExp(family.pathPattern);
      if (items.length < (family.minCount || 1)) {
        problems.push(problem("family-integrity", `Family ${family.id} selected ${items.length} items from ${family.manifest} (${family.items}); expected at least ${family.minCount || 1}`, { path: family.manifest }));
      }
      items.forEach((item, index) => {
        const value = item?.[family.urlField];
        const normalized = normalizeRepoPath(value);
        if (!normalized || !pattern.test(normalized)) {
          problems.push(problem(normalized ? "family-integrity" : "traversal", `${family.manifest} ${family.items}[${index}].${family.urlField} ${JSON.stringify(value)} does not match ${family.pathPattern} as a normalized repository path`, { path: family.manifest }));
          return;
        }
        files.push({ file: normalized, item, index });
      });
    } else if (family.type === "sequence") {
      if (!readText(family.acknowledges.file).includes(family.acknowledges.literal)) {
        problems.push(problem("stale-declaration", `Family ${family.id} acknowledges \`${family.acknowledges.literal}\`, which no longer appears in ${family.acknowledges.file}`, { path: family.acknowledges.file }));
      }
      files = expandSequence(family).map((file, index) => ({ file, index }));
    } else {
      problems.push(problem("declaration", `Family ${family.id} has unsupported type ${family.type}`));
    }
    for (const { file, item, index } of files) {
      const origin = { family: family.id, specifier: file };
      if (!addNode(file, origin)) continue;
      if (family.type === "json-manifest" && (family.bytesField || family.sha256Field)) {
        const bytes = fs.readFileSync(path.join(root, file));
        if (family.bytesField && item[family.bytesField] !== bytes.length) {
          problems.push(problem("family-integrity", `${file} is ${bytes.length} bytes but ${family.manifest} ${family.items}[${index}] declares ${item[family.bytesField]}`, { path: file }));
        }
        if (family.sha256Field && item[family.sha256Field] !== sha256Hex(bytes)) {
          problems.push(problem("family-integrity", `${file} SHA-256 differs from ${family.manifest} ${family.items}[${index}].${family.sha256Field}`, { path: file }));
        }
      }
      addEdge(anchor, file, { kind: `family:${family.id}`, ...(family.type === "json-manifest" ? { item: `${family.items}[${index}].${family.urlField}` } : { index }) });
      nodes.get(file).roots.add(`family:${family.id}`);
      report.files.push(file);
      enqueue(file);
    }
    report.files.sort(compare);
    familyReports.push(report);
  }
  drain();

  for (const [key, entry] of acknowledgements) {
    if (entry.source === "acknowledgedConstructions" && !usedConstructions.has(key)) {
      problems.push(problem("stale-declaration", `Acknowledged construction \`${entry.literal}\` was not found in public module ${entry.file}`, { path: entry.file }));
    }
    if (entry.source === "family" && nodes.has(entry.file) && !usedConstructions.has(key)) {
      problems.push(problem("stale-declaration", `Family ${entry.family} acknowledges \`${entry.literal}\`, but ${entry.file} no longer builds that template literal`, { path: entry.file }));
    }
  }
  for (const [key, entry] of nonFileLiterals) {
    if (!usedNonFileLiterals.has(key)) problems.push(problem("stale-declaration", `Non-file literal ${JSON.stringify(entry.literal)} was not found in public module ${entry.file}`, { path: entry.file }));
  }
  for (const rule of opaqueRules) {
    if (![...opaqueFiles].some((file) => rule.regex.test(file))) problems.push(problem("stale-declaration", `Opaque module rule "${rule.pattern}" matches no public module`, { path: rule.pattern }));
  }
  const usedPlatform = new Set(platformUses.map((use) => use.pathname));
  for (const entry of declaration.platformPaths) {
    if (!usedPlatform.has(entry.path)) problems.push(problem("stale-declaration", `Platform path ${entry.path} is declared but no public file references it`, { path: entry.path }));
  }

  const entryPaths = new Set(declaration.entries.map((entry) => entry.path));
  for (const [file, node] of nodes) {
    if (["document", "text"].includes(node.kind) && !entryPaths.has(file)) {
      const from = edges.filter((edge) => edge.to === file).map((edge) => edge.from).sort(compare);
      problems.push(problem("undeclared-document", `${file} is linked from ${sortedUnique(from).join(", ")} but is not a declared entry; add it to entries with a product and reason`, { path: file }));
    }
  }

  // Products and shortest dependency chains (deterministic breadth-first walk).
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    adjacency.get(edge.from).add(edge.to);
  }
  const chains = new Map();
  const entries = [...declaration.entries].sort((a, b) => compare(a.path, b.path));
  for (const entry of entries) {
    if (!nodes.has(entry.path)) continue;
    const seen = new Set([entry.path]);
    const walk = [[entry.path]];
    while (walk.length) {
      const chain = walk.shift();
      const file = chain.at(-1);
      nodes.get(file).products.add(entry.product);
      const existing = chains.get(file);
      if (!existing || chain.length < existing.length || (chain.length === existing.length && compare(chain.join(">"), existing.join(">")) < 0)) chains.set(file, chain);
      for (const next of [...(adjacency.get(file) || [])].sort(compare)) {
        // Links to other documents are navigation, not load dependencies.
        if (seen.has(next) || ["document", "text"].includes(nodes.get(next).kind)) continue;
        seen.add(next);
        walk.push([...chain, next]);
      }
    }
  }
  for (const family of declaration.families) {
    for (const file of familyReports.find((report) => report.id === family.id)?.files || []) nodes.get(file)?.products.add(family.product);
  }

  const uniqueEdges = [...new Map(edges.map((edge) => [JSON.stringify(edge), edge])).values()];
  const uniqueProblems = [...new Map(problems.map((entry) => [`${entry.code}\0${entry.message}`, entry])).values()];
  return {
    nodes,
    chains,
    edges: uniqueEdges
      .sort((a, b) => compare(a.to, b.to) || compare(a.from, b.from) || compare(a.kind, b.kind) || compare(String(a.specifier ?? a.item ?? a.index), String(b.specifier ?? b.item ?? b.index)) || (a.line || 0) - (b.line || 0)),
    externals: [...externals.entries()].map(([url, from]) => ({ url, from: [...from].sort(compare) })).sort((a, b) => compare(a.url, b.url)),
    platformUses: platformUses.sort((a, b) => compare(a.pathname, b.pathname) || compare(a.from, b.from)),
    opaqueModules: [...opaqueFiles].sort(compare),
    families: familyReports,
    problems: uniqueProblems,
  };
};

// ---------------------------------------------------------------------------
// Classification

export const classifyInputs = ({ inputs, closure, declaration }) => {
  const problems = [];
  const rules = declaration.excluded.map((rule) => ({ ...rule, regex: globToRegExp(rule.pattern), matches: 0 }));
  const included = [...closure.nodes.keys()].sort(compare);
  const includedSet = new Set(included);
  for (const file of included) {
    const rule = rules.find((candidate) => candidate.regex.test(file));
    if (rule) {
      const chain = closure.chains.get(file) || [];
      problems.push(problem("forbidden-public-file", `${file} is excluded by "${rule.pattern}" (${rule.class}: ${rule.reason}) but is reached from ${chain.join(" → ") || "a declared family"}; remove the reference or narrow the rule deliberately`, { path: file }));
    }
  }
  if (inputs.mode !== "git") {
    return { mode: inputs.mode, status: "not-run", included, excluded: [], unclassified: [], problems };
  }
  const excluded = [];
  const unclassified = [];
  for (const file of [...inputs.tracked].sort(compare)) {
    if (includedSet.has(file)) continue;
    const rule = rules.find((candidate) => candidate.regex.test(file));
    if (rule) {
      rule.matches += 1;
      excluded.push({ path: file, pattern: rule.pattern, class: rule.class });
    } else {
      unclassified.push(file);
      problems.push(problem("unclassified-path", `${file} is tracked but neither reached from a public entry/family nor excluded; reference it from runtime code, declare it, or add an exclusion rule with a class and reason to ${DEFAULT_DECLARATION}`, { path: file }));
    }
  }
  for (const rule of rules) {
    if (!rule.matches && !rule.guard && !included.some((file) => rule.regex.test(file))) {
      problems.push(problem("stale-declaration", `Exclusion rule "${rule.pattern}" matches no tracked path; remove it or mark it as a guard`, { path: rule.pattern }));
    }
  }
  return { mode: "git", status: "complete", included, excluded, unclassified, problems };
};

// ---------------------------------------------------------------------------
// Public path safety and inventory

export const checkPublicPaths = (files) => {
  const problems = [];
  for (const file of files) {
    if (!PORTABLE_PATH.test(file) || file.split("/").some((part) => part === "." || part === ".." || part.endsWith("."))) {
      problems.push(problem("non-portable-path", `${file} is not a portable public path (allowed: A-Z a-z 0-9 . _ @ + - and /)`, { path: file }));
    }
  }
  for (const [first, second] of findDestinationCollisions(files)) {
    problems.push(problem("duplicate-destination", `${first} and ${second} map to the same destination on case-insensitive or normalizing file systems`, { path: second }));
  }
  return problems;
};

export const computeInventory = (root, files) =>
  [...files].sort(compare).map((file) => {
    const bytes = fs.readFileSync(path.join(root, file));
    return { path: file, bytes: bytes.length, sha256: sha256Hex(bytes) };
  });

export const contractDigest = (inventory) =>
  sha256Hex(inventory.map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`).join(""));

// ---------------------------------------------------------------------------
// Current ignore-based deployment model

export const PROVIDER_WITHHELD = Object.freeze([
  { path: ".gitignore", basis: "Vercel default ignore list; observed 404 on www.stackrankapp.com 2026-10-04" },
  { path: ".vercelignore", basis: "observed 404 on www.stackrankapp.com 2026-10-04" },
  { path: "package.json", basis: "observed 404 on www.stackrankapp.com 2026-10-04" },
  { path: "vercel.json", basis: "observed 404 on www.stackrankapp.com 2026-10-04" },
]);

/**
 * Approximates the pre-contract output: tracked files minus Git-semantics
 * matches of an ignore file, minus files the provider was observed to withhold.
 * This is a local model, not a measured Vercel file listing.
 */
export const modelIgnoreOutput = (root, ignoreFile = ".vercelignore", { ignoreText } = {}) => {
  const args = ["-C", root, "ls-files", "-z", "--cached", "--ignored"];
  let temporary = null;
  if (ignoreText !== undefined) {
    temporary = path.join(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "stackrank-ignore-")), "ignore");
    fs.writeFileSync(temporary, ignoreText);
    args.push(`--exclude-from=${temporary}`);
  } else {
    args.push(`--exclude-from=${path.join(root, ignoreFile)}`);
  }
  try {
    const ignored = new Set(execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0").filter(Boolean));
    const tracked = execFileSync("git", ["-C", root, "ls-files", "-z", "-s", "--cached"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
      .split("\0")
      .filter(Boolean)
      .map((record) => ({ mode: record.split(" ")[0], file: record.slice(record.indexOf("\t") + 1) }));
    const withheld = new Set(PROVIDER_WITHHELD.map((entry) => entry.path));
    return tracked
      .filter(({ file }) => !ignored.has(file) && !withheld.has(file))
      .map(({ file, mode }) => ({ path: file, symlink: mode === "120000" }))
      .sort((a, b) => compare(a.path, b.path));
  } finally {
    if (temporary) fs.rmSync(path.dirname(temporary), { recursive: true, force: true });
  }
};

export const compareWithModel = (root, inventory, modelEntries, classification) => {
  const contract = new Map(inventory.map((entry) => [entry.path, entry]));
  const excludedBy = new Map(classification.excluded.map((entry) => [entry.path, entry]));
  const sizeOf = (file) => {
    try {
      return fs.statSync(path.join(root, file)).size;
    } catch {
      return 0;
    }
  };
  const model = modelEntries.map((entry) => ({ ...entry, bytes: sizeOf(entry.path) }));
  const modelSet = new Set(model.map((entry) => entry.path));
  const retained = model.filter((entry) => contract.has(entry.path));
  const removed = model
    .filter((entry) => !contract.has(entry.path))
    .map((entry) => ({ path: entry.path, bytes: entry.bytes, class: excludedBy.get(entry.path)?.class || "unclassified", rule: excludedBy.get(entry.path)?.pattern || null }));
  const added = inventory.filter((entry) => !modelSet.has(entry.path)).map(({ path: file, bytes }) => ({ path: file, bytes }));
  const sum = (entries) => entries.reduce((total, entry) => total + entry.bytes, 0);
  const removedByClass = {};
  for (const entry of removed) {
    removedByClass[entry.class] ||= { files: 0, bytes: 0 };
    removedByClass[entry.class].files += 1;
    removedByClass[entry.class].bytes += entry.bytes;
  }
  return {
    totals: {
      model: { files: model.length, bytes: sum(model) },
      contract: { files: inventory.length, bytes: sum(inventory) },
      retained: { files: retained.length, bytes: sum(retained) },
      removed: { files: removed.length, bytes: sum(removed) },
      added: { files: added.length, bytes: sum(added) },
    },
    removedByClass: Object.fromEntries(Object.entries(removedByClass).sort(([a], [b]) => compare(a, b))),
    removed,
    added,
  };
};

// ---------------------------------------------------------------------------
// Staged output

const safeRealpath = (target) => {
  try {
    return fs.realpathSync(target);
  } catch {
    const parent = path.dirname(target);
    return parent === target ? target : path.join(safeRealpath(parent), path.basename(target));
  }
};

/** Validate that a build directory can be (re)created without touching source. */
export const validateBuildDir = ({ root, buildDir, inputs, publicFiles }) => {
  const problems = [];
  const realRoot = fs.realpathSync(root);
  const absolute = path.resolve(root, buildDir);
  let stat = null;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    stat = null;
  }
  if (stat?.isSymbolicLink()) {
    return [problem("unsafe-output", `Build directory ${absolute} is a symbolic link; refusing to write through it`)];
  }
  const real = safeRealpath(absolute);
  if (real === path.parse(real).root) problems.push(problem("unsafe-output", `Build directory ${absolute} is a file-system root`));
  if (isInside(real, realRoot)) problems.push(problem("unsafe-output", `Build directory ${absolute} is the source root or one of its ancestors`));
  if (isInside(realRoot, real)) {
    const relative = toPosix(path.relative(realRoot, real));
    const prefix = `${relative}/`;
    const trackedInside = inputs.mode === "git" ? [...inputs.tracked].filter((file) => file === relative || file.startsWith(prefix)) : [];
    if (trackedInside.length) {
      problems.push(problem("unsafe-output", `Build directory ${relative} contains tracked source (${trackedInside.slice(0, 3).join(", ")}${trackedInside.length > 3 ? ", …" : ""})`));
    }
    const publicParents = new Set(publicFiles.flatMap((file) => {
      const parts = file.split("/").slice(0, -1);
      return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
    }));
    if (publicFiles.includes(relative) || [...publicParents].some((dir) => relative === dir || relative.startsWith(`${dir}/`))) {
      problems.push(problem("unsafe-output", `Build directory ${relative} overlaps a public source directory`));
    }
  }
  if (stat && !stat.isDirectory()) problems.push(problem("unsafe-output", `Build directory ${absolute} exists and is not a directory`));
  if (stat?.isDirectory()) {
    const entries = fs.readdirSync(absolute);
    if (entries.length && !entries.includes(BUILD_MARKER)) {
      problems.push(problem("unsafe-output", `Build directory ${absolute} is not empty and was not created by the deployment builder (no ${BUILD_MARKER}); remove it manually or choose another --build-dir`));
    }
  }
  return problems;
};

const walkFiles = (dir, base = dir) => {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) result.push({ path: toPosix(path.relative(base, absolute)), symlink: true });
    else if (entry.isDirectory()) result.push(...walkFiles(absolute, base));
    else result.push({ path: toPosix(path.relative(base, absolute)), symlink: false });
  }
  return result;
};

/** Compare a staged public directory with an inventory: missing, extra, changed or linked files fail. */
export const verifyOutput = (publicDir, inventory) => {
  const problems = [];
  if (!fs.existsSync(publicDir)) return [problem("output-mismatch", `Staged output ${publicDir} does not exist`)];
  const expected = new Map(inventory.map((entry) => [entry.path, entry]));
  const actual = walkFiles(publicDir);
  const seen = new Set();
  for (const file of actual) {
    seen.add(file.path);
    if (file.symlink) {
      problems.push(problem("output-mismatch", `Staged output contains symbolic link ${file.path}`, { path: file.path }));
      continue;
    }
    const want = expected.get(file.path);
    if (!want) {
      problems.push(problem("output-mismatch", `Staged output contains undeclared file ${file.path}`, { path: file.path }));
      continue;
    }
    const bytes = fs.readFileSync(path.join(publicDir, file.path));
    if (bytes.length !== want.bytes || sha256Hex(bytes) !== want.sha256) {
      problems.push(problem("output-mismatch", `Staged ${file.path} differs from its inventory bytes/SHA-256`, { path: file.path }));
    }
  }
  for (const file of expected.keys()) {
    if (!seen.has(file)) problems.push(problem("output-mismatch", `Staged output is missing required ${file}`, { path: file }));
  }
  return problems;
};

// ---------------------------------------------------------------------------
// Orchestration

/** Resolve, classify and inventory without writing anything. Throws ContractError on any problem. */
export const planDeployment = ({ root, declarationPath = DEFAULT_DECLARATION, routingPath = DEFAULT_ROUTING, inputMode = "auto" }) => {
  const realRoot = fs.realpathSync(root);
  const declaration = loadDeclaration(realRoot, declarationPath);
  const routing = loadRouting(realRoot, routingPath);
  const inputs = listInputs(realRoot, { mode: inputMode });
  const closure = resolveClosure({ root: realRoot, declaration, routing, inputs });
  const classification = classifyInputs({ inputs, closure, declaration });
  const included = [...closure.nodes.keys()].sort(compare);
  const problems = [...closure.problems, ...classification.problems, ...checkPublicPaths(included)];
  if (problems.length) throw new ContractError(problems);
  const inventory = computeInventory(realRoot, included).map((entry) => {
    const node = closure.nodes.get(entry.path);
    const chain = closure.chains.get(entry.path) || [];
    const lastHop = closure.edges.find((edge) => edge.from === chain.at(-2) && edge.to === entry.path);
    const reason = [...node.roots].sort(compare)[0]
      || (lastHop ? `${lastHop.kind} ${JSON.stringify(lastHop.specifier)} in ${lastHop.from}:${lastHop.line}` : "unreached");
    return { ...entry, products: [...node.products].sort(compare), reason, chain };
  });
  return { root: realRoot, declaration, declarationPath, routing, inputs, closure, classification, inventory };
};

const byProduct = (inventory) => {
  const totals = {};
  for (const entry of inventory) {
    for (const product of entry.products) {
      totals[product] ||= { files: 0, bytes: 0 };
      totals[product].files += 1;
      totals[product].bytes += entry.bytes;
    }
  }
  return Object.fromEntries(Object.entries(totals).sort(([a], [b]) => compare(a, b)));
};

/** Deterministic report documents (no timestamps, absolute paths or environment data). */
export const deterministicReports = (plan, { comparison = null } = {}) => {
  const declarationBytes = fs.readFileSync(path.join(plan.root, plan.declarationPath));
  const inventory = plan.inventory;
  const summary = {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    declaration: { path: plan.declarationPath, sha256: sha256Hex(declarationBytes) },
    inputMode: plan.inputs.mode,
    contractDigest: contractDigest(inventory),
    totals: { files: inventory.length, bytes: inventory.reduce((total, entry) => total + entry.bytes, 0) },
    byProduct: byProduct(inventory),
    families: plan.closure.families.map((family) => ({ id: family.id, type: family.type, product: family.product, files: family.files.length })),
    classification: {
      status: plan.classification.status,
      included: plan.classification.included.length,
      excluded: plan.classification.excluded.length,
      unclassified: plan.classification.unclassified.length,
    },
  };
  return {
    "public-inventory.json": {
      ...summary,
      files: inventory.map(({ path: file, bytes, sha256, products, reason, chain }) => ({ path: file, bytes, sha256, products, reason, chain })),
    },
    "classification.json": {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      status: plan.classification.status,
      included: plan.classification.included,
      excluded: plan.classification.excluded,
      unclassified: plan.classification.unclassified,
    },
    "dependency-graph.json": {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      entries: plan.declaration.entries.map(({ path: file, product, reason }) => ({ path: file, product, reason, servedAt: servingPathsFor(file, plan.routing) })),
      families: plan.closure.families,
      edges: plan.closure.edges,
      externals: plan.closure.externals,
      platformUses: plan.closure.platformUses,
      opaqueModules: plan.closure.opaqueModules,
    },
    ...(comparison ? { "current-ignore-comparison.json": comparison } : {}),
    "summary.json": summary,
  };
};

/**
 * Plan and write a staged deployment. Nothing is deleted or written until the
 * complete plan, path safety and build-directory checks pass.
 */
export const buildDeployment = ({
  root,
  buildDir = "dist",
  declarationPath = DEFAULT_DECLARATION,
  routingPath = DEFAULT_ROUTING,
  inputMode = "auto",
  compareIgnoreFile = ".vercelignore",
} = {}) => {
  const plan = planDeployment({ root, declarationPath, routingPath, inputMode });
  const absoluteBuildDir = path.resolve(plan.root, buildDir);
  const buildProblems = validateBuildDir({ root: plan.root, buildDir: absoluteBuildDir, inputs: plan.inputs, publicFiles: plan.inventory.map((entry) => entry.path) });
  if (buildProblems.length) throw new ContractError(buildProblems);

  let comparison = null;
  if (plan.inputs.mode === "git" && compareIgnoreFile && fs.existsSync(path.join(plan.root, compareIgnoreFile))) {
    const model = modelIgnoreOutput(plan.root, compareIgnoreFile);
    comparison = {
      model: {
        label: "current ignore-based output (modeled)",
        ignoreFile: compareIgnoreFile,
        assumptions: [
          "Tracked files only, matched with Git's gitignore semantics (git ls-files --ignored --exclude-from); Vercel's matcher is assumed equivalent for these patterns.",
          "Files the provider was observed to withhold are removed from the model; see providerWithheld.",
          "Symbolic links are counted as their tracked path; the model is not a measured Vercel file listing.",
        ],
        providerWithheld: PROVIDER_WITHHELD,
      },
      ...compareWithModel(plan.root, plan.inventory, model, plan.classification),
    };
  }

  // Writes start here.
  if (fs.existsSync(absoluteBuildDir)) fs.rmSync(absoluteBuildDir, { recursive: true });
  fs.mkdirSync(absoluteBuildDir, { recursive: true });
  fs.writeFileSync(path.join(absoluteBuildDir, BUILD_MARKER), "Created by deploy/build.mjs; safe for the builder to replace.\n");
  const publicDir = path.join(absoluteBuildDir, PUBLIC_DIR_NAME);
  for (const entry of plan.inventory) {
    const destination = path.join(publicDir, ...entry.path.split("/"));
    if (!isInside(publicDir, destination)) throw new ContractError([problem("traversal", `Refusing to write ${entry.path} outside ${publicDir}`)]);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(plan.root, entry.path), destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o644);
  }
  const outputProblems = verifyOutput(publicDir, plan.inventory);
  if (outputProblems.length) throw new ContractError(outputProblems);

  const reports = deterministicReports(plan, { comparison });
  const reportDir = path.join(absoluteBuildDir, REPORT_DIR_NAME);
  fs.mkdirSync(reportDir, { recursive: true });
  for (const [name, value] of Object.entries(reports)) fs.writeFileSync(path.join(reportDir, name), stableJson(value));
  return { plan, buildDir: absoluteBuildDir, publicDir, reportDir, reports };
};
