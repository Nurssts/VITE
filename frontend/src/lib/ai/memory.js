// Local AI workspace: conversation threads, durable memory facts and answer feedback.
// Lives only on this device (same consent as scouting data). Subscribable for React.
const KEY = "vite-ai-v1";
const MAX_THREADS = 30;
const MAX_MEMORY = 40;

let persist = false;
let state = load();
const listeners = new Set();

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(KEY));
    if (x && Array.isArray(x.threads)) return { threads: x.threads, memory: Array.isArray(x.memory) ? x.memory : [], feedback: x.feedback || {} };
  } catch {
    /* ignore */
  }
  return { threads: [], memory: [], feedback: {} };
}

function save() {
  if (persist) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full: drop the oldest threads and try once more
      state = { ...state, threads: state.threads.slice(0, 10) };
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* give up silently; the chat still works in memory */
      }
    }
  }
  listeners.forEach((l) => l());
}

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const aiStore = {
  setPersist(on) {
    persist = Boolean(on);
    if (!persist) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    } else save();
  },
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,

  newThread(title = "") {
    const t = { id: uid(), title: title.slice(0, 80), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
    state = { ...state, threads: [t, ...state.threads].slice(0, MAX_THREADS) };
    save();
    return t;
  },
  updateThread(id, patch) {
    state = { ...state, threads: state.threads.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)) };
    save();
  },
  deleteThread(id) {
    state = { ...state, threads: state.threads.filter((t) => t.id !== id) };
    save();
  },
  clearThreads() {
    state = { ...state, threads: [] };
    save();
  },

  addMemory(text) {
    const clean = String(text || "").trim().slice(0, 300);
    if (!clean || state.memory.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return null;
    const item = { id: uid(), text: clean, createdAt: new Date().toISOString() };
    state = { ...state, memory: [item, ...state.memory].slice(0, MAX_MEMORY) };
    save();
    return item;
  },
  deleteMemory(id) {
    state = { ...state, memory: state.memory.filter((m) => m.id !== id) };
    save();
  },

  setFeedback(key, value) {
    const feedback = { ...state.feedback };
    if (value) feedback[key] = value;
    else delete feedback[key];
    state = { ...state, feedback };
    save();
  },
};
