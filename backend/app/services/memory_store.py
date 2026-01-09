from collections import defaultdict, deque

MAX_HISTORY = 4

_session = defaultdict(lambda: deque(maxlen=MAX_HISTORY))

def append_message(session_id: str, role: str, content: str):
    _session[session_id].append({"role": role, "content": content})

def get_history(session_id: str):
    return list(_session[session_id])