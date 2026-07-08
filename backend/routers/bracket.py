"""Bracket SVG endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from backend.bracket_svg import build_live_bracket, render_bracket_svg
from backend.deps import AppState, get_state
from backend.utils import fetch_api_finished, merge_api_finished
from src.livefeed import get_api_key

router = APIRouter()


@router.get("/bracket/svg")
def get_bracket_svg(
    type: str = Query("simulated", pattern="^(simulated|live)$"),
    state: AppState = Depends(get_state),
):
    flags = state.config.get("flags", {})

    if type == "simulated":
        if not state.last_sim_result:
            raise HTTPException(404, "No simulation result available — run the simulator first")
        bracket = state.last_sim_result["bracket"]
        # Convert string keys back to int keys if needed
        if bracket and isinstance(next(iter(bracket)), str):
            bracket = {int(k): v for k, v in bracket.items()}
    else:
        # Live bracket from actual results
        api_finished = fetch_api_finished(get_api_key())
        group_results, ko_results = merge_api_finished(
            state.group_results, state.ko_results, api_finished, state.config
        )
        bracket = build_live_bracket(group_results, ko_results, state.config)

    svg = render_bracket_svg(bracket, flags)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/bracket/live")
def get_bracket_live(state: AppState = Depends(get_state)):
    """Live knockout bracket as JSON — used by the knockout scenario builder.

    A match is pickable when it is not yet decided (actual=False) and both
    teams are concrete names (no '*' provisional marker or placeholder slot).
    """
    api_finished = fetch_api_finished(get_api_key())
    group_results, ko_results = merge_api_finished(
        state.group_results, state.ko_results, api_finished, state.config
    )
    bracket = build_live_bracket(group_results, ko_results, state.config)

    known = set(state.config.get("flags", {}))

    def concrete(name: str) -> bool:
        return name in known  # placeholders ('W92', '1st Gp A', 'X*') are never real teams

    matches = []
    for m in sorted(bracket.values(), key=lambda x: x["match"]):
        matches.append({
            **m,
            "pickable": (not m["actual"]
                         and concrete(m["team1"]) and concrete(m["team2"])),
        })
    return {"matches": matches}
