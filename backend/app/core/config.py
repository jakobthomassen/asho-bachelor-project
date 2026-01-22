import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
    DATABASE_URL = os.getenv("DATABASE_URL")
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "7"))

    # Security and budgeting
    MAX_MESSAGE_TOKENS = int(os.getenv("MAX_MESSAGE_TOKENS", "512"))
    MAX_SESSION_TOKENS = int(os.getenv("MAX_SESSION_TOKENS", "8000"))

    # Bound model verbosity/cost
    MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "512"))

settings = Settings()
