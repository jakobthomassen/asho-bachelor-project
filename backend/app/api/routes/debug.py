from fastapi import APIRouter, HTTPException
from uuid import uuid4
from app.services.llm_client import chat_with_history
import os

router = APIRouter()


@router.get("/debug/openai")
def debug_openai():
    if os.getenv("ENABLE_DEBUG_ENDPOINTS", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")

    try:
        # Use a throwaway session_id
        session_id = str(uuid4())

        # Call OpenAI directly without any persistence
        reply, _ = chat_with_history(
            session_id,
            [],
            "Reply with the word OK only."
        )

        # Do NOT store anything
        return {"openai_status": reply}

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="OpenAI health check failed"
        )
