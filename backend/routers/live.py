"""Live matches and schedule endpoints."""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, Query

from backend.cache import live_cache, schedule_cache
from backend.deps import AppState, get_state
from src.livefeed import (fetch_apifootball_live, fetch_apifootball_stats,
                          fetch_live_matches, fetch_scheduled_matches,
                          fetch_todays_matches, get_api_key, get_apifootball_key)
from src.predict import ingame_probs

router = APIRouter()
log = logging.getLogger(__name__)


def _api_key() -> str | None:
    # get_api_key() falls back to os.environ automatically
    return get_api_key()


def _batch_predictions(predictor, pairs: list[tuple[str, str]]) -> list[dict | None]:
    """One batched model call for many (home, away) pairs; None per unknown team pair."""
    if predictor is None:
        return [None] * len(pairs)
    known = predictor.ratings
    valid = [(h, a) for h, a in pairs if h in known and a in known]
    preds = predictor.predict_many([(h, a, True) for h, a in valid]) if valid else []
    by_pair = {pair: p for pair, p in zip(valid, preds)}
    return [by_pair.get(pair) for pair in pairs]


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

    # Fetch exact minutes + fixture IDs from API-Football (optional second key)
    af_key = get_apifootball_key()
    af_live: dict = {}
    if af_key:
        try:
            af_live = fetch_apifootball_live(af_key)
        except Exception as e:
            log.warning("fetch_apifootball_live failed: %s", e)

    live_preds = _batch_predictions(
        state.predictor, [(m["home"], m["away"]) for m in live_matches])

    enriched = []
    for m, prematch_pred in zip(live_matches, live_preds):
        home_t, away_t = m["home"], m["away"]
        prematch = None
        live_prob = None
        if prematch_pred is not None:
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

        # Fetch live stats from API-Football when available (120 s per-fixture cache)
        match_stats = None
        af_match = af_live.get(f"{home_t}v{away_t}")
        if af_key and af_match and af_match.get("fixture_id"):
            try:
                match_stats = fetch_apifootball_stats(af_key, af_match["fixture_id"])
            except Exception as e:
                log.warning("fetch_apifootball_stats failed for %s v %s: %s",
                            home_t, away_t, e)

        enriched.append({**m, "prematch": prematch, "live_probs": live_prob, "match_stats": match_stats})

    todays_upcoming: list = []
    if not live_matches:
        try:
            todays_upcoming = fetch_todays_matches(api_key)
            # Add pre-match predictions for upcoming (one batched call)
            up_preds = _batch_predictions(
                state.predictor,
                [(um.get("home", ""), um.get("away", "")) for um in todays_upcoming])
            for um, p in zip(todays_upcoming, up_preds):
                um["prediction"] = {
                    "p_home": round(p["p_home"], 4),
                    "p_draw": round(p["p_draw"], 4),
                    "p_away": round(p["p_away"], 4),
                } if p is not None else None
        except Exception as e:
            log.warning("fetch_todays_matches failed: %s", e)

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
        log.warning("fetch_scheduled_matches failed: %s", e)
        return {"matches": [], "error": str(e)}

    upcoming = [m for m in raw if m.get("home") and m.get("away")]
    preds = _batch_predictions(state.predictor, [(m["home"], m["away"]) for m in upcoming])
    matches = [
        {**m, "prediction": {
            "p_home": round(p["p_home"], 4),
            "p_draw": round(p["p_draw"], 4),
            "p_away": round(p["p_away"], 4),
        } if p is not None else None}
        for m, p in zip(upcoming, preds)
    ]

    result = {"matches": matches, "days": days, "error": None}
    schedule_cache.set(result)
    return result
