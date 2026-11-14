import { allStats, fmt, priority, roleLabel } from "./model";

// Neutralise spreadsheet formula injection (names/regions come from external APIs).
function cell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function rankedStats(db) {
  return allStats(db).sort((a, b) => b.mean - a.mean);
}

export function teamsToCsv(db) {
  const head = ["rank", "number", "name", "region", "role", "priority", "matches", "score", "sd", "auto", "hive", "flower", "park_pct", "dnf_pct", "confidence"];
  const rows = rankedStats(db).map((s, i) => [
    i + 1,
    s.team.number,
    s.team.name,
    s.team.region || "",
    roleLabel(s),
    priority(s),
    s.count,
    fmt(s.mean),
    fmt(s.sd),
    fmt(s.auto),
    fmt(s.hive),
    fmt(s.flower),
    Math.round(s.parkRate * 100),
    Math.round(s.dnf * 100),
    s.confidence,
  ]);
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(db) {
  // BOM so Excel opens Cyrillic correctly
  const blob = new Blob(["\ufeff" + teamsToCsv(db)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const code = (db.meta.eventCode || "teams").replace(/[^\w-]/g, "_");
  a.href = url;
  a.download = `vite-${code}-ranking.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
