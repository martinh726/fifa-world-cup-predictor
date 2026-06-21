"""Bracket SVG endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from backend.bracket_svg import build_live_bracket, render_bracket_svg
from backend.deps import AppState, get_state
from backend.utils import merge_api_finished
from src.livefeed import fetch_finished_matches, get_api_key

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
        bracket = build_live_bracket(group_results, ko_results, state.config)

    svg = render_bracket_svg(bracket, flags)
    return Response(content=svg, media_type="image/svg+xml")
