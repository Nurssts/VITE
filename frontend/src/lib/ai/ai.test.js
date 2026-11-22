import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSeed } from "../model";
import { applySchedule } from "../db";
import { createToolbox, TOOL_KINDS } from "./tools";
import { runAgent, trimHistory, wireMessages } from "./agent";
import { parseBlocks } from "../../components/Markdown";
import { draftToForm } from "../../components/Dictation";

function env(db0 = makeSeed()) {
  let db = db0;
  const memory = [];
  const nav = [];
  const box = createToolbox({
    getDb: () => db,
    setDb: (fn) => (db = fn(db)),
    getPrefs: () => ({ myTeam: "D-101", aiShareNotes: true }),
    go: (p, param) => nav.push([p, param]),
    memory: { add: (t) => memory.push(t) },
  });
  return { box, db: () => db, memory, nav };
}

const run = (box, name, args) => JSON.parse(box.run(name, args));

describe("Strategist tools (real model over the demo database)", () => {
  it("declares a kind for every tool", () => {
    expect(Object.keys(TOOL_KINDS)).toHaveLength(16);
  });

  it("rankings, team profile and alliance synergy come from model.js", () => {
    const { box } = env();
    const r = run(box, "get_rankings", { sort_by: "score", limit: 3 });
    expect(r.teams).toHaveLength(3);
    expect(r.teams[0].score).toBeGreaterThanOrEqual(r.teams[1].score);
    const t = run(box, "get_team", { team: "D-101" });
    expect(t.matches).toBe(5);
    expect(t.recentMatches[0]).toHaveProperty("total");
    const a = run(box, "compare_alliance", { teams: ["D-101", "D-102"] });
    expect(a.synergy).toBeGreaterThan(0);
    expect(a.collision).toHaveProperty("level");
  });

  it("simulation is reproducible and validates input", () => {
    const { box } = env();
    const a = run(box, "simulate_match", { red: ["D-101", "D-102"], blue: ["D-103", "D-104"] });
    const b = run(box, "simulate_match", { red: ["D-101", "D-102"], blue: ["D-103", "D-104"] });
    expect(a.redWinPct).toBe(b.redWinPct);
    expect(() => box.run("simulate_match", { red: ["D-101", "D-101"], blue: ["D-103", "D-104"] })).toThrow(/different/);
    expect(() => box.run("get_team", { team: "99999" })).toThrow(/not in this event/);
  });

  it("schedule-aware tools work with an official schedule", () => {
    const base = makeSeed();
    const db = applySchedule(base, { season: 2026, eventCode: base.meta.eventCode, matches: [{ level: "qual", number: 7, played: false, red: ["D-101", "D-102"], blue: ["D-103", "D-104"] }] });
    const { box } = env(db);
    expect(run(box, "get_schedule", { filter: "upcoming" }).matches[0].match).toBe(7);
    expect(run(box, "get_team", { team: "D-101" }).upcoming[0]).toMatchObject({ match: 7, alliance: "red", partner: ["D-102"] });
    expect(run(box, "get_scouting_gaps", {}).teamsBelow4Observations).toBe(0);
  });

  it("anomaly review finds duplicates", () => {
    const db = makeSeed();
    db.records.push({ ...db.records[0], id: "dup" });
    const { box } = env(db);
    expect(run(box, "find_anomalies", {}).issues.some((i) => i.type === "duplicate")).toBe(true);
  });

  it("actions change the database only through the toolbox", () => {
    const e = env();
    run(e.box, "set_draft", { captain: "D-101", partner: "D-104" });
    expect(e.db().draft).toMatchObject({ captain: "D-101", picked: ["D-104"] });
    run(e.box, "mark_teams_picked", { teams: ["D-105"] });
    expect(e.db().draft.removed).toContain("D-105");
    run(e.box, "save_team_note", { team: "D-102", note: "strong FLOWER" });
    expect(e.db().teams.find((t) => t.id === "D-102").notes).toBe("strong FLOWER");
    const before = e.db().records.length;
    const r = run(e.box, "add_observation", { team: "D-103", match: 9, teleopHiveTips: 2, autoLeave: true });
    expect(r.points).toBe(43);
    expect(e.db().records).toHaveLength(before + 1);
    run(e.box, "remember", { fact: "We are weak at FLOWER" });
    expect(e.memory).toEqual(["We are weak at FLOWER"]);
  });

  it("notes are hidden when the user turned sharing off", () => {
    const db = makeSeed();
    db.teams[0].notes = "secret plan";
    const box = createToolbox({ getDb: () => db, setDb: () => {}, getPrefs: () => ({ aiShareNotes: false }), go: () => {}, memory: { add: () => {} } });
    expect(box.run("get_team", { team: "D-101" })).not.toContain("secret plan");
  });
});

// streamChat is mocked ONLY here: the test checks the loop logic, not the model.
vi.mock("./client", () => ({ streamChat: vi.fn() }));
import { streamChat } from "./client";

function script(turns) {
  let i = 0;
  streamChat.mockImplementation(async (body, { onEvent }) => {
    const t = turns[i++];
    t.forEach((e) => onEvent(e));
  });
}

afterEach(() => streamChat.mockReset());

describe("agent loop", () => {
  const request = { context: {}, memory: [], lang: "en" };

  it("runs read tools automatically and returns the final answer", async () => {
    const { box } = env();
    script([
      [{ type: "start", provider: "p" }, { type: "tool_call", id: "c1", name: "get_rankings", args: { limit: 2 } }, { type: "done", stop: "tool_use", usage: { input: 5, output: 2 } }],
      [{ type: "text", delta: "D-101 is best." }, { type: "done", stop: "end", usage: { input: 9, output: 4 } }],
    ]);
    const updates = [];
    const res = await runAgent({ messages: [{ role: "user", text: "best?" }], toolbox: box, request, confirm: vi.fn(), onMessages: (m) => updates.push(m) });
    expect(res.usage).toEqual({ input: 14, output: 6 });
    const roles = res.messages.map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(res.messages[2].results[0].content).toContain("teams");
    expect(res.messages[3].text).toBe("D-101 is best.");
    // the second request carries the tool result back to the model
    expect(streamChat.mock.calls[1][0].messages.at(-1).role).toBe("tool");
  });

  it("asks before actions and respects a refusal", async () => {
    const e = env();
    script([
      [{ type: "tool_call", id: "a1", name: "set_draft", args: { captain: "D-101" } }, { type: "done", stop: "tool_use" }],
      [{ type: "text", delta: "OK, not changed." }, { type: "done", stop: "end" }],
    ]);
    const confirm = vi.fn().mockResolvedValue(false);
    const before = e.db().draft.captain;
    const res = await runAgent({ messages: [{ role: "user", text: "set captain" }], toolbox: e.box, request, confirm, onMessages: () => {} });
    expect(confirm).toHaveBeenCalledOnce();
    expect(e.db().draft.captain).toBe(before);
    expect(res.messages[2].results[0]).toMatchObject({ status: "declined" });
  });

  it("surfaces provider errors and stops at the step limit", async () => {
    const { box } = env();
    script([[{ type: "error", message: "Daily AI request limit reached." }]]);
    await expect(runAgent({ messages: [{ role: "user", text: "x" }], toolbox: box, request, confirm: vi.fn(), onMessages: () => {} })).rejects.toThrow(/limit/);
    const loop = Array.from({ length: 3 }, (_, i) => [{ type: "tool_call", id: `t${i}`, name: "get_event_overview", args: {} }, { type: "done", stop: "tool_use" }]);
    script(loop);
    const res = await runAgent({ messages: [{ role: "user", text: "x" }], toolbox: box, request, confirm: vi.fn(), onMessages: () => {}, maxSteps: 3 });
    expect(res.stop).toBe("step-limit");
  });

  it("unknown tool names become error results, not crashes", async () => {
    const { box } = env();
    script([
      [{ type: "tool_call", id: "x", name: "delete_everything", args: {} }, { type: "done", stop: "tool_use" }],
      [{ type: "done", stop: "end" }],
    ]);
    const res = await runAgent({ messages: [{ role: "user", text: "x" }], toolbox: box, request, confirm: vi.fn(), onMessages: () => {} });
    expect(res.messages[2].results[0].isError).toBe(true);
  });

  it("history trimming never splits a tool call from its result", () => {
    const msgs = [];
    for (let i = 0; i < 40; i++) msgs.push({ role: "user", text: `q${i}` }, { role: "assistant", toolCalls: [{ id: `c${i}` }] }, { role: "tool", results: [] });
    const t = trimHistory(msgs, 70);
    expect(t[0].role).toBe("user");
    expect(t.length).toBeLessThanOrEqual(70);
    expect(wireMessages([{ role: "user", text: "a", display: "A", ts: 1 }])[0]).toEqual({ role: "user", text: "a" });
  });
});

describe("Markdown parser", () => {
  it("parses headings, lists and tables without producing HTML", () => {
    const b = parseBlocks("## Pick list\n| # | Team |\n|---|---|\n| 1 | 23334 |\n\n- a\n- b\n\n<script>alert(1)</script>");
    expect(b.map((x) => x.type)).toEqual(["heading", "table", "list", "p"]);
    expect(b[1].rows[0]).toEqual(["1", "23334"]);
    expect(b[3].text).toBe("<script>alert(1)</script>"); // rendered as text by React, never as HTML
  });
});

describe("Scribe draft mapping", () => {
  const teams = [{ id: "23334", number: "23334", name: "Axiom" }];
  it("maps valid fields and ignores junk", () => {
    const r = draftToForm({ teamNumber: "23334", matchNo: 12, autoHiveTips: 2, teleopHiveTips: "3", penalties: -4, autoLeave: true, autoTrajectory: "moon", notes: "slow endgame", uncertain: ["penalties"] }, { teamId: "", notes: "" }, teams);
    expect(r.form).toMatchObject({ teamId: "23334", matchNo: "12", autoHiveTips: 2, teleopHiveTips: 3, autoLeave: true, notes: "slow endgame" });
    expect(r.form.penalties).toBeUndefined();
    expect(r.form.autoTrajectory).toBeUndefined();
    expect(r.uncertain).toEqual(["penalties"]);
  });
  it("reports a team that is not in the roster", () => {
    expect(draftToForm({ teamNumber: "1" }, {}, teams).unknownTeam).toBe("1");
  });
});
