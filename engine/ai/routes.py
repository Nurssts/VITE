"""HTTP routes of the VITE AI Engine. Keys stay on the server; tools run in the browser."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import service as ai
from .prompts import scribe_system, strategist_system
from .providers import ProviderError
from .tools import TOOL_NAMES, declarations

log = logging.getLogger("vite.ai")
MAX_HISTORY_CHARS = 300_000


class ToolCallIn(BaseModel):
    id: str = Field(..., max_length=120)
    name: str = Field(..., max_length=60)
    args: dict[str, Any] = Field(default_factory=dict)


class ToolResultIn(BaseModel):
    id: str = Field(..., max_length=120)
    name: str = Field("", max_length=60)
    content: str = Field("", max_length=16_000)
    isError: bool = False


class MessageIn(BaseModel):
    role: Literal["user", "assistant", "tool"]
    text: str = Field("", max_length=8_000)
    toolCalls: list[ToolCallIn] = Field(default_factory=list, max_length=8)
    results: list[ToolResultIn] = Field(default_factory=list, max_length=8)
    raw: dict[str, Any] | None = None


class ChatBody(BaseModel):
    messages: list[MessageIn] = Field(..., min_length=1, max_length=80)
    context: dict[str, Any] = Field(default_factory=dict)
    memory: list[str] = Field(default_factory=list, max_length=40)
    lang: Literal["ru", "en"] = "ru"


class RosterItem(BaseModel):
    number: str = Field(..., max_length=20)
    name: str = Field("", max_length=120)


class ExtractBody(BaseModel):
    text: str = Field(..., min_length=2, max_length=2_000)
    roster: list[RosterItem] = Field(default_factory=list, max_length=200)
    team: str = Field("", max_length=20)
    match: int | None = Field(None, ge=1, le=9999)
    lang: Literal["ru", "en"] = "ru"


def validate_history(messages: list[MessageIn]) -> list[dict[str, Any]]:
    if messages[0].role != "user":
        raise HTTPException(status_code=422, detail="The conversation must start with a user message.")
    out = []
    for m in messages:
        for c in m.toolCalls:
            if c.name not in TOOL_NAMES:
                raise HTTPException(status_code=422, detail=f"Unknown tool: {c.name}")
        out.append(m.model_dump())
    if len(json.dumps(out, ensure_ascii=False)) > MAX_HISTORY_CHARS:
        raise HTTPException(status_code=413, detail="The conversation is too long. Start a new chat.")
    return out


def parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in the answer")
    value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("answer is not an object")
    return value


def build_router(limiter) -> APIRouter:
    router = APIRouter(prefix="/api/ai")

    @router.get("/status")
    async def ai_status() -> dict[str, Any]:
        return ai.status()

    @router.post("/chat")
    @limiter.limit("40/minute")
    async def ai_chat(request: Request, body: ChatBody) -> StreamingResponse:
        """One Strategist turn streamed as Server-Sent Events; the browser runs tools and calls again."""
        history = validate_history(body.messages)
        context = body.context if len(json.dumps(body.context, ensure_ascii=False)) <= 6_000 else {"note": "context too large, omitted"}
        system = strategist_system(context, [m[:300] for m in body.memory], body.lang)

        async def events():
            try:
                async for event in ai.run_turn(system, history, declarations()):
                    yield ai.sse(event)
            except ProviderError as exc:
                yield ai.sse({"type": "error", "message": str(exc), "retryable": exc.retryable, "status": exc.status})
            except Exception:  # noqa: BLE001 — never leak internals into the stream
                log.exception("AI chat failed")
                yield ai.sse({"type": "error", "message": "AI failed unexpectedly. Try again.", "retryable": True})

        return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})

    @router.post("/extract")
    @limiter.limit("20/minute")
    async def ai_extract(request: Request, body: ExtractBody) -> dict[str, Any]:
        """Scribe: free text or dictation about one robot -> structured scouting draft (never saved here)."""
        system = scribe_system([r.model_dump() for r in body.roster], body.team, body.match)
        messages: list[dict[str, Any]] = [{"role": "user", "text": body.text}]
        last_error = ""
        for _ in range(2):
            text, meta = "", {}
            try:
                async for event in ai.run_turn(system, messages, [], json_mode=True):
                    if event["type"] == "start":
                        meta = {"provider": event["provider"], "model": event["model"]}
                        text = ""
                    elif event["type"] == "text":
                        text += event["delta"]
                    elif event["type"] == "done":
                        meta["usage"] = event.get("usage")
            except ProviderError as exc:
                raise HTTPException(status_code=exc.status if exc.status in (429, 503) else 502, detail=str(exc)) from exc
            try:
                return {"draft": parse_json_object(text), **meta}
            except ValueError as exc:
                last_error = str(exc)
                messages = [
                    {"role": "user", "text": body.text},
                    {"role": "assistant", "text": text[:2000]},
                    {"role": "user", "text": "That was not a valid JSON object. Reply with only the JSON object."},
                ]
        raise HTTPException(status_code=502, detail=f"The AI answer could not be read ({last_error}). Try rephrasing.")

    return router
