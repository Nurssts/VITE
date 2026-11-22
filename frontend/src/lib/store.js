// Persistence: localStorage is the live copy, IndexedDB a second copy used for recovery.
// Nothing leaves the device. Writes never throw into the UI: failures are reported via the
// returned status so the app can warn the user (e.g. storage full).
import { emptyDb, migrateDb } from "./db";
import { makeSeed, PREFS_KEY, STORE_KEY } from "./model";

const IDB_NAME = "vite-biobuzz";
const IDB_STORE = "kv";

function idb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  try {
    const db = await idb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* IndexedDB may be blocked (private mode); localStorage remains the live copy. */
  }
}

/** Second copy (IndexedDB). Resolves to null when there is none. */
export async function readBackup() {
  try {
    const db = await idb();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(STORE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value ? migrateDb(value) : null;
  } catch {
    return null;
  }
}

export function defaultPrefs() {
  return {
    cookie: { decided: false, storage: false, shownAt: null },
    age: { confirmed: false, over13: false, guardian: false },
    displayName: "",
    myTeam: "",
    aiConsent: false, // explicit opt-in before anything is sent to an AI provider
    aiShareNotes: true,
    lang: null, // null = not chosen yet (shows language picker)
  };
}

// Language and chosen event are per-visit (sessionStorage): a reload keeps them, a new visit asks
// again. The last choices are remembered (lastLang / lastEvent) to offer one-click "continue".
const SESSION_KEY = "vite-biobuzz-session-v1";

function readSession() {
  try {
    const x = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return x && typeof x === "object" ? x : {};
  } catch {
    return {};
  }
}

export function loadPrefs() {
  const session = readSession();
  let stored = {};
  try {
    const x = JSON.parse(localStorage.getItem(PREFS_KEY));
    if (x && typeof x === "object") {
      const { lang: _lang, event: _event, ...rest } = x; // never restore these from long-term storage
      stored = rest;
    }
  } catch {
    /* ignore */
  }
  const d = defaultPrefs();
  return {
    ...d,
    ...stored,
    cookie: { ...d.cookie, ...(stored.cookie || {}) },
    age: { ...d.age, ...(stored.age || {}) },
    lang: session.lang ?? null,
    event: session.event,
  };
}

export function savePrefs(prefs) {
  const { lang, event, ...persistent } = prefs;
  const remember = { ...persistent, lastLang: lang || persistent.lastLang || null, lastEvent: event?.set ? event : persistent.lastEvent || null };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(remember));
  } catch {
    /* storage blocked: prefs live for this tab only */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ lang, event }));
  } catch {
    /* ignore */
  }
  return remember;
}

/** Returns { db, source } where source is "local" | "seed" | "corrupt". */
export function loadDb(allowStorage) {
  if (!allowStorage) return { db: makeSeed(), source: "seed" };
  let raw;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return { db: makeSeed(), source: "seed" };
  }
  if (!raw) return { db: makeSeed(), source: "seed" };
  try {
    return { db: migrateDb(JSON.parse(raw)), source: "local" };
  } catch {
    // Keep the broken copy for manual recovery instead of overwriting it.
    try {
      localStorage.setItem(`${STORE_KEY}-corrupt-${Date.now()}`, raw);
    } catch {
      /* ignore */
    }
    return { db: makeSeed(), source: "corrupt" };
  }
}

/** Writes both copies. Returns { ok, error? }. */
export function persistDb(db, allowStorage) {
  if (!allowStorage) return { ok: true, skipped: true };
  const next = { ...db, meta: { ...db.meta, updatedAt: new Date().toISOString() } };
  idbSet(STORE_KEY, next);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    return { ok: true, savedAt: next.meta.updatedAt };
  } catch (error) {
    return { ok: false, error: error?.name === "QuotaExceededError" ? "quota" : "blocked" };
  }
}

/** Ask the browser not to evict our storage under pressure (no prompt in Chromium/Firefox). */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return e ? { usage: e.usage || 0, quota: e.quota || 0, persisted: Boolean(persisted) } : null;
  } catch {
    return null;
  }
}

export function wipeAll() {
  for (const key of [STORE_KEY, PREFS_KEY, "vite-ai-v1"]) { // vite-ai-v1 = AI chats and memory (lib/ai/memory.js)
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    indexedDB.deleteDatabase(IDB_NAME);
  } catch {
    /* ignore */
  }
}

export { emptyDb };
