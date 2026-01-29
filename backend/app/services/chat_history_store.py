from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import psycopg


@dataclass(frozen=True)
class ChatMessageRow:
    role: str
    content: str


@dataclass(frozen=True)
class ChatMessageWithId:
    id: int
    role: str
    content: str


def insert_message(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    session_id: Optional[str],
    role: str,
    content: str,
) -> None:
    """
    Inserts a single chat message row. Intended to be called inside a transaction.

    Args:
      conversation_id: Durable conversation id (primary retrieval key).
      session_id: Ephemeral runtime/session id (optional, for debugging).
      role: 'user' | 'assistant' | 'system'
      content: message content
    """
    if role not in {"user", "assistant", "system"}:
        raise ValueError("Invalid role; must be one of: user, assistant, system")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO chat_messages (conversation_id, session_id, role, content)
            VALUES (%s, %s, %s, %s)
            """,
            (conversation_id, session_id, role, content),
        )


def fetch_recent_history(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    limit_messages: int = 6,
) -> List[Dict[str, Any]]:
    """
    Fetches the most recent messages for a conversation_id, oldest-to-newest, formatted
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
            WHERE conversation_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (conversation_id, int(limit_messages)),
        )
        rows = cur.fetchall() or []

    # rows are newest-first; reverse to oldest-first for prompt assembly
    rows.reverse()

    history: List[Dict[str, Any]] = []
    for role, content in rows:
        history.append({"role": str(role), "content": str(content)})
    return history


def fetch_messages_after(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    after_message_id: int,
    limit_messages: int,
    newest_first: bool = False,
) -> List[ChatMessageWithId]:
    """
    Fetch messages after a given message id.

    Args:
      after_message_id: messages with id > after_message_id are returned.
      newest_first: when True, returns newest-to-oldest (DESC).
    """
    if limit_messages <= 0:
        return []

    order = "DESC" if newest_first else "ASC"

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, role, content
            FROM chat_messages
            WHERE conversation_id = %s AND id > %s
            ORDER BY id {order}
            LIMIT %s
            """,
            (conversation_id, int(after_message_id), int(limit_messages)),
        )
        rows = cur.fetchall() or []

    messages: List[ChatMessageWithId] = []
    for msg_id, role, content in rows:
        messages.append(
            ChatMessageWithId(
                id=int(msg_id),
                role=str(role),
                content=str(content),
            )
        )
    return messages
