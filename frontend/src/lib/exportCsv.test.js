import { describe, expect, it } from "vitest";
import { teamsToCsv } from "./exportCsv";

const db = {
  version: 2,
  meta: { demo: false, eventCode: "TEST", eventName: "Test", season: "2026-2027" },
  teams: [
    { id: "1", number: "1", name: '=HYPERLINK("x")', region: "Almaty, KZ", style: "", notes: "" },
    { id: "2", number: "2", name: 'Say "hi"', region: "", style: "", notes: "" },
  ],
  records: [],
  draft: { captain: "", picked: [], removed: [] },
};

describe("teamsToCsv", () => {
  const csv = teamsToCsv(db);
  const lines = csv.split("\r\n");
  it("has header and one row per team", () => {
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith('"rank","number","name"')).toBe(true);
  });
  it("neutralises formulas and escapes quotes", () => {
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Say ""hi"""');
  });
});
