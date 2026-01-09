from fastapi import APIRouter, HTTPException, Response
from app.schemas.chat import SimpleChatRequest, SimpleChatResponse
from app.services.llm_client import chat_with_history
from app.services.memory_store import append_message, get_history

router = APIRouter()

@router.options("/chat")
def chat_options():
    return Response(status_code=200)

@router.post("/chat", response_model=SimpleChatResponse)
def chat(payload: SimpleChatRequest):
    try:
        history = get_history(payload.session_id)
        reply = chat_with_history(history, payload.message)

        append_message(payload.session_id, "user", payload.message)
        append_message(payload.session_id, "assistant", reply)

        return {"reply": reply}
    except Exception:
        raise HTTPException(status_code=500, detail="LLM failure")
