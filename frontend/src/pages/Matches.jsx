import { useMemo, useState } from "react";
import { CalendarClock, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge, Button, EmptyState, IconButton, inputClass, PageHeader, Panel, Segmented, SplitBar, Stat } from "../components/ui";
import { toast } from "../components/feedback";
import { api } from "../lib/api";
import { applySchedule } from "../lib/db";
import { calibration, computeOpr, fmt, predictMatch } from "../lib/model";
import { getLang, tr } from "../lib/i18n";

function seasonOf(db) {
  return (String(db.meta.season || "").match(/\d{4}/) || ["2026"])[0];
}

function timeText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(getLang() === "en" ? "en-GB" : "ru-RU", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function Alliance({ teams, side, mine, byNumber, onTeam, won }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${side === "blue" ? "sm:justify-end" : ""}`}>
      {teams.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onTeam(n)}
          title={byNumber.get(n)?.name || ""}
          className={`num rounded-md border px-2 py-1 text-xs transition-colors hover:border-white ${side === "red" ? "border-zinc-500" : "border-dashed border-zinc-600"} ${n === mine ? "bg-white font-semibold text-black" : won ? "text-white" : "text-zinc-300"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Matches({ db, setDb, go, prefs, setPrefs }) {
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(() => (db.schedule?.matches?.some((m) => !m.played) ? "upcoming" : "all"));
  const season = seasonOf(db);
  const schedule = db.schedule && db.schedule.eventCode === db.meta.eventCode ? db.schedule : null;
  const byNumber = useMemo(() => new Map(db.teams.map((t) => [t.number, t])), [db.teams]);
  const mine = prefs.myTeam || "";

  const opr = useMemo(() => computeOpr(schedule?.matches), [schedule]);
  const calib = useMemo(() => (schedule ? calibration(db, schedule.matches) : null), [db, schedule]);

  async function load() {
    if (!db.meta.eventCode || db.meta.demo) return;
    setLoading(true);
    try {
      const data = await api.eventMatches(season, db.meta.eventCode);
      if (!data.matches?.length) {
        toast(tr("Расписание этого ивента ещё не опубликовано."), { error: true });
        return;
      }
      setDb((d) => applySchedule(d, { season, eventCode: d.meta.eventCode, matches: data.matches }));
      toast(`${tr("Расписание обновлено")}: ${data.matches.length} ${tr("матчей")}`);
    } catch (e) {
      toast(`${tr("Не удалось загрузить расписание")}: ${e.message}`, { error: true });
    } finally {
      setLoading(false);
    }
  }

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
          <Button variant={schedule ? "secondary" : "primary"} onClick={load} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
            {schedule ? tr("Обновить") : tr("Загрузить расписание")}
          </Button>
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
        <EmptyState icon={CalendarClock} title={tr("Расписание ещё не загружено")} body={tr("Загрузите его один раз — дальше оно доступно офлайн и попадает в резервную копию.")} action={<Button onClick={load} disabled={loading}>{tr("Загрузить расписание")}</Button>} />
      </div>
    );
  }

  const played = schedule.matches.filter((m) => m.played).length;

  return (
    <div>
      {header}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("Сыграно")} value={`${played} / ${schedule.matches.length}`} sub={schedule.fetchedAt ? `${tr("обновлено")} ${timeText(schedule.fetchedAt)}` : ""} />
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
                  <li key={`${m.level}-${m.series}-${m.number}`} className={`grid gap-3 px-4 py-3 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,220px)] sm:items-center sm:px-5 ${mine && [...m.red, ...m.blue].includes(mine) ? "bg-zinc-900/40" : ""}`}>
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
