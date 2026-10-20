"""Pair synergy: Hive vs Flower complementarity, auto collision, reliability."""

from __future__ import annotations

from collections import Counter
from typing import Any

from .stats import team_stats


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def role_label(stats: dict[str, Any]) -> str:
    hive = stats["profile"]["hive"]
    flower = stats["profile"]["flower"]
    auto = stats["profile"]["auto"]
    if hive >= flower + 12 and hive >= 45:
        return "Hive-специалист"
    if flower >= hive + 12 and flower >= 40:
        return "Flower / Endgame-специалист"
    if auto >= 55 and hive >= 40:
        return "Auto-Hive"
    return "Сбалансированный"


def _mode_traj(values: list[str]) -> str:
    filtered = [v for v in values if v and v != "unknown"]
    if not filtered:
        return "unknown"
    return Counter(filtered).most_common(1)[0][0]


def collision_check(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    ta, tb = _mode_traj(a.get("trajectories") or []), _mode_traj(b.get("trajectories") or [])
    both_auto = a["profile"]["auto"] >= 48 and b["profile"]["auto"] >= 48
    same_lane = ta == tb and ta not in {"unknown", "wall"}
    hive_overlap = a["autoTips"] >= 1.1 and b["autoTips"] >= 1.1
    risk = 0.0
    reasons: list[str] = []
    if same_lane and both_auto:
        risk += 42
        reasons.append(f"Одинаковая траектория автонома ({ta}): риск столкновения на старте.")
    if hive_overlap:
        risk += 28
        reasons.append("Оба робота активно TIP-ят HIVE в Auto — конкуренция за одну конструкцию.")
    if both_auto and not same_lane and ta != "unknown" and tb != "unknown":
        risk += 8
        reasons.append("Оба сильные в Auto, но разные зоны — столкновение менее вероятно.")
    risk = _clamp(risk, 0, 100)
    if not reasons:
        reasons.append("По скаутингу нет явного пересечения автономов. Это оценка, не гарантия.")
    return {"score": round(risk, 1), "level": "high" if risk >= 55 else "medium" if risk >= 28 else "low", "reasons": reasons, "lanes": [ta, tb]}


def pair_model(team_a: dict[str, Any], team_b: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any] | None:
    a = team_stats(team_a, records)
    b = team_stats(team_b, records)
    keys = ["auto", "hive", "flower", "reliability"]
    cover = sum(max(a["profile"][k], b["profile"][k]) for k in keys) / 4
    complement = sum(abs(a["profile"][k] - b["profile"][k]) for k in keys) / 4
    hive_flower = abs(a["profile"]["hive"] - b["profile"]["hive"]) * 0.35 + abs(a["profile"]["flower"] - b["profile"]["flower"]) * 0.35
    data_factor = min(1.0, (a["count"] + b["count"]) / 12)
    stability = (a["consistency"] + b["consistency"]) / 2
    dnf_penalty = (a["dnf"] + b["dnf"]) * 18
    collision = collision_check(a, b)
    score = _clamp(
        cover * 0.42 + hive_flower * 0.22 + complement * 0.08 + stability * 0.16 + data_factor * 14 - dnf_penalty - collision["score"] * 0.12,
        0,
        100,
    )
    synergy_pts = round((score - 50) * 0.12, 1)
    roles = [role_label(a), role_label(b)]
    complementary = ("Hive" in roles[0] and "Flower" in roles[1]) or ("Hive" in roles[1] and "Flower" in roles[0])
    return {
        "a": a,
        "b": b,
        "score": round(score, 1),
        "cover": round(cover, 1),
        "complement": round(complement, 1),
        "stability": round(stability, 1),
        "mean": max(0.0, a["mean"] + b["mean"] + synergy_pts),
        "sd": (a["sd"] ** 2 + b["sd"] ** 2 + 25) ** 0.5,
        "collision": collision,
        "roles": roles,
        "complementaryRoles": complementary,
        "dnfIndex": round((a["dnf"] + b["dnf"]) / 2, 3),
        "modelNote": "Индекс сравнивает покрытие задач и надёжность по скаутингу. Это не вероятность победы и не официальный рейтинг FIRST.",
    }
