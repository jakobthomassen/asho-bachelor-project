from fastapi import APIRouter
from app.services.prompt_trace import get_traces

router = APIRouter()

@router.get("/prompt-trace/{session_id}")
def prompt_trace(session_id: str):
    return {"session_id": session_id, "traces": get_traces(session_id)}
