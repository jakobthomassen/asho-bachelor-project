from fastapi import APIRouter, Header, HTTPException
import psycopg

from app.core.config import settings
from app.services.google_auth import get_session_principal, parse_bearer_token
from app.services.prompt_trace import get_traces

router = APIRouter()


@router.get("/prompt-trace/{session_id}")
def prompt_trace(session_id: str, authorization: str | None = Header(default=None)):
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=401, detail="Missing session token")
    with psycopg.connect(settings.DATABASE_URL or "") as conn:
        principal = get_session_principal(conn, session_token)
    if not principal:
        raise HTTPException(status_code=401, detail="Invalid session token")
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"session_id": session_id, "traces": get_traces(session_id)}