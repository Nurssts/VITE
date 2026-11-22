import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getJson, request } from "./api";

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("api client", () => {
  it("returns JSON and surfaces FastAPI detail on errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(200, { ok: 1 })).mockResolvedValueOnce(json(422, { detail: "bad season" })));
    expect(await request("/api/x")).toEqual({ ok: 1 });
    await expect(request("/api/x")).rejects.toMatchObject({ message: "bad season", status: 422 });
  });

  it("retries cold-start 502s but not server-side answers", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(json(502, null)).mockResolvedValueOnce(json(200, { ok: 2 }));
    vi.stubGlobal("fetch", fetch);
    const p = request("/api/y", { retries: 2 });
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ ok: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);

    const fetch2 = vi.fn().mockResolvedValue(json(503, { detail: "not configured" }));
    vi.stubGlobal("fetch", fetch2);
    await expect(request("/api/z", { retries: 2 })).rejects.toBeInstanceOf(ApiError);
    expect(fetch2).toHaveBeenCalledTimes(1);
  });

  it("shares identical in-flight GET requests", async () => {
    let resolve;
    const fetch = vi.fn(() => new Promise((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetch);
    const a = getJson("/api/events");
    const b = getJson("/api/events");
    resolve(json(200, { events: [] }));
    expect(await a).toEqual(await b);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
