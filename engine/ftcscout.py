"""FTCScout.org GraphQL API integration.

Public API - no authentication required.
"""

from typing import Any, List
from gql import Client, gql
from gql.transport.aiohttp import AIOHTTPTransport
from httpx import Client as HTTPClient

# GraphQL client
GRAPHQL_URL = "https://api.ftcscout.org/graphql"
_http_client = HTTPClient()
_transport = AIOHTTPTransport(url=GRAPHQL_URL)
_client = Client(transport=_transport)


# GraphQL queries
TEAMS_SEARCH_QUERY = gql("""
query {
  teamsSearch {
    number
    name
  }
}
""")

TEAM_BY_NUMBER_QUERY = gql("""
query GetTeamByNumber($number: Int!) {
  teamByNumber(number: $number) {
    number
    name
    country
    state
    city
    rookieYear
  }
}
""")

MATCH_RECORDS_QUERY = gql("""
query GetMatchRecords($season: Int!, $teamNumber: Int!) {
  matchRecords(season: $season, teamNumber: $teamNumber) {
    allianceNumber
    allianceColor
    matchNumber
    matchType
    score
    scorePenalty
    scoreFinal
    teams {
      number
      name
    }
  }
}
""")

EVENTS_QUERY = gql("""
query GetEvents($season: Int!) {
  eventsOnDate(season: $season) {
    code
    name
    start
    end
    location
  }
}
""")

TEP_RECORDS_QUERY = gql("""
query GetTepRecords($season: Int!, $skip: Int, $take: Int) {
  tepRecords(season: $season, skip: $skip, take: $take) {
    teamNumber
    teamName
    epa
    opr
    dpr
    ccwm
  }
}
""")


async def get_all_teams() -> List[dict[str, Any]]:
    """Fetch all teams from FTCScout."""
    try:
        result = await _client.execute_async(TEAMS_SEARCH_QUERY)
        return result.get("teamsSearch", [])
    except Exception as e:
        print(f"Error fetching teams: {e}")
        return []


async def get_team_by_number(number: int) -> dict[str, Any] | None:
    """Fetch team details by number."""
    try:
        result = await _client.execute_async(TEAM_BY_NUMBER_QUERY, variable_values={"number": number})
        return result.get("teamByNumber")
    except Exception as e:
        print(f"Error fetching team {number}: {e}")
        return None


async def get_match_records(season: int, team_number: int) -> dict[str, Any] | None:
    """Fetch match records for a team."""
    try:
        result = await _client.execute_async(
            MATCH_RECORDS_QUERY,
            variable_values={"season": season, "teamNumber": team_number}
        )
        return result.get("matchRecords")
    except Exception as e:
        print(f"Error fetching match records: {e}")
        return None


async def get_events(season: int) -> List[dict[str, Any]]:
    """Fetch events for a season."""
    try:
        result = await _client.execute_async(EVENTS_QUERY, variable_values={"season": season})
        return result.get("eventsOnDate", [])
    except Exception as e:
        print(f"Error fetching events: {e}")
        return []


async def get_tep_records(season: int, skip: int = 0, take: int = 100) -> List[dict[str, Any]]:
    """Fetch TEP records for ranking."""
    try:
        result = await _client.execute_async(
            TEP_RECORDS_QUERY,
            variable_values={"season": season, "skip": skip, "take": take}
        )
        return result.get("tepRecords", [])
    except Exception as e:
        print(f"Error fetching TEP records: {e}")
        return []
