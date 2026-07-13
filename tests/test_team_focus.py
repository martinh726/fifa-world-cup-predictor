"""team_form/wc_history/shootout_record: pure DataFrame -> dict helpers behind
the enriched /api/team/{name} response."""
import pandas as pd

from backend.routers.team import WC_CHAMPIONS, shootout_record, team_form, wc_history


def _results(rows):
    """rows: (date, home, away, home_score, away_score, tournament)"""
    df = pd.DataFrame(rows, columns=[
        "date", "home_team", "away_team", "home_score", "away_score", "tournament",
    ])
    df["date"] = pd.to_datetime(df["date"])
    return df


def test_team_form_excludes_friendlies_and_orders_most_recent_first():
    results = _results([
        ("2026-06-01", "A", "B", 2, 0, "FIFA World Cup"),   # A win
        ("2026-06-05", "A", "C", 1, 1, "Friendly"),         # excluded
        ("2026-06-10", "D", "A", 3, 1, "FIFA World Cup"),   # A loss
    ])
    form = team_form(results, "A", n=10)

    assert [m["tournament"] for m in form["matches"]] == ["FIFA World Cup", "FIFA World Cup"]
    # Most recent (2026-06-10, a loss) must come first.
    assert form["matches"][0]["date"] == "2026-06-10"
    assert form["matches"][0]["result"] == "L"
    assert form["streak"] == "LW"


def test_team_form_caps_at_n_and_computes_goals_from_either_side():
    rows = [(f"2026-01-{d:02d}", "A", "X", 1, 0, "FIFA World Cup") for d in range(1, 13)]
    results = _results(rows)
    form = team_form(results, "A", n=10)
    assert len(form["matches"]) == 10
    assert all(m["goals_for"] == 1 and m["goals_against"] == 0 for m in form["matches"])


def test_wc_history_counts_appearances_and_record_from_synthetic_data():
    results = _results([
        ("2018-06-01", "A", "B", 2, 1, "FIFA World Cup"),
        ("2018-06-05", "A", "B", 0, 0, "FIFA World Cup"),
        ("2022-06-01", "B", "A", 3, 1, "FIFA World Cup"),
        ("2026-06-01", "A", "B", 5, 0, "FIFA World Cup"),  # in-progress edition, excluded
    ])
    h = wc_history(results, "A")

    assert h["appearances"] == 2  # 2018, 2022 — 2026 excluded as still in progress
    assert h["matches_played"] == 3
    assert h["wins"] == 1
    assert h["draws"] == 1
    assert h["losses"] == 1


def test_wc_history_titles_are_independent_of_passed_in_matches():
    # Titles come from the static WC_CHAMPIONS table, not the results frame —
    # a team with zero rows in `results` still reports its real title count.
    empty = _results([])
    h = wc_history(empty, "Brazil")
    assert h["appearances"] == 0
    assert h["titles"] == sum(1 for c in WC_CHAMPIONS.values() if c == "Brazil")
    assert h["titles"] >= 5  # 1958, 1962, 1970, 1994, 2002


def test_wc_history_unrecognized_team_has_zero_titles():
    empty = _results([])
    h = wc_history(empty, "Curacao")
    assert h == {"appearances": 0, "titles": 0, "matches_played": 0,
                 "wins": 0, "draws": 0, "losses": 0}


def _shootouts(rows):
    """rows: (date, home, away, winner)"""
    df = pd.DataFrame(rows, columns=["date", "home_team", "away_team", "winner"])
    df["date"] = pd.to_datetime(df["date"])
    return df


def test_shootout_record_tally_and_last_n():
    shootouts = _shootouts([
        ("2022-12-01", "A", "B", "A"),
        ("2018-07-01", "C", "A", "C"),
        ("2014-07-01", "A", "D", "A"),
    ])
    rec = shootout_record(shootouts, "A", n=2)

    assert rec["played"] == 3
    assert rec["won"] == 2
    assert rec["lost"] == 1
    assert len(rec["last"]) == 2
    assert rec["last"][0]["date"] == "2022-12-01"  # most recent first
    assert rec["last"][0]["won"] is True


def test_shootout_record_empty_for_team_with_no_shootouts():
    shootouts = _shootouts([("2022-12-01", "A", "B", "A")])
    rec = shootout_record(shootouts, "Z")
    assert rec == {"played": 0, "won": 0, "lost": 0, "last": []}
