from __future__ import annotations

from typing import Optional


def count_tokens(text: str, model: Optional[str] = None) -> int:
    """
    Returns token count for text using model tokenizer if available.
    Falls back to a conservative approximation if tiktoken is unavailable.
    """
    text = text or ""
    try:
        import tiktoken  # type: ignore

        # Prefer model encoding if possible; fallback to cl100k_base.
        try:
            enc = tiktoken.encoding_for_model(model or "gpt-4o-mini")
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")

        return len(enc.encode(text))
    except Exception:
        # Conservative heuristic: ~4 chars/token for English-ish text, but
        # allow variance. Add a small bias to avoid undercounting.
        # Minimum 1 token for non-empty strings.
        approx = (len(text) // 4) + 1 if text else 0
        return int(approx)
