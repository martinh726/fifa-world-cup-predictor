"""Model calibration endpoint — reliability diagram data."""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends

from backend.cache import calibration_cache
from backend.deps import AppState, get_state
from backend.utils import merge_api_finished
from src.livefeed import fetch_finished_matches, get_api_key

router = APIRouter()

N_BINS = 10
OUTCOME_LABELS = ["Home Win", "Draw", "Away Win"]


@router.get("/calibration")
def get_calibration(state: AppState = Depends(get_state)):
    if not state.predictor:
        return {"n_matches": 0, "calibration": {}, "brier": {}, "confidence_distribution": {}}

    cached = calibration_cache.get()
    if cached is not None:
        return cached

    api_key = get_api_key()
    api_finished: list = []
    if api_key:
        try:
            api_finished = fetch_finished_matches(api_key)
        except Exception:
            pass
    group_results, _ = merge_api_finished(
        state.group_results, state.ko_results, api_finished, state.config
    )

    rows: list[tuple] = []
    for t1, t2, s1, s2 in group_results:
        try:
            p = state.predictor.predict(t1, t2, neutral=True, injuries={})
            rows.append((
                p["p_home"], p["p_draw"], p["p_away"],
                1 if s1 > s2 else 0,
                1 if s1 == s2 else 0,
                1 if s1 < s2 else 0,
            ))
        except Exception:
            pass

    if not rows:
        return {"n_matches": 0, "calibration": {}, "brier": {}, "confidence_distribution": {}}

    arr = np.array(rows, dtype=float)  # (N, 6)
    bin_edges = np.linspace(0, 1, N_BINS + 1)

    calibration: dict = {}
    brier: dict = {}

    for i, label in enumerate(OUTCOME_LABELS):
        pred = arr[:, i]
        actual = arr[:, i + 3]

        brier[label] = round(float(np.mean((pred - actual) ** 2)), 4)

        centers, accs, counts = [], [], []
        for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
            mask = (pred >= lo) & (pred < hi + 1e-9)
            n = int(mask.sum())
            if n > 0:
                centers.append(round(float(pred[mask].mean()), 4))
                accs.append(round(float(actual[mask].mean()), 4))
                counts.append(n)

        calibration[label] = {"predicted": centers, "actual": accs, "counts": counts}

    # Confidence distribution: distribution of max predicted probability per match
    max_p = arr[:, :3].max(axis=1)
    hist, edges = np.histogram(max_p, bins=N_BINS, range=(0.0, 1.0))
    conf_dist = {
        "bin_centers": [round(float((edges[j] + edges[j + 1]) / 2), 3) for j in range(len(hist))],
        "counts": hist.tolist(),
    }

    result = {
        "n_matches": len(rows),
        "calibration": calibration,
        "brier": brier,
        "confidence_distribution": conf_dist,
    }
    calibration_cache.set(result)
    return result
