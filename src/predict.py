"""MatchPredictor: turn trained artifacts + current team form into match forecasts."""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.data_loader import load_results
from src.elo import compute_elo
from src.external_data import (apply_squad_adjustment, load_city_altitude,
                                load_squad_data, squad_metrics, squad_quality_score,
                                _build_norms)
from src.features import FEATURES, h2h_lookup, latest_team_stats, make_future_row, current_wc_stats
from src.train import ELO_COLS, MAX_GOALS, score_matrices, wdl_from_matrices

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# WC 2026 group-stage venues (city → altitude). Used when predicting WC matches.
WC_VENUE_ALTITUDE: dict[str, float] = {
    # USA
    "Los Angeles": 71, "San Francisco": 16, "Dallas": 144, "Houston": 15,
    "Atlanta": 320, "Miami": 2, "Seattle": 56, "Kansas City": 319,
    "Philadelphia": 12, "Boston": 9, "New York": 10,
    # Mexico
    "Mexico City": 2240, "Guadalajara": 1566, "Monterrey": 538,
    # Canada
    "Vancouver": 70, "Toronto": 76,
}


class MatchPredictor:
    """Predicts W/D/L probabilities and score matrices for hypothetical matches,
    using team form/Elo computed from the latest available results."""

    def __init__(self, results: pd.DataFrame | None = None, download: bool = False,
                 squad_adjustment_strength: float = 0.18):
        art = joblib.load(MODELS_DIR / "model.joblib")
        self.clf = art["clf"]
        self.lin = art["lin"]
        self.pois_home = art["pois_home"]
        self.pois_away = art["pois_away"]
        self.elo_base = art["elo_base"]
        self.blend_w = art["blend_w"]
        self.trained_through = art["trained_through"]

        self.results = results if results is not None else load_results(download=download)
        _, self.ratings = compute_elo(self.results)
        self.stats = latest_team_stats(self.results)
        self.wc_stats = current_wc_stats(self.results)
        self.as_of = self.results["date"].max() + pd.Timedelta(days=1)

        self.city_altitude = load_city_altitude()
        self.squad_data = load_squad_data()
        self._squad_norms = _build_norms(self.squad_data)
        self.squad_adjustment_strength = squad_adjustment_strength

    def teams(self) -> list[str]:
        return sorted(self.ratings, key=self.ratings.get, reverse=True)

    def _rows(self, fixtures: list[tuple[str, str, bool, float]]) -> pd.DataFrame:
        rows = [
            make_future_row(h, a, self.stats, self.ratings,
                            h2h_lookup(self.results, h, a), neutral, self.as_of,
                            altitude=alt, wc_stats=self.wc_stats)
            for h, a, neutral, alt in fixtures
        ]
        return pd.DataFrame(rows)[FEATURES]

    def predict_many(self, fixtures: list[tuple[str, str, bool]],
                     injuries: dict[str, int] | None = None,
                     venue_city: str | None = None) -> list[dict]:
        """Batch prediction. For neutral fixtures, both orderings are averaged so
        the arbitrary home/away assignment doesn't skew the forecast.

        injuries: {team_name: n_key_players_out} — reduces effective squad value.
        venue_city: if provided, looks up altitude for that city.
        """
        inj = injuries or {}
        alt = self.city_altitude.get(venue_city, 0.0) if venue_city else 0.0

        # Build (h, a, neutral, altitude) tuples for forward and reversed orientations
        fwd_fix = [(h, a, n, alt) for h, a, n in fixtures]
        rev_fix = [(a, h, n, alt) for h, a, n in fixtures]

        fwd = self._rows(fwd_fix)
        rev = self._rows(rev_fix)
        X = pd.concat([fwd, rev], ignore_index=True)

        p_clf = self.clf.predict_proba(X)
        p_lin = self.lin.predict_proba(X)
        p_elo = self.elo_base.predict_proba(X[ELO_COLS])
        lam_h = np.clip(self.pois_home.predict(X), 0.05, MAX_GOALS)
        lam_a = np.clip(self.pois_away.predict(X), 0.05, MAX_GOALS)

        n = len(fixtures)
        w_clf, w_lin, w_pois, w_elo = self.blend_w
        out = []
        for i, (h, a, neutral) in enumerate(fixtures):
            j = n + i
            if neutral:
                pc = (p_clf[i] + p_clf[j][::-1]) / 2
                pl = (p_lin[i] + p_lin[j][::-1]) / 2
                pe = (p_elo[i] + p_elo[j][::-1]) / 2
                lh = (lam_h[i] + lam_a[j]) / 2
                la = (lam_a[i] + lam_h[j]) / 2
            else:
                pc, pl, pe, lh, la = p_clf[i], p_lin[i], p_elo[i], lam_h[i], lam_a[i]

            mat = score_matrices(np.array([lh]), np.array([la]))[0]
            p_pois = wdl_from_matrices(mat[None])[0]
            probs = w_clf * pc + w_lin * pl + w_pois * p_pois + w_elo * pe
            ph, pd_, pa = float(probs[0]), float(probs[1]), float(probs[2])

            # Squad quality adjustment (post-model, logit-scale)
            if self.squad_adjustment_strength > 0:
                qs_h = squad_quality_score(h, self.squad_data, self._squad_norms,
                                           injury_penalty=inj.get(h, 0))
                qs_a = squad_quality_score(a, self.squad_data, self._squad_norms,
                                           injury_penalty=inj.get(a, 0))
                ph, pd_, pa = apply_squad_adjustment(
                    ph, pd_, pa, qs_h, qs_a, self.squad_adjustment_strength)

            sm_h = squad_metrics(h, self.squad_data)
            sm_a = squad_metrics(a, self.squad_data)
            out.append({
                "home": h, "away": a, "neutral": neutral,
                "p_home": ph, "p_draw": pd_, "p_away": pa,
                "lambda_home": float(lh), "lambda_away": float(la),
                "score_matrix": mat,
                "elo_home": self.ratings.get(h, 1500.0),
                "elo_away": self.ratings.get(a, 1500.0),
                # Squad metrics for display
                "squad_value_home": sm_h.get("squad_value_m"),
                "squad_value_away": sm_a.get("squad_value_m"),
                "fifa_rank_home": sm_h.get("fifa_rank"),
                "fifa_rank_away": sm_a.get("fifa_rank"),
                "league_idx_home": sm_h.get("league_idx"),
                "league_idx_away": sm_a.get("league_idx"),
                "avg_caps_home": sm_h.get("avg_caps"),
                "avg_caps_away": sm_a.get("avg_caps"),
                "coach_wr_home": sm_h.get("coach_wr"),
                "coach_wr_away": sm_a.get("coach_wr"),
            })
        return out

    def predict(self, home: str, away: str, neutral: bool = True,
                injuries: dict[str, int] | None = None,
                venue_city: str | None = None) -> dict:
        pred = self.predict_many([(home, away, neutral)],
                                 injuries=injuries, venue_city=venue_city)[0]
        mat = pred["score_matrix"]
        flat = [(int(i), int(j), float(mat[i, j]))
                for i in range(mat.shape[0]) for j in range(mat.shape[1])]
        pred["top_scores"] = sorted(flat, key=lambda t: t[2], reverse=True)[:5]
        return pred


def ingame_probs(lambda_home: float, lambda_away: float,
                 score_home: int, score_away: int,
                 minute: int, extra_min: int = 0) -> dict:
    """Win probabilities from current match state using scaled Poisson remainders.

    Scales the pre-match expected goals by the fraction of time remaining, then
    computes the joint distribution of additional goals and sums over all outcomes
    that result in a home win, draw, or away win given the current score.
    """
    remaining = max((90 + extra_min - minute) / 90, 0.0)
    lam_h = max(lambda_home * remaining, 1e-6)
    lam_a = max(lambda_away * remaining, 1e-6)

    mat = score_matrices(np.array([lam_h]), np.array([lam_a]))[0]
    G = mat.shape[0]
    p_home = p_draw = p_away = 0.0
    for i in range(G):
        for j in range(G):
            final_h = score_home + i
            final_a = score_away + j
            p = float(mat[i, j])
            if final_h > final_a:
                p_home += p
            elif final_h == final_a:
                p_draw += p
            else:
                p_away += p
    return {
        "p_home": p_home, "p_draw": p_draw, "p_away": p_away,
        "minute": minute, "score_home": score_home, "score_away": score_away,
    }


if __name__ == "__main__":
    mp = MatchPredictor()
    for h, a, neutral in [("Spain", "Cape Verde", True), ("Argentina", "France", True),
                           ("United States", "Paraguay", False)]:
        p = mp.predict(h, a, neutral)
        print(f"{h} vs {a} (neutral={neutral}): "
              f"W {p['p_home']:.1%} / D {p['p_draw']:.1%} / L {p['p_away']:.1%} | "
              f"xG {p['lambda_home']:.2f}-{p['lambda_away']:.2f} | "
              f"squad €{p['squad_value_home']}M vs €{p['squad_value_away']}M | "
              f"FIFA #{p['fifa_rank_home']} vs #{p['fifa_rank_away']}")
