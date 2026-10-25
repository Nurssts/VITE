import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import { BrandMark, Button } from "./components/ui";
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
  return (
    <div className="comb-bg fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink px-6">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <BrandMark size={64} />
          <div className="text-center">
            <div className="font-display text-3xl font-extrabold tracking-[0.2em] text-zinc-50">VITE</div>
            <div className="mt-1 text-sm text-zinc-400">BioBuzz Alliance Matrix</div>
          </div>
        </div>

        <div className="w-full">
          <p className="mb-4 text-center text-sm text-zinc-400">Выберите язык · Select language</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { code: "ru", label: "Русский" },
              { code: "en", label: "English" },
            ].map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => onSelect(code)}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-6 text-zinc-50 transition-colors hover:border-honey-400 hover:bg-honey-900/40"
              >
                <span className="font-mono text-2xl font-bold text-zinc-400 transition-colors group-hover:text-honey-400">{code.toUpperCase()}</span>
                <span className="text-base font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center font-mono text-[11px] text-zinc-500">
          FTC BioBuzz · offline-first · no tracking
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
          className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-lg"
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
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
            <div className="mb-4">
              <BrandMark size={40} />
            </div>
            <h2 id="age-title" className="font-display text-lg font-bold text-zinc-50">
              {t(lang, "age_title")}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{t(lang, "age_body")}</p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex items-start gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                <input type="checkbox" name="over13" className="mt-0.5 h-4 w-4 accent-honey-400" />
                {t(lang, "age_over13")}
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                <input type="checkbox" name="guardian" className="mt-0.5 h-4 w-4 accent-honey-400" />
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
            toast.error ? "border border-sting/60 bg-zinc-900 text-sting" : "border border-zinc-700 bg-zinc-900 text-zinc-50"
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}
    </>
  );
}
