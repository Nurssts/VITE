import { download, safeFileName, toCsv } from "./csv";
import { allStats, priority, roleLabel, round } from "./model";

export function rankedStats(db) {
  return allStats(db).sort((a, b) => b.mean - a.mean);
}

/** Ranking sheet: plain numbers (dot decimals) so spreadsheets can sort and chart them. */
export function teamsToCsv(db) {
  const head = ["rank", "number", "name", "region", "role", "priority", "matches", "score", "sd", "auto", "hive", "flower", "park_pct", "dnf_pct", "confidence"];
  const rows = rankedStats(db).map((s, i) => [
    i + 1, s.team.number, s.team.name, s.team.region || "", roleLabel(s), priority(s), s.count,
    round(s.mean), round(s.sd), round(s.auto), round(s.hive), round(s.flower),
    Math.round(s.parkRate * 100), Math.round(s.dnf * 100), s.confidence,
  ]);
  return toCsv([head, ...rows]);
}

export function downloadCsv(db) {
  download(`vite-${safeFileName(db.meta.eventCode, "teams")}-ranking.csv`, teamsToCsv(db), "text/csv;charset=utf-8");
}
