import { useEffect, useMemo, useState } from "react";
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
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-[0_0_40px_rgba(255,255,255,0.15)]">
            <span className="text-2xl font-black text-black leading-none">V</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-widest text-white">VITE</div>
            <div className="text-sm text-zinc-500 mt-0.5">BioBuzz Alliance Matrix</div>
          </div>
        </div>

        {/* Language selector cards */}
        <div className="w-full">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">
            Select Language / Выберите язык
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { code: "ru", label: "Русский", sub: "Russian" },
              { code: "en", label: "English", sub: "Английский" },
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

        <p className="text-center text-[11px] text-zinc-700">
          FTC BioBuzz · Offline-first · No data collection
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [prefs, setPrefsState] = useState(loadPrefs);
  const lang = prefs.lang || "ru";
  const allowStorage = prefs.cookie.storage;
  const [db, setDbState] = useState(() => loadDb(allowStorage));
  const [page, setPage] = useState("overview");
  const [toast, setToast] = useState(null);

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
        onSelect={(code) => setPrefs({ ...prefs, lang: code })}
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
