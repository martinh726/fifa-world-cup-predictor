"""record_snapshot/load_history: one entry per calendar date (latest wins),
top-N trimming, and round-trip through disk."""
from backend import odds_history


def _summary(pairs):
    return [{"team": t, "P(Champion)": p} for t, p in pairs]


def test_record_and_load_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(odds_history, "HISTORY_PATH", tmp_path / "odds_history.json")

    odds_history.record_snapshot(
        _summary([("Brazil", 0.22), ("France", 0.18)]), locked_count=10, n_sims=5000,
    )
    history = odds_history.load_history()

    assert len(history) == 1
    assert history[0]["odds"] == {"Brazil": 0.22, "France": 0.18}
    assert history[0]["locked_count"] == 10
    assert history[0]["n_sims"] == 5000
    assert "date" in history[0] and "ts" in history[0]


def test_same_day_snapshot_replaces_not_appends(tmp_path, monkeypatch):
    monkeypatch.setattr(odds_history, "HISTORY_PATH", tmp_path / "odds_history.json")

    odds_history.record_snapshot(_summary([("Brazil", 0.20)]), locked_count=5, n_sims=1000)
    odds_history.record_snapshot(_summary([("Brazil", 0.25)]), locked_count=8, n_sims=1000)

    history = odds_history.load_history()
    assert len(history) == 1
    assert history[0]["odds"]["Brazil"] == 0.25
    assert history[0]["locked_count"] == 8


def test_top_n_trims_the_field(tmp_path, monkeypatch):
    monkeypatch.setattr(odds_history, "HISTORY_PATH", tmp_path / "odds_history.json")

    teams = [(f"Team{i}", 1.0 - i * 0.01) for i in range(20)]
    odds_history.record_snapshot(_summary(teams), locked_count=0, n_sims=100, top_n=5)

    history = odds_history.load_history()
    assert len(history[0]["odds"]) == 5
    assert set(history[0]["odds"]) == {"Team0", "Team1", "Team2", "Team3", "Team4"}


def test_load_history_missing_file_returns_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(odds_history, "HISTORY_PATH", tmp_path / "does_not_exist.json")
    assert odds_history.load_history() == []
