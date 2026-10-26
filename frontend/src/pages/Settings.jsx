import { tr } from "../lib/i18n";
import { Button, Field, inputClass, Panel } from "../components/ui";
import { wipeAll } from "../lib/store";

export default function Settings({ prefs, setPrefs, toast, setDb, lang = "ru" }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white">{tr("Настройки и данные")}</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">{tr("Возраст, хранение, право быть забытым. Никаких тёмных паттернов: отказ и удаление не спрятаны.")}</p>

      {/* Language Switch */}
      <Panel className="mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">{tr("Язык / Language")}</h2>
        <div className="flex gap-2">
          <Button variant={prefs.lang === "ru" ? "primary" : "secondary"} onClick={() => setPrefs({ ...prefs, lang: "ru" })}>
            {tr("🇷🇺 Русский")}
          </Button>
          <Button variant={prefs.lang === "en" ? "primary" : "secondary"} onClick={() => setPrefs({ ...prefs, lang: "en" })}>
            🇬🇧 English
          </Button>
        </div>
      </Panel>

      {/* Event Settings */}
      <Panel className="mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">{tr("Турнирный ивент")}</h2>
        <p className="text-sm text-zinc-400">{tr("Текущий")}: {prefs.event?.eventName || tr("Не выбран")} ({prefs.event?.eventCode || tr("Нет кода")}) - {tr("Сезон")} {prefs.event?.year || "2026"}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setPrefs({ ...prefs, event: { set: false, year: "", eventCode: "", eventName: "" } });
            toast(tr("Экран выбора ивента появится при следующей перезагрузке."));
          }}
        >
          {tr("Изменить ивент")}
        </Button>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="text-sm font-semibold">{tr("Возраст участника")}</h2>
        <p className="text-sm text-zinc-400">{tr("FTC — молодёжная программа. Локальный профиль не требует email. Подтвердите возраст или согласие наставника.")}</p>
        <Field label={tr("Отображаемое имя (необязательно, без фамилии)")}>
          <input className={inputClass()} value={prefs.displayName} onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })} />
        </Field>
        <label className="flex gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" checked={prefs.age.over13} onChange={(e) => setPrefs({ ...prefs, age: { ...prefs.age, over13: e.target.checked } })} />
          {tr("Мне есть 13 лет.")}
        </label>
        <label className="flex gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            checked={prefs.age.guardian}
            onChange={(e) => setPrefs({ ...prefs, age: { ...prefs.age, guardian: e.target.checked } })}
          />
          {tr("Я наставник/родитель и разрешаю использование на этом устройстве.")}
        </label>
        <Button
          onClick={() => {
            if (!prefs.age.over13 && !prefs.age.guardian) {
              toast(tr("Нужно подтверждение возраста или согласие наставника."), true);
              return;
            }
            setPrefs({ ...prefs, age: { ...prefs.age, confirmed: true, over13: prefs.age.over13, guardian: prefs.age.guardian } });
            toast(tr("Возрастное согласие сохранено локально."));
          }}
        >
          {tr("Сохранить согласие")}
        </Button>
      </Panel>
      <Panel className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">{tr("Хранение")}</h2>
        <p className="text-sm text-zinc-400">{tr("Сейчас")}: {prefs.cookie.storage ? tr("локальное хранение разрешено") : tr("только сессия / демо в памяти")}.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: false, shownAt: new Date().toISOString() } })}>
            {tr("Только необходимое")}
          </Button>
          <Button onClick={() => setPrefs({ ...prefs, cookie: { decided: true, storage: true, shownAt: new Date().toISOString() } })}>{tr("Разрешить хранение")}</Button>
        </div>
      </Panel>
      <Panel className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">{tr("Право на удаление")}</h2>
        <p className="text-sm text-zinc-400">{tr("Удаляет скаутинг, демо, настройки возраста и IndexedDB на этом устройстве. Облачной копии нет — восстановление невозможно.")}</p>
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm(tr("Полностью удалить профиль и скаутские данные с этого устройства?"))) return;
            wipeAll();
            setDb({ version: 2, meta: { demo: false, eventName: "", eventCode: "", season: "2026-2027", updatedAt: new Date().toISOString() }, teams: [], records: [], draft: { captain: "", picked: [], removed: [] } });
            setPrefs({ cookie: { decided: true, storage: false, shownAt: new Date().toISOString() }, age: { confirmed: false, over13: false, guardian: false }, displayName: "", lang: "ru", event: { set: false, year: "", eventCode: "", eventName: "" } });
            toast(tr("Данные удалены."));
          }}
        >
          {tr("Удалить профиль и все скаутские данные")}
        </Button>
      </Panel>
      <Panel className="mt-4 text-sm text-zinc-400">
        {tr("Горячие клавиши:")} <kbd className="rounded border border-zinc-700 px-1">1</kbd>–<kbd className="rounded border border-zinc-700 px-1">9</kbd> переключают разделы,{" "}
        <kbd className="rounded border border-zinc-700 px-1">Esc</kbd> {tr("закрывает окна.")}
      </Panel>
    </div>
  );
}
