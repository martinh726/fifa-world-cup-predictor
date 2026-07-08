"""compute_accuracy must batch all predictions into a single predict_many call
and silently skip matches involving teams the predictor doesn't know."""
from backend.utils import compute_accuracy


class StubPredictor:
    """Scripted predict_many keyed by (home, away) — records how it was called."""

    def __init__(self, known_teams, script):
        self.ratings = {t: 1500.0 for t in known_teams}
        self._script = script
        self.calls = []

    def predict_many(self, fixtures):
        self.calls.append(fixtures)
        return [self._script[(h, a)] for h, a, _ in fixtures]


def _probs(p_home, p_draw, p_away):
    return {"p_home": p_home, "p_draw": p_draw, "p_away": p_away}


def test_single_batched_call_for_all_matches():
    script = {
        ("A", "B"): _probs(0.6, 0.2, 0.2),
        ("C", "D"): _probs(0.3, 0.3, 0.4),
    }
    predictor = StubPredictor(["A", "B", "C", "D"], script)

    group_results = [("A", "B", 2, 0)]
    ko_results = [("C", "D", "D")]

    result = compute_accuracy(predictor, group_results, ko_results)

    assert len(predictor.calls) == 1  # exactly one predict_many call, not per-match
    assert result["total"] == 2
    assert result["correct"] == 2  # A predicted+actual win; D predicted+actual win
    assert len(result["matches"]) == 2


def test_unknown_teams_are_skipped_without_crashing():
    script = {("A", "B"): _probs(0.5, 0.25, 0.25)}
    predictor = StubPredictor(["A", "B"], script)

    group_results = [("A", "B", 1, 1), ("A", "Unknown", 3, 0)]
    result = compute_accuracy(predictor, group_results, [])

    assert result["total"] == 1
    assert result["matches"][0]["match"] == "A vs B"


def test_empty_input_returns_zeroed_result():
    predictor = StubPredictor([], {})
    result = compute_accuracy(predictor, [], [])
    assert result == {"correct": 0, "total": 0, "accuracy": 0.0, "brier": 0.0, "matches": []}
