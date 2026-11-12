"""VITE: BioBuzz Alliance Matrix — local API, FIRST/TOA/FTCScout proxies, math engines.

Credentials stay in process environment. They are never returned to the browser.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import httpx
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from engine.ftcscout import get_event_teams, list_events, get_all_teams, get_events, get_match_records, get_team_by_number, get_tep_records
from engine.gemini import analyze_match_with_gemini, get_alliance_recommendation

ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
STATIC_DIR = FRONTEND_DIST if (FRONTEND_DIST / "index.html").exists() else None
FIRST_API = "https://ftc-api.firstinspires.org/v2.0"
TOA_API = "https://theorangealliance.org/api"

# Season year constants
# FIRST API v2.0 uses the year the season ENDS (e.g., 2027 for 2026-27 season)
# Source: https://ftc-events.firstinspires.org/services/api - examples show 2025 in URL for 2024-25 season
SEASON_FIRST = "2027"  # Year season ends (for FIRST API)
SEASON_FTCSCOUT = 2026  # Year season starts (for FTCScout)

app = FastAPI(title="VITE · BioBuzz Alliance Matrix", version="2.0.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_extra_origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8000", "http://localhost:8000", *_extra_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


def season_value(value: str) -> str:
    if not re.fullmatch(r"\d{4}", value):
        raise HTTPException(status_code=422, detail="Season must be a four-digit FIRST season year, e.g. 2027.")
    return value


def event_value(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9]{3,20}", value):
        raise HTTPException(status_code=422, detail="Event code must be 3-20 letters or digits.")
    return value.upper()


def toa_event(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9\-]{3,32}", value):
        raise HTTPException(status_code=422, detail="TOA event key must be 3-32 letters, digits, or hyphens.")
    return value


async def first_get(path: str, params: dict[str, Any] | None = None) -> Any:
    username = os.getenv("FTC_API_USERNAME", "").strip()
    token = os.getenv("FTC_API_TOKEN", "").strip()
    if not username or not token:
        raise HTTPException(status_code=503, detail="FTC Events API is not configured. Set FTC_API_USERNAME and FTC_API_TOKEN on the server.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0), auth=(username, token)) as client:
            response = await client.get(f"{FIRST_API}/{path.lstrip('/')}", params=params)
        if response.status_code == 401:
            raise HTTPException(status_code=502, detail="FTC API rejected the configured credentials.")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Event or season was not found in the FIRST data service.")
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"FTC API returned status {response.status_code}.")
        return response.json()
    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="FTC API request timed out. Local scouting remains available.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the FTC API. Local scouting remains available.") from exc


async def toa_get(path: str) -> Any:
    key = os.getenv("TOA_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="TOA API is not configured. Set TOA_API_KEY on the server.")
    headers = {"X-TOA-Key": key, "X-Application-Name": "VITE-BioBuzz-Alliance-Matrix", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0), headers=headers) as client:
            response = await client.get(f"{TOA_API}/{path.lstrip('/')}")
        if response.status_code in {401, 403}:
            raise HTTPException(status_code=502, detail="TOA rejected the configured API key.")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Event was not found in The Orange Alliance.")
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"TOA API returned status {response.status_code}.")
        return response.json()
    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="TOA request timed out. Local scouting remains available.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach The Orange Alliance.") from exc


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "name": "VITE",
        "subtitle": "BioBuzz Alliance Matrix",
        "model": "BIOBUZZ TU05 · 15.10.2026",
        "official_api_configured": bool(os.getenv("FTC_API_USERNAME", "").strip() and os.getenv("FTC_API_TOKEN", "").strip()),
        "toa_configured": bool(os.getenv("TOA_API_KEY", "").strip()),
        "sources": {
            "first": "FIRST FTC Events API",
            "toa": "The Orange Alliance API",
            "local": "Scout entries on this device",
        },
    }


@app.get("/api/sdk")
async def sdk_inventory() -> dict[str, Any]:
    ai_enabled = os.getenv("AI_ENABLED", "false").strip().lower() == "true"
    third_party = [
        {
            "name": "FIRST FTC Events API",
            "purpose": "Official event, team, and match results when credentials are configured.",
            "data": "Public tournament metadata. No scout notes leave this computer unless you export them.",
            "url": "https://ftc-events.firstinspires.org/services/API",
            "required": False,
        },
        {
            "name": "The Orange Alliance API",
            "purpose": "Optional qualification match import.",
            "data": "Public TOA event payloads. Requires TOA_API_KEY on the server only.",
            "url": "https://theorangealliance.org/apidocs",
            "required": False,
        },
        {
            "name": "FTCScout.org GraphQL API",
            "purpose": "Public team database, rankings, and match records.",
            "data": "Public FTC team data and rankings. No authentication required.",
            "url": "https://ftcscout.org",
            "required": False,
        },
    ]
    if ai_enabled:
        third_party.append({
            "name": "Google Gemini AI",
            "purpose": "Optional AI-powered match analysis and alliance recommendations (only when explicitly enabled).",
            "data": "Scout notes and team data are sent to Google when you use AI features. Do not enter personal data, especially data of minors.",
            "url": "https://ai.google.dev",
            "required": False,
        })
    return {
        "thirdParty": third_party,
        "notUsed": ["Google Analytics", "advertising SDKs", "session replay", "payment processors"],
        "note": "VITE does not load third-party tracking scripts in the browser. Optional APIs run only from the local Python proxy.",
        "aiEnabled": ai_enabled,
    }


@app.get("/api/ftc/events")
async def events(season: str = Query("2027")) -> Any:
    return await first_get(f"{season_value(season)}/events")


@app.get("/api/ftc/teams")
async def teams(season: str = Query("2027"), event_code: str = Query(..., min_length=3, max_length=20)) -> Any:
    season = season_value(season)
    code = event_value(event_code)
    result = await first_get(f"{season}/teams", {"eventCode": code, "page": 1})
    pages = int(result.get("pageTotal") or 1)
    all_teams = list(result.get("teams") or [])
    for page in range(2, pages + 1):
        next_page = await first_get(f"{season}/teams", {"eventCode": code, "page": page})
        all_teams.extend(next_page.get("teams") or [])
    result["teams"] = all_teams
    result["pageTotal"] = 1
    result["pageCurrent"] = 1
    result["teamCountPage"] = len(all_teams)
    return result


@app.get("/api/ftc/matches")
async def matches(
    season: str = Query("2027"),
    event_code: str = Query(..., min_length=3, max_length=20),
    tournament_level: str = Query("qual", pattern="^(qual|playoff)$"),
) -> Any:
    return await first_get(f"{season_value(season)}/matches/{event_value(event_code)}", {"tournamentLevel": tournament_level})


@app.get("/api/toa/event/{event_key}/matches")
async def toa_matches(event_key: str) -> Any:
    return await toa_get(f"event/{toa_event(event_key)}/matches")


@app.get("/api/toa/event/{event_key}/teams")
async def toa_teams(event_key: str) -> Any:
    return await toa_get(f"event/{toa_event(event_key)}/teams")


# FTCScout.org API endpoints (public, no auth required)
@app.get("/api/ftcscout/teams")
async def ftcscout_teams() -> Any:
    """Fetch all teams from FTCScout public API."""
    teams = await get_all_teams()
    return {"teams": teams, "count": len(teams)}


@app.get("/api/ftcscout/team/{number}")
async def ftcscout_team(number: int) -> Any:
    """Fetch team details by number from FTCScout."""
    team = await get_team_by_number(number)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@app.get("/api/ftcscout/events")
async def ftcscout_events(season: int = Query(2026)) -> Any:
    """Fetch events for a season from FTCScout."""
    result = await list_events(season)
    events = result["events"]
    return {"events": events, "season": season, "count": len(events), "error": result["error"]}


@app.get("/api/ftcscout/rankings")
async def ftcscout_rankings(season: int = Query(2026), skip: int = Query(0), take: int = Query(100)) -> Any:
    """Fetch TEP rankings from FTCScout."""
    records = await get_tep_records(season, skip, take)
    return {"rankings": records, "season": season, "count": len(records)}


@app.get("/api/ftcscout/event/{code}/teams")
async def ftcscout_event_teams(code: str, season: int = Query(2026)) -> Any:
    """Teams of one event from FTCScout (works without any API key)."""
    try:
        return await get_event_teams(season, event_value(code))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"FTCScout: {exc}") from exc


# Gemini AI endpoints (requires GOOGLE_API_KEY and AI_ENABLED environment variables)
# Rate limited: 10 requests per minute per IP
@app.post("/api/gemini/analyze-match")
@limiter.limit("10/minute")
async def gemini_analyze_match(request: Request, body: dict[str, Any]) -> Any:
    """Analyze match using Gemini AI."""
    if os.getenv("AI_ENABLED", "false").strip().lower() != "true":
        raise HTTPException(status_code=503, detail="AI features are disabled on this server.")
    try:
        result = await analyze_match_with_gemini(
            alliance1_teams=body.get("alliance1_teams", []),
            alliance2_teams=body.get("alliance2_teams", []),
            scout_data=body.get("scout_data", ""),
            season=body.get("season", "2026-2027")
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gemini/alliance-recommendation")
@limiter.limit("10/minute")
async def gemini_recommendation(request: Request, body: dict[str, Any]) -> Any:
    """Get alliance partner recommendations using Gemini AI."""
    if os.getenv("AI_ENABLED", "false").strip().lower() != "true":
        raise HTTPException(status_code=503, detail="AI features are disabled on this server.")
    try:
        result = await get_alliance_recommendation(
            available_teams=body.get("available_teams", []),
            my_team=body.get("my_team", ""),
            season=body.get("season", "2026-2027")
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="web")
