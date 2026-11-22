import { useMemo } from "react";
import { ClipboardList, Sparkles, Users } from "lucide-react";
import { Badge, Button, DemoBanner, EmptyState, Kpi, PageHeader, Panel, ProfileBars, td, th } from "../components/ui";
import { allStats, avg, computeOpr, fmt, MODEL_VERSION, priority, roleLabel } from "../lib/model";
import { t, tr } from "../lib/i18n";

export default function Overview({ db, lang, go, setPrefs }) {
  const ss = useMemo(() => allStats(db), [db]);
  const ranked = useMemo(() => ss.filter((s) => s.count).sort((a, b) => b.mean - a.mean), [ss]);
  const total = db.records.filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode).length;
  const top = ranked[0];
  const max = Math.max(1, ...ranked.slice(0, 10).map((s) => s.mean + s.sd));
  // No scouting yet: show the strongest teams by official OPR instead of an empty chart.
  const oprTop = useMemo(() => {
    if (ranked.length) return [];
    const opr = computeOpr(db.schedule?.eventCode === db.meta.eventCode ? db.schedule.matches : []).opr;
    const byNumber = new Map(db.teams.map((t) => [t.number, t]));
    return [...opr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, v]) => ({ team: byNumber.get(n) || { id: n, number: n, name: "" }, opr: v }));
  }, [ranked.length, db.schedule, db.meta.eventCode, db.teams]);
  const oprMax = Math.max(1, ...oprTop.map((x) => x.opr));
  const scouted = ss.filter((s) => s.count).length;

  // Who to scout next: teams in the next unplayed matches first, then the least observed teams.
  const nextUp = useMemo(() => {
    const counts = new Map(ss.map((s) => [s.team.id, s.count]));
    const byNumber = new Map(db.teams.map((t) => [t.number, t]));
    const upcoming = (db.schedule?.matches || []).filter((m) => m.level === "qual" && !m.played).slice(0, 6);
    const seen = new Set();
    const list = [];
    upcoming.forEach((m) =>
      [...m.red, ...m.blue].forEach((n) => {
        const team = byNumber.get(n);
        if (team && !seen.has(team.id) && (counts.get(team.id) || 0) < 4) {
          seen.add(team.id);
          list.push({ team, count: counts.get(team.id) || 0, match: m.number });
        }
      })
    );
    ss.filter((s) => !seen.has(s.team.id))
      .sort((a, b) => a.count - b.count)
      .forEach((s) => list.push({ team: s.team, count: s.count }));
    return list.slice(0, 6);
  }, [db, ss]);

  const changeEvent = () => setPrefs((p) => ({ ...p, event: { ...p.event, set: false, changing: true } }));

  return (
    <div>
      <PageHeader
        title={db.meta.eventName || t(lang, "tournament_overview")}
        subtitle={[db.meta.eventCode, db.meta.season, MODEL_VERSION].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="secondary" onClick={() => go("ai")}>
              <Sparkles size={15} aria-hidden="true" />
              Strategist
            </Button>
            <Button variant="secondary" onClick={() => go("matches")}>
              {tr("Матчи")}
            </Button>
            <Button onClick={() => go("scouting")}>{t(lang, "record_match")}</Button>
          </>
        }
      />

      <DemoBanner demo={db.meta.demo} onReplace={changeEvent} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t(lang, "kpi_teams")} value={db.teams.length} foot={`${scouted} ${tr("со скаутингом")}`} />
        <Kpi label={t(lang, "kpi_obs")} value={total} foot={db.meta.demo ? t(lang, "kpi_obs_demo") : t(lang, "kpi_obs_real")} />
        <Kpi label={t(lang, "kpi_avg")} value={ranked.length ? fmt(avg(ranked.map((s) => s.mean))) : "—"} foot={t(lang, "kpi_avg_foot")} />
        <Kpi
          label={t(lang, "kpi_completeness")}
          value={db.teams.length ? `${Math.round((ss.filter((s) => s.count >= 4).length / db.teams.length) * 100)}%` : "—"}
          foot={t(lang, "kpi_completeness_foot")}
        />
      </div>

      {!db.teams.length ? (
        <EmptyState
          icon={Users}
          title={tr("В турнире пока нет команд")}
          body={tr("Выберите ивент, чтобы загрузить список команд, или добавьте команды вручную.")}
          action={
            <div className="flex gap-2">
              <Button onClick={changeEvent}>{tr("Выбрать ивент")}</Button>
              <Button variant="secondary" onClick={() => go("teams")}>
                {tr("Добавить команду")}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Panel title={t(lang, "chart_title")} subtitle={t(lang, "chart_note")} actions={<Button size="sm" variant="ghost" onClick={() => go("teams")}>{tr("Все команды")}</Button>}>
            {!ranked.length && oprTop.length ? (
              <>
                <p className="mb-3 text-xs text-zinc-500">{tr("Скаутинга ещё нет — показан официальный OPR по результатам матчей.")}</p>
                <ol className="space-y-2.5">
                  {oprTop.map((x, i) => (
                    <li key={x.team.number}>
                      <button type="button" onClick={() => db.teams.some((t) => t.id === x.team.id) && go("teams", x.team.id)} className="grid w-full grid-cols-[24px_minmax(0,9rem)_1fr_56px] items-center gap-3 rounded-md text-left text-sm hover:bg-zinc-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                        <span className="num text-xs text-zinc-600">{i + 1}</span>
                        <span className="truncate">
                          <span className="num font-medium text-white">{x.team.number}</span> <span className="text-zinc-500">{x.team.name}</span>
                        </span>
                        <span className="relative h-2 rounded-full bg-zinc-900" aria-hidden="true">
                          <span className="absolute inset-y-0 left-0 rounded-full bg-zinc-400" style={{ width: `${(Math.max(0, x.opr) / oprMax) * 100}%` }} />
                        </span>
                        <span className="num text-right text-zinc-200">OPR {fmt(x.opr, 0)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : ranked.length ? (
              <ol className="space-y-2.5">
                {ranked.slice(0, 10).map((s, i) => (
                  <li key={s.team.id}>
                    <button type="button" onClick={() => go("teams", s.team.id)} className="grid w-full grid-cols-[24px_minmax(0,9rem)_1fr_56px] items-center gap-3 rounded-md text-left text-sm hover:bg-zinc-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                      <span className="num text-xs text-zinc-600">{i + 1}</span>
                      <span className="truncate">
                        <span className="num font-medium text-white">{s.team.number}</span> <span className="text-zinc-500">{s.team.name}</span>
                      </span>
                      <span className="relative h-2 rounded-full bg-zinc-900" aria-hidden="true">
                        <span className="absolute inset-y-0 rounded-full bg-zinc-700" style={{ left: `${(Math.max(0, s.mean - s.sd) / max) * 100}%`, width: `${((Math.min(max, s.mean + s.sd) - Math.max(0, s.mean - s.sd)) / max) * 100}%` }} />
                        <span className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${(s.mean / max) * 100}%` }} />
                      </span>
                      <span className="num text-right text-zinc-200">{fmt(s.mean)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={ClipboardList} title={tr("Ещё нет наблюдений")} body={tr("Запишите первый матч — рейтинг появится сразу.")} action={<Button onClick={() => go("scouting")}>{t(lang, "record_match")}</Button>} />
            )}
            {ranked.length ? <p className="mt-3 text-xs text-zinc-600">{tr("Белая полоса — оценка вклада, серая — разброс ±σ.")}</p> : null}
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel title={tr("Кого скаутить дальше")} subtitle={db.schedule ? tr("Команды ближайших матчей с малым числом наблюдений") : tr("Команды с наименьшим числом наблюдений")}>
              <ul className="divide-y divide-zinc-900">
                {nextUp.map(({ team, count, match }) => (
                  <li key={team.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-sm">
                      <span className="num font-medium text-white">{team.number}</span> <span className="text-zinc-500">{team.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {match ? <Badge tone="outline">Q{match}</Badge> : null}
                      <span className="num whitespace-nowrap text-right text-xs text-zinc-500">{count} {tr("набл.")}</span>
                      <Button size="sm" variant="secondary" onClick={() => go("scouting", "", { team: team.id, match: match || "" })}>
                        {tr("Записать")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            {top ? (
              <Panel title={t(lang, "leader_profile")} subtitle={`${top.team.number} ${top.team.name} · ${roleLabel(top)}`}>
                <ProfileBars profile={top.profile} />
              </Panel>
            ) : null}
          </div>
        </div>
      )}

      {ranked.length ? (
        <Panel className="mt-4" title={t(lang, "team_ranking")}>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  {["#", t(lang, "col_team"), t(lang, "col_score"), t(lang, "col_matches"), tr("Роль"), t(lang, "col_class"), t(lang, "col_confidence")].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 12).map((s, i) => (
                  <tr key={s.team.id} className="cursor-pointer hover:bg-zinc-900/50" onClick={() => go("teams", s.team.id)}>
                    <td className={`${td} num text-zinc-600`}>{i + 1}</td>
                    <td className={td}>
                      <span className="num font-medium text-white">{s.team.number}</span> <span className="text-zinc-500">{s.team.name}</span>
                    </td>
                    <td className={`${td} num`}>
                      <span className="font-medium text-white">{fmt(s.mean)}</span> <span className="text-xs text-zinc-500">±{fmt(s.sd)}</span>
                    </td>
                    <td className={`${td} num text-zinc-400`}>{s.count}</td>
                    <td className={`${td} text-zinc-400`}>{roleLabel(s)}</td>
                    <td className={td}>
                      <Badge tone={priority(s) === "A" ? "strong" : "muted"}>{tr(priority(s))}</Badge>
                    </td>
                    <td className={`${td} text-zinc-400`}>{s.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
