import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, DemoBanner, Kpi, Panel } from "../components/ui";
import { allStats, avg, fmt, MODEL_VERSION, priority } from "../lib/model";
import { t, tr } from "../lib/i18n";

export default function Overview({ db, setPage, lang = "ru" }) {
  const ss = allStats(db);
  const ranked = ss.filter((s) => s.count).sort((a, b) => b.mean - a.mean);
  const total = db.records.filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode).length;
  const chart = [...ss].sort((a, b) => b.mean - a.mean).slice(0, 7).map((s) => ({ name: s.team.number, mean: Math.round(s.mean * 10) / 10 }));
  const top = ranked[0];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t(lang, "tournament_overview")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t(lang, "event_label")}: {db.meta.eventName || t(lang, "event_not_chosen")} · {t(lang, "event_code_label")} {db.meta.eventCode || t(lang, "all_code")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPage("teams")}>
            {t(lang, "all_teams")}
          </Button>
          <Button onClick={() => setPage("scouting")}>{t(lang, "record_match")}</Button>
        </div>
      </div>

      <DemoBanner demo={db.meta.demo} lang={lang} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t(lang, "kpi_teams")} value={db.teams.length} foot={t(lang, "kpi_teams_foot")} />
        <Kpi label={t(lang, "kpi_obs")} value={total} foot={db.meta.demo ? t(lang, "kpi_obs_demo") : t(lang, "kpi_obs_real")} />
        <Kpi label={t(lang, "kpi_avg")} value={ranked.length ? fmt(avg(ranked.map((s) => s.mean))) : "—"} foot={t(lang, "kpi_avg_foot")} />
        <Kpi
          label={t(lang, "kpi_completeness")}
          value={ranked.length ? `${Math.round((ranked.filter((s) => s.count >= 4).length / ranked.length) * 100)}%` : "—"}
          foot={t(lang, "kpi_completeness_foot")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <Panel>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">{t(lang, "chart_title")}</h2>
              <p className="text-[11px] text-zinc-600">{t(lang, "chart_subtitle")}</p>
            </div>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-500">{MODEL_VERSION}</span>
          </div>
          {chart.length ? (
            <div className="h-56" role="img" aria-label={t(lang, "chart_title")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 16, right: 12 }}>
                  <CartesianGrid stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#52525b" fontSize={11} tick={{ fill: "#71717a" }} />
                  <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={11} width={56} tick={{ fill: "#71717a" }} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12, color: "#fafafa" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="mean" fill="#ffffff" radius={[0, 4, 4, 0]} name={t(lang, "col_score")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-zinc-600">{t(lang, "chart_empty")}</p>
          )}
          <p className="chart-note">{t(lang, "chart_note")}</p>
        </Panel>

        <Panel>
          <h2 className="text-sm font-semibold text-zinc-100">{t(lang, "leader_profile")}</h2>
          <p className="mb-4 text-[11px] text-zinc-600">{top ? `${top.team.number} · ${top.team.name}` : t(lang, "no_data")}</p>
          {top
            ? ["auto", "hive", "flower", "reliability"].map((k) => (
                <div key={k} className="mb-3 grid grid-cols-[80px_1fr_32px] items-center gap-2 text-xs">
                  <span className="uppercase text-zinc-600 text-[10px] tracking-wider">{k}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.round(top.profile[k])}%` }} />
                  </div>
                  <span className="text-right text-zinc-400">{Math.round(top.profile[k])}</span>
                </div>
              ))
            : null}
        </Panel>
      </div>

      <Panel className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-100">{t(lang, "team_ranking")}</h2>
        <div className="overflow-auto -mx-1">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-600">
              <tr>
                {[t(lang, "col_team"), t(lang, "col_score"), t(lang, "col_matches"), t(lang, "col_class"), t(lang, "col_confidence")].map((h) => (
                  <th key={h} className="border-b border-zinc-900 pb-2 pr-4 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 8).map((s, idx) => (
                <tr key={s.team.id} className="border-b border-zinc-900/60 hover:bg-zinc-900/40 transition-colors">
                  <td className="py-2.5 pr-4">
                    <span className="mr-2 text-zinc-700 text-[10px]">#{idx + 1}</span>
                    <span className="text-zinc-100">{s.team.number}</span>
                    <span className="ml-1.5 text-zinc-500 text-xs">{s.team.name}</span>
                  </td>
                  <td className="pr-4">
                    <span className="text-white font-medium">{fmt(s.mean)}</span>
                    <span className="ml-1 text-zinc-600 text-xs">± {fmt(s.sd)}</span>
                  </td>
                  <td className="pr-4 text-zinc-400">{s.count}</td>
                  <td className="pr-4 text-zinc-400">{tr(priority(s))}</td>
                  <td className="text-zinc-400">{s.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
