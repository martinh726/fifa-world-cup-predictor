"""Match prediction endpoints."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.deps import AppState, get_state, predictor_for
from backend.utils import head_to_head, matrix_to_list

router = APIRouter()
log = logging.getLogger(__name__)


@router.get("/predict")
def predict_match(
    home: str = Query(...),
    away: str = Query(...),
    neutral: bool = Query(True),
    squad_strength: float = Query(0.18),
    injuries: str = Query("{}"),
    state: AppState = Depends(get_state),
):
    if not state.predictor:
        raise HTTPException(503, "Predictor not ready")
    if home == away:
        raise HTTPException(400, "home and away must be different teams")

    try:
        inj: dict = json.loads(injuries)
    except Exception as e:
        log.warning("invalid injuries payload %r: %s", injuries, e)
        inj = {}

    predictor = predictor_for(state, squad_strength)

    pred = predictor.predict(home, away, neutral=neutral, injuries=inj)
    mat = pred["score_matrix"]
    show = min(7, mat.shape[0])

    return {
        "home": home,
        "away": away,
        "neutral": neutral,
        "p_home": round(pred["p_home"], 4),
        "p_draw": round(pred["p_draw"], 4),
        "p_away": round(pred["p_away"], 4),
        "lambda_home": round(pred["lambda_home"], 3),
        "lambda_away": round(pred["lambda_away"], 3),
        "elo_home": round(pred["elo_home"], 1),
        "elo_away": round(pred["elo_away"], 1),
        "score_matrix": matrix_to_list(mat[:show, :show]),
        "top_scores": [list(ts) for ts in pred["top_scores"]],
        "squad": {
            "home": {
                "squad_value_m": pred.get("squad_value_home"),
                "fifa_rank": pred.get("fifa_rank_home"),
                "league_idx": pred.get("league_idx_home"),
                "avg_caps": pred.get("avg_caps_home"),
                "coach_wr": pred.get("coach_wr_home"),
            },
            "away": {
                "squad_value_m": pred.get("squad_value_away"),
                "fifa_rank": pred.get("fifa_rank_away"),
                "league_idx": pred.get("league_idx_away"),
                "avg_caps": pred.get("avg_caps_away"),
                "coach_wr": pred.get("coach_wr_away"),
            },
        },
        "h2h": head_to_head(state.results, home, away),
    }
