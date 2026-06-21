"""Shared utility functions for the backend routers."""
from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd


def merge_api_finished(group_results: list, ko_results: list,
                       api_matches: list, config: dict) -> tuple[list, list]:
    """Add API-fetched finished matches not yet in the CSV-derived lists."""
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}
    existing = {frozenset((t1, t2)) for t1, t2, *_ in group_results}
    existing |= {frozenset((t1, t2)) for t1, t2, _ in ko_results}
    new_group = list(group_results)
    new_ko = list(ko_results)
    for m in api_matches:
        t1, t2 = m["home"], m["away"]
        key = frozenset((t1, t2))
        if key in existing:
            continue
        s1, s2 = m["score_home"], m["score_away"]
        g1, g2 = group_of.get(t1), group_of.get(t2)
        if g1 is not None and g1 == g2:
            new_group.append((t1, t2, s1, s2))
            existing.add(key)
        else:
            winner = t1 if s1 > s2 else (t2 if s2 > s1 else None)
            if winner:
                new_ko.append((t1, t2, winner))
                existing.add(key)
    return new_group, new_ko


def group_qual_status(teams: list, matches: list) -> dict[str, str]:
    """Return 'through' | 'contention' | 'eliminated' for each team."""
    pts = {t: 0 for t in teams}
    played = {t: 0 for t in teams}
    for t1, t2, s1, s2 in matches:
        for t, gf, ga in ((t1, s1, s2), (t2, s2, s1)):
            if t in pts:
                played[t] += 1
                pts[t] += 3 if gf > ga else (1 if gf == ga else 0)
    if not any(v > 0 for v in played.values()):
        return {t: "contention" for t in teams}
    max_pts = {t: pts[t] + 3 * (3 - played[t]) for t in teams}
    status = {}
    for t in teams:
        guaranteed_above = sum(1 for o in teams if o != t and pts[o] > max_pts[t])
        possibly_above   = sum(1 for o in teams if o != t and max_pts[o] > pts[t])
        if guaranteed_above >= 2:
            status[t] = "eliminated"
        elif possibly_above < 2:
            status[t] = "through"
        else:
            status[t] = "contention"
    return status


def remaining_matches(teams: list, matches: list) -> list[tuple]:
    played_pairs: set = set()
    for t1, t2, _, _ in matches:
        played_pairs.add((t1, t2))
        played_pairs.add((t2, t1))
    return [(a, b) for a, b in combinations(teams, 2) if (a, b) not in played_pairs]


def qual_scenario(teams: list, matches: list) -> dict[str, dict]:
    """Per-team qualification scenario (status + human-readable message)."""
    stats = {t: {"pts": 0, "gd": 0, "gf": 0, "played": 0} for t in teams}
    for t1, t2, s1, s2 in matches:
        for t, gf, ga in ((t1, s1, s2), (t2, s2, s1)):
            if t in stats:
                stats[t]["played"] += 1
                stats[t]["pts"] += 3 if gf > ga else (1 if gf == ga else 0)
                stats[t]["gd"] += gf - ga
                stats[t]["gf"] += gf
    order = sorted(teams, key=lambda t: (-stats[t]["pts"], -stats[t]["gd"], -stats[t]["gf"], t))
    for i, t in enumerate(order):
        stats[t]["rank"] = i + 1
    pts_2nd = stats[order[1]]["pts"] if len(order) > 1 else 0
    qual = group_qual_status(teams, matches)
    rem_fix = remaining_matches(teams, matches)
    result = {}
    for t in teams:
        s = stats[t]
        rem = 3 - s["played"]
        max_pts = s["pts"] + 3 * rem
        can_reach_2nd = max_pts >= pts_2nd
        status = qual.get(t, "contention")
        next_opp = [b if a == t else a for a, b in rem_fix if t in (a, b)]
        pts_of_3rd = stats[order[2]]["pts"] if len(order) > 2 else 0
        if status == "through":
            msg = "Qualified for Round of 32"
        elif status == "eliminated":
            msg = "Mathematically eliminated"
        else:
            rank = s["rank"]
            if rank <= 2:
                lead = s["pts"] - pts_of_3rd
                g = "game" if rem == 1 else "games"
                msg = f"In {'1st' if rank == 1 else '2nd'} — {lead:+d} pts vs 3rd, {rem} {g} left"
            else:
                needed = pts_2nd - s["pts"]
                if can_reach_2nd:
                    g = "game" if rem == 1 else "games"
                    if rem == 1:
                        msg = "Must win next game to reach 2nd" if needed >= 3 else "Win or draw to reach 2nd"
                    else:
                        msg = f"Need {needed} pts from {rem} {g} to reach 2nd"
                else:
                    msg = f"Cannot reach 2nd — in best-third race ({s['pts']} pts)"
        result[t] = {**s, "remaining": rem, "max_pts": max_pts,
                     "can_reach_2nd": can_reach_2nd,
                     "status": status, "message": msg, "next_opponents": next_opp}
    return result


def third_place_race(config: dict, all_played: list) -> list[dict]:
    """Rank all 12 groups' current 3rd-place teams by FIFA criteria."""
    from src.tournament import standings

    group_of = {t: g for g, ts in config["groups"].items() for t in ts}
    thirds = []
    for letter in sorted(config["groups"].keys()):
        teams = config["groups"][letter]
        ms = [m for m in all_played if group_of.get(m[0]) == letter]
        if not ms:
            continue
        order = standings(teams, ms)
        if len(order) < 3:
            continue
        t = order[2]
        st3 = {"pts": 0, "gd": 0, "gf": 0, "played": 0}
        for t1, t2, s1, s2 in ms:
            for tt, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
                if tt == t:
                    st3["played"] += 1
                    st3["pts"] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                    st3["gd"] += gf_ - ga_
                    st3["gf"] += gf_
        thirds.append({"group": letter, "team": t, **st3,
                       "remaining": 3 - st3["played"],
                       "group_done": len(ms) == 6})
    thirds.sort(key=lambda x: (-x["pts"], -x["gd"], -x["gf"], x["team"]))
    return thirds


def compute_goal_stats(all_played: list) -> dict:
    """Compute total goals, goals/game, top scorers, best defences."""
    scored: dict[str, int] = {}
    conceded: dict[str, int] = {}
    total = 0
    for t1, t2, s1, s2 in all_played:
        scored[t1] = scored.get(t1, 0) + s1
        scored[t2] = scored.get(t2, 0) + s2
        conceded[t1] = conceded.get(t1, 0) + s2
        conceded[t2] = conceded.get(t2, 0) + s1
        total += s1 + s2
    games = len(all_played)
    return {
        "total_goals": total,
        "games_played": games,
        "goals_per_game": round(total / max(games, 1), 2),
        "top_scorers": sorted(scored.items(), key=lambda x: -x[1])[:8],
        "best_defences": sorted(conceded.items(), key=lambda x: x[1])[:8],
    }


def matrix_to_list(mat) -> list[list[float]]:
    """Convert numpy score matrix to nested list for JSON serialization."""
    return [[float(v) for v in row] for row in mat]


def compute_accuracy(predictor, group_results: list, ko_results: list) -> dict:
    """Compute prediction accuracy on completed matches."""
    rows, correct, total, brier = [], 0, 0, 0.0
    for t1, t2, s1, s2 in group_results:
        try:
            p = predictor.predict(t1, t2, neutral=True, injuries={})
            act = "H" if s1 > s2 else ("D" if s1 == s2 else "A")
            pred_out = max(("H", p["p_home"]), ("D", p["p_draw"]), ("A", p["p_away"]),
                           key=lambda x: x[1])[0]
            ih, id_, ia = (1, 0, 0) if act == "H" else ((0, 1, 0) if act == "D" else (0, 0, 1))
            brier += (p["p_home"] - ih) ** 2 + (p["p_draw"] - id_) ** 2 + (p["p_away"] - ia) ** 2
            total += 1
            correct += act == pred_out
            rows.append({"match": f"{t1} vs {t2}", "score": f"{s1}–{s2}",
                         "predicted": pred_out, "actual": act, "correct": act == pred_out,
                         "p_home": round(p["p_home"], 3), "p_draw": round(p["p_draw"], 3),
                         "p_away": round(p["p_away"], 3)})
        except Exception:
            pass
    for t1, t2, winner in ko_results:
        try:
            p = predictor.predict(t1, t2, neutral=True, injuries={})
            pred_w = t1 if p["p_home"] >= p["p_away"] else t2
            total += 1
            correct += winner == pred_w
            brier += (p["p_home"] + p["p_draw"] * 0.5 - (1 if winner == t1 else 0)) ** 2
            rows.append({"match": f"{t1} vs {t2}", "score": "KO",
                         "predicted": "H" if pred_w == t1 else "A",
                         "actual": "H" if winner == t1 else "A", "correct": winner == pred_w,
                         "p_home": round(p["p_home"], 3), "p_draw": round(p["p_draw"], 3),
                         "p_away": round(p["p_away"], 3)})
        except Exception:
            pass
    return {
        "correct": correct, "total": total,
        "accuracy": round(correct / total, 3) if total else 0.0,
        "brier": round(brier / total, 3) if total else 0.0,
        "matches": rows,
    }
