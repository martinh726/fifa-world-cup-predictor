"""The Final Four resolver: recursively resolving which team reaches a match
(walking back through undecided earlier rounds), and the two-pass pattern
that turns a dry run into a batched-prediction-backed real run."""
import pytest

from backend.routers.final_four import _is_slot_ref, _resolve
from src.simulate import knockout_win_prob


def test_is_slot_ref_parses_placeholder():
    assert _is_slot_ref("W97", {"France", "Spain"}) == 97


def test_is_slot_ref_concrete_team_returns_none():
    assert _is_slot_ref("France", {"France", "Spain"}) is None


def test_is_slot_ref_non_slot_string_returns_none():
    assert _is_slot_ref("Best 3rd", {"France"}) is None


# ─── knockout_win_prob ────────────────────────────────────────────────────────

def test_knockout_win_prob_even_match_is_a_coin_flip():
    assert knockout_win_prob(0.4, 0.2, 0.4) == pytest.approx(0.5)


def test_knockout_win_prob_favorite_gets_a_share_of_the_draw():
    # p_home > p_away: home side should end up above its raw 90-min win share
    p = knockout_win_prob(0.5, 0.2, 0.3)
    assert 0.5 < p < 0.7


def test_knockout_win_prob_no_draw_case():
    assert knockout_win_prob(0.6, 0.0, 0.4) == pytest.approx(0.6)


# ─── _resolve ─────────────────────────────────────────────────────────────────

def test_resolve_decided_match_returns_real_winner():
    bracket = {101: {"team1": "France", "team2": "Spain", "actual": True, "winner": "France"}}
    result = _resolve(101, bracket, {"France", "Spain"}, win_prob=lambda a, b: 0.5)
    assert result == [("France", 1.0)]


def test_resolve_concrete_pending_match_uses_win_prob_directly():
    bracket = {101: {"team1": "France", "team2": "Spain", "actual": False, "winner": None}}
    result = _resolve(101, bracket, {"France", "Spain"}, win_prob=lambda a, b: 0.7)
    assert dict(result) == {"France": pytest.approx(0.7), "Spain": pytest.approx(0.3)}


def test_resolve_recurses_through_undecided_feeder_match():
    # SF2-style: team1/team2 are still 'W99'/'W100' placeholders because the
    # two feeding quarterfinals haven't been played yet.
    bracket = {
        99: {"team1": "Norway", "team2": "England", "actual": False, "winner": None},
        100: {"team1": "Argentina", "team2": "Switzerland", "actual": False, "winner": None},
        102: {"team1": "W99", "team2": "W100", "actual": False, "winner": None},
    }
    known = {"Norway", "England", "Argentina", "Switzerland"}

    # Fixed win probabilities per pairing, independent of call order.
    fixed = {
        frozenset(("Norway", "England")): ("Norway", 0.6),
        frozenset(("Argentina", "Switzerland")): ("Argentina", 0.8),
        frozenset(("Norway", "Argentina")): ("Argentina", 0.55),
        frozenset(("Norway", "Switzerland")): ("Norway", 0.65),
        frozenset(("England", "Argentina")): ("Argentina", 0.6),
        frozenset(("England", "Switzerland")): ("England", 0.7),
    }

    def win_prob(a, b):
        home, p_home = fixed[frozenset((a, b))]
        return p_home if home == a else 1 - p_home

    dist = dict(_resolve(102, bracket, known, win_prob))

    # Hand-computed expectation:
    # P(Norway advances QF99) = 0.6, P(England) = 0.4
    # P(Argentina advances QF100) = 0.8, P(Switzerland) = 0.2
    p_norway_sf = 0.6 * 0.8 * 0.45 + 0.6 * 0.2 * 0.65   # vs Argentina, vs Switzerland
    p_england_sf = 0.4 * 0.8 * 0.4 + 0.4 * 0.2 * 0.7
    p_argentina_sf = 0.6 * 0.8 * 0.55 + 0.4 * 0.8 * 0.6
    p_switzerland_sf = 0.6 * 0.2 * 0.35 + 0.4 * 0.2 * 0.3

    assert dist["Norway"] == pytest.approx(p_norway_sf, abs=1e-9)
    assert dist["England"] == pytest.approx(p_england_sf, abs=1e-9)
    assert dist["Argentina"] == pytest.approx(p_argentina_sf, abs=1e-9)
    assert dist["Switzerland"] == pytest.approx(p_switzerland_sf, abs=1e-9)
    assert sum(dist.values()) == pytest.approx(1.0)


def test_resolve_sorted_descending_by_probability():
    bracket = {101: {"team1": "France", "team2": "Spain", "actual": False, "winner": None}}
    result = _resolve(101, bracket, {"France", "Spain"}, win_prob=lambda a, b: 0.3)
    assert [t for t, _ in result] == ["Spain", "France"]


def test_dry_run_collector_discovers_all_needed_pairs():
    """The pair-collection pattern used by the endpoint: a stub win_prob that
    just records pairs must discover the same pairs the real run will need."""
    bracket = {
        99: {"team1": "Norway", "team2": "England", "actual": False, "winner": None},
        100: {"team1": "Argentina", "team2": "Switzerland", "actual": False, "winner": None},
        101: {"team1": "France", "team2": "Spain", "actual": False, "winner": None},
        102: {"team1": "W99", "team2": "W100", "actual": False, "winner": None},
    }
    known = {"Norway", "England", "Argentina", "Switzerland", "France", "Spain"}

    needed = set()

    def collect(a, b):
        needed.add(frozenset((a, b)))
        return 0.5

    d1 = _resolve(101, bracket, known, collect)
    d2 = _resolve(102, bracket, known, collect)
    for a, _ in d1:
        for b, _ in d2:
            needed.add(frozenset((a, b)))

    expected = {
        # SF1's own real matchup
        frozenset(("France", "Spain")),
        # the two quarterfinals feeding SF2
        frozenset(("Norway", "England")),
        frozenset(("Argentina", "Switzerland")),
        # SF2 itself needs a win_prob for each cross-pairing of its two feeders
        frozenset(("Norway", "Argentina")), frozenset(("Norway", "Switzerland")),
        frozenset(("England", "Argentina")), frozenset(("England", "Switzerland")),
        # and the final needs every SF1-winner x SF2-winner combination
        frozenset(("France", "Norway")), frozenset(("France", "England")),
        frozenset(("France", "Argentina")), frozenset(("France", "Switzerland")),
        frozenset(("Spain", "Norway")), frozenset(("Spain", "England")),
        frozenset(("Spain", "Argentina")), frozenset(("Spain", "Switzerland")),
    }
    assert needed == expected
