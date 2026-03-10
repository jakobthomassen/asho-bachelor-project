from collections import deque
import time

from fastapi import APIRouter, HTTPException, Header, Response, Request
from fastapi.responses import RedirectResponse
import psycopg

from app.core.config import settings
from app.schemas.auth import (
    AuthMeResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GenericAuthMessageResponse,
    GoogleAuthRequest,
    GoogleAuthResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services.apple_auth import build_start_redirect, exchange_code_for_user_id, validate_signed_state
from app.services.auth_rate_limit import check_auth_rate_limit
from app.services.custom_auth import CustomAuthService, normalize_email
from app.services.google_auth import (
    create_session_for_user,
    exchange_google_credential,
    get_session_principal,
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
_custom_auth_service: CustomAuthService | None = None


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
    frontend = settings.FRONTEND_URL.strip() if settings.FRONTEND_URL else ""

    def is_allowed(url: str | None) -> bool:
        if not url:
            return False
        if url == "null":
            return False
        if allowed:
            return any(url.startswith(o) for o in allowed)
        # If no allowlist configured, fall back to request origin
        return origin is not None and url.startswith(origin)

    if is_allowed(return_to):
        return return_to  # type: ignore[return-value]

    if frontend:
        return frontend
    if allowed:
        return allowed[0]
    if origin and origin != "null":
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


def _check_custom_rate_limit(request: Request, flow: str, identifier: str | None = None) -> None:
    client_ip = _get_client_ip(request)
    if not check_auth_rate_limit(flow=flow, client_ip=client_ip, identifier=identifier):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


def _cookie_kwargs() -> dict[str, object]:
    kwargs: dict[str, object] = {
        "httponly": True,
        "secure": bool(settings.AUTH_COOKIE_SECURE),
        "samesite": settings.AUTH_COOKIE_SAMESITE.lower(),
        "max_age": int(settings.AUTH_OAUTH_COOKIE_TTL_SECONDS),
        "path": "/",
    }
    if settings.AUTH_COOKIE_DOMAIN:
        kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN
    return kwargs


def _get_custom_auth_service() -> CustomAuthService:
    global _custom_auth_service
    if _custom_auth_service is None:
        _custom_auth_service = CustomAuthService()
    return _custom_auth_service


@router.post("/auth/google", response_model=GoogleAuthResponse)
def auth_google(payload: GoogleAuthRequest, request: Request):
    _check_rate_limit(_get_client_ip(request))
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            result = exchange_google_credential(conn, payload.credential)
            return {
                "user_id": result.user_id,
                "session_token": result.session_token,
                "is_admin": result.is_admin,
            }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/auth/apple/start")
def auth_apple_start(request: Request, return_to: str | None = None):
    _check_custom_rate_limit(request, flow="apple_start")

    try:
        start = build_start_redirect(return_to=return_to)
        response = RedirectResponse(url=start.authorization_url, status_code=303)
        cookie_kwargs = _cookie_kwargs()
        response.set_cookie("apple_oauth_state", start.signed_state, **cookie_kwargs)
        response.set_cookie("apple_oauth_nonce", start.nonce, **cookie_kwargs)
        return response
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/apple/callback")
async def auth_apple_callback(request: Request):
    _check_custom_rate_limit(request, flow="apple_callback")

    form = await request.form()
    code = form.get("code")
    state = form.get("state")
    if not isinstance(code, str) or not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    if not isinstance(state, str) or not state:
        raise HTTPException(status_code=400, detail="Missing state")

    cookie_state = request.cookies.get("apple_oauth_state")
    cookie_nonce = request.cookies.get("apple_oauth_nonce")
    if not cookie_state or not cookie_nonce:
        raise HTTPException(status_code=400, detail="Missing OAuth cookies")
    if cookie_state != state:
        raise HTTPException(status_code=400, detail="Invalid state")

    try:
        state_payload = validate_signed_state(state)
        expected_nonce = str(state_payload.get("nonce") or "")
        if not expected_nonce or expected_nonce != cookie_nonce:
            raise HTTPException(status_code=400, detail="Invalid nonce")

        token_result = exchange_code_for_user_id(code=code, expected_nonce=expected_nonce)
        with psycopg.connect(settings.DATABASE_URL) as conn:
            session_token = create_session_for_user(conn, token_result.user_id)
            principal = get_session_principal(conn, session_token)

        if not principal:
            raise HTTPException(status_code=500, detail="Failed to issue session")

        return_to = state_payload.get("return_to")
        redirect_base = _pick_redirect_url(request, str(return_to) if isinstance(return_to, str) else None)
        admin_flag = "1" if principal.is_admin else "0"
        fragment = (
            f"user_id={principal.user_id}"
            f"&is_admin={admin_flag}"
        )
        redirect_url = f"{redirect_base.rstrip('/')}/#auth=apple&{fragment}"
        response = RedirectResponse(url=redirect_url, status_code=303)
        response.delete_cookie("apple_oauth_state", path="/")
        response.delete_cookie("apple_oauth_nonce", path="/")
        session_cookie_kwargs = {**_cookie_kwargs(), "max_age": settings.SESSION_TTL_DAYS * 86400}
        response.set_cookie("session_token", session_token, **session_cookie_kwargs)
        return response
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/auth/session", response_model=GoogleAuthResponse)
def auth_session(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="No session cookie")

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            principal = get_session_principal(conn, session_token)
            if not principal:
                raise HTTPException(status_code=401, detail="Invalid session token")
            return {
                "user_id": principal.user_id,
                "session_token": session_token,
                "is_admin": principal.is_admin,
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/auth/me", response_model=AuthMeResponse)
def auth_me(authorization: str | None = Header(default=None)):
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            principal = get_session_principal(conn, session_token)
            if not principal:
                raise HTTPException(status_code=401, detail="Invalid session token")
            return {
                "user_id": principal.user_id,
                "is_admin": principal.is_admin,
            }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/register", response_model=RegisterResponse)
def auth_register(payload: RegisterRequest, request: Request):
    identifier = normalize_email(payload.email)
    _check_custom_rate_limit(request, flow="register", identifier=identifier)

    try:
        service = _get_custom_auth_service()
        result = service.register(email=payload.email, password=payload.password)
        return {
            "user_id": result.user_id,
            "requires_email_verification": result.requires_email_verification,
            "verification_token": result.verification_token,
        }
    except ValueError as exc:
        detail = str(exc)
        if detail == "Email already registered":
            raise HTTPException(status_code=409, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/login", response_model=GoogleAuthResponse)
def auth_login(payload: LoginRequest, request: Request):
    identifier = normalize_email(payload.email)
    _check_custom_rate_limit(request, flow="login", identifier=identifier)

    try:
        service = _get_custom_auth_service()
        login_result = service.login(email=payload.email, password=payload.password)
        if login_result.status != "ok" or not login_result.user_id:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        with psycopg.connect(settings.DATABASE_URL) as conn:
            session_token = create_session_for_user(conn, login_result.user_id)
            principal = get_session_principal(conn, session_token)
        if not principal:
            raise HTTPException(status_code=500, detail="Failed to issue session")
        return {
            "user_id": principal.user_id,
            "session_token": session_token,
            "is_admin": principal.is_admin,
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/logout", status_code=204)
def auth_logout(authorization: str | None = Header(default=None)):
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=400, detail="Missing bearer token")

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            revoke_session(conn, session_token)
            return Response(status_code=204)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
def auth_forgot_password(payload: ForgotPasswordRequest, request: Request):
    identifier = normalize_email(payload.email)
    _check_custom_rate_limit(request, flow="forgot_password", identifier=identifier)

    try:
        service = _get_custom_auth_service()
        reset_token = service.forgot_password(payload.email)
        return {
            "message": "If the account exists, a reset flow has been started.",
            "reset_token": reset_token,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/reset-password", response_model=GenericAuthMessageResponse)
def auth_reset_password(payload: ResetPasswordRequest, request: Request):
    _check_custom_rate_limit(request, flow="reset_password")

    try:
        service = _get_custom_auth_service()
        ok = service.reset_password(token=payload.token, new_password=payload.new_password)
        if not ok:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        return {"message": "Password has been reset."}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/auth/verify-email", response_model=GenericAuthMessageResponse)
def auth_verify_email(payload: VerifyEmailRequest, request: Request):
    _check_custom_rate_limit(request, flow="verify_email")

    try:
        service = _get_custom_auth_service()
        ok = service.verify_email(token=payload.token)
        if not ok:
            raise HTTPException(status_code=400, detail="Invalid or expired verification token")
        return {"message": "Email verified."}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


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
            result = exchange_google_credential(conn, credential)

        redirect_base = _pick_redirect_url(request, return_to)
        admin_flag = "1" if result.is_admin else "0"
        fragment = (
            f"user_id={result.user_id}"
            f"&is_admin={admin_flag}"
        )
        redirect_url = f"{redirect_base.rstrip('/')}/#auth=google&{fragment}"
        response = RedirectResponse(url=redirect_url, status_code=303)
        session_cookie_kwargs = {**_cookie_kwargs(), "max_age": settings.SESSION_TTL_DAYS * 86400}
        response.set_cookie("session_token", result.session_token, **session_cookie_kwargs)
        return response
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")
