"""Backend API tests. Upstream services are replaced by fakes: no network access."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import server
from engine import ftcscout
from engine.ftcscout import FTCScoutError


@pytest.fixture()
def client(monkeypatch):
    for key in ("FTC_API_USERNAME", "FTC_API_TOKEN", "TOA_API_KEY", "GOOGLE_API_KEY", "AI_ENABLED"):
        monkeypatch.delenv(key, raising=False)
    ftcscout.clear_cache()
    server._ai_budget.update(day="", used=0)
    return TestClient(server.app)


def test_health_reports_configuration_without_secrets(client, monkeypatch):
    monkeypatch.setenv("TOA_API_KEY", "secret-value")
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["season"] == 2026
    assert body["toa_configured"] is True and body["official_api_configured"] is False
    assert "secret-value" not in r.text


def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("season", ["27", "abcd", "1999", "9999"])
def test_season_validation(client, season):
    assert client.get(f"/api/ftcscout/events?season={season}").status_code == 422


def test_event_code_validation(client):
    assert client.get("/api/ftcscout/event/a$b/matches").status_code == 422


def test_first_api_requires_server_credentials(client):
    r = client.get("/api/ftc/events?season=2026")
    assert r.status_code == 503
    assert "FTC_API_USERNAME" in r.json()["detail"]


def test_events_failure_returns_error_field(client, monkeypatch):
    async def boom(season):
        raise FTCScoutError("down")

    monkeypatch.setattr(ftcscout, "list_events", boom)
    body = client.get("/api/ftcscout/events?season=2026").json()
    assert body["events"] == [] and body["error"] == "down"


def test_event_matches_proxy(client, monkeypatch):
    async def fake(season, code):
        assert (season, code) == (2026, "AUBRQ1")
        return {"name": "Brisbane", "matches": [{"level": "qual", "number": 1, "red": ["1", "2"], "blue": ["3", "4"], "played": False}]}

    monkeypatch.setattr(ftcscout, "get_event_matches", fake)
    r = client.get("/api/ftcscout/event/aubrq1/matches?season=2026")
    assert r.status_code == 200 and r.json()["matches"][0]["red"] == ["1", "2"]


def test_upstream_error_becomes_502(client, monkeypatch):
    async def fail(season, code):
        raise FTCScoutError("timeout")

    monkeypatch.setattr(ftcscout, "get_event_teams", fail)
    r = client.get("/api/ftcscout/event/ABC/teams")
    assert r.status_code == 502 and "timeout" in r.json()["detail"]


def test_rankings_take_is_bounded(client):
    assert client.get("/api/ftcscout/rankings?take=5000").status_code == 422


def test_unknown_api_path_is_json_404(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")


def test_ai_disabled_and_unconfigured(client, monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    assert client.post("/api/gemini/analyze-match", json={}).status_code == 503
    monkeypatch.setenv("AI_ENABLED", "true")
    r = client.post("/api/gemini/analyze-match", json={})
    assert r.status_code == 503 and "not configured" in r.json()["detail"]


def test_ai_input_is_validated(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    r = client.post("/api/gemini/analyze-match", json={"alliance1_teams": ["1", "2", "3", "4"]})
    assert r.status_code == 422


def test_ai_daily_budget(client, monkeypatch):
    import engine.gemini as gemini

    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    monkeypatch.setenv("AI_DAILY_LIMIT", "1")

    async def fake(*args):
        return {"result": {"recommendations": []}}

    monkeypatch.setattr(gemini, "get_alliance_recommendation", fake)
    body = {"available_teams": ["1"], "my_team": "2"}
    assert client.post("/api/gemini/alliance-recommendation", json=body).status_code == 200
    assert client.post("/api/gemini/alliance-recommendation", json=body).status_code == 429


@pytest.mark.anyio
async def test_cached_loader_runs_once():
    ftcscout.clear_cache()
    calls = []

    async def load():
        calls.append(1)
        return 42

    assert await ftcscout.cached("k", 60, load) == 42
    assert await ftcscout.cached("k", 60, load) == 42
    assert len(calls) == 1
