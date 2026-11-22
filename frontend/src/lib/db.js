// Data layer of VITE: schema, validation/migration and pure operations on the local database.
// Every operation returns a NEW db object (never mutates), so React state and the model caches
// in model.js stay consistent. All imports (JSON backup, CSV, other scouts' files) go through
// normalizeRecord/normalizeTeam, so broken or hostile files cannot put bad types into the store.

import { bool, csvCell, parseCSV } from "./csv";

export const DB_VERSION = 3;

export const COUNT_FIELDS = ["autoHiveTips", "teleopHiveTips", "cellItems", "flowerPlaced", "ownedFlowerItems", "bottomNectar", "gardenItems", "penalties"];
export const OPTIONAL_FIELDS = ["pollenCycleSec", "nectarCycleSec", "hiveSuccess", "flowerAccuracy"];
export const FLAG_FIELDS = ["autoLeave", "autoPark", "teleopPark", "disabled"];
export const TRAJECTORIES = ["unknown", "left", "center", "right", "wall"];
export const CONFIDENCE = ["high", "medium", "low"];

export const SCOUTING_COLUMNS = [
  "teamNumber", "eventCode", "eventName", "matchNo", "date",
  "autoLeave", "autoPark", "autoHiveTips", "teleopHiveTips", "cellItems", "flowerPlaced", "ownedFlowerItems",
  "bottomNectar", "gardenItems", "teleopPark", "penalties", "disabled", "confidence", "scout", "notes",
  "autoTrajectory", "pollenCycleSec", "nectarCycleSec", "hiveSuccess", "flowerAccuracy",
];

const MAX_TEXT = 2000;

export function newId(prefix = "r") {
  const rnd = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rnd}`;
}

const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const int = (v, max = 999) => {
  const n = Math.round(Number(String(v ?? "").replace(",", ".")));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};
const optNum = (v, max = 1000) => {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : "";
};
const flag = (v) => (typeof v === "boolean" ? v : bool(v));
const today = () => new Date().toISOString().slice(0, 10);

export function emptyDb(meta = {}) {
  return {
    version: DB_VERSION,
    meta: { demo: false, eventName: "", eventCode: "", season: "2026-2027", updatedAt: new Date().toISOString(), ...meta },
    teams: [],
    records: [],
    draft: { captain: "", picked: [], removed: [] },
    schedule: null,
  };
}

export function normalizeTeam(t) {
  const number = str(t?.number ?? t?.id, 20);
  if (!number) return null;
  return {
    id: str(t.id, 40) || number,
    number,
    name: str(t.name, 120),
    region: str(t.region, 120),
    style: str(t.style, 60),
    notes: str(t.notes, MAX_TEXT),
  };
}

export function normalizeRecord(r) {
  if (!r || typeof r !== "object") return null;
  const teamId = str(r.teamId, 40);
  if (!teamId) return null;
  const out = {
    id: str(r.id, 80) || newId(),
    teamId,
    eventCode: str(r.eventCode, 40).toUpperCase(),
    eventName: str(r.eventName, 120),
    matchNo: int(r.matchNo, 9999),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")) ? r.date : today(),
    confidence: CONFIDENCE.includes(r.confidence) ? r.confidence : "medium",
    scout: str(r.scout, 80),
    notes: str(r.notes, MAX_TEXT),
    autoTrajectory: TRAJECTORIES.includes(r.autoTrajectory) ? r.autoTrajectory : "unknown",
    createdAt: str(r.createdAt, 40) || undefined,
    updatedAt: str(r.updatedAt, 40) || undefined,
  };
  COUNT_FIELDS.forEach((k) => (out[k] = int(r[k])));
  OPTIONAL_FIELDS.forEach((k) => (out[k] = optNum(r[k], k.endsWith("Sec") ? 600 : 100)));
  FLAG_FIELDS.forEach((k) => (out[k] = flag(r[k])));
  if (!out.createdAt) delete out.createdAt;
  if (!out.updatedAt) delete out.updatedAt;
  return out;
}

function normalizeSchedule(s) {
  if (!s || typeof s !== "object" || !Array.isArray(s.matches)) return null;
  const ids = (a) => (Array.isArray(a) ? a.map((x) => str(x, 20)).filter(Boolean).slice(0, 3) : []);
  const score = (v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);
  return {
    eventCode: str(s.eventCode, 40).toUpperCase(),
    season: str(s.season, 4),
    fetchedAt: str(s.fetchedAt, 40),
    matches: s.matches.slice(0, 2000).map((m) => ({
      level: ["qual", "playoff"].includes(m.level) ? m.level : "other",
      number: int(m.number, 9999),
      series: int(m.series, 99),
      time: str(m.time, 40) || null,
      played: Boolean(m.played),
      red: ids(m.red),
      blue: ids(m.blue),
      redScore: score(m.redScore),
      blueScore: score(m.blueScore),
      redScoreNp: score(m.redScoreNp ?? m.redScore),
      blueScoreNp: score(m.blueScoreNp ?? m.blueScore),
    })),
  };
}

/** Validate + upgrade anything that claims to be a VITE database (v2 or v3). Throws on garbage. */
export function migrateDb(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.teams) || !Array.isArray(raw.records)) {
    throw new Error("not a VITE database");
  }
  const teams = [];
  const seen = new Set();
  raw.teams.forEach((t) => {
    const n = normalizeTeam(t);
    if (n && !seen.has(n.id)) {
      seen.add(n.id);
      teams.push(n);
    }
  });
  const records = raw.records.map(normalizeRecord).filter(Boolean);
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const draft = raw.draft && typeof raw.draft === "object" ? raw.draft : {};
  const idList = (a) => (Array.isArray(a) ? a.map((x) => str(x, 40)).filter((x) => seen.has(x)) : []);
  return {
    version: DB_VERSION,
    meta: {
      demo: Boolean(meta.demo),
      eventName: str(meta.eventName, 120),
      eventCode: str(meta.eventCode, 40).toUpperCase(),
      season: str(meta.season, 12) || "2026-2027",
      updatedAt: str(meta.updatedAt, 40) || new Date().toISOString(),
    },
    teams,
    records,
    draft: { captain: seen.has(draft.captain) ? draft.captain : teams[0]?.id || "", picked: idList(draft.picked).slice(0, 2), removed: idList(draft.removed) },
    schedule: normalizeSchedule(raw.schedule),
  };
}

// ── Records ──────────────────────────────────────────────────────────────

/** Same robot in the same match of the same event (matchNo 0 = unknown, never a duplicate). */
export function findDuplicate(db, rec) {
  const m = int(rec.matchNo, 9999);
  if (!m) return null;
  const code = str(rec.eventCode, 40).toUpperCase();
  return db.records.find((r) => r.id !== rec.id && r.teamId === rec.teamId && r.matchNo === m && r.eventCode === code) || null;
}

export function addRecord(db, input) {
  const now = new Date().toISOString();
  const record = normalizeRecord({ ...input, id: newId(), eventName: input.eventName || db.meta.eventName, createdAt: now, updatedAt: now });
  if (!record) throw new Error("team is required");
  return { db: { ...db, records: [...db.records, record], meta: { ...db.meta, demo: false } }, record };
}

export function updateRecord(db, id, patch) {
  let found = false;
  const records = db.records.map((r) => {
    if (r.id !== id) return r;
    found = true;
    return normalizeRecord({ ...r, ...patch, id, createdAt: r.createdAt, updatedAt: new Date().toISOString() });
  });
  if (!found) throw new Error("record not found");
  return { ...db, records };
}

export function deleteRecord(db, id) {
  return { ...db, records: db.records.filter((r) => r.id !== id) };
}

// ── Teams ────────────────────────────────────────────────────────────────

export function addTeam(db, input) {
  const team = normalizeTeam({ ...input, id: input.number, style: input.style || "" });
  if (!team || !team.name) throw new Error("number and name are required");
  if (db.teams.some((t) => t.number.toLowerCase() === team.number.toLowerCase() || t.id === team.id)) {
    const err = new Error("team exists");
    err.code = "exists";
    throw err;
  }
  return {
    ...db,
    teams: [...db.teams, team],
    meta: { ...db.meta, demo: false },
    draft: { ...db.draft, captain: db.draft?.captain || team.id },
  };
}

export function updateTeam(db, id, patch) {
  return { ...db, teams: db.teams.map((t) => (t.id === id ? normalizeTeam({ ...t, ...patch, id: t.id, number: t.number }) : t)) };
}

/** Removes a team and its scouting records (caller must confirm with the user first). */
export function deleteTeam(db, id) {
  const draft = db.draft || {};
  return {
    ...db,
    teams: db.teams.filter((t) => t.id !== id),
    records: db.records.filter((r) => r.teamId !== id),
    draft: {
      captain: draft.captain === id ? "" : draft.captain,
      picked: (draft.picked || []).filter((x) => x !== id),
      removed: (draft.removed || []).filter((x) => x !== id),
    },
  };
}

// ── Event switching ──────────────────────────────────────────────────────

/**
 * Apply the event chosen on the start screen. Demo data is replaced; the user's own records are
 * always kept; for another event, teams without records are dropped and the new roster is added.
 */
export function applyEvent(db, { season, eventCode, eventName, teams = [] }) {
  const code = str(eventCode, 40).toUpperCase();
  const sameEvent = !db.meta.demo && (db.meta.eventCode || "") === code;
  const withRecords = new Set(db.records.map((r) => String(r.teamId)));
  const base = db.meta.demo
    ? { teams: [], records: [] }
    : sameEvent
      ? { teams: db.teams, records: db.records }
      : { teams: db.teams.filter((t) => withRecords.has(String(t.id))), records: db.records };
  const have = new Set(base.teams.map((t) => String(t.number)));
  const roster = teams.map(normalizeTeam).filter(Boolean);
  const merged = [...base.teams, ...roster.filter((t) => !have.has(String(t.number)))];
  const year = Number(season) || 2026;
  return {
    ...db,
    version: DB_VERSION,
    teams: merged,
    records: base.records,
    schedule: sameEvent ? db.schedule : null,
    meta: { ...db.meta, demo: false, eventCode: code, eventName: str(eventName, 120), season: `${year}-${year + 1}` },
    draft: sameEvent && db.draft?.captain ? db.draft : { captain: merged[0]?.id || "", picked: [], removed: [] },
  };
}

// ── Official schedule ────────────────────────────────────────────────────

/** Store the official schedule and add any team from it that is missing in the roster. */
export function applySchedule(db, { season, eventCode, matches }) {
  const schedule = normalizeSchedule({ season: String(season), eventCode, fetchedAt: new Date().toISOString(), matches });
  const have = new Set(db.teams.map((t) => t.number));
  const missing = [...new Set(schedule.matches.flatMap((m) => [...m.red, ...m.blue]))].filter((n) => !have.has(n));
  const teams = [...db.teams, ...missing.map((n) => normalizeTeam({ number: n, name: "", style: "FTCScout" }))];
  return { ...db, teams, schedule };
}

// ── Merge / import ───────────────────────────────────────────────────────

const recKey = (r) => `${r.teamId}|${r.eventCode}|${r.matchNo}|${(r.scout || "").toLowerCase()}`;

/**
 * Merge another scout's data into this database. Nothing is overwritten:
 * a record is skipped when the same id exists, or when the same scout already logged that
 * robot in that match. Unknown teams are added.
 */
export function mergeDb(base, incomingRaw) {
  const incoming = migrateDb(incomingRaw);
  const teams = [...base.teams];
  const byNumber = new Map(teams.map((t) => [t.number, t]));
  const idMap = new Map();
  let teamsAdded = 0;
  incoming.teams.forEach((t) => {
    const existing = byNumber.get(t.number);
    if (existing) idMap.set(t.id, existing.id);
    else {
      teams.push(t);
      byNumber.set(t.number, t);
      idMap.set(t.id, t.id);
      teamsAdded += 1;
    }
  });
  const ids = new Set(base.records.map((r) => r.id));
  const keys = new Set(base.records.filter((r) => r.matchNo).map(recKey));
  const records = [...base.records];
  let added = 0;
  let skipped = 0;
  incoming.records.forEach((r0) => {
    const r = { ...r0, teamId: idMap.get(r0.teamId) || r0.teamId };
    if (ids.has(r.id) || (r.matchNo && keys.has(recKey(r)))) {
      skipped += 1;
      return;
    }
    if (!byNumber.has(r.teamId) && !teams.some((t) => t.id === r.teamId)) {
      const t = normalizeTeam({ number: r.teamId, name: "" });
      teams.push(t);
      byNumber.set(t.number, t);
      teamsAdded += 1;
    }
    ids.add(r.id);
    if (r.matchNo) keys.add(recKey(r));
    records.push(r);
    added += 1;
  });
  const schedule = base.schedule || incoming.schedule;
  return { db: { ...base, teams, records, schedule, meta: { ...base.meta, demo: false } }, added, skipped, teamsAdded };
}

/** Scouting CSV → merge. Accepts teamNumber or teamId columns; dedupes like mergeDb. */
export function importScoutingCsv(db, text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("empty");
  if (!("teamNumber" in rows[0]) && !("teamId" in rows[0])) throw new Error("teamNumber column is required");
  const teams = [];
  const records = [];
  rows.forEach((x) => {
    const no = str(x.teamNumber || x.teamId, 20);
    if (!no) return;
    const known = db.teams.find((t) => t.number === no || t.id === no);
    if (!known && !teams.some((t) => t.number === no)) teams.push({ id: no, number: no, name: x.teamName || "", region: x.region || "", style: "CSV" });
    records.push({ ...x, id: newId(), teamId: known?.id || no, eventCode: x.eventCode || db.meta.eventCode, eventName: x.eventName || db.meta.eventName });
  });
  return mergeDb(db, { teams, records, meta: {} });
}

export function scoutingCsv(db, records = db.records) {
  const byId = new Map(db.teams.map((t) => [t.id, t]));
  const rows = records.map((r) =>
    SCOUTING_COLUMNS.map((k) => {
      if (k === "teamNumber") return byId.get(r.teamId)?.number || r.teamId;
      if (k === "eventName") return r.eventName || db.meta.eventName;
      const v = r[k];
      return typeof v === "boolean" ? (v ? 1 : 0) : v;
    })
  );
  return [SCOUTING_COLUMNS.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}
