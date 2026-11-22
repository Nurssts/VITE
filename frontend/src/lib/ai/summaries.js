// One-line, human summaries of what each Strategist tool returned.
// The raw tool data is for the model only; people see a short sentence instead of JSON.
import { fmt } from "../model";
import { tr } from "../i18n";

const num = (v, d = 0) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : fmt(v, d));
const list = (arr, n = 3) => (arr || []).slice(0, n).join(", ");

function parse(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** @returns {string} short text for the activity row (may be empty) */
export function summarizeTool(name, result) {
  if (!result) return "";
  if (result.status === "declined") return tr("Вы отклонили это действие.");
  const d = parse(result.content);
  if (!d) return result.isError ? tr("Инструмент не сработал.") : "";
  if (d.error) return `${tr("Не получилось")}: ${d.error}`;

  switch (name) {
    case "get_event_overview": {
      const sched = typeof d.schedule === "object" && d.schedule ? `${tr("сыграно")} ${d.schedule.played}/${d.schedule.matches}` : tr("расписания нет");
      return `${d.teams} ${tr("команд")} · ${d.observations} ${tr("наблюдений")} · ${sched}`;
    }
    case "get_rankings": {
      const key = d.sortedBy === "opr" ? "opr" : d.sortedBy === "matches" ? "matches" : d.sortedBy;
      const top = (d.teams || []).slice(0, 3).map((t) => `${t.team} (${num(t[key], key === "opr" || key === "score" ? 1 : 0)})`);
      return `${d.sortedBy === "opr" ? "OPR" : tr("Оценка")}: ${top.join(", ") || "—"}${d.note && d.basis === "opr" ? ` · ${tr("по официальному OPR")}` : ""}`;
    }
    case "get_team": {
      const parts = [`${d.team}${d.name ? ` ${d.name}` : ""}`];
      if (d.opr !== null && d.opr !== undefined) parts.push(`OPR ${num(d.opr, 1)}`);
      if (d.official) parts.push(`${tr("победы")} ${d.official.won}/${d.official.played}`);
      parts.push(d.matches ? `${tr("оценка")} ${num(d.score, 1)} ± ${num(d.sd, 0)} (${d.matches} ${tr("набл.")})` : tr("скаутинга нет"));
      return parts.join(" · ");
    }
    case "compare_alliance":
      return d.basis === "opr"
        ? `${(d.teams || []).join(" + ")}: ${tr("сумма OPR")} ${num(d.expectedPoints, 0)}`
        : `${(d.teams || []).join(" + ")}: ${tr("синергия")} ${num(d.synergy)} · ${tr("ожидаемо")} ${num(d.expectedPoints)} ${tr("очк.")} · ${tr("коллизия")} ${d.collision?.level || "—"}`;
    case "simulate_match":
      return `${tr("Красные")} ${num(d.redWinPct, 0)}% · ${tr("синие")} ${num(d.blueWinPct, 0)}%${d.credibleInterval95RedWinPct ? ` (${d.credibleInterval95RedWinPct[0]}–${d.credibleInterval95RedWinPct[1]}%)` : ""}${d.basis === "opr" ? ` · ${tr("по OPR")}` : ""}`;
    case "get_schedule": {
      const m = (d.matches || [])[0];
      return `${(d.matches || []).length} ${tr("матчей")}${m ? ` · Q${m.match}: ${(m.red || []).join("+")} vs ${(m.blue || []).join("+")}` : ""}`;
    }
    case "find_best_partners":
      return `${tr("Лучшие")}: ${list((d.partners || []).map((p) => p.team)) || "—"}${d.denialPick ? ` · denial: ${d.denialPick.team}` : ""}${d.basis === "opr" ? ` · ${tr("по OPR")}` : ""}`;
    case "get_scouting_gaps":
      return `${d.teamsBelow4Observations} ${tr("команд с малым скаутингом")}${d.gaps?.length ? `: ${list(d.gaps.map((g) => g.team), 4)}` : ""}`;
    case "find_anomalies":
      return `${tr("Проверено записей")}: ${d.recordsChecked} · ${tr("проблем")}: ${(d.issues || []).length}`;
    case "search_records":
      return `${tr("Найдено наблюдений")}: ${d.count}`;
    case "remember":
      return `${tr("Сохранено в память")}: «${d.fact}»`;
    case "open_page":
      return `${tr("Открыт раздел")} ${d.opened}`;
    case "set_draft":
      return `${tr("Доска драфта обновлена")}${d.captain ? ` · ${tr("капитан")} ${d.captain}` : ""}${d.partner ? ` · ${tr("партнёр")} ${d.partner}` : ""}`;
    case "mark_teams_picked":
      return `${tr("Отмечены как взятые")}: ${list(d.markedTaken, 12)}`;
    case "save_team_note":
      return `${tr("Заметка сохранена для")} ${d.team}`;
    case "add_observation":
      return `${tr("Наблюдение сохранено")}: ${d.team}${d.match ? ` · Q${d.match}` : ""} · ${d.points} ${tr("очк.")}`;
    default:
      return "";
  }
}
