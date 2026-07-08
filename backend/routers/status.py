"""Data-source, model, and scheduler status endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.deps import AppState, get_state
from backend.odds_history import load_history
from backend.routers.teams import model_last_trained
from src.livefeed import get_api_key, get_apifootball_key, get_feed_status

router = APIRouter()


@router.get("/odds-history")
def get_odds_history():
    return {"snapshots": load_history()}


@router.get("/status")
def get_status(state: AppState = Depends(get_state)):
    data_through = (str(state.results["date"].max().date())
                    if not state.results.empty else None)

    scheduler_status = None
    try:
        from backend.scheduler import get_scheduler_status
        scheduler_status = get_scheduler_status()
    except ImportError:
        pass

    return {
        "football_data_key": get_api_key() is not None,
        "apifootball_key": get_apifootball_key() is not None,
        "sources": get_feed_status(),
        "data_through": data_through,
        "model": {
            "trained_through": (str(state.predictor.trained_through)[:10]
                                if state.predictor else None),
            "last_trained": model_last_trained(),
        },
        "scheduler": scheduler_status,
    }
