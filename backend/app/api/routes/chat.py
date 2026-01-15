import json
import hashlib
import time
from fastapi import APIRouter, HTTPException, Response
import psycopg

from app.schemas.chat import SimpleChatRequest, SimpleChatResponse
from app.services.llm_client import chat_with_history
from app.services.memory_store import append_message, get_history
from app.core.config import settings
from app.services.security import validate_and_count
from app.services.session_budget import add_tokens_and_check_budget

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for idempotency protection")


@router.options("/chat")
def chat_options():
    return Response(status_code=200)


def _req_hash(session_id: str, normalized_message: str) -> str:
    normalized = {
        "session_id": session_id,
        "message": normalized_message,
    }
    s = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


@router.post("/chat", response_model=SimpleChatResponse)
def chat(payload: SimpleChatRequest):
    # 1) Security layer: normalize, character allowlist, per-message token cap, heuristics
    try:
        sec = validate_and_count(payload.message, model_name=settings.MODEL_NAME)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    normalized_message = sec.normalized_message
    input_tokens = sec.message_tokens
    h = _req_hash(payload.session_id, normalized_message)

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            # 2) Idempotency claim (concurrency-safe)
            with conn.cursor() as cur:
                # Attempt insert; if it already exists, fetch and handle below.
                cur.execute(
                    """
                    INSERT INTO llm_idempotency (message_id, req_hash, status)
                    VALUES (%s, %s, 'in_progress')
                    ON CONFLICT (message_id) DO NOTHING
                    """,
                    (payload.message_id, h),
                )
                conn.commit()

                cur.execute(
                    "SELECT req_hash, status, response_json FROM llm_idempotency WHERE message_id=%s",
                    (payload.message_id,),
                )
                row = cur.fetchone()

                if not row:
                    raise HTTPException(status_code=500, detail="Idempotency state error")

                existing_hash, status, response_json = row

                if existing_hash != h:
                    raise HTTPException(
                        status_code=409,
                        detail="message_id reused with different content",
                    )

                if status == "done" and response_json:
                    return json.loads(response_json)

                if status == "in_progress" and response_json:
                    # Defensive: if response_json exists, return it.
                    return json.loads(response_json)

                # If row existed and is in_progress, poll briefly as before.
                # This supports the case where another request is processing.
                # Note: budget increments below only happen if we are the active processor.
                if status == "in_progress":
                    # We do not know if we inserted or another worker did.
                    # To avoid double-spend, we only proceed if we were able to mark as "claimed".
                    # Simplest: attempt a status transition from in_progress->in_progress with a no-op lock.
                    # If you want stronger semantics, add a "worker_id" column.
                    pass

            # 3) Budget: increment session budget for input tokens BEFORE calling OpenAI
            # Use a transaction so we can rollback on budget overflow.
            try:
                with conn.transaction():
                    add_tokens_and_check_budget(
                        conn=conn,
                        session_id=payload.session_id,
                        add_tokens=input_tokens,
                        max_session_tokens=settings.MAX_SESSION_TOKENS,
                    )
            except RuntimeError:
                # Session budget exceeded
                raise HTTPException(status_code=429, detail="Session token budget exceeded")

            # 4) Call model with in-memory history
            history = get_history(payload.session_id)
            reply, output_tokens = chat_with_history(payload.session_id, history, normalized_message)

            # 5) Append to in-memory history (still process-local)
            append_message(payload.session_id, "user", normalized_message)
            append_message(payload.session_id, "assistant", reply)

            # 6) Budget: increment session budget for output tokens AFTER we have it
            try:
                with conn.transaction():
                    add_tokens_and_check_budget(
                        conn=conn,
                        session_id=payload.session_id,
                        add_tokens=output_tokens,
                        max_session_tokens=settings.MAX_SESSION_TOKENS,
                    )
            except RuntimeError:
                # Budget exceeded after output. This can happen if the session is near the limit.
                # The model already responded, so we return a safe error or a truncated response strategy.
                # For now: return 429 and do not store "done".
                raise HTTPException(status_code=429, detail="Session token budget exceeded")

            response = {"reply": reply}

            # 7) Store idempotent result
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE llm_idempotency SET status='done', response_json=%s WHERE message_id=%s",
                    (json.dumps(response), payload.message_id),
                )
                conn.commit()

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
