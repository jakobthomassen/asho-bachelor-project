from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg


def insert_security_rejection(
    conn: psycopg.Connection,
    *,
    conversation_id: Optional[str],
    session_id: Optional[str],
    message_id: Optional[str],
    user_id: Optional[str],
    message_preview: str,
    rejection_type: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO security_rejections (
              conversation_id,
              session_id,
              message_id,
              user_id,
              message_preview,
              rejection_type
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                conversation_id,
                session_id,
                message_id,
                user_id,
                message_preview[:500],
                rejection_type,
            ),
        )
    conn.commit()


def fetch_security_rejections(
    conn: psycopg.Connection,
    *,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              id,
              conversation_id,
              session_id,
              message_id,
              user_id,
              message_preview,
              rejection_type,
              created_at
            FROM security_rejections
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall() or []

    return [
        {
            "id": int(row[0]),
            "conversation_id": row[1],
            "session_id": row[2],
            "message_id": row[3],
            "user_id": row[4],
            "message_preview": row[5],
            "rejection_type": str(row[6]),
            "created_at": row[7].isoformat() if row[7] else None,
        }
        for row in rows
    ]
