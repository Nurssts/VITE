import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Check, DemoBanner, EmptyState, Field, IconButton, inputClass, PageHeader, Panel, Segmented, Stepper, td, th } from "../components/ui";
import { confirmDialog, toast } from "../components/feedback";
import { addRecord, deleteRecord, findDuplicate, updateRecord } from "../lib/db";
import { breakdown, fmt, MODEL_VERSION, teamLabel } from "../lib/model";
import gameConfig from "../config/game.biobuzz";
import { tr } from "../lib/i18n";

const P = gameConfig.points;
const STATION_KEY = "vite-scout-station";

const blank = {
  autoLeave: false, autoPark: false, teleopPark: false, disabled: false,
  autoHiveTips: 0, teleopHiveTips: 0, cellItems: 0, flowerPlaced: 0, ownedFlowerItems: 0, bottomNectar: 0, gardenItems: 0, penalties: 0,
  autoTrajectory: "unknown", pollenCycleSec: "", nectarCycleSec: "", hiveSuccess: "", flowerAccuracy: "", notes: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function teamForStation(schedule, matchNo, station) {
  if (!schedule || !station) return "";
  const m = schedule.matches.find((x) => x.level === "qual" && x.number === Number(matchNo));
  if (!m) return "";
  const [side, idx] = [station[0] === "R" ? m.red : m.blue, Number(station[1]) - 1];
  return side[idx] || "";
}

export default function Scouting({ db, setDb, go, route }) {
  const editing = route.param ? db.records.find((r) => r.id === route.param) : null;
  const schedule = db.schedule?.eventCode === db.meta.eventCode ? db.schedule : null;
  const byNumber = useMemo(() => new Map(db.teams.map((t) => [t.number, t])), [db.teams]);
  const [station, setStation] = useState(() => sessionStorage.getItem(STATION_KEY) || "");
  const [consent, setConsent] = useState(() => sessionStorage.getItem("vite-scout-consent") === "1");
  const [form, setForm] = useState(() => initialForm());

  function initialForm() {
    if (editing) return { ...blank, ...editing };
    const q = route.query || {};
    const lastScout = sessionStorage.getItem("vite-scout-name") || "";
    const matchNo = q.match || "";
    const fromStation = byNumber.get(teamForStation(schedule, matchNo, sessionStorage.getItem(STATION_KEY)))?.id;
    return { ...blank, teamId: q.team || fromStation || db.teams[0]?.id || "", matchNo, eventCode: db.meta.eventCode || "", date: today(), confidence: "medium", scout: lastScout };
  }

  // Re-initialise when the route changes (edit another record / preselected team from another page).
  useEffect(() => {
    setForm(initialForm());
  }, [route.param, route.query?.team, route.query?.match]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const score = breakdown(form);
  const matchTeams = useMemo(() => {
    if (!schedule || !form.matchNo) return null;
    const m = schedule.matches.find((x) => x.level === "qual" && x.number === Number(form.matchNo));
    return m ? { red: m.red, blue: m.blue } : null;
  }, [schedule, form.matchNo]);

  function setMatch(v) {
    const matchNo = v.replace(/\D/g, "");
    const n = teamForStation(schedule, matchNo, station);
    setForm((f) => ({ ...f, matchNo, teamId: byNumber.get(n)?.id || f.teamId }));
  }

  function chooseStation(s) {
    setStation(s);
    sessionStorage.setItem(STATION_KEY, s);
    const n = teamForStation(schedule, form.matchNo, s);
    if (byNumber.get(n)) set("teamId", byNumber.get(n).id);
  }

  async function submit(e) {
    e.preventDefault();
    if (!consent || !form.teamId) return;
    sessionStorage.setItem("vite-scout-name", form.scout || "");
    if (editing) {
      setDb((d) => updateRecord(d, editing.id, form));
      toast(tr("Изменения сохранены."));
      go("scouting");
      return;
    }
    const dup = findDuplicate(db, form);
    if (dup) {
      const ok = await confirmDialog({
        title: tr("Матч уже записан"),
        body: `${tr("Для этой команды уже есть наблюдение в матче")} ${form.matchNo}${dup.scout ? ` (${tr("скаут")}: ${dup.scout})` : ""}. ${tr("Сохранить ещё одно? Второе наблюдение усреднится с первым.")}`,
        confirmLabel: tr("Сохранить ещё одно"),
      });
      if (!ok) return;
    }
    const { record: saved } = addRecord(db, form);
    setDb((d) => ({ ...d, records: [...d.records, saved], meta: { ...d.meta, demo: false } }));
    toast(`${tr("Сохранено")}: ${teamLabel(db.teams.find((t) => t.id === form.teamId))} · ${fmt(score.total, 0)} ${tr("очк.")}`, {
      action: { label: tr("Отменить"), run: () => setDb((d) => deleteRecord(d, saved.id)) },
    });
    // Next match: keep event/date/scout/station, clear the counts.
    const next = form.matchNo ? String(Number(form.matchNo) + 1) : "";
    const nextTeam = byNumber.get(teamForStation(schedule, next, station))?.id;
    setForm((f) => ({ ...blank, teamId: nextTeam || f.teamId, matchNo: next, eventCode: f.eventCode, date: f.date, confidence: f.confidence, scout: f.scout }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(r) {
    setDb((d) => deleteRecord(d, r.id));
    toast(tr("Запись удалена."), { action: { label: tr("Отменить"), run: () => setDb((d) => (d.records.some((x) => x.id === r.id) ? d : { ...d, records: [...d.records, r] })) } });
  }

  const recent = useMemo(
    () =>
      db.records
        .filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode)
        .sort((a, b) => (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || "") || b.matchNo - a.matchNo)
        .slice(0, 15),
    [db.records, db.meta.eventCode]
  );

  if (!db.teams.length) {
    return (
      <div>
        <PageHeader title={tr("Скаутинг матча")} />
        <EmptyState title={tr("Сначала нужны команды")} body={tr("Выберите ивент или добавьте команды вручную.")} action={<Button onClick={() => go("teams")}>{tr("Добавить команду")}</Button>} />
      </div>
    );
  }

  const sectionTitle = "col-span-full mt-2 border-t border-zinc-900 pt-4 text-sm font-semibold text-white first:mt-0 first:border-0 first:pt-0";

  return (
    <div>
      <PageHeader
        title={editing ? tr("Редактирование наблюдения") : tr("Скаутинг матча")}
        subtitle={tr("Одна запись — один робот. Не дублируйте очки альянса в обеих командах.")}
        actions={
          editing ? (
            <Button variant="secondary" onClick={() => go("scouting")}>
              {tr("Отмена")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => go("data")}>
              {tr("Импорт CSV")}
            </Button>
          )
        }
      />
      <DemoBanner demo={db.meta.demo} />

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3 2xl:grid-cols-4">
            <h2 className={sectionTitle}>{tr("Матч")}</h2>
            <Field label={tr("Номер матча")}>
              <input className={inputClass("num")} inputMode="numeric" value={form.matchNo} onChange={(e) => setMatch(e.target.value)} placeholder="12" />
            </Field>
            <Field label={tr("Команда *")} className="md:col-span-2 2xl:col-span-3">
              <select className={inputClass()} required value={form.teamId} onChange={(e) => set("teamId", e.target.value)}>
                {db.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
            </Field>
            {schedule ? (
              <div className="col-span-full flex flex-wrap items-center gap-3">
                <span className="text-xs text-zinc-400">{tr("Моя позиция")}</span>
                <Segmented
                  label={tr("Моя позиция")}
                  value={station}
                  onChange={chooseStation}
                  options={[{ value: "", label: tr("нет") }, { value: "R1", label: "R1" }, { value: "R2", label: "R2" }, { value: "B1", label: "B1" }, { value: "B2", label: "B2" }]}
                />
                {matchTeams ? (
                  <span className="flex flex-wrap gap-1.5">
                    {[...matchTeams.red.map((n) => ["R", n]), ...matchTeams.blue.map((n) => ["B", n])].map(([side, n]) => {
                      const t = byNumber.get(n);
                      const on = t && t.id === form.teamId;
                      return (
                        <button key={side + n} type="button" disabled={!t} onClick={() => t && set("teamId", t.id)} className={`num rounded-full border px-2.5 py-1 text-xs ${on ? "border-white bg-white text-black" : side === "R" ? "border-zinc-500 text-zinc-100" : "border-dashed border-zinc-600 text-zinc-300"}`}>
                          {side} {n}
                        </button>
                      );
                    })}
                  </span>
                ) : form.matchNo ? (
                  <span className="text-xs text-zinc-500">{tr("Матча нет в расписании")}</span>
                ) : null}
              </div>
            ) : null}

            <h2 className={sectionTitle}>{tr("Автономный период")}</h2>
            <Stepper label={tr("HIVE TIP в Auto")} value={form.autoHiveTips} max={10} onChange={(v) => set("autoHiveTips", v)} hint={`${P.autoHiveTip} ${tr("очк.")}`} />
            <Field label={tr("Траектория автонома")} hint={tr("Нужна для Autonomous Collision Check.")}>
              <select className={inputClass()} value={form.autoTrajectory} onChange={(e) => set("autoTrajectory", e.target.value)}>
                <option value="unknown">{tr("Неизвестно")}</option>
                <option value="left">{tr("Левая зона / left Hive")}</option>
                <option value="center">{tr("Центр")}</option>
                <option value="right">{tr("Правая зона / right Hive")}</option>
                <option value="wall">{tr("У стены / park only")}</option>
              </select>
            </Field>
            <div className="col-span-full grid gap-2 sm:grid-cols-2">
              <Check checked={form.autoLeave} onChange={(v) => set("autoLeave", v)}>{tr("Робот покинул стену · 3 очка")}</Check>
              <Check checked={form.autoPark} onChange={(v) => set("autoPark", v)}>{tr("Парковка Auto · 5 очков")}</Check>
            </div>

            <h2 className={sectionTitle}>{tr("TeleOp и финал")}</h2>
            <Stepper label="HIVE TIP TeleOp" value={form.teleopHiveTips} onChange={(v) => set("teleopHiveTips", v)} hint={`${P.teleopHiveTip} ${tr("очк.")}`} />
            <Stepper label={tr("Элементы в CELL")} value={form.cellItems} onChange={(v) => set("cellItems", v)} hint={`${P.cellItem} ${tr("очк.")}`} />
            <Stepper label={tr("FLOWER размещено роботом")} value={form.flowerPlaced} onChange={(v) => set("flowerPlaced", v)} />
            <Stepper label={tr("Элементы в принадлежащих FLOWER")} value={form.ownedFlowerItems} onChange={(v) => set("ownedFlowerItems", v)} hint={`${P.ownedFlowerItem} ${tr("очк.")}`} />
            <Stepper label={tr("Бонусы нижний NECTAR")} value={form.bottomNectar} max={4} onChange={(v) => set("bottomNectar", v)} hint={`${P.bottomNectar} ${tr("очк.")}`} />
            <Stepper label={tr("GARDEN элементы")} value={form.gardenItems} onChange={(v) => set("gardenItems", v)} hint={`${P.gardenItem} ${tr("очк.")}`} />
            <Stepper label="MINOR FOUL" value={form.penalties} onChange={(v) => set("penalties", v)} hint={`−${P.penalty} ${tr("очк.")}`} />
            <div className="grid content-end gap-2">
              <Check checked={form.teleopPark} onChange={(v) => set("teleopPark", v)}>{tr("Парковка TeleOp · 5 очков")}</Check>
            </div>
            <div className="col-span-full">
              <Check checked={form.disabled} onChange={(v) => set("disabled", v)}>{tr("Робот отключался (DNF / disabled)")}</Check>
            </div>

            <details className="col-span-full rounded-lg border border-zinc-900 px-3 py-2">
              <summary className="cursor-pointer py-1 text-sm text-zinc-300">{tr("Циклы и точность (необязательно)")}</summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["pollenCycleSec", tr("Цикл Pollen, сек")],
                  ["nectarCycleSec", tr("Цикл Nectar, сек")],
                  ["hiveSuccess", tr("Успешность Hive, %")],
                  ["flowerAccuracy", tr("Точность Flowers, %")],
                ].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input className={inputClass("num")} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value.replace(/[^\d.,]/g, ""))} />
                  </Field>
                ))}
              </div>
            </details>

            <h2 className={sectionTitle}>{tr("Контекст")}</h2>
            <Field label={tr("Уверенность")}>
              <select className={inputClass()} value={form.confidence} onChange={(e) => set("confidence", e.target.value)}>
                <option value="high">{tr("Высокая")}</option>
                <option value="medium">{tr("Средняя")}</option>
                <option value="low">{tr("Низкая")}</option>
              </select>
            </Field>
            <Field label={tr("Скаут / источник")} hint={tr("Не указывайте ФИО несовершеннолетних.")}>
              <input className={inputClass()} value={form.scout} maxLength={80} onChange={(e) => set("scout", e.target.value)} />
            </Field>
            <Field label={tr("Код ивента")}>
              <input className={inputClass("uppercase")} value={form.eventCode} onChange={(e) => set("eventCode", e.target.value)} />
            </Field>
            <Field label={tr("Дата")}>
              <input className={inputClass()} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label={tr("Заметка")} className="col-span-full">
              <textarea className={inputClass("h-auto min-h-[76px] py-2")} maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={tr("Что важно для драфта: защита, поломки, сильные стороны")} />
            </Field>
          </div>
        </Panel>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Panel title={tr("Итог робота")} subtitle={MODEL_VERSION}>
            <div className="num text-5xl font-semibold leading-none tracking-tight text-white">{fmt(score.total, 0)}</div>
            <dl className="mt-4 space-y-1.5 text-sm">
              {[
                ["Auto", score.auto],
                ["Hive", score.hive],
                ["Flower", score.flower],
                [tr("Поле и парковка"), score.field],
                [tr("Штрафы"), -score.foul],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-zinc-400">{k}</dt>
                  <dd className="num text-zinc-100">{fmt(v, 0)}</dd>
                </div>
              ))}
            </dl>
            <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-zinc-400">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-white"
                checked={consent}
                required
                onChange={(e) => {
                  setConsent(e.target.checked);
                  sessionStorage.setItem("vite-scout-consent", e.target.checked ? "1" : "0");
                }}
              />
              {tr("Подтверждаю, что это наблюдаемые факты, без персональных данных детей, и я согласен сохранить запись на этом устройстве.")}
            </label>
            <Button type="submit" size="lg" className="mt-4 w-full" disabled={!consent}>
              {editing ? tr("Сохранить изменения") : tr("Сохранить наблюдение")}
            </Button>
            {!editing ? (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setForm((f) => ({ ...blank, teamId: f.teamId, matchNo: f.matchNo, eventCode: f.eventCode, date: f.date, confidence: f.confidence, scout: f.scout }))}>
                {tr("Очистить счётчики")}
              </Button>
            ) : null}
          </Panel>
          <p className="mt-3 px-1 text-xs leading-relaxed text-zinc-500">{tr("FLOWER scoring начинается за 60 секунд до конца. Заполняйте только вклад выбранного робота.")}</p>
        </aside>
      </form>

      <Panel className="mt-4" title={tr("Последние наблюдения")} subtitle={`${recent.length} ${tr("из")} ${db.records.filter((r) => !db.meta.eventCode || r.eventCode === db.meta.eventCode).length}`}>
        {recent.length ? (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr>
                  {[tr("Матч"), tr("Команда"), tr("Оценка"), tr("Источник"), ""].map((h, i) => (
                    <th key={i} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const t = db.teams.find((x) => x.id === r.teamId);
                  return (
                    <tr key={r.id} className={editing?.id === r.id ? "bg-zinc-900" : ""}>
                      <td className={`${td} num`}>{r.matchNo ? `Q${r.matchNo}` : "—"}</td>
                      <td className={td}>
                        <span className="num font-medium text-white">{t?.number || r.teamId}</span> <span className="text-zinc-500">{t?.name}</span>
                        {r.disabled ? <Badge>DNF</Badge> : null}
                      </td>
                      <td className={`${td} num`}>{fmt(breakdown(r).total, 0)}</td>
                      <td className={`${td} text-zinc-400`}>{r.scout || "—"}</td>
                      <td className={`${td} text-right`}>
                        <IconButton label={tr("Изменить")} onClick={() => go("scouting", r.id)}>
                          <Pencil size={15} aria-hidden="true" />
                        </IconButton>
                        <IconButton label={tr("Удалить")} onClick={() => remove(r)}>
                          <Trash2 size={15} aria-hidden="true" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{tr("Пока нет наблюдений для этого ивента.")}</p>
        )}
      </Panel>
    </div>
  );
}
