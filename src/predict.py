"""MatchPredictor: turn trained artifacts + current team form into match forecasts."""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.data_loader import load_results
from src.elo import compute_elo
from src.features import FEATURES, h2h_lookup, latest_team_stats, make_future_row
from src.train import ELO_COLS, MAX_GOALS, score_matrices, wdl_from_matrices

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


class MatchPredictor:
    """Predicts W/D/L probabilities and score matrices for hypothetical matches,
    using team form/Elo computed from the latest available results."""

    def __init__(self, results: pd.DataFrame | None = None, download: bool = False):
        art = joblib.load(MODELS_DIR / "model.joblib")
        self.clf = art["clf"]
        self.lin = art["lin"]
        self.pois_home = art["pois_home"]
        self.pois_away = art["pois_away"]
        self.elo_base = art["elo_base"]
        self.blend_w = art["blend_w"]  # weights for (clf, lin, pois, elo)
        self.trained_through = art["trained_through"]

        self.results = results if results is not None else load_results(download=download)
        _, self.ratings = compute_elo(self.results)
        self.stats = latest_team_stats(self.results)
        self.as_of = self.results["date"].max() + pd.Timedelta(days=1)

    def teams(self) -> list[str]:
        return sorted(self.ratings, key=self.ratings.get, reverse=True)

    def _rows(self, fixtures: list[tuple[str, str, bool]]) -> pd.DataFrame:
        rows = [
            make_future_row(h, a, self.stats, self.ratings,
                            h2h_lookup(self.results, h, a), neutral, self.as_of)
            for h, a, neutral in fixtures
        ]
        return pd.DataFrame(rows)[FEATURES]

    def predict_many(self, fixtures: list[tuple[str, str, bool]]) -> list[dict]:
        """Batch prediction. For neutral fixtures, both orderings are averaged so
        the arbitrary home/away assignment doesn't skew the forecast."""
        fwd = self._rows(fixtures)
        rev = self._rows([(a, h, n) for h, a, n in fixtures])
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
            j = n + i  # reversed-ordering row
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
            out.append({
                "home": h, "away": a, "neutral": neutral,
                "p_home": float(probs[0]), "p_draw": float(probs[1]), "p_away": float(probs[2]),
                "lambda_home": float(lh), "lambda_away": float(la),
                "score_matrix": mat,
                "elo_home": self.ratings.get(h, 1500.0), "elo_away": self.ratings.get(a, 1500.0),
            })
        return out

    def predict(self, home: str, away: str, neutral: bool = True) -> dict:
        pred = self.predict_many([(home, away, neutral)])[0]
        mat = pred["score_matrix"]
        flat = [(int(i), int(j), float(mat[i, j]))
                for i in range(mat.shape[0]) for j in range(mat.shape[1])]
        pred["top_scores"] = sorted(flat, key=lambda t: t[2], reverse=True)[:5]
        return pred


if __name__ == "__main__":
    mp = MatchPredictor()
    for h, a, neutral in [("Spain", "Cape Verde", True), ("Argentina", "France", True),
                          ("United States", "Paraguay", False)]:
        p = mp.predict(h, a, neutral)
        print(f"{h} vs {a} (neutral={neutral}): "
              f"W {p['p_home']:.1%} / D {p['p_draw']:.1%} / L {p['p_away']:.1%} | "
              f"xG {p['lambda_home']:.2f}-{p['lambda_away']:.2f} | "
              f"top score {p['top_scores'][0][0]}-{p['top_scores'][0][1]} ({p['top_scores'][0][2]:.1%})")
