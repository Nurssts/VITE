"""Model providers behind one streaming interface.

Two adapters cover every supported model:
  AnthropicProvider    — official `anthropic` SDK (Claude), streaming + tool use
  OpenAICompatProvider — any OpenAI-compatible Chat Completions API: Google Gemini
                         (generativelanguage.googleapis.com/v1beta/openai), OpenAI, DeepSeek,
                         Qwen/DashScope, Groq, OpenRouter, local Ollama.

Conversation format (provider-neutral, owned by the browser):
  {"role": "user", "text": str}
  {"role": "assistant", "text": str, "toolCalls": [{"id", "name", "args"}], "raw": {...} | None}
  {"role": "tool", "results": [{"id", "name", "content": str, "isError": bool}]}
`raw` is the provider's own assistant content, echoed back unchanged when the same provider
continues the conversation (keeps Claude thinking blocks and Gemini thought signatures valid).

stream_turn() yields normalized events:
  {"type": "text", "delta": str}
  {"type": "tool_call", "id", "name", "args"}
  {"type": "done", "stop": "end"|"tool_use"|"max_tokens"|"refusal", "usage": {...}, "raw": {...}}
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator

import httpx


class ProviderError(RuntimeError):
    """Safe-to-show failure. The message never names the provider or model (users only see
    "the AI service"); `detail` holds the technical cause for server logs only."""

    def __init__(self, message: str, *, retryable: bool = False, status: int = 0, auth: bool = False, detail: str = ""):
        super().__init__(message)
        self.retryable = retryable
        self.status = status
        self.auth = auth
        self.detail = detail


@dataclass
class TurnRequest:
    system: str
    messages: list[dict[str, Any]]
    tools: list[dict[str, Any]]
    max_tokens: int
    json_mode: bool = False


def _args(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError):
        return {"_invalid_json": str(value)[:500]}


# ── Anthropic (official SDK) ─────────────────────────────────────────────

class AnthropicProvider:
    id = "anthropic"

    def __init__(self, api_key: str, model: str, effort: str = "medium", timeout: float = 90.0):
        from anthropic import AsyncAnthropic  # lazy: the server runs without the SDK installed

        self.model = model
        self.effort = effort
        self.client = AsyncAnthropic(api_key=api_key, timeout=timeout, max_retries=1)

    def _messages(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for m in history:
            if m["role"] == "user":
                out.append({"role": "user", "content": m.get("text") or "…"})
            elif m["role"] == "assistant":
                raw = m.get("raw") or {}
                if raw.get("provider") == self.id and isinstance(raw.get("content"), list):
                    out.append({"role": "assistant", "content": raw["content"]})
                    continue
                blocks: list[dict[str, Any]] = []
                if m.get("text"):
                    blocks.append({"type": "text", "text": m["text"]})
                for c in m.get("toolCalls") or []:
                    blocks.append({"type": "tool_use", "id": c["id"], "name": c["name"], "input": c.get("args") or {}})
                out.append({"role": "assistant", "content": blocks or [{"type": "text", "text": "…"}]})
            elif m["role"] == "tool":
                out.append({
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": r["id"], "content": r.get("content") or "", "is_error": bool(r.get("isError"))}
                        for r in m.get("results") or []
                    ],
                })
        return out

    async def stream_turn(self, req: TurnRequest) -> AsyncIterator[dict[str, Any]]:
        import anthropic

        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": req.max_tokens,
            "system": req.system,
            "messages": self._messages(req.messages),
            "output_config": {"effort": self.effort},
        }
        if req.tools:
            params["tools"] = [
                {"name": t["name"], "description": t["description"], "input_schema": t["parameters"], "eager_input_streaming": True}
                for t in req.tools
            ]
        try:
            async with self.client.messages.stream(**params) as stream:
                async for event in stream:
                    if event.type == "text" and event.text:
                        yield {"type": "text", "delta": event.text}
                final = await stream.get_final_message()
        except anthropic.AuthenticationError as exc:
            raise ProviderError("The AI service rejected the server key.", status=401, auth=True, detail="anthropic 401") from exc
        except anthropic.PermissionDeniedError as exc:
            raise ProviderError("The AI service denied access.", status=403, auth=True, detail="anthropic 403") from exc
        except anthropic.RateLimitError as exc:
            raise ProviderError("The AI service is busy. Try again in a minute.", retryable=True, status=429, detail="anthropic 429") from exc
        except anthropic.APIStatusError as exc:
            raise ProviderError(f"The AI service returned an error (HTTP {exc.status_code}).", retryable=exc.status_code >= 500, status=exc.status_code, detail=f"anthropic {exc.status_code}") from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderError("Could not reach the AI service.", retryable=True, detail="anthropic connection") from exc
        except ValueError as exc:  # unparseable streamed tool input (eager streaming)
            raise ProviderError("The model produced an invalid tool call.", retryable=True) from exc

        if final.stop_reason == "refusal":
            yield {"type": "done", "stop": "refusal", "usage": _usage(final.usage.input_tokens, final.usage.output_tokens), "raw": None}
            return
        calls = [b for b in final.content if b.type == "tool_use"]
        truncated = final.stop_reason == "max_tokens"
        if not truncated:  # never run a tool whose input may be cut off
            for b in calls:
                yield {"type": "tool_call", "id": b.id, "name": b.name, "args": _args(b.input)}
        stop = "max_tokens" if truncated else "tool_use" if calls else "end"
        raw = {"provider": self.id, "content": [b.model_dump(mode="json", exclude_none=True) for b in final.content]}
        yield {"type": "done", "stop": stop, "usage": _usage(final.usage.input_tokens, final.usage.output_tokens), "raw": raw}


# ── OpenAI-compatible (Gemini, OpenAI, DeepSeek, Qwen, Groq, OpenRouter, Ollama) ──

_THINK = re.compile(r"<think>.*?</think>", re.S)


class _ThinkFilter:
    """Removes <think>…</think> reasoning that some open models (Qwen3, DeepSeek-R1) stream inline."""

    def __init__(self) -> None:
        self.buf = ""
        self.inside = False

    def feed(self, chunk: str) -> str:
        self.buf += chunk
        out = ""
        while self.buf:
            if self.inside:
                end = self.buf.find("</think>")
                if end < 0:
                    self.buf = self.buf[-8:]
                    return out
                self.buf = self.buf[end + 8 :]
                self.inside = False
            else:
                start = self.buf.find("<think>")
                if start < 0:
                    keep = 7 if "<" in self.buf[-7:] else 0  # a tag may be split across chunks
                    out += self.buf[: len(self.buf) - keep] if keep else self.buf
                    self.buf = self.buf[len(self.buf) - keep :] if keep else ""
                    return out
                out += self.buf[:start]
                self.buf = self.buf[start + 7 :]
                self.inside = True
        return out

    def flush(self) -> str:
        rest, self.buf = ("" if self.inside else self.buf), ""
        return rest


class OpenAICompatProvider:
    def __init__(self, id: str, base_url: str, model: str, api_key: str = "", timeout: float = 90.0, extra_body: dict[str, Any] | None = None):
        self.id = id
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = httpx.Timeout(timeout, connect=8.0)
        self.extra_body = extra_body or {}

    def _messages(self, system: str, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = [{"role": "system", "content": system}]
        for m in history:
            if m["role"] == "user":
                out.append({"role": "user", "content": m.get("text") or "…"})
            elif m["role"] == "assistant":
                raw = m.get("raw") or {}
                if raw.get("provider") == self.id and isinstance(raw.get("message"), dict):
                    out.append(raw["message"])
                    continue
                msg: dict[str, Any] = {"role": "assistant", "content": m.get("text") or ""}
                if m.get("toolCalls"):
                    msg["tool_calls"] = [
                        {"id": c["id"], "type": "function", "function": {"name": c["name"], "arguments": json.dumps(c.get("args") or {}, ensure_ascii=False)}}
                        for c in m["toolCalls"]
                    ]
                out.append(msg)
            elif m["role"] == "tool":
                for r in m.get("results") or []:
                    out.append({"role": "tool", "tool_call_id": r["id"], "content": r.get("content") or ""})
        return out

    async def stream_turn(self, req: TurnRequest) -> AsyncIterator[dict[str, Any]]:
        body: dict[str, Any] = {
            "model": self.model,
            "messages": self._messages(req.system, req.messages),
            "stream": True,
            "stream_options": {"include_usage": True},
            "max_tokens": req.max_tokens,
            **self.extra_body,
        }
        if req.tools:
            body["tools"] = [{"type": "function", "function": t} for t in req.tools]
        if req.json_mode:
            body["response_format"] = {"type": "json_object"}
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        text_parts: list[str] = []
        calls: dict[int, dict[str, Any]] = {}
        finish = None
        usage = _usage(0, 0)
        think = _ThinkFilter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", f"{self.base_url}/chat/completions", json=body, headers=headers) as res:
                    if res.status_code >= 400:
                        detail = (await res.aread()).decode("utf-8", "replace")[:300]
                        # Gemini answers 400 "API key not valid" instead of 401
                        auth = res.status_code in (401, 403) or (res.status_code == 400 and "api key" in detail.lower())
                        raise ProviderError(
                            "The AI service rejected the server key." if auth
                            else "The AI service is busy. Try again in a minute." if res.status_code == 429
                            else f"The AI service returned an error (HTTP {res.status_code}).",
                            retryable=res.status_code == 429 or res.status_code >= 500,
                            status=res.status_code,
                            auth=auth,
                            detail=f"{self.id} HTTP {res.status_code}: {_short(detail)}",
                        )
                    async for line in res.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except ValueError:
                            continue
                        if chunk.get("error"):
                            raise ProviderError("The AI service reported an error.", retryable=True, detail=f"{self.id}: {_short(json.dumps(chunk['error']))}")
                        if chunk.get("usage"):
                            u = chunk["usage"]
                            usage = _usage(u.get("prompt_tokens") or 0, u.get("completion_tokens") or 0)
                        for choice in chunk.get("choices") or []:
                            delta = choice.get("delta") or {}
                            if delta.get("content"):
                                visible = think.feed(delta["content"])
                                if visible:
                                    text_parts.append(visible)
                                    yield {"type": "text", "delta": visible}
                            for tc in delta.get("tool_calls") or []:
                                slot = calls.setdefault(tc.get("index", len(calls)), {"id": "", "name": "", "arguments": "", "extra": None})
                                slot["id"] = tc.get("id") or slot["id"]
                                fn = tc.get("function") or {}
                                slot["name"] += fn.get("name") or ""
                                slot["arguments"] += fn.get("arguments") or ""
                                if tc.get("extra_content"):
                                    slot["extra"] = tc["extra_content"]  # e.g. Gemini thought signature
                            if choice.get("finish_reason"):
                                finish = choice["finish_reason"]
        except ProviderError:
            raise
        except httpx.TimeoutException as exc:
            raise ProviderError("The AI service timed out.", retryable=True, detail=f"{self.id} timeout") from exc
        except httpx.HTTPError as exc:
            raise ProviderError("Could not reach the AI service.", retryable=True, detail=f"{self.id} connection") from exc

        tail = think.flush()
        if tail:
            text_parts.append(tail)
            yield {"type": "text", "delta": tail}
        text = _THINK.sub("", "".join(text_parts)).strip()
        tool_calls = []
        for i in sorted(calls):
            c = calls[i]
            if not c["name"]:
                continue
            cid = c["id"] or f"call_{i}"
            tool_calls.append({"id": cid, "name": c["name"], "args": _args(c["arguments"]), "extra": c["extra"]})
        truncated = finish == "length"
        if not truncated:
            for c in tool_calls:
                yield {"type": "tool_call", "id": c["id"], "name": c["name"], "args": c["args"]}
        message: dict[str, Any] = {"role": "assistant", "content": text}
        if tool_calls:
            message["tool_calls"] = [
                {"id": c["id"], "type": "function", "function": {"name": c["name"], "arguments": json.dumps(c["args"], ensure_ascii=False)}, **({"extra_content": c["extra"]} if c["extra"] else {})}
                for c in tool_calls
            ]
        stop = "max_tokens" if truncated else "refusal" if finish == "content_filter" else "tool_use" if tool_calls else "end"
        yield {"type": "done", "stop": stop, "usage": usage, "raw": {"provider": self.id, "message": message}}


def _usage(inp: int, out: int) -> dict[str, int]:
    return {"input": int(inp or 0), "output": int(out or 0)}


def _short(text: str) -> str:
    text = re.sub(r"(key|token)=[^&\s\"]+", r"\1=***", text)
    return text.replace("\n", " ")[:200]
