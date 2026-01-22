from fastapi import APIRouter, HTTPException
import psycopg

from app.core.config import settings
from app.schemas.auth import GoogleAuthRequest, GoogleAuthResponse
from app.services.google_auth import ensure_auth_tables, exchange_google_credential

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for auth")


@router.post("/auth/google", response_model=GoogleAuthResponse)
def auth_google(payload: GoogleAuthRequest):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            ensure_auth_tables(conn)
            result = exchange_google_credential(conn, payload.credential)
            return {
                "user_id": result.user_id,
                "session_token": result.session_token,
            }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
