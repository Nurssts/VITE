"""AI service layer: configuration, provider chain with fallback, budgets and usage tracking.

Configuration is read from the environment on every call (no restart needed in tests):

  AI_ENABLED            true|false (default true; false switches every AI endpoint off)
  AI_PROVIDERS          preferred order, e.g. "gemini,anthropic,openai" (default: that order)
  GOOGLE_API_KEY        Gemini key (or GEMINI_API_KEY);   GEMINI_MODEL   (default gemini-3.5-flash-lite)
  ANTHROPIC_API_KEY     Claude key;                       ANTHROPIC_MODEL (default claude-opus-5-5),
                        ANTHROPIC_EFFORT (low|medium|high, default medium)
  AI_OPENAI_BASE_URL    any OpenAI-compatible endpoint (OpenAI, DeepSeek, Qwen, Groq, OpenRouter,
                        Ollama http://127.0.0.1:11434/v1);  AI_OPENAI_API_KEY (or OPENAI_API_KEY);
                        AI_OPENAI_MODEL (required unless the base URL is OpenAI's)
  AI_MAX_OUTPUT_TOKENS  per model turn (default 4096; Claude gets at least 8000)
  AI_DAILY_LIMIT        model turns per day for the whole server (default 400)
  AI_DAILY_TOKEN_LIMIT  input+output tokens per day (default 3,000,000)
  AI_TIMEOUT            seconds per model turn (default 90)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import date
from typing import Any, AsyncIterator

from .providers import AnthropicProvider, OpenAICompatProvider, ProviderError, TurnRequest

log = logging.getLogger("vite.ai")

GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
OPENAI_URL = "https://api.openai.com/v1"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def ai_enabled() -> bool:
    return _env("AI_ENABLED", "true").lower() != "false"


def _int(name: str, default: int) -> int:
    try:
        return max(1, int(_env(name, str(default))))
    except ValueError:
        return default


def provider_configs() -> list[dict[str, Any]]:
    """Configured providers in preference order (no secrets in the result)."""
    timeout = float(_int("AI_TIMEOUT", 90))
    found: dict[str, dict[str, Any]] = {}
    gkey = _env("GOOGLE_API_KEY") or _env("GEMINI_API_KEY")
    if gkey:
        found["gemini"] = {"id": "gemini", "label": "Google Gemini", "model": _env("GEMINI_MODEL", "gemini-3.5-flash-lite"),
                           "make": lambda m, k=gkey: OpenAICompatProvider("gemini", GEMINI_OPENAI_URL, m, k, timeout)}
    akey = _env("ANTHROPIC_API_KEY")
    if akey:
        found["anthropic"] = {"id": "anthropic", "label": "Anthropic Claude", "model": _env("ANTHROPIC_MODEL", "claude-opus-5-5"),
                              "make": lambda m, k=akey: AnthropicProvider(k, m, _env("ANTHROPIC_EFFORT", "medium"), timeout)}
    base = _env("AI_OPENAI_BASE_URL")
    okey = _env("AI_OPENAI_API_KEY") or _env("OPENAI_API_KEY")
    if base or okey:
        url = base or OPENAI_URL
        model = _env("AI_OPENAI_MODEL", "gpt-5.4-mini" if url == OPENAI_URL else "")
        if model:
            label = "Ollama (local)" if ":11434" in url else "OpenAI-compatible"
            found["openai"] = {"id": "openai", "label": label, "model": model,
                               "make": lambda m, k=okey, u=url: OpenAICompatProvider("openai", u, m, k, timeout)}
    order = [p.strip() for p in _env("AI_PROVIDERS", "gemini,anthropic,openai").split(",") if p.strip()]
    ranked = [found[p] for p in order if p in found] + [v for k, v in found.items() if k not in order]
    return ranked


# ── Usage, budgets, health ───────────────────────────────────────────────

class Usage:
    def __init__(self) -> None:
        self.day = ""
        self.turns = 0
        self.input = 0
        self.output = 0
        self.by_provider: dict[str, dict[str, int]] = {}
        self.unhealthy_until: dict[str, float] = {}

    def _roll(self) -> None:
        today = date.today().isoformat()
        if self.day != today:
            self.day, self.turns, self.input, self.output, self.by_provider = today, 0, 0, 0, {}

    def check(self) -> None:
        self._roll()
        if self.turns >= _int("AI_DAILY_LIMIT", 400):
            raise ProviderError("Daily AI request limit reached. AI is available again tomorrow.", status=429)
        if self.input + self.output >= _int("AI_DAILY_TOKEN_LIMIT", 3_000_000):
            raise ProviderError("Daily AI token budget reached. AI is available again tomorrow.", status=429)

    def add(self, provider: str, usage: dict[str, int]) -> None:
        self._roll()
        self.turns += 1
        self.input += usage.get("input", 0)
        self.output += usage.get("output", 0)
        p = self.by_provider.setdefault(provider, {"turns": 0, "input": 0, "output": 0})
        p["turns"] += 1
        p["input"] += usage.get("input", 0)
        p["output"] += usage.get("output", 0)

    def snapshot(self) -> dict[str, Any]:
        self._roll()
        return {
            "day": self.day,
            "turns": self.turns,
            "inputTokens": self.input,
            "outputTokens": self.output,
            "limitTurns": _int("AI_DAILY_LIMIT", 400),
            "limitTokens": _int("AI_DAILY_TOKEN_LIMIT", 3_000_000),
            "byProvider": self.by_provider,
        }

    def healthy(self, provider: str) -> bool:
        return self.unhealthy_until.get(provider, 0) < time.monotonic()

    def mark_unhealthy(self, provider: str, seconds: float) -> None:
        self.unhealthy_until[provider] = time.monotonic() + seconds


USAGE = Usage()


def status() -> dict[str, Any]:
    from .prompts import missions_public
    from .tools import public_list

    configs = provider_configs()
    return {
        "enabled": ai_enabled(),
        "configured": bool(configs),
        "providers": [{"id": c["id"], "label": c["label"], "model": c["model"], "healthy": USAGE.healthy(c["id"])} for c in configs],
        "active": next((c["id"] for c in configs if USAGE.healthy(c["id"])), None),
        "usage": USAGE.snapshot(),
        "tools": public_list(),
        "missions": missions_public(),
    }


def _max_tokens(provider_id: str) -> int:
    base = _int("AI_MAX_OUTPUT_TOKENS", 4096)
    return max(base, 8000) if provider_id == "anthropic" else base  # Claude thinks before answering


async def run_turn(system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]], *, json_mode: bool = False) -> AsyncIterator[dict[str, Any]]:
    """One model turn with retries and provider fallback.

    A provider is retried once on transient errors; if it still fails BEFORE producing any
    output, the next configured provider takes over. Once text has streamed, errors are final
    (switching models mid-answer would produce a confusing mix).
    """
    if not ai_enabled():
        raise ProviderError("AI is switched off on this server (AI_ENABLED=false).", status=503)
    configs = [c for c in provider_configs() if USAGE.healthy(c["id"])] or provider_configs()
    if not configs:
        raise ProviderError("AI is not configured on this server. Set GOOGLE_API_KEY, ANTHROPIC_API_KEY or AI_OPENAI_BASE_URL.", status=503)
    USAGE.check()

    last: ProviderError | None = None
    for cfg in configs:
        provider = cfg["make"](cfg["model"])
        for attempt in range(2):
            started = False
            try:
                yield {"type": "start", "provider": cfg["id"], "label": cfg["label"], "model": cfg["model"]}
                req = TurnRequest(system=system, messages=messages, tools=tools, max_tokens=_max_tokens(cfg["id"]), json_mode=json_mode)
                async for event in provider.stream_turn(req):
                    if event["type"] in ("text", "tool_call"):
                        started = True
                    if event["type"] == "done":
                        USAGE.add(cfg["id"], event.get("usage") or {})
                    yield event
                return
            except ProviderError as exc:
                last = exc
                log.warning("AI provider %s failed (attempt %d): %s", cfg["id"], attempt + 1, exc)
                if exc.auth:
                    USAGE.mark_unhealthy(cfg["id"], 600)
                if started:
                    raise
                if not exc.retryable or exc.auth:
                    break
                if attempt == 0:
                    await asyncio.sleep(1.5)
        # next provider
    raise last or ProviderError("AI is temporarily unavailable.", retryable=True)


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
