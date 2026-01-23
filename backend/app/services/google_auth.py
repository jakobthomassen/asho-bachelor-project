from __future__ import annotations

import base64
import json
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import psycopg

from app.core.config import settings


@dataclass(frozen=True)
class GoogleAuthResult:
    user_id: str
    session_token: str


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


def _base64url_decode(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _decode_google_jwt(credential: str) -> dict:
    parts = credential.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid Google credential format")
    payload = _base64url_decode(parts[1])
    try:
        return json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid Google credential payload") from exc


def extract_google_user_id(credential: str) -> str:
    """
    Extracts the Google 'sub' (user id) from an ID token.
    Note: This is a minimal PoC and does not verify the JWT signature.
    """
    payload = _decode_google_jwt(credential)

    aud = payload.get("aud")
    if settings.GOOGLE_CLIENT_ID and aud != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google credential audience mismatch")

    iss = payload.get("iss")
    if iss not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("Google credential issuer mismatch")

    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and exp < time.time():
        raise ValueError("Google credential expired")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ValueError("Google credential missing user id")

    return sub


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
    return GoogleAuthResult(user_id=user_id, session_token=session_token)


def get_user_id_for_session(conn: psycopg.Connection, session_token: str) -> Optional[str]:
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
            SELECT user_id
            FROM google_sessions
            WHERE session_token = %s
              AND expires_at >= NOW()
            """,
            (session_token,),
        )
        row = cur.fetchone()
    conn.commit()

    if not row:
        return None
    return str(row[0])


def parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]
