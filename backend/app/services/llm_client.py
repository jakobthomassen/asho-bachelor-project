import json
import re
from functools import lru_cache
from typing import Any, List, Dict, Tuple
from openai import OpenAI, OpenAIError
from app.core.config import settings
from app.services.prompt_trace import store_prompt
from app.services.token_count import count_tokens

SYSTEM_PROMPT = """
Urometoden – kroppslig orientert dialog

Du er en rolig, presis og ikke-dømmende samtalepartner som konsekvent arbeider i tråd med Urometoden.
Du følger metode og rekkefølge fremfor samtalelogikk, empatiuttrykk eller problemløsning.

────────────────────────
KJERNEFORSTÅELSE
────────────────────────
Indre uro forstås som kroppslig aktivering, ikke som et problem som skal fikses, forklares eller elimineres.
Når livet er krevende, oppstår ofte automatiske, reaktive mønstre der mennesker forsøker å:
- korrigere seg selv
- korrigere andre
- korrigere situasjonen

Disse mønstrene forsterker ofte uroen.

Urometoden bruker uroen som inngang til regulering og tilgjengelige ressurser ved å undersøke:
- hvordan uroen kjennes
- hvor i kroppen den er aktivert
- hvordan personen forholder seg til den

All utforsking skjer i her-og-nå-opplevelse, ikke i forklaring.

────────────────────────
ABSOLUTT PRIORITERINGSREKKEFØLGE
────────────────────────
1. Kroppslig trygghet
2. Sansning og lokalisering i kroppen
3. Kontakt og presens
4. Språklig utforsking (kun etter regulering)
5. Refleksjon eller innsikt (aldri presset)

Forklaring, analyse, psykoedukasjon og problemløsning har laveste prioritet og brukes kun hvis aktivering er lav og stabil.

────────────────────────
DIALOGSTRUKTUR (SKAL FØLGES)
────────────────────────
Utforskning følger denne rekkefølgen:
1. Er opplevelsen behagelig eller ubehagelig?
2. Hvor i kroppen kjennes den?
3. Presisering av at vi ikke undersøker hvorfor
4. Beskrivelse av kroppslig kvalitet / energi
5. Forholdet til ubehaget (for / imot)

Ikke hopp over trinn.
Ikke introduser regulering før forholdet til opplevelsen er undersøkt.

────────────────────────
MÅTE Å SVARE PÅ
────────────────────────
- Bruk kort, konkret og nøkternt språk
- Still ett spørsmål av gangen
- Tillat pauser uten å fylle dem
- Følg tempoet i brukerens nervesystem
- Led oppmerksomheten mot direkte sansning, ikke mening

Foretrukne formuleringer:
- «Hvordan kjennes det akkurat nå?»
- «Hvor i kroppen merker du det?»
- «Er det behagelig eller ubehagelig?»
- «Er du for eller imot den opplevelsen?»

Unngå:
- «Hvorfor»
- refleksjoner som tolker eller oppsummerer
- forklaringer om fortid
- målrettet endring

────────────────────────
HOLDNING
────────────────────────
- Møt det som kommer med ro og presisjon
- Normaliser kroppslig reaksjon uten forklaring
- Tillat uklarhet uten behov for løsning
- Ikke led brukeren mot innsikt, mestring eller forløsning
- Ikke forsterk narrativer, identitet eller selvforståelser

Du er tilstede, ikke ledende.

────────────────────────
STRENGE BEGRENSNINGER
────────────────────────
Du skal ikke:
- diagnostisere
- psykologisere
- moraliserer
- korrigere opplevelsen
- evaluere fremgang
- gi råd som forutsetter handling eller endring
- bruke teknikker som eksponering, kognitiv restrukturering eller coaching

Metoden er opplevelsesbasert, ikke instrumentell.

────────────────────────
PAUSE- OG REGULERINGSSLØYFE
────────────────────────
Hvis du observerer:
- eskalerende aktivering
- fragmentert språk
- overveldelse
- fastlåst repetisjon

Da skal du:
- senke tempoet
- korte ned språket
- invitere til enkel orientering (pust, kontakt, støtte)
- eventuelt foreslå pause

Ingen videre utforsking før regulering er gjenopprettet.

────────────────────────
SIKKERHET
────────────────────────
Hvis opplevelsen blir utrygg:
- prioriter umiddelbar trygghet
- orienter mot her-og-nå
- avgrens samtalen

Ved tegn på alvorlig krise eller fare:
- oppmuntre rolig og tydelig til støtte utenfor samtalen
- ikke forsøk å håndtere krisen alene i dialogen

────────────────────────
OVERORDNET MÅL
────────────────────────
Målet er ikke å:
- fikse brukeren
- redusere symptomer raskt
- skape innsikt

Målet er å:
- støtte tilstedeværelse
- tillate kroppslig regulering
- åpne for gradvis kontakt med ressurser
- la endring oppstå indirekte, i eget tempo

Grunnantagelse:
Kroppen regulerer når den blir møtt, ikke når den blir korrigert.
"""


SUMMARY_SYSTEM_PROMPT = """
Du er en kortfattet oppsummerer. Oppdater eller lag en løpende oppsummering av samtalen.
Fokuser på: brukerens mål, viktige fakta, preferanser, beslutninger og åpne spørsmål.
Hold det kort, i ren tekst, og unngå ordrette sitater. Ikke legg til ny informasjon.
"""

CLASSIFIER_SYSTEM_PROMPT = """
You classify a user message into one topic from a provided catalog.
Return ONLY valid JSON with this exact shape:
{"topic_key": string|null, "confidence": number, "reason": string}
Rules:
- confidence must be between 0 and 1
- choose null if no topic confidently matches
- be conservative when uncertain
"""

DEFAULT_DIALOGUE_APPENDIX = """
Default handling mode:
- Follow the overall Urometoden philosophy.
- Avoid rigid scripts and avoid repetitive somatic loops.
- Ask one clear, non-leading question at a time.
- Prefer stabilization and clarity over deep interpretation.
"""


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Set it in your environment.")
    return OpenAI(api_key=api_key)


def _run_chat_completion(
    *,
    session_id: str,
    messages: List[Dict[str, Any]],
    stage: str,
    temperature: float,
    max_tokens: int,
) -> Tuple[str, int]:
    client = get_client()
    prompt_tokens_estimate = 0
    for msg in messages:
        prompt_tokens_estimate += count_tokens(str(msg.get("content") or ""), model=settings.MODEL_NAME)

    try:
        response = client.chat.completions.create(
            model=settings.MODEL_NAME,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except OpenAIError as e:
        raise RuntimeError(f"OpenAI request failed: {e}") from e

    content = response.choices[0].message.content or ""

    # Prefer provider prompt token usage when available; else keep estimate.
    prompt_tokens = prompt_tokens_estimate
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "prompt_tokens", None) is not None:
            prompt_tokens = int(response.usage.prompt_tokens)
    except Exception:
        prompt_tokens = prompt_tokens_estimate

    store_prompt(session_id, messages, stage=stage, prompt_tokens=prompt_tokens)

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


def chat_with_history(
    session_id: str,
    history: List[Dict[str, Any]],
    user_message: str,
) -> Tuple[str, int]:
    """
    Returns (assistant_text, assistant_output_tokens_estimate_or_reported)
    """
    return chat_with_history_with_system(
        session_id=session_id,
        history=history,
        user_message=user_message,
        system_prompt=SYSTEM_PROMPT,
    )


def chat_with_history_with_system(
    *,
    session_id: str,
    history: List[Dict[str, Any]],
    user_message: str,
    system_prompt: str,
    temperature: float = 0.7,
) -> Tuple[str, int]:
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    if not (
        history
        and history[-1].get("role") == "user"
        and history[-1].get("content") == user_message
    ):
        messages.append({"role": "user", "content": user_message})

    return _run_chat_completion(
        session_id=session_id,
        messages=messages,
        stage="chat",
        temperature=temperature,
        max_tokens=settings.MAX_OUTPUT_TOKENS,
    )


def classify_topic(
    *,
    session_id: str,
    user_message: str,
    recent_history: List[Dict[str, Any]],
    topics: List[Dict[str, Any]],
) -> Tuple[str | None, float, str, int]:
    """
    Returns:
      (topic_key_or_none, confidence_0_to_1, reason, output_tokens)
    """
    payload = {
        "topics": topics,
        "recent_history": recent_history[-6:],
        "user_message": user_message,
    }
    messages = [
        {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    raw, output_tokens = _run_chat_completion(
        session_id=session_id,
        messages=messages,
        stage="classifier",
        temperature=0.0,
        max_tokens=220,
    )

    parsed: Dict[str, Any] = {}
    try:
        parsed = json.loads(raw)
    except Exception:
        m = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception:
                parsed = {}

    topic_key = parsed.get("topic_key")
    if topic_key is not None:
        topic_key = str(topic_key).strip() or None

    try:
        confidence = float(parsed.get("confidence", 0.0))
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    reason = str(parsed.get("reason", "")).strip()
    return topic_key, confidence, reason, output_tokens


def summarize_history(
    *,
    session_id: str,
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

    prompt_tokens_estimate = 0
    for msg in summary_messages:
        prompt_tokens_estimate += count_tokens(str(msg.get("content") or ""), model=settings.MODEL_NAME)

    prompt_tokens = prompt_tokens_estimate
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "prompt_tokens", None) is not None:
            prompt_tokens = int(response.usage.prompt_tokens)
    except Exception:
        prompt_tokens = prompt_tokens_estimate

    store_prompt(session_id, summary_messages, stage="summary", prompt_tokens=prompt_tokens)

    usage_tokens = 0
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "completion_tokens", None) is not None:
            usage_tokens = int(response.usage.completion_tokens)
        else:
            usage_tokens = count_tokens(content, model=settings.MODEL_NAME)
    except Exception:
        usage_tokens = count_tokens(content, model=settings.MODEL_NAME)

    return content.strip(), usage_tokens
