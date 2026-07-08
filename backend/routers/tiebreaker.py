"""Tiebreaker scenario calculator for contested group-stage matches."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.deps import AppState, get_state
from backend.utils import fetch_api_finished, merge_api_finished, remaining_matches
from src.livefeed import get_api_key
from src.tournament import standings

router = APIRouter()


def _compute_stats(teams: list, matches: list) -> dict:
    stats = {t: {"pts": 0, "gd": 0, "gf": 0, "wins": 0, "played": 0} for t in teams}
    for t1, t2, s1, s2 in matches:
        for t, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
            if t in stats:
                stats[t]["played"] += 1
                stats[t]["pts"] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                stats[t]["gd"] += gf_ - ga_
                stats[t]["gf"] += gf_
                stats[t]["wins"] += 1 if gf_ > ga_ else 0
    return stats


def _standings_rows(teams: list, matches: list) -> list:
    order = standings(teams, matches) if matches else list(teams)
    stats = _compute_stats(teams, matches)
    return [{"team": t, "rank": order.index(t) + 1, **stats[t]} for t in order]


def _fixture_scenarios(teams: list, played: list, fix: tuple) -> dict:
    t1, t2 = fix
    out = {}
    for key, (s1, s2) in [("home_win", (1, 0)), ("draw", (1, 1)), ("away_win", (0, 1))]:
        sim = played + [(t1, t2, s1, s2)]
        out[key] = _standings_rows(teams, sim)
    return out


@router.get("/tiebreaker")
def get_tiebreaker(state: AppState = Depends(get_state)):
    api_finished = fetch_api_finished(get_api_key())
    group_results, _ = merge_api_finished(
        state.group_results, state.ko_results, api_finished, state.config
    )

    group_of = {t: g for g, ts in state.config["groups"].items() for t in ts}
    result: dict = {}

    for letter, teams in sorted(state.config["groups"].items()):
        ms = [m for m in group_results if group_of.get(m[0]) == letter]
        rem = remaining_matches(teams, ms)

        current = _standings_rows(teams, ms)

        # Identify ties in current standings (teams equal on pts, gd, gf)
        tied_pairs: list = []
        stats = _compute_stats(teams, ms)
        for i in range(len(current) - 1):
            a, b = current[i]["team"], current[i + 1]["team"]
            sa, sb = stats[a], stats[b]
            if sa["pts"] == sb["pts"] and sa["gd"] == sb["gd"] and sa["gf"] == sb["gf"]:
                tied_pairs.append([a, b])

        fixtures = [
            {
                "team1": fix[0],
                "team2": fix[1],
                "scenarios": _fixture_scenarios(teams, ms, fix),
            }
            for fix in rem
        ]

        result[letter] = {
            "current_standings": current,
            "fixtures": fixtures,
            "games_played": len(ms),
            "games_remaining": len(rem),
            "tied_pairs": tied_pairs,
        }

    active = {k: v for k, v in result.items() if v["games_remaining"] > 0}
    return {
        "groups": result,
        "active_groups": active,
        "all_done": len(active) == 0,
    }
