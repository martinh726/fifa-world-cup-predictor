"""What-If scenario endpoint — group standings for hypothetical match outcomes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.deps import AppState, get_state
from backend.routers.results import _apply_best_third_elimination, _build_standings_data
from backend.utils import third_place_race

router = APIRouter()


class HypotheticalMatch(BaseModel):
    team1: str
    team2: str
    score1: int
    score2: int


class WhatIfRequest(BaseModel):
    hypothetical: list[HypotheticalMatch]


def _resolve_slot(
    slot: str, group_leaders: dict[str, dict[str, str | None]]
) -> tuple[str | None, str]:
    if slot.startswith("3:"):
        return None, f"Best 3rd from {slot[2:]}"
    prefix, letter = slot[0], slot[1:]
    team = group_leaders.get(letter, {}).get(prefix)
    label = ("Winner" if prefix == "1" else "Runner-up") + f" Group {letter}"
    return team, label


@router.post("/what-if")
def what_if(req: WhatIfRequest, state: AppState = Depends(get_state)):
    """Return updated standings, third-place race, and R32 projections for hypothetical group results.

    Played matches (in state.group_results) are locked and cannot be overridden.
    Only hypothetical results for unplayed pairs are accepted.
    """
    played_pairs = {frozenset((t1, t2)) for t1, t2, *_ in state.group_results}

    merged = list(state.group_results)
    for h in req.hypothetical:
        if frozenset((h.team1, h.team2)) not in played_pairs:
            merged.append((h.team1, h.team2, h.score1, h.score2))

    standings_data = _build_standings_data(state.config, merged)
    thirds = third_place_race(state.config, merged)
    _apply_best_third_elimination(standings_data, thirds)

    # Build current group leaders (1st/2nd per group) for R32 slot resolution.
    group_leaders: dict[str, dict[str, str | None]] = {}
    for letter, gdata in standings_data.items():
        ranked = [t["team"] for t in gdata["teams"]]
        group_leaders[letter] = {
            "1": ranked[0] if len(ranked) > 0 else None,
            "2": ranked[1] if len(ranked) > 1 else None,
        }

    r32 = []
    for m in state.config.get("round_of_32", []):
        t1, n1 = _resolve_slot(m["slot1"], group_leaders)
        t2, n2 = _resolve_slot(m["slot2"], group_leaders)
        r32.append({"match": m["match"], "team1": t1, "note1": n1, "team2": t2, "note2": n2})

    return {"standings": standings_data, "third_place_race": thirds, "r32_projections": r32}
