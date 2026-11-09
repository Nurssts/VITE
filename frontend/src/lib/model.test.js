import { describe, it, expect } from "vitest";
import { makeSeed, stats, pairModel, simulate, denialPick, roleCode } from "./model";

const db = () => makeSeed();

describe("simulate", () => {
  it("is reproducible with a seed", () => {
    const d = db();
    const a = simulate(d, ["D-101", "D-102", "D-103", "D-104"], 1000, { seed: 7 });
    const b = simulate(d, ["D-101", "D-102", "D-103", "D-104"], 1000, { seed: 7 });
    expect(a.winPct).toBe(b.winPct);
    expect(a.ciLow).toBe(b.ciLow);
  });
  it("is symmetric: swapping alliances mirrors the result", () => {
    const d = db();
    const ab = simulate(d, ["D-101", "D-102", "D-103", "D-104"], 20000, { seed: 1 });
    const ba = simulate(d, ["D-103", "D-104", "D-101", "D-102"], 20000, { seed: 1 });
    expect(Math.abs(ab.winPct - ba.lossPct)).toBeLessThan(2.5);
  });
  it("credible interval is wider with thin data", () => {
    const full = db();
    const thin = db();
    thin.records = thin.records.filter((r) => r.matchNo <= 1);
    const ids = ["D-101", "D-102", "D-103", "D-104"];
    const f = simulate(full, ids, 2000, { seed: 3 });
    const t = simulate(thin, ids, 2000, { seed: 3 });
    expect(t.ciHigh - t.ciLow).toBeGreaterThan(f.ciHigh - f.ciLow);
  });
});

describe("stats", () => {
  it("unscouted team is neutral, not perfectly stable", () => {
    const d = db();
    d.teams.push({ id: "X", number: "X", name: "No Data", region: "", style: "", notes: "" });
    const s = stats(d, d.teams.find((t) => t.id === "X"));
    expect(s.count).toBe(0);
    expect(s.consistency).toBe(50);
    expect(s.profile.reliability).toBeLessThan(55);
    expect(Math.abs(s.mean - stats(d, d.teams[0]).mean)).toBeLessThan(60);
  });
  it("one lucky match does not beat a proven team", () => {
    const d = db();
    d.teams.push({ id: "L", number: "L", name: "Lucky", region: "", style: "", notes: "" });
    d.records.push({ id: "lucky", teamId: "L", eventCode: "DEMO-ALMATY", autoHiveTips: 4, teleopHiveTips: 6, flowerPlaced: 8, ownedFlowerItems: 6, bottomNectar: 3, gardenItems: 5, teleopPark: true, autoLeave: true, autoPark: true });
    const lucky = stats(d, d.teams.find((t) => t.id === "L"));
    expect(lucky.mean).toBeLessThan(lucky.rawMean);
  });
  it("role codes do not depend on language", () => {
    const d = db();
    expect(["HIVE", "FLOWER", "AUTO_HIVE", "BALANCED"]).toContain(roleCode(stats(d, d.teams[0])));
    expect(pairModel(d, "D-101", "D-102").roleCodes).toHaveLength(2);
  });
});

describe("denialPick", () => {
  it("returns a candidate from the pool", () => {
    const d = db();
    const r = denialPick(d, "D-101", d.teams);
    expect(r.team.id).not.toBe("D-101");
  });
});
