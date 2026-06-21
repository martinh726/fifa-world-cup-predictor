"""Team Focus endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.deps import AppState, get_state
from backend.utils import merge_api_finished, qual_scenario
from src.livefeed import fetch_finished_matches, fetch_scheduled_matches, get_api_key
from src.tournament import standings

router = APIRouter()


@router.get("/team/{name}")
def get_team(name: str, state: AppState = Depends(get_state)):
    config = state.config
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}

    if name not in group_of:
        raise HTTPException(404, f"Team '{name}' not found in WC 2026")

    # Merge API results
    api_key = get_api_key()
    api_finished: list = []
    if api_key:
        try:
            api_finished = fetch_finished_matches(api_key)
        except Exception:
            pass
    group_results, ko_results = merge_api_finished(
        state.group_results, state.ko_results, api_finished, config
    )

    # Group info
    group_letter = group_of[name]
    group_teams = config["groups"][group_letter]
    group_ms = [m for m in group_results if group_of.get(m[0]) == group_letter]
    order = standings(group_teams, group_ms)
    scenarios = qual_scenario(group_teams, group_ms)

    stats_tbl = {t: {"played": 0, "pts": 0, "gd": 0, "gf": 0} for t in group_teams}
    for t1, t2, s1, s2 in group_ms:
        for t, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
            if t in stats_tbl:
                stats_tbl[t]["played"] += 1
                stats_tbl[t]["pts"] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                stats_tbl[t]["gd"] += gf_ - ga_
                stats_tbl[t]["gf"] += gf_

    group_standing = [
        {
            "team": t,
            **stats_tbl[t],
            "status": scenarios[t]["status"],
            "is_focus": t == name,
            "rank": order.index(t) + 1,
        }
        for t in order
    ]

    # WC 2026 results for this team
    wc_results = []
    for t1, t2, s1, s2 in group_results:
        if name not in (t1, t2):
            continue
        opp = t2 if t1 == name else t1
        gf = s1 if t1 == name else s2
        ga = s2 if t1 == name else s1
        res = "W" if gf > ga else ("D" if gf == ga else "L")
        wc_results.append({"opponent": opp, "goals_for": gf, "goals_against": ga, "result": res})

    # Elo rating
    elo = None
    if state.predictor:
        elo = round(state.predictor.ratings.get(name, 1500.0), 1)

    # Championship odds from last sim
    championship_odds = None
    bracket_path = None
    if state.last_sim_result:
        summary = state.last_sim_result.get("summary", [])
        for row in summary:
            if row["team"] == name:
                championship_odds = {k: v for k, v in row.items() if k != "team"}
                break

        # Predicted bracket path: find matches where this team is team1 or team2 winner
        bracket = state.last_sim_result.get("bracket", {})
        path = []
        for match_data in sorted(bracket.values(), key=lambda x: x.get("match", 0)):
            t1, t2, winner = match_data.get("team1"), match_data.get("team2"), match_data.get("winner")
            if name not in (t1, t2):
                continue
            if winner != name:
                break
            opp = t2 if t1 == name else t1
            path.append({
                "stage": match_data.get("stage"),
                "match": match_data.get("match"),
                "opponent": opp,
                "win_prob": match_data.get("win_prob"),
                "winner": winner,
            })
        bracket_path = path if path else None

    # Next match from schedule
    next_match = None
    if api_key:
        try:
            upcoming = fetch_scheduled_matches(api_key, days=30)
            for m in upcoming:
                if name in (m.get("home"), m.get("away")):
                    next_match = dict(m)
                    if state.predictor:
                        try:
                            p = state.predictor.predict(m["home"], m["away"], neutral=True, injuries={})
                            next_match["prediction"] = {
                                "p_home": round(p["p_home"], 4),
                                "p_draw": round(p["p_draw"], 4),
                                "p_away": round(p["p_away"], 4),
                            }
                        except Exception:
                            pass
                    break
        except Exception:
            pass

    return {
        "team": name,
        "group": group_letter,
        "flag_code": config.get("flags", {}).get(name),
        "elo": elo,
        "group_standing": group_standing,
        "wc2026_results": wc_results,
        "championship_odds": championship_odds,
        "bracket_path": bracket_path,
        "next_match": next_match,
    }
