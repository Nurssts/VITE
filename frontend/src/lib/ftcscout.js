// Direct FTCScout GraphQL client. FTCScout is public and allows CORS, so the web build and the
// Android app load real events without our server. Mirrors /api/ftcscout/* in server.py.
const GQL = "https://api.ftcscout.org/graphql";

const PLAYED_EVENTS = `
query PlayedEvents($season: Int!) {
  eventsSearch(season: $season, hasMatches: true) {
    code name start end type location { city country }
  }
}`;

// BIOBUZZ (2026) team stats. OPR splits each alliance score into per-robot contributions.
const EVENT_2026 = `
query EventStats($season: Int!, $code: String!) {
  eventByCode(season: $season, code: $code) {
    code name start end location { city country }
    matches { id }
    teams {
      teamNumber
      team { name }
      stats {
        ... on TeamEventStats2026 {
          rank rp wins losses ties qualMatchesPlayed
          opr { totalPointsNp autoPoints autoHivePoints dcHivePoints dcFlowerPoints dcGardenPoints dcParkPoints }
          dev { totalPointsNp }
        }
      }
    }
  }
}`;

async function gql(query, variables) {
  let response;
  try {
    response = await fetch(GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw Error("Нет связи с FTCScout. Проверьте интернет: локальный скаутинг доступен.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors) throw Error(`FTCScout вернул ошибку (${response.status}).`);
  return body.data;
}

export async function playedEvents(season) {
  const data = await gql(PLAYED_EVENTS, { season: Number(season) });
  const events = [...(data.eventsSearch || [])].sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
  return { events, season: Number(season), count: events.length };
}

export async function eventStats(code, season) {
  if (Number(season) !== 2026) throw Error("Статистика ивента сопоставлена только для сезона BIOBUZZ (2026).");
  if (!/^[A-Za-z0-9]{3,20}$/.test(code)) throw Error("Код ивента: 3–20 латинских букв или цифр.");
  const data = await gql(EVENT_2026, { season: 2026, code: code.toUpperCase() });
  const event = data.eventByCode;
  if (!event) throw Error("Ивент не найден на FTCScout.");
  const teams = (event.teams || [])
    .filter((e) => e.stats)
    .map((e) => {
      const s = e.stats;
      return {
        number: String(e.teamNumber),
        name: e.team?.name || `Team ${e.teamNumber}`,
        rank: s.rank,
        rp: s.rp,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        played: s.qualMatchesPlayed,
        opr: {
          total: s.opr.totalPointsNp,
          auto: s.opr.autoPoints,
          autoHive: s.opr.autoHivePoints,
          hive: s.opr.dcHivePoints,
          flower: s.opr.dcFlowerPoints,
          garden: s.opr.dcGardenPoints,
          park: s.opr.dcParkPoints,
        },
        dev: s.dev.totalPointsNp,
      };
    })
    .sort((a, b) => a.rank - b.rank);
  const loc = event.location || {};
  return {
    source: "FTCScout",
    season: 2026,
    code: event.code,
    name: event.name,
    start: event.start,
    end: event.end,
    location: [loc.city, loc.country].filter(Boolean).join(", "),
    matchCount: (event.matches || []).length,
    teams,
    fetchedAt: new Date().toISOString(),
  };
}
