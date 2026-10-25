export function Button({ variant = "primary", className = "", children, ...props }) {
  const styles = {
    primary:
      "bg-white text-black hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
    secondary:
      "bg-transparent text-zinc-200 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
    ghost:
      "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
    danger:
      "border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ className = "", children }) {
  return (
    <section className={`rounded-2xl border border-zinc-900 bg-zinc-950 p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-snug text-zinc-600">{hint}</span> : null}
    </label>
  );
}

export function inputClass(extra = "") {
  return `w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 ${extra}`;
}

export function Kpi({ label, value, foot }) {
  return (
    <article className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-[11px] text-zinc-600">{foot}</div>
    </article>
  );
}

export function DemoBanner({ demo }) {
  if (!demo) return null;
  return (
    <div
      className="mb-4 flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300"
      role="status"
    >
      <strong className="text-zinc-100">Учебные данные.</strong>
      <span>Названия команд и матчи вымышлены и помечены. Импортируйте свой скаутинг или удалите демо в разделе «Данные».</span>
    </div>
  );
}

export function Check({ name, children, required }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-900 hover:border-zinc-700 transition-colors">
      <input
        type="checkbox"
        name={name}
        required={required}
        className="mt-0.5 h-4 w-4 accent-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
      />
      <span>{children}</span>
    </label>
  );
}
