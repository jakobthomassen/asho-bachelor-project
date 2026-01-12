from collections import defaultdict, deque

MAX_TRACES = 50

_trace = defaultdict(lambda: deque(maxlen=MAX_TRACES))

def store_prompt(session_id: str, messages):
    _trace[session_id].append(messages)

def get_traces(session_id: str):
    return list(_trace.get(session_id, []))
