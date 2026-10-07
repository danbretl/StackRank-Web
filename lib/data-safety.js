// Owner-isolated local persistence and optimistic remote writes. No DOM access.
const clone = (value) => JSON.parse(JSON.stringify(value));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const recoveryFingerprint = async (owner, raw, remote = {}) => {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical({ owner, raw, remote })));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyOwner = () => ({ revision: 0, raw: {}, remote: {} });
const emptyDocument = () => ({ version: 1, revision: 0, owners: {}, recoveries: [], legacyCaptured: false });
export class DataSafetyError extends Error {
  constructor(code, message) { super(message); this.name = "DataSafetyError"; this.code = code; }
}
export function createSessionGuard(initialOwner = null) {
  let owner = initialOwner;
  let generation = 0;
  return {
    change(next) { if (next !== owner) { owner = next; generation += 1; } return this.capture(); },
    invalidate() { generation += 1; return this.capture(); },
    capture: () => ({ owner, generation }),
    isCurrent: (token) => Boolean(token && token.owner === owner && token.generation === generation),
  };
}

/** One localStorage value contains every owner's raw key/value map and metadata.
 * setItem/setRemote stage changes; ONLY await flush() confirms durability.
 * Browser Web Locks serialize transactions; without locks writes fail closed.
 * Original legacy keys are retained verbatim and are never automatic inputs.
 */
export function createDataSafetyStore({
  storage = {
    getItem: (storageKey) => globalThis.localStorage.getItem(storageKey),
    setItem: (storageKey, value) => globalThis.localStorage.setItem(storageKey, value),
  },
  key,
  legacyKeys = [],
  locks = globalThis.navigator?.locks,
  onConflict = () => {},
  onError = () => {},
  maxRecoveryEntries = 8,
  maxBytes = 4 * 1024 * 1024,
} = {}) {
  if (!key) throw new TypeError("A data-safety storage key is required.");
  let owner = null;
  let generation = 0;
  let state = emptyOwner();
  let baseRevision = 0;
  let editRevision = 0;
  let flushedEditRevision = 0;
  let blocked = false;
  let document = emptyDocument();
  const memoryRecoveries = [];
  let chain = Promise.resolve();
  const capture = () => ({ owner, generation });
  const isCurrent = (token) => Boolean(token && token.owner === owner && token.generation === generation);
  const report = (error) => { try { onError(error); } catch (_) { /* UI callbacks cannot break preservation. */ } };
  const read = () => {
    const raw = storage.getItem(key);
    if (raw === null) return emptyDocument();
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { throw new DataSafetyError("unreadable", "Saved recovery data is unreadable; its original bytes have been preserved."); }
    if (!record(parsed) || parsed.version !== 1 || !record(parsed.owners) || !Array.isArray(parsed.recoveries)
      || Object.values(parsed.owners).some((entry) => !record(entry) || !record(entry.raw) || !record(entry.remote)
        || !Number.isSafeInteger(entry.revision) || Object.values(entry.raw).some((value) => typeof value !== "string"))
      || parsed.recoveries.some((entry) => !record(entry) || typeof entry.id !== "string" || !record(entry.raw) || !record(entry.remote)
        || Object.values(entry.raw).some((value) => typeof value !== "string")
        || (entry.resolvedBy !== undefined && !Array.isArray(entry.resolvedBy)))
      || (parsed.sourceReceipts !== undefined && (!Array.isArray(parsed.sourceReceipts) || parsed.sourceReceipts.some((value) => typeof value !== "string")))) {
      throw new DataSafetyError("unreadable", "Saved recovery data has an unsupported format; its original bytes have been preserved.");
    }
    return parsed;
  };
  const write = (next) => {
    const raw = JSON.stringify(next);
    if (new TextEncoder().encode(raw).length > maxBytes) throw new DataSafetyError("recovery-full", "Recovery storage is full. Download your changes before continuing.");
    storage.setItem(key, raw);
    document = next;
  };
  const locked = (operation) => {
    if (!locks?.request) return Promise.reject(new DataSafetyError("locking-unavailable", "Safe editing is unavailable in this browser. Your saved data has not been changed."));
    return locks.request(`stackrank:data-safety:${key}`, { mode: "exclusive" }, operation);
  };
  const enqueue = (operation) => {
    const pending = chain.catch(() => undefined).then(operation);
    chain = pending;
    return pending;
  };
  const addRecovery = (doc, savedOwner, savedState, reason) => {
    const existing = doc.recoveries.find((entry) => entry.owner === savedOwner && entry.reason === reason
      && equal(entry.raw, savedState.raw) && equal(entry.remote, savedState.remote));
    if (existing) return existing.id;
    if (doc.recoveries.length >= maxRecoveryEntries) throw new DataSafetyError("recovery-full", "Recovery storage is full. Download and explicitly dismiss a saved recovery before continuing.");
    const entry = { id: uid(), owner: savedOwner, reason, createdAt: new Date().toISOString(), raw: clone(savedState.raw), remote: clone(savedState.remote), resolvedBy: [] };
    doc.recoveries.push(entry);
    return entry.id;
  };
  const ensureEditable = () => {
    if (!owner) throw new DataSafetyError("owner-unresolved", "Wait for account identification before editing.");
    if (blocked) throw new DataSafetyError("conflict", "This tab is out of date. Your changes are preserved; resolve the saved copy before editing.");
  };
  const snapshot = () => ({ token: capture(), state: clone(state), baseRevision, editRevision });
  const commit = async (saved) => {
    if (!saved.token.owner) return { ok: false, status: "owner-unresolved" };
    try {
      return await locked(() => {
        const doc = read();
        const latest = doc.owners[saved.token.owner] || emptyOwner();
        if (latest.revision !== saved.baseRevision) {
          const recoveryId = addRecovery(doc, saved.token.owner, saved.state, "stale-tab");
          doc.revision += 1;
          write(doc);
          if (isCurrent(saved.token)) blocked = true;
          const result = { ok: false, status: "conflict", recoveryId };
          if (isCurrent(saved.token)) { try { onConflict(result); } catch (_) { /* Preserve the outcome. */ } }
          return result;
        }
        const next = { ...saved.state, revision: latest.revision + 1 };
        doc.owners[saved.token.owner] = next;
        doc.revision += 1;
        write(doc);
        if (isCurrent(saved.token)) {
          baseRevision = next.revision;
          state.revision = next.revision;
          flushedEditRevision = saved.editRevision;
        }
        return { ok: true, status: "saved", revision: next.revision };
      });
    } catch (error) { report(error); return { ok: false, status: error.code || "storage-error", error }; }
  };
  const visible = (entry) => owner && (entry.owner === owner || entry.owner === null || entry.owner === "anonymous");
  const recoveryById = (id) => {
    const entry = [...document.recoveries, ...memoryRecoveries].find((candidate) => candidate.id === id);
    if (!entry || !visible(entry)) throw new DataSafetyError("recovery-unavailable", "This recovery is not available for the current owner.");
    return entry;
  };
  const api = {
    capture, isCurrent,
    async activate(nextOwner) {
      if (nextOwner !== null && nextOwner !== "anonymous" && !/^user:[^\s:]+$/.test(nextOwner || "")) throw new TypeError("Invalid data owner.");
      const prior = editRevision !== flushedEditRevision && owner ? snapshot() : null;
      const activationGeneration = ++generation;
      owner = null;
      blocked = false;
      let departureError = null;
      if (prior) {
        const result = await enqueue(() => commit(prior));
        if (!result.ok && result.status !== "conflict") {
          departureError = result.error;
          memoryRecoveries.push({ id: uid(), owner: prior.token.owner, reason: "storage-unavailable", createdAt: new Date().toISOString(), raw: prior.state.raw, remote: prior.state.remote, resolvedBy: [], memoryOnly: true });
        }
      }
      if (generation !== activationGeneration) return { ok: false, status: "owner-changed" };
      let error = null;
      try {
        await enqueue(() => locked(async () => {
          const doc = read();
          const before = JSON.stringify(doc);
          doc.sourceReceipts ||= [];
          const legacyGroups = new Map();
          for (const candidate of typeof legacyKeys === "function" ? legacyKeys() : legacyKeys) {
            const entry = typeof candidate === "string" ? { key: candidate, owner: null } : candidate;
            if (!entry?.key) continue;
            const legacyOwner = entry.owner || null;
            if (legacyOwner !== null && legacyOwner !== "anonymous" && !/^user:[^\s:]+$/.test(legacyOwner)) throw new TypeError("Invalid legacy data owner.");
            const value = storage.getItem(entry.key);
            if (value === null) continue;
            const raw = legacyGroups.get(legacyOwner) || {};
            raw[entry.rawKey || entry.key] = value;
            legacyGroups.set(legacyOwner, raw);
          }
          for (const [legacyOwner, raw] of legacyGroups) {
            const receipt = `legacy:${await recoveryFingerprint(legacyOwner, raw)}`;
            if (!doc.sourceReceipts.includes(receipt)) {
              addRecovery(doc, legacyOwner, { raw, remote: {} }, legacyOwner ? "legacy-owned" : "legacy-unowned");
              doc.sourceReceipts.push(receipt);
            }
          }
          if (nextOwner?.startsWith("user:") && Object.keys(doc.owners.anonymous?.raw || {}).length) {
            const anonymous = doc.owners.anonymous;
            const receipt = `anonymous:${await recoveryFingerprint("anonymous", anonymous.raw, anonymous.remote)}`;
            if (!doc.sourceReceipts.includes(receipt)) {
              addRecovery(doc, "anonymous", anonymous, "anonymous-consent");
              doc.sourceReceipts.push(receipt);
            }
          }
          doc.legacyCaptured = true;
          if (JSON.stringify(doc) !== before) { doc.revision += 1; write(doc); }
          else document = doc;
        }));
      } catch (caught) {
        error = caught;
        report(caught);
        try { document = read(); } catch (_) { document = emptyDocument(); }
      }
      if (generation !== activationGeneration) return { ok: false, status: "owner-changed" };
      owner = nextOwner;
      state = clone(owner ? document.owners[owner] || emptyOwner() : emptyOwner());
      baseRevision = state.revision;
      editRevision = 0;
      flushedEditRevision = 0;
      blocked = Boolean(error);
      return { ok: !error, status: error?.code || "ready", error, warning: departureError };
    },
    getItem(rawKey) { return owner ? state.raw[rawKey] ?? null : null; },
    setItem(rawKey, value) {
      ensureEditable();
      const raw = String(value);
      if (state.raw[rawKey] === raw) return;
      state.raw[rawKey] = raw; editRevision += 1;
    },
    removeItem(rawKey) { ensureEditable(); if (!(rawKey in state.raw)) return; delete state.raw[rawKey]; editRevision += 1; },
    getRemote(surface) { return clone(state.remote[surface] || { known: false, dirty: Boolean(state.recoveryPending) }); },
    setRemote(surface, metadata) {
      ensureEditable();
      if (equal(state.remote[surface], metadata)) return;
      state.remote[surface] = clone(metadata); editRevision += 1;
    },
    markDirty(surface) {
      ensureEditable();
      state.remote[surface] = { ...api.getRemote(surface), dirty: true, revision: uid() };
      editRevision += 1;
      return state.remote[surface].revision;
    },
    acknowledge(surface, { revision, baseline }) {
      ensureEditable();
      const previous = api.getRemote(surface);
      api.setRemote(surface, { ...previous, ...clone(baseline), dirty: previous.revision !== revision });
    },
    flush() {
      const token = capture();
      return enqueue(async () => {
        if (!isCurrent(token)) return { ok: false, status: "owner-changed" };
        if (blocked) return { ok: false, status: "conflict" };
        if (editRevision === flushedEditRevision) return { ok: true, status: "unchanged" };
        return commit(snapshot());
      });
    },
    async preserve(reason = "manual-recovery") {
      const saved = snapshot();
      try {
        return await enqueue(() => locked(() => {
          const doc = read();
          const recoveryId = addRecovery(doc, saved.token.owner, saved.state, reason);
          doc.revision += 1;
          write(doc);
          return { ok: true, status: "preserved", recoveryId };
        }));
      } catch (error) { report(error); return { ok: false, status: error.code || "storage-error", error }; }
    },
    listRecoveries({ includeResolved = false } = {}) {
      try { document = read(); } catch (_) { /* Rendering recovery controls must not recursively notify UI. */ }
      return [...document.recoveries, ...memoryRecoveries].filter((entry) => visible(entry) && (includeResolved || !entry.resolvedBy?.includes(owner)))
        .map((entry) => ({ id: entry.id, reason: entry.reason, owner: entry.owner, createdAt: entry.createdAt, keyCount: Object.keys(entry.raw).length, resolved: entry.resolvedBy?.includes(owner) || false, memoryOnly: entry.memoryOnly === true }));
    },
    readRecovery(id) { return clone(recoveryById(id)); },
    async recover(id, { mode, merge } = {}) {
      if (!owner) return { ok: false, status: "owner-unresolved" };
      if (!["replace", "merge"].includes(mode) || (mode === "merge" && typeof merge !== "function")) throw new TypeError("Recovery requires an explicit replace or merge choice.");
      const token = capture();
      try {
        return await enqueue(() => locked(() => {
          if (!isCurrent(token)) return { ok: false, status: "owner-changed" };
          const doc = read();
          document = doc;
          const entry = recoveryById(id);
          const latest = doc.owners[owner] || emptyOwner();
          const raw = mode === "merge" ? merge(clone(latest.raw), clone(entry.raw)) : clone(entry.raw);
          if (!record(raw) || Object.values(raw).some((value) => typeof value !== "string")) throw new TypeError("Recovery must produce a raw string map.");
          if (Object.keys(latest.raw).length && !equal(latest.raw, raw)) addRecovery(doc, owner, latest, "before-recovery");
          const remote = Object.fromEntries(Object.keys({ ...latest.remote, ...entry.remote }).map((surface) => [surface, { known: false, dirty: true, revision: uid() }]));
          const nextState = { raw, remote, revision: latest.revision + 1, recoveryPending: true };
          doc.owners[owner] = clone(nextState);
          const resolvedBy = [...new Set([...(entry.resolvedBy || []), owner])];
          if (!entry.memoryOnly) entry.resolvedBy = resolvedBy;
          doc.revision += 1;
          write(doc);
          if (entry.memoryOnly) entry.resolvedBy = resolvedBy;
          state = nextState;
          baseRevision = state.revision;
          editRevision = 0;
          flushedEditRevision = 0;
          blocked = false;
          return { ok: true, status: "recovered" };
        }));
      } catch (error) { report(error); return { ok: false, status: error.code || "storage-error", error }; }
    },
    async dismissRecovery(id) {
      const token = capture();
      try {
        return await enqueue(() => locked(() => {
          if (!isCurrent(token)) return { ok: false, status: "owner-changed" };
          const doc = read(); document = doc; recoveryById(id);
          doc.recoveries = doc.recoveries.filter((entry) => entry.id !== id);
          doc.revision += 1; write(doc);
          const memoryIndex = memoryRecoveries.findIndex((entry) => entry.id === id);
          if (memoryIndex >= 0) memoryRecoveries.splice(memoryIndex, 1);
          return { ok: true, status: "dismissed" };
        }));
      } catch (error) { report(error); return { ok: false, status: error.code || "storage-error", error }; }
    },
  };
  return api;
}

export function planReconciliation({ baseline, dirty, localValue, remoteValue, remoteVersion, remoteExists }) {
  if (equal(localValue, remoteValue)) return "adopt-remote";
  if (!dirty) return "adopt-remote";
  if (!baseline?.known) return "conflict";
  if (Boolean(baseline.exists) !== Boolean(remoteExists)) return "conflict";
  return !remoteExists || baseline.updatedAt === remoteVersion ? "write-local" : "conflict";
}

export function nextRemoteVersion(previous, now = Date.now()) {
  const prior = Date.parse(previous || "");
  return new Date(Math.max(now, Number.isFinite(prior) ? prior + 1 : now)).toISOString();
}
const applyIdentity = (query, identity) => Object.entries(identity).reduce((builder, [field, value]) => builder.eq(field, value), query);
async function timedRequest(build, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => build(controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new DataSafetyError("timeout", "The account request timed out.")); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
/** baseline is the last successfully read/acknowledged exact server token.
 * An error/timeout may follow a commit; readback confirms only this attempted
 * token AND payload, never blindly overwrites a newly observed account copy.
 */
export async function compareAndSwapRow({ client, table, identity, baseline, values, timeoutMs = 10000 }) {
  if (!baseline?.known) return { status: "conflict", error: new DataSafetyError("baseline-unknown", "Read the account copy before saving.") };
  if (!record(identity) || !Object.keys(identity).length) throw new TypeError("Remote identity filters are required.");
  if (baseline.exists && (typeof baseline.updatedAt !== "string" || !Number.isFinite(Date.parse(baseline.updatedAt)))) return { status: "conflict", error: new DataSafetyError("baseline-invalid", "The account version is invalid.") };
  const attempted = clone({ ...values, ...identity, updated_at: nextRemoteVersion(baseline.updatedAt) });
  const matchesAttempt = (row) => {
    const fraction = (value) => (String(value).match(/\.(\d+)/)?.[1] || "").padEnd(9, "0");
    return row && Date.parse(row.updated_at) === Date.parse(attempted.updated_at)
      && fraction(row.updated_at) === fraction(attempted.updated_at)
      && Object.entries(attempted).every(([field, value]) => field === "updated_at" || equal(row[field], value));
  };
  let error;
  try {
    const result = await timedRequest((signal) => {
      const query = baseline.exists
        ? applyIdentity(client.from(table).update(attempted), identity).eq("updated_at", baseline.updatedAt)
        : client.from(table).insert(attempted);
      return query.select().abortSignal(signal);
    }, timeoutMs);
    if (!result.error && Array.isArray(result.data) && result.data.length === 1 && matchesAttempt(result.data[0])) return { status: "synced", row: result.data[0] };
    // A client/transport retry can return zero rows after its first attempt
    // committed. Read back the attempted token before declaring a conflict.
    error = result.error || (Array.isArray(result.data) && result.data.length === 0
      ? new DataSafetyError("stale-version", "The account version no longer matches this save.")
      : new DataSafetyError("invalid-response", "The account did not confirm the saved snapshot."));
  } catch (caught) { error = caught; }
  try {
    const result = await timedRequest((signal) => applyIdentity(client.from(table).select(), identity).maybeSingle().abortSignal(signal), timeoutMs);
    if (result.error) return { status: "error", error };
    const row = result.data;
    if (matchesAttempt(row)) return { status: "synced", row, recoveredResponse: true };
    const unchanged = baseline.exists
      ? row?.updated_at === baseline.updatedAt
      : row === null;
    return unchanged && error?.code !== "stale-version"
      ? { status: "error", error, row } : { status: "conflict", error, row };
  } catch (_) { return { status: "error", error }; }
}
