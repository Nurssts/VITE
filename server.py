"""VITE · BioBuzz Alliance Matrix — API proxy + static frontend.

The backend only proxies public data sources (FIRST Events API, The Orange Alliance,
FTCScout) and the optional Gemini AI. All scouting math runs in the browser
(frontend/src/lib/model.js). Credentials stay in the process environment and are never
returned to the browser.

Season convention: every `season` parameter is the year the season STARTS
(2026 = BIOBUZZ 2026-2027). FIRST, FTCScout and the frontend all use this convention.
"""
from __future__ import annotations

import logging
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from engine import ftcscout
from engine.ftcscout import FTCScoutError

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vite")

ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
FIRST_API = "https://ftc-api.firstinspires.org/v2.0"
TOA_API = "https://theorangealliance.org/api"
VERSION = "2.1.0"
MODEL_VERSION = "BIOBUZZ TU05 · 15.10.2026"
DEFAULT_SEASON = 2026  # BIOBUZZ 2026-2027
_TIMEOUT = httpx.Timeout(12.0, connect=5.0)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await ftcscout.close()


app = FastAPI(title="VITE · BioBuzz Alliance Matrix", version=VERSION, lifespan=lifespan)


# ── Rate limiting ────────────────────────────────────────────────────────

def client_ip(request: Request) -> str:
    """Real client address behind Render's proxy (falls back to the socket peer)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Middleware ───────────────────────────────────────────────────────────

_extra_origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8000", "http://localhost:8000", *_extra_origins],
    allow_methods=["GET", "POST"],
    allow_headers=["Accept", "Content-Type"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",  # React style attributes and Recharts
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("Referrer-Policy", "no-referrer")
    h.setdefault("X-Frame-Options", "DENY")
    h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    path = request.url.path
    if path.startswith("/api/"):
        h.setdefault("Cache-Control", "no-store")
        log.info("%s %s %s %.0fms", request.method, path, response.status_code, (time.perf_counter() - started) * 1000)
    else:
        h.setdefault("Content-Security-Policy", CSP)
        if path.startswith("/assets/"):
            h["Cache-Control"] = "public, max-age=31536000, immutable"  # hashed file names
        elif path.endswith(("service-worker.js", ".html", "/")):
            h["Cache-Control"] = "no-cache"
    return response


# ── Validation helpers ───────────────────────────────────────────────────

def season_value(value: int | str) -> int:
    text = str(value).strip()
    if not re.fullmatch(r"\d{4}", text) or not 2015 <= int(text) <= date.today().year + 2:
        raise HTTPException(status_code=422, detail="Season must be the four-digit year the season starts, e.g. 2026.")
    return int(text)


def event_value(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9]{3,20}", value or ""):
        raise HTTPException(status_code=422, detail="Event code must be 3-20 letters or digits.")
    return value.upper()


def toa_event(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9\-]{3,32}", value or ""):
        raise HTTPException(status_code=422, detail="TOA event key must be 3-32 letters, digits, or hyphens.")
    return value


def scout_error(exc: FTCScoutError) -> HTTPException:
    log.warning("FTCScout: %s", exc)
    return HTTPException(status_code=502, detail=f"FTCScout: {exc}")


# ── Upstream clients ─────────────────────────────────────────────────────

def first_configured() -> bool:
    return bool(os.getenv("FTC_API_USERNAME", "").strip() and os.getenv("FTC_API_TOKEN", "").strip())


async def first_get(path: str, params: dict[str, Any] | None = None) -> Any:
    username = os.getenv("FTC_API_USERNAME", "").strip()
    token = os.getenv("FTC_API_TOKEN", "").strip()
    if not username or not token:
        raise HTTPException(status_code=503, detail="FTC Events API is not configured. Set FTC_API_USERNAME and FTC_API_TOKEN on the server.")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, auth=(username, token)) as client:
            response = await client.get(f"{FIRST_API}/{path.lstrip('/')}", params=params)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="FTC API request timed out. Local scouting remains available.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the FTC API. Local scouting remains available.") from exc
    if response.status_code == 401:
        raise HTTPException(status_code=502, detail="FTC API rejected the configured credentials.")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Event or season was not found in the FIRST data service.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"FTC API returned status {response.status_code}.")
    return response.json()


async def toa_get(path: str) -> Any:
    key = os.getenv("TOA_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="TOA API is not configured. Set TOA_API_KEY on the server.")
    headers = {"X-TOA-Key": key, "X-Application-Name": "VITE-BioBuzz-Alliance-Matrix", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers) as client:
            response = await client.get(f"{TOA_API}/{path.lstrip('/')}")
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="TOA request timed out. Local scouting remains available.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach The Orange Alliance.") from exc
    if response.status_code in {401, 403}:
        raise HTTPException(status_code=502, detail="TOA rejected the configured API key.")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Event was not found in The Orange Alliance.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"TOA API returned status {response.status_code}.")
    return response.json()


# ── Meta ─────────────────────────────────────────────────────────────────

def ai_is_enabled() -> bool:
    """AI features are on by default; set AI_ENABLED=false to turn them off."""
    return os.getenv("AI_ENABLED", "true").strip().lower() != "false"


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "name": "VITE",
        "subtitle": "BioBuzz Alliance Matrix",
        "version": VERSION,
        "model": MODEL_VERSION,
        "season": DEFAULT_SEASON,
        "official_api_configured": first_configured(),
        "toa_configured": bool(os.getenv("TOA_API_KEY", "").strip()),
        "ai_configured": ai_is_enabled() and bool(os.getenv("GOOGLE_API_KEY", "").strip()),
        "sources": {
            "first": "FIRST FTC Events API",
            "toa": "The Orange Alliance API",
            "ftcscout": "FTCScout.org GraphQL API",
            "local": "Scout entries on this device",
        },
    }


@app.get("/api/sdk")
async def sdk_inventory() -> dict[str, Any]:
    ai_enabled = ai_is_enabled()
    third_party = [
        {"name": "FIRST FTC Events API", "purpose": "Official event, team, and match results when credentials are configured.",
         "data": "Public tournament metadata. No scout notes leave this device unless you export them.",
         "url": "https://ftc-events.firstinspires.org/services/API", "required": False},
        {"name": "The Orange Alliance API", "purpose": "Optional qualification match import.",
         "data": "Public TOA event payloads. Requires TOA_API_KEY on the server only.",
         "url": "https://theorangealliance.org/apidocs", "required": False},
        {"name": "FTCScout.org GraphQL API", "purpose": "Public events, teams, match schedules, results and rankings.",
         "data": "Public FTC data. No authentication required.", "url": "https://ftcscout.org", "required": False},
    ]
    if ai_enabled:
        third_party.append({
            "name": "Google Gemini AI",
            "purpose": "AI-powered match analysis and alliance recommendations (set AI_ENABLED=false to disable).",
            "data": "Scout notes and team data are sent to Google when AI features are used. Do not enter personal data, especially data of minors.",
            "url": "https://ai.google.dev", "required": False,
        })
    return {
        "thirdParty": third_party,
        "notUsed": ["Google Analytics", "advertising SDKs", "session replay", "payment processors"],
        "note": "VITE does not load third-party scripts or fonts in the browser. Optional APIs run only through this server.",
        "aiEnabled": ai_enabled,
    }


# ── FIRST Events API ─────────────────────────────────────────────────────

@app.get("/api/ftc/events")
async def events(season: str = Query(str(DEFAULT_SEASON))) -> Any:
    return await first_get(f"{season_value(season)}/events")


@app.get("/api/ftc/teams")
async def teams(season: str = Query(str(DEFAULT_SEASON)), event_code: str = Query(..., min_length=3, max_length=20)) -> Any:
    year = season_value(season)
    code = event_value(event_code)
    result = await first_get(f"{year}/teams", {"eventCode": code, "page": 1})
    pages = min(int(result.get("pageTotal") or 1), 20)
    all_teams = list(result.get("teams") or [])
    for page in range(2, pages + 1):
        next_page = await first_get(f"{year}/teams", {"eventCode": code, "page": page})
        all_teams.extend(next_page.get("teams") or [])
    result.update(teams=all_teams, pageTotal=1, pageCurrent=1, teamCountPage=len(all_teams))
    return result


@app.get("/api/ftc/matches")
async def matches(
    season: str = Query(str(DEFAULT_SEASON)),
    event_code: str = Query(..., min_length=3, max_length=20),
    tournament_level: str = Query("qual", pattern="^(qual|playoff)$"),
) -> Any:
    return await first_get(f"{season_value(season)}/matches/{event_value(event_code)}", {"tournamentLevel": tournament_level})


# ── The Orange Alliance ──────────────────────────────────────────────────

@app.get("/api/toa/event/{event_key}/matches")
async def toa_matches(event_key: str) -> Any:
    return await toa_get(f"event/{toa_event(event_key)}/matches")


@app.get("/api/toa/event/{event_key}/teams")
async def toa_teams(event_key: str) -> Any:
    return await toa_get(f"event/{toa_event(event_key)}/teams")


# ── FTCScout (public, no key) ────────────────────────────────────────────

@app.get("/api/ftcscout/teams")
async def ftcscout_teams(q: str = Query("", max_length=60), limit: int = Query(50, ge=1, le=200)) -> Any:
    try:
        rows = await ftcscout.search_teams(q.strip(), limit)
    except FTCScoutError as exc:
        raise scout_error(exc) from exc
    return {"teams": rows, "count": len(rows)}


@app.get("/api/ftcscout/team/{number}")
async def ftcscout_team(number: int) -> Any:
    if not 1 <= number <= 999_999:
        raise HTTPException(status_code=422, detail="Team number is out of range.")
    try:
        team = await ftcscout.get_team_by_number(number)
    except FTCScoutError as exc:
        raise scout_error(exc) from exc
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@app.get("/api/ftcscout/events")
async def ftcscout_events(season: str = Query(str(DEFAULT_SEASON))) -> Any:
    year = season_value(season)
    try:
        rows = await ftcscout.list_events(year)
    except FTCScoutError as exc:
        # The frontend shows `error` next to an empty list and keeps manual entry available.
        log.warning("FTCScout events: %s", exc)
        return {"events": [], "season": year, "count": 0, "error": str(exc)}
    return {"events": rows, "season": year, "count": len(rows), "error": None}


@app.get("/api/ftcscout/rankings")
async def ftcscout_rankings(season: str = Query(str(DEFAULT_SEASON)), skip: int = Query(0, ge=0, le=100_000), take: int = Query(50, ge=1, le=100)) -> Any:
    year = season_value(season)
    try:
        result = await ftcscout.get_tep_records(year, skip, take)
    except FTCScoutError as exc:
        raise scout_error(exc) from exc
    return {**result, "season": year}


@app.get("/api/ftcscout/event/{code}/teams")
async def ftcscout_event_teams(code: str, season: str = Query(str(DEFAULT_SEASON))) -> Any:
    try:
        return await ftcscout.get_event_teams(season_value(season), event_value(code))
    except FTCScoutError as exc:
        raise scout_error(exc) from exc


@app.get("/api/ftcscout/event/{code}/matches")
async def ftcscout_event_matches(code: str, season: str = Query(str(DEFAULT_SEASON))) -> Any:
    """Official schedule + results (alliances, scores) of one event."""
    try:
        return await ftcscout.get_event_matches(season_value(season), event_value(code))
    except FTCScoutError as exc:
        raise scout_error(exc) from exc


# ── Gemini AI (server key only) ──────────────────────────────────────────

class MatchAnalysisBody(BaseModel):
    alliance1_teams: list[str] = Field(default_factory=list, max_length=3)
    alliance2_teams: list[str] = Field(default_factory=list, max_length=3)
    scout_data: str = Field("", max_length=6000)
    season: str = Field("2026-2027", max_length=12)


class RecommendationBody(BaseModel):
    available_teams: list[str] = Field(default_factory=list, max_length=80)
    my_team: str = Field("", max_length=40)
    season: str = Field("2026-2027", max_length=12)


_ai_budget = {"day": "", "used": 0}


def ai_guard() -> None:
    """AI on/off switch plus a per-day call budget so a public URL cannot drain the API quota."""
    if not ai_is_enabled():
        raise HTTPException(status_code=503, detail="AI features are disabled on this server.")
    if not os.getenv("GOOGLE_API_KEY", "").strip():
        raise HTTPException(status_code=503, detail="AI is not configured on this server.")
    today = date.today().isoformat()
    if _ai_budget["day"] != today:
        _ai_budget.update(day=today, used=0)
    limit = int(os.getenv("AI_DAILY_LIMIT", "200") or 200)
    if _ai_budget["used"] >= limit:
        raise HTTPException(status_code=429, detail="Daily AI limit reached. Try again tomorrow.")
    _ai_budget["used"] += 1


async def _run_ai(coro_factory) -> Any:
    from engine.gemini import AIFailed, AIUnavailable

    ai_guard()
    try:
        return await coro_factory()
    except AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AIFailed as exc:
        log.warning("Gemini call failed: %r", exc.__cause__)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/gemini/analyze-match")
@limiter.limit("10/minute")
async def gemini_analyze_match(request: Request, body: MatchAnalysisBody) -> Any:
    from engine.gemini import analyze_match_with_gemini

    return await _run_ai(lambda: analyze_match_with_gemini(body.alliance1_teams, body.alliance2_teams, body.scout_data, body.season))


@app.post("/api/gemini/alliance-recommendation")
@limiter.limit("10/minute")
async def gemini_recommendation(request: Request, body: RecommendationBody) -> Any:
    from engine.gemini import get_alliance_recommendation

    return await _run_ai(lambda: get_alliance_recommendation(body.available_teams, body.my_team, body.season))


@app.api_route("/api/{rest:path}", methods=["GET", "POST"], include_in_schema=False)
async def api_not_found(rest: str) -> Any:
    # Keeps unknown /api/* paths from falling through to the SPA (which would return HTML).
    raise HTTPException(status_code=404, detail="Unknown API endpoint.")


if (FRONTEND_DIST / "index.html").exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="web")
