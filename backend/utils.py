"""Shared utility functions for the backend routers."""
from __future__ import annotations

import logging
from itertools import combinations, product as _iprod

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


def fetch_api_finished(api_key: str | None) -> list:
    """Finished matches from the live API; logs and returns [] on any failure."""
    if not api_key:
        return []
    from src.livefeed import fetch_finished_matches
    try:
        return fetch_finished_matches(api_key)
    except Exception as e:
        log.warning("fetch_finished_matches failed: %s", e)
        return []


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


def _group_all_outcomes(teams: list, matches: list):
    """Yield one possible final group ranking per remaining-game scenario.

    Uses 1-0 / 1-1 / 0-1 as canonical scores — correct for pts and wins;
    GD/GF are approximate but conservative for elimination decisions.
    Each yielded value is the result of FIFA 2026 standings() on that outcome.
    """
    from src.tournament import standings as _fifa_standings
    rem = remaining_matches(teams, matches)
    for outcomes in _iprod(range(3), repeat=len(rem)):
        sim = list(matches)
        for (t1, t2), o in zip(rem, outcomes):
            sim.append((t1, t2, 1, 0) if o == 0 else
                       (t1, t2, 1, 1) if o == 1 else
                       (t1, t2, 0, 1))
        yield _fifa_standings(teams, sim)


def group_qual_status(teams: list, matches: list) -> dict[str, str]:
    """Return 'through' | 'contention' | 'eliminated' per team.

    Enumerates all possible outcomes of remaining group games and applies the
    full FIFA 2026 tiebreaker chain (pts → GD → GF → H2H pts/GD/GF → wins)
    to determine the mathematically exact status:

    - 'through'    = guaranteed top-2 in EVERY possible outcome
    - 'eliminated' = guaranteed 4th in EVERY possible outcome
                     (cannot even reach 3rd → truly out of the tournament)
    - 'contention' = can reach top-2 in SOME outcomes, OR can be 3rd
                     (keeps the best-third R32 route open)

    2026 WC note: being locked into 3rd is NOT elimination — that team still
    competes for one of the 8 best-third slots across all 12 groups.
    """
    if not matches:
        return {t: "contention" for t in teams}

    all_rankings = list(_group_all_outcomes(teams, matches))

    status = {}
    for t in teams:
        ranks = [r.index(t) for r in all_rankings]  # 0-indexed: 0=1st … 3=4th
        best, worst = min(ranks), max(ranks)
        if best >= 3:     # can't avoid 4th in any scenario → truly eliminated
            status[t] = "eliminated"
        elif worst <= 1:  # always 1st or 2nd in every scenario → guaranteed through
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
    """Per-team qualification scenario (status + human-readable message).

    2026 WC rules applied:
    - Top 2 per group → auto-qualify for R32
    - 3rd place → competes for one of 8 best-third spots (NOT eliminated)
    - 4th place → eliminated (only position with zero advancement paths)
    Ranking within a group uses the FIFA 2026 tiebreaker order via standings().
    """
    from src.tournament import standings as fifa_standings

    stats = {t: {"pts": 0, "gd": 0, "gf": 0, "wins": 0, "played": 0} for t in teams}
    for t1, t2, s1, s2 in matches:
        for t, gf, ga in ((t1, s1, s2), (t2, s2, s1)):
            if t in stats:
                stats[t]["played"] += 1
                stats[t]["pts"] += 3 if gf > ga else (1 if gf == ga else 0)
                stats[t]["gd"] += gf - ga
                stats[t]["gf"] += gf
                stats[t]["wins"] += 1 if gf > ga else 0

    # Use the FIFA-correct tiebreaker ranking (pts → GD → GF → H2H → wins)
    order = fifa_standings(teams, matches) if matches else list(teams)
    for i, t in enumerate(order):
        stats[t]["rank"] = i + 1

    max_pts = {t: stats[t]["pts"] + 3 * (3 - stats[t]["played"]) for t in teams}
    pts_2nd = stats[order[1]]["pts"] if len(order) > 1 else 0
    pts_3rd = stats[order[2]]["pts"] if len(order) > 2 else 0

    qual = group_qual_status(teams, matches)
    rem_fix = remaining_matches(teams, matches)

    # H2H-aware: can each team actually reach top 2 in any scenario?
    if matches:
        _all_rank = list(_group_all_outcomes(teams, matches))
        _can_top2 = {t: any(r.index(t) < 2 for r in _all_rank) for t in teams}
    else:
        _can_top2 = {t: True for t in teams}

    result = {}
    for t in teams:
        s = stats[t]
        rem = 3 - s["played"]
        mp = max_pts[t]
        status = qual.get(t, "contention")
        next_opp = [b if a == t else a for a, b in rem_fix if t in (a, b)]

        can_reach_2nd = _can_top2.get(t, True)
        locked_out_of_top2 = not can_reach_2nd  # H2H-aware lock-out

        g = "game" if rem == 1 else "games"

        if status == "through":
            msg = "Qualified for R32 (top 2 guaranteed)"
        elif status == "eliminated":
            msg = "Eliminated — mathematically 4th place"
        elif locked_out_of_top2:
            # Locked into 3rd — still alive via best-third route
            if rem == 0:
                msg = f"3rd place — in best-third race ({s['pts']} pts, group complete)"
            else:
                msg = f"3rd place — in best-third race ({s['pts']} pts, {rem} {g} left)"
        else:
            rank = s["rank"]
            if rank <= 2:
                lead = s["pts"] - pts_3rd
                msg = (f"{'1st' if rank == 1 else '2nd'} place — "
                       f"{lead:+d} pts ahead of 3rd, {rem} {g} left")
            else:
                needed = pts_2nd - s["pts"]
                if rem == 0:
                    msg = f"3rd place — in best-third race ({s['pts']} pts)"
                elif rem == 1:
                    if needed >= 3:
                        msg = "Must win to reach 2nd; a loss keeps best-third hopes only"
                    elif needed > 0:
                        msg = "Win or draw to secure 2nd; best-third still possible on loss"
                    else:
                        msg = "Level with 2nd — head-to-head may decide, 1 game left"
                else:
                    msg = (f"Need {needed} pts from {rem} {g} to reach 2nd; "
                           f"3rd can still qualify as best third")

        result[t] = {**s, "remaining": rem, "max_pts": mp,
                     "can_reach_2nd": can_reach_2nd,
                     "status": status, "message": msg, "next_opponents": next_opp}
    return result


def third_place_race(config: dict, all_played: list) -> list[dict]:
    """Rank all 12 groups' current 3rd-place teams by FIFA 2026 criteria.

    Official ranking order for best-third selection (FIFA 2026 regulations):
    1. Points  2. GD  3. GF  4. Wins  5. Fair play / FIFA rank (→ team name as tie-break)
    """
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
        st3 = {"pts": 0, "gd": 0, "gf": 0, "wins": 0, "played": 0}
        for t1, t2, s1, s2 in ms:
            for tt, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
                if tt == t:
                    st3["played"] += 1
                    st3["pts"] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                    st3["gd"] += gf_ - ga_
                    st3["gf"] += gf_
                    st3["wins"] += 1 if gf_ > ga_ else 0
        thirds.append({"group": letter, "team": t, **st3,
                       "remaining": 3 - st3["played"],
                       "group_done": len(ms) == 6})
    # pts → GD → GF → wins → team name (stand-in for fair play / FIFA rank)
    thirds.sort(key=lambda x: (-x["pts"], -x["gd"], -x["gf"], -x["wins"], x["team"]))
    return thirds


def is_best_third_eliminated(max_pts: int, group_letter: str, thirds: list[dict]) -> bool:
    """Return True if a team with max_pts cannot crack the top-8 best-third slots.

    Uses the conservative (never false-positive) criterion: if 8 or more OTHER
    groups already have a current 3rd-place team whose pts strictly exceed max_pts,
    those thirds are guaranteed to rank above this team since pts can only increase.
    """
    guaranteed_better = sum(
        1 for t in thirds
        if t["group"] != group_letter and t["pts"] > max_pts
    )
    return guaranteed_better >= 8


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


def head_to_head(results: pd.DataFrame, team1: str, team2: str) -> dict:
    """All-time W/D/L record and last-5 meetings between two teams."""
    mask = (
        ((results["home_team"] == team1) & (results["away_team"] == team2)) |
        ((results["home_team"] == team2) & (results["away_team"] == team1))
    )
    h2h = results[mask].sort_values("date", ascending=False)
    if h2h.empty:
        return {"total": 0, "team1_wins": 0, "draws": 0, "team2_wins": 0, "last5": []}

    team1_wins = int((
        ((h2h["home_team"] == team1) & (h2h["home_score"] > h2h["away_score"])) |
        ((h2h["away_team"] == team1) & (h2h["away_score"] > h2h["home_score"]))
    ).sum())
    draws = int((h2h["home_score"] == h2h["away_score"]).sum())
    total = len(h2h)
    team2_wins = total - team1_wins - draws

    last5 = []
    for _, r in h2h.head(5).iterrows():
        last5.append({
            "date": str(r["date"])[:10],
            "home": r["home_team"],
            "away": r["away_team"],
            "score_home": int(r["home_score"]),
            "score_away": int(r["away_score"]),
            "tournament": str(r.get("tournament", "")),
        })

    return {
        "total": total,
        "team1_wins": team1_wins,
        "draws": draws,
        "team2_wins": team2_wins,
        "last5": last5,
    }


def merge_ko_picks(live_ko: list, picks: list[tuple[str, str, str]]) -> list:
    """Combine user knockout picks with real decided KO results.

    Picks whose pairing is already decided in reality are dropped; real results
    come last so they win any remaining clash in the simulator's forced-winner
    map (later entries overwrite earlier ones for the same pairing).
    """
    decided = {frozenset((t1, t2)) for t1, t2, _ in live_ko}
    kept = [(t1, t2, w) for t1, t2, w in picks
            if frozenset((t1, t2)) not in decided]
    return kept + list(live_ko)


def matrix_to_list(mat) -> list[list[float]]:
    """Convert numpy score matrix to nested list for JSON serialization."""
    return [[float(v) for v in row] for row in mat]


def compute_accuracy(predictor, group_results: list, ko_results: list) -> dict:
    """Compute prediction accuracy on completed matches (single batched model call)."""
    known = predictor.ratings
    group = [(t1, t2, s1, s2) for t1, t2, s1, s2 in group_results
             if t1 in known and t2 in known]
    ko = [(t1, t2, w) for t1, t2, w in ko_results if t1 in known and t2 in known]

    fixtures = [(t1, t2, True) for t1, t2, _, _ in group] + \
               [(t1, t2, True) for t1, t2, _ in ko]
    preds = predictor.predict_many(fixtures) if fixtures else []
    group_preds, ko_preds = preds[:len(group)], preds[len(group):]

    rows, correct, total, brier = [], 0, 0, 0.0
    for (t1, t2, s1, s2), p in zip(group, group_preds):
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
    for (t1, t2, winner), p in zip(ko, ko_preds):
        pred_w = t1 if p["p_home"] >= p["p_away"] else t2
        total += 1
        correct += winner == pred_w
        brier += (p["p_home"] + p["p_draw"] * 0.5 - (1 if winner == t1 else 0)) ** 2
        rows.append({"match": f"{t1} vs {t2}", "score": "KO",
                     "predicted": "H" if pred_w == t1 else "A",
                     "actual": "H" if winner == t1 else "A", "correct": winner == pred_w,
                     "p_home": round(p["p_home"], 3), "p_draw": round(p["p_draw"], 3),
                     "p_away": round(p["p_away"], 3)})
    return {
        "correct": correct, "total": total,
        "accuracy": round(correct / total, 3) if total else 0.0,
        "brier": round(brier / total, 3) if total else 0.0,
        "matches": rows,
    }
