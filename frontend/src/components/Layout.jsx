import { useEffect, useState } from "react";
import { BarChart3, CalendarClock, ClipboardList, FileText, Gavel, LayoutDashboard, Menu, Plus, Settings, Upload, Users, X } from "lucide-react";
import { Button, IconButton } from "./ui";
import { Logo } from "../app/Onboarding";
import { t, tr } from "../lib/i18n";

// Order = keyboard shortcuts 1–9.
const NAV = [
  { id: "overview", icon: LayoutDashboard, group: "work" },
  { id: "scouting", icon: ClipboardList, group: "work" },
  { id: "matches", icon: CalendarClock, group: "work" },
  { id: "teams", icon: Users, group: "work" },
  { id: "analysis", icon: BarChart3, group: "work" },
  { id: "draft", icon: Gavel, group: "work" },
  { id: "notebook", icon: FileText, group: "data" },
  { id: "data", icon: Upload, group: "data" },
  { id: "settings", icon: Settings, group: "data" },
];
const MOBILE = ["overview", "scouting", "matches", "teams"];

function label(lang, id) {
  return id === "matches" ? tr("Матчи") : t(lang, `nav_${id}`);
}

function SaveIndicator({ saveState, allowStorage }) {
  if (!allowStorage) return <span className="text-xs text-zinc-500">{tr("Без сохранения")}</span>;
  if (!saveState.ok) return <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-black">{tr("Не сохранено")}</span>;
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
      {tr("Сохранено на устройстве")}
    </span>
  );
}

function Sidebar({ lang, page, go, event, onEvent, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <button type="button" className="flex items-center gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => go("overview")} aria-label={tr("VITE, перейти к обзору")}>
          <Logo />
          <span>
            <strong className="block text-sm font-bold tracking-[0.2em] text-white">VITE</strong>
            <small className="block text-[11px] leading-tight text-zinc-500">BioBuzz Alliance Matrix</small>
          </span>
        </button>
        {onClose ? (
          <IconButton label={tr("Закрыть меню")} onClick={onClose} className="lg:hidden">
            <X size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      <button type="button" onClick={onEvent} className="mb-6 rounded-lg border border-zinc-800 px-3 py-2.5 text-left transition-colors hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" title={tr("Сменить ивент")}>
        <span className="block text-[11px] text-zinc-500">{tr("Турнир")}</span>
        <span className="block truncate text-sm font-medium text-zinc-100">{event.name || t(lang, "event_not_set")}</span>
        {event.code ? <span className="block text-xs text-zinc-500">{event.code}</span> : null}
      </button>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label={tr("Основная навигация")}>
        {NAV.map((item, i) => {
          const Icon = item.icon;
          const active = page === item.id;
          const groupStart = i === 0 || NAV[i - 1].group !== item.group;
          return (
            <div key={item.id}>
              {groupStart ? <div className={`px-3 pb-1.5 text-xs text-zinc-600 ${i ? "mt-5" : ""}`}>{item.group === "work" ? t(lang, "nav_group_work") : t(lang, "nav_group_data")}</div> : null}
              <button
                type="button"
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${active ? "bg-white font-medium text-black" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
              >
                <Icon size={16} aria-hidden="true" className={active ? "text-black" : "text-zinc-500 group-hover:text-zinc-300"} />
                <span className="flex-1">{label(lang, item.id)}</span>
                <kbd className={`hidden text-[10px] lg:inline ${active ? "text-zinc-500" : "text-zinc-700"}`}>{i + 1}</kbd>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default function Layout({ page, go, event, onEvent, onScout, lang, saveState, allowStorage, children }) {
  const [menu, setMenu] = useState(false);
  const title = page === "legal" ? t(lang, "nav_legal") : label(lang, page);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const goAndClose = (id) => {
    go(id);
    setMenu(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <a className="skip-link" href="#main">
        {t(lang, "skip_to_content")}
      </a>
      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-zinc-900 px-3 py-5 lg:flex">
          <Sidebar lang={lang} page={page} go={go} event={event} onEvent={onEvent} />
        </aside>

        {menu ? <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMenu(false)} aria-hidden="true" /> : null}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto border-r border-zinc-900 bg-black px-3 py-5 shadow-2xl transition-transform duration-200 lg:hidden ${menu ? "translate-x-0" : "-translate-x-full"}`}
          aria-hidden={!menu}
          inert={menu ? undefined : ""}
        >
          <Sidebar lang={lang} page={page} go={goAndClose} event={event} onEvent={() => { setMenu(false); onEvent(); }} onClose={() => setMenu(false)} />
        </div>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-zinc-900 bg-black/85 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <IconButton label={tr("Открыть меню")} className="lg:hidden" onClick={() => setMenu(true)}>
                <Menu size={18} aria-hidden="true" />
              </IconButton>
              <strong className="truncate text-sm font-semibold text-white">{title}</strong>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline">
                <SaveIndicator saveState={saveState} allowStorage={allowStorage} />
              </span>
              {page !== "scouting" ? (
                <Button size="sm" onClick={onScout}>
                  <Plus size={14} aria-hidden="true" />
                  {tr("Наблюдение")}
                </Button>
              ) : null}
            </div>
          </header>

          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 lg:px-8 lg:pb-10">
            {children}
          </main>

          <footer className="hidden border-t border-zinc-900 px-6 py-5 text-xs text-zinc-600 lg:block">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <p>{t(lang, "footer_disclaimer")}</p>
              <button type="button" className="hover:text-zinc-300" onClick={() => go("legal")}>
                {t(lang, "footer_policies")}
              </button>
            </div>
          </footer>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-900 bg-black/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label={tr("Мобильная навигация")}>
        {MOBILE.map((id) => {
          const item = NAV.find((n) => n.id === id);
          const Icon = item.icon;
          const active = page === id;
          return (
            <button key={id} type="button" onClick={() => go(id)} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-white" : "text-zinc-500"}`}>
              <span className={`grid h-7 w-10 place-items-center rounded-full transition-colors ${active ? "bg-white text-black" : ""}`}>
                <Icon size={17} aria-hidden="true" />
              </span>
              {label(lang, id)}
            </button>
          );
        })}
        <button type="button" onClick={() => setMenu(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-zinc-500">
          <span className="grid h-7 w-10 place-items-center">
            <Menu size={17} aria-hidden="true" />
          </span>
          {tr("Ещё")}
        </button>
      </nav>
    </div>
  );
}

export { NAV };
