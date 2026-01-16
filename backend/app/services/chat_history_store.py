from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import psycopg


@dataclass(frozen=True)
class ChatMessageRow:
    role: str
    content: str


def insert_message(
    conn: psycopg.Connection,
    *,
    chat_id: str,
    session_id: Optional[str],
    role: str,
    content: str,
) -> None:
    """
    Inserts a single chat message row. Intended to be called inside a transaction.

    Args:
      chat_id: Durable conversation id (primary retrieval key).
      session_id: Ephemeral runtime/session id (optional, for debugging).
      role: 'user' | 'assistant' | 'system'
      content: message content
    """
    if role not in {"user", "assistant", "system"}:
        raise ValueError("Invalid role; must be one of: user, assistant, system")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO chat_messages (chat_id, session_id, role, content)
            VALUES (%s, %s, %s, %s)
            """,
            (chat_id, session_id, role, content),
        )


def fetch_recent_history(
    conn: psycopg.Connection,
    *,
    chat_id: str,
    limit_messages: int = 6,
) -> List[Dict[str, Any]]:
    """
    Fetches the most recent messages for a chat_id, oldest-to-newest, formatted
    for OpenAI chat.completions messages.

    Returns:
      [
        {"role": "...", "content": "..."},
        ...
      ]
    """
    if limit_messages <= 0:
        return []

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT role, content
            FROM chat_messages
            WHERE chat_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (chat_id, int(limit_messages)),
        )
        rows = cur.fetchall() or []

    # rows are newest-first; reverse to oldest-first for prompt assembly
    rows.reverse()

    history: List[Dict[str, Any]] = []
    for role, content in rows:
        history.append({"role": str(role), "content": str(content)})
    return history
