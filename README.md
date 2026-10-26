# VITE · BioBuzz Alliance Matrix

Интеллектуальный хаб скаутинга и драфта альянсов для сезона FTC BIOBUZZ: роли Hive / Flower, Autonomous Collision Check, Monte-Carlo и доска драфта. Интерфейс монохромный, mobile-first, без рекламы и скрытых платежей.

## Стек

- Frontend: React + Vite + Tailwind CSS + Lucide + Recharts
- Backend: FastAPI (синергия, симуляции, прокси FIRST Events API, The Orange Alliance, FTCScout.org)
- Хранение: localStorage + IndexedDB на устройстве, опционально SQLite-кэш симуляций

## Быстрый запуск

### Только интерфейс (Vite)

```powershell
cd frontend
npm install
npm run dev
```

Откройте `http://127.0.0.1:5173`. Демо-скаутинг работает без сервера.

### Полный стек (API + собранный UI)

```powershell
cd frontend
npm install
npm run build
cd ..
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Откройте `http://127.0.0.1:8000`.

## API интеграции

### FTCScout.org (бесплатно, без ключа)
- Публичный GraphQL API команд, рейтингов и матчей
- Эндпойнты: `/api/ftcscout/teams`, `/api/ftcscout/events`, `/api/ftcscout/rankings`
- Аутентификация не требуется

### FIRST Events API (опционально)
Ключи **только** в окружении процесса, не в браузере:

```powershell
$env:FTC_API_USERNAME = "ваш-логин"
$env:FTC_API_TOKEN = "ваш-токен"
```

FIRST просит ссылаться на API и запрещает коммерческое использование его данных: [регистрация](https://ftc-events.firstinspires.org/services/API/register).

### The Orange Alliance API (опционально)
```powershell
$env:TOA_API_KEY = "ключ-toa"
```
TOA: [документация](https://theorangealliance.org/apidocs).

## Модули

1. Ручной скаутинг и CSV (циклы Pollen/Nectar, Hive success, Flowers, парковка, траектория автонома).
2. Индекс синергии: покрытие профилей + комплиментарность Hive/Flower − DNF − collision.
3. Monte-Carlo ≥1000 итераций, 95% интервал, текстовые узкие места.
4. Live draft: лучший синергетический пик и denial pick.
5. Engineering Notebook: печать в системный PDF для судей.

Учебный набор из 12 команд явно помечен. Фейковых отзывов и неподтверждённых процентов нет.

## Модель и границы

Модель собрана по BIOBUZZ Competition Manual TU05 (15.10.2026). Это оценка наблюдаемого вклада робота, не официальный счёт альянса. Защита, конкуренция за элементы и решения судей моделируются не полностью.

## Деплой на бесплатный хостинг

### Рекомендуемый: Render (Frontend + Backend вместе)
1. Зарегистрируйтесь на [render.com](https://render.com)
2. Создайте Web Service → подключите GitHub репозиторий
3. Render автоматически деплоит по `render.yaml`
4. После деплоя сайт будет доступен по URL типа `https://vite-biobuzz.onrender.com`
5. Все изменения в GitHub автоматически деплоятся на Render

### Переменные окружения (опционально):
В настройках Render Service → Environment Variables:
- `FTC_API_USERNAME` - для FIRST Events API
- `FTC_API_TOKEN` - для FIRST Events API
- `TOA_API_KEY` - для The Orange Alliance API
- `GOOGLE_API_KEY` - для Gemini AI анализа матчей (получить на [AI Studio](https://makersuite.google.com/app/apikey))

### GitHub Pages (альтернатива для frontend только):
Если нужен только frontend без backend:
1. В репозитории GitHub: Settings → Pages
2. Source: GitHub Actions
3. Автоматический деплой при push в main
4. Сайт: `https://nurssts.github.io/VITE/`

## Правовое

В приложении: Privacy Policy, Terms, Refund Policy (платежей внутри продукта нет), Cookie banner без тёмных паттернов, перечень SDK, возрастное согласие 13+/наставник, удаление всех локальных данных.

## Горячие клавиши

`1`–`9` — разделы, `Tab` — фокус, `Esc` — закрыть диалоги.
