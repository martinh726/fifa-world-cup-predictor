"""GET /api/status surfaces per-source health via src.livefeed's _feed_status
registry — verify fetchers record failure/success there instead of just
swallowing exceptions silently."""
import pytest

from src import livefeed


@pytest.fixture(autouse=True)
def _clear_feed_status():
    livefeed._feed_status.clear()
    yield
    livefeed._feed_status.clear()


class _RaisingSession:
    def __enter__(self):
        raise RuntimeError("connection reset")

    def __exit__(self, *exc):
        return False


def test_fetch_finished_matches_records_failure(monkeypatch):
    monkeypatch.setattr(livefeed.requests, "Session", lambda: _RaisingSession())

    result = livefeed.fetch_finished_matches("fake-key")

    assert result == []
    status = livefeed.get_feed_status()
    assert status["football_data"]["ok"] is False
    assert "connection reset" in status["football_data"]["error"]


def test_fetch_finished_matches_records_success(monkeypatch):
    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"matches": []}

    class FakeSession:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        headers = type("H", (), {"update": lambda self, *a: None})()

        def get(self, *a, **kw):
            return FakeResponse()

    monkeypatch.setattr(livefeed.requests, "Session", lambda: FakeSession())

    result = livefeed.fetch_finished_matches("fake-key")

    assert result == []
    assert livefeed.get_feed_status()["football_data"]["ok"] is True


def test_get_feed_status_returns_a_copy():
    livefeed._record("football_data", ok=True)
    snapshot = livefeed.get_feed_status()
    snapshot["football_data"]["ok"] = False
    assert livefeed.get_feed_status()["football_data"]["ok"] is True
