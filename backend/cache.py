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


live_cache = TTLCache(30)
results_cache = TTLCache(300)
schedule_cache = TTLCache(600)
calibration_cache = TTLCache(300)
