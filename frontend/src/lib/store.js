import { makeSeed, PREFS_KEY, STORE_KEY } from "./model";

const IDB_NAME = "vite-biobuzz";
const IDB_STORE = "kv";

function idb() {
  return new Promise((resolve, reject) => {
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
  } catch {
    /* IndexedDB may be blocked; localStorage remains the live copy. */
  }
}

export function defaultPrefs() {
  return {
    cookie: { decided: false, storage: false, shownAt: null },
    age: { confirmed: false, over13: false, guardian: false },
    displayName: "",
    lang: null, // null = not chosen yet (shows language picker)
  };
}

// Language and chosen event are per-visit: kept in sessionStorage, so a reload keeps them
// but opening the site again (new tab / reopened app) asks for language and event again.
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
  try {
    const x = JSON.parse(localStorage.getItem(PREFS_KEY));
    if (x && typeof x === "object") {
      const { lang: _lang, event: _event, ...stored } = x; // never restore these from long-term storage
      return {
        ...defaultPrefs(),
        ...stored,
        cookie: { ...defaultPrefs().cookie, ...(stored.cookie || {}) },
        age: { ...defaultPrefs().age, ...(stored.age || {}) },
        lang: session.lang ?? null,
        event: session.event,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...defaultPrefs(), lang: session.lang ?? null, event: session.event };
}

export function savePrefs(prefs) {
  const { lang, event, ...persistent } = prefs;
  localStorage.setItem(PREFS_KEY, JSON.stringify(persistent));
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ lang, event }));
  } catch {
    /* ignore */
  }
}

export function loadDb(allowStorage) {
  if (!allowStorage) return makeSeed();
  try {
    const x = JSON.parse(localStorage.getItem(STORE_KEY));
    if (x && Array.isArray(x.teams) && Array.isArray(x.records)) return x;
  } catch {
    /* ignore */
  }
  const seed = makeSeed();
  localStorage.setItem(STORE_KEY, JSON.stringify(seed));
  idbSet(STORE_KEY, seed);
  return seed;
}

export function persistDb(db, allowStorage) {
  if (!allowStorage) return;
  const next = { ...db, meta: { ...db.meta, updatedAt: new Date().toISOString() } };
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  idbSet(STORE_KEY, next);
}

export function wipeAll() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(PREFS_KEY);
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

export const CSV_COLUMNS = [
  "teamNumber",
  "eventCode",
  "eventName",
  "matchNo",
  "date",
  "autoLeave",
  "autoPark",
  "autoHiveTips",
  "teleopHiveTips",
  "cellItems",
  "flowerPlaced",
  "ownedFlowerItems",
  "bottomNectar",
  "gardenItems",
  "teleopPark",
  "penalties",
  "disabled",
  "confidence",
  "scout",
  "notes",
  "autoTrajectory",
  "pollenCycleSec",
  "nectarCycleSec",
  "hiveSuccess",
  "flowerAccuracy",
];

export function csvEsc(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function parseCSV(text) {
  const out = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (row.some((x) => x !== "")) out.push(row);
      row = [];
    } else field += c;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((x) => x !== "")) out.push(row);
  if (!out.length) return [];
  const keys = out.shift().map((x) => x.trim().replace(/^\ufeff/, ""));
  return out.map((line) => Object.fromEntries(keys.map((k, i) => [k, (line[i] ?? "").trim()])));
}

export function bool(v) {
  return ["1", "true", "yes", "да", "y"].includes(String(v || "").trim().toLowerCase());
}

export function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
}
