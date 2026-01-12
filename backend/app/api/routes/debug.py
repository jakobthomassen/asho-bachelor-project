from fastapi import APIRouter, HTTPException
from uuid import uuid4
from app.services.memory_store import append_message, get_history
from app.services.llm_client import chat_with_history

router = APIRouter()

@router.get("/debug/openai")
def debug_openai():
    try:
        session_id = str(uuid4())

        reply = chat_with_history(session_id, [], "Reply with the word OK only.")

        append_message(session_id, "user", "Reply with the word OK only.")
        append_message(session_id, "assistant", reply)

        return {"openai_status": reply}
    except Exception:
        raise HTTPException(status_code=500, detail="OpenAI health check failed")
