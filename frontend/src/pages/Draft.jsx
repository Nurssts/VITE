import { Button, DemoBanner, inputClass, Panel } from "../components/ui";
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
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-[2rem]">Live Draft Board</h1>
          <p className="mt-1 text-sm text-zinc-500">Подсказки по синергии и denial pick. Решение принимает капитан.</p>
        </div>
        <Button variant="secondary" onClick={() => patch({ picked: [], removed: [] })}>
          Сбросить доску
        </Button>
      </div>
      <DemoBanner demo={db.meta.demo} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 lg:sticky lg:top-20">
          <div className="text-xs font-medium text-zinc-400">Капитан</div>
          <select className={inputClass("mt-2")} value={draft.captain} onChange={(e) => patch({ captain: e.target.value, picked: [] })}>
            {db.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {teamLabel(t)}
              </option>
            ))}
          </select>
          <div className={`mt-4 rounded-lg border p-3 text-sm ${picked[0] ? "border-honey-400/50 bg-honey-900/30" : "border-dashed border-zinc-700"}`}>
            <div className="text-xs text-zinc-400">Партнёр</div>
            <strong className={picked[0] ? "text-honey-300" : "font-medium text-zinc-500"}>{picked[0] ? teamLabel(db.teams.find((t) => t.id === picked[0])) : "не выбран"}</strong>
          </div>
          {best ? (
            <p className="mt-4 border-l-2 border-honey-400 pl-3 text-xs leading-relaxed text-zinc-300">
              Лучшая синергия в пуле: {teamLabel(best.team)} · индекс {Math.round(best.model?.score || 0)}. {best.model?.complementaryRoles ? "Комплиментарные роли Hive/Flower." : "Роли перекрываются — проверьте collision."}
            </p>
          ) : null}
          {denial ? (
            <p className="mt-3 border-l-2 border-sting pl-3 text-xs leading-relaxed text-zinc-300">
              Denial pick (перехват): {teamLabel(denial.team)} сильнее всего поднимает чужой альянс (угроза {Math.round(denial.threat)}). Берите, только если не нужен свой партнёр сильнее.
            </p>
          ) : null}
        </aside>
        <div>
          <div className="mb-3 flex items-baseline justify-between text-sm">
            <h2 className="font-display text-base font-bold text-zinc-50">Доступные команды</h2>
            <span className="font-mono text-xs text-zinc-500">{candidates.length} в пуле</span>
          </div>
          <div className="grid gap-2">
            {candidates.map((x, i) => {
              const isBest = i === 0;
              const isDenial = denial?.team.id === x.team.id;
              return (
                <article
                  key={x.team.id}
                  className={`grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-3 rounded-xl border p-3 sm:grid-cols-[56px_1fr_auto] ${
                    isBest ? "border-honey-400/60 bg-honey-900/25" : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >
                  <div className="text-center">
                    <div className={`font-mono text-2xl font-medium leading-none ${isBest ? "text-honey-400" : "text-zinc-100"}`}>
                      {x.model ? Math.round(x.model.score) : "—"}
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">синергия</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-zinc-50">{x.team.number}</span>
                      <span className="truncate text-zinc-300">{x.team.name}</span>
                      {isBest ? <span className="rounded bg-honey-400 px-1.5 py-0.5 text-[10px] font-bold text-ink">BEST</span> : null}
                      {isDenial ? <span className="rounded border border-sting/60 px-1.5 py-0.5 text-[10px] font-bold text-sting">DENIAL</span> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {x.st ? roleLabel(x.st) : ""} · вклад <span className="font-mono text-zinc-300">{x.model ? fmt(x.model.mean, 0) : "—"}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex gap-2 sm:col-span-1">
                    <Button variant={isBest ? "primary" : "secondary"} className="flex-1 sm:flex-none" onClick={() => patch({ picked: [x.team.id] })}>
                      Выбрать
                    </Button>
                    <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => patch({ removed: [...new Set([...removed, x.team.id])] })}>
                      Взяли
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {removed.length ? (
            <Panel className="mt-4">
              <h3 className="text-sm font-semibold">Выбраны другими альянсами</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {removed.map((id) => {
                  const t = db.teams.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <button key={id} type="button" className="rounded-full border border-zinc-700 px-3 py-1 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-50" onClick={() => patch({ removed: removed.filter((x) => x !== id) })}>
                      {t.number} · вернуть
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
