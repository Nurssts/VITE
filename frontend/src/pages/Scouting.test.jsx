// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useState } from "react";
import Scouting from "./Scouting";
import { FeedbackHost } from "../components/feedback";
import { applySchedule, emptyDb } from "../lib/db";
import { setLang } from "../lib/i18n";

function baseDb() {
  const db = {
    ...emptyDb({ eventCode: "EVT", eventName: "Test event" }),
    teams: ["100", "200", "300", "400"].map((n) => ({ id: n, number: n, name: `Team ${n}`, region: "", style: "", notes: "" })),
  };
  return applySchedule(db, { season: 2026, eventCode: "EVT", matches: [{ level: "qual", number: 1, played: false, red: ["100", "200"], blue: ["300", "400"] }, { level: "qual", number: 2, played: false, red: ["300", "100"], blue: ["200", "400"] }] });
}

let latest;
function Harness({ initial, route = { param: "", query: {} } }) {
  const [db, setDb] = useState(initial);
  latest = db;
  return (
    <>
      <Scouting db={db} setDb={setDb} go={() => {}} route={route} />
      <FeedbackHost />
    </>
  );
}

beforeEach(() => {
  window.scrollTo = () => {};
  setLang("en");
  sessionStorage.clear();
});
afterEach(cleanup);

describe("Scouting form", () => {
  it("shows a live total and saves a normalised record", () => {
    render(<Harness initial={baseDb()} />);
    fireEvent.click(screen.getByLabelText("HIVE TIP TeleOp: +1"));
    fireEvent.click(screen.getByLabelText("HIVE TIP TeleOp: +1"));
    fireEvent.click(screen.getByText(/Робот покинул стену|Robot left/i));
    expect(screen.getByText("43")).toBeTruthy(); // 2 × 20 + 3

    fireEvent.click(screen.getByRole("checkbox", { name: /observed facts|наблюдаемые факты/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save observation|Сохранить наблюдение/i }));

    expect(latest.records).toHaveLength(1);
    expect(latest.records[0]).toMatchObject({ teamId: "100", teleopHiveTips: 2, autoLeave: true, eventCode: "EVT" });
    expect(typeof latest.records[0].teleopHiveTips).toBe("number");
  });

  it("follows the chosen station through the schedule and advances the match", () => {
    render(<Harness initial={baseDb()} />);
    fireEvent.change(screen.getByPlaceholderText("12"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("radio", { name: "R2" }));
    expect(screen.getByRole("combobox", { name: /^Team/ }).value).toBe("100"); // R2 of match 2

    fireEvent.click(screen.getByRole("checkbox", { name: /observed facts|наблюдаемые факты/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save observation|Сохранить наблюдение/i }));
    expect(latest.records[0].matchNo).toBe(2);
    expect(screen.getByPlaceholderText("12").value).toBe("3");
  });

  it("asks before saving a duplicate of the same robot and match", async () => {
    const db = baseDb();
    db.records = [{ id: "x", teamId: "100", eventCode: "EVT", matchNo: 1, autoLeave: false, autoPark: false, teleopPark: false, disabled: false, autoHiveTips: 0, teleopHiveTips: 0, cellItems: 0, flowerPlaced: 0, ownedFlowerItems: 0, bottomNectar: 0, gardenItems: 0, penalties: 0 }];
    render(<Harness initial={db} route={{ param: "", query: { team: "100", match: "1" } }} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /observed facts|наблюдаемые факты/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save observation|Сохранить наблюдение/i }));
    });
    expect(screen.getByRole("dialog", { name: /already scouted/i })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    expect(latest.records).toHaveLength(1);
  });
});
