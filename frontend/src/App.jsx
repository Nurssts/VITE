import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Layout, { NAV } from "./components/Layout";
import { FeedbackHost, toast } from "./components/feedback";
import { PageSkeleton } from "./components/ui";
import ErrorBoundary from "./components/ErrorBoundary";
import ProfileModal from "./components/ProfileModal";
import { AgeGate, CookieBanner } from "./app/Consent";
import { EventSelect, LangSelect } from "./app/Onboarding";
import { useRoute } from "./app/router";
import { useAppState } from "./app/useAppState";
import { applyEvent } from "./lib/db";
import { tr } from "./lib/i18n";
import { aiStore } from "./lib/ai/memory";
import { useScheduleSync } from "./lib/scheduleSync";

// Each screen is its own chunk: the first paint does not wait for charts or the simulator.
const pages = {
  overview: lazy(() => import("./pages/Overview")),
  ai: lazy(() => import("./pages/Strategist")),
  scouting: lazy(() => import("./pages/Scouting")),
  matches: lazy(() => import("./pages/Matches")),
  teams: lazy(() => import("./pages/Teams")),
  analysis: lazy(() => import("./pages/Analysis")),
  draft: lazy(() => import("./pages/Draft")),
  notebook: lazy(() => import("./pages/Notebook")),
  data: lazy(() => import("./pages/Data")),
  settings: lazy(() => import("./pages/Settings")),
  legal: lazy(() => import("./pages/Legal")),
};

function isTyping(el) {
  return el?.closest?.("input, textarea, select, [contenteditable='true']");
}

export default function App() {
  const state = useAppState();
  const { prefs, setPrefs, lang, db, setDb, allowStorage, saveState } = state;
  const [route, go] = useRoute();
  const page = route.page;
  const [profileOpen, setProfileOpen] = useState(false);

  // AI chats and memory follow the same storage consent as scouting data.
  useEffect(() => aiStore.setPersist(allowStorage), [allowStorage]);

  // Official schedule and results load and refresh by themselves (no "Load" button needed).
  useScheduleSync(db, setDb, Boolean(prefs.event?.set));

  // Number keys switch sections (not while typing, with modifiers or inside a dialog).
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector("[aria-modal='true']")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= NAV.length) go(NAV[n - 1].id);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go]);

  const Page = pages[page] || pages.overview;
  const openProfile = () => setProfileOpen(true);
  const ctx = useMemo(() => ({ db, setDb, lang, go, route, prefs, setPrefs, saveState, allowStorage, openProfile }), [db, setDb, lang, go, route, prefs, setPrefs, saveState, allowStorage]);
  const myTeam = db.teams.find((t) => t.number === prefs.myTeam);
  const profile = { team: prefs.myTeam || "", teamName: myTeam?.name || "", role: prefs.myRole || "", name: prefs.displayName || "" };

  if (!prefs.lang) {
    return (
      <>
        <LangSelect last={prefs.lastLang} onSelect={(code) => setPrefs((p) => ({ ...p, lang: code }))} />
        <FeedbackHost />
      </>
    );
  }

  if (!prefs.event?.set) {
    return (
      <>
        <EventSelect
          last={prefs.lastEvent}
          onCancel={prefs.event?.changing ? () => setPrefs((p) => ({ ...p, event: { ...p.event, set: true, changing: false } })) : undefined}
          onDemo={() => {
            setPrefs((p) => ({ ...p, event: { set: true, year: "2026", eventCode: db.meta.eventCode, eventName: db.meta.eventName } }));
          }}
          onSelect={({ year, eventCode, eventName, teams }) => {
            setPrefs((p) => ({ ...p, event: { set: true, year, eventCode, eventName } }));
            setDb((d) => applyEvent(d, { season: year, eventCode, eventName, teams }));
            toast(teams.length ? `${tr("Загружено команд")}: ${teams.length}` : tr("Ивент выбран. Добавьте команды вручную."));
            go("overview");
          }}
        />
        <FeedbackHost />
      </>
    );
  }

  return (
    <>
      <Layout
        page={page}
        go={go}
        lang={lang}
        event={{ name: db.meta.eventName, code: db.meta.eventCode }}
        onEvent={() => setPrefs((p) => ({ ...p, event: { ...p.event, set: false, changing: true } }))}
        onScout={() => go("scouting")}
        saveState={saveState}
        allowStorage={allowStorage}
        profile={profile}
        onProfile={openProfile}
      >
        <ErrorBoundary key={page} lang={lang}>
          <Suspense fallback={<PageSkeleton />}>
            <Page {...ctx} />
          </Suspense>
        </ErrorBoundary>
      </Layout>

      {!prefs.cookie.decided ? (
        <CookieBanner
          lang={lang}
          onMore={() => go("legal")}
          onDecide={(storage) => setPrefs((p) => ({ ...p, cookie: { decided: true, storage, shownAt: new Date().toISOString() } }))}
        />
      ) : null}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} prefs={prefs} setPrefs={setPrefs} teams={db.teams} />

      {!prefs.age.confirmed ? <AgeGate lang={lang} onConfirm={(age) => setPrefs((p) => ({ ...p, age }))} /> : null}

      <FeedbackHost />
    </>
  );
}
