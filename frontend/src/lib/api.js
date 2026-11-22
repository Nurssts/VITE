// Single HTTP client for the VITE backend (/api/*).
// - same-origin by default (Render serves UI + API); VITE_API_URL overrides it at build time
// - timeouts, retries for Render's cold start (502-504 / network errors)
// - identical in-flight GET requests are shared, so fast typing cannot start a request storm
// - errors are ApiError with a readable message from FastAPI's `detail`

export const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, cause, fromServer = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.cause = cause;
    this.fromServer = fromServer; // our FastAPI answered (JSON detail) — not a cold start
  }
  /** Network failure, timeout or the server (proxy) is still waking up. */
  get transient() {
    return !this.fromServer && (this.status === 0 || (this.status >= 502 && this.status <= 504));
  }
}

const inflight = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(url, { method = "GET", body, timeout }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(API_BASE + url, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data && (typeof data.detail === "string" ? data.detail : data.error);
      throw new ApiError(detail || `HTTP ${res.status}`, { status: res.status, fromServer: Boolean(detail) });
    }
    return data ?? {};
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const msg = err?.name === "AbortError" ? "timeout" : err?.message || "network error";
    throw new ApiError(msg, { status: 0, cause: err });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request JSON from the backend.
 * @param {string} url path starting with /api/
 * @param {{method?: string, body?: any, timeout?: number, retries?: number}} [opts]
 */
export async function request(url, opts = {}) {
  const { retries = 2, timeout = 25000 } = opts;
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      return await once(url, { ...opts, timeout });
    } catch (err) {
      last = err;
      if (!err.transient || i === retries) break;
      await sleep(2500 * (i + 1));
    }
  }
  throw last;
}

/** GET with in-flight de-duplication. */
export function getJson(url, opts) {
  if (inflight.has(url)) return inflight.get(url);
  const p = request(url, opts).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

const enc = encodeURIComponent;

export const api = {
  health: () => getJson("/api/health", { retries: 1 }),
  events: (season) => getJson(`/api/ftcscout/events?season=${enc(season)}`),
  eventTeamsScout: (season, code) => getJson(`/api/ftcscout/event/${enc(code)}/teams?season=${enc(season)}`),
  eventMatches: (season, code) => getJson(`/api/ftcscout/event/${enc(code)}/matches?season=${enc(season)}`),
  rankings: (season, take = 50) => getJson(`/api/ftcscout/rankings?season=${enc(season)}&take=${take}`),
  firstEvents: (season) => getJson(`/api/ftc/events?season=${enc(season)}`, { retries: 1 }),
  firstTeams: (season, code) => getJson(`/api/ftc/teams?season=${enc(season)}&event_code=${enc(code)}`, { retries: 1 }),
  firstMatches: (season, code) => getJson(`/api/ftc/matches?season=${enc(season)}&event_code=${enc(code)}&tournament_level=qual`, { retries: 1 }),
  toaMatches: (key) => getJson(`/api/toa/event/${enc(key)}/matches`, { retries: 1 }),
};
