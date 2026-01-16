import json
import hashlib
import time
from fastapi import APIRouter, HTTPException, Response
import psycopg

from app.schemas.chat import SimpleChatRequest, SimpleChatResponse
from app.services.llm_client import chat_with_history
from app.services.memory_store import append_message, get_history
from app.core.config import settings

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
def chat_endpoint(payload: SimpleChatRequest):
    if not settings.DATABASE_URL: 
        raise HTTPException(status_code=500, detail="DATABASE_URL is not set")
    normalized_message = payload.message.strip()
    req_hash = _req_hash(payload.chat_id, normalized_message)
    
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.llm_idempotency (chat_id, message_id, req_hash, status)
                    VALUES (%s, %s, %s, 'in_progress')
                    ON CONFLICT (chat_id, message_id) DO NOTHING
                    RETURNING 1
                    """,
                    (payload.chat_id, payload.message_id, req_hash),
                )
                inserted = cur.fetchone() is not None
                conn.commit()

                # Read current state (whether we inserted or not)
                cur.execute(
                    """
                    SELECT req_hash, status, response_json
                    FROM public.llm_idempotency
                    WHERE chat_id=%s AND message_id=%s
                    """,
                    (payload.chat_id, payload.message_id),
                )
                row = cur.fetchone()

                if not row:
                    raise HTTPException(status_code=500, detail="Idempotency state missing")
                existing_hash, status, response_json = row

                if existing_hash != req_hash:
                        raise HTTPException(
                            status_code=409,
                            detail="message_id reused with different content",
                        )

                if status == "done" and response_json:
                    if isinstance(response_json, dict):
                        return json.loads(response_json)
                    return json.loads(response_json)
                
                if not inserted:
                    for _ in range(12):
                        time.sleep(0.2)
                        cur.execute(
                              """
                            SELECT status, response_json
                            FROM public.llm_idempotency
                            WHERE chat_id=%s AND message_id=%s
                            """,
                            (payload.chat_id, payload.message_id),
                        )
                        status2, resp2 = cur.fetchone()
                        if status2 == "done" and resp2:
                             if isinstance(r2, dict):
                                return json.loads(resp2)

                    raise HTTPException(status_code=409, detail="Message is still processing")
                
                assistant_text, _tokens = chat_with_history(
                session_id=payload.session_id,
                history=[],
                user_message=normalized_message,
                )
                response = {"reply": assistant_text}

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.llm_idempotency
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

   
