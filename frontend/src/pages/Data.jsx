import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { Button, DemoBanner, Field, inputClass, PageHeader, Panel } from "../components/ui";
import { confirmDialog, toast } from "../components/feedback";
import { api } from "../lib/api";
import { download, safeFileName } from "../lib/csv";
import { applyEvent, emptyDb, importScoutingCsv, mergeDb, migrateDb, scoutingCsv } from "../lib/db";
import { useScheduleSyncState } from "../lib/scheduleSync";
import { loadEventTeams, teamsToDb } from "../lib/eventLoader";
import { makeSeed } from "../lib/model";
import { tr } from "../lib/i18n";

function FileButton({ accept, onFile, children, variant = "secondary" }) {
  const ref = useRef(null);
  return (
    <>
      <Button variant={variant} onClick={() => ref.current?.click()}>
        <FileUp size={15} aria-hidden="true" />
        {children}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 10 * 1024 * 1024) {
            toast(tr("Файл больше 10 МБ."), { error: true });
            return;
          }
          try {
            await onFile(await f.text(), f.name);
          } catch (err) {
            toast(err.message, { error: true });
          }
        }}
      />
    </>
  );
}

function summary(r) {
  return `${tr("Добавлено записей")}: ${r.added}, ${tr("пропущено дублей")}: ${r.skipped}${r.teamsAdded ? `, ${tr("новых команд")}: ${r.teamsAdded}` : ""}.`;
}

export default function Data({ db, setDb, setPrefs }) {
  const [season, setSeason] = useState((String(db.meta.season).match(/\d{4}/) || ["2026"])[0]);
  const [code, setCode] = useState(db.meta.demo ? "" : db.meta.eventCode || "");
  const [toaKey, setToaKey] = useState("");
  const [busy, setBusy] = useState("");
  const [out, setOut] = useState(null);
  const [rankings, setRankings] = useState(null); // null = loading
  const [rankError, setRankError] = useState("");
  const sync = useScheduleSyncState();

  // World ranking loads by itself (and again when the season changes).
  useEffect(() => {
    let alive = true;
    setRankings(null);
    setRankError("");
    api
      .rankings(season, 40)
      .then((d) => {
        if (!alive) return;
        // FTCScout returns one row per team per event: keep each team's best (first) row.
        const seen = new Set();
        setRankings((d.rankings || []).filter((r) => !seen.has(r.teamNumber) && seen.add(r.teamNumber)).slice(0, 10));
      })
      .catch((e) => {
        if (!alive) return;
        setRankError(e.message);
        setRankings([]);
      });
    return () => {
      alive = false;
    };
  }, [season]);
  const [consent, setConsent] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = safeFileName(db.meta.eventCode || "vite");

  async function run(key, fn) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy("");
    }
  }

  async function restoreOrMerge(text) {
    let parsed;
    try {
      parsed = migrateDb(JSON.parse(text));
    } catch {
      throw new Error(tr("Это не резервная копия VITE."));
    }
    const merge = await confirmDialog({
      title: tr("Как применить файл?"),
      body: `${tr("В файле")}: ${parsed.teams.length} ${tr("команд")}, ${parsed.records.length} ${tr("записей")}. ${tr("«Объединить» добавит новые записи к вашим (дубли пропускаются). Для полной замены базы нажмите «Отмена» и затем «Заменить».")}`,
      confirmLabel: tr("Объединить"),
    });
    if (merge) {
      const r = mergeDb(db, parsed);
      setDb(r.db);
      toast(summary(r));
      return;
    }
    const replace = await confirmDialog({
      title: tr("Заменить текущую базу?"),
      body: `${tr("Текущие данные")} (${db.records.length} ${tr("записей")}) ${tr("будут заменены содержимым файла. Сначала скачайте JSON-копию, если она нужна.")}`,
      confirmLabel: tr("Заменить"),
      danger: true,
    });
    if (!replace) return;
    setDb({ ...parsed, meta: { ...parsed.meta, demo: false } });
    toast(tr("Резервная копия восстановлена."));
  }

  return (
    <div>
      <PageHeader title={tr("Импорт и экспорт")} subtitle={tr("Резервные копии, обмен данными между скаутами и загрузка официальных данных. Ключи API хранятся только на сервере.")} />
      <DemoBanner demo={db.meta.demo} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={tr("Резервная копия и обмен")} subtitle={tr("Каждый скаут экспортирует файл — капитан объединяет их без дублей.")}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download(`vite-${name}-${stamp}.json`, JSON.stringify(db, null, 2), "application/json")}>
              <Download size={15} aria-hidden="true" />
              {tr("Скачать JSON")}
            </Button>
            <FileButton accept=".json,application/json" onFile={restoreOrMerge}>
              {tr("Открыть JSON")}
            </FileButton>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            {db.teams.length} {tr("команд")} · {db.records.length} {tr("записей")} · {db.schedule ? `${db.schedule.matches.length} ${tr("матчей в расписании")}` : tr("без расписания")}
          </p>
        </Panel>

        <Panel title={tr("CSV скаутинг")} subtitle={tr("Для Excel / Google Sheets. Импорт добавляет записи и пропускает дубли.")}>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!db.records.length} onClick={() => download(`vite-${name}-scouting-${stamp}.csv`, scoutingCsv(db), "text/csv;charset=utf-8")}>
              <Download size={15} aria-hidden="true" />
              {tr("Экспорт наблюдений")}
            </Button>
            <Button variant="ghost" onClick={() => download("vite-scouting-template.csv", scoutingCsv(db, []), "text/csv;charset=utf-8")}>
              {tr("Пустой шаблон")}
            </Button>
            <FileButton
              accept=".csv,text/csv"
              onFile={(text) => {
                let r;
                try {
                  r = importScoutingCsv(db, text);
                } catch (e) {
                  throw new Error(/teamNumber/.test(e.message) ? tr("Нужна колонка teamNumber.") : tr("В CSV нет записей."), { cause: e });
                }
                setDb(r.db);
                toast(summary(r));
              }}
            >
              {tr("Импорт CSV")}
            </FileButton>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title={tr("Официальные данные")} subtitle={tr("FIRST Events API (если ключ задан на сервере) с резервом FTCScout — без ключа.")}>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label={tr("Сезон (год начала)")}>
              <select className={inputClass()} value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="2026">2026–2027</option>
                <option value="2027">2027–2028</option>
                <option value="2025">2025–2026</option>
              </select>
            </Field>
            <Field label={tr("Код ивента")}>
              <input className={inputClass("uppercase")} value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} placeholder="AUBRQ1" maxLength={20} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={!code || Boolean(busy)}
              onClick={() =>
                run("teams", async () => {
                  const { teams, source, name: evName } = await loadEventTeams(season, code);
                  const upper = code.toUpperCase();
                  if (db.meta.eventCode !== upper || db.meta.demo) {
                    const ok = await confirmDialog({
                      title: tr("Переключиться на этот ивент?"),
                      body: tr("Ваши наблюдения сохранятся. Команды без наблюдений из прошлого ивента будут убраны из списка; демо-данные будут заменены."),
                      confirmLabel: tr("Переключить"),
                    });
                    if (!ok) return;
                    setPrefs((p) => ({ ...p, event: { set: true, year: season, eventCode: upper, eventName: evName || upper } }));
                  }
                  setDb((d) => applyEvent(d, { season, eventCode: upper, eventName: evName || d.meta.eventName || upper, teams: teamsToDb(teams, source === "FIRST" ? "FTC Events API" : "FTCScout") }));
                  setOut(`${tr("Команд")}: ${teams.length} (${source}).`);
                })
              }
            >
              {busy === "teams" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              {tr("Загрузить команды")}
            </Button>
            <Button
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() =>
                run("health", async () => {
                  const s = await api.health();
                  setOut(
                    `${tr("Сервер")} v${s.version || "?"}: FIRST ${s.official_api_configured ? tr("подключён") : tr("без ключа")}, TOA ${s.toa_configured ? tr("подключён") : tr("без ключа")}, FTCScout ${tr("доступен без ключа")}.`
                  );
                })
              }
            >
              {tr("Проверить сервер")}
            </Button>
          </div>
          {out ? <p className="mt-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300" role="status">{out}</p> : null}
          {!db.meta.demo && db.meta.eventCode ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500" role="status">
              {sync.loading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />}
              {tr("Расписание и результаты")} {db.meta.eventCode}:{" "}
              {db.schedule?.eventCode === db.meta.eventCode
                ? `${db.schedule.matches.length} ${tr("матчей")}, ${tr("сыграно")} ${db.schedule.matches.filter((m) => m.played).length} · ${tr("обновляются автоматически")}`
                : sync.loading
                  ? tr("загружаются…")
                  : tr("ещё не опубликованы — VITE проверяет автоматически")}
            </p>
          ) : null}
        </Panel>

        <Panel title={tr("Мировой рейтинг FTCScout")} subtitle={tr("Лучшие OPR сезона по всем ивентам — для ориентира.")}>
          {rankings === null ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {tr("Загружаю рейтинг…")}
            </p>
          ) : rankError ? (
            <p className="text-sm text-zinc-400">
              {tr("Рейтинг недоступен")}: {rankError}
            </p>
          ) : !rankings.length ? (
            <p className="text-sm text-zinc-500">{tr("Рейтинг пока пуст.")}</p>
          ) : null}
          {rankings?.length ? (
            <ol className="space-y-1.5 text-sm">
              {rankings.map((r, i) => (
                <li key={`${r.teamNumber}-${r.eventCode}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className="num mr-2 text-xs text-zinc-600">{i + 1}</span>
                    <span className="num font-medium text-white">{r.teamNumber}</span> <span className="text-zinc-500">{r.teamName}</span>
                  </span>
                  <span className="num text-zinc-300">{r.opr ? Math.round(r.opr) : "—"}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </Panel>

        <Panel title="The Orange Alliance" subtitle={tr("Ключ TOA_API_KEY задаётся на сервере. Здесь только публичный event key.")}>
          <div className="flex gap-2">
            <input className={inputClass()} value={toaKey} onChange={(e) => setToaKey(e.target.value)} placeholder={tr("например 2526-CMP-DET")} aria-label="TOA event key" />
            <Button
              variant="secondary"
              disabled={!toaKey || Boolean(busy)}
              onClick={() =>
                run("toa", async () => {
                  const d = await api.toaMatches(toaKey);
                  setOut(`${tr("TOA вернул записей")}: ${Array.isArray(d) ? d.length : 0}. ${tr("Это публичные матчи, не скаутинг.")}`);
                })
              }
            >
              {tr("Проверить")}
            </Button>
          </div>
        </Panel>

        <Panel title={tr("Настройки турнира")} subtitle={tr("Название и код используются в отчётах и фильтре записей.")}>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              const x = Object.fromEntries(new FormData(e.currentTarget).entries());
              setDb((d) => ({ ...d, meta: { ...d.meta, eventName: String(x.eventName).slice(0, 120), eventCode: String(x.eventCode).toUpperCase().slice(0, 40), season: String(x.season).slice(0, 12), demo: false } }));
              setConsent(false);
              toast(tr("Настройки сохранены."));
            }}
          >
            <Field label={tr("Название")}>
              <input className={inputClass()} name="eventName" defaultValue={db.meta.eventName} key={`n${db.meta.eventName}`} />
            </Field>
            <Field label={tr("Код")}>
              <input className={inputClass("uppercase")} name="eventCode" defaultValue={db.meta.eventCode} key={`c${db.meta.eventCode}`} />
            </Field>
            <Field label={tr("Сезон")}>
              <input className={inputClass()} name="season" defaultValue={db.meta.season} key={`s${db.meta.season}`} />
            </Field>
            <label className="flex cursor-pointer gap-2.5 text-sm text-zinc-300 sm:col-span-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-white" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              {tr("Сохраняю только данные турнира, без персональных сведений учеников.")}
            </label>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={!consent}>
                {tr("Сохранить")}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel className="lg:col-span-2" title={tr("Опасная зона")} subtitle={tr("Действия ниже меняют локальную базу. Перед удалением скачайте JSON.")}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: tr("Удалить все локальные команды и записи?"),
                  body: `${db.records.length} ${tr("записей и")} ${db.teams.length} ${tr("команд будут удалены с этого устройства. Отменить нельзя.")}`,
                  confirmLabel: tr("Удалить"),
                  danger: true,
                  typeToConfirm: tr("УДАЛИТЬ"),
                });
                if (!ok) return;
                setDb(emptyDb({ eventName: db.meta.eventName, eventCode: db.meta.eventCode, season: db.meta.season }));
                toast(tr("Локальные данные удалены."));
              }}
            >
              {tr("Удалить локальные данные")}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await confirmDialog({ title: tr("Добавить демо-данные?"), body: tr("12 вымышленных команд с пометкой «демо» будут добавлены к текущим данным."), confirmLabel: tr("Добавить") });
                if (!ok) return;
                const d = makeSeed();
                setDb((x) => ({
                  ...x,
                  teams: [...x.teams, ...d.teams.filter((t) => !x.teams.some((y) => y.id === t.id))],
                  records: [...x.records.filter((r) => !r.id.startsWith("demo-")), ...d.records],
                  meta: { ...x.meta, demo: true, eventCode: x.meta.eventCode || d.meta.eventCode, eventName: x.meta.eventName || d.meta.eventName },
                }));
              }}
            >
              {tr("Восстановить демо")}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
