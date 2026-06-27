// Single-level undo controller — the lifecycle behind the "Undo" action toast.
//
// The app offers a short-lived undo for list changes (save/hide a suggestion,
// move or remove a queued movie, remove from the ranking, clear the ranking).
// Only one undo is live at a time: a newer undoable action replaces the older
// one. This module owns that lifecycle — store one entry, hand its restore
// function back exactly once, and refuse it when stale or expired — so the rules
// ("single use", "newest replaces", "expires with the toast") are unit-testable.
//
// It is intentionally DOM-free and app-state-free: the entry's `restore` is an
// opaque function supplied by app.js (where it can reassign the live `ranking` /
// `watchList` / `notInterestedList` arrays). The controller never calls it; it
// only decides whether the caller is allowed to.

export function createUndoController({ now = () => Date.now() } = {}) {
  let entry = null; // { label, restore, expiresAt, token }
  let counter = 0;

  const isExpired = (e) => !e || e.expiresAt <= now();

  return {
    // Register a new undoable action, replacing any previous one. Returns a
    // token the caller passes back to consume(), so a click on a stale toast
    // button (whose entry was already replaced) is rejected.
    set({ label, restore, ttlMs }) {
      if (typeof restore !== "function") {
        throw new TypeError("undo entry requires a restore function");
      }
      const token = ++counter;
      entry = { label, restore, expiresAt: now() + ttlMs, token };
      return token;
    },

    // Is there a live (unexpired, unconsumed) undo right now?
    isActive() {
      if (isExpired(entry)) {
        entry = null;
        return false;
      }
      return true;
    },

    // Non-destructive look at the current entry, or null if none/expired.
    peek() {
      if (isExpired(entry)) {
        entry = null;
        return null;
      }
      return { label: entry.label, token: entry.token };
    },

    // Take the restore function for a single use. Returns null if there is no
    // live entry, if it has expired, or if `token` doesn't match the current
    // entry (a stale/replaced toast button). Consuming clears the entry, so a
    // second call returns null.
    consume(token) {
      if (isExpired(entry)) {
        entry = null;
        return null;
      }
      if (token != null && token !== entry.token) {
        return null;
      }
      const { restore } = entry;
      entry = null;
      return restore;
    },

    clear() {
      entry = null;
    },
  };
}
