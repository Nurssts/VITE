import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, DemoBanner, Kpi, Panel } from "../components/ui";
import { allStats, avg, fmt, MODEL_VERSION, priority } from "../lib/model";

export default function Overview({ db, setPage }) {
  const ss = allStats(db);
  const ranked = ss.filter((s) => s.count).sort((a, b) => b.mean - a.mean);
  const total = db.records.filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode).length;
  const chart = [...ss].sort((a, b) => b.mean - a.mean).slice(0, 7).map((s) => ({ name: s.team.number, mean: Math.round(s.mean * 10) / 10 }));
  const top = ranked[0];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Турнирный обзор</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ивент: {db.meta.eventName || "не выбран"} · код {db.meta.eventCode || "(все)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPage("teams")}>
            Все команды
          </Button>
          <Button onClick={() => setPage("scouting")}>+ Записать матч</Button>
        </div>
      </div>
      <DemoBanner demo={db.meta.demo} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Команды в пуле" value={db.teams.length} foot="в текущем скаутинге" />
        <Kpi label="Наблюдения" value={total} foot={db.meta.demo ? "демо-записи" : "сохранённые записи"} />
        <Kpi label="Средняя оценка" value={ranked.length ? fmt(avg(ranked.map((s) => s.mean))) : "—"} foot="модельные очки за матч" />
        <Kpi
          label="Полнота данных"
          value={ranked.length ? `${Math.round((ranked.filter((s) => s.count >= 4).length / ranked.length) * 100)}%` : "—"}
          foot="команд с 4+ наблюдениями"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <Panel>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold">Команды по оценке вклада</h2>
              <p className="text-[11px] text-zinc-500">Среднее модельное значение по матчевым записям</p>
            </div>
            <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{MODEL_VERSION}</span>
          </div>
          {chart.length ? (
            <div className="h-56" role="img" aria-label="Столбчатый график средней модельной оценки команд">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 16, right: 12 }}>
                  <CartesianGrid stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={11} width={56} />
                  <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 12 }} />
                  <Bar dataKey="mean" fill="#ffffff" radius={[0, 4, 4, 0]} name="Оценка" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-zinc-500">Добавьте команды и скаутские записи.</p>
          )}
          <p className="chart-note">Оценка по скаутированным действиям, не официальный счёт FIRST.</p>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">Профиль лидера</h2>
          <p className="mb-4 text-[11px] text-zinc-500">{top ? `${top.team.number} · ${top.team.name}` : "Нет данных"}</p>
          {top
            ? ["auto", "hive", "flower", "reliability"].map((k) => (
                <div key={k} className="mb-3 grid grid-cols-[88px_1fr_32px] items-center gap-2 text-xs">
                  <span className="uppercase text-zinc-500">{k}</span>
                  <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
                    <div className="h-full bg-white" style={{ width: `${Math.round(top.profile[k])}%` }} />
                  </div>
                  <span className="text-right">{Math.round(top.profile[k])}</span>
                </div>
              ))
            : null}
        </Panel>
      </div>
      <Panel className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Командный рейтинг</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                {["Команда", "Оценка", "Матчи", "Класс", "Доверие"].map((h) => (
                  <th key={h} className="border-b border-zinc-800 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 8).map((s) => (
                <tr key={s.team.id} className="border-b border-zinc-900">
                  <td className="py-2">
                    {s.team.number} · {s.team.name}
                  </td>
                  <td>
                    {fmt(s.mean)} <span className="text-zinc-500">± {fmt(s.sd)}</span>
                  </td>
                  <td>{s.count}</td>
                  <td>{priority(s)}</td>
                  <td>{s.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
