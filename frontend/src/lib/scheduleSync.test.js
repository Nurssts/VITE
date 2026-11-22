import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: { eventMatches: vi.fn() } }));
import { api } from "./api";
import { syncSchedule } from "./scheduleSync";
import { emptyDb } from "./db";
import { makeSeed } from "./model";

const MATCHES = [{ level: "qual", number: 1, played: true, red: ["1", "2"], blue: ["3", "4"], redScore: 40, blueScore: 30 }];

function harness(db0) {
  let db = db0;
  const setDb = vi.fn((fn) => (db = typeof fn === "function" ? fn(db) : fn));
  return { getDb: () => db, setDb, db: () => db };
}

describe("schedule auto-sync", () => {
  it("loads the schedule without any button and adds missing teams", async () => {
    api.eventMatches.mockResolvedValueOnce({ matches: MATCHES });
    const h = harness({ ...emptyDb({ eventCode: "EVT", season: "2026-2027" }), teams: [{ id: "1", number: "1", name: "One" }] });
    const r = await syncSchedule(h.getDb, h.setDb);
    expect(r).toMatchObject({ ok: true, changed: true, matches: 1 });
    expect(api.eventMatches).toHaveBeenCalledWith("2026", "EVT");
    expect(h.db().schedule.matches[0].redScore).toBe(40);
    expect(h.db().teams.map((t) => t.number)).toEqual(["1", "2", "3", "4"]);
  });

  it("does not rewrite the database when nothing changed", async () => {
    api.eventMatches.mockResolvedValue({ matches: MATCHES });
    const h = harness(emptyDb({ eventCode: "EVT" }));
    await syncSchedule(h.getDb, h.setDb);
    h.setDb.mockClear();
    const r = await syncSchedule(h.getDb, h.setDb);
    expect(r.changed).toBe(false);
    expect(h.setDb).not.toHaveBeenCalled();
  });

  it("skips demo data and keeps old data on network errors", async () => {
    api.eventMatches.mockReset();
    expect((await syncSchedule(() => makeSeed(), vi.fn())).skipped).toBe(true);
    expect(api.eventMatches).not.toHaveBeenCalled();
    api.eventMatches.mockRejectedValueOnce(new Error("timeout"));
    const h = harness(emptyDb({ eventCode: "EVT" }));
    const r = await syncSchedule(h.getDb, h.setDb);
    expect(r).toMatchObject({ ok: false, error: "timeout" });
    expect(h.setDb).not.toHaveBeenCalled();
  });
});
