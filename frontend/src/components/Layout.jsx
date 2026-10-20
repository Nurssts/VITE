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
    <div className="min-h-screen bg-black text-white">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden h-screen sticky top-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4 lg:flex">
          <button type="button" className="mb-6 flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 rounded-lg" onClick={() => setPage("overview")} aria-label="VITE, перейти к обзору">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black" aria-hidden="true">
              <span className="text-xs font-bold leading-none">V</span>
            </span>
            <span>
              <strong className="block text-sm tracking-wide">VITE</strong>
              <small className="text-[11px] text-zinc-500">BioBuzz Alliance Matrix</small>
            </span>
          </button>
          <div className="mb-6 rounded-xl border border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Сезон 26/27</div>
            <div className="mt-1 text-sm font-semibold">BIOBUZZ</div>
            <div className="truncate text-[11px] text-zinc-500">{eventLabel}</div>
          </div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Основная навигация">
            {NAV.map((item, i) => {
              const Icon = item.icon;
              const showGroup = i === 0 || item.group !== NAV[i - 1].group;
              return (
                <div key={item.id}>
                  {showGroup ? <div className="mb-1 mt-3 px-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600 first:mt-0">{item.group}</div> : null}
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${page === item.id ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
                    onClick={() => setPage(item.id)}
                    aria-current={page === item.id ? "page" : undefined}
                    aria-label={`${item.label}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </button>
                </div>
              );
            })}
          </nav>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
            Локальный режим · без трекеров
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-800 bg-black/90 px-4 backdrop-blur lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xs font-bold text-black" aria-hidden="true">
                V
              </span>
              <strong className="text-sm">VITE</strong>
            </div>
            <div className="hidden text-[11px] text-zinc-500 lg:block">
              VITE / BIOBUZZ <span className="mx-2 text-zinc-700">/</span> <strong className="text-white">{title}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-zinc-500 sm:inline">Сохранено локально</span>
              <Button onClick={onScout}>+ Наблюдение</Button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">
            {children}
          </main>
          <footer className="border-t border-zinc-800 px-4 py-4 text-[11px] text-zinc-500 lg:px-8 pb-[5.5rem] lg:pb-4">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                VITE — некоммерческий инструмент для FTC-команд. Не является продуктом FIRST®. FIRST®, FTC® и связанные знаки принадлежат их правообладателям.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" onClick={() => setPage("legal")}>
                  Политики
                </button>
                <a className="underline-offset-2 hover:underline" href="mailto:team@vite-matrix.local">
                  team@vite-matrix.local
                </a>
                <span>Контакт организации: FTC-команда, пит-зона / судьи</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-800 bg-black px-1 py-1 lg:hidden" aria-label="Мобильная навигация">
        {NAV.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] ${page === item.id ? "text-white" : "text-zinc-500"}`}
              onClick={() => setPage(item.id)}
              aria-label={`${item.label}`}
            >
              <Icon size={16} aria-hidden="true" />
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
