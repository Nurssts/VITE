import {
  BarChart3,
  ClipboardList,
  FileText,
  Gavel,
  LayoutDashboard,
  Menu,
  Plus,
  Scale,
  Settings,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandMark, Button } from "./ui";
import { t } from "../lib/i18n";
import { MODEL_VERSION } from "../lib/model";

function buildNav(lang) {
  return [
    { id: "overview",  icon: LayoutDashboard, group: "work" },
    { id: "scouting",  icon: ClipboardList,   group: "work" },
    { id: "teams",     icon: Users,           group: "work" },
    { id: "analysis",  icon: BarChart3,       group: "work" },
    { id: "draft",     icon: Gavel,           group: "work" },
    { id: "notebook",  icon: FileText,        group: "data" },
    { id: "data",      icon: Upload,          group: "data" },
    { id: "legal",     icon: Scale,           group: "data" },
    { id: "settings",  icon: Settings,        group: "data" },
  ].map((item) => ({
    ...item,
    label: t(lang, `nav_${item.id}`),
    groupLabel: item.group === "work" ? t(lang, "nav_group_work") : t(lang, "nav_group_data"),
  }));
}

function Sidebar({ nav, page, setPage, eventLabel, lang, onClose }) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + close (mobile) */}
      <div className="mb-7 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl text-left"
          onClick={() => { setPage("overview"); onClose?.(); }}
          aria-label="VITE, перейти к обзору"
        >
          <BrandMark size={38} />
          <span>
            <strong className="block font-display text-[15px] font-bold tracking-[0.18em] text-zinc-50">VITE</strong>
            <small className="block text-[11px] leading-tight text-zinc-500">BioBuzz Alliance Matrix</small>
          </span>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-50 lg:hidden"
            aria-label="Закрыть меню"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Current event */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Event</div>
        <div className="mt-0.5 truncate text-[13px] font-medium text-zinc-100">{eventLabel}</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5" aria-label={t(lang, "nav_overview")}>
        {nav.map((item, i) => {
          const Icon = item.icon;
          const prevGroup = nav[i - 1]?.group;
          const showGroup = i === 0 || item.group !== prevGroup;
          const active = page === item.id;
          return (
            <div key={item.id}>
              {showGroup && (
                <div className={`${i === 0 ? "mb-1.5" : "mb-1.5 mt-5"} px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600`}>
                  {item.groupLabel}
                </div>
              )}
              <button
                type="button"
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-zinc-800/80 font-semibold text-zinc-50"
                    : "font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
                onClick={() => { setPage(item.id); onClose?.(); }}
                aria-current={active ? "page" : undefined}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-honey-400" aria-hidden="true" />}
                <Icon
                  size={16}
                  aria-hidden="true"
                  className={active ? "text-honey-400" : "text-zinc-500 group-hover:text-zinc-300"}
                />
                <span className="flex-1">{item.label}</span>
                <kbd className="hidden font-mono text-[10px] text-zinc-600 lg:inline">{i + 1}</kbd>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-800/80 pt-4 font-mono text-[10px] leading-relaxed text-zinc-600">
        {MODEL_VERSION}
      </div>
    </div>
  );
}

export default function Layout({ page, setPage, eventLabel, onScout, lang = "ru", children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = buildNav(lang);
  const title = nav.find((n) => n.id === page)?.label || nav[0].label;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <a className="skip-link" href="#main">
        {t(lang, "skip_to_content")}
      </a>

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* ── Desktop sidebar ── */}
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-zinc-800/80 bg-zinc-950 px-4 py-6 lg:flex">
          <Sidebar nav={nav} page={page} setPage={setPage} eventLabel={eventLabel} lang={lang} />
        </aside>

        {/* ── Mobile drawer overlay ── */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Mobile sliding drawer ── */}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-800 bg-zinc-950 px-4 py-6 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-hidden={!menuOpen}
          inert={menuOpen ? undefined : ""}
        >
          <Sidebar nav={nav} page={page} setPage={setPage} eventLabel={eventLabel} lang={lang} onClose={() => setMenuOpen(false)} />
        </div>

        {/* ── Main content area ── */}
        <div className="flex min-h-screen flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-50 lg:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Открыть меню"
              >
                <Menu size={16} aria-hidden="true" />
              </button>
              <span className="lg:hidden"><BrandMark size={24} /></span>
              <div className="text-sm text-zinc-500">
                <span className="hidden sm:inline">VITE <span className="mx-1.5 text-zinc-700">/</span></span>
                <strong className="font-semibold text-zinc-100">{title}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-role-reliability" aria-hidden="true" />
                {t(lang, "saved_locally")}
              </span>
              <Button onClick={onScout} className="h-8 px-3 text-xs">
                <Plus size={14} aria-hidden="true" />
                {t(lang, "add_observation").replace(/^\+\s*/, "")}
              </Button>
            </div>
          </header>

          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>

          <footer className="border-t border-zinc-800/80 px-4 py-5 pb-[5.5rem] text-xs text-zinc-500 sm:px-6 lg:px-10 lg:pb-5">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{t(lang, "footer_disclaimer")}</p>
              <button
                type="button"
                className="self-start text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-100 hover:underline"
                onClick={() => setPage("legal")}
              >
                {t(lang, "footer_policies")}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {/* ── Mobile bottom tab bar (5 primary tabs) ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md lg:hidden"
        aria-label="Мобильная навигация"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => setPage(item.id)}
              aria-current={active ? "page" : undefined}
            >
              {active && <span className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-honey-400" aria-hidden="true" />}
              <Icon size={18} aria-hidden="true" className={active ? "text-honey-400" : ""} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={18} aria-hidden="true" />
          <span>Ещё</span>
        </button>
      </nav>
    </div>
  );
}
