import { tr } from "../lib/i18n";
import { Button, DemoBanner, Panel } from "../components/ui";
import { denialPick, fmt, pairModel, roleLabel, stats, teamLabel } from "../lib/model";

export default function Draft({ db, setDb }) {
  const draft = db.draft || { captain: db.teams[0]?.id || "", picked: [], removed: [] };
  const cap = db.teams.find((t) => t.id === draft.captain);
  const picked = (draft.picked || []).filter((id) => id !== cap?.id).slice(0, 1);
  const removed = draft.removed || [];
  const candidates = db.teams
    .filter((t) => t.id !== cap?.id && !removed.includes(t.id) && !picked.includes(t.id))
    .map((t) => ({ team: t, model: cap ? pairModel(db, cap.id, t.id) : null, st: stats(db, t) }))
    .sort((a, b) => (b.model?.score || 0) - (a.model?.score || 0));
  const denial = cap ? denialPick(db, cap.id, candidates.map((c) => c.team)) : null;
  const best = candidates[0];

  function patch(next) {
    setDb({ ...db, draft: { ...draft, ...next } });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Live Draft Board</h1>
          <p className="mt-1 text-sm text-zinc-500">{tr("Подсказки по синергии и denial pick. Решение принимает капитан.")}</p>
        </div>
        <Button variant="secondary" onClick={() => patch({ picked: [], removed: [] })}>
          {tr("Сбросить доску")}
        </Button>
      </div>
      <DemoBanner demo={db.meta.demo} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{tr("Капитан")}</div>
          <select className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" value={draft.captain} onChange={(e) => patch({ captain: e.target.value, picked: [] })}>
            {db.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {teamLabel(t)}
              </option>
            ))}
          </select>
          <div className="mt-4 rounded-lg border border-zinc-200 p-3 text-sm">
            <div className="text-[11px] text-zinc-500">{tr("Партнёр")}</div>
            <strong>{picked[0] ? teamLabel(db.teams.find((t) => t.id === picked[0])) : tr("не выбран")}</strong>
          </div>
          {best ? (
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              {tr("Лучшая синергия в пуле")}: {teamLabel(best.team)} · {tr("индекс")} {Math.round(best.model?.score || 0)}. {best.model?.complementaryRoles ? tr("Комплиментарные роли Hive/Flower.") : tr("Роли перекрываются — проверьте collision.")}
            </p>
          ) : null}
          {denial ? (
            <p className="mt-3 text-xs leading-relaxed text-zinc-600">
              {tr("Denial pick (перехват)")}: {teamLabel(denial.team)} {tr("сильнее всего поднимает чужой альянс")} ({tr("угроза")} {Math.round(denial.threat)}). {tr("Берите, только если не нужен свой партнёр сильнее.")}
            </p>
          ) : null}
        </aside>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <strong>{tr("Доступные команды")}</strong>
            <span className="text-zinc-500">{candidates.length} {tr("в пуле")}</span>
          </div>
          <div className="grid gap-2">
            {candidates.map((x, i) => (
              <article key={x.team.id} className="grid items-center gap-2 rounded-xl border border-zinc-800 p-3 sm:grid-cols-[32px_1fr_auto_auto]">
                <span className="font-mono text-xs text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-sm font-medium">
                    {x.team.number} · {x.team.name}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {x.st ? roleLabel(x.st) : ""} · {tr("синергия")} {x.model ? Math.round(x.model.score) : "—"} · {tr("вклад")} {x.model ? fmt(x.model.mean, 0) : "—"}
                    {denial?.team.id === x.team.id ? " · DENIAL" : ""}
                    {i === 0 ? " · BEST" : ""}
                  </div>
                </div>
                <Button
                  onClick={() => {
                    patch({ picked: [x.team.id] });
                  }}
                >
                  {tr("Выбрать")}
                </Button>
                <Button variant="secondary" onClick={() => patch({ removed: [...new Set([...removed, x.team.id])] })}>
                  {tr("Взяли")}
                </Button>
              </article>
            ))}
          </div>
          {removed.length ? (
            <Panel className="mt-4">
              <h3 className="text-sm font-semibold">{tr("Выбраны другими альянсами")}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {removed.map((id) => {
                  const t = db.teams.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <button key={id} type="button" className="rounded-full border border-zinc-700 px-3 py-1 text-xs" onClick={() => patch({ removed: removed.filter((x) => x !== id) })}>
                      {t.number} · {tr("вернуть")}
                    </button>
                  );
                })}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
