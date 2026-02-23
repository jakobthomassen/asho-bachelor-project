from __future__ import annotations

import os
import sys
from pathlib import Path


def run() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    os.environ.setdefault("GOOGLE_SUB_HASH_SECRET", "dev-secret")
    os.environ.setdefault("AUTH_SUB_HASH_SECRET", "dev-secret")
    os.environ.setdefault("AUTH_TOKEN_HASH_SECRET", "dev-token-secret")
    os.environ.setdefault("AUTH_REQUIRE_EMAIL_VERIFICATION", "false")
    os.environ.setdefault("AUTH_DEBUG_RETURN_TOKENS", "true")

    from app.services.custom_auth import CustomAuthService, InMemoryAuthRepository

    service = CustomAuthService(repository=InMemoryAuthRepository())

    register_result = service.register("TestUser@example.com", "VeryStrongPassword123")
    assert register_result.requires_email_verification is False
    assert register_result.verification_token is None

    login_after_register = service.login("testuser@example.com", "VeryStrongPassword123")
    assert login_after_register.status == "ok"

    reset_token = service.forgot_password("testuser@example.com")
    assert reset_token
    assert service.reset_password(reset_token, "UpdatedPassword123") is True

    login_after_reset = service.login("testuser@example.com", "UpdatedPassword123")
    assert login_after_reset.status == "ok"

    print("selftest_auth_components: ok")


if __name__ == "__main__":
    run()
