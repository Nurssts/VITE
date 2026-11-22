import { describe, expect, it } from "vitest";
import { calibration, computeOpr, makeSeed, predictMatch } from "./model";

// Synthetic event where the true per-robot contribution is known.
const truth = { 1: 60, 2: 40, 3: 30, 4: 20, 5: 10, 6: 50 };
const pairs = [
  [[1, 2], [3, 4]], [[5, 6], [1, 3]], [[2, 4], [5, 6]], [[1, 5], [2, 6]], [[3, 6], [4, 5]], [[1, 4], [2, 3]],
  [[2, 5], [3, 6]], [[1, 6], [4, 5]], [[3, 4], [1, 2]], [[4, 6], [1, 5]],
];
const matches = pairs.map(([r, b], i) => ({
  level: "qual", number: i + 1, played: true, red: r.map(String), blue: b.map(String),
  redScore: r.reduce((s, t) => s + truth[t], 0), blueScore: b.reduce((s, t) => s + truth[t], 0),
  redScoreNp: r.reduce((s, t) => s + truth[t], 0), blueScoreNp: b.reduce((s, t) => s + truth[t], 0),
}));

describe("computeOpr", () => {
  it("recovers individual contributions from alliance scores", () => {
    const { opr, matches: n } = computeOpr(matches);
    expect(n).toBe(10);
    Object.entries(truth).forEach(([t, v]) => expect(Math.abs(opr.get(t) - v)).toBeLessThan(3));
  });
  it("ignores unplayed matches and handles an empty schedule", () => {
    expect(computeOpr([{ level: "qual", played: false, red: ["1"], blue: ["2"], redScoreNp: null, blueScoreNp: null }]).matches).toBe(0);
    expect(computeOpr([]).opr.size).toBe(0);
  });
});

describe("predictMatch", () => {
  it("favours the stronger alliance by OPR", () => {
    const p = predictMatch(makeSeed(), ["1", "6"], ["4", "5"], computeOpr(matches));
    expect(p.opr.pRed).toBeGreaterThan(0.9);
    expect(p.scouting).toBeNull(); // no scouting data for these numbers
  });
  it("uses scouting data when present", () => {
    const db = makeSeed();
    const p = predictMatch(db, ["D-101", "D-102"], ["D-103", "D-104"], null);
    expect(p.scouting.pRed).toBeGreaterThan(0);
    expect(p.scouting.pRed).toBeLessThan(1);
    expect(p.opr).toBeNull();
  });
});

describe("calibration", () => {
  it("only uses records from earlier matches", () => {
    const db = makeSeed();
    const sched = [{ level: "qual", number: 1, played: true, red: ["D-101", "D-102"], blue: ["D-103", "D-104"], redScore: 10, blueScore: 5 }];
    expect(calibration(db, sched)).toBeNull(); // nothing scouted before match 1
    const later = [{ ...sched[0], number: 6 }];
    expect(calibration(db, later).n).toBe(1);
  });
});
