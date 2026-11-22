import { useMemo, useRef, useState } from "react";
import { CalendarClock, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge, Button, EmptyState, IconButton, inputClass, PageHeader, Panel, Segmented, SplitBar, Stat } from "../components/ui";
import { toast } from "../components/feedback";
import { syncSchedule, useScheduleSyncState } from "../lib/scheduleSync";
import { calibration, computeOpr, fmt, predictMatch } from "../lib/model";
import { getLang, tr } from "../lib/i18n";

function timeText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(getLang() === "en" ? "en-GB" : "ru-RU", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function Alliance({ teams, side, mine, byNumber, onTeam, won }) {
  const blue = side === "blue";
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${blue ? "items-end" : "items-start"}`}>
      {teams.map((n) => {
        const name = byNumber.get(n)?.name || "";
        const isMine = n === mine;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onTeam(n)}
            title={name ? `${n} · ${name}` : n}
            className={`flex w-full max-w-[13rem] items-baseline gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors hover:border-white ${blue ? "flex-row-reverse text-right" : ""} ${
              side === "red" ? "border-zinc-500" : "border-dashed border-zinc-600"
            } ${isMine ? "bg-white text-black" : ""}`}
          >
            <span className={`num shrink-0 text-xs font-semibold ${isMine ? "text-black" : won ? "text-white" : "text-zinc-200"}`}>{n}</span>
            <span className={`min-w-0 truncate text-xs ${isMine ? "text-zinc-600" : "text-zinc-500"}`}>{name || "—"}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Matches({ db, setDb, go, prefs, setPrefs }) {
  const sync = useScheduleSyncState();
  const dbRef = useRef(db);
  dbRef.current = db;
  const [filter, setFilter] = useState(() => (db.schedule?.matches?.some((m) => !m.played) ? "upcoming" : "all"));
  const schedule = db.schedule && db.schedule.eventCode === db.meta.eventCode ? db.schedule : null;
  const byNumber = useMemo(() => new Map(db.teams.map((t) => [t.number, t])), [db.teams]);
  const mine = prefs.myTeam || "";

  const opr = useMemo(() => computeOpr(schedule?.matches), [schedule]);
  const calib = useMemo(() => (schedule ? calibration(db, schedule.matches) : null), [db, schedule]);

  // Manual refresh is optional: the schedule also syncs automatically (lib/scheduleSync.js).
  async function refresh() {
    const r = await syncSchedule(() => dbRef.current, setDb);
    if (r.error) toast(`${tr("Не удалось загрузить расписание")}: ${r.error}`, { error: true });
    else if (r.ok && !r.matches) toast(tr("Расписание этого ивента ещё не опубликовано."));
    else if (r.ok) toast(r.changed ? tr("Есть новые результаты.") : tr("Новых результатов пока нет."));
  }
  const loading = sync.loading;

  const list = useMemo(() => {
    if (!schedule) return [];
    return schedule.matches.filter((m) => {
      if (filter === "upcoming") return !m.played;
      if (filter === "played") return m.played;
      if (filter === "mine") return mine && [...m.red, ...m.blue].includes(mine);
      return true;
    });
  }, [schedule, filter, mine]);

  const topOpr = useMemo(() => [...opr.opr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10), [opr]);
  const openTeam = (n) => byNumber.get(n) && go("teams", byNumber.get(n).id);

  const header = (
    <PageHeader
      title={tr("Матчи")}
      subtitle={tr("Официальное расписание и результаты (FTCScout) + прогноз по вашему скаутингу и OPR.")}
      actions={
        db.meta.eventCode && !db.meta.demo ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500" role="status">
              {loading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />}
              {loading ? tr("Обновляю…") : schedule && schedule.matches.length && schedule.matches.every((m) => m.played) ? tr("Турнир завершён") : tr("Автообновление каждые 2 мин")}
            </span>
            <IconButton label={tr("Обновить сейчас")} className="border border-zinc-800" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" />
            </IconButton>
          </div>
        ) : null
      }
    />
  );

  if (db.meta.demo || !db.meta.eventCode) {
    return (
      <div>
        {header}
        <EmptyState icon={CalendarClock} title={tr("Нужен реальный ивент")} body={tr("Расписание и результаты загружаются для выбранного турнира. В демо-режиме их нет.")} action={<Button onClick={() => setPrefs((p) => ({ ...p, event: { ...p.event, set: false, changing: true } }))}>{tr("Выбрать ивент")}</Button>} />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div>
        {header}
        {loading || (!sync.syncedAt && !sync.error) ? (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 px-5 py-10 text-sm text-zinc-400" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {tr("Загружаю расписание и результаты…")}
          </div>
        ) : sync.error ? (
          <EmptyState icon={CalendarClock} title={tr("Не удалось загрузить расписание")} body={`${sync.error}. ${tr("VITE попробует снова автоматически.")}`} action={<Button onClick={refresh}>{tr("Повторить")}</Button>} />
        ) : (
          <EmptyState icon={CalendarClock} title={tr("Расписание ещё не опубликовано")} body={tr("Как только организаторы его опубликуют, оно появится здесь само — VITE проверяет каждые 2 минуты.")} />
        )}
      </div>
    );
  }

  const played = schedule.matches.filter((m) => m.played).length;

  return (
    <div>
      {header}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("Сыграно")} value={`${played} / ${schedule.matches.length}`} sub={sync.syncedAt || schedule.fetchedAt ? `${tr("обновлено")} ${timeText(sync.syncedAt ? new Date(sync.syncedAt).toISOString() : schedule.fetchedAt)}` : ""} />
        <Stat label={tr("Точность модели")} value={calib ? `${Math.round(calib.accuracy * 100)}%` : "—"} sub={calib ? `${calib.n} ${tr("матчей")} · Brier ${fmt(calib.brier, 2)}` : tr("нужен скаутинг до матча")} />
        <Stat label={tr("Средний счёт альянса")} value={played ? fmt(schedule.matches.filter((m) => m.played).reduce((s, m) => s + m.redScore + m.blueScore, 0) / (2 * played), 0) : "—"} />
        <Stat label="OPR" value={opr.matches ? `±${fmt(opr.residualSd, 0)}` : "—"} sub={opr.matches ? tr("типичная ошибка прогноза альянса") : tr("после первых матчей")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel
          title={tr("Расписание")}
          actions={
            <>
              <select className={inputClass("h-8 w-auto text-xs")} value={mine} onChange={(e) => setPrefs((p) => ({ ...p, myTeam: e.target.value }))} aria-label={tr("Моя команда")}>
                <option value="">{tr("Моя команда")}…</option>
                {db.teams.map((t) => (
                  <option key={t.id} value={t.number}>
                    {t.number} {t.name}
                  </option>
                ))}
              </select>
              <Segmented
                label={tr("Фильтр")}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "upcoming", label: tr("Впереди") },
                  { value: "played", label: tr("Сыграны") },
                  ...(mine ? [{ value: "mine", label: tr("Мои") }] : []),
                  { value: "all", label: tr("Все") },
                ]}
              />
            </>
          }
        >
          {list.length ? (
            <ul className="-mx-4 divide-y divide-zinc-900 sm:-mx-5">
              {list.map((m) => {
                const p = predictMatch(db, m.red, m.blue, opr);
                const pred = p.opr || p.scouting;
                const redWon = m.played && m.redScore > m.blueScore;
                const blueWon = m.played && m.blueScore > m.redScore;
                const label = m.level === "qual" ? `Q${m.number}` : `P${m.series}-${m.number}`;
                return (
                  <li key={`${m.level}-${m.series}-${m.number}`} className={`grid gap-3 px-4 py-3 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,200px)] sm:items-center sm:px-5 ${mine && [...m.red, ...m.blue].includes(mine) ? "bg-zinc-900/40" : ""}`}>
                    <div className="flex items-center gap-2 sm:block">
                      <div className="num text-sm font-semibold text-white">{label}</div>
                      <div className="text-[11px] text-zinc-500">{timeText(m.time)}</div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Alliance teams={m.red} side="red" mine={mine} byNumber={byNumber} onTeam={openTeam} won={redWon} />
                      <div className="num min-w-[64px] text-center text-sm">
                        {m.played ? (
                          <>
                            <span className={redWon ? "font-semibold text-white" : "text-zinc-500"}>{m.redScore}</span>
                            <span className="text-zinc-700"> : </span>
                            <span className={blueWon ? "font-semibold text-white" : "text-zinc-500"}>{m.blueScore}</span>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600">vs</span>
                        )}
                      </div>
                      <Alliance teams={m.blue} side="blue" mine={mine} byNumber={byNumber} onTeam={openTeam} won={blueWon} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        {pred ? (
                          <>
                            <SplitBar p={pred.pRed} leftLabel={tr("Кр.")} rightLabel={tr("Син.")} />
                            <div className="mt-0.5 text-[10px] text-zinc-600">
                              {p.opr ? (m.played ? tr("OPR, ретроспективно") : "OPR") : tr("скаутинг")}
                              {p.opr && p.scouting ? ` · ${tr("скаутинг")} ${Math.round(p.scouting.pRed * 100)}%` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-600">{tr("нет данных для прогноза")}</span>
                        )}
                      </div>
                      {!m.played && m.level === "qual" ? (
                        <>
                          <IconButton label={tr("AI-брифинг матча")} className="border border-zinc-800" onClick={() => go("ai", "", { mission: "prematch", target: String(m.number) })}>
                            <Sparkles size={14} aria-hidden="true" />
                          </IconButton>
                          <Button size="sm" variant="secondary" onClick={() => go("scouting", "", { match: m.number })}>
                            {tr("Скаут")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">{filter === "upcoming" ? tr("Все матчи сыграны.") : tr("Нет матчей по фильтру.")}</p>
          )}
        </Panel>

        <Panel title={tr("Лидеры по OPR")} subtitle={tr("Вклад робота, оценённый по официальным счетам альянсов (без штрафов).")}>
          {topOpr.length ? (
            <ol className="space-y-2">
              {topOpr.map(([n, v], i) => (
                <li key={n}>
                  <button type="button" onClick={() => openTeam(n)} className="grid w-full grid-cols-[20px_1fr_auto] items-center gap-2 text-left text-sm hover:text-white">
                    <span className="num text-xs text-zinc-600">{i + 1}</span>
                    <span className="truncate">
                      <span className="num font-medium text-white">{n}</span> <span className="text-zinc-500">{byNumber.get(n)?.name}</span>
                    </span>
                    <Badge tone={i === 0 ? "strong" : "muted"}>{fmt(v, 0)}</Badge>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">{tr("Появится после первых сыгранных матчей.")}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
