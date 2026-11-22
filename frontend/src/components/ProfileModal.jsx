// "My profile": the member's team, role and display name. Stored only on this device (prefs).
import { useState } from "react";
import { Button, Field, inputClass, Modal } from "./ui";
import { ROLES, roleHint } from "../lib/roles";
import { tr } from "../lib/i18n";

export default function ProfileModal({ open, onClose, prefs, setPrefs, teams }) {
  return open ? <ProfileForm onClose={onClose} prefs={prefs} setPrefs={setPrefs} teams={teams} /> : null;
}

function ProfileForm({ onClose, prefs, setPrefs, teams }) {
  const sorted = [...teams].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0) || a.number.localeCompare(b.number));
  const inList = !prefs.myTeam || teams.some((t) => t.number === prefs.myTeam);
  const [team, setTeam] = useState(inList ? prefs.myTeam || "" : "__other");
  const [otherTeam, setOtherTeam] = useState(inList ? "" : prefs.myTeam || "");
  const [role, setRole] = useState(prefs.myRole || "");
  const [name, setName] = useState(prefs.displayName || "");

  function save(e) {
    e.preventDefault();
    const myTeam = team === "__other" ? otherTeam.replace(/[^\w-]/g, "").slice(0, 20) : team;
    setPrefs((p) => ({ ...p, myTeam, myRole: role, displayName: name.trim().slice(0, 40) }));
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tr("Мой профиль")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("Отмена")}
          </Button>
          <Button type="submit" form="profile-form">
            {tr("Сохранить")}
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={save} className="grid gap-4">
        <Field label={tr("Моя команда")} hint={tr("Подсвечивается в расписании, AI считает её «нашей».")}>
          <select className={inputClass()} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">{tr("Не выбрана")}</option>
            {sorted.map((t) => (
              <option key={t.id} value={t.number}>
                {t.number} {t.name}
              </option>
            ))}
            <option value="__other">{tr("Другая — ввести номер")}</option>
          </select>
        </Field>
        {team === "__other" ? (
          <Field label={tr("Номер команды")}>
            <input className={inputClass("num")} inputMode="numeric" maxLength={20} value={otherTeam} onChange={(e) => setOtherTeam(e.target.value)} autoFocus />
          </Field>
        ) : null}

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-zinc-300">{tr("Моя роль")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer flex-col rounded-lg border border-zinc-800 px-3 py-2 text-sm transition-colors hover:border-zinc-600 has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black"
              >
                <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} className="sr-only" />
                <span className="font-medium">{tr(r.ru)}</span>
                {roleHint(r.id) ? <span className="text-[11px] opacity-60">{roleHint(r.id)}</span> : null}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={tr("Отображаемое имя (необязательно, без фамилии)")} hint={tr("Подставляется как имя скаута в наблюдениях.")}>
          <input className={inputClass()} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
