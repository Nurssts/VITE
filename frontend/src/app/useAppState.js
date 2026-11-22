// App-wide state: preferences, the scouting database and its persistence.
// setDb accepts a value or an updater function (always applied to the latest state),
// so quick consecutive saves can never overwrite each other.
import { useCallback, useEffect, useRef, useState } from "react";
import { setLang } from "../lib/i18n";
import { loadDb, loadPrefs, persistDb, readBackup, requestPersistence, savePrefs } from "../lib/store";
import { confirmDialog, toast } from "../components/feedback";
import { tr } from "../lib/i18n";

export function useAppState() {
  const [prefs, setPrefsState] = useState(loadPrefs);
  const lang = prefs.lang || prefs.lastLang || "en";
  setLang(lang);
  const allowStorage = Boolean(prefs.cookie.storage);
  const [initial] = useState(() => loadDb(allowStorage));
  const [db, setDbState] = useState(initial.db);
  const [saveState, setSaveState] = useState({ ok: true, savedAt: initial.db.meta?.updatedAt });
  const first = useRef(true);

  const setPrefs = useCallback((next) => {
    setPrefsState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const remembered = savePrefs(value);
      return { ...value, lastLang: remembered.lastLang, lastEvent: remembered.lastEvent };
    });
  }, []);

  const setDb = useCallback((next) => setDbState((prev) => (typeof next === "function" ? next(prev) : next)), []);

  // Persist after every change and when storage gets allowed. The first run is skipped: the
  // loaded data is already stored, and a fresh demo seed must not overwrite the IndexedDB
  // copy before recovery below has had a chance to read it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const r = persistDb(db, allowStorage);
    setSaveState(r);
    if (!r.ok) toast(r.error === "quota" ? tr("Память браузера заполнена: данные НЕ сохранены. Скачайте JSON-копию в разделе «Данные».") : tr("Браузер запретил сохранение. Скачайте JSON-копию."), { error: true, duration: 9000 });
  }, [db, allowStorage]);

  // Data safety: ask the browser not to evict storage, and offer recovery from the IndexedDB copy.
  useEffect(() => {
    if (!allowStorage) return;
    requestPersistence();
    if (initial.source === "local") return;
    readBackup().then(async (backup) => {
      if (!backup?.records?.length) return;
      const ok = await confirmDialog({
        title: tr("Найдена резервная копия"),
        body: `${tr("В резервном хранилище браузера есть данные скаутинга")}: ${backup.records.length} ${tr("записей")}, ${backup.teams.length} ${tr("команд")}. ${tr("Восстановить их?")}`,
        confirmLabel: tr("Восстановить"),
      });
      if (ok) {
        setDbState(backup);
        toast(tr("Данные восстановлены из резервной копии."));
      }
    });
  }, [allowStorage, initial.source]);

  return { prefs, setPrefs, lang, db, setDb, allowStorage, saveState };
}
