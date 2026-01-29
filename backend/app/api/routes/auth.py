from collections import deque
import time

from fastapi import APIRouter, HTTPException, Header, Response, Request
from fastapi.responses import RedirectResponse
import psycopg

from app.core.config import settings
from app.schemas.auth import GoogleAuthRequest, GoogleAuthResponse
from app.services.google_auth import (
    ensure_auth_tables,
    exchange_google_credential,
    parse_bearer_token,
    revoke_session,
)

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for auth")

_RATE_WINDOW_SECONDS = 60
_RATE_LIMIT = 10
_RATE_BURST = 3
_auth_rate_buckets: dict[str, deque[float]] = {}


def _get_client_ip(request: Request) -> str:
    # TODO: If you later add a trusted proxy/load balancer, read x-forwarded-for here.
    if request.client and request.client.host:
        return request.client.host
    return "unknown"

def _allowed_origins() -> list[str]:
    raw = settings.ALLOWED_ORIGINS or ""
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [o for o in origins if o != "*"]

def _pick_redirect_url(request: Request, return_to: str | None) -> str:
    allowed = _allowed_origins()
    origin = request.headers.get("origin")

    def is_allowed(url: str | None) -> bool:
        if not url:
            return False
        if allowed:
            return any(url.startswith(o) for o in allowed)
        # If no allowlist configured, fall back to request origin
        return origin is not None and url.startswith(origin)

    if is_allowed(return_to):
        return return_to  # type: ignore[return-value]

    if allowed:
        return allowed[0]
    if origin:
        return origin
    return "/"

def _check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    window_start = now - _RATE_WINDOW_SECONDS
    bucket = _auth_rate_buckets.setdefault(client_ip, deque())
    while bucket and bucket[0] < window_start:
        bucket.popleft()

    limit = _RATE_LIMIT + _RATE_BURST
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    bucket.append(now)


@router.post("/auth/google", response_model=GoogleAuthResponse)
def auth_google(payload: GoogleAuthRequest, request: Request):
    _check_rate_limit(_get_client_ip(request))
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


@router.post("/auth/logout", status_code=204)
def auth_logout(authorization: str | None = Header(default=None)):
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=400, detail="Missing bearer token")

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            ensure_auth_tables(conn)
            revoke_session(conn, session_token)
            return Response(status_code=204)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/auth/google/redirect")
async def auth_google_redirect(request: Request, return_to: str | None = None):
    _check_rate_limit(_get_client_ip(request))

    form = await request.form()
    credential = form.get("credential")
    csrf_token = form.get("g_csrf_token")
    csrf_cookie = request.cookies.get("g_csrf_token")

    if csrf_cookie and csrf_token and csrf_cookie != csrf_token:
        raise HTTPException(status_code=400, detail="Invalid CSRF token")

    if not credential or not isinstance(credential, str):
        raise HTTPException(status_code=400, detail="Missing credential")

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            ensure_auth_tables(conn)
            result = exchange_google_credential(conn, credential)

        redirect_base = _pick_redirect_url(request, return_to)
        fragment = f"session_token={result.session_token}&user_id={result.user_id}"
        redirect_url = f"{redirect_base.rstrip('/')}/#auth=google&{fragment}"
        return RedirectResponse(url=redirect_url, status_code=303)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
