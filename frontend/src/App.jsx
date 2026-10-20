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

const PAGES = ["overview", "scouting", "teams", "analysis", "draft", "notebook", "data", "legal", "settings"];

export default function App() {
  const [prefs, setPrefsState] = useState(loadPrefs);
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
    const props = { db, setDb, setPage, toast: notify, prefs, setPrefs };
    switch (page) {
      case "scouting":
        return (
          <Scouting
            db={db}
            setPage={setPage}
            onDelete={(id) => {
              if (!confirm("Удалить запись?")) return;
              setDb({ ...db, records: db.records.filter((r) => r.id !== id), meta: { ...db.meta, demo: false } });
              notify("Запись удалена.");
            }}
            onSave={(x) => {
              const rec = {
                ...x,
                id: `r-${Date.now()}`,
                eventName: db.meta.eventName || "",
              };
              setDb({ ...db, records: [...db.records, rec], meta: { ...db.meta, demo: false } });
              notify("Наблюдение сохранено локально.");
            }}
          />
        );
      case "teams":
        return (
          <Teams
            db={db}
            setPage={setPage}
            onAddTeam={(x) => {
              const no = String(x.number || "").trim();
              if (db.teams.some((t) => t.number.toLowerCase() === no.toLowerCase())) {
                notify("Такая команда уже есть.", true);
                return;
              }
              const t = { id: no, number: no, name: String(x.name || "").trim(), region: String(x.region || "").trim(), style: "", notes: "" };
              setDb({ ...db, teams: [...db.teams, t], meta: { ...db.meta, demo: false }, draft: { ...(db.draft || {}), captain: db.draft?.captain || t.id } });
              notify("Команда добавлена.");
            }}
          />
        );
      case "analysis":
        return <Analysis db={db} />;
      case "draft":
        return <Draft db={db} setDb={setDb} />;
      case "notebook":
        return <Notebook db={db} />;
      case "data":
        return <Data db={db} setDb={setDb} toast={notify} />;
      case "legal":
        return <Legal />;
      case "settings":
        return <Settings {...props} />;
      default:
        return <Overview db={db} setPage={setPage} />;
    }
  }, [page, db, prefs, allowStorage]);

  return (
    <>
      <Layout page={page} setPage={setPage} eventLabel={db.meta.eventName || "Ивент не указан"} onScout={() => setPage("scouting")}>
        {content}
      </Layout>

      {!prefs.cookie.decided ? (
        <section className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-lg" aria-label="Согласие на локальное хранение">
          <h2 className="text-sm font-semibold">Никакой рекламы. Никаких трекеров.</h2>
          <p className="mt-2 text-sm text-zinc-400">Разрешить сохранение скаутинга на этом устройстве? Отказ равнозначен по размеру кнопки: интерфейс останется, данные сессии не запишутся на диск.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: false, shownAt: new Date().toISOString() } })}>
              Только необходимое
            </Button>
            <Button onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: true, shownAt: new Date().toISOString() } })}>Разрешить хранение</Button>
            <Button variant="ghost" onClick={() => setPage("legal")}>
              Подробнее
            </Button>
          </div>
        </section>
      ) : null}

      {!prefs.age.confirmed ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="age-title">
          <form
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const over13 = fd.get("over13") === "on";
              const guardian = fd.get("guardian") === "on";
              if (!over13 && !guardian) {
                notify("Нужно одно из согласий.", true);
                return;
              }
              setPrefs({ ...prefs, age: { confirmed: true, over13, guardian } });
            }}
          >
            <h2 id="age-title" className="text-lg font-semibold">
              Подтверждение возраста
            </h2>
            <p className="mt-2 text-sm text-zinc-400">Инструмент для команд FTC. Не собираем email. Данные скаутинга остаются на устройстве.</p>
            <label className="mt-4 flex gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="over13" className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" /> Мне есть 13 лет.
            </label>
            <label className="mt-2 flex gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="guardian" className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" /> Я наставник/родитель и даю согласие на использование на этом устройстве.
            </label>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Продолжить</Button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed right-4 top-16 z-50 rounded-xl px-4 py-3 text-sm ${toast.error ? "bg-white text-black" : "border border-zinc-700 bg-zinc-950"}`} role="status">
          {toast.msg}
        </div>
      ) : null}
    </>
  );
}
