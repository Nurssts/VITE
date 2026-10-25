import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, DemoBanner, Panel } from "../components/ui";
import { fmt, MODEL_VERSION, pairModel, simulate, teamLabel } from "../lib/model";

export default function Analysis({ db }) {
  const fallback = [...db.teams.map((t) => t.id), "", "", "", ""].slice(0, 4);
  const [sel, setSel] = useState(fallback);
  const [sim, setSim] = useState(null);
  const one = useMemo(() => (sel[0] && sel[1] ? pairModel(db, sel[0], sel[1]) : null), [db, sel]);
  const two = useMemo(() => (sel[2] && sel[3] ? pairModel(db, sel[2], sel[3]) : null), [db, sel]);
  const hist = useMemo(() => {
    if (!sim?.diff?.length) return [];
    const bins = 18;
    const min = Math.min(...sim.diff);
    const max = Math.max(...sim.diff);
    const span = Math.max(10, max - min);
    const counts = Array(bins).fill(0);
    sim.diff.forEach((v) => {
      const i = Math.max(0, Math.min(bins - 1, Math.floor(((v - min) / span) * bins)));
      counts[i] += 1;
    });
    return counts.map((c, i) => ({ bin: Math.round(min + (span / bins) * i), n: c, a1: min + (span / bins) * (i + 0.5) >= 0 }));
  }, [sim]);

  function run() {
    setSim(simulate(db, sel, 1200));
  }

  const TeamSelect = ({ index }) => (
    <select className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-600" value={sel[index]} onChange={(e) => setSel((s) => s.map((x, i) => (i === index ? e.target.value : x)))}>
      {db.teams.map((t) => (
        <option key={t.id} value={t.id}>
          {teamLabel(t)}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-[2rem]">Синергия и симулятор</h1>
        <p className="mt-1 text-sm text-zinc-500">Комплиментарность Hive + Flowers, collision check и 1200 итераций Монте-Карло.</p>
      </div>
      <DemoBanner demo={db.meta.demo} />
      {db.teams.length < 4 ? (
        <Panel>Нужно минимум четыре команды.</Panel>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_1fr]">
            <Panel>
              <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Альянс 1</div>
              <TeamSelect index={0} />
              <div className="my-2 text-center text-zinc-600">+</div>
              <TeamSelect index={1} />
              {one ? (
                <p className="mt-3 text-xs text-zinc-400">
                  Роли: {one.roles.join(" + ")} · {one.complementaryRoles ? "комплиментарная пара" : "перекрытие ролей"}
                </p>
              ) : null}
            </Panel>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-honey-400/40 bg-honey-900/40 px-4 py-6 text-zinc-50">
              <div className="text-xs font-medium text-honey-300">Индекс синергии A1 / A2</div>
              <div className="mt-2 font-mono text-5xl font-medium tracking-tight text-honey-400">
                {one ? Math.round(one.score) : "—"}
                <span className="text-2xl text-zinc-400"> / {two ? Math.round(two.score) : "—"}</span>
              </div>
              <p className="mt-2 text-center text-[11px] text-zinc-400">Сравнительная оценка из 100, не вероятность победы.</p>
            </div>
            <Panel>
              <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Альянс 2</div>
              <TeamSelect index={2} />
              <div className="my-2 text-center text-zinc-600">+</div>
              <TeamSelect index={3} />
            </Panel>
          </div>
          {one ? (
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                ["Покрытие", Math.round(one.cover)],
                ["Разница профилей", Math.round(one.complement)],
                ["Collision", `${one.collision.level} · ${Math.round(one.collision.score)}`],
                ["DNF index", fmt(one.dnfIndex * 100, 0) + "%"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-zinc-800 p-3 text-sm">
                  <div className="text-[11px] text-zinc-500">{l}</div>
                  <div className="mt-1 font-mono font-medium text-zinc-50">{v}</div>
                </div>
              ))}
            </div>
          ) : null}
          {one?.collision?.reasons ? <p className="mt-3 text-sm text-zinc-400">{one.collision.reasons[0]}</p> : null}
          <Panel className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Monte-Carlo · {MODEL_VERSION}</h2>
                <p className="text-[11px] text-zinc-500">Нормальная модель по среднему и σ. Защита и решения судей не моделируются полностью.</p>
              </div>
              <Button onClick={run}>Запустить 1200 симуляций</Button>
            </div>
            {sim ? (
              <div>
                {[
                  ["Победа A1", sim.winPct, "bg-honey-400"],
                  ["Победа A2", sim.lossPct, "bg-role-auto"],
                  ["Ничья", sim.tiePct, "bg-zinc-500"],
                ].map(([l, v, c]) => (
                  <div key={l} className="mb-2 grid grid-cols-[90px_1fr_48px] items-center gap-2 text-xs">
                    <span className="text-zinc-400">{l}</span>
                    <div className="h-2 overflow-hidden rounded bg-zinc-800">
                      <div className={`h-full ${c}`} style={{ width: `${v}%` }} />
                    </div>
                    <strong>{v}%</strong>
                  </div>
                ))}
                <div className="mt-4 h-40" role="img" aria-label="Гистограмма разницы модельных очков">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hist}>
                      <CartesianGrid stroke="#25221b" vertical={false} />
                      <XAxis dataKey="bin" stroke="#857e6d" fontSize={10} />
                      <YAxis stroke="#857e6d" fontSize={10} />
                      <Tooltip contentStyle={{ background: "#16140f", border: "1px solid #38342a", borderRadius: 10, color: "#f1ede4" }} />
                      <Bar dataKey="n" radius={[3, 3, 0, 0]} name="Итерации">
                        {hist.map((h) => (
                          <Cell key={h.bin} fill={h.a1 ? "#f7bf3c" : "#6cb6ff"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] text-zinc-500">Среднее A1</div>
                    <strong>{fmt(sim.mean1, 0)}</strong>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">Среднее A2</div>
                    <strong>{fmt(sim.mean2, 0)}</strong>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">95% интервал P(A1)</div>
                    <strong>
                      {sim.ciLow}–{sim.ciHigh}%
                    </strong>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                  {sim.risks.map((r) => (
                    <li key={r} className="rounded-lg border border-zinc-800 p-3">
                      {r}
                    </li>
                  ))}
                </ul>
                <p className="chart-note">Вероятность — доля итераций, не гарантия исхода матча.</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Запустите симуляцию. При малом числе матчей интервал будет широким.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
