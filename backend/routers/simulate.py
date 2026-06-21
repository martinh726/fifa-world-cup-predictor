"""Tournament simulation endpoint."""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.deps import AppState, get_state
from backend.utils import compute_accuracy

router = APIRouter()


class ManualResult(BaseModel):
    team1: str
    team2: str
    score1: int
    score2: int


class SimulateRequest(BaseModel):
    n_sims: int = 10000
    lock_real_results: bool = True
    manual_results: list[ManualResult] = []
    squad_strength: float = 0.18


def _run_sync(req: SimulateRequest, state: AppState) -> dict[str, Any]:
    from src.simulate import TournamentSimulator

    predictor = state.predictor
    if abs(req.squad_strength - predictor.squad_adjustment_strength) > 0.005:
        from src.predict import MatchPredictor
        predictor = MatchPredictor(
            results=state.results,
            squad_adjustment_strength=req.squad_strength,
        )

    sim = TournamentSimulator(predictor, state.config, n_sims=req.n_sims)

    locked_group: list = []
    if req.lock_real_results:
        locked_group = list(state.group_results)
    locked_group += [(r.team1, r.team2, r.score1, r.score2) for r in req.manual_results]

    ko_winners: list = []
    if req.lock_real_results:
        ko_winners = list(state.ko_results)

    result = sim.run(locked_group=locked_group, ko_winners=ko_winners)

    # Convert DataFrames to JSON-serializable dicts
    summary_df = result["summary"]
    summary = summary_df.to_dict(orient="records")

    rank_probs: dict[str, dict] = {}
    for letter, df in result["rank_probs"].items():
        rank_probs[letter] = {
            team: {col: round(float(val), 4) for col, val in row.items()}
            for team, row in df.iterrows()
        }

    # Round floats in summary
    stage_cols = [c for c in summary_df.columns if c != "team"]
    for row in summary:
        for col in stage_cols:
            row[col] = round(float(row[col]), 4)

    # Bracket: make win_prob JSON-safe
    bracket = {
        k: {**v, "win_prob": round(float(v["win_prob"]), 4) if v.get("win_prob") is not None else None}
        for k, v in result["bracket"].items()
    }

    # Accuracy on completed matches
    all_group = locked_group or state.group_results
    accuracy = compute_accuracy(predictor, all_group, state.ko_results if req.lock_real_results else [])

    return {
        "n_sims": result["n_sims"],
        "locked_count": len(locked_group),
        "summary": summary,
        "rank_probs": rank_probs,
        "bracket": bracket,
        "accuracy": accuracy,
    }


@router.post("/simulate")
async def run_simulation(req: SimulateRequest, state: AppState = Depends(get_state)):
    if not state.predictor:
        raise HTTPException(503, "Predictor not ready")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _run_sync, req, state)
    state.last_sim_result = result
    return result
