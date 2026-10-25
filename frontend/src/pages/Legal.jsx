import { useState } from "react";
import { Panel } from "../components/ui";

const SECTIONS = [
  { id: "privacy", title: "Политика конфиденциальности" },
  { id: "terms", title: "Условия использования" },
  { id: "refund", title: "Политика возврата" },
  { id: "cookies", title: "Cookie Policy" },
  { id: "sdk", title: "Сторонние API и SDK" },
];

export default function Legal() {
  const [tab, setTab] = useState("privacy");
  return (
    <div>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-[2rem]">Правовая информация</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Короткие, проверяемые формулировки. Нет скрытых согласий и заранее отмеченных галочек.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setTab(s.id)} className={`rounded-full border px-3 py-1 text-xs ${tab === s.id ? "border-honey-400 bg-honey-400 font-semibold text-ink" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`} aria-label={`Показать ${s.title}`}>
            {s.title}
          </button>
        ))}
      </div>
      {tab === "privacy" ? (
        <Panel className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Политика конфиденциальности</h2>
          <p>VITE хранит скаутские записи в браузере (localStorage и IndexedDB) на вашем устройстве. Мы не передаём их на сторонние аналитические сервисы.</p>
          <p>Если вы запускаете локальный Python-сервер, запросы к FIRST Events API и The Orange Alliance идут с сервера. Ключи API не сохраняются в браузере.</p>
          <p>Не вносите ФИО, школы, фото и контакты несовершеннолетних в заметки. Для удаления всех данных используйте «Настройки → Удалить профиль и скаутинг».</p>
          <p>Контакт по данным: team@vite-matrix.local. Запрос на удаление выполняется мгновенно на устройстве; облачного аккаунта нет.</p>
        </Panel>
      ) : null}
      {tab === "terms" ? (
        <Panel className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Условия использования</h2>
          <p>VITE — бесплатный некоммерческий инструмент для команд FTC. Это не продукт FIRST. Симуляции и индексы — оценки по вашему скаутингу, а не официальный прогноз.</p>
          <p>Запрещено использовать приложение для мошенничества на турнире, публикации персональных данных учеников и коммерческой перепродажи данных FIRST/TOA.</p>
          <p>Программное обеспечение предоставляется «как есть». Вы сами отвечаете за решения капитана на арене.</p>
        </Panel>
      ) : null}
      {tab === "refund" ? (
        <Panel className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Политика возврата средств</h2>
          <p>Сейчас VITE не продаёт подписки, мерч и не принимает платежи внутри приложения. Скрытых комиссий нет, платёжных экранов нет.</p>
          <p>Если команда позже примет добровольное спонсорство или продаст мерч вне этой платформы, возврат будет описан в конкретном чеке/договоре. Для цифрового инструмента плата не взимается — возвращать нечего.</p>
        </Panel>
      ) : null}
      {tab === "cookies" ? (
        <Panel className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Cookie Policy</h2>
          <p>Рекламных и аналитических cookie нет. Баннер спрашивает разрешение на локальное хранение скаутинга. Отказ оставляет интерфейс рабочим на учебном наборе в памяти сессии, без записи в хранилище.</p>
          <p>Технически используются localStorage/IndexedDB, а не сторонние cookie-трекеры. Настройки можно изменить в любой момент.</p>
        </Panel>
      ) : null}
      {tab === "sdk" ? (
        <Panel className="space-y-3 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Прозрачность SDK</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>FIRST FTC Events API — официальные ивенты, команды, результаты. Ключи только на сервере. Условия: ftc-events.firstinspires.org.</li>
            <li>The Orange Alliance API — опциональный импорт матчей. Ключ TOA_API_KEY только на сервере.</li>
            <li>Inter (SIL Open Font License) — шрифт интерфейса.</li>
            <li>Lucide Icons (ISC) — векторные иконки.</li>
            <li>Не используются: Google Analytics, рекламные SDK, платёжные SDK, session replay.</li>
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
