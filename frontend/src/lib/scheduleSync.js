// Automatic sync of the official schedule and results (FTCScout via the VITE server).
// - loads as soon as a real event is selected or the app opens
// - refreshes every 2 minutes while the tab is visible and online, so live results arrive
//   without any button (the server caches FTCScout for 60 s, so this is cheap)
// - failures are silent: VITE stays offline-first and keeps the last saved schedule
import { useEffect, useRef, useSyncExternalStore } from "react";
import { api } from "./api";
import { applySchedule } from "./db";

export const REFRESH_MS = 2 * 60 * 1000;

let state = { loading: false, error: "", syncedAt: 0, code: "", empty: false };
const listeners = new Set();
let inflight = null;

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function seasonOf(db) {
  return (String(db.meta?.season || "").match(/\d{4}/) || ["2026"])[0];
}

const canSync = (db) => Boolean(db?.meta?.eventCode) && !db.meta.demo;

/**
 * Fetch the schedule for the current event and merge it into the database.
 * Concurrent calls share one request. Resolves to {ok, changed, matches, error}.
 */
export function syncSchedule(getDb, setDb) {
  const db = getDb();
  if (!canSync(db)) return Promise.resolve({ ok: false, skipped: true });
  if (inflight) return inflight;
  const code = db.meta.eventCode;
  const season = seasonOf(db);
  set({ loading: true, error: "", code });
  inflight = api
    .eventMatches(season, code)
    .then((data) => {
      const matches = data.matches || [];
      if (getDb().meta.eventCode !== code) return { ok: false, skipped: true }; // event switched meanwhile
      if (!matches.length) {
        set({ loading: false, syncedAt: Date.now(), empty: true });
        return { ok: true, changed: false, matches: 0 };
      }
      const cur = getDb();
      const preview = applySchedule(cur, { season, eventCode: code, matches });
      const changed = !(
        cur.schedule?.eventCode === code &&
        JSON.stringify(cur.schedule.matches) === JSON.stringify(preview.schedule.matches) &&
        cur.teams.length === preview.teams.length
      );
      // Unchanged results do not rewrite storage or re-render the app.
      if (changed) setDb((x) => (x.meta.eventCode === code ? applySchedule(x, { season, eventCode: code, matches }) : x));
      set({ loading: false, syncedAt: Date.now(), empty: false });
      return { ok: true, changed, matches: matches.length };
    })
    .catch((err) => {
      set({ loading: false, error: err.message || "network error" });
      return { ok: false, error: err.message };
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useScheduleSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state
  );
}

/** Mount once in App: initial load + periodic refresh while a real event is open. */
export function useScheduleSync(db, setDb, active) {
  const dbRef = useRef(db);
  dbRef.current = db;
  const code = active && canSync(db) ? db.meta.eventCode : "";

  useEffect(() => {
    if (!code) return undefined;
    const getDb = () => dbRef.current;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const d = getDb();
      const sched = d.schedule?.eventCode === code ? d.schedule : null;
      // Stop polling once every match of the event has been played.
      if (sched && sched.matches.length && sched.matches.every((m) => m.played) && state.syncedAt) return;
      syncSchedule(getDb, setDb);
    };
    tick();
    const timer = setInterval(tick, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && Date.now() - state.syncedAt > REFRESH_MS && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", tick);
    };
  }, [code, setDb]);
}
