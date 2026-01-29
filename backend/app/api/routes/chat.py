import json
import hashlib
from fastapi import APIRouter, HTTPException, Response, Header
import psycopg
import time

from app.schemas.chat import SimpleChatRequest, SimpleChatResponse
from app.services.llm_client import chat_with_history, summarize_history, SYSTEM_PROMPT
from app.core.config import settings
from app.services.security import validate_and_count
from app.services.session_budget import add_tokens_and_check_budget
from app.services.google_auth import ensure_auth_tables, get_user_id_for_session, parse_bearer_token

from app.services.token_count import count_tokens

# NEW: DB-backed chat history
from app.services.chat_history_store import (
    insert_message,
    fetch_messages_after,
)
from app.services.chat_summary_store import get_summary, upsert_summary

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for idempotency protection")


@router.options("/chat")
def chat_options():
    return Response(status_code=200)


def _req_hash(conversation_id: str, normalized_message: str) -> str:
    normalized = {
        "conversation_id": conversation_id,
        "message": normalized_message,
    }
    s = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _estimate_prompt_tokens(summary_text: str | None, history) -> int:
    total = count_tokens(SYSTEM_PROMPT, model=settings.MODEL_NAME)
    if summary_text:
        total += count_tokens(summary_text, model=settings.MODEL_NAME)
    for msg in history:
        total += count_tokens(str(msg.get("content") or ""), model=settings.MODEL_NAME)
    return total


@router.post("/chat", response_model=SimpleChatResponse)
def chat(payload: SimpleChatRequest, authorization: str | None = Header(default=None)):
    # 1) Security: normalize + per-message token cap
    try:
        sec = validate_and_count(payload.message, model_name=settings.MODEL_NAME)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    normalized_message = sec.normalized_message
    input_tokens = sec.message_tokens
    req_hash = _req_hash(payload.conversation_id, normalized_message)

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            ensure_auth_tables(conn)
            session_token = parse_bearer_token(authorization)
            if not session_token:
                raise HTTPException(status_code=401, detail="Missing session token")
            user_id = get_user_id_for_session(conn, session_token)
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid session token")

            # 2) Ensure conversation exists and is owned by user
            title_seed = normalized_message[:28] or "Samtale"
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT user_id, title
                    FROM conversations
                    WHERE id = %s
                    """,
                    (payload.conversation_id,),
                )
                row = cur.fetchone()

                if row is None:
                    cur.execute(
                        """
                        INSERT INTO conversations (id, user_id, title)
                        VALUES (%s, %s, %s)
                        """,
                        (payload.conversation_id, user_id, title_seed),
                    )
                else:
                    owner_id, current_title = row
                    if str(owner_id) != str(user_id):
                        raise HTTPException(status_code=403, detail="Conversation not owned by user")

                    if current_title in {"Samtale", "Ny samtale"}:
                        cur.execute(
                            """
                            UPDATE conversations
                            SET title = %s, updated_at = NOW()
                            WHERE id = %s AND user_id = %s
                            """,
                            (title_seed, payload.conversation_id, user_id),
                        )
                conn.commit()

            # 3) Idempotency claim (conversation_id + message_id)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_idempotency (conversation_id, message_id, req_hash, status)
                    VALUES (%s, %s, %s, 'in_progress')
                    ON CONFLICT (conversation_id, message_id) DO NOTHING
                    RETURNING 1
                    """,
                    (payload.conversation_id, payload.message_id, req_hash),
                )
                inserted = cur.fetchone() is not None
                conn.commit()

                cur.execute(
                    """
                    SELECT req_hash, status, response_json
                    FROM llm_idempotency
                    WHERE conversation_id=%s AND message_id=%s
                    """,
                    (payload.conversation_id, payload.message_id),
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
                            WHERE conversation_id=%s AND message_id=%s
                            """,
                            (payload.conversation_id, payload.message_id),
                        )
                        status2, response_json2 = cur.fetchone()
                        if status2 == "done" and response_json2:
                            return json.loads(response_json2)

                    raise HTTPException(
                        status_code=409,
                        detail="Request is already being processed; retry with same message_id",
                    )

            # 4) Budget: input tokens
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

            # 5) Persist user message (durable history)
            with conn.transaction():
                insert_message(
                    conn,
                    conversation_id=payload.conversation_id,
                    session_id=payload.session_id,
                    role="user",
                    content=normalized_message,
                )

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    """,
                    (payload.conversation_id, user_id),
                )
                conn.commit()

            # 6) Rolling summary + bounded history window
            summary_text = None
            summary_last_id = 0
            try:
                summary_row = get_summary(conn, conversation_id=payload.conversation_id)
                if summary_row:
                    summary_text = summary_row.summary_text
                    summary_last_id = summary_row.last_message_id
            except Exception:
                summary_text = None
                summary_last_id = 0

            summary_message = None
            if summary_text:
                summary_message = "Summary so far:\n" + summary_text

            recent_rows = fetch_messages_after(
                conn,
                conversation_id=payload.conversation_id,
                after_message_id=summary_last_id,
                limit_messages=settings.MAX_HISTORY_MESSAGES,
                newest_first=True,
            )
            recent_rows.reverse()
            history = [{"role": row.role, "content": row.content} for row in recent_rows]

            try:
                est_tokens = _estimate_prompt_tokens(summary_message, history)
                if est_tokens > settings.MAX_HISTORY_TOKENS:
                    candidate_rows = fetch_messages_after(
                        conn,
                        conversation_id=payload.conversation_id,
                        after_message_id=summary_last_id,
                        limit_messages=settings.SUMMARY_WINDOW_MESSAGES,
                        newest_first=False,
                    )
                    if len(candidate_rows) > settings.SUMMARY_KEEP_LAST_MESSAGES:
                        to_summarize = candidate_rows[:-settings.SUMMARY_KEEP_LAST_MESSAGES]
                        summary_input = [
                            {"role": row.role, "content": row.content} for row in to_summarize
                        ]
                        new_summary, _ = summarize_history(
                            existing_summary=summary_text,
                            messages=summary_input,
                        )
                        if new_summary:
                            with conn.transaction():
                                upsert_summary(
                                    conn,
                                    conversation_id=payload.conversation_id,
                                    summary_text=new_summary,
                                    last_message_id=to_summarize[-1].id,
                                )
                            summary_text = new_summary
                            summary_last_id = to_summarize[-1].id
                            summary_message = "Summary so far:\n" + summary_text
                            recent_rows = fetch_messages_after(
                                conn,
                                conversation_id=payload.conversation_id,
                                after_message_id=summary_last_id,
                                limit_messages=settings.MAX_HISTORY_MESSAGES,
                                newest_first=True,
                            )
                            recent_rows.reverse()
                            history = [
                                {"role": row.role, "content": row.content} for row in recent_rows
                            ]
            except Exception:
                pass

            if summary_message:
                history = [{"role": "system", "content": summary_message}] + history

            # 7) Call LLM
            reply, output_tokens = chat_with_history(
                payload.session_id,
                history,
                normalized_message,
            )

            # 8) Persist assistant message
            with conn.transaction():
                insert_message(
                    conn,
                    conversation_id=payload.conversation_id,
                    session_id=payload.session_id,
                    role="assistant",
                    content=reply,
                )

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    """,
                    (payload.conversation_id, user_id),
                )
                conn.commit()

            # 9) Budget: output tokens
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

            # 10) Store idempotent result
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE llm_idempotency
                    SET status='done', response_json=%s
                    WHERE conversation_id=%s AND message_id=%s
                    """,
                    (json.dumps(response), payload.conversation_id, payload.message_id),
                )
                conn.commit()

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
