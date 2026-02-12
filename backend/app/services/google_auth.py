from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import psycopg
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.core.config import settings


@dataclass(frozen=True)
class GoogleAuthResult:
    user_id: str
    session_token: str
    is_admin: bool


@dataclass(frozen=True)
class SessionPrincipal:
    user_id: str
    is_admin: bool


def ensure_auth_tables(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS google_users (
                user_id TEXT PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS google_sessions (
                session_token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES google_users(user_id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS google_sessions_expires_at_idx
            ON google_sessions (expires_at)
            """
        )
    conn.commit()


def extract_google_user_id(credential: str) -> str:
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID is required")

    try:
        payload = id_token.verify_oauth2_token(
            credential,
            Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        raise ValueError("Invalid Google credential") from exc

    iss = payload.get("iss")
    if iss not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("Google credential issuer mismatch")

    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and exp < time.time():
        raise ValueError("Google credential expired")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ValueError("Google credential missing user id")

    secret = settings.GOOGLE_SUB_HASH_SECRET
    if not secret:
        raise ValueError("GOOGLE_SUB_HASH_SECRET is required")

    digest = hmac.new(
        secret.encode("utf-8"),
        sub.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def create_session_for_user(conn: psycopg.Connection, user_id: str) -> str:
    session_token = str(uuid.uuid4())
    ttl_days = settings.SESSION_TTL_DAYS

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO google_users (user_id)
            VALUES (%s)
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id,),
        )
        cur.execute(
            """
            INSERT INTO google_sessions (session_token, user_id, expires_at)
            VALUES (%s, %s, NOW() + (%s || ' days')::interval)
            """,
            (session_token, user_id, int(ttl_days)),
        )
    conn.commit()
    return session_token


def exchange_google_credential(conn: psycopg.Connection, credential: str) -> GoogleAuthResult:
    user_id = extract_google_user_id(credential)
    session_token = create_session_for_user(conn, user_id)
    principal = get_session_principal(conn, session_token)
    if not principal:
        raise ValueError("Failed to create session")
    return GoogleAuthResult(
        user_id=principal.user_id,
        session_token=session_token,
        is_admin=principal.is_admin,
    )


def get_session_principal(conn: psycopg.Connection, session_token: str) -> Optional[SessionPrincipal]:
    if not session_token:
        return None

    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM google_sessions
            WHERE expires_at < NOW()
            """
        )
        cur.execute(
            """
            SELECT s.user_id, COALESCE(u.is_admin, FALSE) AS is_admin
            FROM google_sessions s
            JOIN google_users u ON u.user_id = s.user_id
            WHERE s.session_token = %s
              AND s.expires_at >= NOW()
            """,
            (session_token,),
        )
        row = cur.fetchone()
    conn.commit()

    if not row:
        return None
    return SessionPrincipal(user_id=str(row[0]), is_admin=bool(row[1]))


def get_user_id_for_session(conn: psycopg.Connection, session_token: str) -> Optional[str]:
    principal = get_session_principal(conn, session_token)
    return principal.user_id if principal else None


def revoke_session(conn: psycopg.Connection, session_token: str) -> None:
    if not session_token:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM google_sessions
            WHERE session_token = %s
            """,
            (session_token,),
        )
    conn.commit()


def parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]
