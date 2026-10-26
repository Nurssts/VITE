import { setLang, tr } from "./lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import { Button } from "./components/ui";
import Analysis from "./pages/Analysis";
import Data from "./pages/Data";
import Draft from "./pages/Draft";
import Legal from "./pages/Legal";
import Notebook from "./pages/Notebook";
import Overview from "./pages/Overview";
import Scouting from "./pages/Scouting";
import Settings from "./pages/Settings";
import Teams from "./pages/Teams";
import { loadEventTeams, teamsToDb } from "./lib/eventLoader";
import { locText, searchEvents } from "./lib/eventSearch";
import { loadDb, loadPrefs, persistDb, savePrefs } from "./lib/store";
import { t } from "./lib/i18n";

const PAGES = ["overview", "scouting", "teams", "analysis", "draft", "notebook", "data", "legal", "settings"];

/* ─── Language Selection Screen ─── */
function LangSelect({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black px-6">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px"
      }} />

      <div className="relative flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Logo with animation */}
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-[0_0_40px_rgba(255,255,255,0.15)]">
            <span className="text-2xl font-black text-black leading-none">V</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-widest text-white">VITE</div>
            <div className="text-sm text-zinc-500 mt-0.5">BioBuzz Alliance Matrix</div>
          </div>
        </div>

        {/* Language selector cards */}
        <div className="w-full animate-slide-up">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            {tr("Select Language / Выберите язык")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { code: "ru", label: tr("Русский"), sub: "Russian" },
              { code: "en", label: "English", sub: tr("Английский") },
            ].map(({ code, label, sub }) => (
              <button
                key={code}
                type="button"
                onClick={() => onSelect(code)}
                onMouseEnter={() => setHovered(code)}
                onMouseLeave={() => setHovered(null)}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-6 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 ${
                  hovered === code
                    ? "border-white bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                    : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600"
                }`}
                aria-label={`Select ${label}`}
              >
                <span className="text-2xl">{code === "ru" ? "🇷🇺" : "🇬🇧"}</span>
                <span className="text-base font-semibold">{label}</span>
                <span className={`text-xs ${hovered === code ? "text-zinc-500" : "text-zinc-600"}`}>{sub}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-zinc-700 animate-fade-in">
          FTC BioBuzz · Offline-first · No data collection
        </p>
      </div>
    </div>
  );
}

/* ─── Event Selection Screen ─── */
function EventSelect({ onSelect, lang }) {
  const [year, setYear] = useState("2026");
  const [eventCode, setEventCode] = useState("");
  const [eventName, setEventName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const ru = lang === "ru";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const eventsCache = useRef({});
  const [eventsError, setEventsError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!eventCode.trim()) {
      onSelect({ year, eventCode: "", eventName, teams: [] });
      return;
    }
    setSubmitting(true);
    try {
      const { teams } = await loadEventTeams(year, eventCode);
      onSelect({ year, eventCode: eventCode.trim().toUpperCase(), eventName, teams: teamsToDb(teams) });
    } catch (err) {
      setError((ru ? tr("Не удалось загрузить команды события. ") : "Could not load the event's teams. ") + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const skipLoading = () =>
    onSelect({ year, eventCode: eventCode.trim().toUpperCase(), eventName, teams: [] });

  const loadEvents = async (y) => {
    if (eventsCache.current[y]) return eventsCache.current[y];
    setLoading(true);
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const response = await fetch(baseUrl + `/api/ftcscout/events?season=${y}`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      eventsCache.current[y] = data.events || [];
      setEventsError(data.error || (response.ok ? "" : `HTTP ${response.status}`));
    } catch (err) {
      setEventsError(err.message);
      console.error("Search error:", err);
      eventsCache.current[y] = [];
    } finally {
      setLoading(false);
    }
    return eventsCache.current[y];
  };

  const runSearch = async (query, y = year) => {
    const all = await loadEvents(y);
    setSearchResults(searchEvents(all, query));
    setShowResults(true);
  };

  const handleEventSearch = (query) => {
    setSearchQuery(query);
    runSearch(query);
  };

  // season changed: re-run the search for the new season
  useEffect(() => {
    if (showResults) runSearch(searchQuery, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const selectEvent = (event) => {
    setEventCode(event.code || event.eventCode || "");
    setEventName(event.name || event.eventName || "");
    setSearchQuery("");
    setShowResults(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black px-6">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px"
      }} />

      <div className="relative flex flex-col items-center gap-6 w-full max-w-md">
        {/* Logo with animation */}
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white shadow-[0_0_30px_rgba(255,255,255,0.15)]">
            <span className="text-xl font-black text-black leading-none">V</span>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tracking-widest text-white">VITE</div>
            <div className="text-xs text-zinc-500 mt-0.5">BioBuzz Alliance Matrix</div>
          </div>
        </div>

        {/* Event form */}
        <form onSubmit={handleSubmit} className="w-full animate-slide-up">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            Select Tournament Event
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">Season Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 transition-all"
              >
                <option value="2026">2026-2027</option>
                <option value="2027">2027-2028</option>
                <option value="2028">2028-2029</option>
              </select>
            </div>

            {/* Search bar */}
            <div className="relative">
              <label className="mb-2 block text-xs font-medium text-zinc-400">Search Events</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleEventSearch(e.target.value)}
                  onFocus={() => runSearch(searchQuery)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                  placeholder={ru ? tr("Название, код или город (Алматы, Astana…)") : "Name, code or city (Almaty, Astana…)"}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 pl-10 text-sm text-white placeholder-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
                  </div>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showResults && (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-fade-in max-h-72 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-500">
                      {loading
                        ? ru ? tr("Загружаю события…") : "Loading events…"
                        : eventsError
                          ? (ru ? tr("Не удалось загрузить список событий: ") : "Could not load the event list: ") + eventsError
                          : ru ? tr("Ничего не найдено. Можно ввести код события ниже вручную.") : "Nothing found. You can type the event code manually below."}
                    </div>
                  ) : (
                    <>
                      <div className="px-4 pt-3 text-[11px] uppercase tracking-wider text-zinc-600">
                        {!searchQuery ? (ru ? tr("Ближайшие события") : "Upcoming events") : searchResults[0].similar ? (ru ? tr("Похожие варианты") : "Similar results") : ru ? tr("Найдено") : "Matches"}
                      </div>
                      {searchResults.map(({ event }, idx) => {
                        const loc = locText(event.location);
                        const when = [event.start, event.end].filter(Boolean).join(" → ");
                        return (
                          <button
                            key={idx}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectEvent(event)}
                            className="w-full px-4 py-3 text-left text-sm text-white hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                          >
                            <div className="font-medium">{event.name || event.eventName}</div>
                            <div className="text-xs text-zinc-500">
                              {[event.code || event.eventCode, loc, when].filter(Boolean).join(" · ")}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">Event Code (optional)</label>
              <input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="e.g., ALMATY"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 transition-all"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-400">Event Name (optional)</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., Almaty Championship"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 transition-all"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-xs text-red-300">
                {error}
                <button type="button" onClick={skipLoading} className="mt-2 block underline">
                  {ru ? tr("Продолжить с пустой базой (добавлю команды сам)") : "Continue with an empty database (I'll add teams myself)"}
                </button>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (ru ? tr("Загружаю команды…") : "Loading teams…") : ru ? tr("Продолжить") : "Continue"}
            </Button>
          </div>
        </form>

        <p className="text-center text-[11px] text-zinc-700 animate-fade-in">
          You can change this later in Settings
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [prefs, setPrefsState] = useState(loadPrefs);
  const lang = prefs.lang || "en";  // Default to English
  setLang(lang);
  const allowStorage = prefs.cookie.storage;
  const [db, setDbState] = useState(() => loadDb(allowStorage));
  const [page, setPage] = useState("overview");
  const [toast, setToast] = useState(null);
  const [showEventSelect, setShowEventSelect] = useState(false);

  const setPrefs = (next) => {
    setPrefsState(next);
    savePrefs(next);
  };

  const setDb = (next) => {
    setDbState(next);
    persistDb(next, allowStorage);
  };

  useEffect(() => {
    persistDb(db, allowStorage);
  }, [allowStorage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e) {
      if (e.target.closest("input, textarea, select")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) setPage(PAGES[n - 1]);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const notify = (msg, error) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3200);
  };

  const content = useMemo(() => {
    const props = { db, setDb, setPage, toast: notify, prefs, setPrefs, lang };
    switch (page) {
      case "scouting":
        return (
          <Scouting
            db={db}
            setPage={setPage}
            lang={lang}
            onDelete={(id) => {
              if (!confirm(t(lang, "delete_confirm"))) return;
              setDb({ ...db, records: db.records.filter((r) => r.id !== id), meta: { ...db.meta, demo: false } });
              notify(t(lang, "record_deleted"));
            }}
            onSave={(x) => {
              const rec = {
                ...x,
                id: `r-${Date.now()}`,
                eventName: db.meta.eventName || "",
              };
              setDb({ ...db, records: [...db.records, rec], meta: { ...db.meta, demo: false } });
              notify(t(lang, "observation_saved"));
            }}
          />
        );
      case "teams":
        return (
          <Teams
            db={db}
            setPage={setPage}
            lang={lang}
            onAddTeam={(x) => {
              const no = String(x.number || "").trim();
              if (db.teams.some((t2) => t2.number.toLowerCase() === no.toLowerCase())) {
                notify(t(lang, "team_exists"), true);
                return;
              }
              const team = { id: no, number: no, name: String(x.name || "").trim(), region: String(x.region || "").trim(), style: "", notes: "" };
              setDb({ ...db, teams: [...db.teams, team], meta: { ...db.meta, demo: false }, draft: { ...(db.draft || {}), captain: db.draft?.captain || team.id } });
              notify(t(lang, "team_added"));
            }}
          />
        );
      case "analysis":
        return <Analysis db={db} lang={lang} />;
      case "draft":
        return <Draft db={db} setDb={setDb} lang={lang} />;
      case "notebook":
        return <Notebook db={db} lang={lang} />;
      case "data":
        return <Data db={db} setDb={setDb} toast={notify} lang={lang} />;
      case "legal":
        return <Legal lang={lang} />;
      case "settings":
        return <Settings {...props} />;
      default:
        return <Overview db={db} setPage={setPage} lang={lang} />;
    }
  }, [page, db, prefs, allowStorage, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Show language picker if lang not chosen yet ── */
  if (!prefs.lang) {
    return (
      <LangSelect
        onSelect={(code) => {
          setPrefs({ ...prefs, lang: code });
        }}
      />
    );
  }

  /* ── Show event picker if event not set yet ── */
  if (!prefs.event?.set) {
    return (
      <EventSelect
        lang={lang}
        onSelect={({ year, eventCode, eventName, teams }) => {
          setPrefs({ ...prefs, event: { set: true, year, eventCode, eventName } });
          // Demo data is replaced by the real event; user's own data is kept and extended.
          const sameEvent = !db.meta.demo && (db.meta.eventCode || "") === (eventCode || "");
          const withRecords = new Set(db.records.map((r) => String(r.teamId)));
          const base = db.meta.demo
            ? { teams: [], records: [] }
            : sameEvent
              ? { teams: db.teams, records: db.records }
              : // other event: keep only teams that already have scouting records, drop the rest
                { teams: db.teams.filter((t) => withRecords.has(String(t.id))), records: db.records };
          const have = new Set(base.teams.map((t) => String(t.number)));
          const merged = [...base.teams, ...teams.filter((t) => !have.has(String(t.number)))];
          setDb({
            ...db,
            teams: merged,
            records: base.records,
            meta: { ...db.meta, demo: false, eventCode, eventName, season: `${year}-${Number(year) + 1}` },
            draft: { captain: merged[0]?.id || "", picked: [], removed: [] },
          });
        }}
      />
    );
  }

  return (
    <>
      <Layout page={page} setPage={setPage} eventLabel={db.meta.eventName || t(lang, "event_not_set")} onScout={() => setPage("scouting")} lang={lang}>
        {content}
      </Layout>

      {/* Cookie banner */}
      {!prefs.cookie.decided ? (
        <section
          className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-lg"
          aria-label={t(lang, "cookie_title")}
        >
          <h2 className="text-sm font-semibold text-white">{t(lang, "cookie_title")}</h2>
          <p className="mt-2 text-sm text-zinc-400">{t(lang, "cookie_body")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: false, shownAt: new Date().toISOString() } })}>
              {t(lang, "cookie_essential")}
            </Button>
            <Button onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: true, shownAt: new Date().toISOString() } })}>{t(lang, "cookie_allow")}</Button>
            <Button variant="ghost" onClick={() => setPage("legal")}>
              {t(lang, "cookie_more")}
            </Button>
          </div>
        </section>
      ) : null}

      {/* Age gate */}
      {!prefs.age.confirmed ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
          <form
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const over13 = fd.get("over13") === "on";
              const guardian = fd.get("guardian") === "on";
              if (!over13 && !guardian) {
                notify(t(lang, "age_error"), true);
                return;
              }
              setPrefs({ ...prefs, age: { confirmed: true, over13, guardian } });
            }}
          >
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-white">
              <span className="text-base font-black text-black">V</span>
            </div>
            <h2 id="age-title" className="text-lg font-semibold text-white">
              {t(lang, "age_title")}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{t(lang, "age_body")}</p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex items-start gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                <input type="checkbox" name="over13" className="mt-0.5 h-4 w-4 accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" />
                {t(lang, "age_over13")}
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                <input type="checkbox" name="guardian" className="mt-0.5 h-4 w-4 accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" />
                {t(lang, "age_guardian")}
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="submit">{t(lang, "age_continue")}</Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div
          className={`fixed right-4 top-20 z-50 rounded-xl px-4 py-3 text-sm shadow-lg transition-all ${
            toast.error ? "bg-white text-black" : "border border-zinc-800 bg-zinc-950 text-white"
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}
    </>
  );
}
