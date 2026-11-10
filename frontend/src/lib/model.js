import { tr } from "./i18n";
import gameConfig from "../config/game.biobuzz";

export const MODEL_VERSION = "BIOBUZZ TU05 · 15.10.2026";
export const STORE_KEY = "vite-biobuzz-matrix-v2";
export const PREFS_KEY = "vite-biobuzz-prefs-v1";

const teamsSeed = [
  ["D-101", "HiveLab", "Алматы", "Сильный HIVE"],
  ["D-102", "PetalWorks", "Алматы", "Сильный FLOWER"],
  ["D-103", "Pollen Drive", "Астана", "Сбалансированный"],
  ["D-104", "Nectar Motion", "Алматы", "Высокая автономия"],
  ["D-105", "Green Circuit", "Шымкент", "Стабильная парковка"],
  ["D-106", "Bloom Robotics", "Астана", "Сильный FLOWER"],
  ["D-107", "Cell Seekers", "Караганда", "Сильный HIVE"],
  ["D-108", "Orbit Orchard", "Алматы", "Сбалансированный"],
  ["D-109", "Honeycomb", "Тараз", "Высокая автономия"],
  ["D-110", "Field Notes", "Астана", "Стабильный робот"],
  ["D-111", "Garden State", "Шымкент", "Сильный FLOWER"],
  ["D-112", "Amber Bots", "Караганда", "Сбалансированный"],
];

const profiles = [
  [1, 1, 1.7, 2.2, 2, 3, 2, 1, 4, 1, 0, "left"],
  [1, 0, 0.7, 0.7, 1, 7, 3, 2, 2, 1, 0, "right"],
  [1, 1, 1, 1.5, 2, 3, 2, 1, 3, 1, 0, "center"],
  [1, 1, 1.4, 1.5, 1, 4, 2, 1, 2, 1, 1, "left"],
  [1, 1, 0.5, 0.8, 1, 3, 1, 0, 4, 1, 0, "wall"],
  [1, 0, 0.4, 0.8, 1, 7, 4, 2, 1, 1, 0, "right"],
  [0, 1, 1.3, 2.1, 2, 2, 1, 0, 3, 1, 0, "left"],
  [1, 1, 1, 1.3, 2, 4, 2, 1, 3, 1, 0, "center"],
  [1, 1, 1.5, 1.8, 2, 2, 1, 0, 2, 1, 0, "right"],
  [1, 1, 0.8, 1, 1, 4, 2, 1, 3, 1, 0, "center"],
  [1, 0, 0.5, 0.9, 1, 6, 3, 2, 1, 1, 0, "right"],
  [1, 1, 0.9, 1.2, 2, 3, 2, 1, 3, 1, 0, "left"],
];

export function rngSeed(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export function makeSeed() {
  const teams = teamsSeed.map((t) => ({
    id: t[0],
    number: t[0],
    name: t[1],
    region: t[2],
    style: t[3],
    notes: "",
  }));
  const rand = rngSeed(20262027);
  const records = [];
  teams.forEach((t, i) => {
    const p = profiles[i];
    for (let m = 1; m <= 5; m++) {
      const jit = (a) => Math.round((rand() - 0.5) * a * 2);
      records.push({
        id: `demo-${i}-${m}`,
        teamId: t.id,
        eventCode: "DEMO-ALMATY",
        eventName: "Демо-турнир · учебные данные",
        matchNo: m,
        date: `2026-10-${String(10 + m).padStart(2, "0")}`,
        autoLeave: rand() < 0.88,
        autoPark: rand() < p[1] * 0.74,
        autoHiveTips: Math.max(0, Math.round(p[2] + jit(0.65))),
        teleopHiveTips: Math.max(0, Math.round(p[3] + jit(0.8))),
        cellItems: Math.max(0, Math.round(p[4] + jit(1))),
        flowerPlaced: Math.max(0, Math.round(p[5] + jit(2))),
        ownedFlowerItems: Math.max(0, Math.round(p[6] + jit(1))),
        bottomNectar: Math.max(0, Math.round(p[7] + jit(1))),
        gardenItems: Math.max(0, Math.round(p[8] + jit(2))),
        teleopPark: rand() < p[9] * 0.83,
        penalties: rand() < 0.1 ? p[10] : 0,
        disabled: rand() < 0.035,
        confidence: rand() > 0.14 ? "high" : "medium",
        scout: "Демо-сценарий",
        notes: "",
        autoTrajectory: p[11],
        pollenCycleSec: 8 + Math.round(rand() * 6),
        nectarCycleSec: 10 + Math.round(rand() * 8),
        hiveSuccess: Math.round(55 + rand() * 40),
        flowerAccuracy: Math.round(50 + rand() * 45),
      });
    }
  });
  return {
    version: 2,
    meta: {
      demo: true,
      eventName: "Демо-турнир · учебные данные",
      eventCode: "DEMO-ALMATY",
      season: "2026-2027",
      updatedAt: new Date().toISOString(),
    },
    teams,
    records,
    draft: { captain: "D-101", picked: [], removed: [] },
  };
}

export function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
export function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
export function avg(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}
export function sd(a) {
  if (a.length < 2) return a.length ? Math.max(4, a[0] * 0.17) : 0;
  const m = avg(a);
  return Math.sqrt(avg(a.map((x) => (x - m) ** 2)));
}
export function fmt(v, d = 1) {
  return Number(v || 0).toFixed(d).replace(".", ",");
}

export function breakdown(r) {
  const { points } = gameConfig;
  const auto = (r.autoLeave ? points.autoLeave : 0) + (r.autoPark ? points.autoPark : 0) + num(r.autoHiveTips) * points.autoHiveTip;
  const hive = num(r.teleopHiveTips) * points.teleopHiveTip + num(r.cellItems) * points.cellItem;
  const flower = num(r.ownedFlowerItems) * points.ownedFlowerItem + num(r.bottomNectar) * points.bottomNectar;
  const field = num(r.gardenItems) + (r.teleopPark ? points.teleopPark : 0);
  const foul = num(r.penalties) * points.penalty;
  return { auto, hive, flower, field, foul, total: Math.max(0, auto + hive + flower + field - foul) };
}

export function rowsFor(db, id) {
  return db.records.filter((x) => x.teamId === id && (!db.meta.eventCode || x.eventCode === db.meta.eventCode));
}

const PRIOR_N = 3; // pseudo-observations pulling thin samples toward the event average

export function eventPrior(db) {
  const rs = db.records.filter((x) => !db.meta.eventCode || x.eventCode === db.meta.eventCode);
  const bs = rs.map(breakdown);
  const totals = bs.map((x) => x.total);
  return {
    mean: avg(totals),
    sd: totals.length >= 2 ? sd(totals) : 20,
    dnf: rs.length ? rs.filter((x) => x.disabled).length / rs.length : 0.04,
    auto: avg(bs.map((x) => x.auto)),
    hive: avg(bs.map((x) => x.hive)),
    flower: avg(bs.map((x) => x.flower)),
    field: avg(bs.map((x) => x.field)),
  };
}

export function stats(db, t) {
  if (!t) return null;
  const prior = eventPrior(db);
  const rs = rowsFor(db, t.id);
  const bs = rs.map(breakdown);
  const values = bs.map((x) => x.total);
  const count = rs.length;
  const shrink = (raw, p) => (raw * count + p * PRIOR_N) / (count + PRIOR_N);
  const rawMean = avg(values);
  const rawSd = count >= 2 ? sd(values) : 0;
  const mean = shrink(rawMean, prior.mean);
  const spread = count >= 2 ? Math.sqrt(((count - 1) * rawSd ** 2 + 2 * prior.sd ** 2) / (count + 1)) : prior.sd;
  const se = spread / Math.sqrt(count + PRIOR_N); // uncertainty of the team's true mean
  const auto = shrink(avg(bs.map((x) => x.auto)), prior.auto);
  const hive = shrink(avg(bs.map((x) => x.hive)), prior.hive);
  const flower = shrink(avg(bs.map((x) => x.flower)), prior.flower);
  const dnf = shrink(count ? rs.filter((x) => x.disabled).length / count : 0, prior.dnf);
  const consistency = count >= 2 ? clamp(100 - (rawSd / Math.max(25, rawMean || 25)) * 100, 15, 98) : 50;
  const reliability = count >= 2 ? clamp((100 - Math.min((rawSd / Math.max(1, rawMean)) * 100, 70)) * (1 - dnf), 0, 100) : 50 * (1 - dnf);
  const confidenceLevel = count >= 8 ? "high" : count >= 4 ? "medium" : count ? "low" : "none";
  return {
    team: t,
    records: rs,
    count,
    mean,
    rawMean,
    sd: spread,
    se,
    auto,
    hive,
    flower,
    field: shrink(avg(bs.map((x) => x.field)), prior.field),
    autoTips: avg(rs.map((x) => num(x.autoHiveTips))),
    teleopTips: avg(rs.map((x) => num(x.teleopHiveTips))),
    flowerOwned: avg(rs.map((x) => num(x.ownedFlowerItems))),
    flowerPlaced: avg(rs.map((x) => num(x.flowerPlaced))),
    parkRate: count ? rs.filter((x) => x.teleopPark).length / count : 0,
    dnf,
    pollenCycle: avg(rs.map((x) => num(x.pollenCycleSec)).filter(Boolean)),
    nectarCycle: avg(rs.map((x) => num(x.nectarCycleSec)).filter(Boolean)),
    hiveSuccess: avg(rs.map((x) => num(x.hiveSuccess)).filter(Boolean)),
    flowerAccuracy: avg(rs.map((x) => num(x.flowerAccuracy)).filter(Boolean)),
    trajectories: rs.map((x) => x.autoTrajectory || "unknown"),
    confidenceLevel,
    confidence: { high: tr("Высокая"), medium: tr("Средняя"), low: tr("Низкая"), none: tr("Нет данных") }[confidenceLevel],
    consistency,
    profile: {
      auto: clamp((auto / gameConfig.thresholds.autoThreshold) * 100, 0, 100),
      hive: clamp((hive / gameConfig.thresholds.hiveThreshold) * 100, 0, 100),
      flower: clamp((flower / gameConfig.thresholds.flowerThreshold) * 100, 0, 100),
      reliability,
    },
  };
}

export function allStats(db) {
  return db.teams.map((t) => stats(db, t));
}

export function priority(s) {
  if (!s?.count) return "—";
  if (s.mean >= 70 && s.consistency >= 62) return "A";
  if (s.mean >= 46) return "Б";
  return "В";
}

export function roleCode(s) {
  const { hive, flower, auto } = s.profile;
  const { thresholds } = gameConfig;
  if (hive >= flower + 12 && hive >= thresholds.hiveThreshold - 15) return "HIVE";
  if (flower >= hive + 12 && flower >= thresholds.flowerThreshold + 5) return "FLOWER";
  if (auto >= 55 && hive >= thresholds.hiveThreshold - 20) return "AUTO_HIVE";
  return "BALANCED";
}

export function roleLabel(s) {
  const c = roleCode(s);
  if (c === "AUTO_HIVE") return "Auto-Hive";
  return tr({ HIVE: "Hive-специалист", FLOWER: "Flower / Endgame-специалист", BALANCED: "Сбалансированный" }[c]);
}

function modeTraj(values) {
  const filtered = (values || []).filter((v) => v && v !== "unknown");
  if (!filtered.length) return "unknown";
  const map = {};
  filtered.forEach((v) => (map[v] = (map[v] || 0) + 1));
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
}

export function collisionCheck(a, b) {
  const ta = modeTraj(a.trajectories);
  const tb = modeTraj(b.trajectories);
  const bothAuto = a.profile.auto >= 48 && b.profile.auto >= 48;
  const sameLane = ta === tb && !["unknown", "wall"].includes(ta);
  const hiveOverlap = a.autoTips >= 1.1 && b.autoTips >= 1.1;
  let risk = 0;
  const reasons = [];
  if (sameLane && bothAuto) {
    risk += 42;
    reasons.push(tr("Одинаковая траектория автонома ({ta}): риск столкновения на старте.").replace("{ta}", ta));
  }
  if (hiveOverlap) {
    risk += 28;
    reasons.push(tr("Оба робота активно TIP-ят HIVE в Auto — конкуренция за одну конструкцию."));
  }
  if (bothAuto && !sameLane && ta !== "unknown" && tb !== "unknown") {
    reasons.push(tr("Оба сильные в Auto, но разные зоны — столкновение менее вероятно."));
  }
  risk = clamp(risk, 0, 100);
  if (!reasons.length) reasons.push(tr("По скаутингу нет явного пересечения автономов. Это оценка, не гарантия."));
  return { score: Math.round(risk * 10) / 10, level: risk >= 55 ? "high" : risk >= 28 ? "medium" : "low", reasons, lanes: [ta, tb] };
}

export function pairModel(db, x, y) {
  const a = typeof x === "string" ? stats(db, db.teams.find((t) => t.id === x)) : x;
  const b = typeof y === "string" ? stats(db, db.teams.find((t) => t.id === y)) : y;
  if (!a || !b) return null;
  const keys = ["auto", "hive", "flower", "reliability"];
  const cover = avg(keys.map((k) => Math.max(a.profile[k], b.profile[k])));
  const complement = avg(keys.map((k) => Math.abs(a.profile[k] - b.profile[k])));
  const hiveFlower = Math.abs(a.profile.hive - b.profile.hive) * 0.35 + Math.abs(a.profile.flower - b.profile.flower) * 0.35;
  const dataFactor = Math.min(1, (a.count + b.count) / 12);
  const stability = avg([a.consistency, b.consistency]);
  const collision = collisionCheck(a, b);
  const { synergy, collision: colConfig } = gameConfig;
  const dnfPenalty = (a.dnf + b.dnf) * synergy.dnfPenaltyWeight;
  const score = clamp(
    cover * synergy.coverWeight +
    hiveFlower * synergy.hiveFlowerWeight +
    complement * synergy.complementWeight +
    stability * synergy.stabilityWeight +
    dataFactor * synergy.dataFactorWeight -
    dnfPenalty -
    collision.score * synergy.collisionPenaltyWeight,
    0,
    100
  );
  const synergyPts = Math.round((score - 50) * 0.12 * 10) / 10;
  const roles = [roleLabel(a), roleLabel(b)];
  const roleCodes = [roleCode(a), roleCode(b)];
  return {
    a,
    b,
    score,
    cover,
    complement,
    stability,
    mean: Math.max(0, a.mean + b.mean + synergyPts),
    sd: Math.sqrt(a.sd * a.sd + b.sd * b.sd + 25),
    se: Math.sqrt(a.se * a.se + b.se * b.se),
    collision,
    roles,
    roleCodes,
    complementaryRoles: roleCodes.includes("HIVE") && roleCodes.includes("FLOWER"),
    dnfIndex: (a.dnf + b.dnf) / 2,
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGauss(rnd) {
  return () => {
    let u = 0;
    let v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

// Standard normal CDF (Abramowitz-Stegun 26.2.17).
function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function percentile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
}

/**
 * Monte-Carlo series. opts.seed makes a run reproducible.
 * Each iteration first draws every alliance's TRUE mean from its uncertainty (se),
 * then draws the match score around it. ciLow/ciHigh is therefore a credible interval for
 * P(Alliance 1 wins) that widens when scouting data is thin; mcMarginPct is only the sampling error.
 */
export function simulate(db, ids, iterations = gameConfig.monteCarlo.defaultIterations, opts = {}) {
  const [a, b, c, d] = ids;
  const left = pairModel(db, a, b);
  const right = pairModel(db, c, d);
  if (!left || !right) return null;
  const seed = opts.seed ?? Math.floor(Math.random() * gameConfig.monteCarlo.seedPrecision);
  const rnd = mulberry32(seed);
  const gauss = makeGauss(rnd);
  const { collision: colConfig } = gameConfig;
  const pHitL = left.collision.score / colConfig.hitDiv;
  const pHitR = right.collision.score / colConfig.hitDiv;
  const expLoss = colConfig.hitLossBase + colConfig.hitLossVar / 2;
  const sdPair = Math.sqrt(left.sd ** 2 + right.sd ** 2);
  let wins = 0;
  let loss = 0;
  let ties = 0;
  let flowerLoss = 0;
  let hiveLoss = 0;
  const diff = [];
  const pCond = [];
  for (let i = 0; i < iterations; i++) {
    const muL = left.mean + gauss() * left.se;
    const muR = right.mean + gauss() * right.se;
    let x = muL + gauss() * left.sd;
    let y = muR + gauss() * right.sd;
    if (rnd() < pHitL) x -= colConfig.hitLossBase + rnd() * colConfig.hitLossVar;
    if (rnd() < pHitR) y -= colConfig.hitLossBase + rnd() * colConfig.hitLossVar;
    x = Math.max(0, Math.round(x));
    y = Math.max(0, Math.round(y));
    diff.push(x - y);
    pCond.push(phi((muL - pHitL * expLoss - (muR - pHitR * expLoss)) / sdPair));
    if (x === y) ties += 1;
    else if (x > y) wins += 1;
    else {
      loss += 1;
      if (left.a.flower + left.b.flower < right.a.flower + right.b.flower) flowerLoss += 1;
      if (left.a.hive + left.b.hive < right.a.hive + right.b.hive) hiveLoss += 1;
    }
  }
  const p = (wins + ties * 0.5) / iterations;
  const mcMargin = 1.96 * Math.sqrt((p * (1 - p)) / iterations) * 100;
  const sortedP = [...pCond].sort((m, n) => m - n);
  const ciLow = Math.round(percentile(sortedP, 0.025) * 100);
  const ciHigh = Math.round(percentile(sortedP, 0.975) * 100);
  const risks = [];
  if (left.a.count + left.b.count + right.a.count + right.b.count < 8) {
    risks.push(tr("Мало наблюдений: интервал неопределённости широкий. Решение драфта стоит сверять с живым скаутингом."));
  } else if (ciHigh - ciLow >= 40) {
    risks.push(tr("Интервал победы очень широкий: данных пока недостаточно для уверенного прогноза."));
  }
  if (loss && flowerLoss / loss >= 0.55) {
    risks.push(tr("В {n}% смоделированных поражений у Альянса 1 слабее вклад в FLOWER (последняя минута).").replace("{n}", Math.round((flowerLoss / loss) * 100)));
  }
  if (loss && hiveLoss / loss >= 0.55) {
    risks.push(tr("В {n}% поражений узкое место — контроль HIVE.").replace("{n}", Math.round((hiveLoss / loss) * 100)));
  }
  if (left.collision.level !== "low") risks.push("Autonomous Collision Check: " + left.collision.reasons[0]);
  if (left.dnfIndex >= 0.08) risks.push(tr("Индекс надёжности снижен: в скаутинге есть отключения/DNF."));
  if (!risks.length) {
    risks.push(tr("Явного узкого места по FLOWER/HIVE не видно. Модель не учитывает полностью защиту, конкуренцию за элементы и решения судей."));
  }
  return {
    iterations,
    seed,
    winPct: Math.round((wins / iterations) * 1000) / 10,
    lossPct: Math.round((loss / iterations) * 1000) / 10,
    tiePct: Math.round((ties / iterations) * 1000) / 10,
    mean1: left.mean,
    mean2: right.mean,
    ciLow,
    ciHigh,
    mcMarginPct: Math.round(mcMargin * 10) / 10,
    diff,
    risks,
    left,
    right,
  };
}

export function denialPick(db, captainId, pool) {
  const remaining = pool.filter((t) => t.id !== captainId);
  if (remaining.length < 2) return null;
  // Likely opposing captains: the strongest remaining teams (pass `pool` ordered by seed to refine).
  const opponentCaps = [...remaining]
    .map((team) => ({ team, mean: stats(db, team).mean }))
    .sort((x, y) => y.mean - x.mean)
    .slice(0, Math.min(6, remaining.length))
    .map((x) => x.team);
  let best = null;
  remaining.forEach((candidate) => {
    let threat = 0;
    opponentCaps.forEach((cap) => {
      if (cap.id === candidate.id) return;
      const m = pairModel(db, cap.id, candidate.id);
      if (m) threat = Math.max(threat, m.score);
    });
    const self = pairModel(db, captainId, candidate.id);
    const denialValue = threat - (self?.score || 0) * 0.35;
    if (!best || denialValue > best.denialValue) {
      best = { team: candidate, threat, selfScore: self?.score || 0, denialValue };
    }
  });
  return best;
}

export function initials(t) {
  return (t?.name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}

export function teamLabel(t) {
  return t ? `${t.number} · ${t.name}` : tr("Команда не выбрана");
}
