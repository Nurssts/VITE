export function Button({ variant = "primary", className = "", children, ...props }) {
  const styles = {
    primary: "bg-black text-white hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
    secondary: "bg-white text-zinc-900 border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
    ghost: "bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
    danger: "border border-zinc-300 text-red-600 hover:bg-red-50 hover:border-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
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
  return <section className={`rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm ${className}`}>{children}</section>;
}

export function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-snug text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function inputClass(extra = "") {
  return `w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 ${extra}`;
}

export function Kpi({ label, value, foot }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{foot}</div>
    </article>
  );
}

export function DemoBanner({ demo }) {
  if (!demo) return null;
  return (
    <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
      <strong className="text-amber-900">Учебные данные.</strong>
      <span>Названия команд и матчи вымышлены и помечены. Импортируйте свой скаутинг или удалите демо в разделе «Данные».</span>
    </div>
  );
}

export function Check({ name, children, required }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 cursor-pointer hover:bg-zinc-50 transition-colors">
      <input type="checkbox" name={name} required={required} className="mt-0.5 h-4 w-4 accent-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" />
      <span>{children}</span>
    </label>
  );
}
