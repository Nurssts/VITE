import { useEffect, useState } from "react";
import { Button, Field, inputClass, PageHeader, Panel, Segmented } from "../components/ui";
import { confirmDialog, toast } from "../components/feedback";
import { requestPersistence, storageEstimate, wipeAll } from "../lib/store";
import { tr } from "../lib/i18n";

function bytes(n) {
  if (!n) return "0";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export default function Settings({ prefs, setPrefs, db, saveState, allowStorage, go }) {
  const [est, setEst] = useState(null);
  const [name, setName] = useState(prefs.displayName || "");
  useEffect(() => {
    storageEstimate().then(setEst);
  }, [saveState]);

  const kbd = "rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-200";

  return (
    <div>
      <PageHeader title={tr("Настройки и данные")} subtitle={tr("Возраст, хранение, право быть забытым. Никаких тёмных паттернов: отказ и удаление не спрятаны.")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={tr("Язык / Language")}>
          <Segmented
            label={tr("Язык / Language")}
            value={prefs.lang}
            onChange={(lang) => setPrefs((p) => ({ ...p, lang }))}
            options={[
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ]}
          />
        </Panel>

        <Panel title={tr("Турнир и команда")}>
          <p className="text-sm text-zinc-400">
            {db.meta.eventName || tr("Не выбран")} {db.meta.eventCode ? `(${db.meta.eventCode})` : ""} · {db.meta.season}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={tr("Моя команда")} hint={tr("Подсвечивается в расписании матчей.")}>
              <select className={inputClass()} value={prefs.myTeam || ""} onChange={(e) => setPrefs((p) => ({ ...p, myTeam: e.target.value }))}>
                <option value="">—</option>
                {db.teams.map((t) => (
                  <option key={t.id} value={t.number}>
                    {t.number} {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="secondary" onClick={() => setPrefs((p) => ({ ...p, event: { ...p.event, set: false, changing: true } }))}>
              {tr("Сменить ивент")}
            </Button>
          </div>
        </Panel>

        <Panel title={tr("Хранение на устройстве")} subtitle={tr("Данные живут только в этом браузере. Облачной копии нет.")}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">{tr("Режим")}</dt>
              <dd className="text-zinc-100">{allowStorage ? tr("сохранение разрешено") : tr("только эта вкладка")}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">{tr("Последнее сохранение")}</dt>
              <dd className="num text-zinc-100">{saveState.ok ? (saveState.savedAt ? new Date(saveState.savedAt).toLocaleTimeString() : "—") : tr("ошибка")}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">{tr("Занято")}</dt>
              <dd className="num text-zinc-100">{est ? `${bytes(est.usage)} / ${bytes(est.quota)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">{tr("Защита от очистки")}</dt>
              <dd className="text-zinc-100">{est?.persisted ? tr("включена") : tr("не включена")}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {allowStorage ? (
              <Button variant="secondary" onClick={() => setPrefs((p) => ({ ...p, cookie: { decided: true, storage: false, shownAt: new Date().toISOString() } }))}>
                {tr("Только необходимое")}
              </Button>
            ) : (
              <Button onClick={() => setPrefs((p) => ({ ...p, cookie: { decided: true, storage: true, shownAt: new Date().toISOString() } }))}>{tr("Разрешить хранение")}</Button>
            )}
            {allowStorage && !est?.persisted ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  const ok = await requestPersistence();
                  toast(ok ? tr("Браузер не будет очищать данные VITE.") : tr("Браузер отклонил запрос. Делайте JSON-копии."), { error: !ok });
                  setEst(await storageEstimate());
                }}
              >
                {tr("Защитить от очистки")}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => go("data")}>
              {tr("Резервная копия")}
            </Button>
          </div>
        </Panel>

        <Panel title={tr("Возраст участника")} subtitle={tr("FTC — молодёжная программа. Локальный профиль не требует email. Подтвердите возраст или согласие наставника.")}>
          <Field label={tr("Отображаемое имя (необязательно, без фамилии)")}>
            <input className={inputClass()} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => setPrefs((p) => ({ ...p, displayName: name.trim() }))} />
          </Field>
          <div className="mt-3 space-y-2 text-sm text-zinc-300">
            <label className="flex cursor-pointer gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-white" checked={prefs.age.over13} onChange={(e) => setPrefs((p) => ({ ...p, age: { ...p.age, over13: e.target.checked, confirmed: e.target.checked || p.age.guardian } }))} />
              {tr("Мне есть 13 лет.")}
            </label>
            <label className="flex cursor-pointer gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-white" checked={prefs.age.guardian} onChange={(e) => setPrefs((p) => ({ ...p, age: { ...p.age, guardian: e.target.checked, confirmed: e.target.checked || p.age.over13 } }))} />
              {tr("Я наставник/родитель и разрешаю использование на этом устройстве.")}
            </label>
          </div>
        </Panel>

        <Panel title={tr("Горячие клавиши")}>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>
              <kbd className={kbd}>1</kbd>–<kbd className={kbd}>9</kbd> {tr("переключают разделы")}
            </li>
            <li>
              <kbd className={kbd}>Esc</kbd> {tr("закрывает окна.")}
            </li>
            <li>
              <kbd className={kbd}>↑</kbd> <kbd className={kbd}>↓</kbd> <kbd className={kbd}>Enter</kbd> {tr("выбор в поиске событий")}
            </li>
          </ul>
        </Panel>

        <Panel title={tr("Право на удаление")} subtitle={tr("Удаляет скаутинг, демо, настройки возраста и IndexedDB на этом устройстве. Облачной копии нет — восстановление невозможно.")}>
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: tr("Полностью удалить профиль и скаутские данные с этого устройства?"),
                body: `${db.records.length} ${tr("записей")}, ${db.teams.length} ${tr("команд")}. ${tr("Отменить нельзя.")}`,
                confirmLabel: tr("Удалить всё"),
                danger: true,
                typeToConfirm: tr("УДАЛИТЬ"),
              });
              if (!ok) return;
              wipeAll();
              location.hash = "";
              location.reload();
            }}
          >
            {tr("Удалить профиль и все скаутские данные")}
          </Button>
        </Panel>
      </div>
    </div>
  );
}
