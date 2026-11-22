import { describe, expect, it } from "vitest";
import { addRecord, addTeam, applyEvent, applySchedule, deleteTeam, emptyDb, findDuplicate, importScoutingCsv, mergeDb, migrateDb, normalizeRecord, scoutingCsv, updateRecord } from "./db";
import { makeSeed } from "./model";

const base = () => ({ ...emptyDb({ eventCode: "EVT", eventName: "Event" }), teams: [{ id: "1", number: "1", name: "One", region: "", style: "", notes: "" }] });

describe("normalizeRecord", () => {
  it("coerces types and clamps hostile values", () => {
    const r = normalizeRecord({ teamId: "1", autoHiveTips: "3", cellItems: -5, gardenItems: 1e9, autoLeave: "yes", confidence: "evil", autoTrajectory: "<script>", notes: "x".repeat(5000), date: "nope" });
    expect(r.autoHiveTips).toBe(3);
    expect(r.cellItems).toBe(0);
    expect(r.gardenItems).toBe(999);
    expect(r.autoLeave).toBe(true);
    expect(r.confidence).toBe("medium");
    expect(r.autoTrajectory).toBe("unknown");
    expect(r.notes.length).toBe(2000);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("rejects records without a team", () => {
    expect(normalizeRecord({ autoHiveTips: 1 })).toBeNull();
  });
});

describe("migrateDb", () => {
  it("upgrades the v2 seed and keeps every record", () => {
    const seed = makeSeed();
    const db = migrateDb({ ...seed, version: 2 });
    expect(db.version).toBe(3);
    expect(db.records).toHaveLength(seed.records.length);
    expect(db.schedule).toBeNull();
  });
  it("throws on files that are not a database", () => {
    expect(() => migrateDb({ hello: 1 })).toThrow();
    expect(() => migrateDb(null)).toThrow();
  });
  it("drops draft ids of unknown teams", () => {
    const db = migrateDb({ ...base(), draft: { captain: "ghost", picked: ["ghost"], removed: ["1", "ghost"] } });
    expect(db.draft.captain).toBe("1");
    expect(db.draft.picked).toEqual([]);
    expect(db.draft.removed).toEqual(["1"]);
  });
});

describe("records", () => {
  it("adds, updates and detects duplicates", () => {
    const { db, record } = addRecord(base(), { teamId: "1", eventCode: "evt", matchNo: "4", autoHiveTips: "2" });
    expect(record.eventCode).toBe("EVT");
    expect(record.autoHiveTips).toBe(2);
    expect(findDuplicate(db, { teamId: "1", eventCode: "EVT", matchNo: 4 })?.id).toBe(record.id);
    expect(findDuplicate(db, { ...record })).toBeNull(); // itself is not a duplicate
    expect(findDuplicate(db, { teamId: "1", eventCode: "EVT", matchNo: 0 })).toBeNull();
    const next = updateRecord(db, record.id, { autoHiveTips: 5 });
    expect(next.records[0].autoHiveTips).toBe(5);
    expect(next.records[0].createdAt).toBe(record.createdAt);
    expect(db.records[0].autoHiveTips).toBe(2); // immutability
  });
});

describe("teams", () => {
  it("refuses duplicates and deletes with records and draft cleanup", () => {
    const withTeam = addTeam(base(), { number: "2", name: "Two" });
    expect(() => addTeam(withTeam, { number: "2", name: "Again" })).toThrow();
    const { db } = addRecord({ ...withTeam, draft: { captain: "2", picked: ["2"], removed: [] } }, { teamId: "2", matchNo: 1 });
    const gone = deleteTeam(db, "2");
    expect(gone.teams.map((t) => t.id)).toEqual(["1"]);
    expect(gone.records).toHaveLength(0);
    expect(gone.draft).toEqual({ captain: "", picked: [], removed: [] });
  });
});

describe("applyEvent", () => {
  it("replaces demo data with the event roster", () => {
    const db = applyEvent(makeSeed(), { season: "2026", eventCode: "aubrq1", eventName: "Brisbane", teams: [{ number: "11506", name: "Flaming Tacos" }] });
    expect(db.meta).toMatchObject({ demo: false, eventCode: "AUBRQ1", season: "2026-2027" });
    expect(db.teams.map((t) => t.number)).toEqual(["11506"]);
    expect(db.records).toHaveLength(0);
  });
  it("keeps the user's records when switching events", () => {
    const { db } = addRecord(base(), { teamId: "1", matchNo: 1 });
    const next = applyEvent(db, { season: "2026", eventCode: "OTHER", teams: [{ number: "9", name: "Nine" }] });
    expect(next.records).toHaveLength(1);
    expect(next.teams.map((t) => t.number).sort()).toEqual(["1", "9"]);
  });
});

describe("mergeDb", () => {
  it("merges another scout's file without duplicates", () => {
    const { db: mine } = addRecord(base(), { teamId: "1", eventCode: "EVT", matchNo: 1, scout: "A" });
    const theirs = { teams: [{ id: "1", number: "1", name: "One" }, { id: "7", number: "7", name: "Seven" }], records: [
      { ...mine.records[0] }, // same id → skipped
      { teamId: "1", eventCode: "EVT", matchNo: 1, scout: "a" }, // same scout+match → skipped
      { teamId: "1", eventCode: "EVT", matchNo: 1, scout: "B" }, // second scout → added
      { teamId: "7", eventCode: "EVT", matchNo: 2, scout: "B" },
    ] };
    const r = mergeDb(mine, theirs);
    expect([r.added, r.skipped, r.teamsAdded]).toEqual([2, 2, 1]);
    expect(r.db.records).toHaveLength(3);
    expect(mergeDb(r.db, theirs).added).toBe(0); // idempotent
  });
});

describe("scouting CSV", () => {
  it("round-trips through export and import, including formula-looking notes", () => {
    const { db } = addRecord(base(), { teamId: "1", eventCode: "EVT", matchNo: 3, autoLeave: true, autoHiveTips: 2, notes: "=cmd|' /C calc'!A0", scout: "A" });
    const csv = scoutingCsv(db);
    expect(csv).toContain(`"'=cmd|' /C calc'!A0"`);
    const fresh = base();
    const r = importScoutingCsv(fresh, csv);
    expect(r.added).toBe(1);
    const rec = r.db.records[0];
    expect(rec).toMatchObject({ teamId: "1", matchNo: 3, autoLeave: true, autoHiveTips: 2, notes: "=cmd|' /C calc'!A0" });
    expect(importScoutingCsv(r.db, csv).added).toBe(0); // re-import is a no-op
  });
  it("requires a teamNumber column", () => {
    expect(() => importScoutingCsv(base(), "a,b\n1,2")).toThrow();
  });
});

describe("applySchedule", () => {
  it("stores the schedule and adds missing teams", () => {
    const db = applySchedule(base(), { season: 2026, eventCode: "evt", matches: [{ level: "qual", number: 1, played: false, red: ["1", "2"], blue: ["3", "4"] }] });
    expect(db.schedule.matches[0].red).toEqual(["1", "2"]);
    expect(db.teams.map((t) => t.number)).toEqual(["1", "2", "3", "4"]);
  });
});
