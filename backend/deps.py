"""Singleton application state — initialized once at startup via FastAPI lifespan."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from src.data_loader import download_data, load_results, load_shootouts, load_wc2026
from src.predict import MatchPredictor
from src.tournament import split_real_results


@dataclass
class AppState:
    config: dict = field(default_factory=dict)
    results: pd.DataFrame = field(default_factory=pd.DataFrame)
    shootouts: pd.DataFrame = field(default_factory=pd.DataFrame)
    group_results: list = field(default_factory=list)
    ko_results: list = field(default_factory=list)
    predictor: MatchPredictor | None = None
    last_sim_result: dict[str, Any] | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock)


_state = AppState()


def get_state() -> AppState:
    return _state


def initialize(squad_strength: float = 0.18, force_download: bool = False) -> None:
    """Load data and build the predictor singleton. Called once at startup."""
    download_data(force=force_download)
    _state.config = load_wc2026()
    _state.results = load_results(download=False)
    _state.shootouts = load_shootouts()
    _state.group_results, _state.ko_results = split_real_results(
        _state.results, _state.shootouts, _state.config
    )
    _state.predictor = MatchPredictor(
        results=_state.results,
        squad_adjustment_strength=squad_strength,
    )


def refresh(squad_strength: float = 0.18) -> None:
    """Re-download the latest results/shootouts data and rebuild the predictor. Thread-safe.

    Unlike startup initialize(), this forces a fresh download — otherwise
    download_data() would skip re-fetching results.csv/shootouts.csv since
    the local copies already exist, leaving group standings and the live
    bracket stuck on whatever snapshot was first downloaded.
    """
    with _state._lock:
        initialize(squad_strength, force_download=True)
