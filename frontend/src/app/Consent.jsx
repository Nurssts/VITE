import { useState } from "react";
import { Button } from "../components/ui";
import { toast } from "../components/feedback";
import { t } from "../lib/i18n";
import { Logo } from "./Onboarding";

export function CookieBanner({ lang, onDecide, onMore }) {
  return (
    <section
      className="fixed inset-x-3 bottom-20 z-40 rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-md"
      aria-label={t(lang, "cookie_title")}
    >
      <h2 className="text-sm font-semibold text-white">{t(lang, "cookie_title")}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{t(lang, "cookie_body")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => onDecide(false)}>
          {t(lang, "cookie_essential")}
        </Button>
        <Button onClick={() => onDecide(true)}>{t(lang, "cookie_allow")}</Button>
      </div>
      <button type="button" className="mt-2 text-xs text-zinc-500 underline-offset-4 hover:text-white hover:underline" onClick={onMore}>
        {t(lang, "cookie_more")}
      </button>
    </section>
  );
}

export function AgeGate({ lang, onConfirm }) {
  const [over13, setOver13] = useState(false);
  const [guardian, setGuardian] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <form
        className="modal-in w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!over13 && !guardian) {
            toast(t(lang, "age_error"), { error: true });
            return;
          }
          onConfirm({ confirmed: true, over13, guardian });
        }}
      >
        <Logo />
        <h2 id="age-title" className="mt-4 text-lg font-semibold text-white">
          {t(lang, "age_title")}
        </h2>
        <p className="mt-1.5 text-sm text-zinc-400">{t(lang, "age_body")}</p>
        <div className="mt-4 flex flex-col gap-2">
          {[
            [over13, setOver13, "age_over13"],
            [guardian, setGuardian, "age_guardian"],
          ].map(([v, set, key]) => (
            <label key={key} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-200 transition-colors hover:border-zinc-600 has-[:checked]:border-white">
              <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="mt-0.5 h-4 w-4 accent-white" />
              {t(lang, key)}
            </label>
          ))}
        </div>
        <Button type="submit" className="mt-5 w-full" disabled={!over13 && !guardian}>
          {t(lang, "age_continue")}
        </Button>
      </form>
    </div>
  );
}
