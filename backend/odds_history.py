"""Persisted daily snapshots of championship odds across the tournament."""
from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

HISTORY_PATH = Path(__file__).resolve().parent.parent / "data" / "odds_history.json"
_io_lock = threading.RLock()


def _read() -> list[dict]:
    if not HISTORY_PATH.exists():
        return []
    try:
        return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning("failed to read odds history: %s", e)
        return []


def load_history() -> list[dict]:
    with _io_lock:
        return _read()


def record_snapshot(summary: list[dict], *, locked_count: int, n_sims: int,
                     top_n: int = 16) -> None:
    """Append (or replace, if same calendar date) one odds snapshot.

    summary: sim result rows, each with 'team' and 'P(Champion)'.
    One entry per calendar date is kept — a later call on the same day
    replaces the earlier one so the history doesn't balloon with reruns.
    """
    now = datetime.now(timezone.utc)
    top = sorted(summary, key=lambda r: r.get("P(Champion)", 0.0), reverse=True)[:top_n]
    entry = {
        "ts": now.isoformat(),
        "date": now.date().isoformat(),
        "n_sims": n_sims,
        "locked_count": locked_count,
        "odds": {r["team"]: round(float(r["P(Champion)"]), 4) for r in top},
    }

    with _io_lock:
        history = _read()
        history = [e for e in history if e.get("date") != entry["date"]]
        history.append(entry)
        history.sort(key=lambda e: e["date"])
        try:
            HISTORY_PATH.write_text(json.dumps(history, indent=2), encoding="utf-8")
        except Exception as e:
            log.warning("failed to write odds history: %s", e)
