from __future__ import annotations

import time
from typing import Optional, Tuple

import psycopg

# In-process TTL cache: key -> (value, fetched_at_monotonic)
_cache: dict[str, Tuple[str, float]] = {}
_CACHE_TTL_SECONDS = 60.0


def fetch_app_config(conn: psycopg.Connection, key: str) -> Optional[str]:
    now = time.monotonic()
    cached = _cache.get(key)
    if cached is not None:
        value, fetched_at = cached
        if now - fetched_at < _CACHE_TTL_SECONDS:
            return value

    with conn.cursor() as cur:
        cur.execute("SELECT value FROM app_config WHERE key = %s", (key,))
        row = cur.fetchone()

    value = str(row[0]) if row else None
    if value is not None:
        _cache[key] = (value, now)
    return value


def upsert_app_config(conn: psycopg.Connection, key: str, value: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO app_config (key, value, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """,
            (key, value),
        )
    _cache.pop(key, None)
