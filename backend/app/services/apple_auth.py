from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import jwt
import requests
from jwt import PyJWKClient

from app.core.config import settings
from app.services.custom_auth import derive_provider_user_id


@dataclass(frozen=True)
class AppleStartResult:
    authorization_url: str
    signed_state: str
    nonce: str


@dataclass(frozen=True)
class AppleTokenResult:
    user_id: str


def _base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _base64url_decode(raw: str) -> bytes:
    padding = "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def _state_secret() -> str:
    secret = settings.AUTH_STATE_SIGNING_SECRET or settings.GOOGLE_SUB_HASH_SECRET
    if not secret:
        raise ValueError("AUTH_STATE_SIGNING_SECRET (or GOOGLE_SUB_HASH_SECRET) is required")
    return secret


def _sign_state(payload: dict[str, object]) -> str:
    body = _base64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))
    signature = hmac.new(_state_secret().encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def validate_signed_state(signed_state: str) -> dict[str, object]:
    try:
        body, signature = signed_state.split(".", 1)
    except ValueError as exc:
        raise ValueError("Invalid state format") from exc

    expected = hmac.new(_state_secret().encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid state signature")

    payload = json.loads(_base64url_decode(body).decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Invalid state payload")

    now = int(time.time())
    exp = int(payload.get("exp", 0))
    iat = int(payload.get("iat", 0))
    if exp <= now or iat <= 0 or iat > now + 60:
        raise ValueError("State expired or invalid")
    return payload


def _build_apple_client_secret() -> str:
    if not settings.APPLE_PRIVATE_KEY:
        raise ValueError("APPLE_PRIVATE_KEY is required")

    private_key = settings.APPLE_PRIVATE_KEY.replace("\\n", "\n")
    now = int(time.time())
    claims = {
        "iss": settings.APPLE_TEAM_ID,
        "iat": now,
        "exp": now + 300,
        "aud": settings.APPLE_ISSUER,
        "sub": settings.APPLE_CLIENT_ID,
    }
    headers = {"kid": settings.APPLE_KEY_ID}
    return jwt.encode(claims, private_key, algorithm="ES256", headers=headers)


def build_start_redirect(return_to: str | None = None) -> AppleStartResult:
    if not settings.APPLE_CLIENT_ID:
        raise ValueError("APPLE_CLIENT_ID is required")
    if not settings.APPLE_REDIRECT_URI:
        raise ValueError("APPLE_REDIRECT_URI is required")

    nonce = secrets.token_urlsafe(24)
    now = int(time.time())
    state_payload = {
        "nonce": nonce,
        "iat": now,
        "exp": now + int(settings.AUTH_OAUTH_COOKIE_TTL_SECONDS),
    }
    if return_to:
        state_payload["return_to"] = return_to
    signed_state = _sign_state(state_payload)

    query = urlencode(
        {
            "response_type": "code",
            "response_mode": "form_post",
            "client_id": settings.APPLE_CLIENT_ID,
            "redirect_uri": settings.APPLE_REDIRECT_URI,
            "scope": settings.APPLE_SCOPE,
            "state": signed_state,
            "nonce": nonce,
        }
    )
    authorization_url = f"{settings.APPLE_AUTH_URL}?{query}"
    return AppleStartResult(authorization_url=authorization_url, signed_state=signed_state, nonce=nonce)


def exchange_code_for_user_id(code: str, expected_nonce: str) -> AppleTokenResult:
    if not code:
        raise ValueError("Missing authorization code")
    if not settings.APPLE_TOKEN_URL:
        raise ValueError("APPLE_TOKEN_URL is required")

    client_secret = _build_apple_client_secret()
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": settings.APPLE_CLIENT_ID,
        "client_secret": client_secret,
        "redirect_uri": settings.APPLE_REDIRECT_URI,
    }
    response = requests.post(settings.APPLE_TOKEN_URL, data=payload, timeout=10)
    if response.status_code >= 400:
        raise ValueError(f"Apple token exchange failed ({response.status_code})")

    token_response = response.json()
    id_token_value = token_response.get("id_token")
    if not isinstance(id_token_value, str) or not id_token_value:
        raise ValueError("Apple token response missing id_token")

    sub = _verify_apple_id_token(id_token_value, expected_nonce)
    return AppleTokenResult(user_id=derive_provider_user_id("apple", sub))


def _verify_apple_id_token(id_token_value: str, expected_nonce: str) -> str:
    if not settings.APPLE_JWKS_URL:
        raise ValueError("APPLE_JWKS_URL is required")

    jwk_client = PyJWKClient(settings.APPLE_JWKS_URL)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token_value)
    claims = jwt.decode(
        id_token_value,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.APPLE_CLIENT_ID,
        issuer=settings.APPLE_ISSUER,
        options={"require": ["iss", "aud", "exp", "iat", "sub"]},
    )

    nonce = claims.get("nonce")
    if nonce != expected_nonce:
        raise ValueError("Apple nonce mismatch")

    iat = int(claims.get("iat", 0))
    if iat > int(time.time()) + 60:
        raise ValueError("Apple token iat is in the future")

    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ValueError("Apple token missing sub")
    return sub
