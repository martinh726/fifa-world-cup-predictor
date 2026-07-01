"""Live match data from football-data.org v4 API.

Free tier: 10 req/min. The app refreshes every 30 s — well within limits.
API key setup: copy .streamlit/secrets.toml.example → .streamlit/secrets.toml
and paste your key. Get one free at https://www.football-data.org/
"""
from __future__ import annotations

import functools
import logging
import os
from datetime import date, datetime, timezone

import requests

from src.data_loader import load_wc2026

_log = logging.getLogger(__name__)

_BASE = "https://api.football-data.org/v4"
_COMPETITION = "WC"

# football-data.org uses slightly different spellings — map them to our canonical names.
_EXTRA_ALIASES: dict[str, str] = {
    "Korea Republic": "South Korea",
    "USA": "United States",
    "Cabo Verde": "Cape Verde",
    "Cape Verde Islands": "Cape Verde",
    "Congo DR": "DR Congo",
    "Türkiye": "Turkey",
    "Czechia": "Czech Republic",
    "Côte d'Ivoire": "Ivory Coast",
    "Curaçao": "Curacao",
    "Bosnia and Herzegovina": "Bosnia and Herzegovina",
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
}


@functools.lru_cache(maxsize=1)
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


_HT_BREAK_MIN = 15   # assumed half-time break length
_HT_BUFFER_MIN = 47  # first half ends ~45+2 stoppage before HT whistle


def _estimate_minute(utc_date_str: str, status: str) -> int:
    """Estimate match minute from scheduled kick-off time.

    The free tier of football-data.org does not return a live minute field,
    so we derive it from elapsed real time since kick-off, subtracting the
    half-time break once first-half stoppage has been accounted for.
    """
    if not utc_date_str or status == "PAUSED":
        return 45
    try:
        kickoff = datetime.fromisoformat(utc_date_str.replace("Z", "+00:00"))
        elapsed = max(0.0, (datetime.now(timezone.utc) - kickoff).total_seconds() / 60)
        if elapsed <= _HT_BUFFER_MIN:
            return min(45, int(elapsed))
        if elapsed <= _HT_BUFFER_MIN + _HT_BREAK_MIN:
            return 45  # still in half-time break
        return min(90, 45 + int(elapsed - _HT_BUFFER_MIN - _HT_BREAK_MIN))
    except Exception:
        return 45


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

    status = m.get("status", "UNKNOWN")
    # Free tier returns minute=None; derive from elapsed kick-off time instead
    api_minute = m.get("minute")
    if api_minute is not None:
        injury = m.get("injuryTime") or 0
        minute = int(api_minute) + (int(injury) if int(api_minute) >= 90 else 0)
    else:
        minute = _estimate_minute(m.get("utcDate", ""), status)

    return {
        "id": m["id"],
        "home": _norm(m["homeTeam"]["name"], aliases),
        "away": _norm(m["awayTeam"]["name"], aliases),
        "score_home": int(gh),
        "score_away": int(ga),
        "minute": minute,
        "minute_estimated": api_minute is None,
        "status": status,
        "utc_date": m.get("utcDate", ""),
        "stage": m.get("stage", ""),
        "matchday": m.get("matchday"),
        "group": m.get("group", "") or "",
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


def fetch_finished_matches(api_key: str) -> list[dict]:
    """Return all FINISHED WC 2026 matches from the API.

    Used to supplement the community CSV dataset, which can lag by hours.
    """
    aliases = _alias_map()
    try:
        with requests.Session() as session:
            session.headers.update(_headers(api_key))
            resp = session.get(
                f"{_BASE}/competitions/{_COMPETITION}/matches",
                params={"status": "FINISHED"},
                timeout=15,
            )
            resp.raise_for_status()
            return [_parse_match(m, aliases) for m in resp.json().get("matches", [])]
    except Exception as e:
        _log.warning("fetch_finished_matches failed: %s", e)
        return []


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
    except Exception as e:
        _log.warning("fetch_todays_matches failed: %s", e)
        return []


def get_api_key() -> str | None:
    """Read football-data.org API key from Streamlit secrets or environment variable."""
    try:
        import streamlit as st
        key = st.secrets["football_data"]["api_key"]
        return key.strip() or None
    except Exception:
        pass
    key = os.environ.get("FOOTBALL_DATA_API_KEY")
    return key.strip() if key else None


# ── API-Football (RapidAPI) — exact live match minute ────────────────────────

_AF_BASE = "https://v3.football.api-sports.io"
_AF_WC_LEAGUE_ID = 1  # FIFA World Cup in API-Football

# Extra aliases specific to API-Football's team name spellings
_AF_ALIASES: dict[str, str] = {
    "Korea Republic": "South Korea",
    "United States": "United States",
    "Bosnia And Herzegovina": "Bosnia and Herzegovina",
    "Cape Verde Islands": "Cape Verde",
    "DR Congo": "DR Congo",
    "Ivory Coast": "Ivory Coast",
    "Curacao": "Curacao",
}


def fetch_apifootball_live(api_key: str) -> dict[str, dict]:
    """Fetch live WC 2026 matches from API-Football (RapidAPI).

    Returns a dict keyed by '{home}v{away}' mapping to match info with exact
    minute and fixture_id (needed to fetch per-match statistics).
    """
    aliases = {**_alias_map(), **_AF_ALIASES}
    try:
        resp = requests.get(
            f"{_AF_BASE}/fixtures",
            params={"live": "all"},
            headers={"x-apisports-key": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        results: dict[str, dict] = {}
        for f in resp.json().get("response", []):
            league = f.get("league", {})
            if league.get("id") != _AF_WC_LEAGUE_ID and "World Cup" not in league.get("name", ""):
                continue
            status_info = f.get("fixture", {}).get("status", {})
            short = status_info.get("short", "")
            if short not in ("1H", "2H", "HT", "ET", "P", "BT"):
                continue
            teams = f.get("teams", {})
            goals = f.get("goals", {})
            home = _norm(teams.get("home", {}).get("name", ""), aliases)
            away = _norm(teams.get("away", {}).get("name", ""), aliases)
            minute = status_info.get("elapsed") or 0
            fixture_id = f.get("fixture", {}).get("id")
            key = f"{home}v{away}"
            results[key] = {
                "home": home,
                "away": away,
                "score_home": goals.get("home") or 0,
                "score_away": goals.get("away") or 0,
                "minute": int(minute),
                "status_short": short,
                "fixture_id": fixture_id,
            }
        return results
    except Exception as e:
        _log.warning("fetch_apifootball_live failed: %s", e)
        return {}


# Per-fixture stats cache: fixture_id → (stats_dict, expires_at)
# TTL of 120 s keeps API usage low even when multiple users poll every 30 s.
_stats_cache: dict[int, tuple[dict, float]] = {}
_STATS_TTL = 120.0


def _parse_stat(stats_list: list, stat_type: str) -> int | float | None:
    """Extract a numeric value from API-Football's statistics list."""
    for s in stats_list:
        if s.get("type") == stat_type:
            v = s.get("value")
            if v is None:
                return None
            if isinstance(v, str):
                v = v.replace("%", "").strip()
                try:
                    return float(v)
                except ValueError:
                    return None
            return v
    return None


def fetch_apifootball_stats(api_key: str, fixture_id: int) -> dict | None:
    """Return live match statistics for a single API-Football fixture.

    Caches per fixture_id for _STATS_TTL seconds to limit API quota usage.
    Returns None if unavailable or the fixture hasn't started yet.
    """
    import time
    cached_val, expires = _stats_cache.get(fixture_id, (None, 0.0))
    if time.time() < expires and cached_val is not None:
        return cached_val

    try:
        resp = requests.get(
            f"{_AF_BASE}/fixtures/statistics",
            params={"fixture": fixture_id},
            headers={"x-apisports-key": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json().get("response", [])
        if len(data) < 2:
            return None

        def team_stats(entry: dict) -> dict:
            sl = entry.get("statistics", [])
            poss_raw = _parse_stat(sl, "Ball Possession")
            return {
                "possession":       int(poss_raw) if poss_raw is not None else None,
                "shots_on_target":  _parse_stat(sl, "Shots on Goal"),
                "total_shots":      _parse_stat(sl, "Total Shots"),
                "passes":           _parse_stat(sl, "Total passes"),
                "passes_accurate":  _parse_stat(sl, "Passes accurate"),
                "corners":          _parse_stat(sl, "Corner Kicks"),
                "fouls":            _parse_stat(sl, "Fouls"),
                "yellow_cards":     _parse_stat(sl, "Yellow Cards"),
                "red_cards":        _parse_stat(sl, "Red Cards"),
                "saves":            _parse_stat(sl, "Goalkeeper Saves"),
                "xg":               _parse_stat(sl, "expected_goals"),
            }

        result = {"home": team_stats(data[0]), "away": team_stats(data[1])}
        _stats_cache[fixture_id] = (result, time.time() + _STATS_TTL)
        return result
    except Exception as e:
        _log.warning("fetch_apifootball_stats fixture=%s failed: %s", fixture_id, e)
        return None


def fetch_scheduled_matches(api_key: str, days: int = 30) -> list[dict]:
    """Return all upcoming scheduled WC 2026 matches for the next N days."""
    from datetime import timedelta
    aliases = _alias_map()
    date_from = date.today().isoformat()
    date_to = (date.today() + timedelta(days=days)).isoformat()
    try:
        resp = requests.get(
            f"{_BASE}/competitions/{_COMPETITION}/matches",
            params={"dateFrom": date_from, "dateTo": date_to},
            headers=_headers(api_key),
            timeout=10,
        )
        resp.raise_for_status()
        return [_parse_match(m, aliases) for m in resp.json().get("matches", [])
                if m.get("status") in ("TIMED", "SCHEDULED")]
    except Exception as e:
        _log.warning("fetch_scheduled_matches failed: %s", e)
        return []


def get_apifootball_key() -> str | None:
    """Read API-Football (RapidAPI) key from Streamlit secrets or environment variable."""
    try:
        import streamlit as st
        key = st.secrets["apifootball"]["api_key"]
        return key.strip() or None
    except Exception:
        pass
    key = os.environ.get("APIFOOTBALL_API_KEY")
    return key.strip() if key else None
