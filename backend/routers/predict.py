"""Match prediction endpoints."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.deps import AppState, get_state
from backend.utils import matrix_to_list

router = APIRouter()


def _h2h(results, team1: str, team2: str) -> dict:
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
    except Exception:
        inj = {}

    predictor = state.predictor
    # Rebuild predictor with different squad_strength only when significantly different
    if abs(squad_strength - predictor.squad_adjustment_strength) > 0.005:
        from src.predict import MatchPredictor
        predictor = MatchPredictor(
            results=state.results, squad_adjustment_strength=squad_strength
        )

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
        "h2h": _h2h(state.results, home, away),
    }
