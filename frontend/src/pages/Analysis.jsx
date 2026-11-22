import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles } from "lucide-react";
import { Button, DemoBanner, EmptyState, inputClass, PageHeader, Panel, SplitBar, Stat } from "../components/ui";
import { fmt, MODEL_VERSION, pairModel, simulate, teamLabel } from "../lib/model";
import { tr } from "../lib/i18n";

const ITERATIONS = 2000;

function TeamSelect({ teams, value, onChange, taken, label }) {
  return (
    <select className={inputClass()} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{tr("Выберите команду")}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id} disabled={taken.includes(t.id) && t.id !== value}>
          {teamLabel(t)}
        </option>
      ))}
    </select>
  );
}

function bestPartner(db, captain, exclude) {
  let best = null;
  db.teams.forEach((t) => {
    if (t.id === captain || exclude.includes(t.id)) return;
    const m = pairModel(db, captain, t.id);
    if (m && (!best || m.score > best.score)) best = { id: t.id, score: m.score };
  });
  return best?.id || "";
}

export default function Analysis({ db }) {
  const ids = new Set(db.teams.map((t) => t.id));
  const [raw, setRaw] = useState(() => db.teams.slice(0, 4).map((t) => t.id));
  // Drop selections of teams that no longer exist (event switched, team deleted).
  const sel = [0, 1, 2, 3].map((i) => (ids.has(raw[i]) ? raw[i] : ""));
  const [sim, setSim] = useState(null);
  const [simKey, setSimKey] = useState("");
  const key = sel.join("|");
  const current = sim && simKey === key ? sim : null;

  const one = useMemo(() => (sel[0] && sel[1] ? pairModel(db, sel[0], sel[1]) : null), [db, sel[0], sel[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const two = useMemo(() => (sel[2] && sel[3] ? pairModel(db, sel[2], sel[3]) : null), [db, sel[2], sel[3]]); // eslint-disable-line react-hooks/exhaustive-deps

  const hist = useMemo(() => {
    if (!current?.diff?.length) return [];
    const bins = 20;
    const min = Math.min(...current.diff);
    const max = Math.max(...current.diff);
    const span = Math.max(10, max - min);
    const counts = Array(bins).fill(0);
    current.diff.forEach((v) => (counts[Math.max(0, Math.min(bins - 1, Math.floor(((v - min) / span) * bins)))] += 1));
    return counts.map((c, i) => ({ bin: Math.round(min + (span / bins) * (i + 0.5)), n: c }));
  }, [current]);

  const setAt = (i, v) => setRaw((s) => [0, 1, 2, 3].map((k) => (k === i ? v : s[k] || "")));

  if (db.teams.length < 4) {
    return (
      <div>
        <PageHeader title={tr("Синергия и симулятор")} />
        <EmptyState title={tr("Нужно минимум четыре команды.")} body={tr("Добавьте команды или выберите ивент.")} />
      </div>
    );
  }

  const ready = sel.every(Boolean) && new Set(sel).size === 4;

  const AllianceBox = ({ title, a, b, pair }) => (
    <Panel title={title}>
      <div className="grid gap-2">
        <TeamSelect teams={db.teams} value={sel[a]} onChange={(v) => setAt(a, v)} taken={sel} label={`${title} 1`} />
        <TeamSelect teams={db.teams} value={sel[b]} onChange={(v) => setAt(b, v)} taken={sel} label={`${title} 2`} />
        {sel[a] ? (
          <Button
            size="sm"
            variant="ghost"
            className="justify-start"
            onClick={() => setAt(b, bestPartner(db, sel[a], sel.filter((_, i) => i !== b)))}
          >
            <Sparkles size={14} aria-hidden="true" />
            {tr("Подобрать лучшего партнёра")}
          </Button>
        ) : null}
      </div>
      {pair ? (
        <div className="mt-4 border-t border-zinc-900 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-zinc-500">{tr("Индекс синергии")}</span>
            <span className="num text-3xl font-semibold text-white">{Math.round(pair.score)}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {pair.roles.join(" + ")} · {pair.complementaryRoles ? tr("комплиментарная пара") : tr("перекрытие ролей")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label={tr("Покрытие")} value={Math.round(pair.cover)} />
            <Stat label={tr("Ожидаемо очков")} value={fmt(pair.mean, 0)} sub={`± ${fmt(pair.sd, 0)}`} />
            <Stat label="Collision" value={`${Math.round(pair.collision.score)}`} sub={pair.collision.level} />
            <Stat label="DNF" value={`${fmt(pair.dnfIndex * 100, 0)}%`} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">{pair.collision.reasons[0]}</p>
        </div>
      ) : null}
    </Panel>
  );

  return (
    <div>
      <PageHeader title={tr("Синергия и симулятор")} subtitle={tr("Комплиментарность Hive + Flowers, collision check и Монте-Карло с интервалом неопределённости.")} />
      <DemoBanner demo={db.meta.demo} />

      <div className="grid gap-4 lg:grid-cols-2">
        {AllianceBox({ title: tr("Альянс 1"), a: 0, b: 1, pair: one })}
        {AllianceBox({ title: tr("Альянс 2"), a: 2, b: 3, pair: two })}
      </div>

      <Panel
        className="mt-4"
        title={`Monte-Carlo · ${MODEL_VERSION}`}
        subtitle={tr("Нормальная модель по среднему и σ. Защита и решения судей не моделируются полностью.")}
        actions={
          <Button
            disabled={!ready}
            onClick={() => {
              setSim(simulate(db, sel, ITERATIONS));
              setSimKey(key);
            }}
          >
            {tr("Запустить")} {ITERATIONS} {tr("симуляций")}
          </Button>
        }
      >
        {!ready ? <p className="text-sm text-zinc-500">{tr("Выберите четыре разные команды.")}</p> : null}
        {ready && current ? (
          <div>
            <div className="mb-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div>
                <div className="text-xs text-zinc-500">{tr("Победа A1")}</div>
                <div className="num text-6xl font-semibold leading-none tracking-tight text-white">{fmt(current.winPct, 0)}%</div>
                <div className="num mt-2 text-xs text-zinc-500">
                  {tr("95% интервал P(A1)")}: {current.ciLow}–{current.ciHigh}%
                </div>
              </div>
              <div>
                <SplitBar p={current.winPct / 100 + current.tiePct / 200} leftLabel="A1" rightLabel="A2" />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat label={tr("Среднее A1")} value={fmt(current.mean1, 0)} />
                  <Stat label={tr("Среднее A2")} value={fmt(current.mean2, 0)} />
                  <Stat label={tr("Ничья")} value={`${current.tiePct}%`} />
                </div>
              </div>
            </div>
            <div className="h-44" role="img" aria-label={tr("Гистограмма разницы модельных очков")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hist} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid stroke="#27272a" vertical={false} />
                  <XAxis dataKey="bin" stroke="#52525b" fontSize={10} tick={{ fill: "#a1a1aa" }} />
                  <YAxis stroke="#52525b" fontSize={10} tick={{ fill: "#a1a1aa" }} />
                  <ReferenceLine x={hist.reduce((b, h) => (Math.abs(h.bin) < Math.abs(b) ? h.bin : b), Infinity)} stroke="#71717a" strokeDasharray="3 3" />
                  <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#fafafa" }} formatter={(v) => [v, tr("Итерации")]} />
                  <Bar dataKey="n" fill="#ffffff" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{tr("Ось X — разница очков A1 − A2. Правее пунктира — победы A1.")}</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {current.risks.map((r) => (
                <li key={r} className="rounded-lg border border-zinc-800 px-3 py-2.5">
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">{tr("Вероятность — доля итераций, не гарантия исхода матча.")}</p>
          </div>
        ) : ready ? (
          <p className="text-sm text-zinc-500">{tr("Запустите симуляцию. При малом числе матчей интервал будет широким.")}</p>
        ) : null}
      </Panel>
    </div>
  );
}
