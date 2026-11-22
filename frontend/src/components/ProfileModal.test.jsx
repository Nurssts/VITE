// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfileModal from "./ProfileModal";
import { setLang } from "../lib/i18n";

afterEach(cleanup);

const teams = [
  { id: "21062", number: "21062", name: "QUANT" },
  { id: "34350", number: "34350", name: "OZGE" },
];

describe("ProfileModal", () => {
  it("saves team, role and name into prefs", () => {
    setLang("en");
    let prefs = { myTeam: "", myRole: "", displayName: "" };
    const setPrefs = vi.fn((fn) => (prefs = fn(prefs)));
    const onClose = vi.fn();
    render(<ProfileModal open onClose={onClose} prefs={prefs} setPrefs={setPrefs} teams={teams} />);
    fireEvent.change(screen.getByRole("combobox", { name: /My team/i }), { target: { value: "21062" } });
    fireEvent.click(screen.getByRole("radio", { name: /Scout/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /Display name/i }), { target: { value: "  Misha " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(prefs).toEqual({ myTeam: "21062", myRole: "scout", displayName: "Misha" });
    expect(onClose).toHaveBeenCalled();
  });

  it("accepts a team that is not in the event list", () => {
    setLang("en");
    let prefs = { myTeam: "", myRole: "mentor", displayName: "" };
    const setPrefs = vi.fn((fn) => (prefs = fn(prefs)));
    render(<ProfileModal open onClose={() => {}} prefs={prefs} setPrefs={setPrefs} teams={teams} />);
    fireEvent.change(screen.getByRole("combobox", { name: /My team/i }), { target: { value: "__other" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Team number/i }), { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(prefs.myTeam).toBe("99999");
    expect(prefs.myRole).toBe("mentor");
  });
});
