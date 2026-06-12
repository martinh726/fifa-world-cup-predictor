"""Elo ratings computed over the full match history (eloratings.net methodology)."""
from __future__ import annotations

import numpy as np
import pandas as pd

START_RATING = 1500.0
HOME_ADVANTAGE = 80.0  # Elo points added to the home side at non-neutral venues

# K-factor by match importance (eloratings.net convention)
K_WORLD_CUP = 60
K_CONTINENTAL = 50
K_QUALIFIER = 40
K_MINOR_TOURNAMENT = 30
K_FRIENDLY = 20

CONTINENTAL_FINALS = {
    "UEFA Euro", "Copa América", "African Cup of Nations", "AFC Asian Cup",
    "CONCACAF Championship", "Gold Cup", "Oceania Nations Cup",
    "Confederations Cup", "African Nations Championship",
}


def k_factor(tournament: str) -> int:
    t = tournament or ""
    if t == "FIFA World Cup":
        return K_WORLD_CUP
    if t in CONTINENTAL_FINALS:
        return K_CONTINENTAL
    if "qualification" in t.lower():
        return K_QUALIFIER
    if t == "Friendly":
        return K_FRIENDLY
    return K_MINOR_TOURNAMENT


def goal_multiplier(margin: int) -> float:
    if margin <= 1:
        return 1.0
    if margin == 2:
        return 1.5
    return (11 + margin) / 8


def expected_score(rating_a: float, rating_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


def compute_elo(results: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    """Run Elo over chronologically-sorted results.

    Returns the results frame with pre-match rating columns added, and the
    final ratings dict after the last match.
    """
    ratings: dict[str, float] = {}
    home_pre = np.empty(len(results))
    away_pre = np.empty(len(results))

    home_teams = results["home_team"].to_numpy()
    away_teams = results["away_team"].to_numpy()
    home_scores = results["home_score"].to_numpy()
    away_scores = results["away_score"].to_numpy()
    neutrals = results["neutral"].to_numpy()
    ks = results["tournament"].map(k_factor).to_numpy()

    for i in range(len(results)):
        h, a = home_teams[i], away_teams[i]
        rh = ratings.get(h, START_RATING)
        ra = ratings.get(a, START_RATING)
        home_pre[i] = rh
        away_pre[i] = ra

        adv = 0.0 if neutrals[i] else HOME_ADVANTAGE
        exp_home = expected_score(rh + adv, ra)

        hs, as_ = home_scores[i], away_scores[i]
        actual = 1.0 if hs > as_ else (0.0 if hs < as_ else 0.5)
        delta = ks[i] * goal_multiplier(abs(hs - as_)) * (actual - exp_home)

        ratings[h] = rh + delta
        ratings[a] = ra - delta

    out = results.copy()
    out["home_elo_pre"] = home_pre
    out["away_elo_pre"] = away_pre
    return out, ratings


if __name__ == "__main__":
    from src.data_loader import load_results

    results = load_results()
    _, ratings = compute_elo(results)
    top = sorted(ratings.items(), key=lambda kv: kv[1], reverse=True)[:15]
    print("Top 15 Elo ratings:")
    for i, (team, r) in enumerate(top, 1):
        print(f"{i:2d}. {team:25s} {r:7.1f}")
