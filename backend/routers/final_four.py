"""Path-to-the-final view for the closing stretch of the knockout stage.

For each semifinal branch, recursively resolves the probability distribution
over which team reaches the final — walking back through any quarterfinal
(or earlier) matches that haven't been played yet — then combines both
branches into the full set of possible final pairings, each with a joint
probability, a predicted head-to-head, and a championship split.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.bracket_svg import build_live_bracket
from backend.cache import final_four_cache
from backend.deps import AppState, get_state
from backend.utils import fetch_api_finished, head_to_head, merge_api_finished
from src.livefeed import get_api_key
from src.simulate import knockout_win_prob

router = APIRouter()


def _is_slot_ref(name: str, known: set[str]) -> int | None:
    """If name is an unresolved 'W{n}' bracket placeholder, return n; else None."""
    if name in known:
        return None
    if name.startswith("W") and name[1:].isdigit():
        return int(name[1:])
    return None  # shouldn't occur this deep in the bracket (no group/3rd-place slots left)


def _resolve(match_num: int, bracket: dict, known: set[str], win_prob) -> list[tuple[str, float]]:
    """Recursively resolve a match's advancing-team distribution.

    win_prob(a, b) -> P(a beats b) is called for every real or hypothetical
    pairing encountered. Injecting a stub collector here lets the exact same
    recursion double as a dry run that only discovers which pairs are needed,
    so the real predictions can be made in a single batched call.
    """
    m = bracket[match_num]
    if m["actual"]:
        return [(m["winner"], 1.0)]

    def side(team_or_slot: str) -> list[tuple[str, float]]:
        feeder = _is_slot_ref(team_or_slot, known)
        if feeder is None:
            return [(team_or_slot, 1.0)] if team_or_slot in known else []
        return _resolve(feeder, bracket, known, win_prob)

    side1, side2 = side(m["team1"]), side(m["team2"])
    combined: dict[str, float] = {}
    for a, pa in side1:
        for b, pb in side2:
            joint = pa * pb
            if joint <= 0:
                continue
            p_a = win_prob(a, b)
            combined[a] = combined.get(a, 0.0) + joint * p_a
            combined[b] = combined.get(b, 0.0) + joint * (1 - p_a)
    return sorted(combined.items(), key=lambda x: -x[1])


@router.get("/final-four")
def get_final_four(state: AppState = Depends(get_state)):
    if not state.predictor:
        raise HTTPException(503, "Predictor not ready")

    cached = final_four_cache.get()
    if cached is not None:
        return cached

    api_finished = fetch_api_finished(get_api_key())
    group_results, ko_results = merge_api_finished(
        state.group_results, state.ko_results, api_finished, state.config
    )
    bracket = build_live_bracket(group_results, ko_results, state.config)
    known = set(state.config.get("flags", {}))

    sf_configs = state.config["semifinals"]
    sf1_match, sf2_match = sf_configs[0]["match"], sf_configs[1]["match"]

    # Pass 1: dry run with a stub win_prob that just records which pairings
    # are needed (a match's own real matchup, plus every cross-pairing used
    # to combine two resolved sub-branches).
    needed: set[frozenset[str]] = set()

    def _collect(a: str, b: str) -> float:
        needed.add(frozenset((a, b)))
        return 0.5

    d1_dry = _resolve(sf1_match, bracket, known, _collect)
    d2_dry = _resolve(sf2_match, bracket, known, _collect)
    for a, _ in d1_dry:
        for b, _ in d2_dry:
            needed.add(frozenset((a, b)))

    # Pass 2: one batched prediction for every distinct pairing, then a real
    # win_prob() backed by the model instead of the 0.5 stub.
    fixtures = [tuple(sorted(pair)) + (True,) for pair in needed if len(pair) == 2]
    preds = state.predictor.predict_many(fixtures) if fixtures else []
    lookup: dict[frozenset[str], dict] = {
        frozenset((h, a)): {"home": h, "p_home": p["p_home"], "p_draw": p["p_draw"],
                            "p_away": p["p_away"]}
        for (h, a, _), p in zip(fixtures, preds)
    }

    def _win_prob(a: str, b: str) -> float:
        entry = lookup.get(frozenset((a, b)))
        if entry is None:
            return 0.5
        p_home_wins = knockout_win_prob(entry["p_home"], entry["p_draw"], entry["p_away"])
        return p_home_wins if entry["home"] == a else 1 - p_home_wins

    sf1_dist = _resolve(sf1_match, bracket, known, _win_prob)
    sf2_dist = _resolve(sf2_match, bracket, known, _win_prob)

    final_match = state.config["final"]["match"]
    final_bracket = bracket[final_match]

    pairings = []
    for a, pa in sf1_dist:
        for b, pb in sf2_dist:
            pairing_prob = pa * pb
            if final_bracket["actual"] and {a, b} == {final_bracket["team1"], final_bracket["team2"]}:
                p_a_wins = 1.0 if final_bracket["winner"] == a else 0.0
            else:
                p_a_wins = _win_prob(a, b)
            pairings.append({
                "team1": a, "team2": b,
                "pairing_prob": round(pairing_prob, 4),
                "p_team1_win_final": round(p_a_wins, 4),
                "p_team1_champion": round(pairing_prob * p_a_wins, 4),
                "p_team2_champion": round(pairing_prob * (1 - p_a_wins), 4),
                "h2h": head_to_head(state.results, a, b),
            })
    pairings.sort(key=lambda x: -x["pairing_prob"])

    def _sf_view(cfg: dict, dist: list[tuple[str, float]]) -> dict:
        m = bracket[cfg["match"]]
        return {
            "match": cfg["match"],
            "team1": m["team1"], "team2": m["team2"],
            "actual": m["actual"], "winner": m["winner"],
            "candidates": [{"team": t, "prob": round(p, 4)} for t, p in dist],
        }

    result = {
        "quarterfinals": [
            {"match": m["match"], "team1": bracket[m["match"]]["team1"],
             "team2": bracket[m["match"]]["team2"], "actual": bracket[m["match"]]["actual"],
             "winner": bracket[m["match"]]["winner"]}
            for m in state.config["quarterfinals"]
        ],
        "semifinals": [_sf_view(sf_configs[0], sf1_dist), _sf_view(sf_configs[1], sf2_dist)],
        "final_match": final_match,
        "final_decided": final_bracket["actual"],
        "champion": final_bracket["winner"] if final_bracket["actual"] else None,
        "pairings": pairings,
    }
    final_four_cache.set(result)
    return result
