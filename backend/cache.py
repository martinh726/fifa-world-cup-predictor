"""Simple TTL in-memory cache for API responses."""
from __future__ import annotations

import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._value: Any = None
        self._expires_at: float = 0.0

    def get(self) -> Any:
        if time.time() < self._expires_at:
            return self._value
        return None

    def set(self, value: Any) -> None:
        self._value = value
        self._expires_at = time.time() + self._ttl

    def invalidate(self) -> None:
        self._expires_at = 0.0

    def get_or_stale(self) -> Any:
        """Return the last cached value even if the TTL has expired."""
        return self._value


class KeyedTTLCache:
    """Same as TTLCache but holds one entry per key (e.g. per team name)."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._store: dict[Any, tuple[Any, float]] = {}

    def get(self, key: Any) -> Any:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() < expires_at:
            return value
        return None

    def set(self, key: Any, value: Any) -> None:
        self._store[key] = (value, time.time() + self._ttl)

    def invalidate(self) -> None:
        self._store.clear()


live_cache = TTLCache(30)
results_cache = TTLCache(300)
schedule_cache = TTLCache(600)
calibration_cache = TTLCache(300)
final_four_cache = TTLCache(300)
team_cache = KeyedTTLCache(300)
