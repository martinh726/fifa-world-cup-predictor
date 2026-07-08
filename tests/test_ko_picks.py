"""Knockout what-if: merge_ko_picks conflict/order rules, plus an end-to-end
check that a forced ko_winners pairing actually wins every simulation."""
import numpy as np
import pytest

from backend.utils import merge_ko_picks


def test_merge_ko_picks_drops_picks_on_decided_pairings():
    live_ko = [("France", "Brazil", "France")]
    picks = [
        ("France", "Brazil", "Brazil"),   # conflicts with a real decided result
        ("Spain", "Argentina", "Spain"),  # untouched pairing — kept
    ]
    merged = merge_ko_picks(live_ko, picks)
    assert merged == [("Spain", "Argentina", "Spain"), ("France", "Brazil", "France")]


def test_merge_ko_picks_real_results_come_last():
    # Real results are appended after picks so they win any remaining clash
    # in the simulator's forced-winner map (later entries overwrite earlier).
    merged = merge_ko_picks([("A", "B", "A")], [("C", "D", "C")])
    assert merged[-1] == ("A", "B", "A")


def test_merge_ko_picks_empty_inputs():
    assert merge_ko_picks([], []) == []
    assert merge_ko_picks([], [("A", "B", "A")]) == [("A", "B", "A")]


# ─── Simulator integration: a forced pairing must win every sim ──────────────

class UniformPredictor:
    """predict_many stub: every match is a flat 1/3-1/3-1/3 coin flip with a
    uniform scoreline distribution — enough to exercise TournamentSimulator's
    bracket-forcing logic without needing the trained model."""

    def __init__(self, max_goals: int = 10):
        n = max_goals + 1
        self._mat = np.ones((n, n)) / (n * n)

    def predict_many(self, fixtures):
        return [
            {
                "home": h, "away": a,
                "p_home": 1 / 3, "p_draw": 1 / 3, "p_away": 1 / 3,
                "score_matrix": self._mat,
            }
            for h, a, _ in fixtures
        ]


@pytest.fixture(scope="module")
def wc_config():
    from src.data_loader import load_wc2026
    return load_wc2026()


def _sweep_group(teams: list[str]) -> list[tuple[str, str, int, int]]:
    """Deterministic 2-0 sweep in team order — strictly separates every team
    on points alone, so group ranking never depends on GD/GF tiebreak noise."""
    from itertools import combinations
    return [(a, b, 2, 0) for a, b in combinations(teams, 2)]


def test_forced_ko_winner_wins_every_simulation(wc_config):
    from src.simulate import TournamentSimulator

    group_a = wc_config["groups"]["A"]  # runner-up (2A) becomes group_a[1] under a sweep
    group_b = wc_config["groups"]["B"]  # runner-up (2B) becomes group_b[1]
    runner_a, runner_b = group_a[1], group_b[1]

    match_73 = next(m for m in wc_config["round_of_32"]
                    if m["slot1"] == "2A" and m["slot2"] == "2B")

    locked_group = _sweep_group(group_a) + _sweep_group(group_b)
    ko_winners = [(runner_a, runner_b, runner_a)]

    sim = TournamentSimulator(UniformPredictor(), wc_config, n_sims=200, seed=1)
    result = sim.run(locked_group=locked_group, ko_winners=ko_winners)

    match = result["bracket"][match_73["match"]]
    assert match["winner"] == runner_a
    assert match["win_prob"] == pytest.approx(1.0)
