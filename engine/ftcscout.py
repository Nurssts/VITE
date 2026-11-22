"""FTCScout.org GraphQL client (public API, no authentication).

One small httpx-based client replaces the previous gql/aiohttp stack:
- a single shared AsyncClient (connection reuse, bounded timeouts),
- a tiny in-process TTL cache so the event list and schedules are not refetched
  by every visitor (Render free instances are slow to wake up),
- errors are raised as FTCScoutError with a short, safe message.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

log = logging.getLogger("vite.ftcscout")

GRAPHQL_URL = "https://api.ftcscout.org/graphql"
_TIMEOUT = httpx.Timeout(20.0, connect=6.0)
_HEADERS = {"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "VITE-BioBuzz-Alliance-Matrix"}

_client: httpx.AsyncClient | None = None
_cache: dict[str, tuple[float, Any]] = {}
_locks: dict[str, asyncio.Lock] = {}
_CACHE_MAX = 400


class FTCScoutError(RuntimeError):
    """FTCScout could not be reached or rejected the query."""


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS)
    return _client


async def close() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


def clear_cache() -> None:
    _cache.clear()


async def gql(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run one GraphQL query and return its `data` object."""
    try:
        response = await _http().post(GRAPHQL_URL, json={"query": query, "variables": variables or {}})
    except httpx.TimeoutException as exc:
        raise FTCScoutError("FTCScout request timed out") from exc
    except httpx.HTTPError as exc:
        raise FTCScoutError("Could not reach FTCScout") from exc
    try:
        body = response.json()
    except ValueError as exc:
        raise FTCScoutError(f"FTCScout returned HTTP {response.status_code} (not JSON)") from exc
    if body.get("errors"):
        raise FTCScoutError(str(body["errors"][0].get("message", "GraphQL error"))[:200])
    if response.status_code >= 400:
        raise FTCScoutError(f"FTCScout returned HTTP {response.status_code}")
    return body.get("data") or {}


async def cached(key: str, ttl: float, loader) -> Any:
    """Return a cached value or load it once (concurrent callers share one request)."""
    hit = _cache.get(key)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        value = await loader()
        if len(_cache) >= _CACHE_MAX:  # bounded: many different event codes cannot grow memory forever
            now = time.monotonic()
            for k in [k for k, (exp, _) in _cache.items() if exp <= now] or list(_cache)[: _CACHE_MAX // 4]:
                _cache.pop(k, None)
                _locks.pop(k, None)
        _cache[key] = (time.monotonic() + ttl, value)
        return value


def _loc_text(loc: Any) -> str:
    if isinstance(loc, dict):
        return ", ".join(x for x in (loc.get("city"), loc.get("state"), loc.get("country")) if x)
    return loc or ""


# ── Teams ────────────────────────────────────────────────────────────────

async def search_teams(query: str = "", limit: int = 50) -> list[dict[str, Any]]:
    data = await gql(
        "query($q: String, $limit: Int) { teamsSearch(searchText: $q, limit: $limit) { number name location { city state country } } }",
        {"q": query or None, "limit": limit},
    )
    rows = data.get("teamsSearch") or []
    return [{"number": t["number"], "name": t.get("name") or "", "region": _loc_text(t.get("location"))} for t in rows[:limit]]


async def get_team_by_number(number: int) -> dict[str, Any] | None:
    data = await gql(
        "query($n: Int!) { teamByNumber(number: $n) { number name rookieYear location { city state country } } }",
        {"n": number},
    )
    team = data.get("teamByNumber")
    if not team:
        return None
    return {"number": team["number"], "name": team.get("name") or "", "rookieYear": team.get("rookieYear"), "region": _loc_text(team.get("location"))}


# ── Events ───────────────────────────────────────────────────────────────

async def list_events(season: int) -> list[dict[str, Any]]:
    async def load() -> list[dict[str, Any]]:
        data = await gql(
            "query($s: Int!) { eventsSearch(season: $s, limit: 2000) { code name start end location { city state country } } }",
            {"s": season},
        )
        events = data.get("eventsSearch") or []
        for e in events:
            e["location"] = _loc_text(e.get("location"))
        return events

    return await cached(f"events:{season}", 15 * 60, load)


async def get_event_teams(season: int, code: str) -> dict[str, Any]:
    async def load() -> dict[str, Any]:
        data = await gql(
            "query($s: Int!, $c: String!) { eventByCode(season: $s, code: $c) { name teams { teamNumber team { name location { city state } } } } }",
            {"s": season, "c": code},
        )
        event = data.get("eventByCode")
        if not event:
            return {"name": "", "teams": []}
        teams = [
            {
                "number": str(row.get("teamNumber")),
                "name": (row.get("team") or {}).get("name") or "",
                "region": _loc_text((row.get("team") or {}).get("location")),
            }
            for row in event.get("teams") or []
        ]
        return {"name": event.get("name") or "", "teams": teams}

    return await cached(f"teams:{season}:{code}", 5 * 60, load)


_LEVELS = {"Quals": "qual", "Playoff": "playoff", "DoubleElim": "playoff", "Finals": "playoff", "Semis": "playoff"}


def _score_fragment(season: int) -> str:
    # The score union member is season specific (MatchScores2026 = BIOBUZZ).
    return f"scores {{ ... on MatchScores{season} {{ red {{ totalPoints totalPointsNp }} blue {{ totalPoints totalPointsNp }} }} }}"


async def get_event_matches(season: int, code: str) -> dict[str, Any]:
    """Official schedule and results of one event, normalised for the frontend."""

    async def load() -> dict[str, Any]:
        base = "matchNum tournamentLevel series hasBeenPlayed scheduledStartTime teams { teamNumber alliance station }"
        query = "query($s: Int!, $c: String!) {{ eventByCode(season: $s, code: $c) {{ name matches {{ {fields} }} }} }}"
        try:
            data = await gql(query.format(fields=f"{base} {_score_fragment(season)}"), {"s": season, "c": code})
        except FTCScoutError:
            # Unknown score type for this season: still return the schedule.
            data = await gql(query.format(fields=base), {"s": season, "c": code})
        event = data.get("eventByCode")
        if not event:
            return {"name": "", "matches": []}
        matches = []
        for m in event.get("matches") or []:
            red = sorted((t for t in m.get("teams") or [] if t.get("alliance") == "Red"), key=lambda t: t.get("station") or "")
            blue = sorted((t for t in m.get("teams") or [] if t.get("alliance") == "Blue"), key=lambda t: t.get("station") or "")
            scores = m.get("scores") or {}
            played = bool(m.get("hasBeenPlayed")) and bool(scores.get("red"))
            matches.append({
                "level": _LEVELS.get(m.get("tournamentLevel"), "other"),
                "number": m.get("matchNum"),
                "series": m.get("series") or 0,
                "time": m.get("scheduledStartTime"),
                "played": played,
                "red": [str(t["teamNumber"]) for t in red],
                "blue": [str(t["teamNumber"]) for t in blue],
                "redScore": (scores.get("red") or {}).get("totalPoints") if played else None,
                "blueScore": (scores.get("blue") or {}).get("totalPoints") if played else None,
                "redScoreNp": (scores.get("red") or {}).get("totalPointsNp") if played else None,
                "blueScoreNp": (scores.get("blue") or {}).get("totalPointsNp") if played else None,
            })
        matches.sort(key=lambda x: (x["level"] != "qual", x["series"], x["number"] or 0))
        return {"name": event.get("name") or "", "matches": matches}

    # Short TTL: results change during a live event.
    return await cached(f"matches:{season}:{code}", 60, load)


# ── Rankings (TEP records) ──────────────────────────────────────────────

async def get_tep_records(season: int, skip: int = 0, take: int = 50) -> dict[str, Any]:
    stats = f"stats {{ ... on TeamEventStats{season} {{ rank opr {{ totalPointsNp }} }} }}"
    data = await gql(
        f"query($s: Int!, $skip: Int!, $take: Int!) {{ tepRecords(season: $s, skip: $skip, take: $take) {{ count data {{ data {{ teamNumber eventCode team {{ name }} {stats} }} }} }} }}",
        {"s": season, "skip": skip, "take": take},
    )
    rec = data.get("tepRecords") or {}
    rows = []
    for row in rec.get("data") or []:
        p = row.get("data") or {}
        st = p.get("stats") or {}
        rows.append({
            "teamNumber": p.get("teamNumber"),
            "teamName": (p.get("team") or {}).get("name") or "",
            "eventCode": p.get("eventCode"),
            "rank": st.get("rank"),
            "opr": (st.get("opr") or {}).get("totalPointsNp"),
        })
    return {"count": rec.get("count") or 0, "rankings": rows}
