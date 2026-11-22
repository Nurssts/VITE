import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Brain, Check, ChevronRight, Copy, Loader2, Mic, MicOff, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, Wrench, X } from "lucide-react";
import Markdown from "../components/Markdown";
import { Badge, Button, EmptyState, IconButton, PageHeader, Panel } from "../components/ui";
import { confirmDialog, toast } from "../components/feedback";
import { aiStatus } from "../lib/ai/client";
import { runAgent } from "../lib/ai/agent";
import { aiStore } from "../lib/ai/memory";
import { createToolbox, TOOL_KINDS } from "../lib/ai/tools";
import { summarizeTool } from "../lib/ai/summaries";
import { breakdown } from "../lib/model";
import { useSpeech } from "../lib/ai/speech";
import { getLang, tr } from "../lib/i18n";

// Human-readable description of what a tool call does (shown in the activity timeline).
export function toolLabel(name, args = {}) {
  const t = args.team || args.captain || "";
  const L = {
    get_event_overview: tr("Обзор ивента"),
    get_rankings: `${tr("Рейтинг команд")}${args.sort_by ? ` · ${args.sort_by}` : ""}`,
    get_team: `${tr("Профиль команды")} ${t}`,
    compare_alliance: `${tr("Синергия пары")} ${(args.teams || []).join(" + ")}`,
    simulate_match: `${tr("Симуляция")} ${(args.red || []).join("+")} vs ${(args.blue || []).join("+")}`,
    get_schedule: `${tr("Расписание")}${args.team ? ` · ${args.team}` : ""}`,
    find_best_partners: `${tr("Лучшие партнёры для")} ${t}`,
    get_scouting_gaps: tr("Пробелы в скаутинге"),
    find_anomalies: tr("Проверка качества данных"),
    search_records: `${tr("Поиск наблюдений")}${args.team ? ` · ${args.team}` : ""}${args.match ? ` · Q${args.match}` : ""}`,
    remember: tr("Запомнить факт"),
    open_page: `${tr("Открыть раздел")} ${args.page || ""}`,
    set_draft: `${tr("Доска драфта")}: ${[args.captain && `${tr("капитан")} ${args.captain}`, args.partner && `${tr("партнёр")} ${args.partner}`].filter(Boolean).join(", ")}`,
    mark_teams_picked: `${tr("Отметить «взяли»")}: ${(args.teams || []).join(", ")}`,
    save_team_note: `${tr("Заметка команде")} ${t}`,
    add_observation: `${tr("Новое наблюдение")}: ${t}${args.match ? ` · Q${args.match}` : ""}`,
  };
  return L[name] || name;
}

const TOOL_NAME_RE = new RegExp(`\`?\\b(${Object.keys(TOOL_KINDS).join("|")})\\b\`?`, "g");
/** Replace internal tool identifiers (e.g. `get_scouting_gaps`) with readable labels. */
export function humanizeToolNames(text) {
  return String(text).replace(TOOL_NAME_RE, (_, name) => `«${toolLabel(name).trim()}»`);
}

function ActionPreview({ call }) {
  const a = call.args || {};
  if (call.name === "add_observation") {
    const pts = breakdown({ ...a }).total;
    const rows = Object.entries(a).filter(([k, v]) => !["team", "match"].includes(k) && v !== 0 && v !== false && v !== "");
    return (
      <div className="text-xs text-zinc-300">
        <div className="mb-1">
          {tr("Команда")} <strong className="num text-white">{a.team}</strong>
          {a.match ? <> · Q{a.match}</> : null} · <span className="num">{pts}</span> {tr("очк.")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rows.map(([k, v]) => (
            <Badge key={k}>
              {k}: {String(v)}
            </Badge>
          ))}
        </div>
      </div>
    );
  }
  if (call.name === "save_team_note") return <p className="whitespace-pre-wrap text-xs text-zinc-300">“{a.note}”</p>;
  if (call.name === "remember") return <p className="whitespace-pre-wrap text-xs text-zinc-300">“{a.fact}”</p>;
  return null;
}

function ToolRow({ call, result, pending }) {
  const status = pending ? "running" : result?.status || "done";
  const summary = pending ? "" : summarizeTool(call.name, result);
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-zinc-900 bg-black/40 px-3 py-2 text-xs">
      <span className="mt-0.5 shrink-0 text-zinc-400">
        {status === "running" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : status === "error" || status === "declined" ? <X size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-zinc-300">{toolLabel(call.name, call.args)}</span>
        {summary ? <span className="mt-0.5 block text-zinc-500">{summary}</span> : null}
      </span>
      {result?.kind === "action" ? <Badge tone="outline">{status === "declined" ? tr("отклонено") : tr("действие")}</Badge> : null}
    </div>
  );
}

function Message({ m, results, threadId, index, feedback, onCopy }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-sm text-black">{m.display || m.text}</div>
      </div>
    );
  }
  if (m.note === "step-limit") return <p className="text-xs text-zinc-500">{tr("Агент остановился на лимите шагов. Уточните задачу или продолжите.")}</p>;
  const key = `${threadId}:${index}`;
  const fb = feedback[key];
  return (
    <div className="min-w-0 space-y-2">
      {m.toolCalls?.length ? (
        <div className="grid min-w-0 gap-1.5">
          {m.toolCalls.map((c) => (
            <ToolRow key={c.id} call={c} result={results?.get(c.id)} pending={!results?.has(c.id)} />
          ))}
        </div>
      ) : null}
      {m.text ? <Markdown text={humanizeToolNames(m.text)} /> : m.streaming && !m.toolCalls?.length ? <TypingDots /> : null}
      {m.stop === "refusal" ? <p className="text-xs text-zinc-500">{tr("Модель отказалась отвечать на этот запрос.")}</p> : null}
      {m.stop === "max_tokens" ? <p className="text-xs text-zinc-500">{tr("Ответ обрезан по лимиту длины.")}</p> : null}
      {!m.streaming && m.text ? (
        <div className="flex items-center gap-1 text-zinc-600">
          <IconButton label={tr("Копировать")} className="h-7 w-7" onClick={() => onCopy(m.text)}>
            <Copy size={13} aria-hidden="true" />
          </IconButton>
          <IconButton label={tr("Полезно")} className={`h-7 w-7 ${fb === "up" ? "text-white" : ""}`} onClick={() => aiStore.setFeedback(key, fb === "up" ? null : "up")}>
            <ThumbsUp size={13} aria-hidden="true" />
          </IconButton>
          <IconButton label={tr("Неточно")} className={`h-7 w-7 ${fb === "down" ? "text-white" : ""}`} onClick={() => aiStore.setFeedback(key, fb === "down" ? null : "down")}>
            <ThumbsDown size={13} aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-2" aria-label={tr("Думает")}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

function missionTarget(id, db, prefs, target) {
  if (target) return id === "prematch" && /^\d+$/.test(target) ? `qualification match Q${target}` : target;
  const cap = db.teams.find((t) => t.id === db.draft?.captain)?.number;
  if (id === "picklist") return cap || prefs.myTeam || "our team";
  if (id === "prematch") return prefs.myTeam ? `team ${prefs.myTeam}'s next match` : "our team's next match";
  if (id === "team") return prefs.myTeam || "";
  return "";
}

export default function Strategist({ db, setDb, lang, go, route, prefs, setPrefs }) {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const store = useSyncExternalStore(aiStore.subscribe, aiStore.get);
  const [activeId, setActiveId] = useState(() => store.threads[0]?.id || null);
  const [live, setLive] = useState(null); // messages of the running turn (not yet persisted)
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [input, setInput] = useState("");
  const [newMemory, setNewMemory] = useState("");
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const dbRef = useRef(db);
  const prefsRef = useRef(prefs);
  dbRef.current = db;
  prefsRef.current = prefs;

  useEffect(() => {
    aiStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e.message));
  }, []);

  const thread = store.threads.find((t) => t.id === activeId) || null;
  const messages = useMemo(() => live || thread?.messages || [], [live, thread]);
  const running = Boolean(phase && phase.phase !== "done");

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.text?.length, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const toolbox = useMemo(
    () =>
      createToolbox({
        getDb: () => dbRef.current,
        setDb: (fn) => {
          dbRef.current = fn(dbRef.current); // later tools in the same turn see the change
          setDb(dbRef.current);
        },
        getPrefs: () => prefsRef.current,
        go,
        memory: { add: (text) => aiStore.addMemory(text) },
      }),
    [setDb, go]
  );

  const context = useCallback(() => {
    const d = dbRef.current;
    return {
      screen: "VITE Strategist",
      today: new Date().toISOString().slice(0, 10),
      event: d.meta.eventName,
      eventCode: d.meta.eventCode,
      season: d.meta.season,
      demoData: Boolean(d.meta.demo),
      teams: d.teams.length,
      observations: d.records.length,
      officialScheduleLoaded: Boolean(d.schedule),
      myTeam: prefsRef.current.myTeam || null,
      myRole: prefsRef.current.myRole || null,
      scoutNotesShared: prefsRef.current.aiShareNotes !== false,
    };
  }, []);

  async function run(threadId, convo) {
    setError(null);
    setLive(convo);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { usage } = await runAgent({
        messages: convo,
        toolbox,
        signal: ctrl.signal,
        request: { context: context(), memory: aiStore.get().memory.map((m) => m.text), lang: getLang() },
        onMessages: (msgs) => {
          setLive(msgs);
          const last = msgs[msgs.length - 1];
          if (!last.streaming) aiStore.updateThread(threadId, { messages: msgs });
        },
        onStatus: setPhase,
        confirm: (call) =>
          new Promise((resolve) => {
            setPending({ call, resolve });
          }),
      });
      setPhase({ phase: "done", usage });
      aiStatus().then(setStatus, () => {}); // refresh today's usage counters
    } catch (err) {
      if (err?.name === "AbortError") setPhase({ phase: "done", stopped: true });
      else {
        setError(err.message || String(err));
        setPhase(null);
      }
    } finally {
      abortRef.current = null;
      setPending(null);
      setLive((cur) => {
        if (cur) {
          const clean = cur.filter((m) => !(m.role === "assistant" && m.streaming && !m.text && !m.toolCalls?.length));
          aiStore.updateThread(threadId, { messages: clean.map((m) => ({ ...m, streaming: false })) });
        }
        return null;
      });
    }
  }

  function send(text, display) {
    const clean = String(text || "").trim();
    if (!clean || running) return;
    let t = thread;
    if (!t) {
      t = aiStore.newThread(display || clean);
      setActiveId(t.id);
    }
    const convo = [...(t.messages || []), { role: "user", text: clean, display: display || undefined, ts: Date.now() }];
    aiStore.updateThread(t.id, { messages: convo, title: t.title || (display || clean).slice(0, 80) });
    setInput("");
    run(t.id, convo);
  }

  function startMission(m, target) {
    if (running) return;
    const tgt = missionTarget(m.id, dbRef.current, prefsRef.current, target);
    const title = `${getLang() === "en" ? m.title_en : m.title_ru}${target ? ` · ${target}` : ""}`;
    const t = aiStore.newThread(title);
    setActiveId(t.id);
    const langLine = getLang() === "en" ? "Answer in English." : "Отвечай на русском языке.";
    const convo = [{ role: "user", text: `${m.prompt.replaceAll("{target}", tgt || "our team")}
${langLine}`, display: title, ts: Date.now() }];
    aiStore.updateThread(t.id, { messages: convo });
    run(t.id, convo);
  }

  function retry() {
    if (!thread || running) return;
    const msgs = [...thread.messages];
    while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    if (!msgs.length) return;
    aiStore.updateThread(thread.id, { messages: msgs });
    run(thread.id, msgs);
  }

  // Missions launched from other screens: #/ai?mission=picklist&target=23334
  const launched = useRef("");
  useEffect(() => {
    const { mission, target } = route.query || {};
    const key = `${mission}|${target}`;
    if (!mission || !status?.configured || launched.current === key) return;
    const m = status.missions.find((x) => x.id === mission);
    if (!m) return;
    launched.current = key;
    go("ai");
    startMission(m, target);
  }, [route.query, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const speech = useSpeech((text) => setInput((v) => (v ? `${v} ${text}` : text)));

  const results = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => m.role === "tool" && m.results.forEach((r) => map.set(r.id, r)));
    return map;
  }, [messages]);

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast(tr("Скопировано.")), () => toast(tr("Не удалось скопировать."), { error: true }));
  const missions = status?.missions || [];

  const header = (
    <PageHeader
      title="VITE Strategist"
      subtitle={tr("AI-аналитик вашей команды: читает ваш скаутинг, расписание и модели VITE, планирует шаги, считает и предлагает действия — вы подтверждаете.")}
      actions={
        status?.configured && status?.enabled ? (
          <Badge tone="outline">
            <Sparkles size={12} aria-hidden="true" /> {status.available ? tr("AI готов") : tr("AI временно недоступен")}
          </Badge>
        ) : null
      }
    />
  );

  if (!status && !statusError) {
    return (
      <div>
        {header}
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> {tr("Проверяю AI-сервер…")}
        </p>
      </div>
    );
  }

  if (statusError || !status.enabled || !status.configured) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Brain}
          title={statusError ? tr("AI-сервер недоступен") : !status.enabled ? tr("AI выключен на сервере") : tr("AI ещё не подключён")}
          body={
            statusError
              ? `${statusError}. ${tr("Остальные функции VITE работают без AI.")}`
              : tr("AI будет доступен, когда администратор подключит его на сервере. Остальные функции VITE работают без AI.")
          }
        />
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-[60vh] min-w-0 flex-col rounded-xl border border-zinc-800/80 bg-zinc-950" aria-label={tr("Диалог")}>
          <div className="min-w-0 flex-1 space-y-5 overflow-y-auto break-words p-4 sm:p-5" aria-live="polite">
            {!messages.length ? (
              <div className="py-6">
                <p className="text-sm text-zinc-400">{tr("Выберите задачу — агент сам соберёт данные и проведёт анализ:")}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {missions.map((m) => (
                    <button key={m.id} type="button" onClick={() => startMission(m)} className="group flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                      <span>{lang === "en" ? m.title_en : m.title_ru}</span>
                      <ChevronRight size={15} className="text-zinc-600 group-hover:text-white" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-xs text-zinc-500">{tr("Или спросите своими словами, например:")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[tr("С кем нам лучше в альянс и почему?"), tr("Кто самый стабильный HIVE-робот?"), tr("Почему модель ошибалась в сыгранных матчах?")].map((q) => (
                    <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (m.role === "tool" ? null : <Message key={i} m={m} index={i} threadId={thread?.id} results={results} feedback={store.feedback} onCopy={copy} />))
            )}

            {pending ? (
              <div className="rounded-xl border border-white bg-zinc-900 p-4" role="alertdialog" aria-label={tr("Подтверждение действия")}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Wrench size={15} aria-hidden="true" />
                  {tr("AI предлагает действие")}: {toolLabel(pending.call.name, pending.call.args)}
                </div>
                <ActionPreview call={pending.call} />
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      pending.resolve(true);
                      setPending(null);
                    }}
                  >
                    {tr("Разрешить")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      pending.resolve(false);
                      setPending(null);
                    }}
                  >
                    {tr("Отклонить")}
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-zinc-600 px-4 py-3 text-sm text-zinc-200" role="alert">
                {error}
                <Button size="sm" variant="secondary" className="ml-3" onClick={retry}>
                  {tr("Повторить")}
                </Button>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-zinc-900 p-3">
            <div className="mb-2 flex min-h-[18px] items-center gap-2 text-xs text-zinc-500" role="status">
              {running ? (
                <>
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  {phase.phase === "confirm" ? tr("Жду вашего подтверждения") : phase.phase === "tool" ? `${tr("Выполняю")}: ${toolLabel(phase.tool)}` : `${tr("Анализирую")}${phase.step ? ` · ${tr("шаг")} ${phase.step + 1}` : ""}`}
                </>
              ) : phase?.usage ? (
                <span className="num">
                  {tr("Готово")} · {phase.usage.input + phase.usage.output} {tr("токенов")}
                </span>
              ) : phase?.stopped ? (
                tr("Остановлено")
              ) : null}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <textarea
                rows={1}
                value={input}
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={tr("Спросите о командах, матчах или драфте…")}
                aria-label={tr("Сообщение для AI")}
                className="max-h-40 min-h-[44px] flex-1 resize-y rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              />
              {speech.supported ? (
                <IconButton label={speech.listening ? tr("Остановить диктовку") : tr("Диктовать")} onClick={speech.toggle} className={`h-11 w-11 border border-zinc-800 ${speech.listening ? "bg-white text-black hover:bg-zinc-200 hover:text-black" : ""}`}>
                  {speech.listening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
                </IconButton>
              ) : null}
              {running ? (
                <Button className="h-11" variant="secondary" onClick={() => abortRef.current?.abort()}>
                  <Square size={14} aria-hidden="true" />
                  {tr("Стоп")}
                </Button>
              ) : (
                <Button type="submit" className="h-11" disabled={!input.trim()}>
                  <Send size={15} aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">{tr("Отправить")}</span>
                </Button>
              )}
            </form>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <Panel
            title={tr("Чаты")}
            actions={
              <IconButton label={tr("Новый чат")} onClick={() => !running && setActiveId(null)}>
                <Plus size={16} aria-hidden="true" />
              </IconButton>
            }
          >
            {store.threads.length ? (
              <ul className="-mx-2 max-h-64 space-y-0.5 overflow-y-auto">
                {store.threads.map((t) => (
                  <li key={t.id} className="group flex items-center">
                    <button type="button" disabled={running} onClick={() => setActiveId(t.id)} className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm ${t.id === activeId ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-white"}`}>
                      {t.title || tr("Без названия")}
                    </button>
                    <IconButton
                      label={tr("Удалить чат")}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={async () => {
                        if (await confirmDialog({ title: tr("Удалить чат?"), body: t.title, confirmLabel: tr("Удалить"), danger: true })) {
                          aiStore.deleteThread(t.id);
                          if (t.id === activeId) setActiveId(null);
                        }
                      }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">{tr("Пока пусто.")}</p>
            )}
          </Panel>

          <Panel title={tr("Память AI")} subtitle={tr("Факты, которые AI учитывает во всех чатах. Только на этом устройстве.")}>
            {store.memory.length ? (
              <ul className="space-y-1.5">
                {store.memory.map((m) => (
                  <li key={m.id} className="group flex items-start gap-2 text-sm text-zinc-300">
                    <span className="flex-1">{m.text}</span>
                    <IconButton label={tr("Забыть")} className="h-6 w-6 shrink-0" onClick={() => aiStore.deleteMemory(m.id)}>
                      <X size={12} aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">{tr("AI сохранит сюда важное о вашей команде — или добавьте сами.")}</p>
            )}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (aiStore.addMemory(newMemory)) setNewMemory("");
              }}
            >
              <input className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black px-3 text-sm text-zinc-100 placeholder:text-zinc-600" value={newMemory} maxLength={300} onChange={(e) => setNewMemory(e.target.value)} placeholder={tr("Напр.: наш робот слаб во FLOWER")} aria-label={tr("Новый факт")} />
              <Button size="sm" type="submit" variant="secondary" disabled={!newMemory.trim()}>
                {tr("Добавить")}
              </Button>
            </form>
          </Panel>

          <Panel title={tr("Приватность и расход")}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-300">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-white" checked={prefs.aiShareNotes !== false} onChange={(e) => setPrefs((p) => ({ ...p, aiShareNotes: e.target.checked }))} />
              {tr("Разрешить AI читать заметки скаутов")}
            </label>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-zinc-500">{tr("Запросов сегодня")}</dt>
                <dd className="num text-zinc-200">
                  {status.usage.turns} / {status.usage.limitTurns}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">{tr("Токенов сегодня")}</dt>
                <dd className="num text-zinc-200">{(status.usage.inputTokens + status.usage.outputTokens).toLocaleString()}</dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
