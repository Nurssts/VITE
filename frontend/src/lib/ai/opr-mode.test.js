import { describe, expect, it } from "vitest";
import { applySchedule, emptyDb } from "../db";
import { createToolbox } from "./tools";
import { summarizeTool } from "./summaries";
import { setLang } from "../i18n";

// An event with official results but no scouting at all (the common case at the start).
const truth = { 1: 60, 2: 40, 3: 30, 4: 20 };
const pairs = [[[1, 2], [3, 4]], [[1, 3], [2, 4]], [[1, 4], [2, 3]], [[2, 3], [1, 4]], [[3, 4], [1, 2]], [[2, 4], [1, 3]]];
function eventDb() {
  const base = { ...emptyDb({ eventCode: "KZASN2", season: "2026-2027" }), teams: Object.keys(truth).map((n) => ({ id: n, number: n, name: `T${n}`, region: "", style: "", notes: "" })) };
  return applySchedule(base, {
    season: 2026,
    eventCode: "KZASN2",
    matches: pairs.map(([r, b], i) => ({ level: "qual", number: i + 1, played: true, red: r.map(String), blue: b.map(String), redScore: r.reduce((s, t) => s + truth[t], 0), blueScore: b.reduce((s, t) => s + truth[t], 0) })),
  });
}
const box = (db) => createToolbox({ getDb: () => db, setDb: () => {}, getPrefs: () => ({}), go: () => {}, memory: { add: () => {} } });
const run = (b, name, args) => JSON.parse(b.run(name, args));

describe("no scouting yet: tools use official OPR instead of fake zeros", () => {
  const b = box(eventDb());

  it("team profile has no model zeros, but has OPR and official record", () => {
    const t = run(b, "get_team", { team: "1" });
    expect(t.score).toBeNull();
    expect(t.scouting).toBe("none");
    expect(t.profile0to100).toBeUndefined();
    expect(t.opr).toBeGreaterThan(50);
    expect(t.official.played).toBe(6);
  });

  it("rankings and partners are ordered by OPR", () => {
    const r = run(b, "get_rankings", { sort_by: "score", limit: 4 });
    expect(r.basis).toBe("opr");
    expect(r.teams.map((x) => x.team)).toEqual(["1", "2", "3", "4"]);
    const p = run(b, "find_best_partners", { captain: "4" });
    expect(p.basis).toBe("opr");
    expect(p.partners[0].team).toBe("1");
    expect(p.partners.every((x) => x.synergy === undefined)).toBe(true);
  });

  it("alliance comparison and simulation fall back to OPR", () => {
    const c = run(b, "compare_alliance", { teams: ["1", "2"] });
    expect(c.basis).toBe("opr");
    expect(c.expectedPoints).toBeGreaterThan(90);
    const s = run(b, "simulate_match", { red: ["1", "2"], blue: ["3", "4"] });
    expect(s.basis).toBe("opr");
    expect(s.redWinPct).toBeGreaterThan(80);
  });
});

describe("activity summaries show people a sentence, never JSON", () => {
  it("summarises tool results in plain words", () => {
    setLang("ru");
    const b = box(eventDb());
    const team = { status: "done", content: b.run("get_team", { team: "1" }) };
    const text = summarizeTool("get_team", team);
    expect(text).toContain("OPR");
    expect(text).toContain("скаутинга нет");
    expect(text).not.toMatch(/[{}"]/);
    const partners = summarizeTool("find_best_partners", { status: "done", content: b.run("find_best_partners", { captain: "4" }) });
    expect(partners).toMatch(/^Лучшие: 1, 2, 3/);
    expect(summarizeTool("set_draft", { status: "declined", content: "{}" })).toBe("Вы отклонили это действие.");
    expect(summarizeTool("get_team", { status: "error", isError: true, content: JSON.stringify({ error: "Team 9 is not in this event's team list." }) })).toContain("Не получилось");
  });
});
