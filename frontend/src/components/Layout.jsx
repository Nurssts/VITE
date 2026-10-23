import {
  BarChart3,
  ClipboardList,
  FileText,
  Gavel,
  LayoutDashboard,
  Scale,
  Settings,
  Shield,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "./ui";

const NAV = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard, group: "Работа" },
  { id: "scouting", label: "Скаутинг", icon: ClipboardList, group: "Работа" },
  { id: "teams", label: "Команды", icon: Users, group: "Работа" },
  { id: "analysis", label: "Синергия", icon: BarChart3, group: "Работа" },
  { id: "draft", label: "Драфт", icon: Gavel, group: "Работа" },
  { id: "notebook", label: "Notebook", icon: FileText, group: "Данные" },
  { id: "data", label: "Импорт", icon: Upload, group: "Данные" },
  { id: "legal", label: "Правовое", icon: Scale, group: "Данные" },
  { id: "settings", label: "Настройки", icon: Settings, group: "Данные" },
];

export default function Layout({ page, setPage, eventLabel, onScout, children }) {
  const title = NAV.find((n) => n.id === page)?.label || "Обзор";
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden h-screen sticky top-0 flex-col border-r border-zinc-200 bg-white p-6 lg:flex">
          <button type="button" className="mb-8 flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 rounded-lg" onClick={() => setPage("overview")} aria-label="VITE, перейти к обзору">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-black text-white" aria-hidden="true">
              <span className="text-sm font-bold leading-none">V</span>
            </span>
            <span>
              <strong className="block text-base tracking-wide text-zinc-900">VITE</strong>
              <small className="text-[12px] text-zinc-500">BioBuzz Alliance Matrix</small>
            </span>
          </button>
          
          <div className="mb-6">
            <div className="flex items-center gap-3 rounded-xl bg-zinc-100 p-3">
              <div className="h-10 w-10 rounded-full bg-zinc-300 flex items-center justify-center text-zinc-600 font-semibold">
                FT
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 truncate">FTC Team</div>
                <div className="text-xs text-zinc-500 truncate">scout@ftc-team.local</div>
              </div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1" aria-label="Основная навигация">
            {NAV.map((item, i) => {
              const Icon = item.icon;
              const showGroup = i === 0 || item.group !== NAV[i - 1].group;
              return (
                <div key={item.id}>
                  {showGroup ? <div className="mb-2 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 first:mt-0">{item.group}</div> : null}
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${page === item.id ? "bg-black text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`}
                    onClick={() => setPage(item.id)}
                    aria-current={page === item.id ? "page" : undefined}
                    aria-label={`${item.label}`}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </button>
                </div>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-zinc-200">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              onClick={() => setPage("settings")}
              aria-label="Настройки"
            >
              <Settings size={18} aria-hidden="true" />
              Настройки
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col bg-zinc-50">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-black text-sm font-bold text-white" aria-hidden="true">
                V
              </span>
              <strong className="text-base text-zinc-900">VITE</strong>
            </div>
            <div className="hidden text-sm text-zinc-500 lg:block">
              VITE / BIOBUZZ <span className="mx-2 text-zinc-300">/</span> <strong className="text-zinc-900">{title}</strong>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-zinc-500 sm:inline">Сохранено локально</span>
              <Button onClick={onScout}>+ Наблюдение</Button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:px-8">
            {children}
          </main>
          <footer className="border-t border-zinc-200 bg-white px-6 py-6 text-sm text-zinc-500 lg:px-8 pb-[6rem] lg:pb-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>
                VITE — некоммерческий инструмент для FTC-команд. Не является продуктом FIRST®. FIRST®, FTC® и связанные знаки принадлежат их правообладателям.
              </p>
              <div className="flex flex-wrap gap-4">
                <button type="button" className="text-zinc-500 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" onClick={() => setPage("legal")}>
                  Политики
                </button>
                <a className="text-zinc-500 hover:text-zinc-900" href="mailto:team@vite-matrix.local">
                  team@vite-matrix.local
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-white px-1 py-2 lg:hidden" aria-label="Мобильная навигация">
        {NAV.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${page === item.id ? "text-black bg-zinc-100" : "text-zinc-500"}`}
              onClick={() => setPage(item.id)}
              aria-label={`${item.label}`}
            >
              <Icon size={20} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="hidden">
        <Shield aria-hidden="true" />
      </div>
    </div>
  );
}
