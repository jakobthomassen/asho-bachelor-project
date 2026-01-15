from functools import lru_cache
from typing import Any, List, Dict, Tuple
from openai import OpenAI, OpenAIError
from app.core.config import settings
from app.services.prompt_trace import store_prompt
from app.services.token_count import count_tokens


SYSTEM_PROMPT = "You are a simple chat bot. You will assist the user with whatever the user asks."


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Set it in your environment.")
    return OpenAI(api_key=api_key)


def chat_with_history(
    session_id: str,
    history: List[Dict[str, Any]],
    user_message: str,
) -> Tuple[str, int]:
    """
    Returns (assistant_text, assistant_output_tokens_estimate_or_reported)
    """
    client = get_client()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    store_prompt(session_id, messages)

    try:
        response = client.chat.completions.create(
            model=settings.MODEL_NAME,
            messages=messages,
            temperature=0.7,
            max_tokens=settings.MAX_OUTPUT_TOKENS,
        )
    except OpenAIError as e:
        raise RuntimeError(f"OpenAI request failed: {e}") from e

    content = response.choices[0].message.content or ""

    # Prefer reported usage when available; otherwise estimate.
    usage_tokens = 0
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "completion_tokens", None) is not None:
            usage_tokens = int(response.usage.completion_tokens)
        else:
            usage_tokens = count_tokens(content, model=settings.MODEL_NAME)
    except Exception:
        usage_tokens = count_tokens(content, model=settings.MODEL_NAME)

    return content, usage_tokens
