// Synthetic data-safety regression harness. Adapted from the immutable October 7
// audit probe; no audit files are read or modified at runtime. Emulates the
// small Supabase Auth/PostgREST surface the apps use (with owner/RLS semantics,
// constraints and fault injection), and drives isolated headless Chrome
// instances through CDP.
//
// Network isolation (defence in depth):
//   1. Chrome launches with --host-resolver-rules mapping every host except
//      127.0.0.1 to NOTFOUND, so no request can leave the machine.
//   2. An init script (instrumentation, documented in README) wraps window.fetch:
//      same-origin requests pass through unchanged; requests to the production
//      Supabase origin are re-addressed to the local mock with the identical
//      method/headers/body; every other origin is rejected and recorded.
// The wrapper never changes app logic or payloads; it only changes the host.
"use strict";
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const os = require("os");
const SOURCE_ROOT = path.resolve(__dirname, "../..");
const SNAPSHOT = path.resolve(process.env.DATA_SAFETY_SERVE_ROOT || SOURCE_ROOT);
const PROFILE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "stackrank-data-safety-"));
const SUPABASE_ORIGIN = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const AUTH_STORAGE_KEY = "sb-hrfhakrxsllrqmscxxpb-auth-token";
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => p && fs.existsSync(p));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const getFreePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.unref();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// ---------------------------------------------------------------- static server
const CONTENT_TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
async function startStaticServer({ root = SNAPSHOT } = {}) {
  const log = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);
    log.push({ method: req.method, path: p });
    if (p === "/__audit_blank") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>blank</title>"); return; }
    const rel = p === "/movies" ? "index.html" : p === "/dogs" ? "dogs.html" : p === "/books" ? "books.html"
      : /^\/s\/dogs\/[a-z0-9]{12}$/.test(p) ? "dogs-shared.html" : /^\/s\/[a-z0-9]{10}$/.test(p) ? "shared.html" : p.replace(/^\/+/, "");
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "cache-control": "no-store", "content-type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  const port = await getFreePort();
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${port}`, log, close: () => new Promise((r) => server.close(r)) };
}

// ---------------------------------------------------------------- jsonb text size
// PostgreSQL renders jsonb::text with ", " and ": " separators and de-duplicated,
// sorted object keys. octet_length(jsonb::text) is what the CHECK constraints bound.
function jsonbText(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(", ")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined)
    .sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((k) => `${JSON.stringify(k)}: ${jsonbText(value[k])}`).join(", ")}}`;
}
const jsonbBytes = (v) => Buffer.byteLength(jsonbText(v), "utf8");

// ---------------------------------------------------------------- mock Supabase
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const LIST_ID_RE = /^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TABLES = {
  rankings: { pk: ["list_id"], owned: true },
  movie_lists: { pk: ["list_id", "list_type"], owned: true },
  pack_progress: { pk: ["list_id", "pack_slug"], owned: true },
  shared_lists: { pk: ["slug"], owned: false },
  suggestion_packs: { pk: ["slug"], owned: false },
  product_events: { pk: ["id"], owned: false },
  category_rankings: { pk: ["list_id", "category"], owned: true },
  category_lists: { pk: ["list_id", "category", "list_type"], owned: true },
  category_pack_progress: { pk: ["list_id", "category"], owned: true },
  category_shared_lists: { pk: ["slug"], owned: false, unique: [["list_id", "category"]] },
};
const pgTimestamp = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace("Z", "+00:00");
};

class MockSupabase {
  constructor() {
    this.users = new Map();
    this.sessions = new Map(); // refresh_token -> {userId, revoked}
    this.db = Object.fromEntries(Object.keys(TABLES).map((t) => [t, []]));
    this.trace = [];
    this.rules = []; // fault injection rules
    this.seq = 0;
    this.functions = {}; // name -> (query, body) => json
  }
  addUser(id, email) { const u = { id, aud: "authenticated", role: "authenticated", email, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" }; this.users.set(id, u); return u; }
  issueSession(userId, { expiresIn = 3600 } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const sid = `s${++this.seq}`;
    const access = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: userId, aud: "authenticated", role: "authenticated", email: this.users.get(userId).email, exp: now + expiresIn, session_id: sid })}.${Buffer.alloc(32, 0).toString("base64url")}`;
    const refresh = `rt-${userId.slice(0, 4)}-${++this.seq}`;
    this.sessions.set(refresh, { userId, revoked: false, sid });
    return { access_token: access, token_type: "bearer", expires_in: expiresIn, expires_at: now + expiresIn, refresh_token: refresh, user: this.users.get(userId) };
  }
  revokeUserSessions(userId) { for (const s of this.sessions.values()) if (s.userId === userId) s.revoked = true; }
  roleFor(headers) {
    const auth = headers.authorization || "";
    const tok = auth.replace(/^Bearer\s+/i, "");
    const parts = tok.split(".");
    if (parts.length === 3) {
      try {
        const p = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        if (p.sub && this.users.has(p.sub)) {
          if (p.exp * 1000 < Date.now()) return { role: "expired", sub: p.sub };
          // Revoking refresh tokens does not revoke already-issued access JWTs.
          // Tests needing an expired session must actually use an expired JWT.
          return { role: "authenticated", sub: p.sub };
        }
      } catch (_) { /* fallthrough: publishable key */ }
    }
    return { role: "anon", sub: null };
  }
  rule(r) { const rule = { times: 1, ...r, hits: 0 }; this.rules.push(rule); return rule; }
  matchRule(ctx) {
    for (const r of this.rules) {
      if (r.hits >= r.times) continue;
      if (r.method && r.method !== ctx.method) continue;
      if (r.table && r.table !== ctx.table) continue;
      if (r.path && !ctx.path.includes(r.path)) continue;
      if (r.when && !r.when(ctx)) continue;
      r.hits += 1;
      return r;
    }
    return null;
  }
  snapshotDb() { return JSON.parse(JSON.stringify(this.db)); }
  rows(table, listId, extra = {}) { return this.db[table].filter((r) => (!listId || r.list_id === listId) && Object.entries(extra).every(([k, v]) => r[k] === v)); }

  // PostgREST filter parsing
  parseFilters(sp) {
    const filters = [];
    for (const [k, v] of sp.entries()) {
      if (["select", "order", "limit", "on_conflict", "columns", "offset"].includes(k)) continue;
      const m = v.match(/^(eq|neq|in|is)\.(.*)$/s);
      if (!m) continue;
      let val = m[2];
      if (m[1] === "in") val = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      if (m[1] === "is") val = val === "null" ? null : val === "true" ? true : val === "false" ? false : val;
      if (m[1] === "eq" && (val === "true" || val === "false") && (k === "revoked" || k === "active")) val = val === "true";
      filters.push({ col: k, op: m[1], val });
    }
    return filters;
  }
  applyFilters(rows, filters) {
    return rows.filter((r) => filters.every(({ col, op, val }) => {
      const x = r[col];
      if (op === "eq") return /_at$/.test(col) && x && val ? new Date(x).getTime() === new Date(val).getTime() : String(x) === String(val);
      if (op === "neq") return String(x) !== String(val);
      if (op === "in") return val.includes(String(x));
      if (op === "is") return val === null ? x === null || x === undefined : x === val;
      return true;
    }));
  }
  visible(table, role, op) {
    const t = TABLES[table];
    const own = (r) => role.role === "authenticated" && r.list_id === `user:${role.sub}`;
    if (t.owned) {
      if (role.role !== "authenticated") return { denied: true };
      return { filter: own };
    }
    if (table === "shared_lists") {
      if (op === "select") return { filter: (r) => r.revoked === false || own(r) };
      if (role.role !== "authenticated") return { denied: true };
      return { filter: own };
    }
    if (table === "category_shared_lists") {
      if (op === "select") {
        if (role.role === "anon") return { filter: (r) => r.revoked_at === null || r.revoked_at === undefined, columns: ["slug", "category", "payload", "created_at", "updated_at"] };
        if (role.role === "authenticated") return { filter: own };
        return { denied: true };
      }
      if (role.role !== "authenticated") return { denied: true };
      return { filter: own };
    }
    if (table === "suggestion_packs") return op === "select" ? { filter: (r) => r.active !== false } : { denied: true };
    if (table === "product_events") return op === "insert" ? { filter: () => true } : { denied: true };
    return { denied: true };
  }
  checkConstraints(table, row) {
    const fail = (msg) => ({ status: 400, body: { code: "23514", message: `new row violates check constraint: ${msg}` } });
    if (table === "rankings" && jsonbBytes(row.movies) > 1048576) return fail("rankings_movies_payload_size");
    if (table === "movie_lists" && jsonbBytes(row.movies) > 1048576) return fail("movie_lists_movies_payload_size");
    if (table === "pack_progress" && jsonbBytes(row.state) > 8192) return fail("pack_progress_state_payload_size");
    if (table.startsWith("category_")) {
      if (!LIST_ID_RE.test(row.list_id || "")) return fail(`${table}_list_id_format`);
      if (table === "category_rankings" || table === "category_lists") {
        if (!Array.isArray(row.items)) return fail("items_array");
        if (row.items.length > 5000) return fail("items_count");
        if (jsonbBytes(row.items) > 1048576) return fail("items_size");
      }
      if (table === "category_pack_progress" && jsonbBytes(row.state) > 8192) return fail("state_size");
      if (table === "category_shared_lists") {
        const extra = Object.keys(row.payload || {}).filter((k) => !["displayName", "items", "catalogVersion"].includes(k));
        if (extra.length) return fail("payload_fields");
        if (!/^[a-z0-9]{12}$/.test(row.slug || "")) return fail("slug_format");
      }
    }
    if (table === "shared_lists" && (!/^[a-z0-9]{10}$/.test(row.slug || "") || !Array.isArray(row.payload?.movies))) return fail("shared_lists");
    return null;
  }
  normalizeRow(table, row) {
    const r = { ...row };
    for (const k of ["updated_at", "created_at", "revoked_at"]) if (r[k]) r[k] = pgTimestamp(r[k]);
    const now = pgTimestamp(Date.now());
    if (!r.updated_at && k_has(table, "updated_at")) r.updated_at = now;
    if (table.endsWith("shared_lists") && !r.created_at) r.created_at = now;
    if (table === "shared_lists" && r.revoked === undefined) r.revoked = false;
    if (table === "category_shared_lists" && r.revoked_at === undefined) r.revoked_at = null;
    return r;
  }

  async handle(req, body) {
    const url = new URL(req.url, "http://x");
    const ctx = { id: ++this.seq, t: Date.now(), method: req.method, path: url.pathname, search: url.search, table: null, role: null };
    const headers = req.headers;
    if (url.pathname.startsWith("/rest/v1/")) ctx.table = url.pathname.slice(9);
    ctx.role = this.roleFor(headers);
    let parsedBody = null;
    try { parsedBody = body ? JSON.parse(body) : null; } catch (_) { parsedBody = body; }
    ctx.body = parsedBody;
    const rule = this.matchRule(ctx);
    const entry = { id: ctx.id, t: ctx.t, method: ctx.method, path: ctx.path, table: ctx.table, search: decodeURIComponent(ctx.search), role: ctx.role.role, sub: ctx.role.sub, body: parsedBody, rule: rule?.name || null };
    this.trace.push(entry);
    if (rule?.hold) { entry.held = true; await rule.hold.promise; entry.released = Date.now(); }
    if (rule?.response) { entry.status = rule.response.status; entry.completed = Date.now(); return structuredClone(rule.response); }
    if (rule?.mode === "network-before") { entry.outcome = "network-error-before-commit"; return { destroy: true }; }
    if (rule?.mode === "http-error") { entry.completed = Date.now(); entry.status = rule.status || 500; entry.outcome = `http-${rule.status || 500}`; return { status: rule.status || 500, body: { message: "audit injected failure", code: "AUDIT" } }; }
    let result;
    if (url.pathname.startsWith("/auth/v1/")) result = this.auth(url, headers, parsedBody, ctx);
    else if (ctx.table && TABLES[ctx.table]) result = this.rest(url, headers, parsedBody, ctx);
    else if (url.pathname.startsWith("/functions/v1/")) {
      const name = url.pathname.slice(14);
      const fn = this.functions[name];
      result = { status: 200, body: fn ? fn(url.searchParams, parsedBody) : { results: [] } };
    } else result = { status: 404, body: { message: "audit mock: unknown path" } };
    if (rule?.afterHold) {
      result = structuredClone(result);
      entry.responseCaptured = Date.now();
      await rule.afterHold.promise;
      entry.responseReleased = Date.now();
    }
    entry.status = result.status;
    entry.completed = Date.now();
    if (result.body && typeof result.body === "object" && result.status >= 400) entry.error = result.body;
    if (rule?.mode === "network-after-commit") { entry.outcome = "committed-then-network-error"; return { destroy: true }; }
    return result;
  }

  auth(url, headers, body, ctx) {
    const p = url.pathname;
    if (p === "/auth/v1/settings") return { status: 200, body: { external: { email: true, google: false, apple: false }, disable_signup: false } };
    if (p === "/auth/v1/user") {
      const role = this.roleFor(headers);
      if (role.role !== "authenticated") return { status: 401, body: { code: 401, error_code: "bad_jwt", msg: "invalid JWT" } };
      return { status: 200, body: this.users.get(role.sub) };
    }
    if (p === "/auth/v1/token") {
      const rt = body?.refresh_token;
      const s = this.sessions.get(rt);
      if (!s || s.revoked) return { status: 400, body: { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" } };
      s.revoked = true; // rotation
      return { status: 200, body: this.issueSession(s.userId) };
    }
    if (p === "/auth/v1/logout") {
      const role = this.roleFor(headers);
      if (role.sub) this.revokeUserSessions(role.sub);
      return { status: 204, body: null };
    }
    if (p === "/auth/v1/otp") return { status: 200, body: {} };
    return { status: 404, body: { msg: "audit mock auth path" } };
  }

  rest(url, headers, body, ctx) {
    const table = ctx.table;
    const role = ctx.role;
    if (role.role === "expired") return { status: 401, body: { code: "PGRST303", message: "JWT expired" } };
    const sp = url.searchParams;
    const filters = this.parseFilters(sp);
    const prefer = String(headers.prefer || "");
    const accept = String(headers.accept || "");
    const select = sp.get("select");
    const project = (rows, cols) => {
      const want = select && select !== "*" ? select.split(",").map((s) => s.trim()) : null;
      return rows.map((r) => {
        let out = { ...r };
        if (cols) out = Object.fromEntries(cols.map((c) => [c, r[c]]));
        if (want) out = Object.fromEntries(want.map((c) => [c, out[c]]));
        return out;
      });
    };
    const respond = (rows, status, cols) => {
      const data = project(rows, cols);
      if (accept.includes("vnd.pgrst.object+json")) {
        if (data.length !== 1) return { status: 406, body: { code: "PGRST116", details: `The result contains ${data.length} rows`, message: "JSON object requested, multiple (or no) rows returned" } };
        return { status, body: data[0] };
      }
      return { status, body: data };
    };
    const opName = ctx.method === "GET" ? "select" : ctx.method === "POST" ? "insert" : ctx.method === "PATCH" ? "update" : "delete";
    const vis = this.visible(table, role, opName);
    if (vis.denied) return { status: role.role === "anon" ? 401 : 403, body: { code: "42501", message: `permission denied for table ${table}` } };
    if (ctx.method === "GET") {
      let rows = this.applyFilters(this.db[table].filter(vis.filter), filters);
      const order = sp.get("order");
      if (order) { const [col, dir] = order.split("."); rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1)); }
      const limit = sp.get("limit"); if (limit) rows = rows.slice(0, Number(limit));
      return respond(rows, 200, vis.columns);
    }
    if (ctx.method === "POST") {
      const input = Array.isArray(body) ? body : [body];
      const merge = prefer.includes("resolution=merge-duplicates");
      const conflictCols = (sp.get("on_conflict") || TABLES[table].pk.join(",")).split(",");
      const staged = this.db[table].map((r) => ({ ...r }));
      const affected = [];
      for (const raw of input) {
        const row = this.normalizeRow(table, raw);
        if (TABLES[table].owned || table.endsWith("shared_lists")) {
          if (role.role !== "authenticated" || row.list_id !== `user:${role.sub}`) return { status: 403, body: { code: "42501", message: `new row violates row-level security policy for table "${table}"` } };
        }
        const bad = this.checkConstraints(table, row); if (bad) return bad;
        const idx = staged.findIndex((r) => conflictCols.every((c) => r[c] === row[c]));
        const uniqueClash = (TABLES[table].unique || []).some((cols) => staged.some((r, i) => i !== idx && cols.every((c) => r[c] === row[c])));
        if (idx >= 0 && !merge) return { status: 409, body: { code: "23505", message: "duplicate key value violates unique constraint" } };
        if (uniqueClash) return { status: 409, body: { code: "23505", message: "duplicate key value violates unique constraint (list_id, category)" } };
        if (idx >= 0) {
          if (!vis.filter(staged[idx])) return { status: 403, body: { code: "42501", message: "row-level security (update using)" } };
          staged[idx] = { ...staged[idx], ...row };
          affected.push(staged[idx]);
        } else { staged.push(row); affected.push(row); }
      }
      this.db[table] = staged; // statement is atomic
      return prefer.includes("return=representation") ? respond(affected, 201) : { status: 201, body: null };
    }
    if (ctx.method === "PATCH") {
      const targets = this.applyFilters(this.db[table].filter(vis.filter), filters);
      const updated = [];
      for (const t of targets) {
        const next = this.normalizeRow(table, { ...t, ...body });
        if (TABLES[table].owned || table.endsWith("shared_lists")) {
          if (next.list_id !== `user:${role.sub}`) return { status: 403, body: { code: "42501", message: "with check" } };
        }
        const bad = this.checkConstraints(table, next); if (bad) return bad;
        const uniqueClash = (TABLES[table].unique || []).some((cols) => this.db[table].some((r) => r !== t && cols.every((c) => r[c] === next[c])));
        if (uniqueClash) return { status: 409, body: { code: "23505", message: "duplicate key" } };
        updated.push([t, next]);
      }
      for (const [t, next] of updated) { const i = this.db[table].indexOf(t); this.db[table][i] = next; }
      return prefer.includes("return=representation") ? respond(updated.map(([, n]) => n), 200) : { status: 204, body: null };
    }
    if (ctx.method === "DELETE") {
      const targets = this.applyFilters(this.db[table].filter(vis.filter), filters);
      this.db[table] = this.db[table].filter((r) => !targets.includes(r));
      return prefer.includes("return=representation") ? respond(targets, 200) : { status: 204, body: null };
    }
    return { status: 405, body: {} };
  }

  async start() {
    const server = http.createServer(async (req, res) => {
      const cors = {
        "access-control-allow-origin": req.headers.origin || "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,PUT,HEAD,OPTIONS",
        "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
        "access-control-expose-headers": "content-range, x-supabase-api-version",
        "access-control-max-age": "0",
      };
      if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let result;
        try { result = await this.handle(req, body); } catch (e) { result = { status: 500, body: { message: String(e && e.stack || e) } }; }
        if (result.destroy) { req.socket.destroy(); return; }
        const h = { ...cors, "content-type": "application/json" };
        if (Array.isArray(result.body)) h["content-range"] = `0-${Math.max(0, result.body.length - 1)}/${result.body.length}`;
        res.writeHead(result.status, h);
        res.end(result.body === null || result.body === undefined ? "" : JSON.stringify(result.body));
      });
    });
    const port = await getFreePort();
    await new Promise((r) => server.listen(port, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${port}`;
    this.server = server;
    return this;
  }
  close() {
    for (const rule of this.rules) { rule.hold?.resolve(); rule.afterHold?.resolve(); }
    this.server.closeAllConnections();
    return new Promise((r) => this.server.close(r));
  }
}
function k_has(table, col) { return col === "updated_at" && !["suggestion_packs", "product_events"].includes(table); }

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

// ---------------------------------------------------------------- Chrome / CDP
const getJson = (port, route, method = "GET") => new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port, path: route, method }, (res) => {
    let d = ""; res.on("data", (c) => { d += c; }); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
  });
  req.on("error", reject); req.end();
});

const initScript = (mockUrl) => `(() => {
  const MOCK = ${JSON.stringify(mockUrl)};
  const SUPA = ${JSON.stringify(SUPABASE_ORIGIN)};
  const realFetch = window.fetch.bind(window);
  window.__auditDenied = [];
  window.__auditFetchErrors = [];
  window.fetch = async (input, init) => {
    const raw = input instanceof Request ? input.url : (input instanceof URL ? input.href : String(input));
    const u = new URL(raw, location.href);
    if (u.origin === location.origin) return realFetch(input, init);
    if (u.origin === SUPA) {
      const target = MOCK + u.pathname + u.search;
      let opts = init || {};
      if (input instanceof Request) {
        const body = ['GET', 'HEAD'].includes(input.method) ? undefined : await input.clone().arrayBuffer();
        opts = { method: input.method, headers: input.headers, body, signal: input.signal, ...(init || {}) };
      }
      try { return await realFetch(target, opts); }
      catch (e) { window.__auditFetchErrors.push(String(e) + ' ' + u.pathname); throw e; }
    }
    window.__auditDenied.push(u.origin + u.pathname);
    throw new TypeError('audit: external request denied ' + u.origin);
  };
})();`;

async function connectTarget(wsUrl, label, sharedLog) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  let id = 0;
  const pending = new Map();
  const events = [];
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`)); else resolve(msg.result || {});
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") events.push({ tab: label, type: "console", level: msg.params.type, text: (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400) });
    if (msg.method === "Runtime.exceptionThrown") events.push({ tab: label, type: "exception", text: msg.params.exceptionDetails?.exception?.description?.slice(0, 400) || msg.params.exceptionDetails?.text });
    if (msg.method === "Network.loadingFailed") events.push({ tab: label, type: "netfail", text: msg.params.errorText, blocked: msg.params.blockedReason || "" });
    if (msg.method === "Network.requestWillBeSent") {
      const u = msg.params.request.url;
      if (!u.startsWith("http://127.0.0.1") && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) sharedLog.push({ tab: label, attemptedExternal: u.slice(0, 200) });
    }
    if (msg.method === "Page.javascriptDialogOpening") {
      events.push({ tab: label, type: "dialog", dialog: msg.params.type, text: msg.params.message });
      const accept = typeof page.onDialog === "function" ? page.onDialog(msg.params) : true;
      send("Page.handleJavaScriptDialog", { accept }).catch(() => {});
    }
    listeners.forEach((fn) => fn(msg));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    const timeout = setTimeout(() => { pending.delete(mid); reject(new Error(`${label}: CDP ${method} timed out`)); }, 20000);
    pending.set(mid, { resolve: v => { clearTimeout(timeout); resolve(v); }, reject: e => { clearTimeout(timeout); reject(e); } });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${label}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result?.value;
  };
  const page = { label, ws, send, evaluate, events, onDialog: null, listeners };
  page.waitFor = async (expression, timeoutMs = 10000, what = expression) => {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeoutMs) {
      try { last = await evaluate(expression); if (last) return last; } catch (e) { last = e.message; }
      await wait(60);
    }
    throw new Error(`${label}: timed out waiting for ${String(what).slice(0, 200)} (last=${JSON.stringify(last)?.slice(0, 200)})`);
  };
  page.navigate = async (url) => {
    const marker = `navigation-${Date.now()}-${Math.random()}`;
    await evaluate(`window.__previousDocument = ${JSON.stringify(marker)}`).catch(() => {});
    const result = await send("Page.navigate", { url });
    if (result.errorText) throw new Error(result.errorText);
    await page.waitFor(`window.__previousDocument !== ${JSON.stringify(marker)} && document.readyState === 'complete'`, 15000, "new document complete");
  };
  page.localStorage = () => evaluate("JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])))").then(JSON.parse);
  page.close = async () => { try { ws.close(); } catch (_) {} };
  return page;
}

async function launchBrowser({ name, mockUrl, appUrl }) {
  if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome/Chromium executable");
  fs.mkdirSync(PROFILE_ROOT, { recursive: true });
  const profile = path.join(PROFILE_ROOT, `${name}-${Date.now()}`);
  const downloads = path.join(profile, "downloads");
  fs.mkdirSync(downloads, { recursive: true });
  const port = await getFreePort();
  const proc = spawn(CHROME, [
    "--headless=new", ...(process.platform === "linux" ? ["--no-sandbox"] : []), "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
    "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-default-apps",
    "--disable-domain-reliability", "--metrics-recording-only", "--no-pings", "--disable-features=OptimizationHints,MediaRouter,Translate",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--window-size=1280,900", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = ""; proc.stderr.on("data", (c) => { stderr = (stderr + c).slice(-3000); });
  let first = null;
  for (let i = 0; i < 150 && !first; i += 1) {
    try { const tabs = await getJson(port, "/json/list"); first = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl); } catch (_) {}
    if (!first) await wait(100);
  }
  if (!first) { proc.kill("SIGKILL"); throw new Error(`chrome did not start: ${stderr}`); }
  const external = [];
  const pages = [];
  const setup = async (target, label) => {
    const page = await connectTarget(target.webSocketDebuggerUrl, label, external);
    await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Network.enable");
    await page.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
    // DNS rules cannot block IP literals. CDP allowlists both loopback servers
    // and blocks every other URL before dispatch, including image/beacon traffic.
    await page.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    page.listeners.push(msg => {
      if (msg.method !== "Fetch.requestPaused") return;
      const { requestId, request } = msg.params;
      const u = new URL(request.url);
      const allowed = ["data:", "blob:", "about:"].includes(u.protocol) || [mockUrl, appUrl].filter(Boolean).includes(u.origin);
      if (allowed) page.send("Fetch.continueRequest", { requestId }).catch(() => {});
      else { external.push({ tab: label, blockedExternal: u.origin + u.pathname }); page.send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(() => {}); }
    });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: initScript(mockUrl) });
    pages.push(page);
    return page;
  };
  const browser = {
    name, profile, downloads, proc, external, pages,
    firstPage: () => setup(first, `${name}:tab1`),
    newTab: async (label) => { const t = await getJson(port, "/json/new?about:blank", "PUT"); return setup(t, `${name}:${label}`); },
    close: async () => {
      for (const p of pages) await p.close();
      const exited = new Promise((r) => { proc.once("exit", r); setTimeout(r, 2000); });
      proc.kill(); await exited;
      for (let i = 0; i < 5; i += 1) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch (_) { await wait(200); } }
    },
  };
  return browser;
}

// Seed origin storage before the app boots: open a blank same-origin page first.
async function seedStorage(page, baseUrl, entries, { clear = true } = {}) {
  await page.navigate(`${baseUrl}/__audit_blank`);
  await page.evaluate(`(() => { ${clear ? "localStorage.clear(); sessionStorage.clear();" : ""} const e = ${JSON.stringify(entries)}; for (const [k, v] of Object.entries(e)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; })()`);
}

// Explicit synthetic ownership seeding. Does not infer ownership from an auth
// token or migrate unowned legacy values. Use raw seedStorage for recovery tests.
async function seedOwnedStorage(page, baseUrl, { key, owner, entries = {}, remote = {} }) {
  await page.navigate(`${baseUrl}/__audit_blank`);
  const result = await page.evaluate(`(async () => {
    const { createDataSafetyStore } = await import('/lib/data-safety.js');
    const config = ${JSON.stringify({ key, owner, entries, remote })};
    const store = createDataSafetyStore({ storage: localStorage, key: config.key });
    await store.activate(config.owner);
    for (const [key, value] of Object.entries(config.entries)) store.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    for (const [surface, metadata] of Object.entries(config.remote)) store.setRemote(surface, metadata);
    return store.flush();
  })()`);
  if (!result.ok) throw new Error(`Owned fixture seed failed: ${result.status}`);
}

async function waitUntil(predicate, description, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await wait(25);
  }
  throw new Error(`Timed out: ${description}`);
}
function cleanProfiles() { fs.rmSync(PROFILE_ROOT, { recursive: true, force: true }); }
module.exports = { SOURCE_ROOT, SNAPSHOT, SUPABASE_ORIGIN, AUTH_STORAGE_KEY, wait, waitUntil, startStaticServer, MockSupabase, launchBrowser, seedStorage, seedOwnedStorage, deferred, jsonbBytes, jsonbText, cleanProfiles };
