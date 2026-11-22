import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowLeft, Search, Sparkles, Users } from "lucide-react";
import { Badge, Button, DemoBanner, EmptyState, Field, inputClass, Modal, PageHeader, Panel, PageSkeleton, ProfileBars, Stat, td, th } from "../components/ui";
import { confirmDialog, toast } from "../components/feedback";
import { addTeam, deleteTeam, updateTeam } from "../lib/db";
import { allStats, breakdown, computeOpr, fmt, priority, roleLabel, stats } from "../lib/model";
import { downloadCsv } from "../lib/exportCsv";
import { tr } from "../lib/i18n";

const TeamReport = lazy(() => import("../components/TeamReport"));
const RankingReport = lazy(() => import("../components/RankingReport"));

function AddTeamModal({ open, onClose, onAdd }) {
  const [consent, setConsent] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={tr("Добавить команду")}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const x = Object.fromEntries(new FormData(e.currentTarget).entries());
          if (onAdd(x)) {
            setConsent(false);
            onClose();
          }
        }}
      >
        <Field label={tr("Номер *")}>
          <input className={inputClass("num")} name="number" required maxLength={20} inputMode="numeric" />
        </Field>
        <Field label={tr("Название *")}>
          <input className={inputClass()} name="name" required maxLength={120} />
        </Field>
        <Field label={tr("Регион")}>
          <input className={inputClass()} name="region" maxLength={120} />
        </Field>
        <label className="flex cursor-pointer gap-2.5 text-sm text-zinc-300">
          <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
          {tr("Я подтверждаю, что это публичные данные команды FTC, без персональных данных учеников.")}
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {tr("Отмена")}
          </Button>
          <Button type="submit" disabled={!consent}>
            {tr("Добавить")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Profile({ db, setDb, team, go }) {
  const [report, setReport] = useState(false);
  const [notes, setNotes] = useState(team.notes || "");
  const s = stats(db, team);
  const opr = useMemo(() => (db.schedule ? computeOpr(db.schedule.matches) : null), [db.schedule]);
  const teamOpr = opr?.opr.get(team.number);
  const history = [...s.records].sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
  const totals = history.map((r) => breakdown(r).total);
  const peak = Math.max(1, ...totals);
  const official = (db.schedule?.matches || []).filter((m) => m.played && [...m.red, ...m.blue].includes(team.number));
  const wins = official.filter((m) => (m.red.includes(team.number) ? m.redScore > m.blueScore : m.blueScore > m.redScore)).length;

  if (report) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <TeamReport db={db} teamId={team.id} onClose={() => setReport(false)} />
      </Suspense>
    );
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `${tr("Удалить команду")} ${team.number}?`,
      body: `${tr("Будут удалены команда и её наблюдения")} (${s.records.length}). ${tr("Сначала можно скачать JSON-копию в разделе «Данные».")}`,
      confirmLabel: tr("Удалить"),
      danger: true,
    });
    if (!ok) return;
    const snapshot = db;
    setDb((d) => deleteTeam(d, team.id));
    go("teams");
    toast(`${tr("Команда удалена")}: ${team.number}`, { action: { label: tr("Отменить"), run: () => setDb(snapshot) } });
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => go("teams")} className="-ml-2 mb-3">
        <ArrowLeft size={15} aria-hidden="true" />
        {tr("Все команды")}
      </Button>
      <PageHeader
        title={
          <span>
            <span className="num">{team.number}</span> <span className="text-zinc-400">{team.name || tr("Без названия")}</span>
          </span>
        }
        subtitle={[team.region || tr("регион не указан"), roleLabel(s)].join(" · ")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setReport(true)}>
              {tr("Печатный отчёт")}
            </Button>
            <Button variant="secondary" onClick={() => go("ai", "", { mission: "team", target: team.number })}>
              <Sparkles size={15} aria-hidden="true" />
              {tr("AI-разбор")}
            </Button>
            <Button onClick={() => go("scouting", "", { team: team.id })}>{tr("+ Матч")}</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={tr("Оценка")} value={s.count ? fmt(s.mean) : "—"} sub={s.count ? `± ${fmt(s.sd)}` : tr("скаутинга нет")} />
        <Stat label={tr("Наблюдений")} value={s.count} sub={s.confidence} />
        <Stat label="OPR" value={teamOpr !== undefined ? fmt(teamOpr, 0) : "—"} sub={tr("по офиц. счетам")} />
        <Stat label={tr("Победы")} value={official.length ? `${wins}/${official.length}` : "—"} sub={tr("официально")} />
        <Stat label="DNF" value={`${Math.round(s.dnf * 100)}%`} sub={`${tr("Парковка")} ${Math.round(s.parkRate * 100)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={tr("Профиль 0–100")} subtitle={tr("Оценка вклада — сумма наблюдаемых действий, а не официальный счёт.")}>
          <ProfileBars profile={s.profile} />
        </Panel>
        <Panel title={tr("Заметки")} subtitle={tr("Видны в отчёте и на доске драфта.")}>
          <textarea
            className={inputClass("h-auto min-h-[112px] py-2")}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (team.notes || "")) {
                setDb((d) => updateTeam(d, team.id, { notes }));
                toast(tr("Заметка сохранена."));
              }
            }}
            placeholder={tr("Стратегия, сильные стороны, проблемы робота")}
          />
        </Panel>
      </div>

      <Panel className="mt-4" title={tr("История матчей")} subtitle={history.length ? tr("Высота полосы — модельный счёт робота в матче.") : ""}>
        {history.length ? (
          <>
            {history.length > 1 ? (
              <div className="mb-4 flex h-20 items-end gap-1.5 border-b border-zinc-800" role="img" aria-label={`${tr("Динамика по матчам")}: ${totals.join(", ")}`}>
                {totals.map((v, i) => (
                  <div key={history[i].id} className="max-w-[28px] flex-1 rounded-t-sm bg-white" style={{ height: `${Math.max(4, (v / peak) * 100)}%` }} title={`Q${history[i].matchNo || "?"}: ${v}`} />
                ))}
              </div>
            ) : null}
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr>
                    {[tr("Матч"), "Auto", "Hive", "Flower", tr("Поле"), tr("Итог"), tr("Скаут"), ""].map((h, i) => (
                      <th key={i} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => {
                    const b = breakdown(r);
                    return (
                      <tr key={r.id}>
                        <td className={`${td} num`}>{r.matchNo ? `Q${r.matchNo}` : "—"}</td>
                        <td className={`${td} num`}>{b.auto}</td>
                        <td className={`${td} num`}>{b.hive}</td>
                        <td className={`${td} num`}>{b.flower}</td>
                        <td className={`${td} num`}>{b.field}</td>
                        <td className={`${td} num font-semibold text-white`}>
                          {b.total} {r.disabled ? <Badge>DNF</Badge> : null}
                        </td>
                        <td className={`${td} text-zinc-400`}>{r.scout || "—"}</td>
                        <td className={`${td} text-right`}>
                          <Button size="sm" variant="ghost" onClick={() => go("scouting", r.id)}>
                            {tr("Изменить")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {history.some((r) => r.notes) ? (
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                {history.filter((r) => r.notes).map((r) => (
                  <li key={r.id} className="rounded-lg border border-zinc-900 px-3 py-2">
                    <span className="num mr-2 text-xs text-zinc-500">Q{r.matchNo || "?"}</span>
                    {r.notes}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <EmptyState title={tr("Наблюдений пока нет")} action={<Button onClick={() => go("scouting", "", { team: team.id })}>{tr("Записать матч")}</Button>} />
        )}
      </Panel>

      <div className="mt-6 flex justify-end">
        <Button variant="danger" size="sm" onClick={remove}>
          {tr("Удалить команду")}
        </Button>
      </div>
    </div>
  );
}

export default function Teams({ db, setDb, go, route }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [adding, setAdding] = useState(false);
  const [ranking, setRanking] = useState(false);

  const oprMap = useMemo(() => computeOpr(db.schedule?.eventCode === db.meta.eventCode ? db.schedule.matches : []).opr, [db.schedule, db.meta.eventCode]);
  const anyScouted = useMemo(() => db.records.some((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode), [db.records, db.meta.eventCode]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const o = (s) => oprMap.get(s.team.number) ?? -Infinity;
    const rows = allStats(db)
      .filter((s) => !needle || `${s.team.number} ${s.team.name} ${s.team.region}`.toLowerCase().includes(needle))
      .filter((s) => filter === "all" || (filter === "none" ? !s.count : priority(s) === filter));
    const by = {
      // Scouted teams first by model score; unscouted ones (and an unscouted event) by official OPR.
      score: (a, b) => (anyScouted ? Boolean(b.count) - Boolean(a.count) || (a.count && b.count ? b.mean - a.mean : o(b) - o(a)) : o(b) - o(a)),
      matches: (a, b) => b.count - a.count || o(b) - o(a),
      number: (a, b) => Number(a.team.number) - Number(b.team.number) || a.team.number.localeCompare(b.team.number),
    }[sort];
    return rows.sort(by);
  }, [db, q, filter, sort, oprMap, anyScouted]);

  const team = route.param ? db.teams.find((t) => t.id === route.param) : null;
  if (team) return <Profile key={team.id} db={db} setDb={setDb} team={team} go={go} />;

  if (ranking) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <RankingReport db={db} onClose={() => setRanking(false)} />
      </Suspense>
    );
  }

  function add(x) {
    try {
      setDb(addTeam(db, x));
      toast(tr("Команда добавлена."));
      return true;
    } catch (e) {
      toast(e.code === "exists" ? tr("Такая команда уже есть.") : tr("Нужны номер и название."), { error: true });
      return false;
    }
  }

  return (
    <div>
      <PageHeader
        title={tr("Команды")}
        subtitle={tr("Профили, стабильность и объём скаутинга.")}
        actions={
          <>
            <Button variant="secondary" disabled={!db.teams.length} onClick={() => setRanking(true)}>
              {tr("Печатный рейтинг")}
            </Button>
            <Button variant="secondary" disabled={!db.teams.length} onClick={() => downloadCsv(db)}>
              {tr("Экспорт CSV")}
            </Button>
            <Button onClick={() => setAdding(true)}>{tr("+ Добавить команду")}</Button>
          </>
        }
      />
      <DemoBanner demo={db.meta.demo} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input className={inputClass("pl-9")} placeholder={tr("Найти команду")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Найти команду")} />
        </div>
        <select className={inputClass("sm:w-44")} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={tr("Приоритет")}>
          <option value="all">{tr("Все приоритеты")}</option>
          <option value="A">A</option>
          <option value="Б">{tr("Б")}</option>
          <option value="В">{tr("В")}</option>
          <option value="none">{tr("Без наблюдений")}</option>
        </select>
        <select className={inputClass("sm:w-44")} value={sort} onChange={(e) => setSort(e.target.value)} aria-label={tr("Сортировка")}>
          <option value="score">{tr("По оценке")}</option>
          <option value="matches">{tr("По числу матчей")}</option>
          <option value="number">{tr("По номеру")}</option>
        </select>
      </div>

      {list.length ? (
        <div className="overflow-hidden rounded-xl border border-zinc-800/80">
          <table className="w-full text-sm">
            <thead className="hidden bg-zinc-950 sm:table-header-group">
              <tr>
                {[tr("Команда"), tr("Роль"), tr("Оценка"), "OPR", tr("Матчи"), tr("Приоритет"), ""].map((h, i) => (
                  <th key={i} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.team.id} className="cursor-pointer border-b border-zinc-900 last:border-0 hover:bg-zinc-900/50 max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:px-1" onClick={() => go("teams", s.team.id)}>
                  <td className="px-3 py-3">
                    <div className="num font-medium text-white">{s.team.number}</div>
                    <div className="text-xs text-zinc-500">{s.team.name || "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-zinc-400 max-sm:hidden">{s.count ? roleLabel(s) : "—"}</td>
                  <td className="num px-3 py-3 max-sm:text-right">
                    {s.count ? (
                      <>
                        <span className="font-medium text-white">{fmt(s.mean)}</span> <span className="text-xs text-zinc-500">±{fmt(s.sd)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">
                        <span className="sm:hidden">{oprMap.has(s.team.number) ? `OPR ${fmt(oprMap.get(s.team.number), 0)}` : tr("скаутинга нет")}</span>
                        <span className="hidden sm:inline">—</span>
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-3 text-zinc-300 max-sm:hidden">{oprMap.has(s.team.number) ? fmt(oprMap.get(s.team.number), 0) : "—"}</td>
                  <td className="num px-3 py-3 text-zinc-400 max-sm:hidden">{s.count}</td>
                  <td className="px-3 py-3 max-sm:hidden">
                    {s.count ? <Badge tone={priority(s) === "A" ? "strong" : "muted"}>{tr(priority(s))}</Badge> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right max-sm:hidden">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        go("scouting", "", { team: s.team.id });
                      }}
                    >
                      {tr("+ Матч")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} title={db.teams.length ? tr("Ничего не найдено") : tr("Команд пока нет")} body={db.teams.length ? tr("Измените запрос или фильтр.") : tr("Выберите ивент или добавьте команду вручную.")} action={!db.teams.length ? <Button onClick={() => setAdding(true)}>{tr("+ Добавить команду")}</Button> : null} />
      )}
      <AddTeamModal open={adding} onClose={() => setAdding(false)} onAdd={add} />
    </div>
  );
}
