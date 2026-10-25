// Hex values mirror tailwind.config.js for places that need raw colors (Recharts, SVG).
export const COLORS = {
  ink: "#0d0c0a",
  cell: "#16140f",
  wax: "#25221b",
  waxHi: "#38342a",
  smoke: "#857e6d",
  paper: "#f1ede4",
  honey: "#f7bf3c",
  sting: "#ff7a59",
};

export const ROLE_COLORS = {
  auto: "#6cb6ff",
  hive: "#f7bf3c",
  flower: "#ec8fbd",
  reliability: "#7ccf95",
};

export const tooltipStyle = {
  background: COLORS.cell,
  border: `1px solid ${COLORS.waxHi}`,
  borderRadius: 10,
  fontSize: 12,
  color: COLORS.paper,
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
};

export function Button({ variant = "primary", className = "", children, ...props }) {
  const styles = {
    primary: "bg-honey-400 text-ink font-semibold hover:bg-honey-300 active:bg-honey-500",
    secondary: "bg-transparent text-zinc-100 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900",
    ghost: "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900",
    danger: "border border-sting/40 text-sting hover:bg-sting/10 hover:border-sting/70",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ className = "", children }) {
  return (
    <section className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function BrandMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-shrink-0">
      <path d="M32 3 57.1 17.5v29L32 61 6.9 46.5v-29z" fill={COLORS.honey} />
      <path d="M21 19h7l4 13.5L36 19h7l-7.5 24h-7z" fill={COLORS.ink} />
    </svg>
  );
}

// Page title block shared by every section.
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-honey-400">{eyebrow}</div>
        ) : null}
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-[2rem]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-snug text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function inputClass(extra = "") {
  return `w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 hover:border-zinc-600 focus:border-honey-400 ${extra}`;
}

export function Kpi({ label, value, foot }) {
  return (
    <article className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <div className="text-xs font-medium text-zinc-400">{label}</div>
      <div className="tabular mt-3 font-mono text-[2rem] font-medium leading-none tracking-tight text-zinc-50">{value}</div>
      <div className="mt-2 text-[11px] text-zinc-500">{foot}</div>
    </article>
  );
}

export function RoleBar({ role, value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="grid grid-cols-[88px_1fr_36px] items-center gap-3 text-xs">
      <span className="flex items-center gap-2 text-zinc-400">
        <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLORS[role] }} aria-hidden="true" />
        {label || role}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${v}%`, background: ROLE_COLORS[role] }} />
      </div>
      <span className="tabular text-right font-mono text-zinc-200">{v}</span>
    </div>
  );
}

export function DemoBanner({ demo }) {
  if (!demo) return null;
  return (
    <div
      className="mb-5 flex flex-col gap-1 rounded-xl border border-honey-400/25 bg-honey-900/30 px-4 py-3 text-sm text-zinc-300 sm:flex-row sm:gap-3"
      role="status"
    >
      <strong className="text-honey-300">Учебные данные.</strong>
      <span>Названия команд и матчи вымышлены и помечены. Импортируйте свой скаутинг или удалите демо в разделе «Импорт».</span>
    </div>
  );
}

export function Check({ name, children, required }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
      <input type="checkbox" name={name} required={required} className="mt-0.5 h-4 w-4 accent-honey-400" />
      <span>{children}</span>
    </label>
  );
}
