"""Observed-contribution scoring for FTC BIOBUZZ (Competition Manual TU05, 15.10.2026).

This is a scouted-action estimate, not an official match score. Alliance-owned
FLOWER and GARDEN points must not be double-counted across two robot sheets.
"""

from __future__ import annotations

from typing import Any

MODEL_VERSION = "BIOBUZZ TU05 · 15.10.2026"


def _n(value: Any, default: float = 0.0) -> float:
    try:
        x = float(value)
    except (TypeError, ValueError):
        return default
    return x if x == x else default


def _b(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "da", "да", "y"}


def breakdown(record: dict[str, Any]) -> dict[str, float]:
    auto = (_b(record.get("autoLeave")) * 3) + (_b(record.get("autoPark")) * 5) + _n(record.get("autoHiveTips")) * 20
    hive = _n(record.get("teleopHiveTips")) * 20 + _n(record.get("cellItems")) * 2
    flower = _n(record.get("ownedFlowerItems")) * 2 + _n(record.get("bottomNectar")) * 5
    field = _n(record.get("gardenItems")) + (_b(record.get("teleopPark")) * 5)
    foul = _n(record.get("penalties")) * 5
    total = max(0.0, auto + hive + flower + field - foul)
    return {"auto": auto, "hive": hive, "flower": flower, "field": field, "foul": foul, "total": total}


def contribution(record: dict[str, Any]) -> float:
    return breakdown(record)["total"]
