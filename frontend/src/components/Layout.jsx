import {
  BarChart3,
  ClipboardList,
  FileText,
  Gavel,
  LayoutDashboard,
  Menu,
  Scale,
  Settings,
  Shield,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui";
import { t } from "../lib/i18n";

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
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          className="flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600 rounded-xl"
          onClick={() => { setPage("overview"); onClose?.(); }}
          aria-label="VITE, перейти к обзору"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <span className="text-sm font-black text-black leading-none">V</span>
          </span>
          <span>
            <strong className="block text-sm tracking-widest text-white font-bold">VITE</strong>
            <small className="text-[11px] text-zinc-500 leading-tight">BioBuzz Alliance Matrix</small>
          </span>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Закрыть меню"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Event info pill */}
      <div className="mb-5 flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5">
        <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 text-[10px] font-bold flex-shrink-0">
          FT
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200 truncate">FTC Team</div>
          <div className="text-[10px] text-zinc-600 truncate">{eventLabel}</div>
        </div>
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
                <div className={`${i === 0 ? "mb-1" : "mb-1 mt-4"} px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600`}>
                  {item.groupLabel}
                </div>
              )}
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-500 ${
                  active
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
                onClick={() => { setPage(item.id); onClose?.(); }}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon
                  size={16}
                  aria-hidden="true"
                  className={active ? "text-black" : "text-zinc-500"}
                />
                <span className="flex-1">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Bottom settings shortcut */}
      <div className="mt-auto pt-4 border-t border-zinc-900">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-900 hover:text-zinc-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-500"
          onClick={() => { setPage("settings"); onClose?.(); }}
          aria-label={t(lang, "nav_settings")}
        >
          <Settings size={16} aria-hidden="true" />
          {t(lang, "nav_settings")}
        </button>
      </div>
    </div>
  );
}

export default function Layout({ page, setPage, eventLabel, onScout, lang = "ru", children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = buildNav(lang);
  const title = nav.find((n) => n.id === page)?.label || nav[0].label;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <a className="skip-link" href="#main">
        {t(lang, "skip_to_content")}
      </a>

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex h-screen sticky top-0 flex-col border-r border-zinc-900 bg-zinc-950 px-4 py-5">
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
          className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-zinc-900 bg-zinc-950 px-4 py-5 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar nav={nav} page={page} setPage={setPage} eventLabel={eventLabel} lang={lang} onClose={() => setMenuOpen(false)} />
        </div>

        {/* ── Main content area ── */}
        <div className="flex min-h-screen flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-900 bg-zinc-950/90 px-4 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-3">
              {/* Hamburger – mobile only */}
              <button
                type="button"
                className="lg:hidden grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                onClick={() => setMenuOpen(true)}
                aria-label="Открыть меню"
              >
                <Menu size={16} aria-hidden="true" />
              </button>
              {/* Breadcrumb */}
              <div className="text-sm text-zinc-500">
                <span className="hidden sm:inline">VITE <span className="mx-1.5 text-zinc-800">/</span></span>
                <strong className="text-zinc-100">{title}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden text-[11px] text-zinc-700 sm:inline">{t(lang, "saved_locally")}</span>
              <Button onClick={onScout} className="h-8 px-3 text-xs">
                {t(lang, "add_observation")}
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-5 text-xs text-zinc-600 sm:px-6 pb-[5.5rem] lg:pb-5">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{t(lang, "footer_disclaimer")}</p>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  className="text-zinc-600 hover:text-zinc-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  onClick={() => setPage("legal")}
                >
                  {t(lang, "footer_policies")}
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ── Mobile bottom tab bar (5 primary tabs) ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-900 bg-zinc-950 lg:hidden"
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
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-500 ${
                active ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              }`}
              onClick={() => setPage(item.id)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <div className={`relative grid h-6 w-6 place-items-center rounded-lg transition-all ${active ? "bg-white" : ""}`}>
                <Icon size={15} aria-hidden="true" className={active ? "text-black" : ""} />
              </div>
              <span className={active ? "text-white" : ""}>{item.label}</span>
            </button>
          );
        })}
        {/* Extra "more" button → opens drawer */}
        <button
          type="button"
          className="flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-500"
          onClick={() => setMenuOpen(true)}
          aria-label="Ещё"
        >
          <div className="grid h-6 w-6 place-items-center rounded-lg">
            <Menu size={15} aria-hidden="true" />
          </div>
          <span>Ещё</span>
        </button>
      </nav>

      {/* Hidden Shield icon to keep import */}
      <div className="hidden">
        <Shield aria-hidden="true" />
      </div>
    </div>
  );
}
