"""Retrain gating: only fires when completed-match count has grown AND the
cooldown window has elapsed. Isolated from real data sync / simulation via
monkeypatching — this only tests the gate, not the retrain subprocess itself."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import pytest

from backend import scheduler


@dataclass
class _FakeState:
    group_results: list = field(default_factory=list)
    ko_results: list = field(default_factory=list)
    config: dict = field(default_factory=dict)
    predictor: object = None


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.setattr(scheduler, "STATE_PATH", tmp_path / "retrain_state.json")
    monkeypatch.setattr(scheduler.deps, "refresh", lambda squad_strength: None)
    monkeypatch.setattr(scheduler.deps, "get_state", lambda: _FakeState())
    monkeypatch.setattr(scheduler, "_run_canonical_sim", lambda state: None)
    monkeypatch.setattr("src.livefeed.get_api_key", lambda: "fake-key")
    scheduler._status.update({
        "enabled": False, "last_check": None, "last_trained_at": None,
        "retraining_now": False, "last_error": None,
    })
    yield


def _set_match_count(monkeypatch, count):
    monkeypatch.setattr(scheduler, "fetch_api_finished", lambda key: [])
    monkeypatch.setattr(
        scheduler, "merge_api_finished",
        lambda gr, kr, api, cfg: ([None] * count, []),
    )


def test_no_retrain_when_match_count_unchanged(monkeypatch):
    _set_match_count(monkeypatch, 5)
    scheduler._save_retrain_state({"last_match_count": 5, "last_trained_at": None})

    calls = []
    monkeypatch.setattr(scheduler, "_run_retrain_subprocess", lambda: calls.append(1) or (True, ""))

    scheduler._sync_and_maybe_retrain(0.18, cooldown_hours=6.0)

    assert calls == []


def test_retrain_when_count_grows_and_no_cooldown_recorded(monkeypatch):
    _set_match_count(monkeypatch, 10)
    scheduler._save_retrain_state({"last_match_count": 5, "last_trained_at": None})

    calls = []
    monkeypatch.setattr(scheduler, "_run_retrain_subprocess", lambda: calls.append(1) or (True, ""))

    scheduler._sync_and_maybe_retrain(0.18, cooldown_hours=6.0)

    assert calls == [1]
    saved = scheduler._load_retrain_state()
    assert saved["last_match_count"] == 10


def test_no_retrain_when_cooldown_still_active(monkeypatch):
    _set_match_count(monkeypatch, 10)
    recent = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    scheduler._save_retrain_state({"last_match_count": 5, "last_trained_at": recent})

    calls = []
    monkeypatch.setattr(scheduler, "_run_retrain_subprocess", lambda: calls.append(1) or (True, ""))

    scheduler._sync_and_maybe_retrain(0.18, cooldown_hours=6.0)

    assert calls == []


def test_retrain_after_cooldown_elapsed(monkeypatch):
    _set_match_count(monkeypatch, 10)
    old = (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()
    scheduler._save_retrain_state({"last_match_count": 5, "last_trained_at": old})

    calls = []
    monkeypatch.setattr(scheduler, "_run_retrain_subprocess", lambda: calls.append(1) or (True, ""))

    scheduler._sync_and_maybe_retrain(0.18, cooldown_hours=6.0)

    assert calls == [1]


def test_failed_retrain_does_not_update_state(monkeypatch):
    _set_match_count(monkeypatch, 10)
    scheduler._save_retrain_state({"last_match_count": 5, "last_trained_at": None})

    monkeypatch.setattr(scheduler, "_run_retrain_subprocess", lambda: (False, "boom"))

    scheduler._sync_and_maybe_retrain(0.18, cooldown_hours=6.0)

    saved = scheduler._load_retrain_state()
    assert saved["last_match_count"] == 5  # unchanged — retrain never succeeded
    assert "boom" in scheduler.get_scheduler_status()["last_error"]
