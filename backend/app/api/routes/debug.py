from fastapi import APIRouter, HTTPException
from uuid import uuid4
from app.services.memory_store import append_message
from app.services.llm_client import chat_with_history
import os

router = APIRouter()

@router.get("/debug/openai")
def debug_openai():
    if os.getenv("ENABLE_DEBUG_ENDPOINTS", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")

    try:
        session_id = str(uuid4())
        reply, _ = chat_with_history(session_id, [], "Reply with the word OK only.")
        append_message(session_id, "user", "Reply with the word OK only.")
        append_message(session_id, "assistant", reply)
        return {"openai_status": reply}
    except Exception:
        raise HTTPException(status_code=500, detail="OpenAI health check failed")
