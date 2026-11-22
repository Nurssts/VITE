// HTTP client of the VITE AI Engine (server: engine/ai/routes.py).
import { API_BASE, ApiError, getJson, request } from "../api";

export function aiStatus() {
  return getJson("/api/ai/status", { retries: 1, timeout: 15000 });
}

/** Scribe: dictation / free text about one robot -> structured draft. */
export function extractScouting(body) {
  return request("/api/ai/extract", { method: "POST", body, retries: 0, timeout: 120000 });
}

/**
 * One Strategist turn over Server-Sent Events.
 * Calls onEvent for every event: start | text | tool_call | done | error.
 * Resolves when the stream ends; rejects with ApiError on HTTP errors or AbortError on stop.
 */
export async function streamChat(body, { onEvent, signal } = {}) {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    const detail = typeof data?.detail === "string" ? data.detail : Array.isArray(data?.detail) ? data.detail[0]?.msg : "";
    throw new ApiError(detail || `HTTP ${res.status}`, { status: res.status, fromServer: Boolean(detail) });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          onEvent?.(JSON.parse(line.slice(5).trim()));
        } catch {
          /* ignore a malformed event */
        }
      }
    }
  }
}
