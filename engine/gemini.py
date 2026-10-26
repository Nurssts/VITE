"""Google Gemini AI integration for match and alliance analysis.

Requires GOOGLE_API_KEY environment variable.
"""

from typing import Any, List
import google.generativeai as genai
from pydantic import BaseModel

class MatchAnalysisRequest(BaseModel):
    alliance1_teams: List[str]
    alliance2_teams: List[str]
    scout_data: str
    season: str = "2026-2027"

class AllianceRecommendation(BaseModel):
    alliance: str
    reasoning: str
    synergy_score: float
    risks: List[str]
    confidence: float


async def analyze_match_with_gemini(
    alliance1_teams: List[str],
    alliance2_teams: List[str],
    scout_data: str,
    season: str = "2026-2027"
) -> dict[str, Any]:
    """Use Gemini AI to analyze match data and provide insights."""
    try:
        genai.configure(api_key=None)  # Will read from GOOGLE_API_KEY env var
        model = genai.GenerativeModel('gemini-1.5-pro')
        
        prompt = f"""
You are an FTC Robotics expert analyzing BioBuzz season match data.

SEASON: {season}

ALLIANCE 1 TEAMS: {', '.join(alliance1_teams)}
ALLIANCE 2 TEAMS: {', '.join(alliance2_teams)}

SCOUT DATA:
{scout_data}

Please provide:
1. A detailed analysis of both alliances
2. Synergy score (0-100) for each alliance
3. Key risks and bottlenecks
4. Recommended alliance strategy
5. Confidence level in your analysis (0-100)

Format as JSON with keys: analysis, synergy_alliance1, synergy_alliance2, risks, strategy, confidence
"""
        
        response = model.generate_content(prompt)
        return {
            "analysis": response.text,
            "alliance1_teams": alliance1_teams,
            "alliance2_teams": alliance2_teams,
            "season": season
        }
    except Exception as e:
        print(f"Gemini API error: {e}")
        return {
            "error": str(e),
            "alliance1_teams": alliance1_teams,
            "alliance2_teams": alliance2_teams
        }


async def get_alliance_recommendation(
    available_teams: List[str],
    my_team: str,
    season: str = "2026-2027"
) -> dict[str, Any]:
    """Use Gemini AI to recommend alliance partners."""
    try:
        genai.configure(api_key=None)
        model = genai.GenerativeModel('gemini-1.5-pro')
        
        prompt = f"""
You are an FTC Robotics expert recommending alliance partners for BioBuzz season.

MY TEAM: {my_team}
AVAILABLE TEAMS: {', '.join(available_teams)}
SEASON: {season}

Based on typical FTC BioBuzz roles (Hive specialist, Flower specialist, balanced, etc.), recommend:
1. Top 3 alliance partners
2. Reasoning for each recommendation
3. Synergy compatibility scores (0-100)
4. Potential risks

Format as JSON with keys: recommendations (array with team, reasoning, synergy_score, risks)
"""
        
        response = model.generate_content(prompt)
        return {
            "recommendation": response.text,
            "my_team": my_team,
            "available_teams": available_teams,
            "season": season
        }
    except Exception as e:
        print(f"Gemini API error: {e}")
        return {
            "error": str(e),
            "my_team": my_team,
            "available_teams": available_teams
        }
