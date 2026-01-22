import json
import hashlib
from fastapi import APIRouter, HTTPException, Response, Header
import psycopg
import time

from app.schemas.chat import SimpleChatRequest, SimpleChatResponse
from app.services.llm_client import chat_with_history
from app.core.config import settings
from app.services.security import validate_and_count
from app.services.session_budget import add_tokens_and_check_budget
from app.services.google_auth import ensure_auth_tables, get_user_id_for_session, parse_bearer_token

CHAT_HISTORY = 12

# NEW: DB-backed chat history
from app.services.chat_history_store import (
    insert_message,
    fetch_recent_history,
)

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for idempotency protection")


@router.options("/chat")
def chat_options():
    return Response(status_code=200)


def _req_hash(chat_id: str, normalized_message: str) -> str:
    normalized = {
        "chat_id": chat_id,
        "message": normalized_message,
    }
    s = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


@router.post("/chat", response_model=SimpleChatResponse)
def chat(payload: SimpleChatRequest, authorization: str | None = Header(default=None)):
    # 1) Security: normalize + per-message token cap
    try:
        sec = validate_and_count(payload.message, model_name=settings.MODEL_NAME)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    normalized_message = sec.normalized_message
    input_tokens = sec.message_tokens
    req_hash = _req_hash(payload.chat_id, normalized_message)

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            ensure_auth_tables(conn)
            session_token = parse_bearer_token(authorization)
            if session_token:
                user_id = get_user_id_for_session(conn, session_token)
                if not user_id:
                    raise HTTPException(status_code=401, detail="Invalid session token")

            # 2) Idempotency claim (chat_id + message_id)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_idempotency (chat_id, message_id, req_hash, status)
                    VALUES (%s, %s, %s, 'in_progress')
                    ON CONFLICT (chat_id, message_id) DO NOTHING
                    RETURNING 1
                    """,
                    (payload.chat_id, payload.message_id, req_hash),
                )
                inserted = cur.fetchone() is not None
                conn.commit()

                cur.execute(
                    """
                    SELECT req_hash, status, response_json
                    FROM llm_idempotency
                    WHERE chat_id=%s AND message_id=%s
                    """,
                    (payload.chat_id, payload.message_id),
                )
                row = cur.fetchone()

                if not row:
                    raise HTTPException(status_code=500, detail="Idempotency state error")

                existing_hash, status, response_json = row

                if existing_hash != req_hash:
                    raise HTTPException(
                        status_code=409,
                        detail="message_id reused with different content",
                    )

                if status == "done" and response_json:
                    return json.loads(response_json)

                # If someone else is processing this message_id, wait briefly and return cached result if it finishes
                if not inserted:
                    for _ in range(12):
                        time.sleep(0.2)
                        cur.execute(
                            """
                            SELECT status, response_json
                            FROM llm_idempotency
                            WHERE chat_id=%s AND message_id=%s
                            """,
                            (payload.chat_id, payload.message_id),
                        )
                        status2, response_json2 = cur.fetchone()
                        if status2 == "done" and response_json2:
                            return json.loads(response_json2)

                    raise HTTPException(
                        status_code=409,
                        detail="Request is already being processed; retry with same message_id",
                    )

            # 3) Budget: input tokens
            try:
                with conn.transaction():
                    add_tokens_and_check_budget(
                        conn=conn,
                        session_id=payload.session_id,
                        add_tokens=input_tokens,
                        max_session_tokens=settings.MAX_SESSION_TOKENS,
                    )
            except RuntimeError:
                raise HTTPException(status_code=429, detail="Session token budget exceeded")

            # 4) Persist user message (durable history)
            with conn.transaction():
                insert_message(
                    conn,
                    chat_id=payload.chat_id,
                    session_id=payload.session_id,
                    role="user",
                    content=normalized_message,
                )

            # 5) Fetch recent history for this chat
            history = fetch_recent_history(
                conn,
                chat_id=payload.chat_id,
                limit_messages=CHAT_HISTORY,
            )

            # 6) Call LLM
            reply, output_tokens = chat_with_history(
                payload.session_id,
                history,
                normalized_message,
            )

            # 7) Persist assistant message
            with conn.transaction():
                insert_message(
                    conn,
                    chat_id=payload.chat_id,
                    session_id=payload.session_id,
                    role="assistant",
                    content=reply,
                )

            # 8) Budget: output tokens
            try:
                with conn.transaction():
                    add_tokens_and_check_budget(
                        conn=conn,
                        session_id=payload.session_id,
                        add_tokens=output_tokens,
                        max_session_tokens=settings.MAX_SESSION_TOKENS,
                    )
            except RuntimeError:
                raise HTTPException(status_code=429, detail="Session token budget exceeded")

            response = {"reply": reply}

            # 9) Store idempotent result
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE llm_idempotency
                    SET status='done', response_json=%s
                    WHERE chat_id=%s AND message_id=%s
                    """,
                    (json.dumps(response), payload.chat_id, payload.message_id),
                )
                conn.commit()

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
