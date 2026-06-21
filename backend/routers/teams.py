"""Teams and tournament config endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.deps import AppState, get_state

router = APIRouter()


@router.get("/teams")
def get_teams(state: AppState = Depends(get_state)):
    config = state.config
    teams = sorted(t for g in config["groups"].values() for t in g)
    data_through = (str(state.results["date"].max().date())
                    if not state.results.empty else "unknown")
    return {
        "teams": teams,
        "flags": config.get("flags", {}),
        "groups": config.get("groups", {}),
        "hosts": config.get("hosts", []),
        "data_through": data_through,
    }


@router.post("/refresh")
def refresh_data(state: AppState = Depends(get_state)):
    from backend.deps import refresh
    from backend.cache import live_cache, results_cache, schedule_cache
    refresh()
    live_cache.invalidate()
    results_cache.invalidate()
    schedule_cache.invalidate()
    data_through = (str(state.results["date"].max().date())
                    if not state.results.empty else "unknown")
    return {"status": "ok", "data_through": data_through}


@router.get("/backtest-report")
def get_backtest_report():
    from pathlib import Path
    path = Path(__file__).resolve().parent.parent.parent / "reports" / "backtest.md"
    if not path.exists():
        return {"content": None}
    return {"content": path.read_text(encoding="utf-8")}
