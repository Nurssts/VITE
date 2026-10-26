"""VITE: BioBuzz Alliance Matrix — local API, FIRST/TOA/FTCScout proxies, math engines.

Credentials stay in process environment. They are never returned to the browser.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from engine.db import init_db
from engine.ftcscout import get_all_teams, get_events, get_match_records, get_team_by_number, get_tep_records
from engine.monte_carlo import simulate_match
from engine.scoring import MODEL_VERSION
from engine.synergy import pair_model, role_label
from engine.stats import team_stats

ROOT = Path(__file__).resolve().parent


def _load_env_file(path: Path) -> None:
    """Read KEY=VALUE lines from a local .env (gitignored). Real environment variables win."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(ROOT / ".env")

FRONTEND_DIST = ROOT / "frontend" / "dist"
WEB = ROOT / "web"
STATIC_DIR = FRONTEND_DIST if (FRONTEND_DIST / "index.html").exists() else WEB
FIRST_API = "https://ftc-api.firstinspires.org/v2.0"
# FIRST numbers a season by its starting year: BIOBUZZ (2026-2027) is "2026".
FIRST_SEASON = os.getenv("FTC_SEASON", "2026")
LEVEL_PATTERN = "^(qual|playoff)$"
TOA_API = "https://theorangealliance.org/api"

app = FastAPI(title="VITE · BioBuzz Alliance Matrix", version="2.0.0")
_extra_origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8000", "http://localhost:8000", *_extra_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TeamIn(BaseModel):
    id: str
    number: str
    name: str
    region: str = ""
    style: str = ""
    notes: str = ""


class PairIn(BaseModel):
    team_a: TeamIn
    team_b: TeamIn
    records: list[dict[str, Any]] = Field(default_factory=list)


class SimIn(BaseModel):
    red: list[TeamIn]
    blue: list[TeamIn]
    records: list[dict[str, Any]] = Field(default_factory=list)
    iterations: int = 1000
    seed: int | None = None


def season_value(value: str) -> str:
    if not re.fullmatch(r"\d{4}", value):
        raise HTTPException(status_code=422, detail="Season must be a four-digit FIRST season start year, e.g. 2026 for BIOBUZZ.")
    return value


def event_value(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9]{3,20}", value):
        raise HTTPException(status_code=422, detail="Event code must be 3-20 letters or digits.")
    return value.upper()


def team_value(value: int | None) -> int | None:
    if value is None:
        return None
    if not 1 <= value <= 999999:
        raise HTTPException(status_code=422, detail="Team number must be between 1 and 999999.")
    return value


def region_value(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9]{1,20}", value):
        raise HTTPException(status_code=422, detail="Region and league codes must be 1-20 letters or digits.")
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
            query = {k: v for k, v in (params or {}).items() if v is not None}
            response = await client.get(f"{FIRST_API}/{path.lstrip('/')}", params=query)
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


@app.on_event("startup")
def startup() -> None:
    init_db()  # local SQLite cache for saved simulations; scout data stays in the browser unless exported.


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "name": "VITE",
        "subtitle": "BioBuzz Alliance Matrix",
        "model": MODEL_VERSION,
        "official_api_configured": bool(os.getenv("FTC_API_USERNAME", "").strip() and os.getenv("FTC_API_TOKEN", "").strip()),
        "toa_configured": bool(os.getenv("TOA_API_KEY", "").strip()),
        "sources": {
            "first": "FIRST FTC Events API",
            "toa": "The Orange Alliance API",
            "local": "Scout entries on this device / optional SQLite cache",
        },
    }


@app.get("/api/sdk")
async def sdk_inventory() -> dict[str, Any]:
    return {
        "thirdParty": [
            {
                "name": "FIRST FTC Events API",
                "purpose": "Official events, teams, schedule, match results, score details, rankings, alliances, awards, advancement and leagues when credentials are configured.",
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
        ],
        "notUsed": ["Google Analytics", "advertising SDKs", "session replay", "payment processors"],
        "note": "VITE does not load third-party tracking scripts in the browser. Optional APIs run only from the local Python proxy.",
    }


@app.get("/api/ftc/season")
async def season_summary(season: str = Query(FIRST_SEASON)) -> Any:
    return await first_get(season_value(season))


@app.get("/api/ftc/events")
async def events(
    season: str = Query(FIRST_SEASON),
    event_code: str | None = Query(None),
    team_number: int | None = Query(None),
) -> Any:
    params = {"eventCode": event_value(event_code) if event_code else None, "teamNumber": team_value(team_number)}
    return await first_get(f"{season_value(season)}/events", params)


@app.get("/api/ftc/teams")
async def teams(season: str = Query(FIRST_SEASON), event_code: str = Query(..., min_length=3, max_length=20)) -> Any:
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


@app.get("/api/ftc/team")
async def team_info(season: str = Query(FIRST_SEASON), team_number: int = Query(...)) -> Any:
    return await first_get(f"{season_value(season)}/teams", {"teamNumber": team_value(team_number)})


@app.get("/api/ftc/matches")
async def matches(
    season: str = Query(FIRST_SEASON),
    event_code: str = Query(..., min_length=3, max_length=20),
    tournament_level: str = Query("qual", pattern=LEVEL_PATTERN),
    team_number: int | None = Query(None),
    match_number: int | None = Query(None, ge=1),
) -> Any:
    params = {"tournamentLevel": tournament_level, "teamNumber": team_value(team_number), "matchNumber": match_number}
    return await first_get(f"{season_value(season)}/matches/{event_value(event_code)}", params)


@app.get("/api/ftc/scores")
async def scores(
    season: str = Query(FIRST_SEASON),
    event_code: str = Query(..., min_length=3, max_length=20),
    tournament_level: str = Query("qual", pattern=LEVEL_PATTERN),
    team_number: int | None = Query(None),
    match_number: int | None = Query(None, ge=1),
) -> Any:
    """Per-alliance score breakdown. For BioBuzz (season 2026) this includes Hive tips, flowers and park."""
    params = {"teamNumber": team_value(team_number), "matchNumber": match_number}
    return await first_get(f"{season_value(season)}/scores/{event_value(event_code)}/{tournament_level}", params)


@app.get("/api/ftc/schedule")
async def schedule(
    season: str = Query(FIRST_SEASON),
    event_code: str = Query(..., min_length=3, max_length=20),
    tournament_level: str = Query("qual", pattern=LEVEL_PATTERN),
    team_number: int | None = Query(None),
) -> Any:
    params = {"tournamentLevel": tournament_level, "teamNumber": team_value(team_number)}
    return await first_get(f"{season_value(season)}/schedule/{event_value(event_code)}", params)


@app.get("/api/ftc/schedule/hybrid")
async def schedule_hybrid(
    season: str = Query(FIRST_SEASON),
    event_code: str = Query(..., min_length=3, max_length=20),
    tournament_level: str = Query("qual", pattern=LEVEL_PATTERN),
) -> Any:
    """Schedule merged with results: upcoming matches plus scores for the ones already played."""
    return await first_get(f"{season_value(season)}/schedule/{event_value(event_code)}/{tournament_level}/hybrid")


@app.get("/api/ftc/rankings")
async def rankings(
    season: str = Query(FIRST_SEASON),
    event_code: str = Query(..., min_length=3, max_length=20),
    team_number: int | None = Query(None),
    top: int | None = Query(None, ge=1, le=200),
) -> Any:
    params = {"teamNumber": team_value(team_number), "top": top}
    return await first_get(f"{season_value(season)}/rankings/{event_value(event_code)}", params)


@app.get("/api/ftc/alliances")
async def alliances(season: str = Query(FIRST_SEASON), event_code: str = Query(..., min_length=3, max_length=20)) -> Any:
    return await first_get(f"{season_value(season)}/alliances/{event_value(event_code)}")


@app.get("/api/ftc/alliances/selection")
async def alliance_selection(season: str = Query(FIRST_SEASON), event_code: str = Query(..., min_length=3, max_length=20)) -> Any:
    """Pick-by-pick order of the alliance selection, including declines."""
    return await first_get(f"{season_value(season)}/alliances/{event_value(event_code)}/selection")


@app.get("/api/ftc/awards")
async def awards(
    season: str = Query(FIRST_SEASON),
    event_code: str | None = Query(None),
    team_number: int | None = Query(None),
) -> Any:
    season = season_value(season)
    if event_code and team_number:
        return await first_get(f"{season}/awards/{event_value(event_code)}/{team_value(team_number)}")
    if event_code:
        return await first_get(f"{season}/awards/{event_value(event_code)}")
    if team_number:
        return await first_get(f"{season}/awards/{team_value(team_number)}")
    raise HTTPException(status_code=422, detail="Pass event_code, team_number, or both.")


@app.get("/api/ftc/awards/list")
async def award_list(season: str = Query(FIRST_SEASON)) -> Any:
    return await first_get(f"{season_value(season)}/awards/list")


@app.get("/api/ftc/advancement")
async def advancement(
    season: str = Query(FIRST_SEASON),
    event_code: str | None = Query(None),
    exclude_skipped: bool | None = Query(None),
) -> Any:
    """Event advancement list, or regional championship advancement when no event code is given."""
    season = season_value(season)
    if not event_code:
        return await first_get(f"{season}/advancement")
    return await first_get(f"{season}/advancement/{event_value(event_code)}", {"excludeSkipped": exclude_skipped})


@app.get("/api/ftc/advancement/points")
async def advancement_points(season: str = Query(FIRST_SEASON), event_code: str = Query(..., min_length=3, max_length=20)) -> Any:
    return await first_get(f"{season_value(season)}/advancement/{event_value(event_code)}/points")


@app.get("/api/ftc/advancement/source")
async def advancement_source(
    season: str = Query(FIRST_SEASON),
    event_code: str = Query(..., min_length=3, max_length=20),
    include_declines: bool | None = Query(None),
) -> Any:
    params = {"includeDeclines": include_declines}
    return await first_get(f"{season_value(season)}/advancement/{event_value(event_code)}/source", params)


@app.get("/api/ftc/leagues")
async def leagues(
    season: str = Query(FIRST_SEASON),
    region_code: str | None = Query(None),
    league_code: str | None = Query(None),
) -> Any:
    params = {
        "regionCode": region_value(region_code) if region_code else None,
        "leagueCode": region_value(league_code) if league_code else None,
    }
    return await first_get(f"{season_value(season)}/leagues", params)


@app.get("/api/ftc/leagues/members")
async def league_members(season: str = Query(FIRST_SEASON), region_code: str = Query(...), league_code: str = Query(...)) -> Any:
    return await first_get(f"{season_value(season)}/leagues/members/{region_value(region_code)}/{region_value(league_code)}")


@app.get("/api/ftc/leagues/rankings")
async def league_rankings(season: str = Query(FIRST_SEASON), region_code: str = Query(...), league_code: str = Query(...)) -> Any:
    return await first_get(f"{season_value(season)}/leagues/rankings/{region_value(region_code)}/{region_value(league_code)}")


@app.get("/api/toa/event/{event_key}/matches")
async def toa_matches(event_key: str) -> Any:
    return await toa_get(f"event/{toa_event(event_key)}/matches")


@app.get("/api/toa/event/{event_key}/teams")
async def toa_teams(event_key: str) -> Any:
    return await toa_get(f"event/{toa_event(event_key)}/teams")


@app.post("/api/math/synergy")
async def synergy(body: PairIn) -> Any:
    model = pair_model(body.team_a.model_dump(), body.team_b.model_dump(), body.records)
    if not model:
        raise HTTPException(status_code=400, detail="Could not compute pair synergy.")
    safe = {k: v for k, v in model.items() if k not in {"a", "b"}}
    safe["roles"] = [role_label(team_stats(body.team_a.model_dump(), body.records)), role_label(team_stats(body.team_b.model_dump(), body.records))]
    return safe


@app.post("/api/math/simulate")
async def simulate(body: SimIn) -> Any:
    if len(body.red) != 2 or len(body.blue) != 2:
        raise HTTPException(status_code=400, detail="Provide exactly two teams per alliance.")
    result = simulate_match(
        (body.red[0].model_dump(), body.red[1].model_dump()),
        (body.blue[0].model_dump(), body.blue[1].model_dump()),
        body.records,
        iterations=body.iterations,
        seed=body.seed,
    )
    conn = init_db()
    conn.execute(
        "INSERT INTO alliance_simulations(id, created_at, payload) VALUES (?,?,?)",
        (str(uuid.uuid4()), datetime.now(timezone.utc).isoformat(), json.dumps({"winPct": result["winPct"], "iterations": result["iterations"]})),
    )
    conn.commit()
    conn.close()
    return result


@app.post("/api/math/notebook")
async def notebook(body: dict[str, Any]) -> Any:
    """Return a structured judge-export payload. The browser renders and prints it; no fabricated metrics."""
    return {
        "title": "VITE Engineering Notebook excerpt",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL_VERSION,
        "payload": body,
        "disclaimer": "Figures below are computed from the scout database you supplied. Demo rows are labelled as such.",
    }


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
async def ftcscout_events(season: int = Query(int(FIRST_SEASON))) -> Any:
    """Fetch events for a season from FTCScout."""
    events = await get_events(season)
    return {"events": events, "season": season, "count": len(events)}


@app.get("/api/ftcscout/rankings")
async def ftcscout_rankings(season: int = Query(int(FIRST_SEASON)), skip: int = Query(0), take: int = Query(100)) -> Any:
    """Fetch TEP rankings from FTCScout."""
    records = await get_tep_records(season, skip, take)
    return {"rankings": records, "season": season, "count": len(records)}


FTCSCOUT_GQL = "https://api.ftcscout.org/graphql"

PLAYED_EVENTS_QUERY = """
query PlayedEvents($season: Int!) {
  eventsSearch(season: $season, hasMatches: true) {
    code name start end type location { city country }
  }
}
"""

# BIOBUZZ (2026) team stats. OPR splits each alliance score into per-robot contributions.
EVENT_2026_QUERY = """
query EventStats($season: Int!, $code: String!) {
  eventByCode(season: $season, code: $code) {
    code name start end location { city country }
    matches { id }
    teams {
      teamNumber
      team { name }
      stats {
        ... on TeamEventStats2026 {
          rank rp wins losses ties qualMatchesPlayed
          opr { totalPointsNp autoPoints autoHivePoints dcHivePoints dcFlowerPoints dcGardenPoints dcParkPoints }
          dev { totalPointsNp }
        }
      }
    }
  }
}
"""


async def ftcscout_gql(query: str, variables: dict[str, Any]) -> Any:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
            response = await client.post(FTCSCOUT_GQL, json={"query": query, "variables": variables})
        body = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="FTCScout request timed out. Local scouting remains available.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Could not reach FTCScout.") from exc
    if response.status_code >= 400 or body.get("errors"):
        raise HTTPException(status_code=502, detail=f"FTCScout returned an error (status {response.status_code}).")
    return body["data"]


@app.get("/api/ftcscout/played-events")
async def ftcscout_played_events(season: int = Query(int(FIRST_SEASON))) -> Any:
    """Events of the season that already have match results, newest first."""
    data = await ftcscout_gql(PLAYED_EVENTS_QUERY, {"season": season})
    events = sorted(data.get("eventsSearch") or [], key=lambda e: e.get("start") or "", reverse=True)
    return {"events": events, "season": season, "count": len(events)}


@app.get("/api/ftcscout/event/{code}")
async def ftcscout_event(code: str, season: int = Query(int(FIRST_SEASON))) -> Any:
    """Official rankings and OPR breakdown for one BIOBUZZ event."""
    if season != 2026:
        raise HTTPException(status_code=422, detail="Event stats are mapped for the BIOBUZZ season (2026) only.")
    data = await ftcscout_gql(EVENT_2026_QUERY, {"season": season, "code": event_value(code)})
    event = data.get("eventByCode")
    if not event:
        raise HTTPException(status_code=404, detail="Event was not found on FTCScout.")
    teams = []
    for entry in event.get("teams") or []:
        s = entry.get("stats")
        if not s:
            continue
        opr = s["opr"]
        teams.append({
            "number": str(entry["teamNumber"]),
            "name": (entry.get("team") or {}).get("name") or f"Team {entry['teamNumber']}",
            "rank": s["rank"],
            "rp": s["rp"],
            "wins": s["wins"],
            "losses": s["losses"],
            "ties": s["ties"],
            "played": s["qualMatchesPlayed"],
            "opr": {
                "total": opr["totalPointsNp"],
                "auto": opr["autoPoints"],
                "autoHive": opr["autoHivePoints"],
                "hive": opr["dcHivePoints"],
                "flower": opr["dcFlowerPoints"],
                "garden": opr["dcGardenPoints"],
                "park": opr["dcParkPoints"],
            },
            "dev": s["dev"]["totalPointsNp"],
        })
    teams.sort(key=lambda t: t["rank"])
    location = event.get("location") or {}
    return {
        "source": "FTCScout",
        "season": season,
        "code": event["code"],
        "name": event["name"],
        "start": event.get("start"),
        "end": event.get("end"),
        "location": ", ".join(x for x in (location.get("city"), location.get("country")) if x),
        "matchCount": len(event.get("matches") or []),
        "teams": teams,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }


if STATIC_DIR.exists():
    # The production build uses the GitHub Pages base path /VITE/, so serve it there as well as at the root.
    app.mount("/VITE", StaticFiles(directory=STATIC_DIR, html=True), name="web-pages")
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="web")
