from __future__ import annotations

from dataclasses import dataclass
import psycopg


@dataclass(frozen=True)
class SessionBudgetResult:
    tokens_used_after: int


def add_tokens_and_check_budget(
    conn: psycopg.Connection,
    session_id: str,
    add_tokens: int,
    max_session_tokens: int,
) -> SessionBudgetResult:
    """
    Atomically increments tokens_used for a session and enforces a maximum.
    Must be called inside a transaction.
    """
    if add_tokens <= 0:
        # No-op
        cur = conn.cursor()
        cur.execute(
            "SELECT tokens_used FROM session_token_usage WHERE session_id=%s",
            (session_id,),
        )
        row = cur.fetchone()
        tokens_used = int(row[0]) if row else 0
        return SessionBudgetResult(tokens_used_after=tokens_used)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO session_token_usage (session_id, tokens_used)
            VALUES (%s, %s)
            ON CONFLICT (session_id)
            DO UPDATE SET
              tokens_used = session_token_usage.tokens_used + EXCLUDED.tokens_used,
              updated_at = NOW()
            RETURNING tokens_used
            """,
            (session_id, int(add_tokens)),
        )
        tokens_used_after = int(cur.fetchone()[0])

    if tokens_used_after > max_session_tokens:
        # Do not roll back automatically here; caller decides.
        # Caller should rollback and return 429.
        raise RuntimeError("Session token budget exceeded.")

    return SessionBudgetResult(tokens_used_after=tokens_used_after)
