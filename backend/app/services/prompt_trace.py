from collections import defaultdict, deque
from time import time
from typing import Any

MAX_TRACES = 50

_trace = defaultdict(lambda: deque(maxlen=MAX_TRACES))

def store_prompt(
    session_id: str,
    messages,
    *,
    stage: str = "chat",
    prompt_tokens: int | None = None,
    response_text: str | None = None,
    response_json: dict[str, Any] | None = None,
):
    _trace[session_id].append(
        {
            "stage": stage,
            "prompt_tokens": prompt_tokens,
            "messages": messages,
            "response_text": response_text,
            "response_json": response_json,
            "created_at": int(time() * 1000),
        }
    )

def get_traces(session_id: str):
    return list(_trace.get(session_id, []))
