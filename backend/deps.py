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


_state = AppState()
_build_lock = threading.Lock()


def get_state() -> AppState:
    return _state


def predictor_for(state: AppState, squad_strength: float) -> MatchPredictor:
    """Predictor honoring the requested squad_strength without an expensive rebuild.

    Returns the singleton when the strength matches (within slider tolerance);
    otherwise a cheap shallow clone that shares all heavy state.
    """
    p = state.predictor
    if p is None:
        raise RuntimeError("Predictor not ready")
    if abs(squad_strength - p.squad_adjustment_strength) <= 0.005:
        return p
    return p.with_strength(squad_strength)


def set_last_sim_result(result: dict[str, Any]) -> None:
    _state.last_sim_result = result


def _build_state(squad_strength: float, force_download: bool) -> AppState:
    """Build a complete, self-consistent AppState from freshly loaded data."""
    download_data(force=force_download)
    config = load_wc2026()
    results = load_results(download=False)
    shootouts = load_shootouts()
    group_results, ko_results = split_real_results(results, shootouts, config)
    predictor = MatchPredictor(
        results=results,
        squad_adjustment_strength=squad_strength,
    )
    return AppState(
        config=config,
        results=results,
        shootouts=shootouts,
        group_results=group_results,
        ko_results=ko_results,
        predictor=predictor,
    )


def initialize(squad_strength: float = 0.18, force_download: bool = False) -> None:
    """Load data and build the predictor singleton. Called once at startup."""
    global _state
    _state = _build_state(squad_strength, force_download)


def refresh(squad_strength: float = 0.18) -> None:
    """Re-download the latest results/shootouts data and rebuild the predictor.

    Unlike startup initialize(), this forces a fresh download — otherwise
    download_data() would skip re-fetching results.csv/shootouts.csv since
    the local copies already exist, leaving group standings and the live
    bracket stuck on whatever snapshot was first downloaded.

    The new state is built fully off to the side and then swapped in with a
    single reference assignment, so in-flight requests always see one
    consistent snapshot (old or new, never a mix).
    """
    global _state
    with _build_lock:
        new = _build_state(squad_strength, force_download=True)
        new.last_sim_result = _state.last_sim_result
        _state = new
