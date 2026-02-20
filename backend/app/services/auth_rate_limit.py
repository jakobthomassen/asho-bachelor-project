from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from app.core.config import settings


@dataclass
class _Bucket:
    tokens: float
    last_refill: float


class TokenBucketLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def consume(self, key: str, capacity: float, refill_per_sec: float, tokens: float = 1.0) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(tokens=capacity, last_refill=now)
                self._buckets[key] = bucket

            elapsed = max(0.0, now - bucket.last_refill)
            bucket.tokens = min(capacity, bucket.tokens + (elapsed * refill_per_sec))
            bucket.last_refill = now

            if bucket.tokens < tokens:
                return False

            bucket.tokens -= tokens
            return True


auth_rate_limiter = TokenBucketLimiter()


def check_auth_rate_limit(flow: str, client_ip: str, identifier: str | None = None) -> bool:
    ip_key = f"{flow}:ip:{client_ip}"
    ip_ok = auth_rate_limiter.consume(
        ip_key,
        settings.AUTH_RATE_IP_CAPACITY,
        settings.AUTH_RATE_IP_REFILL_PER_SEC,
    )
    if not ip_ok:
        return False

    if identifier:
        ident_key = f"{flow}:ident:{identifier}"
        ident_ok = auth_rate_limiter.consume(
            ident_key,
            settings.AUTH_RATE_IDENTIFIER_CAPACITY,
            settings.AUTH_RATE_IDENTIFIER_REFILL_PER_SEC,
        )
        if not ident_ok:
            return False

    return True
