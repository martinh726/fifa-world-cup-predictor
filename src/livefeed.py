"""Live match data from football-data.org v4 API.

Free tier: 10 req/min. The app refreshes every 30 s — well within limits.
API key setup: copy .streamlit/secrets.toml.example → .streamlit/secrets.toml
and paste your key. Get one free at https://www.football-data.org/
"""
from __future__ import annotations

import os
from datetime import date

import requests

from src.data_loader import load_wc2026

_BASE = "https://api.football-data.org/v4"
_COMPETITION = "WC"

# football-data.org uses slightly different spellings — map them to our canonical names.
_EXTRA_ALIASES: dict[str, str] = {
    "Korea Republic": "South Korea",
    "USA": "United States",
    "Cabo Verde": "Cape Verde",
    "Congo DR": "DR Congo",
    "Türkiye": "Turkey",
    "Czechia": "Czech Republic",
    "Côte d'Ivoire": "Ivory Coast",
    "Curaçao": "Curacao",
    "Bosnia and Herzegovina": "Bosnia and Herzegovina",
}


def _alias_map() -> dict[str, str]:
    config = load_wc2026()
    m: dict[str, str] = {}
    for canonical, variants in config.get("team_aliases", {}).items():
        for v in variants:
            m[v] = canonical
    m.update(_EXTRA_ALIASES)
    return m


def _norm(name: str, aliases: dict[str, str]) -> str:
    return aliases.get(name, name)


def _headers(api_key: str) -> dict:
    return {"X-Auth-Token": api_key}


def _parse_match(m: dict, aliases: dict[str, str]) -> dict:
    """Extract the fields we care about from a football-data.org match object."""
    score = m.get("score", {})
    # Prefer regularTime, fall back to fullTime, then halfTime
    for key in ("regularTime", "fullTime", "halfTime"):
        s = score.get(key, {})
        if s and s.get("home") is not None:
            gh, ga = s["home"], s["away"]
            break
    else:
        gh, ga = 0, 0

    minute = m.get("minute") or 0
    # football-data.org sometimes puts e.g. "90+3" in injuryTime field
    injury = m.get("injuryTime") or 0
    if minute >= 90:
        minute = 90 + int(injury)

    return {
        "id": m["id"],
        "home": _norm(m["homeTeam"]["name"], aliases),
        "away": _norm(m["awayTeam"]["name"], aliases),
        "score_home": int(gh),
        "score_away": int(ga),
        "minute": int(minute),
        "status": m.get("status", "UNKNOWN"),
        "utc_date": m.get("utcDate", ""),
    }


def fetch_live_matches(api_key: str) -> tuple[list[dict], str | None]:
    """Return (live_matches, error_or_None) for all currently live WC 2026 matches.

    Uses a single Session so IN_PLAY and PAUSED share one SSL connection,
    avoiding SSL EOF errors from rapid back-to-back HTTPS handshakes.
    Only reports an error when zero matches were found AND a request failed.
    """
    aliases = _alias_map()
    seen: set[int] = set()
    results: list[dict] = []
    first_error: str | None = None

    with requests.Session() as session:
        session.headers.update(_headers(api_key))
        for status in ("IN_PLAY", "PAUSED"):
            try:
                resp = session.get(
                    f"{_BASE}/competitions/{_COMPETITION}/matches",
                    params={"status": status},
                    timeout=10,
                )
                if resp.status_code == 429:
                    first_error = first_error or "Rate limited — try again in a moment."
                    continue
                if resp.status_code == 403:
                    first_error = first_error or "API key rejected or plan does not cover this competition."
                    continue
                resp.raise_for_status()
                for m in resp.json().get("matches", []):
                    parsed = _parse_match(m, aliases)
                    if parsed["id"] not in seen:
                        seen.add(parsed["id"])
                        results.append(parsed)
            except requests.Timeout:
                first_error = first_error or "Request timed out."
            except Exception as e:
                first_error = first_error or str(e)

    # Only surface an error when we have nothing to show
    return results, (first_error if not results else None)


def fetch_todays_matches(api_key: str) -> list[dict]:
    """Return today's upcoming WC 2026 matches (not yet kicked off)."""
    aliases = _alias_map()
    today = date.today().isoformat()
    try:
        resp = requests.get(
            f"{_BASE}/competitions/{_COMPETITION}/matches",
            params={"dateFrom": today, "dateTo": today, "status": "SCHEDULED"},
            headers=_headers(api_key),
            timeout=10,
        )
        resp.raise_for_status()
        matches = resp.json().get("matches", [])
        # API returns TIMED records under SCHEDULED umbrella; filter out non-upcoming
        return [_parse_match(m, aliases) for m in matches
                if m.get("status") in ("TIMED", "SCHEDULED")]
    except Exception:
        return []


def get_api_key() -> str | None:
    """Read API key from Streamlit secrets or environment variable."""
    try:
        import streamlit as st
        return st.secrets["football_data"]["api_key"]
    except Exception:
        pass
    return os.environ.get("FOOTBALL_DATA_API_KEY")
