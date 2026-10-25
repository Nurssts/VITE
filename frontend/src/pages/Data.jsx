import { useState } from "react";
import { Button, DemoBanner, Field, inputClass, Panel } from "../components/ui";
import { makeSeed } from "../lib/model";
import { bool, CSV_COLUMNS, csvEsc, download, parseCSV } from "../lib/store";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function apiJson(url) {
  const response = await fetch(API_BASE + url, { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.detail || `Сервер вернул ${response.status}.`);
  return data;
}

const sideTeams = (teams = [], side) =>
  teams
    .filter((x) => String(x.station || "").startsWith(side))
    .map((x) => x.teamNumber)
    .join(" · ");

// Official FIRST Events API views: endpoint plus a flattening of the response into table rows.
const OFFICIAL_VIEWS = {
  rankings: {
    label: "Рейтинг",
    url: (q) => `/api/ftc/rankings?${q}`,
    head: ["#", "Команда", "W-L-T", "Ср. квал", "Матчи"],
    rows: (d) =>
      (d.rankings || []).map((r) => [
        r.rank,
        `${r.teamNumber} ${r.teamName || ""}`,
        `${r.wins ?? 0}-${r.losses ?? 0}-${r.ties ?? 0}`,
        r.qualAverage ?? "—",
        r.matchesPlayed ?? "—",
      ]),
  },
  schedule: {
    label: "Расписание и счёт",
    url: (q, level) => `/api/ftc/schedule/hybrid?${q}&tournament_level=${level}`,
    head: ["Матч", "Время", "Красные", "Синие", "Счёт"],
    rows: (d) =>
      (d.schedule || []).map((m) => [
        m.description || m.matchNumber,
        m.startTime ? new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
        sideTeams(m.teams, "Red"),
        sideTeams(m.teams, "Blue"),
        m.scoreRedFinal != null ? `${m.scoreRedFinal} : ${m.scoreBlueFinal}` : "—",
      ]),
  },
  alliances: {
    label: "Альянсы",
    url: (q) => `/api/ftc/alliances?${q}`,
    head: ["#", "Капитан", "Пик 1", "Пик 2", "Запасной"],
    rows: (d) => (d.alliances || []).map((a) => [a.number, a.captain ?? "—", a.round1 ?? "—", a.round2 ?? "—", a.backup ?? "—"]),
  },
  awards: {
    label: "Награды",
    url: (q) => `/api/ftc/awards?${q}`,
    head: ["Награда", "Место", "Команда", "Человек"],
    rows: (d) => (d.awards || []).map((a) => [a.name, a.series ?? "—", a.teamNumber ?? "—", a.person || "—"]),
  },
};

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
  // FIRST and FTCScout number seasons by the starting year: BIOBUZZ 2026-2027 is "2026".
  const [season, setSeason] = useState(String(db.meta.season || "").match(/\d{4}/)?.[0] || "2026");
  const [code, setCode] = useState(db.meta.demo ? "" : db.meta.eventCode || "");
  const [toaKey, setToaKey] = useState("");
  const [events, setEvents] = useState([]);
  const [out, setOut] = useState("");
  const [official, setOfficial] = useState(null);
  const [officialLevel, setOfficialLevel] = useState("qual");
  const [playedEvents, setPlayedEvents] = useState([]);
  const [scoutEvent, setScoutEvent] = useState(db.official?.code || "");

  async function findPlayedEvents() {
    try {
      const data = await apiJson(`/api/ftcscout/played-events?season=${encodeURIComponent(season)}`);
      setPlayedEvents(data.events || []);
      if (!scoutEvent && data.events?.[0]) setScoutEvent(data.events[0].code);
      toast(`Ивентов с результатами: ${data.count}.`);
    } catch (e) {
      toast(e.message, true);
    }
  }

  // Official rankings + OPR become db.official; own scouting records are kept and take priority in the model.
  async function importScoutEvent() {
    if (!scoutEvent) return;
    try {
      const ev = await apiJson(`/api/ftcscout/event/${encodeURIComponent(scoutEvent)}?season=${encodeURIComponent(season)}`);
      const fresh = db.meta.demo;
      const teams = fresh ? [] : [...db.teams];
      ev.teams.forEach((o) => {
        if (!teams.some((t) => t.number === o.number)) {
          teams.push({ id: o.number, number: o.number, name: o.name, region: ev.location, style: "FTCScout", notes: "" });
        }
      });
      const captain = teams.find((t) => t.number === ev.teams[0]?.number)?.id || teams[0]?.id || "";
      setDb({
        ...db,
        teams,
        records: fresh ? [] : db.records,
        official: ev,
        meta: { ...db.meta, demo: false, eventName: ev.name, eventCode: ev.code, season: `${ev.season}-${ev.season + 1}` },
        draft: fresh || !db.draft?.captain ? { captain, picked: [], removed: [] } : db.draft,
      });
      toast(`${ev.name}: ${ev.teams.length} команд, ${ev.matchCount} матчей.`);
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function loadOfficial(kind) {
    if (!code.trim()) {
      toast("Введите код ивента.", true);
      return;
    }
    const q = `season=${encodeURIComponent(season)}&event_code=${encodeURIComponent(code.trim())}`;
    try {
      const data = await apiJson(OFFICIAL_VIEWS[kind].url(q, officialLevel));
      const rows = OFFICIAL_VIEWS[kind].rows(data);
      setOfficial({ kind, rows });
      if (!rows.length) toast("FIRST вернул пустой список: данных по ивенту ещё нет.");
    } catch (e) {
      toast(e.message, true);
    }
  }
  const [consent, setConsent] = useState(false);

  function exportCsv(records) {
    const txt = [CSV_COLUMNS.join(","), ...records.map((r) => CSV_COLUMNS.map((k) => csvEsc(exportRow(db, r)[k])).join(","))].join("\r\n");
    download("vite-biobuzz-scouting.csv", "\ufeff" + txt, "text/csv;charset=utf-8");
  }

  function importCsv(text) {
    const data = parseCSV(text);
    if (!data.length) throw Error("В CSV нет записей.");
    if (!data[0].teamNumber && !data[0].teamId) throw Error("Нужна колонка teamNumber.");
    const next = { ...db, teams: [...db.teams], records: [...db.records], meta: { ...db.meta, demo: false } };
    data.forEach((x) => {
      const no = String(x.teamNumber || x.teamId || "").trim();
      if (!no) return;
      let t = next.teams.find((t) => t.number === no || t.id === no);
      if (!t) {
        t = { id: no, number: no, name: x.teamName || `Команда ${no}`, region: x.region || "", style: "Импортировано", notes: "" };
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
    toast("CSV импортирован.");
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-[2rem]">Импорт и экспорт</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">FIRST Events API и TOA работают через локальный прокси. Ключи не вводятся в браузер (кроме кода ивента).</p>
      <DemoBanner demo={db.meta.demo} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Panel>
          <h2 className="text-sm font-semibold">CSV скаутинг</h2>
          <p className="mt-2 text-sm text-zinc-400">Шаблон совместим с прежней версией; добавлены цикл и траектория.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportCsv(db.records)}>
              Экспорт наблюдений
            </Button>
            <Button variant="secondary" onClick={() => exportCsv([])}>
              Пустой шаблон
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold">
              Импорт CSV
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
          <h2 className="text-sm font-semibold">JSON резервная копия</h2>
          <p className="mt-2 text-sm text-zinc-400">Команды, драфт и все наблюдения этого устройства.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download("vite-biobuzz-backup.json", JSON.stringify(db, null, 2), "application/json")}>
              Скачать JSON
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold">
              Восстановить
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const next = JSON.parse(await f.text());
                    if (!Array.isArray(next.teams) || !Array.isArray(next.records)) throw Error("Это не резервная копия VITE.");
                    if (!confirm("Заменить текущую базу?")) return;
                    setDb({ ...next, meta: { ...next.meta, demo: false } });
                    toast("Резервная копия восстановлена.");
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
            Credentials задаются только в окружении сервера: FTC_API_USERNAME / FTC_API_TOKEN. Коммерческое использование данных FIRST запрещено их условиями.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Сезон">
              <input className={inputClass()} value={season} onChange={(e) => setSeason(e.target.value)} />
            </Field>
            <Field label="Код ивента">
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
                  toast(`Ивентов: ${(data.events || []).length}`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              Список ивентов
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const s = await apiJson("/api/health");
                  setOut(s.official_api_configured ? `Подключено: ${s.sources.first}` : "Сервер есть, но FIRST credentials не заданы.");
                } catch (e) {
                  setOut(e.message);
                }
              }}
            >
              Проверить
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
                  if (next.meta.demo && confirm("Заменить учебные данные официальным списком команд?")) {
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
                      if (!t) {
                        t = {
                          id: no,
                          number: no,
                          name: x.nameFull || x.nameShort || x.teamName || `Команда ${no}`,
                          region: [x.city, x.stateProv].filter(Boolean).join(", "),
                          style: "FTC Events API",
                          notes: "",
                        };
                        next.teams.push(t);
                      }
                    });
                    next.meta.eventCode = code.toUpperCase();
                    next.meta.season = `${season}-${Number(season) + 1}`;
                    if (!next.draft?.captain && next.teams[0]) next.draft = { ...(next.draft || {}), captain: next.teams[0].id, picked: [], removed: [] };
                    setDb(next);
                  }
                  setOut(`Команд: ${officialTeams.length}. Квалификаций в ответе: ${(matches.matches || []).length}. Официальный счёт не подменяет скаутинг робота.`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              Загрузить команды и матчи
            </Button>
          </div>
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-400">Официальные данные ивента</span>
              <select className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200" value={officialLevel} onChange={(e) => setOfficialLevel(e.target.value)} aria-label="Стадия турнира">
                <option value="qual">Квалификация</option>
                <option value="playoff">Плей-офф</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(OFFICIAL_VIEWS).map(([kind, v]) => (
                <Button key={kind} variant="secondary" className="px-3 py-2 text-xs" onClick={() => loadOfficial(kind)}>
                  {v.label}
                </Button>
              ))}
            </div>
          </div>
          {events.length ? (
            <select
              className={`mt-3 ${inputClass()}`}
              onChange={(e) => setCode(e.target.value)}
              value={code}
            >
              <option value="">Выберите ивент</option>
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
          <p className="mt-2 text-sm text-zinc-400">Ключ TOA_API_KEY задаётся на сервере. Здесь только публичный event key.</p>
          <Field label="TOA event key">
            <input className={inputClass()} value={toaKey} onChange={(e) => setToaKey(e.target.value)} placeholder="например 2526-CMP-DET" />
          </Field>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={async () => {
              try {
                const data = await apiJson(`/api/toa/event/${encodeURIComponent(toaKey)}/matches`);
                setOut(`TOA вернул записей: ${Array.isArray(data) ? data.length : JSON.stringify(data).slice(0, 120)}. Это публичные матчи, не скаутинг.`);
              } catch (e) {
                toast(e.message, true);
              }
            }}
          >
            Загрузить матчи TOA
          </Button>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">FTCScout.org API</h2>
          <p className="mt-2 text-sm text-zinc-400">Публичный API команд, рейтингов и матчей. Аутентификация не требуется.</p>
          <div className="mt-3 rounded-xl border border-honey-400/30 bg-honey-900/20 p-3">
            <div className="text-xs font-medium text-honey-300">Реальный ивент BIOBUZZ · сезон {season}</div>
            <p className="mt-1 text-xs text-zinc-400">Рейтинг, W-L-T и OPR каждой команды. Учебные данные будут заменены, свой скаутинг сохранится.</p>
            {playedEvents.length ? (
              <select className={inputClass("mt-2")} value={scoutEvent} onChange={(e) => setScoutEvent(e.target.value)} aria-label="Ивент FTCScout">
                {playedEvents.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.code} · {e.name} · {e.location?.city || ""} {e.start}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" className="px-3 py-2 text-xs" onClick={findPlayedEvents}>
                Найти ивенты с матчами
              </Button>
              <Button className="px-3 py-2 text-xs" disabled={!scoutEvent} onClick={importScoutEvent}>
                Загрузить ивент
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson("/api/ftcscout/teams");
                  setOut(`Команд: ${data.count}. Это публичный список команд FTCScout.`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              Все команды
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson("/api/ftcscout/events?season=" + encodeURIComponent(season));
                  setOut(`Ивентов в сезоне ${season}: ${data.count}.`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              Ивенты сезона
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const data = await apiJson(`/api/ftcscout/rankings?season=${encodeURIComponent(season)}&take=50`);
                  setOut(`Рейтинг TEP: ${data.count} команд в топ-50.`);
                } catch (e) {
                  toast(e.message, true);
                }
              }}
            >
              Рейтинг TEP
            </Button>
          </div>
        </Panel>
      </div>
      {out ? <p className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3 font-mono text-sm text-zinc-200">{out}</p> : null}
      {official ? (
        <Panel className="mt-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-bold text-zinc-50">
              {OFFICIAL_VIEWS[official.kind].label} · <span className="font-mono text-honey-400">{code.toUpperCase()}</span>
            </h2>
            <span className="text-xs text-zinc-500">FIRST Events API · сезон {season}</span>
          </div>
          {official.rows.length ? (
            <div className="-mx-1 max-h-[480px] overflow-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="sticky top-0 bg-zinc-900 text-xs text-zinc-500">
                  <tr>
                    {OFFICIAL_VIEWS[official.kind].head.map((h) => (
                      <th key={h} className="border-b border-zinc-800 py-2 pr-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {official.rows.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-mono text-zinc-400" : "text-zinc-200"}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Данных пока нет: FIRST публикует их по ходу ивента.</p>
          )}
        </Panel>
      ) : null}
      <Panel className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-50">Настройки турнира</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!consent) return;
            const x = Object.fromEntries(new FormData(e.target).entries());
            setDb({ ...db, meta: { ...db.meta, eventName: x.eventName, eventCode: x.eventCode, season: x.season, demo: false } });
            toast("Настройки сохранены.");
          }}
        >
          <Field label="Название">
            <input className={inputClass()} name="eventName" defaultValue={db.meta.eventName} />
          </Field>
          <Field label="Код">
            <input className={inputClass()} name="eventCode" defaultValue={db.meta.eventCode} />
          </Field>
          <Field label="Сезон">
            <input className={inputClass()} name="season" defaultValue={db.meta.season} />
          </Field>
          <label className="sm:col-span-3 flex gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-honey-400" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Сохраняю только данные турнира, без персональных сведений учеников.
          </label>
          <Button type="submit">Сохранить</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (!confirm("Удалить все локальные команды и записи? Сначала скачайте JSON.")) return;
              setDb({ version: 2, meta: { demo: false, eventName: "", eventCode: "", season: "2026-2027", updatedAt: new Date().toISOString() }, teams: [], records: [], draft: { captain: "", picked: [], removed: [] } });
            }}
          >
            Удалить локальные данные
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
            Восстановить демо
          </Button>
        </div>
      </Panel>
    </div>
  );
}
