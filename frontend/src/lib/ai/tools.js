// Strategist tools, executed IN THE BROWSER over the local scouting database.
// The model only sees what these functions return. Every result is plain JSON, rounded and
// size-capped. Tools of kind "action" are run only after the user approves them (agent.js).
import { addRecord, findDuplicate, updateTeam } from "../db";
import { allStats, breakdown, calibration, computeOpr, denialPick, pairModel, predictMatch, roleCode, round, simulate, stats } from "../model";

export const TOOL_KINDS = {
  get_event_overview: "read",
  get_rankings: "read",
  get_team: "read",
  compare_alliance: "read",
  simulate_match: "read",
  get_schedule: "read",
  find_best_partners: "read",
  get_scouting_gaps: "read",
  find_anomalies: "read",
  search_records: "read",
  remember: "action", // persistent: approved by the user (guards against injected notes)
  open_page: "assist",
  set_draft: "action",
  mark_teams_picked: "action",
  save_team_note: "action",
  add_observation: "action",
};

const MAX_RESULT = 12000;

export class ToolError extends Error {}

const str = (v) => String(v ?? "").trim();
const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function brief(s) {
  if (!s.count) {
    // No scouting for this team: say so instead of reporting model zeros.
    return { team: s.team.number, name: s.team.name || "", matches: 0, scouting: "none", role: null, score: null, sd: null };
  }
  return {
    team: s.team.number,
    name: s.team.name || "",
    role: roleCode(s),
    score: round(s.mean),
    sd: round(s.sd),
    matches: s.count,
    auto: round(s.auto),
    hive: round(s.hive),
    flower: round(s.flower),
    reliability: round(s.profile.reliability, 0),
    dnfPct: Math.round(s.dnf * 100),
  };
}

function eventScouted(db) {
  return db.records.some((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode);
}

function scheduleOf(db) {
  return db.schedule && db.schedule.eventCode === db.meta.eventCode ? db.schedule : null;
}

/**
 * @param {object} env
 * @param {() => object} env.getDb       latest database
 * @param {(fn: Function) => void} env.setDb  functional update
 * @param {() => object} env.getPrefs
 * @param {(page: string, param?: string) => void} env.go
 * @param {{add: (text: string) => object}} env.memory
 */
export function createToolbox(env) {
  const db = () => env.getDb();
  const teamBy = (num, required = true) => {
    const n = str(num);
    const t = db().teams.find((x) => x.number === n || x.id === n);
    if (!t && required) throw new ToolError(`Team ${n || "(empty)"} is not in this event's team list.`);
    return t;
  };
  const oprResult = () => computeOpr(scheduleOf(db())?.matches);
  const shareNotes = () => env.getPrefs().aiShareNotes !== false;

  const executors = {
    get_event_overview() {
      const d = db();
      const ss = allStats(d);
      const sched = scheduleOf(d);
      const prefs = env.getPrefs();
      const upcoming = (sched?.matches || []).filter((m) => m.level === "qual" && !m.played);
      const cap = d.teams.find((t) => t.id === d.draft?.captain);
      const partner = d.teams.find((t) => t.id === d.draft?.picked?.[0]);
      return {
        event: { name: d.meta.eventName, code: d.meta.eventCode, season: d.meta.season, demoData: Boolean(d.meta.demo) },
        teams: d.teams.length,
        observations: d.records.filter((r) => !d.meta.eventCode || r.eventCode === d.meta.eventCode).length,
        teamsScouted: ss.filter((s) => s.count).length,
        teamsWith4PlusObservations: ss.filter((s) => s.count >= 4).length,
        schedule: sched ? { matches: sched.matches.length, played: sched.matches.filter((m) => m.played).length, nextQual: upcoming[0]?.number ?? null } : "not loaded",
        myTeam: prefs.myTeam || null,
        draft: { captain: cap?.number || null, partner: partner?.number || null, takenByOthers: (d.draft?.removed || []).length },
        modelAccuracyOnPlayedMatches: sched ? calibration(d, sched.matches) : null,
      };
    },

    get_rankings({ sort_by = "score", limit = 10 } = {}) {
      const d = db();
      const opr = oprResult();
      const n = clampInt(limit, 1, 40, 10);
      const rows = allStats(d).map((s) => ({ ...brief(s), opr: opr.opr.has(s.team.number) ? round(opr.opr.get(s.team.number)) : null }));
      let key = { score: "score", opr: "opr", auto: "auto", hive: "hive", flower: "flower", reliability: "reliability", matches: "matches" }[sort_by] || "score";
      const scouted = eventScouted(d);
      if (!scouted && key !== "opr" && opr.matches) key = "opr"; // nothing scouted yet: official OPR is the only real signal
      rows.sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
      return {
        sortedBy: key,
        basis: key === "opr" ? "opr" : "scouting",
        teams: rows.slice(0, n),
        note: scouted ? "score = scouted contribution per match (model estimate); opr = from official alliance scores" : "No scouting records yet: ranked by official OPR. Scouting-based fields are null.",
      };
    },

    get_team({ team }) {
      const d = db();
      const t = teamBy(team);
      const s = stats(d, t);
      const opr = oprResult();
      const sched = scheduleOf(d);
      const theirs = (sched?.matches || []).filter((m) => [...m.red, ...m.blue].includes(t.number));
      const played = theirs.filter((m) => m.played);
      const won = played.filter((m) => (m.red.includes(t.number) ? m.redScore > m.blueScore : m.blueScore > m.redScore)).length;
      const side = (m) => (m.red.includes(t.number) ? ["red", m.red, m.blue] : ["blue", m.blue, m.red]);
      const official = played.length ? { played: played.length, won } : null;
      const upcoming = theirs
        .filter((m) => !m.played)
        .slice(0, 5)
        .map((m) => {
          const [alliance, own, opp] = side(m);
          return { match: m.number, level: m.level, alliance, partner: own.filter((x) => x !== t.number), opponents: opp };
        });
      const teamOpr = opr.opr.has(t.number) ? round(opr.opr.get(t.number)) : null;
      const allOpr = [...opr.opr.values()].sort((a, b) => b - a);
      const oprContext = teamOpr === null || !allOpr.length ? null : {
        eventAverage: round(allOpr.reduce((x, y) => x + y, 0) / allOpr.length),
        rank: allOpr.findIndex((v) => round(v) === teamOpr) + 1,
        ofTeams: allOpr.length,
      };
      if (!s.count) {
        // Unscouted: only real data (official results), no model estimates.
        return {
          ...brief(s),
          region: t.region || "",
          opr: teamOpr,
          oprContext,
          official,
          strategyNote: shareNotes() ? t.notes || "" : "(notes not shared)",
          upcoming,
          note: "This team has not been scouted yet; use OPR and official results, and suggest scouting it.",
        };
      }
      return {
        ...brief(s),
        region: t.region || "",
        profile0to100: { auto: round(s.profile.auto, 0), hive: round(s.profile.hive, 0), flower: round(s.profile.flower, 0), reliability: round(s.profile.reliability, 0) },
        consistency: round(s.consistency, 0),
        parkRatePct: Math.round(s.parkRate * 100),
        avgAutoTips: round(s.autoTips),
        avgTeleopTips: round(s.teleopTips),
        avgFlowerPlaced: round(s.flowerPlaced),
        cycles: { pollenSec: round(s.pollenCycle) || null, nectarSec: round(s.nectarCycle) || null },
        autonomousLanes: s.trajectories.filter((x) => x !== "unknown"),
        confidence: s.confidenceLevel,
        opr: teamOpr,
        oprContext,
        official,
        strategyNote: shareNotes() ? t.notes || "" : "(notes not shared)",
        recentMatches: [...s.records]
          .sort((a, b) => (b.matchNo || 0) - (a.matchNo || 0))
          .slice(0, 12)
          .map((r) => ({ match: r.matchNo || null, ...breakdown(r), disabled: r.disabled, note: shareNotes() ? (r.notes || "").slice(0, 160) : undefined })),
        upcoming,
      };
    },

    compare_alliance({ teams }) {
      if (!Array.isArray(teams) || teams.length !== 2) throw new ToolError("Give exactly two team numbers.");
      const [a, b] = teams.map((x) => teamBy(x));
      const p = pairModel(db(), a.id, b.id);
      if (!p.a.count && !p.b.count) {
        const opr = oprResult().opr;
        const known = opr.has(a.number) && opr.has(b.number);
        return {
          teams: [a.number, b.number],
          basis: known ? "opr" : "none",
          expectedPoints: known ? round(opr.get(a.number) + opr.get(b.number)) : null,
          oprEach: known ? [round(opr.get(a.number)), round(opr.get(b.number))] : null,
          note: "Neither team is scouted yet: role synergy and collision risk cannot be estimated; expected points are the sum of official OPR.",
        };
      }
      return {
        teams: [a.number, b.number],
        synergy: round(p.score, 0),
        coverage: round(p.cover, 0),
        complementarity: round(p.complement, 0),
        roles: p.roleCodes,
        complementaryHiveFlower: p.complementaryRoles,
        expectedPoints: round(p.mean, 0),
        sd: round(p.sd, 0),
        dnfIndexPct: Math.round(p.dnfIndex * 100),
        collision: { level: p.collision.level, score: p.collision.score, lanes: p.collision.lanes, reasons: p.collision.reasons },
      };
    },

    simulate_match({ red, blue }) {
      if (!Array.isArray(red) || !Array.isArray(blue) || red.length !== 2 || blue.length !== 2) throw new ToolError("red and blue need two team numbers each.");
      const ids = [...red, ...blue].map((x) => teamBy(x).id);
      if (new Set(ids).size !== 4) throw new ToolError("The four teams must be different.");
      const d0 = db();
      const scoutedCount = ids.reduce((acc, id) => acc + stats(d0, d0.teams.find((t) => t.id === id)).count, 0);
      if (!scoutedCount) {
        const p = predictMatch(d0, red.map(str), blue.map(str), oprResult()).opr;
        if (!p) return { error: "No scouting and no official results for these teams yet — nothing to simulate." };
        return {
          red: red.map(str),
          blue: blue.map(str),
          basis: "opr",
          redWinPct: Math.round(p.pRed * 100),
          blueWinPct: 100 - Math.round(p.pRed * 100),
          meanRed: round(p.red, 0),
          meanBlue: round(p.blue, 0),
          note: "No scouting for these teams: forecast from official OPR (normal model).",
        };
      }
      const r = simulate(d0, ids, 2000, { seed: 2026 });
      return {
        red: red.map(str),
        blue: blue.map(str),
        iterations: r.iterations,
        redWinPct: r.winPct,
        blueWinPct: r.lossPct,
        tiePct: r.tiePct,
        credibleInterval95RedWinPct: [r.ciLow, r.ciHigh],
        meanRed: round(r.mean1, 0),
        meanBlue: round(r.mean2, 0),
        risks: r.risks,
      };
    },

    get_schedule({ filter = "upcoming", team, limit = 12 } = {}) {
      const d = db();
      const sched = scheduleOf(d);
      if (!sched) return { error: "The official schedule is not loaded. Ask the user to open Matches and load it." };
      const opr = oprResult();
      const num = team ? teamBy(team).number : null;
      const n = clampInt(limit, 1, 40, 12);
      const list = sched.matches
        .filter((m) => (filter === "upcoming" ? !m.played : filter === "played" ? m.played : true))
        .filter((m) => !num || [...m.red, ...m.blue].includes(num))
        .slice(0, n)
        .map((m) => {
          const p = predictMatch(d, m.red, m.blue, opr);
          return {
            match: m.number,
            level: m.level,
            time: m.time,
            red: m.red,
            blue: m.blue,
            played: m.played,
            score: m.played ? { red: m.redScore, blue: m.blueScore } : undefined,
            forecastRedWinPct: { scouting: p.scouting ? Math.round(p.scouting.pRed * 100) : null, opr: p.opr ? Math.round(p.opr.pRed * 100) : null },
          };
        });
      return { filter, team: num, matches: list, totalMatches: sched.matches.length };
    },

    find_best_partners({ captain, limit = 8 } = {}) {
      const d = db();
      const cap = teamBy(captain);
      const taken = new Set([...(d.draft?.removed || [])]);
      const pool = d.teams.filter((t) => t.id !== cap.id && !taken.has(t.id));
      const n = clampInt(limit, 1, 20, 8);
      const oprMap = oprResult().opr;
      if (!eventScouted(d)) {
        const capOpr = oprMap.get(cap.number) ?? 0;
        const ranked = pool
          .filter((t) => oprMap.has(t.number))
          .map((t) => ({ team: t.number, name: t.name, opr: round(oprMap.get(t.number)), expectedAlliancePoints: round(capOpr + oprMap.get(t.number), 0) }))
          .sort((a, b) => b.opr - a.opr);
        const denial = ranked[0];
        return {
          captain: cap.number,
          basis: "opr",
          note: "No scouting records yet: partners ranked by official OPR. Roles, synergy and collision risk need scouting.",
          excludedTaken: [...taken].map((id) => d.teams.find((t) => t.id === id)?.number).filter(Boolean),
          partners: ranked.slice(0, n),
          denialPick: denial ? { team: denial.team, reason: "highest OPR left in the pool" } : null,
        };
      }
      const ranked = pool
        .map((t) => ({ t, p: pairModel(d, cap.id, t.id), s: stats(d, t) }))
        .sort((a, b) => b.p.score - a.p.score)
        .slice(0, n)
        .map(({ t, p, s }) => ({ team: t.number, name: t.name, role: s.count ? roleCode(s) : null, synergy: round(p.score, 0), expectedAlliancePoints: round(p.mean, 0), opr: oprMap.has(t.number) ? round(oprMap.get(t.number)) : null, collision: p.collision.level, matchesScouted: s.count, note: shareNotes() ? (t.notes || "").slice(0, 120) : undefined }));
      const denial = denialPick(d, cap.id, pool);
      return {
        captain: cap.number,
        excludedTaken: [...taken].map((id) => d.teams.find((t) => t.id === id)?.number).filter(Boolean),
        partners: ranked,
        denialPick: denial ? { team: denial.team.number, threatToUs: round(denial.threat, 0), synergyWithUs: round(denial.selfScore, 0) } : null,
      };
    },

    get_scouting_gaps({ limit = 12 } = {}) {
      const d = db();
      const counts = new Map(allStats(d).map((s) => [s.team.id, s.count]));
      const next = new Map();
      (scheduleOf(d)?.matches || [])
        .filter((m) => m.level === "qual" && !m.played)
        .forEach((m) => {
          [...m.red.map((n, i) => [n, `R${i + 1}`]), ...m.blue.map((n, i) => [n, `B${i + 1}`])].forEach(([n, st]) => {
            if (!next.has(n)) next.set(n, { match: m.number, station: st });
          });
        });
      const rows = d.teams
        .map((t) => ({ team: t.number, name: t.name, observations: counts.get(t.id) || 0, nextMatch: next.get(t.number) || null }))
        .filter((x) => x.observations < 4)
        .sort((a, b) => a.observations - b.observations || (a.nextMatch?.match ?? 1e9) - (b.nextMatch?.match ?? 1e9));
      return { teamsBelow4Observations: rows.length, gaps: rows.slice(0, clampInt(limit, 1, 30, 12)) };
    },

    find_anomalies() {
      const d = db();
      const recs = d.records.filter((r) => !d.meta.eventCode || r.eventCode === d.meta.eventCode);
      const num = (id) => d.teams.find((t) => t.id === id)?.number || id;
      const issues = [];
      const seen = new Map();
      recs.forEach((r) => {
        if (!r.matchNo) return;
        const k = `${r.teamId}|${r.matchNo}`;
        if (seen.has(k)) issues.push({ type: "duplicate", team: num(r.teamId), match: r.matchNo, detail: `two observations (${seen.get(k).scout || "?"} / ${r.scout || "?"})` });
        else seen.set(k, r);
      });
      recs.forEach((r) => {
        if (r.bottomNectar > 4 || r.autoHiveTips > 10) issues.push({ type: "impossible", team: num(r.teamId), match: r.matchNo || null, detail: "bottomNectar > 4 or autoHiveTips > 10" });
      });
      allStats(d).forEach((s) => {
        if (s.count < 3) return;
        const totals = s.records.map((r) => breakdown(r).total);
        const m = totals.reduce((a, b) => a + b, 0) / totals.length;
        const sd = Math.sqrt(totals.reduce((a, b) => a + (b - m) ** 2, 0) / totals.length) || 1;
        s.records.forEach((r, i) => {
          const z = (totals[i] - m) / sd;
          if (Math.abs(z) > 2.5) issues.push({ type: "outlier", team: s.team.number, match: r.matchNo || null, detail: `score ${totals[i]} vs team mean ${round(m)} (z=${round(z)})` });
        });
      });
      const opr = oprResult();
      allStats(d).forEach((s) => {
        if (s.count < 3 || !opr.opr.has(s.team.number)) return;
        const o = opr.opr.get(s.team.number);
        if (Math.abs(s.rawMean - o) > Math.max(20, Math.abs(o) * 0.5)) issues.push({ type: "scouting_vs_opr", team: s.team.number, detail: `scouted mean ${round(s.rawMean)} vs OPR ${round(o)}` });
      });
      return { recordsChecked: recs.length, issues: issues.slice(0, 40), note: issues.length ? "" : "No anomalies found." };
    },

    search_records({ team, match, query, limit = 12 } = {}) {
      const d = db();
      const t = team ? teamBy(team) : null;
      const q = str(query).toLowerCase();
      const rows = d.records
        .filter((r) => (!d.meta.eventCode || r.eventCode === d.meta.eventCode) && (!t || r.teamId === t.id) && (!match || r.matchNo === Number(match)))
        .filter((r) => !q || (shareNotes() && (r.notes || "").toLowerCase().includes(q)))
        .sort((a, b) => (b.matchNo || 0) - (a.matchNo || 0))
        .slice(0, clampInt(limit, 1, 30, 12))
        .map((r) => ({
          team: d.teams.find((x) => x.id === r.teamId)?.number || r.teamId,
          match: r.matchNo || null,
          ...breakdown(r),
          autoHiveTips: r.autoHiveTips,
          teleopHiveTips: r.teleopHiveTips,
          flowerPlaced: r.flowerPlaced,
          disabled: r.disabled,
          lane: r.autoTrajectory,
          scout: r.scout || "",
          note: shareNotes() ? r.notes || "" : undefined,
        }));
      return { count: rows.length, records: rows };
    },

    remember({ fact }) {
      const text = str(fact).slice(0, 300);
      if (!text) throw new ToolError("Empty fact.");
      env.memory.add(text);
      return { saved: true, fact: text };
    },

    open_page({ page, team }) {
      const pages = ["overview", "scouting", "matches", "teams", "analysis", "draft", "data"];
      if (!pages.includes(page)) throw new ToolError("Unknown page.");
      const t = team ? teamBy(team, false) : null;
      env.go(page, page === "teams" && t ? t.id : "");
      return { opened: page, team: t?.number || null };
    },

    set_draft({ captain, partner }) {
      const cap = captain ? teamBy(captain) : null;
      const par = partner ? teamBy(partner) : null;
      if (!cap && !par) throw new ToolError("Give a captain and/or a partner.");
      env.setDb((x) => ({ ...x, draft: { ...(x.draft || {}), ...(cap ? { captain: cap.id } : {}), ...(par ? { picked: [par.id] } : cap ? { picked: [] } : {}) } }));
      return { captain: cap?.number || null, partner: par?.number || null };
    },

    mark_teams_picked({ teams }) {
      if (!Array.isArray(teams) || !teams.length) throw new ToolError("Give at least one team number.");
      const ids = teams.map((x) => teamBy(x).id);
      env.setDb((x) => ({ ...x, draft: { ...(x.draft || {}), removed: [...new Set([...(x.draft?.removed || []), ...ids])] } }));
      return { markedTaken: teams.map(str) };
    },

    save_team_note({ team, note, mode = "append" }) {
      const t = teamBy(team);
      const text = str(note).slice(0, 600);
      if (!text) throw new ToolError("Empty note.");
      const next = mode === "replace" || !t.notes ? text : `${t.notes}\n${text}`;
      env.setDb((x) => updateTeam(x, t.id, { notes: next.slice(0, 2000) }));
      return { team: t.number, note: next.slice(0, 2000) };
    },

    add_observation(args) {
      const d = db();
      const t = teamBy(args.team);
      const input = { ...args, teamId: t.id, matchNo: args.match || 0, eventCode: d.meta.eventCode, scout: "VITE AI (approved)", confidence: "medium" };
      delete input.team;
      delete input.match;
      const { record } = addRecord(d, input);
      env.setDb((x) => ({ ...x, records: [...x.records, record], meta: { ...x.meta, demo: false } }));
      return { saved: true, team: t.number, match: record.matchNo || null, points: breakdown(record).total, duplicateOf: findDuplicate(d, record)?.id ? "same team+match already existed" : null };
    },
  };

  return {
    kind: (name) => TOOL_KINDS[name] || null,
    run(name, args) {
      const fn = executors[name];
      if (!fn) throw new ToolError(`Unknown tool ${name}.`);
      const result = fn(args && typeof args === "object" ? args : {});
      let text = JSON.stringify(result);
      if (text.length > MAX_RESULT) text = text.slice(0, MAX_RESULT) + '…"(truncated)"';
      return text;
    },
  };
}
