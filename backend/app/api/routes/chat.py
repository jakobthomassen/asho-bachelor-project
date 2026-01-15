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


def _req_hash(payload: SimpleChatRequest) -> str:
    normalized = {
        "session_id": payload.session_id,
        "message": payload.message
    }
    s = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


@router.post("/chat", response_model=SimpleChatResponse)
def chat(payload: SimpleChatRequest):
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
                            detail="message_id reused with different content",
                        )

                    if status == "done" and response_json:
                        return json.loads(response_json)

                    for _ in range(10):
                        time.sleep(0.2)
                        cur.execute(
                            "SELECT status, response_json FROM llm_idempotency WHERE message_id=%s",
                            (payload.message_id,),
                        )
                        status2, resp2 = cur.fetchone()
                        if status2 == "done" and resp2:
                            return json.loads(resp2)

                    raise HTTPException(status_code=409, detail="Message is still processing")

                cur.execute(
                    "INSERT INTO llm_idempotency (message_id, req_hash, status) VALUES (%s,%s,'in_progress')",
                    (payload.message_id, h),
                )
                conn.commit()

            history = get_history(payload.session_id)
            reply = chat_with_history(payload.session_id, history, payload.message)

            append_message(payload.session_id, "user", payload.message)
            append_message(payload.session_id, "assistant", reply)

            response = {"reply": reply}

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
