// VITE design system. Monochrome by design (black / zinc / white / #27272a).
// Hierarchy comes from type weight, white intensity and spacing — never from hue.
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { tr } from "../lib/i18n";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const BTN = {
  primary: "bg-white text-black hover:bg-zinc-200",
  secondary: "border border-zinc-800 bg-zinc-950 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900",
  ghost: "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
  danger: "border border-zinc-700 text-zinc-200 hover:border-white hover:bg-white hover:text-black",
};
const SIZE = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" };

export function Button({ variant = "primary", size = "md", className = "", type = "button", children, ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${SIZE[size]} ${BTN[variant]} ${focus} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = "", ...props }) {
  return (
    <button type="button" aria-label={label} title={label} className={`grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white ${focus} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Panel({ className = "", title, subtitle, actions, children, ...props }) {
  return (
    <section className={`rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 sm:p-5 ${className}`} {...props}>
      {title || actions ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-white">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-snug text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function inputClass(extra = "") {
  return `h-10 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors hover:border-zinc-700 focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${extra}`;
}

export function Kpi({ label, value, foot }) {
  return (
    <article className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="num mt-1 text-[2rem] font-semibold leading-none tracking-tight text-white">{value}</div>
      {foot ? <div className="mt-2 text-xs text-zinc-500">{foot}</div> : null}
    </article>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 px-3 py-2.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold text-white">{value}</div>
      {sub ? <div className="text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "muted", title }) {
  const tones = {
    muted: "border-zinc-800 text-zinc-400",
    strong: "border-white bg-white text-black",
    outline: "border-zinc-600 text-zinc-100",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-12 text-center">
      {Icon ? <Icon size={22} className="mb-3 text-zinc-600" aria-hidden="true" /> : null}
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-zinc-500">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function DemoBanner({ demo, onReplace }) {
  if (!demo) return null;
  return (
    <div className="mb-5 flex flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p>
        <strong className="font-semibold text-white">{tr("Учебные данные.")}</strong>{" "}
        {tr("Названия команд и матчи вымышлены и помечены. Импортируйте свой скаутинг или удалите демо в разделе «Данные».")}
      </p>
      {onReplace ? (
        <Button size="sm" variant="secondary" onClick={onReplace}>
          {tr("Выбрать ивент")}
        </Button>
      ) : null}
    </div>
  );
}

export function Check({ name, children, checked, onChange, required }) {
  const controlled = checked !== undefined;
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-600 has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-black">
      <input
        type="checkbox"
        name={name}
        required={required}
        {...(controlled ? { checked, onChange: (e) => onChange(e.target.checked) } : {})}
        className={`h-4 w-4 shrink-0 accent-black ${focus}`}
      />
      <span>{children}</span>
    </label>
  );
}

/** Big touch-friendly counter for scouting in the stands. */
export function Stepper({ label, value, onChange, min = 0, max = 99, hint }) {
  const id = useId();
  const n = Number(value) || 0;
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-zinc-300">
        {label}
      </label>
      <div className="flex h-11 items-stretch overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <button type="button" className={`w-11 text-lg text-zinc-300 transition-colors hover:bg-zinc-900 active:bg-zinc-800 disabled:opacity-30 ${focus}`} onClick={() => set(n - 1)} disabled={n <= min} aria-label={`${label}: −1`}>
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          className="num w-full min-w-0 border-x border-zinc-800 bg-transparent text-center text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
          value={n}
          onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 0)}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className={`w-11 text-lg text-zinc-300 transition-colors hover:bg-zinc-900 active:bg-zinc-800 disabled:opacity-30 ${focus}`} onClick={() => set(n + 1)} disabled={n >= max} aria-label={`${label}: +1`}>
          +
        </button>
      </div>
      {hint ? <span className="text-xs leading-snug text-zinc-500">{hint}</span> : null}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-zinc-800 bg-black p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${focus} ${value === o.value ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontal 0–100 bars for the auto / hive / flower / reliability profile. */
export function ProfileBars({ profile, compare, labels }) {
  const names = labels || { auto: "Auto", hive: "Hive", flower: "Flower", reliability: tr("Надёжность") };
  return (
    <div className="space-y-3">
      {["auto", "hive", "flower", "reliability"].map((k) => (
        <div key={k} className="grid grid-cols-[88px_1fr_36px] items-center gap-3 text-xs">
          <span className="text-zinc-400">{names[k]}</span>
          <div className="relative h-2 overflow-hidden rounded-full bg-zinc-900">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${Math.round(profile[k])}%` }} />
            {compare ? <div className="absolute inset-y-0 w-0.5 bg-zinc-500" style={{ left: `${Math.round(compare[k])}%` }} title={String(Math.round(compare[k]))} /> : null}
          </div>
          <span className="num text-right text-zinc-200">{Math.round(profile[k])}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Alliance split bar: white = red alliance probability, hatched zinc = blue.
 * Colour-blind safe and works in print because it never relies on hue.
 */
export function SplitBar({ p, leftLabel, rightLabel }) {
  const pct = Math.round(p * 100);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`${leftLabel} ${pct}% · ${rightLabel} ${100 - pct}%`}>
        <div className="bg-white" style={{ width: `${pct}%` }} />
        <div className="hatch flex-1" />
      </div>
      <div className="num mt-1 flex justify-between text-[11px] text-zinc-400">
        <span>
          {leftLabel} {pct}%
        </span>
        <span>
          {100 - pct}% {rightLabel}
        </span>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-900 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <Skeleton className="mb-3 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-80 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-4 h-64" />
    </div>
  );
}

/** Accessible modal: Esc closes, focus moves inside and returns afterwards, background is inert. */
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector("input, select, textarea, button:not([data-close])");
    (first || el)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === "Tab" && el) {
        const items = [...el.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])")];
        if (!items.length) return;
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`modal-in max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950 px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <IconButton label={tr("Закрыть")} onClick={onClose} data-close>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-900 px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}

export const th = "border-b border-zinc-800 px-3 py-2.5 text-left text-xs font-medium text-zinc-500";
export const td = "border-b border-zinc-900 px-3 py-2.5 align-middle";
