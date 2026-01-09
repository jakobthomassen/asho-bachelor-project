from functools import lru_cache
from typing import Any

from openai import OpenAI
from openai import OpenAIError

from app.core.config import settings


@lru_cache(maxsize=1)
def _get_client() -> OpenAI:
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Set it in your .env."
        )
    return OpenAI(api_key=api_key)


def chat_completion(messages: list[dict[str, Any]]) -> str:
    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=settings.MODEL_NAME,
            messages=messages,
            temperature=0.7,
        )
    except OpenAIError as e:
        # You can log e here if you have logging set up
        raise RuntimeError(f"OpenAI request failed: {e}") from e

    content = response.choices[0].message.content
    return content or ""

