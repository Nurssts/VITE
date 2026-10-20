import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button, Panel } from "../components/ui";
import { allStats, MODEL_VERSION, pairModel } from "../lib/model";

export default function Notebook({ db }) {
  const ranked = allStats(db)
    .filter((s) => s.count)
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 8);
  const chart = ranked.map((s) => ({ name: s.team.number, mean: Math.round(s.mean) }));
  const cap = db.draft?.captain;
  const pick = db.draft?.picked?.[0];
  const pair = cap && pick ? pairModel(db, cap, pick) : ranked[0] && ranked[1] ? pairModel(db, ranked[0].team.id, ranked[1].team.id) : null;

  function printPdf() {
    window.print();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Engineering Notebook</h1>
          <p className="mt-1 text-sm text-zinc-500">Одностраничный отчёт для Innovate / Inspire. Печать в системный PDF. Только ваши данные, без выдуманных метрик.</p>
        </div>
        <Button onClick={printPdf}>Печать / сохранить PDF</Button>
      </div>
      <Panel id="notebook-sheet">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">VITE · BioBuzz Alliance Matrix</div>
            <h2 className="mt-1 text-xl font-semibold">Выдержка скаутской модели</h2>
            <p className="text-sm text-zinc-500">
              {db.meta.eventName || "Ивент не указан"} · {MODEL_VERSION}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">{new Date().toLocaleString("ru-RU")}</div>
        </div>
        {db.meta.demo ? <p className="mt-3 text-sm text-zinc-300">Источник: учебный набор (помечен). Не используйте как доказательство реальных матчей.</p> : <p className="mt-3 text-sm text-zinc-300">Источник: локальный скаутинг команды на этом устройстве.</p>}
        <div className="mt-4 h-48" role="img" aria-label="График синергии вклада команд для судейского PDF">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} />
              <YAxis stroke="#a1a1aa" fontSize={11} />
              <Bar dataKey="mean" fill="#ffffff" name="Модельный вклад" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <h3 className="mt-4 text-sm font-semibold">Матрица пары</h3>
        {pair ? (
          <p className="mt-2 text-sm text-zinc-300">
            {pair.a.team.number} + {pair.b.team.number}: индекс {Math.round(pair.score)} / 100, роли {pair.roles.join(" + ")}, collision {pair.collision.level}. Формула: покрытие профилей Auto/Hive/Flower/надёжность, бонус комплиментарности Hive–Flower, штраф DNF и пересечения автономов.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Недостаточно данных для пары.</p>
        )}
        <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">
          Ограничения: модель не заменяет судейство и не учитывает полностью защиту, конкуренцию за игровые элементы и решения рефери. FIRST API / TOA используются только как источник публичных результатов, если настроены.
        </p>
      </Panel>
      <div className="print-root">
        <h1>VITE · BioBuzz Alliance Matrix</h1>
        <p>
          {db.meta.eventName} · {MODEL_VERSION} · {db.meta.demo ? "учебные данные" : "скаутинг команды"}
        </p>
        <table>
          <thead>
            <tr>
              <th>Команда</th>
              <th>Вклад</th>
              <th>n</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s) => (
              <tr key={s.team.id}>
                <td>
                  {s.team.number} {s.team.name}
                </td>
                <td>{Math.round(s.mean)}</td>
                <td>{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pair ? (
          <p>
            Пара {pair.a.team.number}+{pair.b.team.number}: synergy {Math.round(pair.score)}, collision {pair.collision.level}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
