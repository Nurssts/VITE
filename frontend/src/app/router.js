// Minimal hash router: #/teams/16461?x=1. Back button and reloads keep the current screen,
// and links can be shared between scouts on the same device without a server-side router.
import { useCallback, useEffect, useState } from "react";

export const PAGES = ["overview", "ai", "scouting", "matches", "teams", "analysis", "draft", "notebook", "data", "settings", "legal"];

export function parseHash(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  const [path, qs = ""] = raw.split("?");
  const [page, param = ""] = path.split("/").map((x) => decodeURIComponent(x || ""));
  return {
    page: PAGES.includes(page) ? page : "overview",
    param,
    query: Object.fromEntries(new URLSearchParams(qs)),
  };
}

export function buildHash(page, param = "", query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return `#/${page}${param ? `/${encodeURIComponent(param)}` : ""}${qs ? `?${qs}` : ""}`;
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(typeof location !== "undefined" ? location.hash : ""));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(location.hash));
      document.getElementById("main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = useCallback((page, param, query) => {
    const next = buildHash(page, param, query);
    if (location.hash !== next) location.hash = next;
  }, []);
  return [route, navigate];
}
