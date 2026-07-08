"""with_strength() must be a cheap, read-only clone: shared heavy state,
independent squad_adjustment_strength, and it must actually change predictions."""
from pathlib import Path

import pytest

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
pytestmark = pytest.mark.skipif(
    not (MODELS_DIR / "model.joblib").exists(), reason="models/model.joblib not built"
)


@pytest.fixture(scope="module")
def predictor():
    from src.predict import MatchPredictor
    return MatchPredictor()


def test_with_strength_same_value_returns_self(predictor):
    assert predictor.with_strength(predictor.squad_adjustment_strength) is predictor


def test_with_strength_shares_heavy_state(predictor):
    clone = predictor.with_strength(predictor.squad_adjustment_strength + 0.1)
    assert clone is not predictor
    assert clone.ratings is predictor.ratings
    assert clone.clf is predictor.clf
    assert clone.stats is predictor.stats
    assert clone.results is predictor.results


def test_with_strength_does_not_mutate_original(predictor):
    original_strength = predictor.squad_adjustment_strength
    predictor.with_strength(original_strength + 0.15)
    assert predictor.squad_adjustment_strength == original_strength


def test_with_strength_changes_predictions(predictor):
    teams = predictor.teams()
    home, away = teams[0], teams[-1]  # a strong vs a weak team — squad gap is visible

    low = predictor.with_strength(0.0)
    high = predictor.with_strength(0.5)

    p_low = low.predict(home, away, neutral=True)
    p_high = high.predict(home, away, neutral=True)

    assert p_low["p_home"] != pytest.approx(p_high["p_home"], abs=1e-9)
