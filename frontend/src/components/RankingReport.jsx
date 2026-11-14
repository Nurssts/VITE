import { tr } from "../lib/i18n";
import { fmt, priority, roleLabel } from "../lib/model";
import { rankedStats } from "../lib/exportCsv";

// Printable ranking sheet of all teams (one table, black & white).
export default function RankingReport({ db, onClose }) {
  const list = rankedStats(db);
  return (
    <div className="fixed inset-0 z-[120] overflow-auto bg-white text-black">
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } .report-root, .report-root * { visibility: visible; } .report-root { position: absolute; inset: 0; } tr { break-inside: avoid; } }`}</style>
      <div className="no-print sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white p-3">
        <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" onClick={onClose}>
          {tr("← Назад")}
        </button>
        <button className="rounded-lg bg-black px-3 py-1.5 text-sm text-white" onClick={() => window.print()}>
          {tr("Печать / PDF")}
        </button>
      </div>
      <div className="report-root mx-auto max-w-4xl p-8">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          {tr("Рейтинг команд")} · {db.meta.eventName || ""} {db.meta.eventCode ? `· ${db.meta.eventCode}` : ""}
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{tr("Рейтинг команд")}</h1>
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              {["#", tr("Команда"), tr("Роль"), tr("Приор."), tr("Матчи"), tr("Оценка"), "σ", "Auto", "Hive", "Flower", "DNF"].map((h) => (
                <th key={h} className="py-1.5 pr-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={s.team.id} className="border-b border-zinc-200">
                <td className="py-1.5 pr-2 text-zinc-500">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">
                  {s.team.number} · {s.team.name}
                </td>
                <td className="py-1.5 pr-2">{roleLabel(s)}</td>
                <td className="py-1.5 pr-2">{tr(priority(s))}</td>
                <td className="py-1.5 pr-2">{s.count}</td>
                <td className="py-1.5 pr-2 font-semibold">{fmt(s.mean)}</td>
                <td className="py-1.5 pr-2">± {fmt(s.sd)}</td>
                <td className="py-1.5 pr-2">{fmt(s.auto)}</td>
                <td className="py-1.5 pr-2">{fmt(s.hive)}</td>
                <td className="py-1.5 pr-2">{fmt(s.flower)}</td>
                <td className="py-1.5 pr-2">{Math.round(s.dnf * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-[11px] text-zinc-500">{tr("Оценка вклада — сумма наблюдаемых действий, а не официальный счёт.")}</p>
      </div>
    </div>
  );
}
