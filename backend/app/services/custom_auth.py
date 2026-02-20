from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from cryptography.fernet import Fernet, InvalidToken

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


AuthStatus = Literal["ok", "invalid_credentials", "email_not_verified"]


@dataclass(frozen=True)
class RegisterResult:
    user_id: str
    requires_email_verification: bool
    verification_token: str | None


@dataclass(frozen=True)
class LoginResult:
    status: AuthStatus
    user_id: str | None = None


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


class EncryptedCredentialStore:
    """
    Security compromise due to immutable DB schema:
    credentials/tokens are stored in a single encrypted server-side file instead of Postgres.
    This is not ideal for horizontal scaling, key rotation, and multi-instance consistency.
    """

    def __init__(self, path: str, master_key: str) -> None:
        if not path:
            raise ValueError("AUTH_CREDENTIAL_STORE_PATH is required")
        if not master_key:
            raise ValueError("AUTH_CREDENTIAL_STORE_MASTER_KEY is required")

        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._fernet = self._build_fernet(master_key)
        self._lock = threading.Lock()

    @staticmethod
    def _build_fernet(raw_key: str) -> Fernet:
        candidate = raw_key.strip().encode("utf-8")
        try:
            return Fernet(candidate)
        except Exception:
            # Convenience fallback for passphrases: derive a deterministic Fernet key.
            derived = base64.urlsafe_b64encode(hashlib.sha256(candidate).digest())
            return Fernet(derived)

    def _read(self) -> dict[str, Any]:
        if not self._path.exists():
            return {"users": {}}
        token = self._path.read_bytes()
        if not token:
            return {"users": {}}
        try:
            payload = self._fernet.decrypt(token)
        except InvalidToken as exc:
            raise ValueError("Credential store cannot be decrypted with current master key") from exc
        data = json.loads(payload.decode("utf-8"))
        if not isinstance(data, dict):
            return {"users": {}}
        if "users" not in data or not isinstance(data["users"], dict):
            data["users"] = {}
        return data

    def _write(self, data: dict[str, Any]) -> None:
        plaintext = json.dumps(data, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        encrypted = self._fernet.encrypt(plaintext)
        tmp_path = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp_path.write_bytes(encrypted)
        os.replace(tmp_path, self._path)

    def with_data(self, updater):
        with self._lock:
            data = self._read()
            result = updater(data)
            self._write(data)
            return result

    def read_only(self):
        with self._lock:
            return self._read()


class CustomAuthService:
    def __init__(self) -> None:
        self._password_engine = _PasswordEngine()
        self._store = EncryptedCredentialStore(
            path=settings.AUTH_CREDENTIAL_STORE_PATH,
            master_key=settings.AUTH_CREDENTIAL_STORE_MASTER_KEY,
        )

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

        password_hash = self.hash_password(password)
        user_id = derive_provider_user_id("email", normalized)
        requires_verify = bool(settings.AUTH_REQUIRE_EMAIL_VERIFICATION)
        verify_token = secrets.token_urlsafe(32) if requires_verify else None
        verify_hash = self._hash_token(verify_token) if verify_token else None
        expires = (
            self._now() + int(settings.AUTH_EMAIL_VERIFY_TOKEN_TTL_MINUTES * 60)
            if verify_token
            else None
        )

        def updater(data: dict[str, Any]) -> RegisterResult:
            users = data.setdefault("users", {})
            if normalized in users:
                raise ValueError("Email already registered")

            users[normalized] = {
                "user_id": user_id,
                "password_hash": password_hash,
                "email_verified": not requires_verify,
                "created_at": self._now(),
                "verify_token_hash": verify_hash,
                "verify_token_expires_at": expires,
                "reset_token_hash": None,
                "reset_token_expires_at": None,
            }
            return RegisterResult(
                user_id=user_id,
                requires_email_verification=requires_verify,
                verification_token=verify_token if settings.AUTH_DEBUG_RETURN_TOKENS else None,
            )

        return self._store.with_data(updater)

    def login(self, email: str, password: str) -> LoginResult:
        normalized = normalize_email(email)
        if not normalized:
            return LoginResult(status="invalid_credentials")

        data = self._store.read_only()
        users = data.get("users", {})
        user = users.get(normalized)
        if not user:
            return LoginResult(status="invalid_credentials")

        verified = bool(user.get("email_verified"))
        if settings.AUTH_REQUIRE_EMAIL_VERIFICATION and not verified:
            return LoginResult(status="email_not_verified")

        stored_hash = str(user.get("password_hash") or "")
        if not self._password_engine.verify_password(stored_hash, password):
            return LoginResult(status="invalid_credentials")

        return LoginResult(status="ok", user_id=str(user.get("user_id")))

    def forgot_password(self, email: str) -> str | None:
        normalized = normalize_email(email)
        if not normalized:
            return None

        token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(token)
        expires = self._now() + int(settings.AUTH_RESET_TOKEN_TTL_MINUTES * 60)

        def updater(data: dict[str, Any]) -> str | None:
            users = data.setdefault("users", {})
            user = users.get(normalized)
            if not user:
                return None
            user["reset_token_hash"] = token_hash
            user["reset_token_expires_at"] = expires
            return token if settings.AUTH_DEBUG_RETURN_TOKENS else None

        return self._store.with_data(updater)

    def reset_password(self, token: str, new_password: str) -> bool:
        if not token:
            return False
        new_hash = self.hash_password(new_password)
        token_hash = self._hash_token(token)
        now = self._now()

        def updater(data: dict[str, Any]) -> bool:
            users = data.setdefault("users", {})
            for user in users.values():
                if user.get("reset_token_hash") != token_hash:
                    continue
                expires_at = int(user.get("reset_token_expires_at") or 0)
                if expires_at < now:
                    return False
                user["password_hash"] = new_hash
                user["reset_token_hash"] = None
                user["reset_token_expires_at"] = None
                return True
            return False

        return bool(self._store.with_data(updater))

    def verify_email(self, token: str) -> bool:
        if not token:
            return False
        token_hash = self._hash_token(token)
        now = self._now()

        def updater(data: dict[str, Any]) -> bool:
            users = data.setdefault("users", {})
            for user in users.values():
                if user.get("verify_token_hash") != token_hash:
                    continue
                expires_at = int(user.get("verify_token_expires_at") or 0)
                if expires_at < now:
                    return False
                user["email_verified"] = True
                user["verify_token_hash"] = None
                user["verify_token_expires_at"] = None
                return True
            return False

        return bool(self._store.with_data(updater))
