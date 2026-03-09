from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional, Tuple

from app.core.config import settings
from app.services.token_count import count_tokens


@dataclass(frozen=True)
class SecurityResult:
    normalized_message: str
    message_tokens: int


class SecurityRejectionError(ValueError):
    def __init__(self, message: str, rejection_type: str) -> None:
        super().__init__(message)
        self.rejection_type = rejection_type

_ALLOWED_PUNCT = set("!?.,-")
_ALLOWED_WHITESPACE = set([" ", "\n", "\t"])

def _is_allowed_latin_letter(ch: str) -> bool:
    """
    Allow:
      - ASCII A-Z/a-z
      - Norwegian letters æøåÆØÅ
      - Latin letters with accents (e.g., é) where Unicode name contains 'LATIN'
      - Combining marks (to support decomposed accents) are allowed
        but only if they are marks; upstream normalization is NFC by default.
    """
    if not ch:
        return False

    # ASCII letters
    o = ord(ch)
    if 65 <= o <= 90 or 97 <= o <= 122:
        return True

    if ch in {"æ", "ø", "å", "Æ", "Ø", "Å"}:
        return True

    cat = unicodedata.category(ch)

    # Combining marks (accents) for decomposed forms
    if cat in {"Mn", "Mc"}:
        return True

    # Latin letters with diacritics
    if cat.startswith("L"):
        name = unicodedata.name(ch, "")
        if "LATIN" in name:
            return True

    return False


def _is_allowed_char(ch: str) -> bool:
    if ch in _ALLOWED_WHITESPACE:
        return True
    if ch.isdigit():
        return True
    if ch in _ALLOWED_PUNCT:
        return True
    if _is_allowed_latin_letter(ch):
        return True
    return False


def _normalize_message(message: str) -> str:
    # Normalize to NFC so precomposed accents like 'é' are consistent.
    # Also strip leading/trailing whitespace.
    msg = unicodedata.normalize("NFC", message or "").strip()
    # Optional: collapse excessive whitespace to reduce abuse.
    msg = re.sub(r"[ \t]{2,}", " ", msg)
    msg = re.sub(r"\n{3,}", "\n\n", msg)
    return msg


def _detect_prompt_injection(msg_lower: str) -> Optional[str]:
    """
    Heuristic checks. This is not a substitute for authorization boundaries.
    Given your allowlist, many classic payloads (JSON, URLs, tool syntax) are blocked,
    but injection can still be plain language.

    Strategy: block the most obvious meta-instruction attempts.
    """
    red_flags = [
        "ignore previous instructions",
        "ignore all previous instructions",
        "disregard previous instructions",
        "system prompt",
        "developer message",
        "you are chatgpt",
        "reveal your prompt",
        "show me the prompt",
        "bypass",
        "jailbreak",
        "do anything now",
        "act as",
        "pretend to be",
        "roleplay as",
    ]
    for phrase in red_flags:
        if phrase in msg_lower:
            return phrase
    return None


def validate_and_count(message: str, model_name: str) -> SecurityResult:
    """
    Main entry point. Use this at the API boundary before:
      - hashing for idempotency
      - saving to memory
      - calling OpenAI
    """
    normalized = _normalize_message(message)

    if not normalized:
        raise SecurityRejectionError("Message is empty.", rejection_type="empty")

    # Hard character allowlist policy
    bad_chars = []
    for ch in normalized:
        if not _is_allowed_char(ch):
            bad_chars.append(ch)
            if len(bad_chars) >= 5:
                break
    if bad_chars:
        # Do not echo untrusted input back in detail.
        raise SecurityRejectionError("Message contains disallowed characters.", rejection_type="disallowed_chars")

    # Token limit per message (input)
    msg_tokens = count_tokens(normalized, model=model_name)
    if msg_tokens > settings.MAX_MESSAGE_TOKENS:
        raise SecurityRejectionError("Message exceeds token limit.", rejection_type="token_limit")

    # Basic prompt injection heuristics
    # If you prefer “warn but allow”, return a flag instead of raising.
    msg_lower = normalized.lower()
    matched = _detect_prompt_injection(msg_lower)
    if matched:
        raise SecurityRejectionError("Message appears to be a prompt-injection attempt.", rejection_type="prompt_injection")

    return SecurityResult(normalized_message=normalized, message_tokens=msg_tokens)
