from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Literal, Optional, Protocol

import psycopg

from app.core.config import settings

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
except Exception:  # pragma: no cover - fallback path
    PasswordHasher = None  # type: ignore[assignment]
    VerifyMismatchError = Exception  # type: ignore[assignment]

try:
    import bcrypt
except Exception:  # pragma: no cover - fallback path
    bcrypt = None  # type: ignore[assignment]


AuthStatus = Literal["ok", "invalid_credentials"]

@dataclass(frozen=True)
class RegisterResult:
    user_id: str
    requires_email_verification: bool
    verification_token: str | None


@dataclass(frozen=True)
class LoginResult:
    status: AuthStatus
    user_id: str | None = None


@dataclass(frozen=True)
class IdentityRecord:
    email_norm: str
    user_id: str
    password_hash: str
    email_verified: bool


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def derive_provider_user_id(provider: str, subject: str) -> str:
    secret = settings.AUTH_SUB_HASH_SECRET or settings.GOOGLE_SUB_HASH_SECRET
    if not secret:
        raise ValueError("AUTH_SUB_HASH_SECRET (or GOOGLE_SUB_HASH_SECRET) is required")
    digest = hmac.new(secret.encode("utf-8"), subject.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{provider}_{digest}"


class _PasswordEngine:
    def __init__(self) -> None:
        self._argon = PasswordHasher() if PasswordHasher is not None else None

    def hash_password(self, password: str) -> str:
        if self._argon is not None:
            return self._argon.hash(password)
        if bcrypt is not None:
            return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        raise ValueError("No password hashing backend available. Install argon2-cffi or bcrypt.")

    def verify_password(self, hashed_password: str, provided_password: str) -> bool:
        if hashed_password.startswith("$argon2") and self._argon is not None:
            try:
                self._argon.verify(hashed_password, provided_password)
                return True
            except VerifyMismatchError:
                return False
        if hashed_password.startswith("$2") and bcrypt is not None:
            return bcrypt.checkpw(provided_password.encode("utf-8"), hashed_password.encode("utf-8"))
        return False


class AuthRepository(Protocol):
    def get_by_email(self, email_norm: str) -> IdentityRecord | None: ...
    def create_identity(
        self,
        email_norm: str,
        user_id: str,
        password_hash: str,
        email_verified: bool,
        verify_token_hash: str | None,
        verify_token_expires_at_epoch: int | None,
    ) -> None: ...
    def consume_verify_token(self, token_hash: str, now_epoch: int) -> bool: ...
    def set_reset_token(self, email_norm: str, token_hash: str, expires_at_epoch: int) -> bool: ...
    def consume_reset_token(self, token_hash: str, now_epoch: int, new_password_hash: str) -> bool: ...


class PostgresAuthRepository:
    def __init__(self, dsn: str) -> None:
        if not dsn:
            raise ValueError(
                "AUTH_POSTGRES_DSN (or DATABASE_URL) is required for Postgres custom auth store"
            )
        self._dsn = dsn

    @staticmethod
    def _row_to_record(row) -> IdentityRecord:
        return IdentityRecord(
            email_norm=str(row[0]),
            user_id=str(row[1]),
            password_hash=str(row[2]),
            email_verified=bool(row[3]),
        )

    def get_by_email(self, email_norm: str) -> IdentityRecord | None:
        with psycopg.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT email_norm, user_id, password_hash, email_verified
                    FROM auth_identities
                    WHERE email_norm = %s
                    """,
                    (email_norm,),
                )
                row = cur.fetchone()
            conn.commit()
        return self._row_to_record(row) if row else None

    def create_identity(
        self,
        email_norm: str,
        user_id: str,
        password_hash: str,
        email_verified: bool,
        verify_token_hash: str | None,
        verify_token_expires_at_epoch: int | None,
    ) -> None:
        with psycopg.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO auth_identities (
                        email_norm, user_id, password_hash, email_verified,
                        verify_token_hash, verify_token_expires_at,
                        created_at, updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s,
                        CASE WHEN %s IS NULL THEN NULL ELSE TO_TIMESTAMP(%s) END,
                        NOW(), NOW()
                    )
                    """,
                    (
                        email_norm,
                        user_id,
                        password_hash,
                        bool(email_verified),
                        verify_token_hash,
                        verify_token_expires_at_epoch,
                        verify_token_expires_at_epoch,
                    ),
                )
            conn.commit()

    def consume_verify_token(self, token_hash: str, now_epoch: int) -> bool:
        with psycopg.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE auth_identities
                    SET email_verified = TRUE,
                        verify_token_hash = NULL,
                        verify_token_expires_at = NULL,
                        updated_at = NOW()
                    WHERE verify_token_hash = %s
                      AND verify_token_expires_at IS NOT NULL
                      AND verify_token_expires_at >= TO_TIMESTAMP(%s)
                    """,
                    (token_hash, now_epoch),
                )
                changed = cur.rowcount > 0
            conn.commit()
        return changed

    def set_reset_token(self, email_norm: str, token_hash: str, expires_at_epoch: int) -> bool:
        with psycopg.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE auth_identities
                    SET reset_token_hash = %s,
                        reset_token_expires_at = TO_TIMESTAMP(%s),
                        updated_at = NOW()
                    WHERE email_norm = %s
                    """,
                    (token_hash, expires_at_epoch, email_norm),
                )
                changed = cur.rowcount > 0
            conn.commit()
        return changed

    def consume_reset_token(self, token_hash: str, now_epoch: int, new_password_hash: str) -> bool:
        with psycopg.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE auth_identities
                    SET password_hash = %s,
                        reset_token_hash = NULL,
                        reset_token_expires_at = NULL,
                        updated_at = NOW()
                    WHERE reset_token_hash = %s
                      AND reset_token_expires_at IS NOT NULL
                      AND reset_token_expires_at >= TO_TIMESTAMP(%s)
                    """,
                    (new_password_hash, token_hash, now_epoch),
                )
                changed = cur.rowcount > 0
            conn.commit()
        return changed


class InMemoryAuthRepository:
    """
    Test-only fallback repository to avoid requiring a live DB in self-tests.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: dict[str, dict[str, object]] = {}

    def get_by_email(self, email_norm: str) -> IdentityRecord | None:
        with self._lock:
            row = self._items.get(email_norm)
            if not row:
                return None
            return IdentityRecord(
                email_norm=email_norm,
                user_id=str(row["user_id"]),
                password_hash=str(row["password_hash"]),
                email_verified=bool(row["email_verified"]),
            )

    def create_identity(
        self,
        email_norm: str,
        user_id: str,
        password_hash: str,
        email_verified: bool,
        verify_token_hash: str | None,
        verify_token_expires_at_epoch: int | None,
    ) -> None:
        with self._lock:
            self._items[email_norm] = {
                "user_id": user_id,
                "password_hash": password_hash,
                "email_verified": bool(email_verified),
                "verify_token_hash": verify_token_hash,
                "verify_token_expires_at": verify_token_expires_at_epoch,
                "reset_token_hash": None,
                "reset_token_expires_at": None,
            }

    def consume_verify_token(self, token_hash: str, now_epoch: int) -> bool:
        with self._lock:
            for row in self._items.values():
                if row.get("verify_token_hash") != token_hash:
                    continue
                expires = int(row.get("verify_token_expires_at") or 0)
                if expires < now_epoch:
                    return False
                row["email_verified"] = True
                row["verify_token_hash"] = None
                row["verify_token_expires_at"] = None
                return True
            return False

    def set_reset_token(self, email_norm: str, token_hash: str, expires_at_epoch: int) -> bool:
        with self._lock:
            row = self._items.get(email_norm)
            if not row:
                return False
            row["reset_token_hash"] = token_hash
            row["reset_token_expires_at"] = expires_at_epoch
            return True

    def consume_reset_token(self, token_hash: str, now_epoch: int, new_password_hash: str) -> bool:
        with self._lock:
            for row in self._items.values():
                if row.get("reset_token_hash") != token_hash:
                    continue
                expires = int(row.get("reset_token_expires_at") or 0)
                if expires < now_epoch:
                    return False
                row["password_hash"] = new_password_hash
                row["reset_token_hash"] = None
                row["reset_token_expires_at"] = None
                return True
            return False


def build_auth_repository() -> AuthRepository:
    backend = (settings.AUTH_CUSTOM_STORE_BACKEND or "postgres").strip().lower()
    if backend == "postgres":
        dsn = (settings.AUTH_POSTGRES_DSN or settings.DATABASE_URL or "").strip()
        return PostgresAuthRepository(dsn=dsn)
    if backend == "memory":
        return InMemoryAuthRepository()
    raise ValueError("AUTH_CUSTOM_STORE_BACKEND must be 'postgres' or 'memory'")


class CustomAuthService:
    def __init__(self, repository: Optional[AuthRepository] = None) -> None:
        self._password_engine = _PasswordEngine()
        self._repo = repository or build_auth_repository()

    @staticmethod
    def _now() -> int:
        return int(time.time())

    @staticmethod
    def _hash_token(token: str) -> str:
        secret = settings.AUTH_TOKEN_HASH_SECRET or settings.GOOGLE_SUB_HASH_SECRET
        if not secret:
            raise ValueError("AUTH_TOKEN_HASH_SECRET (or GOOGLE_SUB_HASH_SECRET) is required")
        return hmac.new(secret.encode("utf-8"), token.encode("utf-8"), hashlib.sha256).hexdigest()

    def hash_password(self, password: str) -> str:
        if len(password) < settings.AUTH_MIN_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.AUTH_MIN_PASSWORD_LENGTH} characters long"
            )
        return self._password_engine.hash_password(password)

    def register(self, email: str, password: str) -> RegisterResult:
        normalized = normalize_email(email)
        if not normalized:
            raise ValueError("Email is required")

        if self._repo.get_by_email(normalized):
            raise ValueError("Email already registered")

        password_hash = self.hash_password(password)
        user_id = derive_provider_user_id("email", normalized)
        # Email verification is temporarily disabled until verification delivery is wired.
        requires_verify = False
        verify_token = None
        verify_hash = self._hash_token(verify_token) if verify_token else None
        expires = (
            self._now() + int(settings.AUTH_EMAIL_VERIFY_TOKEN_TTL_MINUTES * 60)
            if verify_token
            else None
        )

        self._repo.create_identity(
            email_norm=normalized,
            user_id=user_id,
            password_hash=password_hash,
            email_verified=not requires_verify,
            verify_token_hash=verify_hash,
            verify_token_expires_at_epoch=expires,
        )

        return RegisterResult(
            user_id=user_id,
            requires_email_verification=requires_verify,
            verification_token=verify_token if settings.AUTH_DEBUG_RETURN_TOKENS else None,
        )

    def login(self, email: str, password: str) -> LoginResult:
        normalized = normalize_email(email)
        if not normalized:
            return LoginResult(status="invalid_credentials")

        record = self._repo.get_by_email(normalized)
        if not record:
            return LoginResult(status="invalid_credentials")
        if not self._password_engine.verify_password(record.password_hash, password):
            return LoginResult(status="invalid_credentials")
        return LoginResult(status="ok", user_id=record.user_id)

    def forgot_password(self, email: str) -> str | None:
        normalized = normalize_email(email)
        if not normalized:
            return None

        token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(token)
        expires = self._now() + int(settings.AUTH_RESET_TOKEN_TTL_MINUTES * 60)
        updated = self._repo.set_reset_token(normalized, token_hash, expires)
        if not updated:
            return None
        return token if settings.AUTH_DEBUG_RETURN_TOKENS else None

    def reset_password(self, token: str, new_password: str) -> bool:
        if not token:
            return False
        new_hash = self.hash_password(new_password)
        token_hash = self._hash_token(token)
        return self._repo.consume_reset_token(token_hash, self._now(), new_hash)

    def verify_email(self, token: str) -> bool:
        if not token:
            return False
        token_hash = self._hash_token(token)
        return self._repo.consume_verify_token(token_hash, self._now())
