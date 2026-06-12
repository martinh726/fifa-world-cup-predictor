"""Train the outcome classifier + Poisson scoreline models, with World Cup backtesting.

The production forecast is a 3-way blend:
  P = w_clf * gradient-boosted classifier + w_pois * Poisson scoreline model + w_elo * Elo logistic
Blend weights are chosen on the 2014+2018 World Cups; 2022 stays untouched as the
honest test. Neutral-venue predictions are symmetrized (both orientations averaged).
"""
from __future__ import annotations

import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, PoissonRegressor
from sklearn.metrics import accuracy_score, log_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.data_loader import load_results
from src.elo import compute_elo
from src.features import FEATURES, build_match_features, swap_orientation

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = PROJECT_ROOT / "models"
REPORTS_DIR = PROJECT_ROOT / "reports"

MAX_GOALS = 10  # score-matrix grid size; also the cap applied to Poisson training targets
BACKTEST_WCS = (2014, 2018, 2022)
ELO_COLS = ["elo_diff", "neutral"]

_FACTORIALS = np.array([math.factorial(k) for k in range(MAX_GOALS + 1)], dtype=float)


def make_classifier() -> CalibratedClassifierCV:
    base = HistGradientBoostingClassifier(
        max_iter=300, learning_rate=0.05, max_leaf_nodes=15,
        min_samples_leaf=60, l2_regularization=1.0, random_state=42)
    return CalibratedClassifierCV(base, method="isotonic", cv=3)


def make_poisson() -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("poisson", PoissonRegressor(alpha=1.0, max_iter=500)),
    ])


def make_elo_baseline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("lr", LogisticRegression(max_iter=1000)),
    ])


def make_linear() -> Pipeline:
    """Regularized multinomial logistic on the full feature set — a robust,
    low-variance complement to the gradient-boosted classifier."""
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("lr", LogisticRegression(C=0.3, max_iter=2000)),
    ])


def poisson_pmf(lam: np.ndarray) -> np.ndarray:
    """PMF over 0..MAX_GOALS for each lambda; rows renormalized."""
    k = np.arange(MAX_GOALS + 1)
    pmf = np.exp(-lam[:, None]) * lam[:, None] ** k / _FACTORIALS
    return pmf / pmf.sum(axis=1, keepdims=True)


def score_matrices(lam_home: np.ndarray, lam_away: np.ndarray) -> np.ndarray:
    """(n, G+1, G+1) joint score probability matrices (independent Poisson)."""
    ph = poisson_pmf(np.asarray(lam_home, dtype=float))
    pa = poisson_pmf(np.asarray(lam_away, dtype=float))
    return ph[:, :, None] * pa[:, None, :]


def wdl_from_matrices(mats: np.ndarray) -> np.ndarray:
    """(n, 3) [home win, draw, away win] probabilities from score matrices."""
    home = np.tril(mats, k=-1).sum(axis=(1, 2))
    draw = np.trace(mats, axis1=1, axis2=2)
    away = np.triu(mats, k=1).sum(axis=(1, 2))
    return np.stack([home, draw, away], axis=1)


def evaluate(y: np.ndarray, proba: np.ndarray) -> dict:
    onehot = np.eye(3)[y]
    return {
        "log_loss": log_loss(y, proba, labels=[0, 1, 2]),
        "brier": float(np.mean(np.sum((proba - onehot) ** 2, axis=1))),
        "accuracy": accuracy_score(y, proba.argmax(axis=1)),
    }


def fit_models(train: pd.DataFrame) -> dict:
    X = train[FEATURES]
    return {
        "clf": make_classifier().fit(X, train["outcome"]),
        "lin": make_linear().fit(X, train["outcome"]),
        "pois_home": make_poisson().fit(X, train["home_score"].clip(upper=MAX_GOALS)),
        "pois_away": make_poisson().fit(X, train["away_score"].clip(upper=MAX_GOALS)),
        "elo_base": make_elo_baseline().fit(train[ELO_COLS], train["outcome"]),
    }


def predict_components(models: dict, feats_rows: pd.DataFrame):
    """Symmetrized component predictions: for neutral matches, the forecast is the
    average of both home/away orientations (the label is arbitrary at a neutral venue)."""
    fwd = feats_rows
    rev = swap_orientation(feats_rows)
    neutral = feats_rows["neutral"].to_numpy().astype(bool)

    def sym_proba(p_f: np.ndarray, p_r: np.ndarray) -> np.ndarray:
        p = p_f.copy()
        p[neutral] = (p_f[neutral] + p_r[neutral][:, ::-1]) / 2
        return p

    p_clf = sym_proba(models["clf"].predict_proba(fwd[FEATURES]),
                      models["clf"].predict_proba(rev[FEATURES]))
    p_lin = sym_proba(models["lin"].predict_proba(fwd[FEATURES]),
                      models["lin"].predict_proba(rev[FEATURES]))
    p_elo = sym_proba(models["elo_base"].predict_proba(fwd[ELO_COLS]),
                      models["elo_base"].predict_proba(rev[ELO_COLS]))

    lam_h_f = np.clip(models["pois_home"].predict(fwd[FEATURES]), 0.05, MAX_GOALS)
    lam_a_f = np.clip(models["pois_away"].predict(fwd[FEATURES]), 0.05, MAX_GOALS)
    lam_h_r = np.clip(models["pois_home"].predict(rev[FEATURES]), 0.05, MAX_GOALS)
    lam_a_r = np.clip(models["pois_away"].predict(rev[FEATURES]), 0.05, MAX_GOALS)
    lam_h = np.where(neutral, (lam_h_f + lam_a_r) / 2, lam_h_f)
    lam_a = np.where(neutral, (lam_a_f + lam_h_r) / 2, lam_a_f)
    p_pois = wdl_from_matrices(score_matrices(lam_h, lam_a))

    return {"clf": p_clf, "lin": p_lin, "pois": p_pois, "elo": p_elo,
            "lam_h": lam_h, "lam_a": lam_a}


COMPONENTS = ("clf", "lin", "pois", "elo")


def blend(comp: dict, w: tuple[float, ...]) -> np.ndarray:
    return sum(wi * comp[name] for wi, name in zip(w, COMPONENTS))


def _weight_grid(step: float = 0.05):
    n = round(1 / step)
    for i in range(n + 1):
        for j in range(n + 1 - i):
            for k in range(n + 1 - i - j):
                yield (i * step, j * step, k * step, round(1 - (i + j + k) * step, 4))


def backtest(feats: pd.DataFrame) -> tuple[pd.DataFrame, tuple[float, ...]]:
    """Walk-forward backtest on past World Cups.

    Blend weights are chosen on neutral-venue major-tournament matches in the two
    years after the 2014 and 2018 cutoffs (the closest out-of-sample analogue of
    World Cup conditions); the 2022 World Cup is never touched during selection.
    Returns (report, blend weights).
    """
    per_year: dict[int, tuple[np.ndarray, dict]] = {}
    val_y, val_comp = [], []
    for year in BACKTEST_WCS:
        cutoff = pd.Timestamp(year, 6, 1)
        train = feats[feats["date"] < cutoff]
        test = feats[(feats["tournament"] == "FIFA World Cup") & (feats["date"].dt.year == year)]
        models = fit_models(train)
        per_year[year] = (test["outcome"].to_numpy(), predict_components(models, test))
        if year != 2022:
            val = feats[(feats["date"] >= cutoff) &
                        (feats["date"] < cutoff + pd.DateOffset(months=24)) &
                        (feats["importance"] >= 3) & (feats["neutral"] == 1)]
            val_y.append(val["outcome"].to_numpy())
            val_comp.append(predict_components(models, val))

    y_pool = np.concatenate(val_y)
    comp_pool = {name: np.concatenate([c[name] for c in val_comp]) for name in COMPONENTS}
    grid_w = min(_weight_grid(),
                 key=lambda w: log_loss(y_pool, blend(comp_pool, w), labels=[0, 1, 2]))
    # Shrink halfway toward uniform: the validation pool is small, and an equal-weight
    # ensemble is the safest prior. This hedges across tournaments with different
    # upset rates instead of chasing the validation years.
    best_w = tuple(round(0.5 * w + 0.5 * 0.25, 4) for w in grid_w)

    rows = []
    for year, (y, comp) in per_year.items():
        for name, proba in [("elo_baseline", comp["elo"]), ("classifier", comp["clf"]),
                            ("linear", comp["lin"]), ("poisson", comp["pois"]),
                            ("blend", blend(comp, best_w))]:
            rows.append({"wc": year, "model": name, "n": len(y), **evaluate(y, proba)})

    report = pd.DataFrame(rows).sort_values(["wc", "log_loss"]).reset_index(drop=True)
    return report, best_w


def write_report(report: pd.DataFrame, w: tuple[float, float, float]) -> None:
    REPORTS_DIR.mkdir(exist_ok=True)
    lines = [
        "# World Cup Backtest Report", "",
        "Walk-forward evaluation: for each World Cup, models are trained only on matches",
        "played *before* that tournament, then scored on its matches.",
        f"Blend weights ({'/'.join(COMPONENTS)}) chosen on post-2014/2018 competitive matches: **{w}**.",
        "2022 was not used for weight selection — it is the honest holdout.", "",
        "Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.", "",
        report.to_markdown(index=False, floatfmt=".4f"), "",
    ]
    (REPORTS_DIR / "backtest.md").write_text("\n".join(lines), encoding="utf-8")


def train_final(feats: pd.DataFrame, w: tuple[float, float, float]) -> dict:
    models = fit_models(feats)
    artifacts = {**models, "blend_w": w, "features": FEATURES,
                 "trained_through": str(feats["date"].max().date())}
    MODELS_DIR.mkdir(exist_ok=True)
    joblib.dump(artifacts, MODELS_DIR / "model.joblib")
    return artifacts


def main():
    print("Loading data + computing Elo...")
    results = load_results()
    results_elo, _ = compute_elo(results)
    feats = build_match_features(results_elo)
    print(f"Training table: {len(feats):,} matches ({feats['date'].min().date()} .. {feats['date'].max().date()})")

    print("Backtesting on World Cups 2014/2018/2022...")
    report, w = backtest(feats)
    print(report.to_string(index=False))
    write_report(report, w)

    print(f"\nTraining final model on all data (blend weights {'/'.join(COMPONENTS)} = {w})...")
    train_final(feats, w)
    print(f"Saved {MODELS_DIR / 'model.joblib'} and {REPORTS_DIR / 'backtest.md'}")


if __name__ == "__main__":
    main()
