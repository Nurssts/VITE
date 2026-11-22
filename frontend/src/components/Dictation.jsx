// Scribe: describe a robot's match in your own words (voice or text) -> the scouting form is
// filled in for review. Nothing is saved until the scout presses Save.
import { useState } from "react";
import { Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { Button, Modal } from "./ui";
import { extractScouting } from "../lib/ai/client";
import { useSpeech } from "../lib/ai/speech";
import { COUNT_FIELDS, FLAG_FIELDS, TRAJECTORIES, CONFIDENCE } from "../lib/db";
import { getLang, tr } from "../lib/i18n";

/** Convert the model's draft into form fields. Unknown values are ignored, never guessed. */
export function draftToForm(draft, form, teams) {
  const next = { ...form };
  const applied = [];
  const team = draft.teamNumber ? teams.find((t) => t.number === String(draft.teamNumber).trim()) : null;
  if (team) {
    next.teamId = team.id;
    applied.push("team");
  }
  if (Number.isInteger(Number(draft.matchNo)) && Number(draft.matchNo) > 0) {
    next.matchNo = String(Number(draft.matchNo));
    applied.push("matchNo");
  }
  COUNT_FIELDS.forEach((k) => {
    const n = Math.round(Number(draft[k]));
    if (Number.isFinite(n) && n >= 0 && n <= 99) {
      next[k] = n;
      if (n) applied.push(k);
    }
  });
  FLAG_FIELDS.forEach((k) => {
    if (typeof draft[k] === "boolean") {
      next[k] = draft[k];
      if (draft[k]) applied.push(k);
    }
  });
  if (TRAJECTORIES.includes(draft.autoTrajectory)) next.autoTrajectory = draft.autoTrajectory;
  if (CONFIDENCE.includes(draft.confidence)) next.confidence = draft.confidence;
  if (typeof draft.notes === "string" && draft.notes.trim()) next.notes = [form.notes, draft.notes.trim()].filter(Boolean).join("\n").slice(0, 2000);
  const uncertain = Array.isArray(draft.uncertain) ? draft.uncertain.filter((x) => typeof x === "string").slice(0, 12) : [];
  return { form: next, applied, uncertain, unknownTeam: draft.teamNumber && !team ? String(draft.teamNumber) : null };
}

export default function Dictation({ open, onClose, teams, form, onApply }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speech = useSpeech((t) => setText((v) => (v ? `${v} ${t}` : t)));
  const current = teams.find((t) => t.id === form.teamId);

  async function parse() {
    setBusy(true);
    setError("");
    try {
      const res = await extractScouting({
        text,
        roster: teams.slice(0, 200).map((t) => ({ number: t.number, name: t.name || "" })),
        team: current?.number || "",
        match: Number(form.matchNo) || null,
        lang: getLang(),
      });
      onApply(draftToForm(res.draft || {}, form, teams), res);
      setText("");
      onClose();
    } catch (e) {
      setError(e.status === 503 ? tr("AI не подключён на сервере. Заполните форму вручную.") : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr("AI-диктовка матча")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("Отмена")}
          </Button>
          <Button onClick={parse} disabled={busy || text.trim().length < 3}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
            {tr("Заполнить форму")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-400">{tr("Опишите робота своими словами — голосом или текстом. AI заполнит форму, вы проверите и сохраните.")}</p>
      <p className="mt-2 rounded-lg border border-zinc-900 px-3 py-2 text-xs text-zinc-500">
        {tr("Пример")}: «{tr("23334, матч 12: уехал со старта, два типа в авто, в телеопе ещё три, припарковался, один фол, в конце долго стоял")}»
      </p>
      <div className="relative mt-3">
        <textarea
          autoFocus
          rows={5}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          placeholder={current ? `${tr("Команда по умолчанию")}: ${current.number}` : ""}
          aria-label={tr("Описание матча")}
        />
        {speech.supported ? (
          <button type="button" onClick={speech.toggle} className={`absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border ${speech.listening ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-300 hover:border-white"}`} aria-label={speech.listening ? tr("Остановить диктовку") : tr("Диктовать")}>
            {speech.listening ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-zinc-200" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
