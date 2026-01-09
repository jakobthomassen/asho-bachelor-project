import json
import hashlib
import time

import psycopg
from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_client import chat_completion
from app.core.config import settings

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set (needed for message_id idempotency)")

def _req_hash(payload: ChatRequest) -> str:
    normalized = {"messages": [m.model_dump() for m in payload.messages]}
    s = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest):
    h = _req_hash(payload)

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT req_hash, status, response_json FROM llm_idempotency WHERE message_id=%s",
                    (payload.message_id,),
                )
                row = cur.fetchone()

                if row:
                    existing_hash, status, response_json = row

                    if existing_hash != h:
                        raise HTTPException(
                            status_code=409,
                            detail="message_id reused with different request content",
                        )

                    if status == "done" and response_json is not None:
                        return response_json

                    # Another request is processing this message_id, wait briefly then re-check
                    for _ in range(12):
                        time.sleep(0.2)
                        cur.execute(
                            "SELECT status, response_json FROM llm_idempotency WHERE message_id=%s",
                            (payload.message_id,),
                        )
                        status2, resp2 = cur.fetchone()
                        if status2 == "done" and resp2 is not None:
                            return resp2

                    raise HTTPException(
                        status_code=409,
                        detail="Request is already being processed; retry shortly with same message_id",
                    )

                # Claim message_id so only one request calls the LLM
                cur.execute(
                    """
                    INSERT INTO llm_idempotency (message_id, req_hash, status)
                    VALUES (%s, %s, 'in_progress')
                    """,
                    (payload.message_id, h),
                )
                conn.commit()

            # Call the LLM once
            reply = chat_completion([m.model_dump() for m in payload.messages])
            response = {"reply": reply}

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE llm_idempotency
                    SET status='done', response_json=%s
                    WHERE message_id=%s
                    """,
                    (json.dumps(response), payload.message_id),
                )
                conn.commit()

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
