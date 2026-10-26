const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function getJson(url) {
  const r = await fetch(BASE + url, { headers: { Accept: "application/json" } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

// Real team name = nameShort; nameFull is the school/sponsor string.
function fromFirst(x) {
  const number = String(x.teamNumber ?? x.displayTeamNumber ?? "").trim();
  return {
    number,
    name: (x.nameShort || x.teamName || x.nameFull || "").trim() || `Команда ${number}`,
    region: [x.city, x.stateProv].filter(Boolean).join(", "),
  };
}

// Returns teams of the event. Tries the official FIRST API (needs key on the server),
// falls back to FTCScout (no key).
export async function loadEventTeams(year, code) {
  const c = encodeURIComponent(code.trim());
  const errors = [];
  try {
    const d = await getJson(`/api/ftc/teams?season=${year}&event_code=${c}`);
    const teams = (d.teams || []).map(fromFirst).filter((t) => t.number);
    if (teams.length) return { source: "FIRST", teams };
  } catch (e) {
    errors.push(`FIRST: ${e.message}`);
  }
  try {
    const d = await getJson(`/api/ftcscout/event/${c}/teams?season=${year}`);
    const teams = (d.teams || []).filter((t) => t.number);
    if (teams.length) return { source: "FTCScout", teams };
    errors.push("FTCScout: 0 teams");
  } catch (e) {
    errors.push(`FTCScout: ${e.message}`);
  }
  throw new Error(errors.join(" | "));
}

export function teamsToDb(list) {
  return list.map((t) => ({
    id: t.number,
    number: t.number,
    name: t.name,
    region: t.region || "",
    style: "FTC Events API",
    notes: "",
  }));
}
