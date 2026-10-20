import { useState } from "react";
import { Button, Check, DemoBanner, Field, inputClass, Panel } from "../components/ui";
import { breakdown, fmt, MODEL_VERSION, teamLabel } from "../lib/model";

const empty = {
  teamId: "",
  matchNo: "",
  eventCode: "",
  date: new Date().toISOString().slice(0, 10),
  autoHiveTips: 0,
  cellItems: 0,
  teleopHiveTips: 0,
  flowerPlaced: 0,
  ownedFlowerItems: 0,
  bottomNectar: 0,
  gardenItems: 0,
  penalties: 0,
  confidence: "medium",
  scout: "",
  notes: "",
  autoTrajectory: "unknown",
  pollenCycleSec: "",
  nectarCycleSec: "",
  hiveSuccess: "",
  flowerAccuracy: "",
};

export default function Scouting({ db, onSave, onDelete, setPage }) {
  const [form, setForm] = useState({ ...empty, teamId: db.teams[0]?.id || "", eventCode: db.meta.eventCode || "" });
  const [consent, setConsent] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const recent = [...db.records]
    .filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.matchNo - a.matchNo)
    .slice(0, 12);

  function submit(e) {
    e.preventDefault();
    if (!consent) return;
    const fd = new FormData(e.target);
    onSave({
      ...form,
      autoLeave: fd.get("autoLeave") === "on",
      autoPark: fd.get("autoPark") === "on",
      teleopPark: fd.get("teleopPark") === "on",
      disabled: fd.get("disabled") === "on",
    });
    setConsent(false);
    e.target.reset();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Скаутинг матча</h1>
          <p className="mt-1 text-sm text-zinc-500">Одна запись — один робот. Не дублируйте очки альянса в обеих командах.</p>
        </div>
        <Button variant="secondary" onClick={() => setPage("data")}>
          Импорт CSV
        </Button>
      </div>
      <DemoBanner demo={db.meta.demo} />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <h2 className="text-sm font-semibold">Новое наблюдение</h2>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submit}>
            <Field label="Команда *">
              <select className={inputClass()} required value={form.teamId} onChange={(e) => set("teamId", e.target.value)}>
                {db.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Номер матча">
              <input className={inputClass()} type="number" min="1" value={form.matchNo} onChange={(e) => set("matchNo", e.target.value)} />
            </Field>
            <Field label="Код ивента">
              <input className={inputClass()} value={form.eventCode} onChange={(e) => set("eventCode", e.target.value)} />
            </Field>
            <Field label="Дата">
              <input className={inputClass()} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <div className="sm:col-span-2 text-[10px] uppercase tracking-wider text-zinc-500">Автономный период</div>
            <Field label="HIVE TIP в Auto">
              <input className={inputClass()} type="number" min="0" max="10" value={form.autoHiveTips} onChange={(e) => set("autoHiveTips", e.target.value)} />
            </Field>
            <Field label="Траектория автонома" hint="Нужна для Autonomous Collision Check.">
              <select className={inputClass()} value={form.autoTrajectory} onChange={(e) => set("autoTrajectory", e.target.value)}>
                <option value="unknown">Неизвестно</option>
                <option value="left">Левая зона / left Hive</option>
                <option value="center">Центр</option>
                <option value="right">Правая зона / right Hive</option>
                <option value="wall">У стены / park only</option>
              </select>
            </Field>
            <Field label="Элементы в CELL" hint="2 очка за элемент альянсу — не дублируйте у партнёра.">
              <input className={inputClass()} type="number" min="0" value={form.cellItems} onChange={(e) => set("cellItems", e.target.value)} />
            </Field>
            <Check name="autoLeave">Робот покинул стену · 3 очка</Check>
            <Check name="autoPark">Парковка Auto · 5 очков</Check>
            <div className="sm:col-span-2 text-[10px] uppercase tracking-wider text-zinc-500">TeleOp и финал</div>
            <Field label="HIVE TIP TeleOp">
              <input className={inputClass()} type="number" min="0" value={form.teleopHiveTips} onChange={(e) => set("teleopHiveTips", e.target.value)} />
            </Field>
            <Field label="Успешность Hive, %" hint="Доля успешных TIP / циклов, если измеряли.">
              <input className={inputClass()} type="number" min="0" max="100" value={form.hiveSuccess} onChange={(e) => set("hiveSuccess", e.target.value)} />
            </Field>
            <Field label="Цикл Pollen, сек">
              <input className={inputClass()} type="number" min="0" value={form.pollenCycleSec} onChange={(e) => set("pollenCycleSec", e.target.value)} />
            </Field>
            <Field label="Цикл Nectar, сек">
              <input className={inputClass()} type="number" min="0" value={form.nectarCycleSec} onChange={(e) => set("nectarCycleSec", e.target.value)} />
            </Field>
            <Field label="FLOWER размещено роботом">
              <input className={inputClass()} type="number" min="0" value={form.flowerPlaced} onChange={(e) => set("flowerPlaced", e.target.value)} />
            </Field>
            <Field label="Точность Flowers, %">
              <input className={inputClass()} type="number" min="0" max="100" value={form.flowerAccuracy} onChange={(e) => set("flowerAccuracy", e.target.value)} />
            </Field>
            <Field label="Элементы в принадлежащих FLOWER">
              <input className={inputClass()} type="number" min="0" value={form.ownedFlowerItems} onChange={(e) => set("ownedFlowerItems", e.target.value)} />
            </Field>
            <Field label="Бонусы нижний NECTAR">
              <input className={inputClass()} type="number" min="0" max="4" value={form.bottomNectar} onChange={(e) => set("bottomNectar", e.target.value)} />
            </Field>
            <Field label="GARDEN элементы">
              <input className={inputClass()} type="number" min="0" value={form.gardenItems} onChange={(e) => set("gardenItems", e.target.value)} />
            </Field>
            <Field label="MINOR FOUL">
              <input className={inputClass()} type="number" min="0" value={form.penalties} onChange={(e) => set("penalties", e.target.value)} />
            </Field>
            <Check name="teleopPark">Парковка TeleOp · 5 очков</Check>
            <Check name="disabled">Робот отключался (DNF / disabled)</Check>
            <Field label="Уверенность">
              <select className={inputClass()} value={form.confidence} onChange={(e) => set("confidence", e.target.value)}>
                <option value="high">Высокая</option>
                <option value="medium">Средняя</option>
                <option value="low">Низкая</option>
              </select>
            </Field>
            <Field label="Скаут / источник" hint="Не указывайте ФИО несовершеннолетних.">
              <input className={inputClass()} value={form.scout} onChange={(e) => set("scout", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Заметка">
                <textarea className={inputClass("min-h-[72px]")} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
            <p className="sm:col-span-2 rounded-lg border border-zinc-800 p-3 text-[12px] leading-relaxed text-zinc-400">
              Модель очков: {MODEL_VERSION}. FLOWER scoring начинается за 60 секунд до конца. Заполняйте только вклад выбранного робота.
            </p>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-2 text-sm text-zinc-200 cursor-pointer">
                <input type="checkbox" className="mt-1 accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                Подтверждаю, что это наблюдаемые факты, без персональных данных детей, и я согласен сохранить запись на этом устройстве.
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm({ ...empty, teamId: db.teams[0]?.id || "" })}>
                Очистить
              </Button>
              <Button type="submit">Сохранить наблюдение</Button>
            </div>
          </form>
        </Panel>
        <Panel>
          <h2 className="text-sm font-semibold">Памятка</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
            <li>HIVE: TIP Auto и TeleOp отдельно; один TIP = 20 игровых очков.</li>
            <li>FLOWER: только элементы в цветках, которыми владеет альянс.</li>
            <li>Надёжность: отмечайте отключения. Не заполняйте пропуски догадками.</li>
          </ul>
        </Panel>
      </div>
      <Panel className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Последние наблюдения</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                {["Ивент", "Матч", "Команда", "Оценка", "Источник", ""].map((h) => (
                  <th key={h || "x"} className="border-b border-zinc-800 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => {
                const t = db.teams.find((x) => x.id === r.teamId);
                return (
                  <tr key={r.id} className="border-b border-zinc-900">
                    <td className="py-2">{r.eventCode || "—"}</td>
                    <td>{r.matchNo || "—"}</td>
                    <td>{t ? teamLabel(t) : r.teamId}</td>
                    <td>{fmt(breakdown(r).total, 0)}</td>
                    <td>{r.scout || "—"}</td>
                    <td>
                      <Button variant="ghost" onClick={() => onDelete(r.id)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
