from __future__ import annotations

import math
from typing import Any

from .scoring import breakdown


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _sd(values: list[float]) -> float:
    if len(values) < 2:
        return max(4.0, (values[0] * 0.17) if values else 0.0)
    mean = _avg(values)
    return math.sqrt(_avg([(x - mean) ** 2 for x in values]))


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def team_stats(team: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    rows = [r for r in records if str(r.get("teamId")) == str(team.get("id"))]
    parts = [breakdown(r) for r in rows]
    totals = [p["total"] for p in parts]
    count = len(rows)
    mean = _avg(totals)
    spread = _sd(totals)
    auto = _avg([p["auto"] for p in parts])
    hive = _avg([p["hive"] for p in parts])
    flower = _avg([p["flower"] for p in parts])
    field = _avg([p["field"] for p in parts])
    dnf = (sum(1 for r in rows if r.get("disabled")) / count) if count else 0.0
    park = (sum(1 for r in rows if r.get("teleopPark")) / count) if count else 0.0
    hive_ok = _avg([float(r.get("hiveSuccess") or (0 if r.get("disabled") else 70)) for r in rows]) if rows else 0.0
    trajectories = [str(r.get("autoTrajectory") or "unknown") for r in rows]
    consistency = _clamp(100 - spread / max(25.0, mean or 25) * 100, 15, 98)
    profile = {
        "auto": _clamp(auto / 30 * 100, 0, 100),
        "hive": _clamp(hive / 60 * 100, 0, 100),
        "flower": _clamp(flower / 35 * 100, 0, 100),
        "reliability": _clamp((100 - min(spread / max(1.0, mean) * 100, 70)) * (1 - dnf), 0, 100),
    }
    return {
        "team": team,
        "count": count,
        "mean": mean,
        "sd": spread,
        "auto": auto,
        "hive": hive,
        "flower": flower,
        "field": field,
        "dnf": dnf,
        "parkRate": park,
        "hiveSuccess": hive_ok,
        "trajectories": trajectories,
        "consistency": consistency,
        "profile": profile,
        "autoTips": _avg([float(r.get("autoHiveTips") or 0) for r in rows]),
        "teleopTips": _avg([float(r.get("teleopHiveTips") or 0) for r in rows]),
        "pollenCycle": _avg([float(r.get("pollenCycleSec") or 0) for r in rows if r.get("pollenCycleSec")]),
        "nectarCycle": _avg([float(r.get("nectarCycleSec") or 0) for r in rows if r.get("nectarCycleSec")]),
        "flowerAccuracy": _avg([float(r.get("flowerAccuracy") or 0) for r in rows if r.get("flowerAccuracy")]),
    }
