import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button, Field, inputClass } from "../components/ui";
import { api } from "../lib/api";
import { loadEventTeams, teamsToDb } from "../lib/eventLoader";
import { locText, searchEvents } from "../lib/eventSearch";
import { tr } from "../lib/i18n";

function Shell({ children, wide }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black">
      <div className="pointer-events-none absolute inset-0 hive-grid opacity-60" aria-hidden="true" />
      <div className={`relative mx-auto flex min-h-full w-full flex-col justify-center gap-8 px-5 py-10 ${wide ? "max-w-lg" : "max-w-sm"}`}>
        <div className="flex items-center gap-3">
          <Logo size="lg" />
          <div>
            <div className="text-lg font-bold tracking-[0.2em] text-white">VITE</div>
            <div className="text-xs text-zinc-500">BioBuzz Alliance Matrix</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Logo({ size = "md" }) {
  const s = size === "lg" ? "h-12 w-12 text-xl rounded-xl" : "h-9 w-9 text-sm rounded-lg";
  return (
    <span className={`grid shrink-0 place-items-center bg-white font-black leading-none text-black ${s}`} aria-hidden="true">
      V
    </span>
  );
}

export function LangSelect({ onSelect, last }) {
  return (
    <Shell>
      <div>
        <h1 className="text-2xl font-semibold text-white">Выберите язык · Choose language</h1>
        <p className="mt-2 text-sm text-zinc-500">Можно сменить в настройках · You can change it in Settings</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { code: "ru", label: "Русский", sub: "Russian" },
          { code: "en", label: "English", sub: "Английский" },
        ].map(({ code, label, sub }) => (
          <button
            key={code}
            type="button"
            onClick={() => onSelect(code)}
            autoFocus={code === (last || "ru")}
            className={`flex flex-col items-start gap-1 rounded-xl border p-5 text-left transition-colors hover:border-white hover:bg-white hover:text-black focus-visible:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${last === code ? "border-zinc-500 text-white" : "border-zinc-800 text-white"}`}
          >
            <span className="text-lg font-semibold">{label}</span>
            <span className="text-xs opacity-60">{sub}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-600">FTC BIOBUZZ 2026–2027 · offline-first · no trackers</p>
    </Shell>
  );
}

const SEASONS = [
  { value: "2026", label: "2026–2027 · BIOBUZZ" },
  { value: "2027", label: "2027–2028" },
];

export function EventSelect({ onSelect, onCancel, onDemo, last }) {
  const [season, setSeason] = useState(last?.year || "2026");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [failedCode, setFailedCode] = useState("");
  const cache = useRef({});
  const listId = "event-results";

  useEffect(() => {
    let alive = true;
    setEvents(cache.current[season] || null);
    if (cache.current[season]) return undefined;
    setLoadingEvents(true);
    setEventsError("");
    api
      .events(season)
      .then((d) => {
        if (!alive) return;
        if (d.error) throw new Error(d.error);
        cache.current[season] = d.events || [];
        setEvents(cache.current[season]);
      })
      .catch((e) => alive && setEventsError(e.message))
      .finally(() => alive && setLoadingEvents(false));
    return () => {
      alive = false;
    };
  }, [season]);

  const results = useMemo(() => (events ? searchEvents(events, query, 8) : []), [events, query]);
  useEffect(() => setActive(0), [query, season]);

  async function choose(code, name) {
    const c = String(code || "").trim().toUpperCase();
    if (!c) return;
    setBusy(c);
    setError("");
    setOpen(false);
    try {
      const { teams, source, name: scoutName } = await loadEventTeams(season, c);
      onSelect({ year: season, eventCode: c, eventName: name || scoutName || c, teams: teamsToDb(teams, source === "FIRST" ? "FTC Events API" : "FTCScout") });
    } catch (err) {
      setError(`${tr("Не удалось загрузить команды события")} ${c}: ${err.message}`);
      setFailedCode(c);
      setBusy("");
    }
  }

  function onKey(e) {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const ev = results[active]?.event;
      if (ev) choose(ev.code, ev.name);
    } else if (e.key === "Escape") setOpen(false);
  }

  const failedText = eventsError ? `${tr("Не удалось загрузить список событий")}: ${eventsError}. ${/fetch|timeout|HTTP 5|network/i.test(eventsError) ? tr("Сервер мог «уснуть» — подождите минуту и повторите.") : ""}` : "";

  return (
    <Shell wide>
      <div>
        <h1 className="text-2xl font-semibold text-white">{tr("Выберите турнир")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{tr("VITE загрузит список команд события. Скаутинг потом работает без интернета.")}</p>
      </div>

      {last?.eventCode && !busy ? (
        <button
          type="button"
          onClick={() => choose(last.eventCode, last.eventName)}
          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-left transition-colors hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="min-w-0">
            <span className="block text-xs text-zinc-500">{tr("Продолжить с прошлым турниром")}</span>
            <span className="block truncate text-sm font-medium text-white">
              {last.eventName || last.eventCode} <span className="text-zinc-500">({last.eventCode})</span>
            </span>
          </span>
          <span className="text-sm text-zinc-400">{tr("Открыть")}</span>
        </button>
      ) : null}

      <div className="flex flex-col gap-4">
        <Field label={tr("Сезон")}>
          <select className={inputClass()} value={season} onChange={(e) => setSeason(e.target.value)}>
            {SEASONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="relative">
          <label htmlFor="event-search" className="mb-1.5 block text-xs font-medium text-zinc-300">
            {tr("Поиск события")}
          </label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input
              id="event-search"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={open && results[active] ? `ev-${active}` : undefined}
              autoComplete="off"
              className={inputClass("h-11 pl-9 pr-9")}
              placeholder={tr("Название, код или город (Алматы, Astana…)")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={onKey}
            />
            {loadingEvents ? <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500" aria-hidden="true" /> : null}
          </div>
          {open ? (
            <div id={listId} role="listbox" className="absolute z-10 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              {loadingEvents && !events ? (
                <p className="px-4 py-3 text-sm text-zinc-500">{tr("Загружаю события…")}</p>
              ) : failedText ? (
                <p className="px-4 py-3 text-sm text-zinc-400">{failedText}</p>
              ) : !results.length ? (
                <p className="px-4 py-3 text-sm text-zinc-500">{tr("Ничего не найдено. Можно ввести код события ниже вручную.")}</p>
              ) : (
                <>
                  <p className="px-4 pb-1 pt-3 text-xs text-zinc-500">{!query ? tr("Ближайшие события") : results[0].similar ? tr("Похожие варианты") : tr("Найдено")}</p>
                  {results.map(({ event }, idx) => (
                    <button
                      key={event.code}
                      id={`ev-${idx}`}
                      role="option"
                      aria-selected={idx === active}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(event.code, event.name)}
                      className={`block w-full border-t border-zinc-900 px-4 py-3 text-left text-sm first:border-0 ${idx === active ? "bg-zinc-900" : ""}`}
                    >
                      <span className="block font-medium text-white">{event.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-300">{event.code}</span>
                        {locText(event.location) ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} aria-hidden="true" />
                            {locText(event.location)}
                          </span>
                        ) : null}
                        {event.start ? <span className="num">{[event.start, event.end !== event.start ? event.end : ""].filter(Boolean).join(" – ")}</span> : null}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : null}
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            choose(manualCode);
          }}
        >
          <Field label={tr("Или код события")} className="flex-1">
            <input className={inputClass("uppercase")} value={manualCode} onChange={(e) => setManualCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} placeholder="KZALQ1" maxLength={20} />
          </Field>
          <Button type="submit" disabled={!manualCode || Boolean(busy)}>
            {tr("Загрузить")}
          </Button>
        </form>

        {busy ? (
          <p className="flex items-center gap-2 text-sm text-zinc-300" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {tr("Загружаю команды")} {busy}…
          </p>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-zinc-600 bg-zinc-950 p-4 text-sm text-zinc-200" role="alert">
            <p>{error}</p>
            <p className="mt-1 text-zinc-500">{tr("Можно продолжить без списка и добавить команды вручную.")}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => onSelect({ year: season, eventCode: failedCode, eventName: "", teams: [] })}>
              {tr("Продолжить без списка команд")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-5">
        <button type="button" onClick={onDemo} className="text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline">
          {tr("Посмотреть на демо-данных")}
        </button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {tr("Отмена")}
          </Button>
        ) : null}
      </div>
    </Shell>
  );
}
