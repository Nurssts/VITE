// Global feedback: toasts and confirmation dialogs, callable from anywhere without prop drilling.
//   toast("Saved")                   toast("Failed", { error: true })
//   if (await confirmDialog({ title, body, confirmLabel, danger })) { ... }
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check as CheckIcon, AlertTriangle, Undo2 } from "lucide-react";
import { Button, Modal } from "./ui";
import { tr } from "../lib/i18n";

let toasts = [];
let dialog = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let seq = 0;

export function toast(msg, { error = false, action, duration } = {}) {
  const id = ++seq;
  toasts = [...toasts.slice(-2), { id, msg, error, action }];
  emit();
  setTimeout(() => dismiss(id), duration ?? (action ? 6000 : error ? 5000 : 3000));
  return id;
}

export function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function confirmDialog(opts) {
  return new Promise((resolve) => {
    dialog = { ...opts, resolve };
    emit();
  });
}

function closeDialog(result) {
  const d = dialog;
  dialog = null;
  emit();
  d?.resolve(result);
}

const snapshot = () => ({ toasts, dialog });
let lastSnap = snapshot();
function getSnap() {
  if (lastSnap.toasts !== toasts || lastSnap.dialog !== dialog) lastSnap = snapshot();
  return lastSnap;
}

export function FeedbackHost() {
  const { toasts: list, dialog: d } = useSyncExternalStore(subscribe, getSnap, getSnap);
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [d]);
  const needsWord = d?.typeToConfirm;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[95] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:items-end lg:bottom-auto" aria-live="polite" role="status">
        {list.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-2xl ${t.error ? "bg-white text-black" : "border border-zinc-700 bg-zinc-900 text-white"}`}
          >
            {t.error ? <AlertTriangle size={16} aria-hidden="true" className="shrink-0" /> : <CheckIcon size={16} aria-hidden="true" className="shrink-0 text-zinc-400" />}
            <span className="min-w-0 flex-1">{t.msg}</span>
            {t.action ? (
              <button
                type="button"
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
                onClick={() => {
                  t.action.run();
                  dismiss(t.id);
                }}
              >
                <Undo2 size={13} aria-hidden="true" />
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(d)}
        onClose={() => closeDialog(false)}
        title={d?.title || ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => closeDialog(false)}>
              {d?.cancelLabel || tr("Отмена")}
            </Button>
            <Button variant={d?.danger ? "danger" : "primary"} disabled={Boolean(needsWord) && typed.trim().toLowerCase() !== String(needsWord).toLowerCase()} onClick={() => closeDialog(true)}>
              {d?.confirmLabel || tr("Подтвердить")}
            </Button>
          </>
        }
      >
        {d?.body ? <p className="text-sm leading-relaxed text-zinc-300">{d.body}</p> : null}
        {needsWord ? (
          <label className="mt-4 block text-xs text-zinc-400">
            {tr("Для подтверждения введите")} <strong className="text-white">{needsWord}</strong>
            <input autoFocus className="mt-2 h-10 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
        ) : null}
      </Modal>
    </>
  );
}
