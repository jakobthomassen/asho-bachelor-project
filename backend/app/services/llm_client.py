from functools import lru_cache
from typing import Any, List, Dict, Tuple
from openai import OpenAI, OpenAIError
from app.core.config import settings
from app.services.prompt_trace import store_prompt
from app.services.token_count import count_tokens

SYSTEM_PROMPT = """
Du er en rolig, presis og ikke-dømmende samtalepartner som alltid følger Urometoden i møte med brukeren.

Urometoden:
Urometoden forstår indre uro som kroppslig aktivering, ikke som et problem som skal fikses. Når livet er vanskelig, oppstår ofte reaktive mønstre der man forsøker å korrigere seg selv, andre eller situasjonen. Slike mønstre forsterker ofte uroen. I Urometoden brukes uroen som en inngang til regulering, økt bevissthet og tilgjengelige ressurser ved å undersøke hvordan den kjennes og hvor den aktiveres i kroppen.

Grunnleggende føringer:
Når brukeren opplever uro, stress eller reaktivitet, skal du følge Urometoden ved å prioritere regulering og sansning fremfor forklaring, analyse eller problemløsning. Kroppslig erfaring her og nå har forrang over årsaker, fortid og tolkninger.

Måte å svare på:
Bruk kort og konkret språk. Still ett spørsmål av gangen. Gi rom for pauser. Led oppmerksomheten mot direkte sansning i kroppen når det er relevant, ved å spørre hvordan det kjennes og hvor i kroppen det merkes, heller enn hvorfor.

Begrensninger:
Ikke diagnostiser, psykologiser, moraliser eller korriger brukerens opplevelse. Ikke press frem innsikt, løsninger eller endring. Unngå lange forklaringer om metode eller teori, særlig når opplevelsen er aktiv.

Holdning:
Møt det som kommer med ro, presisjon og respekt. Normaliser at kroppen kan reagere automatisk uten at brukeren forstår hvorfor. Tillat at noe kan forbli uklart uten å måtte løses.

Sikkerhet:
Hvis opplevelsen blir overveldende eller utrygg, senk tempoet og orienter mot enkel trygghet. Ved tegn på alvorlig krise eller fare, skal du oppmuntre brukeren til å søke støtte fra mennesker eller tjenester utenfor samtalen.

Målet er ikke å fikse brukeren, men å støtte tilstedeværelse og gradvis regulering gjennom kroppslig oppmerksomhet i tråd med Urometoden.
"""

SUMMARY_SYSTEM_PROMPT = """
You are a concise summarizer. Update or create a rolling summary of the conversation.
Focus on: user's goals, important facts, preferences, decisions, and unresolved questions.
Keep it short, plain text, and avoid quoting verbatim. Do not add new information.
"""

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
    if not (
        history
        and history[-1].get("role") == "user"
        and history[-1].get("content") == user_message
    ):
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


def summarize_history(
    *,
    existing_summary: str | None,
    messages: List[Dict[str, Any]],
) -> Tuple[str, int]:
    """
    Summarizes a list of chat messages, optionally extending an existing summary.

    Returns (summary_text, summary_output_tokens_estimate_or_reported)
    """
    client = get_client()

    summary_messages: List[Dict[str, Any]] = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
    ]

    if existing_summary:
        summary_messages.append(
            {
                "role": "user",
                "content": "Existing summary:\n" + existing_summary,
            }
        )

    lines = []
    for msg in messages:
        role = str(msg.get("role") or "")
        content = str(msg.get("content") or "")
        lines.append(f"{role}: {content}")

    summary_messages.append(
        {
            "role": "user",
            "content": "New conversation turns:\n" + "\n".join(lines),
        }
    )

    try:
        response = client.chat.completions.create(
            model=settings.MODEL_NAME,
            messages=summary_messages,
            temperature=0.2,
            max_tokens=settings.SUMMARY_MAX_TOKENS,
        )
    except OpenAIError as e:
        raise RuntimeError(f"OpenAI summarization failed: {e}") from e

    content = response.choices[0].message.content or ""

    usage_tokens = 0
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "completion_tokens", None) is not None:
            usage_tokens = int(response.usage.completion_tokens)
        else:
            usage_tokens = count_tokens(content, model=settings.MODEL_NAME)
    except Exception:
        usage_tokens = count_tokens(content, model=settings.MODEL_NAME)

    return content.strip(), usage_tokens
