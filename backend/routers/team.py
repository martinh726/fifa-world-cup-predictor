"""Team Focus endpoint."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.cache import team_cache
from backend.deps import AppState, get_state
from backend.utils import fetch_api_finished, merge_api_finished, qual_scenario
from src.external_data import squad_metrics, squad_quality_score
from src.livefeed import fetch_scheduled_matches, get_api_key
from src.tournament import standings

router = APIRouter()
log = logging.getLogger(__name__)

# FIFA World Cup champions by year. The results dataset already canonicalizes
# "West Germany" to "Germany" (see src/data_loader._alias_map), so pre- and
# post-unification titles are counted together under "Germany" here too.
WC_CHAMPIONS: dict[int, str] = {
    1930: "Uruguay", 1934: "Italy", 1938: "Italy", 1950: "Uruguay",
    1954: "Germany", 1958: "Brazil", 1962: "Brazil", 1966: "England",
    1970: "Brazil", 1974: "Germany", 1978: "Argentina", 1982: "Italy",
    1986: "Argentina", 1990: "Germany", 1994: "Brazil", 1998: "France",
    2002: "Brazil", 2006: "Italy", 2010: "Spain", 2014: "Germany",
    2018: "France", 2022: "Argentina",
}


def _match_result(gf: int, ga: int) -> str:
    return "W" if gf > ga else ("D" if gf == ga else "L")


def team_form(results, name: str, n: int = 10) -> dict:
    """Last n competitive (non-friendly) matches, most recent first, plus a
    streak string like 'WWDLW' read left-to-right as most-recent-first."""
    mask = ((results["home_team"] == name) | (results["away_team"] == name)) & \
           (results["tournament"] != "Friendly")
    recent = results[mask].sort_values("date", ascending=False).head(n)

    matches = []
    for _, r in recent.iterrows():
        is_home = r["home_team"] == name
        gf = int(r["home_score"] if is_home else r["away_score"])
        ga = int(r["away_score"] if is_home else r["home_score"])
        opp = r["away_team"] if is_home else r["home_team"]
        matches.append({
            "date": str(r["date"])[:10], "opponent": opp,
            "goals_for": gf, "goals_against": ga,
            "result": _match_result(gf, ga), "tournament": str(r.get("tournament", "")),
        })
    return {"matches": matches, "streak": "".join(m["result"] for m in matches)}


def wc_history(results, name: str) -> dict:
    """All-time FIFA World Cup record (excludes the still-in-progress 2026 edition)."""
    wc = results[(results["tournament"] == "FIFA World Cup") & (results["date"] < "2026-01-01")]
    team_wc = wc[(wc["home_team"] == name) | (wc["away_team"] == name)]

    titles = sum(1 for champion in WC_CHAMPIONS.values() if champion == name)
    if team_wc.empty:
        return {"appearances": 0, "titles": titles, "matches_played": 0,
                "wins": 0, "draws": 0, "losses": 0}

    wins = draws = losses = 0
    for _, r in team_wc.iterrows():
        is_home = r["home_team"] == name
        gf = r["home_score"] if is_home else r["away_score"]
        ga = r["away_score"] if is_home else r["home_score"]
        result = _match_result(gf, ga)
        wins += result == "W"
        draws += result == "D"
        losses += result == "L"

    return {
        "appearances": int(team_wc["date"].dt.year.nunique()), "titles": titles,
        "matches_played": len(team_wc), "wins": wins, "draws": draws, "losses": losses,
    }


def shootout_record(shootouts, name: str, n: int = 5) -> dict:
    """All-time penalty-shootout record — especially relevant in the knockout stage."""
    mask = (shootouts["home_team"] == name) | (shootouts["away_team"] == name)
    team_so = shootouts[mask].sort_values("date", ascending=False)
    if team_so.empty:
        return {"played": 0, "won": 0, "lost": 0, "last": []}

    won = int((team_so["winner"] == name).sum())
    last = [
        {"date": str(r["date"])[:10],
         "opponent": r["away_team"] if r["home_team"] == name else r["home_team"],
         "won": bool(r["winner"] == name)}
        for _, r in team_so.head(n).iterrows()
    ]
    return {"played": len(team_so), "won": won, "lost": len(team_so) - won, "last": last}


def _static_team_data(name: str, state: AppState) -> dict:
    """Everything about a team that doesn't depend on the in-memory last
    simulation result — safe to cache, since it only changes on /api/refresh
    (data resync) rather than on every Simulator click.
    """
    config = state.config
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}

    # Merge API results
    api_key = get_api_key()
    api_finished = fetch_api_finished(api_key)
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

    # Elo rating + rank among all 48 teams
    elo = None
    elo_rank = None
    squad = None
    if state.predictor:
        elo = round(state.predictor.ratings.get(name, 1500.0), 1)
        ranked = sorted(state.predictor.ratings, key=state.predictor.ratings.get, reverse=True)
        if name in ranked:
            elo_rank = ranked.index(name) + 1

        sm = squad_metrics(name, state.predictor.squad_data)
        if sm:
            score = squad_quality_score(name, state.predictor.squad_data, state.predictor._squad_norms)
            squad = {**sm, "composite_score": round(score, 2)}

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
                        except Exception as e:
                            log.warning("next-match prediction failed for %s: %s", name, e)
                    break
        except Exception as e:
            log.warning("fetch_scheduled_matches failed for %s: %s", name, e)

    return {
        "team": name,
        "group": group_letter,
        "flag_code": config.get("flags", {}).get(name),
        "elo": elo,
        "elo_rank": elo_rank,
        "squad": squad,
        "group_standing": group_standing,
        "wc2026_results": wc_results,
        "form": team_form(state.results, name),
        "wc_history": wc_history(state.results, name),
        "shootouts": shootout_record(state.shootouts, name),
        "next_match": next_match,
    }


@router.get("/team/{name}")
def get_team(name: str, state: AppState = Depends(get_state)):
    config = state.config
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}

    if name not in group_of:
        raise HTTPException(404, f"Team '{name}' not found in WC 2026")

    static = team_cache.get(name)
    if static is None:
        static = _static_team_data(name, state)
        team_cache.set(name, static)

    # Championship odds / bracket path from the latest simulation — always
    # computed fresh (cheap in-memory lookup) so a new sim shows up
    # immediately instead of waiting out the static-data cache TTL.
    championship_odds = None
    bracket_path = None
    if state.last_sim_result:
        summary = state.last_sim_result.get("summary", [])
        for row in summary:
            if row["team"] == name:
                championship_odds = {k: v for k, v in row.items() if k != "team"}
                break

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

    return {**static, "championship_odds": championship_odds, "bracket_path": bracket_path}
