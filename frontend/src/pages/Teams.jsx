import { useMemo, useState } from "react";
import { Button, DemoBanner, Field, inputClass, Panel } from "../components/ui";
import { allStats, fmt, initials, priority, roleLabel, stats } from "../lib/model";

export default function Teams({ db, setPage, onAddTeam }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null);
  const [open, setOpen] = useState(false);
  const list = useMemo(
    () =>
      allStats(db)
        .filter((s) => `${s.team.number} ${s.team.name} ${s.team.region}`.toLowerCase().includes(q.toLowerCase()))
        .filter((s) => filter === "all" || priority(s) === filter)
        .sort((a, b) => b.mean - a.mean),
    [db, q, filter]
  );

  if (active) {
    const t = db.teams.find((x) => x.id === active);
    const s = stats(db, t);
    return (
      <div>
        <Button variant="ghost" onClick={() => setActive(null)}>
          ← Все команды
        </Button>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-sm font-bold text-black" aria-hidden="true">
            {initials(t)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold">{t.name}</h1>
            <p className="text-sm text-zinc-500">
              {t.number} · {t.region || "регион не указан"} · {roleLabel(s)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["Наблюдений", s.count],
            ["Оценка", fmt(s.mean)],
            ["σ", `± ${fmt(s.sd)}`],
            ["DNF", `${Math.round(s.dnf * 100)}%`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-zinc-800 p-3">
              <div className="text-[11px] text-zinc-500">{l}</div>
              <div className="text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <Panel className="mt-4">
          <h2 className="mb-3 text-sm font-semibold">Профиль 0–100</h2>
          {["auto", "hive", "flower", "reliability"].map((k) => (
            <div key={k} className="mb-3 grid grid-cols-[100px_1fr_36px] items-center gap-2 text-xs">
              <span className="uppercase text-zinc-500">{k}</span>
              <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
                <div className="h-full bg-white" style={{ width: `${Math.round(s.profile[k])}%` }} />
              </div>
              <span className="text-right">{Math.round(s.profile[k])}</span>
            </div>
          ))}
          <p className="chart-note">Оценка вклада — сумма наблюдаемых действий, а не официальный счёт.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Команды</h1>
          <p className="mt-1 text-sm text-zinc-500">Профили, стабильность и объём скаутинга.</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Добавить команду</Button>
      </div>
      <DemoBanner demo={db.meta.demo} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className={inputClass("sm:max-w-xs")} placeholder="Найти команду" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputClass("sm:max-w-[180px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400")} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Все приоритеты</option>
          <option value="A">A</option>
          <option value="Б">Б</option>
          <option value="В">В</option>
        </select>
      </div>
      <div className="grid gap-2">
        {list.map((s) => (
          <article key={s.team.id} className="grid items-center gap-3 rounded-xl border border-zinc-800 p-3 sm:grid-cols-[1fr_repeat(3,minmax(0,.5fr))_auto]">
            <div>
              <div className="font-medium">
                {s.team.number} · {s.team.name}
              </div>
              <div className="text-[11px] text-zinc-500">
                {roleLabel(s)} · {s.team.region || "—"}
              </div>
            </div>
            <div className="text-sm">
              {fmt(s.mean)} <span className="text-zinc-500">± {fmt(s.sd)}</span>
            </div>
            <div className="text-sm">{s.count} матч.</div>
            <div className="text-sm">{priority(s)}</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setActive(s.team.id)}>
                Профиль
              </Button>
              <Button variant="ghost" onClick={() => setPage("scouting")}>
                + Матч
              </Button>
            </div>
          </article>
        ))}
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const x = Object.fromEntries(new FormData(e.target).entries());
              if (x.consent !== "on") return;
              onAddTeam(x);
              setOpen(false);
            }}
          >
            <h2 className="text-lg font-semibold">Добавить команду</h2>
            <div className="mt-3 grid gap-3">
              <Field label="Номер *">
                <input className={inputClass()} name="number" required />
              </Field>
              <Field label="Название *">
                <input className={inputClass()} name="name" required />
              </Field>
              <Field label="Регион">
                <input className={inputClass()} name="region" />
              </Field>
              <label className="flex gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="consent" required className="accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" />Я подтверждаю, что это публичные данные команды FTC, без персональных данных учеников.
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit">Добавить</Button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
