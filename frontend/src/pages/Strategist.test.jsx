import { describe, expect, it } from "vitest";
import { humanizeToolNames } from "./Strategist";
import { setLang } from "../lib/i18n";

describe("humanizeToolNames", () => {
  it("replaces internal tool identifiers with readable labels", () => {
    setLang("ru");
    const out = humanizeToolNames("Используйте `get_scouting_gaps` для планирования и get_rankings.");
    expect(out).not.toMatch(/get_scouting_gaps|get_rankings|`/);
    expect(out).toContain("«Пробелы в скаутинге»");
    expect(humanizeToolNames("budget_target and get_teams_x stay")).toBe("budget_target and get_teams_x stay");
  });
});
