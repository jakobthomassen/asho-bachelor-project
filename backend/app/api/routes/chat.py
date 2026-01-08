from fastapi import APIRouter, HTTPException
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_client import chat_completion

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest):
    try:
        reply = chat_completion([m.model_dump() for m in payload.messages])
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
