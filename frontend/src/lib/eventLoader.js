import { api } from "./api";
import { tr } from "./i18n";

// Real team name = nameShort; nameFull is the school/sponsor string.
export function fromFirst(x) {
  const number = String(x.teamNumber ?? x.displayTeamNumber ?? "").trim();
  return {
    number,
    name: (x.nameShort || x.teamName || x.nameFull || "").trim() || `${tr("Команда")} ${number}`,
    region: [x.city, x.stateProv].filter(Boolean).join(", "),
  };
}

/**
 * Teams of one event. Tries the official FIRST API (needs a key on the server),
 * falls back to FTCScout (public). `season` = year the season starts (2026 = BIOBUZZ).
 */
export async function loadEventTeams(season, code) {
  const c = String(code || "").trim();
  const errors = [];
  // Ask FIRST only when the server has credentials (saves a failing request and ~1s).
  const health = await api.health().catch(() => null);
  if (health?.official_api_configured !== false) {
    try {
      const d = await api.firstTeams(season, c);
      const teams = (d.teams || []).map(fromFirst).filter((t) => t.number);
      if (teams.length) return { source: "FIRST", teams };
    } catch (e) {
      errors.push(`FIRST: ${e.message}`);
    }
  }
  try {
    const d = await api.eventTeamsScout(season, c);
    const teams = (d.teams || []).filter((t) => t.number);
    if (teams.length) return { source: "FTCScout", teams, name: d.name };
    errors.push("FTCScout: 0 teams");
  } catch (e) {
    errors.push(`FTCScout: ${e.message}`);
  }
  throw new Error(errors.join(" | "));
}

export function teamsToDb(list, source = "FTC Events API") {
  return list.map((t) => ({
    id: String(t.number),
    number: String(t.number),
    name: t.name || "",
    region: t.region || "",
    style: source,
    notes: "",
  }));
}
