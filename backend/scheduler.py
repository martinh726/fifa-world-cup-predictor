"""Background loop: sync live results, retrain the model after new completed
matches, and record a daily championship-odds snapshot.

Runs as an asyncio task started from the FastAPI lifespan (see backend/main.py).
Retraining itself happens in a subprocess (`python -m src.train`) so a
multi-minute backtest + fit never blocks the event loop or shares memory with
the live server process. src/train.py's backtest() auto-selects blend weights
every time it runs — nothing here re-tunes them, honoring the project's
"blend weights are never manually tuned" constraint.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

from backend import deps, odds_history
from backend.utils import fetch_api_finished, merge_api_finished

log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATE_PATH = PROJECT_ROOT / "data" / "retrain_state.json"

_retrain_running = threading.Event()
_status_lock = threading.Lock()
_status: dict = {
    "enabled": False,
    "last_check": None,
    "last_trained_at": None,
    "retraining_now": False,
    "last_error": None,
}


def get_scheduler_status() -> dict:
    with _status_lock:
        return dict(_status)


def _set_status(**kw) -> None:
    with _status_lock:
        _status.update(kw)


def _load_retrain_state() -> dict:
    if not STATE_PATH.exists():
        return {"last_match_count": 0, "last_trained_at": None}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning("failed to read retrain_state.json: %s", e)
        return {"last_match_count": 0, "last_trained_at": None}


def _save_retrain_state(state: dict) -> None:
    try:
        STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception as e:
        log.warning("failed to write retrain_state.json: %s", e)


def _run_retrain_subprocess() -> tuple[bool, str]:
    """Run `python -m src.train` to completion. Returns (ok, stderr_tail)."""
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "src.train"],
            cwd=str(PROJECT_ROOT),
            timeout=3600,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            return False, proc.stderr[-2000:]
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "retrain subprocess timed out after 1 hour"
    except Exception as e:
        return False, str(e)


def _sync_and_maybe_retrain(squad_strength: float, cooldown_hours: float) -> None:
    from src.livefeed import get_api_key

    now = datetime.now(timezone.utc)
    try:
        deps.refresh(squad_strength)
        state = deps.get_state()

        api_finished = fetch_api_finished(get_api_key())
        live_group, live_ko = merge_api_finished(
            state.group_results, state.ko_results, api_finished, state.config
        )
        completed_count = len(live_group) + len(live_ko)

        retrain_state = _load_retrain_state()
        last_count = retrain_state.get("last_match_count", 0)
        last_trained_at = retrain_state.get("last_trained_at")

        cooldown_elapsed = True
        if last_trained_at:
            elapsed_h = (now - datetime.fromisoformat(last_trained_at)).total_seconds() / 3600
            cooldown_elapsed = elapsed_h >= cooldown_hours

        retrain_error: str | None = None
        if completed_count > last_count and cooldown_elapsed and not _retrain_running.is_set():
            _retrain_running.set()
            _set_status(retraining_now=True)
            log.info("New completed matches (%d > %d) — retraining model...",
                     completed_count, last_count)
            try:
                ok, err_tail = _run_retrain_subprocess()
                if ok:
                    log.info("Retrain succeeded — reloading predictor.")
                    deps.refresh(squad_strength)
                    from backend.cache import (calibration_cache, live_cache,
                                               results_cache, schedule_cache)
                    live_cache.invalidate()
                    results_cache.invalidate()
                    schedule_cache.invalidate()
                    calibration_cache.invalidate()
                    retrain_state = {
                        "last_match_count": completed_count,
                        "last_trained_at": now.isoformat(),
                    }
                    _save_retrain_state(retrain_state)
                    _set_status(last_trained_at=now.isoformat())
                else:
                    retrain_error = f"retrain failed: {err_tail[-300:]}"
                    log.warning("Retrain subprocess failed: %s", err_tail)
            finally:
                _retrain_running.clear()
                _set_status(retraining_now=False)

        # Refresh the canonical simulation + odds-history snapshot every cycle
        # (cheap relative to retraining, keeps championship odds current).
        state = deps.get_state()
        _run_canonical_sim(state)

        # A retrain failure this cycle takes priority over clearing last_error —
        # otherwise the final status update below would immediately erase it.
        _set_status(last_check=now.isoformat(), last_error=retrain_error)
    except Exception as e:
        log.exception("Scheduler cycle failed")
        _set_status(last_check=now.isoformat(), last_error=str(e))


def _run_canonical_sim(state: "deps.AppState") -> None:
    from backend.routers.simulate import SimulateRequest, _run_sync

    if not state.predictor:
        return
    req = SimulateRequest(n_sims=10000, lock_real_results=True)
    result = _run_sync(req, state)
    deps.set_last_sim_result(result)
    odds_history.record_snapshot(
        result["summary"], locked_count=result["locked_count"], n_sims=result["n_sims"],
    )


async def scheduler_loop(interval_s: int, squad_strength: float,
                         cooldown_hours: float = 6.0) -> None:
    _set_status(enabled=True)
    log.info("Scheduler started (interval=%ss, retrain cooldown=%sh)",
             interval_s, cooldown_hours)
    while True:
        try:
            await asyncio.to_thread(_sync_and_maybe_retrain, squad_strength, cooldown_hours)
        except Exception:
            log.exception("Unhandled error in scheduler loop")
        await asyncio.sleep(interval_s)
