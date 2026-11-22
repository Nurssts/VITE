import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Badge, Button, DemoBanner, EmptyState, inputClass, PageHeader, Panel, ProfileBars } from "../components/ui";
import { confirmDialog } from "../components/feedback";
import { computeOpr, denialPick, fmt, pairModel, roleLabel, stats, teamLabel } from "../lib/model";
import { tr } from "../lib/i18n";

export default function Draft({ db, setDb, go }) {
  const [q, setQ] = useState("");
  const draft = db.draft || { captain: "", picked: [], removed: [] };
  const cap = db.teams.find((t) => t.id === draft.captain) || null;
  const picked = (draft.picked || []).filter((id) => id !== cap?.id && db.teams.some((t) => t.id === id)).slice(0, 1);
  const removed = (draft.removed || []).filter((id) => db.teams.some((t) => t.id === id));
  const partner = db.teams.find((t) => t.id === picked[0]);

  const oprMap = useMemo(() => computeOpr(db.schedule?.eventCode === db.meta.eventCode ? db.schedule.matches : []).opr, [db.schedule, db.meta.eventCode]);
  // Without any scouting the synergy model has nothing to compare: rank by official OPR instead.
  const oprMode = !db.records.some((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode) && oprMap.size > 0;
  const candidates = useMemo(
    () =>
      db.teams
        .filter((t) => t.id !== cap?.id && !removed.includes(t.id) && !picked.includes(t.id))
        .map((t) => ({ team: t, model: cap && !oprMode ? pairModel(db, cap.id, t.id) : null, st: stats(db, t), opr: oprMap.get(t.number) }))
        .sort((a, b) => (oprMode ? (b.opr ?? -Infinity) - (a.opr ?? -Infinity) : (b.model?.score || 0) - (a.model?.score || 0))),
    [db, cap, removed.join(), picked.join(), oprMode, oprMap] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const denial = useMemo(
    () => (cap ? (oprMode ? (candidates[0] ? { team: candidates[0].team, threat: candidates[0].opr || 0 } : null) : denialPick(db, cap.id, candidates.map((c) => c.team))) : null),
    [db, cap, candidates, oprMode]
  );
  const best = candidates[0];
  const pair = cap && partner ? pairModel(db, cap.id, partner.id) : null;
  const needle = q.trim().toLowerCase();
  const shown = candidates.filter((x) => !needle || `${x.team.number} ${x.team.name}`.toLowerCase().includes(needle));

  const patch = (next) => setDb((d) => ({ ...d, draft: { ...(d.draft || {}), ...next } }));

  if (!db.teams.length) {
    return (
      <div>
        <PageHeader title={tr("Доска драфта")} />
        <EmptyState title={tr("Команд пока нет")} action={<Button onClick={() => go("teams")}>{tr("+ Добавить команду")}</Button>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={tr("Доска драфта")}
        subtitle={tr("Подсказки по синергии и denial pick. Решение принимает капитан.")}
        actions={
          <>
          <Button onClick={() => go("ai", "", { mission: "picklist", target: cap?.number || "" })} disabled={!cap}>
            <Sparkles size={15} aria-hidden="true" />
            {tr("Пик-лист от AI")}
          </Button>
          <Button
            variant="secondary"
            disabled={!picked.length && !removed.length}
            onClick={async () => {
              if (await confirmDialog({ title: tr("Сбросить доску?"), body: tr("Партнёр и отметки «взяли» будут очищены. Скаутинг не изменится."), confirmLabel: tr("Сбросить") })) patch({ picked: [], removed: [] });
            }}
          >
            {tr("Сбросить доску")}
          </Button>
          </>
        }
      />
      <DemoBanner demo={db.meta.demo} />
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-xl bg-white p-5 text-black">
            <label className="text-xs font-medium text-zinc-500" htmlFor="captain">
              {tr("Капитан")}
            </label>
            <select id="captain" className="mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-black" value={draft.captain} onChange={(e) => patch({ captain: e.target.value, picked: [] })}>
              <option value="">{tr("Выберите команду")}</option>
              {db.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {teamLabel(t)}
                </option>
              ))}
            </select>
            <div className="mt-4 text-xs text-zinc-500">{tr("Партнёр")}</div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <strong className="truncate text-base">{partner ? teamLabel(partner) : tr("не выбран")}</strong>
              {partner ? (
                <button type="button" className="text-xs text-zinc-500 underline-offset-2 hover:underline" onClick={() => patch({ picked: [] })}>
                  {tr("убрать")}
                </button>
              ) : null}
            </div>
            {pair ? (
              <div className="mt-4 flex items-baseline justify-between border-t border-zinc-200 pt-3">
                <span className="text-xs text-zinc-500">{tr("Синергия пары")}</span>
                <span className="num text-4xl font-semibold leading-none">{Math.round(pair.score)}</span>
              </div>
            ) : null}
          </section>

          {cap ? (
            <Panel title={tr("Подсказки")}>
              {best && oprMode ? (
                <p className="text-sm leading-relaxed text-zinc-300">
                  <span className="text-zinc-500">{tr("Сильнейший по OPR")}:</span> <strong className="text-white">{teamLabel(best.team)}</strong> · OPR {best.opr !== undefined ? fmt(best.opr, 0) : "—"}. {tr("Чтобы оценить совместимость ролей, нужен скаутинг.")}
                </p>
              ) : best ? (
                <p className="text-sm leading-relaxed text-zinc-300">
                  <span className="text-zinc-500">{tr("Лучшая синергия в пуле")}:</span> <strong className="text-white">{teamLabel(best.team)}</strong> · {tr("индекс")} {Math.round(best.model?.score || 0)}.{" "}
                  {best.model?.complementaryRoles ? tr("Комплиментарные роли Hive/Flower.") : tr("Роли перекрываются — проверьте collision.")}
                </p>
              ) : null}
              {denial && !oprMode ? (
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  <span className="text-zinc-500">{tr("Denial pick (перехват)")}:</span> <strong className="text-white">{teamLabel(denial.team)}</strong> {tr("сильнее всего поднимает чужой альянс")} ({tr("угроза")} {Math.round(denial.threat)}). {tr("Берите, только если не нужен свой партнёр сильнее.")}
                </p>
              ) : null}
              {pair ? (
                <div className="mt-4 border-t border-zinc-900 pt-4">
                  <ProfileBars profile={pair.a.profile} compare={pair.b.profile} />
                  <p className="mt-2 text-[11px] text-zinc-500">{tr("Полоса — капитан, риска — партнёр.")}</p>
                </div>
              ) : null}
            </Panel>
          ) : null}
        </aside>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <strong className="text-white">{tr("Доступные команды")}</strong> <span className="text-zinc-500">{candidates.length}</span>
            </div>
            <div className="relative w-full sm:w-60">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input className={inputClass("h-9 pl-9")} placeholder={tr("Найти команду")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Найти команду")} />
            </div>
          </div>
          {!cap ? <p className="mb-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400">{tr("Выберите капитана — список отсортируется по синергии с ним.")}</p> : null}
          {oprMode ? <p className="mb-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400">{tr("Скаутинга ещё нет — список отсортирован по официальному OPR. Синергия ролей появится после первых наблюдений.")}</p> : null}
          <ol className="grid gap-2">
            {shown.map((x) => {
              const rank = candidates.indexOf(x) + 1;
              return (
                <li key={x.team.id} className={`grid items-center gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[32px_1fr_auto] ${rank === 1 && cap ? "border-zinc-500" : "border-zinc-800/80"}`}>
                  <span className="num hidden text-sm text-zinc-600 sm:block">{rank}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <button type="button" className="num font-medium text-white hover:underline" onClick={() => go("teams", x.team.id)}>
                        {x.team.number}
                      </button>
                      <span className="truncate text-zinc-400">{x.team.name}</span>
                      {rank === 1 && cap ? <Badge tone="strong">{tr("лучший")}</Badge> : null}
                      {!oprMode && denial?.team.id === x.team.id ? <Badge tone="outline">denial</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {x.st.count ? `${roleLabel(x.st)} · ` : ""}
                      {x.model && x.st.count ? (
                        <>
                          {tr("синергия")} <span className="num text-zinc-300">{Math.round(x.model.score)}</span> · {tr("вклад пары")} <span className="num text-zinc-300">{fmt(x.model.mean, 0)}</span> ·{" "}
                        </>
                      ) : null}
                      OPR <span className="num text-zinc-300">{x.opr !== undefined ? fmt(x.opr, 0) : "—"}</span> · {x.st.count} {tr("набл.")}
                    </div>
                    {x.team.notes ? <div className="mt-1 truncate text-xs text-zinc-600">{x.team.notes}</div> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!cap} onClick={() => patch({ picked: [x.team.id] })}>
                      {tr("Выбрать")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => patch({ removed: [...new Set([...removed, x.team.id])] })} title={tr("Команду взял другой альянс")}>
                      {tr("Взяли")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
          {removed.length ? (
            <Panel className="mt-4" title={tr("Выбраны другими альянсами")} subtitle={tr("Нажмите, чтобы вернуть в пул.")}>
              <div className="flex flex-wrap gap-2">
                {removed.map((id) => {
                  const t = db.teams.find((x) => x.id === id);
                  return (
                    <button key={id} type="button" className="num rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-white hover:text-white" onClick={() => patch({ removed: removed.filter((x) => x !== id) })}>
                      {t.number} ↺
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
