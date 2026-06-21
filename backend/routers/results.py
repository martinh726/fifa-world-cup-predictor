"""Results, standings, and Live Tracker data endpoints."""
from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends

from backend.cache import results_cache
from backend.deps import AppState, get_state
from backend.utils import (compute_goal_stats, merge_api_finished,
                            qual_scenario, third_place_race)
from src.livefeed import fetch_finished_matches, get_api_key
from src.tournament import standings

router = APIRouter()


def _build_standings_data(config: dict, all_played: list) -> dict:
    """Build per-group standings with status and scenarios."""
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}
    groups_started = sorted({group_of[t1] for t1, *_ in all_played if group_of.get(t1)})

    result = {}
    for letter in groups_started:
        teams = config["groups"][letter]
        ms = [m for m in all_played if group_of.get(m[0]) == letter]
        order = standings(teams, ms)
        scenarios = qual_scenario(teams, ms)

        stats_tbl = {t: {"played": 0, "pts": 0, "gd": 0, "gf": 0} for t in teams}
        for t1, t2, s1, s2 in ms:
            for t, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
                if t in stats_tbl:
                    stats_tbl[t]["played"] += 1
                    stats_tbl[t]["pts"] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                    stats_tbl[t]["gd"] += gf_ - ga_
                    stats_tbl[t]["gf"] += gf_

        from backend.utils import remaining_matches
        rem = remaining_matches(teams, ms)

        result[letter] = {
            "teams": [
                {
                    "team": t,
                    **stats_tbl[t],
                    "status": scenarios[t]["status"],
                    "message": scenarios[t]["message"],
                    "next_opponents": scenarios[t]["next_opponents"],
                    "rank": order.index(t) + 1,
                }
                for t in order
            ],
            "remaining_fixtures": [{"team1": a, "team2": b} for a, b in rem],
        }
    return result


@router.get("/results")
def get_results(state: AppState = Depends(get_state)):
    cached = results_cache.get()
    if cached is not None:
        return cached

    api_key = get_api_key()
    api_finished: list = []
    if api_key:
        try:
            api_finished = fetch_finished_matches(api_key)
        except Exception:
            pass

    group_results, ko_results = merge_api_finished(
        state.group_results, state.ko_results, api_finished, state.config
    )
    all_played = group_results

    standings_data = _build_standings_data(state.config, all_played)
    thirds = third_place_race(state.config, all_played)
    goal_stats = compute_goal_stats(all_played)

    # Format played matches for the frontend table
    group_of = {t: g for g, ts in state.config["groups"].items() for t in ts}
    played_list = [
        {"team1": t1, "team2": t2, "score1": s1, "score2": s2, "group": group_of.get(t1, "")}
        for t1, t2, s1, s2 in all_played
    ]
    ko_list = [
        {"team1": t1, "team2": t2, "winner": w}
        for t1, t2, w in ko_results
    ]

    result = {
        "group_results": played_list,
        "ko_results": ko_list,
        "standings": standings_data,
        "third_place_race": thirds,
        "goal_stats": goal_stats,
        "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    results_cache.set(result)
    return result
