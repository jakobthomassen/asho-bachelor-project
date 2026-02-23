import os
from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
    DATABASE_URL = os.getenv("DATABASE_URL")
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_SUB_HASH_SECRET = os.getenv("GOOGLE_SUB_HASH_SECRET", "")
    SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "7"))
    FRONTEND_URL = os.getenv("FRONTEND_URL", "")
    AUTH_SUB_HASH_SECRET = os.getenv("AUTH_SUB_HASH_SECRET", GOOGLE_SUB_HASH_SECRET)
    AUTH_TOKEN_HASH_SECRET = os.getenv("AUTH_TOKEN_HASH_SECRET", GOOGLE_SUB_HASH_SECRET)
    AUTH_STATE_SIGNING_SECRET = os.getenv("AUTH_STATE_SIGNING_SECRET", GOOGLE_SUB_HASH_SECRET)
    AUTH_CUSTOM_STORE_BACKEND = os.getenv("AUTH_CUSTOM_STORE_BACKEND", "postgres")
    AUTH_POSTGRES_DSN = os.getenv("AUTH_POSTGRES_DSN", "")
    AUTH_POSTGRES_AUTO_INIT = _as_bool(os.getenv("AUTH_POSTGRES_AUTO_INIT"), default=False)
    AUTH_REQUIRE_EMAIL_VERIFICATION = _as_bool(
        os.getenv("AUTH_REQUIRE_EMAIL_VERIFICATION"),
        default=True,
    )
    AUTH_DEBUG_RETURN_TOKENS = _as_bool(
        os.getenv("AUTH_DEBUG_RETURN_TOKENS"),
        default=False,
    )
    AUTH_MIN_PASSWORD_LENGTH = int(os.getenv("AUTH_MIN_PASSWORD_LENGTH", "8"))
    AUTH_EMAIL_VERIFY_TOKEN_TTL_MINUTES = int(
        os.getenv("AUTH_EMAIL_VERIFY_TOKEN_TTL_MINUTES", "30")
    )
    AUTH_RESET_TOKEN_TTL_MINUTES = int(os.getenv("AUTH_RESET_TOKEN_TTL_MINUTES", "30"))
    AUTH_COOKIE_SECURE = _as_bool(os.getenv("AUTH_COOKIE_SECURE"), default=True)
    AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax")
    AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN", "")
    AUTH_OAUTH_COOKIE_TTL_SECONDS = int(os.getenv("AUTH_OAUTH_COOKIE_TTL_SECONDS", "900"))
    AUTH_RATE_IP_CAPACITY = float(os.getenv("AUTH_RATE_IP_CAPACITY", "20"))
    AUTH_RATE_IP_REFILL_PER_SEC = float(os.getenv("AUTH_RATE_IP_REFILL_PER_SEC", "0.33"))
    AUTH_RATE_IDENTIFIER_CAPACITY = float(os.getenv("AUTH_RATE_IDENTIFIER_CAPACITY", "8"))
    AUTH_RATE_IDENTIFIER_REFILL_PER_SEC = float(
        os.getenv("AUTH_RATE_IDENTIFIER_REFILL_PER_SEC", "0.1")
    )

    APPLE_TEAM_ID = os.getenv("APPLE_TEAM_ID", "")
    APPLE_CLIENT_ID = os.getenv("APPLE_CLIENT_ID", "")
    APPLE_KEY_ID = os.getenv("APPLE_KEY_ID", "")
    APPLE_PRIVATE_KEY = os.getenv("APPLE_PRIVATE_KEY", "")
    APPLE_REDIRECT_URI = os.getenv("APPLE_REDIRECT_URI", "")
    APPLE_ISSUER = os.getenv("APPLE_ISSUER", "https://appleid.apple.com")
    APPLE_AUTH_URL = os.getenv("APPLE_AUTH_URL", "https://appleid.apple.com/auth/authorize")
    APPLE_TOKEN_URL = os.getenv("APPLE_TOKEN_URL", "https://appleid.apple.com/auth/token")
    APPLE_JWKS_URL = os.getenv("APPLE_JWKS_URL", "https://appleid.apple.com/auth/keys")
    APPLE_SCOPE = os.getenv("APPLE_SCOPE", "name email")

    # Security and budgeting
    MAX_MESSAGE_TOKENS = int(os.getenv("MAX_MESSAGE_TOKENS", "512"))
    MAX_SESSION_TOKENS = int(os.getenv("MAX_SESSION_TOKENS", "8000"))

    # Bound model verbosity/cost
    MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "512"))

    # Rolling summaries
    MAX_HISTORY_TOKENS = int(os.getenv("MAX_HISTORY_TOKENS", "1800"))
    MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "12"))
    SUMMARY_MAX_TOKENS = int(os.getenv("SUMMARY_MAX_TOKENS", "350"))
    SUMMARY_KEEP_LAST_MESSAGES = int(os.getenv("SUMMARY_KEEP_LAST_MESSAGES", "6"))
    SUMMARY_WINDOW_MESSAGES = int(os.getenv("SUMMARY_WINDOW_MESSAGES", "30"))

settings = Settings()
