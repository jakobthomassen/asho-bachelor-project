from fastapi import APIRouter, HTTPException
from app.services.llm_client import chat_completion

router = APIRouter()

@router.get("/debug/openai")
def debug_openai():
    try:
        reply = chat_completion([
            {"role": "user", "content": "Reply with the word OK only."}
        ])
        return {"openai_status": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
