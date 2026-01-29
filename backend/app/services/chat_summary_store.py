from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import psycopg


@dataclass(frozen=True)
class ChatSummaryRow:
    summary_text: str
    last_message_id: int


def get_summary(conn: psycopg.Connection, *, conversation_id: str) -> Optional[ChatSummaryRow]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT summary_text, last_message_id
            FROM chat_summaries
            WHERE conversation_id = %s
            """,
            (conversation_id,),
        )
        row = cur.fetchone()

    if not row:
        return None

    summary_text, last_message_id = row
    return ChatSummaryRow(
        summary_text=str(summary_text),
        last_message_id=int(last_message_id),
    )


def upsert_summary(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    summary_text: str,
    last_message_id: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO chat_summaries (conversation_id, summary_text, last_message_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (conversation_id)
            DO UPDATE SET
              summary_text = EXCLUDED.summary_text,
              last_message_id = EXCLUDED.last_message_id,
              updated_at = NOW()
            """,
            (conversation_id, summary_text, int(last_message_id)),
        )
