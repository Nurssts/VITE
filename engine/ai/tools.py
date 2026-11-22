"""Tool registry of the VITE Strategist.

Tools are EXECUTED IN THE BROWSER (frontend/src/lib/ai/tools.js) because scouting data never
leaves the device unless the model explicitly asks for a slice of it. The server only declares
them to the model. `kind` is informational here; the browser enforces confirmation itself:
  read    — runs automatically, returns data
  assist  — harmless local action (navigation, memory), runs automatically and is shown
  action  — changes scouting data / draft board, runs only after the user approves it
"""
from __future__ import annotations

from typing import Any

TEAM = {"type": "string", "description": "Team number, e.g. \"23334\"."}


def _obj(props: dict[str, Any] | None = None, required: list[str] | None = None) -> dict[str, Any]:
    return {"type": "object", "properties": props or {}, "required": required or []}


TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_event_overview",
        "kind": "read",
        "description": "Current event, number of teams and observations, scouting coverage, schedule progress, the user's team and draft state. Call this first when you need orientation.",
        "parameters": _obj(),
    },
    {
        "name": "get_rankings",
        "kind": "read",
        "description": "Teams ranked by a metric. score = scouting model contribution per match (shrunk toward the event mean when data is thin); opr = official OPR from alliance scores; auto/hive/flower/reliability = 0-100 profile axes.",
        "parameters": _obj(
            {
                "sort_by": {"type": "string", "enum": ["score", "opr", "auto", "hive", "flower", "reliability", "matches"]},
                "limit": {"type": "integer", "minimum": 1, "maximum": 40},
            }
        ),
    },
    {
        "name": "get_team",
        "kind": "read",
        "description": "Full profile of one team: model score ± sd, role, 0-100 profile, DNF and parking rates, cycle metrics, OPR, official win/loss, per-match breakdown, scout notes and upcoming matches.",
        "parameters": _obj({"team": TEAM}, ["team"]),
    },
    {
        "name": "compare_alliance",
        "kind": "read",
        "description": "Synergy of a two-team alliance: synergy index 0-100, coverage, roles, complementarity, autonomous collision risk with reasons, expected combined points ± sd.",
        "parameters": _obj({"teams": {"type": "array", "items": TEAM, "minItems": 2, "maxItems": 2}}, ["teams"]),
    },
    {
        "name": "simulate_match",
        "kind": "read",
        "description": "Monte-Carlo simulation of red vs blue (2 teams each): win/loss/tie %, 95% credible interval for P(red wins), mean scores and the main risks.",
        "parameters": _obj(
            {
                "red": {"type": "array", "items": TEAM, "minItems": 2, "maxItems": 2},
                "blue": {"type": "array", "items": TEAM, "minItems": 2, "maxItems": 2},
            },
            ["red", "blue"],
        ),
    },
    {
        "name": "get_schedule",
        "kind": "read",
        "description": "Official match schedule/results of the event with a forecast per match (scouting model and OPR). filter: upcoming | played | all. Optionally only matches of one team.",
        "parameters": _obj(
            {
                "filter": {"type": "string", "enum": ["upcoming", "played", "all"]},
                "team": TEAM,
                "limit": {"type": "integer", "minimum": 1, "maximum": 40},
            }
        ),
    },
    {
        "name": "find_best_partners",
        "kind": "read",
        "description": "Rank possible alliance partners for a captain by synergy, excluding teams already taken on the draft board. Also returns the denial pick (the team that would most strengthen an opposing alliance).",
        "parameters": _obj({"captain": TEAM, "limit": {"type": "integer", "minimum": 1, "maximum": 20}}, ["captain"]),
    },
    {
        "name": "get_scouting_gaps",
        "kind": "read",
        "description": "Teams with too few observations, prioritised by their next scheduled match. Use it to plan which robots and matches to scout next.",
        "parameters": _obj({"limit": {"type": "integer", "minimum": 1, "maximum": 30}}),
    },
    {
        "name": "find_anomalies",
        "kind": "read",
        "description": "Data-quality review of the scouting records: duplicate entries for the same robot and match, statistical outliers (|z| > 2.5), impossible values, teams whose scouting disagrees strongly with official OPR.",
        "parameters": _obj(),
    },
    {
        "name": "search_records",
        "kind": "read",
        "description": "Raw scouting observations (with notes), filtered by team, match number and/or a text query in the notes. Newest first.",
        "parameters": _obj(
            {
                "team": TEAM,
                "match": {"type": "integer", "minimum": 1},
                "query": {"type": "string", "maxLength": 80},
                "limit": {"type": "integer", "minimum": 1, "maximum": 30},
            }
        ),
    },
    {
        "name": "remember",
        "kind": "assist",
        "description": "Save a durable fact the user stated about their own team or preferences to VITE memory. Store exactly what the user said, in the user's language, without adding anything. The user can see and delete memories.",
        "parameters": _obj({"fact": {"type": "string", "maxLength": 300}}, ["fact"]),
    },
    {
        "name": "open_page",
        "kind": "assist",
        "description": "Open a VITE screen for the user, optionally a team profile.",
        "parameters": _obj(
            {
                "page": {"type": "string", "enum": ["overview", "scouting", "matches", "teams", "analysis", "draft", "data"]},
                "team": TEAM,
            },
            ["page"],
        ),
    },
    {
        "name": "set_draft",
        "kind": "action",
        "description": "Set the captain and/or the chosen partner on the draft board. Requires user approval.",
        "parameters": _obj({"captain": TEAM, "partner": TEAM}),
    },
    {
        "name": "mark_teams_picked",
        "kind": "action",
        "description": "Mark teams as already picked by other alliances on the draft board (removes them from the pool). Requires user approval.",
        "parameters": _obj({"teams": {"type": "array", "items": TEAM, "minItems": 1, "maxItems": 12}}, ["teams"]),
    },
    {
        "name": "save_team_note",
        "kind": "action",
        "description": "Append (or replace) the strategy note of a team. Requires user approval.",
        "parameters": _obj(
            {"team": TEAM, "note": {"type": "string", "maxLength": 600}, "mode": {"type": "string", "enum": ["append", "replace"]}},
            ["team", "note"],
        ),
    },
    {
        "name": "add_observation",
        "kind": "action",
        "description": "Save one scouting observation of one robot in one match (counts are for that robot only). Requires user approval; the user sees the record before it is saved.",
        "parameters": _obj(
            {
                "team": TEAM,
                "match": {"type": "integer", "minimum": 1},
                "autoLeave": {"type": "boolean"},
                "autoPark": {"type": "boolean"},
                "autoHiveTips": {"type": "integer", "minimum": 0, "maximum": 10},
                "teleopHiveTips": {"type": "integer", "minimum": 0, "maximum": 30},
                "cellItems": {"type": "integer", "minimum": 0, "maximum": 50},
                "flowerPlaced": {"type": "integer", "minimum": 0, "maximum": 50},
                "ownedFlowerItems": {"type": "integer", "minimum": 0, "maximum": 50},
                "bottomNectar": {"type": "integer", "minimum": 0, "maximum": 4},
                "gardenItems": {"type": "integer", "minimum": 0, "maximum": 50},
                "teleopPark": {"type": "boolean"},
                "penalties": {"type": "integer", "minimum": 0, "maximum": 20},
                "disabled": {"type": "boolean"},
                "notes": {"type": "string", "maxLength": 400},
            },
            ["team"],
        ),
    },
]

TOOL_NAMES = {t["name"] for t in TOOLS}


def declarations() -> list[dict[str, Any]]:
    """Provider-neutral tool declarations (name, description, JSON-schema parameters)."""
    return [{"name": t["name"], "description": t["description"], "parameters": t["parameters"]} for t in TOOLS]


def public_list() -> list[dict[str, str]]:
    return [{"name": t["name"], "kind": t["kind"]} for t in TOOLS]
