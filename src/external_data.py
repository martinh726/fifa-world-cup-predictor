"""External data loaders: city altitude lookup and squad quality scoring."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DATA = PROJECT_ROOT / "data"


def load_city_altitude() -> dict[str, float]:
    with open(_DATA / "city_altitude.json", encoding="utf-8") as f:
        data = json.load(f)
    return {k: float(v) for k, v in data.items() if not k.startswith("_")}


def load_squad_data() -> dict[str, dict]:
    with open(_DATA / "squad_data.json", encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_")}


# Pre-compute normalisation stats once from the 48-team population
def _build_norms(squad_data: dict) -> dict[str, tuple[float, float]]:
    """Returns {field: (mean, std)} for z-score normalisation."""
    fields = ["squad_value_m", "fifa_rank", "league_idx", "avg_caps"]
    norms = {}
    for f in fields:
        vals = np.array([v[f] for v in squad_data.values()], dtype=float)
        norms[f] = (float(vals.mean()), float(vals.std()) or 1.0)
    # coach win rate derived from raw counts
    wrs = np.array(
        [v["coach_wins"] / max(v["coach_wins"] + v["coach_draws"] + v["coach_losses"], 1)
         for v in squad_data.values()], dtype=float)
    norms["coach_wr"] = (float(wrs.mean()), float(wrs.std()) or 1.0)
    return norms


def squad_quality_score(team: str, squad_data: dict,
                         norms: dict | None = None,
                         injury_penalty: float = 0.0) -> float:
    """Composite quality score (z-score-like, higher = stronger squad).

    injury_penalty: each missing key player reduces the squad_value_m by
    this amount (default 30 €M per player) before normalisation.
    """
    PER_PLAYER_PENALTY_M = 30.0
    if team not in squad_data:
        return 0.0
    if norms is None:
        norms = _build_norms(squad_data)

    d = squad_data[team]
    sv = d["squad_value_m"] - injury_penalty * PER_PLAYER_PENALTY_M
    rank_inv = -d["fifa_rank"]  # lower rank is better → negate
    wr = d["coach_wins"] / max(d["coach_wins"] + d["coach_draws"] + d["coach_losses"], 1)

    # Normalise each component
    sv_z  = (sv - norms["squad_value_m"][0]) / norms["squad_value_m"][1]
    # For FIFA rank, we negate then normalise (high negative rank_inv = low rank = good)
    rank_norm_mean = -norms["fifa_rank"][0]
    rank_norm_std  =  norms["fifa_rank"][1]
    rank_z = (rank_inv - rank_norm_mean) / rank_norm_std
    li_z  = (d["league_idx"] - norms["league_idx"][0]) / norms["league_idx"][1]
    cap_z = (d["avg_caps"]   - norms["avg_caps"][0])   / norms["avg_caps"][1]
    wr_z  = (wr              - norms["coach_wr"][0])   / norms["coach_wr"][1]

    # Weighted composite
    score = (0.35 * sv_z + 0.25 * rank_z + 0.20 * li_z
             + 0.10 * cap_z + 0.10 * wr_z)
    return float(np.clip(score, -3.0, 3.0))


def apply_squad_adjustment(
        p_home: float, p_draw: float, p_away: float,
        home_quality: float, away_quality: float,
        strength: float = 0.18) -> tuple[float, float, float]:
    """Logit-scale adjustment based on squad quality differential.

    A positive (home_quality − away_quality) nudges p_home up and p_away down.
    The draw probability moves proportionally to keep the three values summing to 1.
    strength=0 disables the adjustment completely.
    """
    if strength == 0 or (home_quality == 0 and away_quality == 0):
        return p_home, p_draw, p_away

    diff = home_quality - away_quality  # positive → home team is stronger
    bump = strength * diff

    # Apply to logits relative to draw
    eps = 1e-9
    logit_h = np.log(max(p_home, eps) / max(p_draw, eps)) + bump
    logit_a = np.log(max(p_away, eps) / max(p_draw, eps)) - bump
    h = np.exp(logit_h)
    a = np.exp(logit_a)
    total = h + 1.0 + a
    return float(h / total), float(1.0 / total), float(a / total)


def squad_metrics(team: str, squad_data: dict) -> dict:
    """Return display-ready squad metrics for a single team (or empty dict)."""
    if team not in squad_data:
        return {}
    d = squad_data[team]
    wr = d["coach_wins"] / max(d["coach_wins"] + d["coach_draws"] + d["coach_losses"], 1)
    return {
        "squad_value_m": d["squad_value_m"],
        "fifa_rank": d["fifa_rank"],
        "league_idx": d["league_idx"],
        "avg_caps": d["avg_caps"],
        "coach_wr": round(wr, 3),
    }
