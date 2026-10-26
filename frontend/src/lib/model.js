import { tr } from "./i18n";
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
  const auto = (r.autoLeave ? 3 : 0) + (r.autoPark ? 5 : 0) + num(r.autoHiveTips) * 20;
  const hive = num(r.teleopHiveTips) * 20 + num(r.cellItems) * 2;
  const flower = num(r.ownedFlowerItems) * 2 + num(r.bottomNectar) * 5;
  const field = num(r.gardenItems) + (r.teleopPark ? 5 : 0);
  const foul = num(r.penalties) * 5;
  return { auto, hive, flower, field, foul, total: Math.max(0, auto + hive + flower + field - foul) };
}

export function rowsFor(db, id) {
  return db.records.filter((x) => x.teamId === id && (!db.meta.eventCode || x.eventCode === db.meta.eventCode));
}

export function stats(db, t) {
  if (!t) return null;
  const rs = rowsFor(db, t.id);
  const bs = rs.map(breakdown);
  const values = bs.map((x) => x.total);
  const count = rs.length;
  const mean = avg(values);
  const spread = sd(values);
  const auto = avg(bs.map((x) => x.auto));
  const hive = avg(bs.map((x) => x.hive));
  const flower = avg(bs.map((x) => x.flower));
  const dnf = count ? rs.filter((x) => x.disabled).length / count : 0;
  const consistency = clamp(100 - (spread / Math.max(25, mean || 25)) * 100, 15, 98);
  return {
    team: t,
    records: rs,
    count,
    mean,
    sd: spread,
    auto,
    hive,
    flower,
    field: avg(bs.map((x) => x.field)),
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
    confidence: count >= 8 ? tr("Высокая") : count >= 4 ? tr("Средняя") : count ? tr("Низкая") : tr("Нет данных"),
    consistency,
    profile: {
      auto: clamp((auto / 30) * 100, 0, 100),
      hive: clamp((hive / 60) * 100, 0, 100),
      flower: clamp((flower / 35) * 100, 0, 100),
      reliability: clamp((100 - Math.min((spread / Math.max(1, mean)) * 100, 70)) * (1 - dnf), 0, 100),
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

export function roleLabel(s) {
  const hive = s.profile.hive;
  const flower = s.profile.flower;
  const auto = s.profile.auto;
  if (hive >= flower + 12 && hive >= 45) return tr("Hive-специалист");
  if (flower >= hive + 12 && flower >= 40) return tr("Flower / Endgame-специалист");
  if (auto >= 55 && hive >= 40) return "Auto-Hive";
  return tr("Сбалансированный");
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
    risk += 8;
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
  const dnfPenalty = (a.dnf + b.dnf) * 18;
  const score = clamp(cover * 0.42 + hiveFlower * 0.22 + complement * 0.08 + stability * 0.16 + dataFactor * 14 - dnfPenalty - collision.score * 0.12, 0, 100);
  const synergyPts = Math.round((score - 50) * 0.12 * 10) / 10;
  const roles = [roleLabel(a), roleLabel(b)];
  return {
    a,
    b,
    score,
    cover,
    complement,
    stability,
    mean: Math.max(0, a.mean + b.mean + synergyPts),
    sd: Math.sqrt(a.sd * a.sd + b.sd * b.sd + 25),
    collision,
    roles,
    complementaryRoles: (roles[0].includes("Hive") && roles[1].includes("Flower")) || (roles[1].includes("Hive") && roles[0].includes("Flower")),
    dnfIndex: (a.dnf + b.dnf) / 2,
  };
}

function gauss() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulate(db, ids, iterations = 1000) {
  const [a, b, c, d] = ids;
  const left = pairModel(db, a, b);
  const right = pairModel(db, c, d);
  if (!left || !right) return null;
  let wins = 0;
  let loss = 0;
  let ties = 0;
  const diff = [];
  let flowerLoss = 0;
  let hiveLoss = 0;
  for (let i = 0; i < iterations; i++) {
    const hit = Math.random() < left.collision.score / 220;
    let x = left.mean + gauss() * left.sd;
    const y = right.mean + gauss() * right.sd;
    if (hit) x -= 18 + Math.random() * 12;
    diff.push(x - y);
    if (Math.abs(x - y) < 1) ties += 1;
    else if (x > y) wins += 1;
    else {
      loss += 1;
      if (left.a.flower + left.b.flower < right.a.flower + right.b.flower) flowerLoss += 1;
      if (left.a.hive + left.b.hive < right.a.hive + right.b.hive) hiveLoss += 1;
    }
  }
  const p = (wins + ties * 0.5) / iterations;
  const margin = 1.96 * Math.sqrt((p * (1 - p)) / iterations) * 100;
  const risks = [];
  if (left.a.count + left.b.count + right.a.count + right.b.count < 8) {
    risks.push(tr("Мало наблюдений: интервал неопределённости широкий. Решение драфта стоит сверять с живым скаутингом."));
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
    winPct: Math.round((wins / iterations) * 1000) / 10,
    lossPct: Math.round((loss / iterations) * 1000) / 10,
    tiePct: Math.round((ties / iterations) * 1000) / 10,
    mean1: left.mean,
    mean2: right.mean,
    ciLow: Math.round(clamp(p * 100 - margin, 0, 100)),
    ciHigh: Math.round(clamp(p * 100 + margin, 0, 100)),
    diff,
    risks,
    left,
    right,
  };
}

export function denialPick(db, captainId, pool) {
  const remaining = pool.filter((t) => t.id !== captainId);
  if (remaining.length < 2) return null;
  const opponentCaps = remaining.slice(0, Math.min(6, remaining.length));
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
