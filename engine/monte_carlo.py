from __future__ import annotations

import math
import random
from typing import Any

from .synergy import pair_model


def _normal(rng: random.Random) -> float:
    u, v = 0.0, 0.0
    while u == 0:
        u = rng.random()
    while v == 0:
        v = rng.random()
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


def simulate_match(
    red: tuple[dict[str, Any], dict[str, Any]],
    blue: tuple[dict[str, Any], dict[str, Any]],
    records: list[dict[str, Any]],
    iterations: int = 1000,
    seed: int | None = None,
) -> dict[str, Any]:
    left = pair_model(red[0], red[1], records)
    right = pair_model(blue[0], blue[1], records)
    if not left or not right:
        raise ValueError("Need four valid teams with identities.")
    n = max(200, min(int(iterations), 20000))
    rng = random.Random(seed)
    wins = loss = ties = 0
    diffs: list[float] = []
    flower_loss = hive_loss = auto_loss = 0
    for _ in range(n):
        collision_hit = rng.random() < (left["collision"]["score"] / 220)
        x = left["mean"] + _normal(rng) * left["sd"]
        y = right["mean"] + _normal(rng) * right["sd"]
        if collision_hit:
            x -= 18 + rng.random() * 12
        diffs.append(x - y)
        if abs(x - y) < 1:
            ties += 1
        elif x > y:
            wins += 1
        else:
            loss += 1
            if (left["a"]["flower"] + left["b"]["flower"]) < (right["a"]["flower"] + right["b"]["flower"]):
                flower_loss += 1
            if (left["a"]["hive"] + left["b"]["hive"]) < (right["a"]["hive"] + right["b"]["hive"]):
                hive_loss += 1
            if (left["a"]["auto"] + left["b"]["auto"]) < (right["a"]["auto"] + right["b"]["auto"]):
                auto_loss += 1
    p = (wins + ties * 0.5) / n
    margin = 1.96 * math.sqrt(max(p * (1 - p), 1e-9) / n) * 100
    observations = left["a"]["count"] + left["b"]["count"] + right["a"]["count"] + right["b"]["count"]
    risks: list[str] = []
    if observations < 8:
        risks.append("Мало наблюдений: интервал неопределённости широкий. Решение драфта стоит сверять с живым скаутингом.")
    if loss:
        share = flower_loss / loss
        if share >= 0.55:
            risks.append(f"В {round(share * 100)}% смоделированных поражений у Альянса 1 слабее вклад в FLOWER (последняя минута).")
        if hive_loss / loss >= 0.55:
            risks.append(f"В {round(hive_loss / loss * 100)}% поражений узкое место — контроль HIVE.")
        if auto_loss / loss >= 0.5:
            risks.append("Частые поражения коррелируют с более слабым автономным периодом.")
    if left["collision"]["level"] != "low":
        risks.append("Autonomous Collision Check: " + left["collision"]["reasons"][0])
    if left["dnfIndex"] >= 0.08:
        risks.append("Индекс надёжности снижен: в скаутинге есть отключения/DNF. Закладывайте запас по стабильности.")
    if not risks:
        risks.append("Явного узкого места по профилям FLOWER/HIVE не видно. На исход могут влиять штрафы, защита и решения судей — модель их не гарантирует.")
    diffs_sorted = sorted(diffs)
    return {
        "iterations": n,
        "winPct": round(wins / n * 100, 1),
        "lossPct": round(loss / n * 100, 1),
        "tiePct": round(ties / n * 100, 1),
        "mean1": round(left["mean"], 1),
        "mean2": round(right["mean"], 1),
        "ciLow": round(max(0.0, p * 100 - margin), 1),
        "ciHigh": round(min(100.0, p * 100 + margin), 1),
        "medianDiff": round(diffs_sorted[n // 2], 1),
        "sdDiff": round((sum((d - sum(diffs) / n) ** 2 for d in diffs) / n) ** 0.5, 1),
        "diffSample": diffs[:: max(1, n // 80)][:80],
        "risks": risks,
        "synergy": {"red": left["score"], "blue": right["score"], "redRoles": left["roles"], "blueRoles": right["roles"]},
        "collision": left["collision"],
        "disclaimer": "Вероятности — результат нормальной модели по средним и σ скаутинга. Это не прогноз с гарантированной точностью.",
    }
