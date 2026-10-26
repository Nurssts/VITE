import { tr } from "../lib/i18n";
import { useState } from "react";
import { Button, DemoBanner, Field, inputClass, Panel } from "../components/ui";
import { makeSeed } from "../lib/model";
import { bool, CSV_COLUMNS, csvEsc, download, parseCSV } from "../lib/store";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function apiJson(url) {
  // Use relative URL if API_BASE is empty (same-origin deployment on Render)
  const baseUrl = API_BASE || "";
  const response = await fetch(baseUrl + url, { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.detail || `Server returned ${response.status}.`);
  return data;
}

function exportRow(db, r) {
  const t = db.teams.find((x) => x.id === r.teamId) || {};
  return {
    teamNumber: t.number || r.teamId,
    eventCode: r.eventCode,
    eventName: r.eventName || db.meta.eventName,
    matchNo: r.matchNo,
    date: r.date,
    autoLeave: r.autoLeave,
    autoPark: r.autoPark,
    autoHiveTips: r.autoHiveTips,
    teleopHiveTips: r.teleopHiveTips,
    cellItems: r.cellItems,
    flowerPlaced: r.flowerPlaced,
    ownedFlowerItems: r.ownedFlowerItems,
    bottomNectar: r.bottomNectar,
    gardenItems: r.gardenItems,
    teleopPark: r.teleopPark,
    penalties: r.penalties,
    disabled: r.disabled,
    confidence: r.confidence,
    scout: r.scout,
    notes: r.notes,
    autoTrajectory: r.autoTrajectory,
    pollenCycleSec: r.pollenCycleSec,
    nectarCycleSec: r.nectarCycleSec,
    hiveSuccess: r.hiveSuccess,
    flowerAccuracy: r.flowerAccuracy,
  };
}

export default function Data({ db, setDb, toast }) {
  const [season, setSeason] = useState((db.meta.season || "2026-2027").replace(/\D/g, "").slice(-4) || "2026");
  const [code, setCode] = useState(db.meta.demo ? "" : db.meta.eventCode || "");
  const [toaKey, setToaKey] = useState("");
  const [events, setEvents] = useState([]);
  const [out, setOut] = useState("");
  const [consent, setConsent] = useState(false);

  function exportCsv(records) {
    const txt = [CSV_COLUMNS.join(","), ...records.map((r) => CSV_COLUMNS.map((k) => csvEsc(exportRow(db, r)[k])).join(","))].join("\r\n");
    download("vite-biobuzz-scouting.csv", "\ufeff" + txt, "text/csv;charset=utf-8");
  }

  function importCsv(text) {
    const data = parseCSV(text);
    if (!data.length) throw Error(tr("В CSV нет записей."));
    if (!data[0].teamNumber && !data[0].teamId) throw Error(tr("Нужна колонка teamNumber."));
    const next = { ...db, teams: [...db.teams], records: [...db.records], meta: { ...db.meta, demo: false } };
    data.forEach((x) => {
      const no = String(x.teamNumber || x.teamId || "").trim();
      if (!no) return;
      let t = next.teams.find((t) => t.number === no || t.id === no);
      if (!t) {
        t = { id: no, number: no, name: x.teamName || `${tr("Команда")} ${no}`, region: x.region || "", style: tr("Импортировано"), notes: "" };
        next.teams.push(t);
      }
      next.records.push({
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        teamId: t.id,
        eventCode: x.eventCode || next.meta.eventCode || "",
        eventName: x.eventName || next.meta.eventName || "",
        matchNo: Number(x.matchNo) || 0,
        date: x.date || new Date().toISOString().slice(0, 10),
        autoLeave: bool(x.autoLeave),
        autoPark: bool(x.autoPark),
        autoHiveTips: Number(x.autoHiveTips) || 0,
        teleopHiveTips: Number(x.teleopHiveTips) || 0,
        cellItems: Number(x.cellItems) || 0,
        flowerPlaced: Number(x.flowerPlaced) || 0,
        ownedFlowerItems: Number(x.ownedFlowerItems) || 0,
        bottomNectar: Number(x.bottomNectar) || 0,
        gardenItems: Number(x.gardenItems) || 0,
        teleopPark: bool(x.teleopPark),
        penalties: Number(x.penalties) || 0,
        disabled: bool(x.disabled),
        confidence: ["high", "medium", "low"].includes(x.confidence) ? x.confidence : "medium",
        scout: x.scout || "",
        notes: x.notes || "",
        autoTrajectory: x.autoTrajectory || "unknown",
        pollenCycleSec: Number(x.pollenCycleSec) || "",
        nectarCycleSec: Number(x.nectarCycleSec) || "",
        hiveSuccess: Number(x.hiveSuccess) || "",
        flowerAccuracy: Number(x.flowerAccuracy) || "",
      });
    });
    setDb(next);
    toast(tr("CSV импортирован."));
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{tr("Импорт и экспорт")}</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">{tr("FIRST Events API и TOA работают через локальный прокси. Ключи не вводятся в браузер (кроме кода ивента).")}</p>
      <DemoBanner demo={db.meta.demo} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Panel>
          <h2 className="text-sm font-semibold">{tr("CSV скаутинг")}</h2>
          <p className="mt-2 text-sm text-zinc-400">{tr("Шаблон совместим с прежней версией; добавлены цикл и траектория.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportCsv(db.records)}>
              {tr("Экспорт наблюдений")}
            </Button>
            <Button variant="secondary" onClick={() => exportCsv([])}>
              {tr("Пустой шаблон")}
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400">
              {tr("Импорт CSV")}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    importCsv(await f.text());
                  } catch (err) {
                    toast(err.message, true);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">{tr("JSON резервная копия")}</h2>
          <p className="mt-2 text-sm text-zinc-400">{tr("Команды, драфт и все наблюдения этого устройства.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download("vite-biobuzz-backup.json", JSON.stringify(db, null, 2), "application/json")}>
              {tr("Скачать JSON")}
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400">
              {tr("Восстановить")}
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const next = JSON.parse(await f.text());
                    if (!Array.isArray(next.teams) || !Array.isArray(next.records)) throw Error(tr("Это не резервная копия VITE."));
                    if (!confirm(tr("Заменить текущую базу?"))) return;
                    setDb({ ...next, meta: { ...next.meta, demo: false } });
                    toast(tr("Резервная копия восстановлена."));
                  } catch (err) {
                    toast(err.message, true);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">FIRST Events API</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {tr("Credentials задаются только в окружении сервера: FTC_API_USERNAME / FTC_API_TOKEN. Коммерческое использование данных FIRST запрещено их условиями.")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label={tr("Сезон")}>
              <input className={inputClass()} value={season} onChange={(e) => setSeason(e.target.value)} />
            </Field>
            <Field label={tr("Код ивента")}>
              <input className={inputClass()} value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson("/api/ftc/events?season=" + encodeURIComponent(season));
                  setEvents(data.events || []);
                  toast(`${tr("Ивентов")}: ${(data.events || []).length}`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              {tr("Список ивентов")}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const s = await apiJson("/api/health");
                  setOut(s.official_api_configured ? `${tr("Подключено")}: ${s.sources.first}` : tr("Сервер есть, но FIRST credentials не заданы."));
                } catch (e) {
                  setOut(e.message);
                }
              }}
            >
              {tr("Проверить")}
            </Button>
            <Button
              onClick={async () => {
                try {
                  const [teams, matches] = await Promise.all([
                    apiJson(`/api/ftc/teams?season=${encodeURIComponent(season)}&event_code=${encodeURIComponent(code)}`),
                    apiJson(`/api/ftc/matches?season=${encodeURIComponent(season)}&event_code=${encodeURIComponent(code)}&tournament_level=qual`),
                  ]);
                  const officialTeams = teams.teams || [];
                  const next = { ...db, teams: [...db.teams], records: db.records, meta: { ...db.meta } };
                  if (next.meta.demo && confirm(tr("Заменить учебные данные официальным списком команд?"))) {
                    next.teams = [];
                    next.records = [];
                    next.meta.demo = false;
                    next.draft = { captain: "", picked: [], removed: [] };
                  }
                  if (!next.meta.demo) {
                    officialTeams.forEach((x) => {
                      const no = String(x.teamNumber ?? x.displayTeamNumber ?? "").trim();
                      if (!no) return;
                      let t = next.teams.find((t) => t.number === no);
                      // nameShort = real team name; nameFull = school/sponsors list
                      const teamName = (x.nameShort || x.teamName || x.nameFull || "").trim() || `Команда ${no}`;
                      if (t && (t.style === "FTC Events API" || /^Команда \d+$/.test(t.name))) {
                        t.name = teamName; // fix names saved earlier from nameFull
                      }
                      if (!t) {
                        t = {
                          id: no,
                          number: no,
                          name: teamName,
                          region: [x.city, x.stateProv].filter(Boolean).join(", "),
                          style: "FTC Events API",
                          notes: "",
                        };
                        next.teams.push(t);
                      }
                    });
                    next.meta.eventCode = code.toUpperCase();
                    next.meta.season = `${Number(season) - 1}-${season}`;
                    if (!next.draft?.captain && next.teams[0]) next.draft = { ...(next.draft || {}), captain: next.teams[0].id, picked: [], removed: [] };
                    setDb(next);
                  }
                  setOut(`${tr("Команд")}: ${officialTeams.length}. ${tr("Квалификаций в ответе")}: ${(matches.matches || []).length}. ${tr("Официальный счёт не подменяет скаутинг робота.")}`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              {tr("Загрузить команды и матчи")}
            </Button>
          </div>
          {events.length ? (
            <select
              className={`mt-3 ${inputClass()}`}
              onChange={(e) => setCode(e.target.value)}
              value={code}
            >
              <option value="">{tr("Выберите ивент")}</option>
              {events.map((e) => (
                <option key={e.code || e.eventCode} value={e.code || e.eventCode}>
                  {e.name || e.eventName} · {e.code || e.eventCode}
                </option>
              ))}
            </select>
          ) : null}
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">The Orange Alliance</h2>
          <p className="mt-2 text-sm text-zinc-400">{tr("Ключ TOA_API_KEY задаётся на сервере. Здесь только публичный event key.")}</p>
          <Field label="TOA event key">
            <input className={inputClass()} value={toaKey} onChange={(e) => setToaKey(e.target.value)} placeholder={tr("например 2526-CMP-DET")} />
          </Field>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={async () => {
              try {
                const data = await apiJson(`/api/toa/event/${encodeURIComponent(toaKey)}/matches`);
                setOut(`${tr("TOA вернул записей")}: ${Array.isArray(data) ? data.length : JSON.stringify(data).slice(0, 120)}. ${tr("Это публичные матчи, не скаутинг.")}`);
              } catch (e) {
                toast(e.message, true);
              }
            }}
          >
            {tr("Загрузить матчи TOA")}
          </Button>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">FTCScout.org API</h2>
          <p className="mt-2 text-sm text-zinc-400">{tr("Публичный API команд, рейтингов и матчей. Аутентификация не требуется.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson("/api/ftcscout/teams");
                  setOut(`${tr("Команд")}: ${data.count}. ${tr("Это публичный список команд FTCScout.")}`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              {tr("Все команды")}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson("/api/ftcscout/events?season=2026");
                  setOut(`Events in 2026 season: ${data.count}.`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              Events 2026
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson("/api/ftcscout/rankings?season=2026&take=50");
                  setOut(`TEP Rankings: ${data.count} teams in top-50.`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              TEP Rankings
            </Button>
          </div>
        </Panel>
      </div>
      {out ? <p className="mt-4 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-600 shadow-sm">{out}</p> : null}
      <Panel className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">{tr("Настройки турнира")}</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!consent) return;
            const x = Object.fromEntries(new FormData(e.target).entries());
            setDb({ ...db, meta: { ...db.meta, eventName: x.eventName, eventCode: x.eventCode, season: x.season, demo: false } });
            toast(tr("Настройки сохранены."));
          }}
        >
          <Field label={tr("Название")}>
            <input className={inputClass()} name="eventName" defaultValue={db.meta.eventName} />
          </Field>
          <Field label={tr("Код")}>
            <input className={inputClass()} name="eventCode" defaultValue={db.meta.eventCode} />
          </Field>
          <Field label={tr("Сезон")}>
            <input className={inputClass()} name="season" defaultValue={db.meta.season} />
          </Field>
          <label className="sm:col-span-3 flex gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {tr("Сохраняю только данные турнира, без персональных сведений учеников.")}
          </label>
          <Button type="submit">{tr("Сохранить")}</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm(tr("Удалить все локальные команды и записи? Сначала скачайте JSON."))) return;
              setDb({ version: 2, meta: { demo: false, eventName: "", eventCode: "", season: "2026-2027", updatedAt: new Date().toISOString() }, teams: [], records: [], draft: { captain: "", picked: [], removed: [] } });
            }}
          >
            {tr("Удалить локальные данные")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const d = makeSeed();
              setDb({
                ...db,
                teams: [...db.teams, ...d.teams.filter((t) => !db.teams.some((x) => x.id === t.id))],
                records: [...db.records, ...d.records],
                meta: { ...db.meta, demo: true },
              });
            }}
          >
            {tr("Восстановить демо")}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
