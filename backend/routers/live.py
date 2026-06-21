"""Live matches and schedule endpoints."""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Query

from backend.cache import live_cache, schedule_cache
from backend.deps import AppState, get_state
from src.livefeed import (fetch_live_matches, fetch_scheduled_matches,
                          fetch_todays_matches, get_api_key)
from src.predict import ingame_probs

router = APIRouter()


def _api_key() -> str | None:
    # get_api_key() falls back to os.environ automatically
    return get_api_key()


@router.get("/live")
def get_live(state: AppState = Depends(get_state)):
    api_key = _api_key()
    if not api_key:
        return {"matches": [], "todays_upcoming": [], "error": "No API key configured",
                "fetched_at": None}

    cached = live_cache.get()
    if cached is not None:
        return cached

    live_matches, err = fetch_live_matches(api_key)

    enriched = []
    for m in live_matches:
        home_t, away_t = m["home"], m["away"]
        prematch = None
        live_prob = None
        if state.predictor:
            try:
                prematch_pred = state.predictor.predict(home_t, away_t, neutral=True, injuries={})
                prematch = {
                    "p_home": round(prematch_pred["p_home"], 4),
                    "p_draw": round(prematch_pred["p_draw"], 4),
                    "p_away": round(prematch_pred["p_away"], 4),
                    "lambda_home": round(prematch_pred["lambda_home"], 3),
                    "lambda_away": round(prematch_pred["lambda_away"], 3),
                }
                lp = ingame_probs(
                    prematch_pred["lambda_home"], prematch_pred["lambda_away"],
                    m["score_home"], m["score_away"], m["minute"],
                )
                live_prob = {
                    "p_home": round(lp["p_home"], 4),
                    "p_draw": round(lp["p_draw"], 4),
                    "p_away": round(lp["p_away"], 4),
                }
            except Exception:
                pass
        enriched.append({**m, "prematch": prematch, "live_probs": live_prob})

    todays_upcoming: list = []
    if not live_matches:
        try:
            todays_upcoming = fetch_todays_matches(api_key)
            # Add pre-match predictions for upcoming
            for um in todays_upcoming:
                if state.predictor and um.get("home") and um.get("away"):
                    try:
                        p = state.predictor.predict(um["home"], um["away"], neutral=True, injuries={})
                        um["prediction"] = {
                            "p_home": round(p["p_home"], 4),
                            "p_draw": round(p["p_draw"], 4),
                            "p_away": round(p["p_away"], 4),
                        }
                    except Exception:
                        um["prediction"] = None
        except Exception:
            pass

    import datetime
    result = {
        "matches": enriched,
        "todays_upcoming": todays_upcoming,
        "error": err,
        "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    live_cache.set(result)
    return result


@router.get("/schedule")
def get_schedule(days: int = Query(30, ge=1, le=90), state: AppState = Depends(get_state)):
    api_key = _api_key()
    if not api_key:
        return {"matches": [], "error": "No API key configured"}

    cached = schedule_cache.get()
    if cached is not None and cached.get("days") == days:
        return cached

    try:
        raw = fetch_scheduled_matches(api_key, days=days)
    except Exception as e:
        return {"matches": [], "error": str(e)}

    matches = []
    for m in raw:
        if not m.get("home") or not m.get("away"):
            continue
        prediction = None
        if state.predictor:
            try:
                p = state.predictor.predict(m["home"], m["away"], neutral=True, injuries={})
                prediction = {
                    "p_home": round(p["p_home"], 4),
                    "p_draw": round(p["p_draw"], 4),
                    "p_away": round(p["p_away"], 4),
                }
            except Exception:
                pass
        matches.append({**m, "prediction": prediction})

    result = {"matches": matches, "days": days, "error": None}
    schedule_cache.set(result)
    return result
