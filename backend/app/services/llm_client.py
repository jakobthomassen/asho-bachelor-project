import json
import math
import re
from functools import lru_cache
from typing import Any, List, Dict, Tuple
from openai import OpenAI, OpenAIError
from app.core.config import settings
from app.services.prompt_trace import store_prompt
from app.services.token_count import count_tokens

SYSTEM_PROMPT = """
Urometoden – grunnforståelse

Du er en rolig, presis og ikke-dømmende samtalepartner.
Indre uro forstås som kroppslig aktivering, ikke et problem som må fikses raskt.

Mål:
- støtte trygghet, kontakt og regulering i brukerens tempo
- bruke enkelt og konkret språk
- gi korte svar med ett tydelig neste steg

Viktige prinsipper:
- ikke overstyr brukeren med metode eller fast spørreskjema
- ikke gjenta de samme kroppsspørsmålene i loop
- bruk kroppsfokus kun når det er relevant og nyttig i konteksten
- prioriter stabilisering fremfor analyse, tolkning og lange forklaringer

Unngå:
- diagnostisering, moralisering og press
- ledende eller repeterende utspørring
- råd som forutsetter rask endring

Ved tegn på sterk overveldelse eller mulig fare:
- senk tempoet
- avgrens samtalen
- oppmuntre rolig til støtte utenfor chat ved behov
"""


SUMMARY_SYSTEM_PROMPT = """
Du er en kortfattet oppsummerer for ASHO-samtaler. Oppdater den løpende oppsummeringen.

Inkluder alltid:
- Brukerens situasjon/tema (f.eks. "angst for heis")
- Kroppssensasjon som ble identifisert (f.eks. "tyngde i magen")
- Hvilket steg i ASHO-flyten som ble fullført sist:
  STEG 1 (velkomst) / STEG 2 (behagelig/ubehagelig) / 
  STEG 3 (kropp) / STEG 4 (uro-metoden forklart) / 
  STEG 5 (lydfil-oppgave gitt) / STEG 6 (avsluttet)
- Eventuelle åpne spørsmål

Hold det under 5 linjer. Ren tekst. Ingen ordrette sitater.
"""

INITIAL_SUMMARY_SYSTEM_PROMPT = """
Du er en kortfattet oppsummerer. Lag en kort beskrivelse av samtalestart.
Fokuser på: brukerens utgangssituasjon, overordnet tema, og viktige fakta eller følelser de delte tidlig.
Hold det kort, i ren tekst, og unngå ordrette sitater. Ikke legg til ny informasjon eller tolkninger.
"""

CLASSIFIER_SYSTEM_PROMPT = """
Velg best passende topic for meldingen.
Returner KUN gyldig JSON i formen:
{"topic_key": string|null, "confidence": number, "reason": string}
Kort regel:
- Hvis usikker: bruk null og lav confidence.
- Ikke gjett eller inferer skjulte tema.
- Velg topic kun ved tydelig, eksplisitt evidens i `message` eller `recent_user`.
"""

TITLE_SYSTEM_PROMPT = """
Lag en kort samtaletittel basert på brukermeldinger.
Returner KUN gyldig JSON i formen:
{"title": string|null, "confidence": number, "reason": string}
Regler:
- Hvis innholdet er for generelt (f.eks. kun hilsen/småprat), bruk title=null.
- Title skal være kort (2-6 ord), konkret og uten punktum.
- confidence må være mellom 0 og 1.
"""

DEFAULT_DIALOGUE_APPENDIX = """
Standardmodus:
- Følg den overordnede Urometoden-forståelsen.
- Unngå rigide scripts og repeterende kroppsspørsmål.
- Bruk maksimalt ett kort, ikke-ledende spørsmål når det trengs.
- Prioriter stabilisering, tydelighet og fremdrift uten å presse.
"""

SOMATIC_NUDGE_APPENDIX = """
Somatisk tilstedeværelse (etter at kontakt er etablert):
Hvis brukeren utforsker noe følelsesmessig eller spenningsfylt, og kroppslig tilstedeværelse ikke allerede er nevnt i denne samtalen, kan du én gang – bare én gang per tema – forsiktig invitere til kroppslig tilstedeværelse. Eksempel: "Hva merker du i kroppen nå?" eller "Er det noe i kroppen som reagerer på det?". Gjør dette kun der det faller naturlig inn. Ikke gjentak det for samme tema, og ikke spør om kroppen hvis brukeren nettopp har beskrevet en kroppslig opplevelse.
"""

LOW_SIGNAL_MESSAGES = {
    "hei",
    "heisann",
    "hallo",
    "hello",
    "ok",
    "okei",
    "yo",
    "test",
    "start",
    "ja",
    "nei",
}

MIN_TOPIC_SIMILARITY = 0.30
MIN_TOPIC_SIMILARITY_MARGIN = 0.06


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
) -> Tuple[str, int, int]:
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

    parsed_json = None
    if stage == "classifier":
        try:
            parsed_json = json.loads(content)
        except Exception:
            parsed_json = None

    store_prompt(
        session_id,
        messages,
        stage=stage,
        prompt_tokens=prompt_tokens,
        response_text=content,
        response_json=parsed_json,
    )

    # Prefer reported usage when available; otherwise estimate.
    usage_tokens = 0
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "completion_tokens", None) is not None:
            usage_tokens = int(response.usage.completion_tokens)
        else:
            usage_tokens = count_tokens(content, model=settings.MODEL_NAME)
    except Exception:
        usage_tokens = count_tokens(content, model=settings.MODEL_NAME)

    return content, usage_tokens, prompt_tokens


def chat_with_history(
    session_id: str,
    history: List[Dict[str, Any]],
    user_message: str,
) -> Tuple[str, int, int]:
    """
    Returns (assistant_text, output_tokens, prompt_tokens)
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
) -> Tuple[str, int, int]:
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


def create_text_embedding(*, text: str) -> List[float]:
    clean_text = str(text or "").strip()
    if not clean_text:
        raise RuntimeError("Cannot create embedding for empty text")

    client = get_client()
    try:
        response = client.embeddings.create(
            model=settings.EMBEDDING_MODEL_NAME,
            input=clean_text,
        )
    except OpenAIError as e:
        raise RuntimeError(f"OpenAI embedding request failed: {e}") from e

    if not response.data:
        raise RuntimeError("OpenAI embedding response was empty")

    vector = response.data[0].embedding
    if not vector:
        raise RuntimeError("OpenAI embedding vector was empty")

    return [float(v) for v in vector]


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    if len(a) != len(b):
        return 0.0

    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for idx in range(len(a)):
        av = float(a[idx])
        bv = float(b[idx])
        dot += av * bv
        norm_a += av * av
        norm_b += bv * bv

    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def classify_topic_by_embedding(
    *,
    user_message: str,
    recent_history: List[Dict[str, Any]],
    topics: List[Dict[str, Any]],
) -> Tuple[str | None, float, str, int]:
    normalized_user = str(user_message or "").strip().lower()
    normalized_user = re.sub(r"\s+", " ", normalized_user)
    if normalized_user in LOW_SIGNAL_MESSAGES:
        return None, 0.0, "Lav-signal melding; klassifisering hoppet over.", 0
    if len(normalized_user) <= 2:
        return None, 0.0, "For kort melding; klassifisering hoppet over.", 0

    user_snippets: List[str] = []
    for msg in recent_history[-4:]:
        if str(msg.get("role")) == "user":
            snippet = str(msg.get("content") or "").strip()
            if snippet:
                user_snippets.append(snippet)

    text_blocks = user_snippets[-3:]
    text_blocks.append(str(user_message or "").strip())
    classification_text = "\n".join([t for t in text_blocks if t]).strip()
    if not classification_text:
        return None, 0.0, "Tom brukertekst; ingen klassifisering.", 0

    message_embedding = create_text_embedding(text=classification_text)
    estimated_tokens = count_tokens(classification_text, model=settings.MODEL_NAME)

    scored: List[Tuple[str, float, float]] = []
    for topic in topics:
        topic_key = str(topic.get("topic_key") or "").strip()
        if not topic_key:
            continue

        topic_embedding = topic.get("embedding")
        if not isinstance(topic_embedding, list) or not topic_embedding:
            continue

        try:
            topic_vec = [float(v) for v in topic_embedding]
        except Exception:
            continue

        similarity = _cosine_similarity(message_embedding, topic_vec)
        confidence = (similarity + 1.0) / 2.0
        scored.append((topic_key, confidence, similarity))

    if not scored:
        return None, 0.0, "Ingen topic embeddings tilgjengelig.", estimated_tokens

    scored.sort(key=lambda x: x[1], reverse=True)
    best_topic_key, best_confidence, best_similarity = scored[0]
    second_similarity = scored[1][2] if len(scored) > 1 else -1.0
    margin = best_similarity - second_similarity

    if best_similarity < MIN_TOPIC_SIMILARITY:
        return (
            None,
            best_confidence,
            f"embedding_similarity={best_similarity:.4f} under min={MIN_TOPIC_SIMILARITY:.2f}",
            estimated_tokens,
        )

    if len(scored) > 1 and margin < MIN_TOPIC_SIMILARITY_MARGIN:
        return (
            None,
            best_confidence,
            (
                f"embedding margin for lav: best={best_similarity:.4f}, "
                f"second={second_similarity:.4f}, min_margin={MIN_TOPIC_SIMILARITY_MARGIN:.2f}"
            ),
            estimated_tokens,
        )

    reason = f"embedding_similarity={best_similarity:.4f}"
    return best_topic_key, best_confidence, reason, estimated_tokens


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
    compact_topics: List[Dict[str, Any]] = []
    topics_by_key: Dict[str, Dict[str, Any]] = {}
    for t in topics:
        key = str(t.get("topic_key") or "").strip()
        if key:
            topics_by_key[key] = t
        compact_topics.append(
            {
                "k": key or t.get("topic_key"),
                "d": t.get("description"),
                "kw": t.get("keywords"),
                "ex": t.get("exclude_keywords"),
                "min": t.get("min_confidence"),
            }
        )

    recent_user_snippets: List[str] = []
    for msg in recent_history[-4:]:
        if str(msg.get("role")) == "user":
            recent_user_snippets.append(str(msg.get("content") or "")[:120])

    payload = {
        "topics": compact_topics,
        "recent_user": recent_user_snippets,
        "message": user_message,
    }
    messages = [
        {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    raw, output_tokens, _ = _run_chat_completion(
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

    # Deterministic guardrail: do not allow inferred topic matches without
    # explicit lexical evidence from the current/very recent user text.
    if topic_key:
        selected = topics_by_key.get(topic_key)
        if not selected:
            topic_key = None
            confidence = min(confidence, 0.2)
            reason = "Ugyldig topic_key fra classifier; fallback til null."
        else:
            evidence_text = " ".join(
                [user_message] + [str(x or "") for x in recent_user_snippets]
            ).lower()
            keywords = [str(k).strip().lower() for k in (selected.get("keywords") or []) if str(k).strip()]
            exclude_keywords = [
                str(k).strip().lower()
                for k in (selected.get("exclude_keywords") or [])
                if str(k).strip()
            ]

            has_excluded = any(k in evidence_text for k in exclude_keywords)
            has_keyword_evidence = any(k in evidence_text for k in keywords) if keywords else False

            if has_excluded or not has_keyword_evidence:
                topic_key = None
                confidence = min(confidence, 0.2)
                reason = (
                    (
                        "Ingen eksplisitt topic-evidens i meldingen."
                        if keywords
                        else "Topic mangler classifier_keywords; avvist for å unngå inferens."
                    )
                    if not has_excluded
                    else "Ekskluderende nøkkelord funnet; topic avvist."
                )

    return topic_key, confidence, reason, output_tokens


def generate_conversation_title(
    *,
    session_id: str,
    user_messages: List[str],
) -> Tuple[str | None, float, str, int, int]:
    payload = {
        "user_messages": user_messages[-8:],
    }
    messages = [
        {"role": "system", "content": TITLE_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    raw, output_tokens, title_prompt_tokens = _run_chat_completion(
        session_id=session_id,
        messages=messages,
        stage="title",
        temperature=0.1,
        max_tokens=80,
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

    title = parsed.get("title")
    if title is not None:
        title = str(title).strip() or None

    try:
        confidence = float(parsed.get("confidence", 0.0))
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    reason = str(parsed.get("reason", "")).strip()
    return title, confidence, reason, output_tokens, title_prompt_tokens


def summarize_history(
    *,
    session_id: str,
    existing_summary: str | None,
    messages: List[Dict[str, Any]],
) -> Tuple[str, int, int]:
    """
    Summarizes a list of chat messages, optionally extending an existing summary.

    Returns (summary_text, output_tokens, prompt_tokens)
    """
    client = get_client()

    summary_messages: List[Dict[str, Any]] = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
    ]

    if existing_summary:
        summary_messages.append(
            {
                "role": "user",
                "content": "Eksisterende oppsummering:\n" + existing_summary,
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
            "content": "Nye samtalerunder:\n" + "\n".join(lines),
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

    store_prompt(
        session_id,
        summary_messages,
        stage="summary",
        prompt_tokens=prompt_tokens,
        response_text=content,
        response_json=None,
    )

    usage_tokens = 0
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "completion_tokens", None) is not None:
            usage_tokens = int(response.usage.completion_tokens)
        else:
            usage_tokens = count_tokens(content, model=settings.MODEL_NAME)
    except Exception:
        usage_tokens = count_tokens(content, model=settings.MODEL_NAME)

    return content.strip(), usage_tokens, prompt_tokens


def create_initial_summary(
    *,
    session_id: str,
    messages: List[Dict[str, Any]],
) -> Tuple[str, int, int]:
    """
    Creates a one-time summary capturing the opening context of the conversation.
    Returns (summary_text, output_tokens, prompt_tokens)
    """
    client = get_client()

    lines = []
    for msg in messages:
        role = str(msg.get("role") or "")
        content = str(msg.get("content") or "")
        lines.append(f"{role}: {content}")

    summary_messages: List[Dict[str, Any]] = [
        {"role": "system", "content": INITIAL_SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": "Samtalestart:\n" + "\n".join(lines)},
    ]

    try:
        response = client.chat.completions.create(
            model=settings.MODEL_NAME,
            messages=summary_messages,
            temperature=0.2,
            max_tokens=settings.SUMMARY_MAX_TOKENS,
        )
    except OpenAIError as e:
        raise RuntimeError(f"OpenAI initial summarization failed: {e}") from e

    content = response.choices[0].message.content or ""

    prompt_tokens_estimate = sum(
        count_tokens(str(msg.get("content") or ""), model=settings.MODEL_NAME)
        for msg in summary_messages
    )
    prompt_tokens = prompt_tokens_estimate
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "prompt_tokens", None) is not None:
            prompt_tokens = int(response.usage.prompt_tokens)
    except Exception:
        prompt_tokens = prompt_tokens_estimate

    store_prompt(
        session_id,
        summary_messages,
        stage="initial_summary",
        prompt_tokens=prompt_tokens,
        response_text=content,
        response_json=None,
    )

    usage_tokens = 0
    try:
        if getattr(response, "usage", None) and getattr(response.usage, "completion_tokens", None) is not None:
            usage_tokens = int(response.usage.completion_tokens)
        else:
            usage_tokens = count_tokens(content, model=settings.MODEL_NAME)
    except Exception:
        usage_tokens = count_tokens(content, model=settings.MODEL_NAME)

    return content.strip(), usage_tokens, prompt_tokens
