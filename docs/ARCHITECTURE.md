# VITE · архитектура (v2.1)

VITE — офлайн-инструмент скаутинга FTC сезона BIOBUZZ 2026–2027. Один сервис на Render:
FastAPI отдаёт собранный фронтенд и проксирует публичные API. Вся математика — в браузере.

```
Браузер (React SPA, offline-first)                    Сервер (FastAPI, server.py)
┌──────────────────────────────────────────┐          ┌───────────────────────────────┐
│ app/useAppState  ── prefs, db, сохранение│          │ /api/health, /api/sdk         │
│ app/router       ── #/page/param?query   │  fetch   │ /api/ftcscout/*  (без ключа)  │──► api.ftcscout.org (GraphQL, TTL-кэш)
│ pages/* (lazy)   ── экраны               │ ───────► │ /api/ftc/*       (FIRST, ключ)│──► ftc-api.firstinspires.org
│ lib/model.js     ── вся математика       │  /api/*  │ /api/toa/*       (TOA, ключ)  │──► theorangealliance.org
│ lib/db.js        ── схема и операции     │          │ /api/gemini/*    (AI, ключ)   │──► Google Gemini
│ lib/store.js     ── localStorage + IDB   │          │ StaticFiles(frontend/dist)    │
│ lib/api.js       ── HTTP-клиент          │          └───────────────────────────────┘
└──────────────────────────────────────────┘
```

## Принципы

1. **Единый движок математики** — `frontend/src/lib/model.js`. Python не считает ничего.
2. **Данные скаутинга не покидают устройство** без явного экспорта. Ключи API — только в окружении сервера.
3. **Неизменяемые данные.** Все операции в `lib/db.js` возвращают новый объект `db`. Благодаря этому
   `model.js` кэширует статистику по ссылке на `db.records` (WeakMap) — расчёт страницы драфта для
   60 команд × 10 матчей ускорился с ~80 мс до ~3 мс.
4. **Всё входящее валидируется.** JSON-копии, CSV и файлы других скаутов проходят через
   `migrateDb` / `normalizeRecord`: типы приводятся, значения ограничиваются, мусор отбрасывается.
5. **Сезон = год начала** (2026 = BIOBUZZ 2026–2027) во всём коде: фронтенд, сервер, FIRST, FTCScout.

## Фронтенд

| Модуль | Ответственность |
|---|---|
| `src/App.jsx` | Композиция: онбординг → layout → ленивые страницы, горячие клавиши 1–9 |
| `src/app/useAppState.js` | prefs + db, функциональные обновления, сохранение, восстановление из IndexedDB |
| `src/app/router.js` | Hash-роутер: кнопка «Назад», перезагрузка сохраняет экран, ссылки на профили |
| `src/app/Onboarding.jsx` | Выбор языка и турнира (поиск с клавиатурой, «продолжить с прошлым») |
| `src/components/ui.jsx` | Дизайн-система (монохром): Button, Panel, Stepper, Modal, SplitBar… |
| `src/components/feedback.jsx` | Глобальные `toast()` (с «Отменить») и `confirmDialog()` |
| `src/lib/db.js` | Схема v3, миграция, add/update/delete, merge без дублей, CSV-импорт, расписание |
| `src/lib/model.js` | Оценка вклада, синергия, Монте-Карло, denial pick, OPR, прогноз матча, калибровка |
| `src/lib/api.js` | Таймауты, ретраи при «засыпании» Render, дедупликация одинаковых запросов |
| `src/lib/csv.js` | Парсер/экспорт CSV, защита от формул (`=`, `+`, `-`, `@`) |
| `src/lib/store.js` | localStorage (основная копия) + IndexedDB (резерв), квоты, `navigator.storage.persist` |

### Схема данных (db v3)

```js
{
  version: 3,
  meta: { demo, eventName, eventCode, season: "2026-2027", updatedAt },
  teams:   [{ id, number, name, region, style, notes }],
  records: [{ id, teamId, eventCode, matchNo, date, ...счётчики, autoLeave, autoPark, teleopPark,
              disabled, confidence, scout, notes, autoTrajectory, createdAt, updatedAt }],
  draft:   { captain, picked: [id], removed: [id] },
  schedule: { eventCode, season, fetchedAt, matches: [{ level, number, series, time, played,
              red: [num], blue: [num], redScore, blueScore, redScoreNp, blueScoreNp }] } | null
}
```

v2-базы обновляются автоматически при загрузке (`migrateDb`).

### Официальные результаты и OPR

`computeOpr(matches)` — МНК-разложение официальных счетов альянсов (без штрафов) по роботам с
небольшой ridge-регуляризацией (устойчиво в начале турнира). `predictMatch` даёт две независимые
оценки: по скаутингу (сумма оценок вклада, σ с учётом неопределённости) и по OPR.
`calibration` честно проверяет модель скаутинга: каждый сыгранный матч прогнозируется только по
записям **предыдущих** матчей; выводятся точность и Brier score.

## Бэкенд

* `engine/ftcscout.py` — один `httpx.AsyncClient`, TTL-кэш (события 15 мин, составы 5 мин,
  расписание 60 с), общий запрос для параллельных вызовов, понятные ошибки `FTCScoutError`.
* `server.py` — валидация параметров, заголовки безопасности (CSP, nosniff, DENY, no-referrer),
  gzip, `immutable`-кэш для `/assets/*`, JSON-404 для неизвестных `/api/*`.
* AI (`engine/gemini.py`, SDK `google-genai`): pydantic-валидация тела, лимит 10/мин на IP
  и дневной бюджет `AI_DAILY_LIMIT` (по умолчанию 200), ошибки SDK не утекают клиенту.

## Переменные окружения (только сервер)

| Переменная | Назначение |
|---|---|
| `FTC_API_USERNAME`, `FTC_API_TOKEN` | FIRST Events API (необязательно) |
| `TOA_API_KEY` | The Orange Alliance (необязательно) |
| `GOOGLE_API_KEY`, `AI_ENABLED`, `GEMINI_MODEL`, `AI_DAILY_LIMIT` | Gemini (необязательно) |
| `CORS_ORIGINS` | Доп. источники, если фронтенд размещён отдельно |
| `LOG_LEVEL` | Уровень логов (INFO) |

## Проверки

```powershell
cd frontend; npm run check        # eslint + vitest + vite build
py -3 -m pip install -r requirements-dev.txt; py -3 -m pytest -q
```

CI (`.github/workflows/test.yml`) запускает то же самое на каждый push/PR в `main`.

## VITE AI Engine (v3.0)

```
Браузер                                         Сервер (FastAPI)              Провайдер
pages/Strategist.jsx  диалог, шаги, апрув  <-SSE->  engine/ai/routes.py   --->  Anthropic (SDK)
lib/ai/agent.js       цикл агента          /api/ai  service.py: цепочка,       Gemini / OpenAI /
lib/ai/tools.js       16 инструментов       /chat    ретраи, fallback,          DeepSeek / Qwen /
  над model.js + db.js (данные на устройстве) /extract бюджеты, учёт токенов   Groq / Ollama
lib/ai/memory.js      чаты, память, отзывы  /status  prompts.py, tools.py      (OpenAI-совместимые)
```

**Почему инструменты выполняются в браузере.** Данные скаутинга живут только на устройстве.
Сервер — stateless-шлюз к модели (ключи только там), а цикл агента, инструменты и подтверждения
работают рядом с данными. Модель видит лишь то, что вернули её вызовы инструментов, и не
получает базу целиком. Сервер ничего не хранит, поэтому данные разных пользователей изолированы
по устройству.

**Цикл агента** (`lib/ai/agent.js`): сообщение пользователя → ход модели (стриминг SSE) →
вызовы инструментов. Инструменты типа `read` и `assist` выполняются сразу, `action` — только
после подтверждения в карточке. Результаты отправляются обратно, цикл повторяется до текстового
ответа, максимум 8 шагов. Ход можно остановить; ошибка провайдера показывается с кнопкой
«Повторить» и не ломает остальной VITE.

**Инструменты** (`engine/ai/tools.py` объявляет, `lib/ai/tools.js` исполняет):

| Тип | Инструменты |
|---|---|
| read | `get_event_overview`, `get_rankings`, `get_team`, `compare_alliance`, `simulate_match`, `get_schedule`, `find_best_partners`, `get_scouting_gaps`, `find_anomalies`, `search_records` |
| assist | `remember`, `open_page` |
| action (с подтверждением) | `set_draft`, `mark_teams_picked`, `save_team_note`, `add_observation` |

**Миссии** (`prompts.py → MISSIONS`): брифинг перед матчем, пик-лист, план скаутинга, разбор
команды, проверка качества данных. Запускаются из Strategist и с экранов «Матчи», «Команды»,
«Драфт», «Обзор» (`#/ai?mission=...&target=...`).

**Scribe** (`/api/ai/extract`, `components/Dictation.jsx`): голос или текст про одного робота
превращается в JSON-черновик, тот через `draftToForm` заполняет форму скаутинга. Ничего не
сохраняется без скаута.

**Провайдеры.** Два адаптера:
- `AnthropicProvider` — официальный SDK `anthropic`: стриминг, tool use, effort; блоки thinking
  возвращаются без изменений через поле `raw`;
- `OpenAICompatProvider` — Gemini через его OpenAI-совместимый endpoint, а также OpenAI,
  DeepSeek, Qwen, Groq, OpenRouter и Ollama. Сохраняет `extra_content` (thought signatures
  Gemini) и вырезает `<think>…</think>` у открытых моделей.

Порядок задаёт `AI_PROVIDERS`. При ошибке до начала вывода — один повтор, затем переход к
следующему провайдеру. Ошибка ключа выводит провайдера из ротации на 10 минут.

**Расходы и защита.**
- Лимит 40 запросов/мин на IP для `/chat`, 20/мин для `/extract`.
- Дневной бюджет ходов (`AI_DAILY_LIMIT`) и токенов (`AI_DAILY_TOKEN_LIMIT`).
- Лимит длины ответа и таймаут на ход.
- Pydantic-валидация истории: роли, неизвестные инструменты, размеры (300K символов на диалог,
  16K на результат инструмента).
- Системный промпт формируется на сервере; контекст и память клиента вставляются как данные.
- Ответы модели рендерятся безопасным `Markdown.jsx` без HTML.
- Согласие пользователя (`prefs.aiConsent`) и переключатель «AI читает заметки» (`prefs.aiShareNotes`).
- `AI_ENABLED=false` выключает AI полностью; остальной VITE работает без изменений.
