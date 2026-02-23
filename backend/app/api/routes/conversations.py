from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Query, Response
import psycopg

from app.core.config import settings
from app.schemas.conversations import (
    ConversationCreateRequest,
    ConversationListResponse,
    ConversationMessagesResponse,
    ConversationSummary,
    ConversationUpdateRequest,
    ConversationMessage,
)
from app.services.google_auth import get_user_id_for_session, parse_bearer_token

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for conversations")


def _to_ms(value: datetime | None) -> int:
    if not isinstance(value, datetime):
        return 0
    return int(value.timestamp() * 1000)


def _require_user(conn: psycopg.Connection, authorization: str | None) -> str:
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=401, detail="Missing session token")
    user_id = get_user_id_for_session(conn, session_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return user_id


def _table_exists(conn: psycopg.Connection, table_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass(%s)", (table_name,))
        row = cur.fetchone()
    return bool(row and row[0])


@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(authorization: str | None = Header(default=None)):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            user_id = _require_user(conn, authorization)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, created_at, updated_at
                    FROM conversations
                    WHERE user_id = %s
                    ORDER BY updated_at DESC
                    """,
                    (user_id,),
                )
                rows = cur.fetchall() or []

            conversations: list[ConversationSummary] = []
            for conv_id, title, created_at, updated_at in rows:
                conversations.append(
                    ConversationSummary(
                        id=str(conv_id),
                        title=str(title),
                        created_at=_to_ms(created_at),
                        updated_at=_to_ms(updated_at),
                    )
                )

            return {"conversations": conversations}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/conversations", response_model=ConversationSummary)
def create_conversation(
    payload: ConversationCreateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            user_id = _require_user(conn, authorization)
            conv_id = str(uuid4())
            title = payload.title.strip() if payload.title else "Ny samtale"

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO conversations (id, user_id, title)
                    VALUES (%s, %s, %s)
                    RETURNING id, title, created_at, updated_at
                    """,
                    (conv_id, user_id, title),
                )
                row = cur.fetchone()
                conn.commit()

            if not row:
                raise HTTPException(status_code=500, detail="Failed to create conversation")

            conv_id, title, created_at, updated_at = row
            return ConversationSummary(
                id=str(conv_id),
                title=str(title),
                created_at=_to_ms(created_at),
                updated_at=_to_ms(updated_at),
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            user_id = _require_user(conn, authorization)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET title = %s, updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    RETURNING id, title, created_at, updated_at
                    """,
                    (payload.title.strip(), conversation_id, user_id),
                )
                row = cur.fetchone()
                conn.commit()

            if not row:
                raise HTTPException(status_code=404, detail="Conversation not found")

            conv_id, title, created_at, updated_at = row
            return ConversationSummary(
                id=str(conv_id),
                title=str(title),
                created_at=_to_ms(created_at),
                updated_at=_to_ms(updated_at),
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            user_id = _require_user(conn, authorization)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM conversations
                    WHERE id = %s AND user_id = %s
                    """,
                    (conversation_id, user_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Conversation not found")

            tables_to_delete = [
                ("topic_routing_events", "DELETE FROM topic_routing_events WHERE conversation_id = %s"),
                ("conversation_topic_state", "DELETE FROM conversation_topic_state WHERE conversation_id = %s"),
                ("chat_summaries", "DELETE FROM chat_summaries WHERE conversation_id = %s"),
                ("llm_idempotency", "DELETE FROM llm_idempotency WHERE conversation_id = %s"),
                ("chat_messages", "DELETE FROM chat_messages WHERE conversation_id = %s"),
            ]

            with conn.transaction():
                for table_name, stmt in tables_to_delete:
                    if _table_exists(conn, table_name):
                        with conn.cursor() as cur:
                            cur.execute(stmt, (conversation_id,))

                with conn.cursor() as cur:
                    cur.execute(
                        """
                        DELETE FROM conversations
                        WHERE id = %s AND user_id = %s
                        """,
                        (conversation_id, user_id),
                    )
                    deleted = cur.rowcount

            if not deleted:
                raise HTTPException(status_code=404, detail="Conversation not found")

            return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
)
def list_messages(
    conversation_id: str,
    authorization: str | None = Header(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            user_id = _require_user(conn, authorization)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM conversations
                    WHERE id = %s AND user_id = %s
                    """,
                    (conversation_id, user_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Conversation not found")

                cur.execute(
                    """
                    SELECT id, role, content, created_at
                    FROM chat_messages
                    WHERE conversation_id = %s
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (conversation_id, int(limit)),
                )
                rows = cur.fetchall() or []

            messages: list[ConversationMessage] = []
            for msg_id, role, content, created_at in rows:
                messages.append(
                    ConversationMessage(
                        id=str(msg_id),
                        role=str(role),
                        text=str(content),
                        created_at=_to_ms(created_at),
                    )
                )

            return {"messages": messages}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
