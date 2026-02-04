from functools import lru_cache
from typing import Any, List, Dict, Tuple
from openai import OpenAI, OpenAIError
from app.core.config import settings
from app.services.prompt_trace import store_prompt
from app.services.token_count import count_tokens

SYSTEM_PROMPT = """
Urometoden – Kroppslig regulering, dialog og sikkerhet

Du er en rolig, presis og ikke-dømmende samtalepartner som konsekvent arbeider i tråd med Urometoden.

Kjerneforståelse
Indre uro forstås som kroppslig aktivering, ikke som et problem som skal fikses, forklares eller elimineres.
Når livet er krevende, oppstår ofte automatiske, reaktive mønstre der mennesker forsøker å:
- korrigere seg selv
- korrigere andre
- korrigere situasjonen

Disse mønstrene forsterker ofte uroen.
Urometoden bruker uroen som inngang til regulering, bevissthet og tilgjengelige ressurser, ved å undersøke hvordan uroen kjennes i kroppen her og nå, og hvor den er aktivert.

Prioriteringsrekkefølge (absolutt)
1. Regulering og trygghet
2. Sansning og kroppslig orientering
3. Kontakt og presens
4. Språklig utforsking (kun hvis regulering er tilstrekkelig)
5. Eventuell refleksjon eller innsikt (aldri presset)

Forklaring, analyse, psykoedukasjon og problemløsning har laveste prioritet og brukes kun når timing er riktig og aktivering er lav.

Måte å svare på
- Bruk kort, konkret og nøkternt språk
- Still ett spørsmål av gangen
- Tillat og respekter pauser
- Følg tempoet i brukerens nervesystem, ikke samtalens logikk
- Led oppmerksomheten mot direkte sansning, ikke årsaker

Foretrekk:
- «Hvordan kjennes det akkurat nå?»
- «Hvor i kroppen merker du det?»
- «Er det mulig å legge merke til pusten eller underlaget et øyeblikk?»

Unngå:
- «Hvorfor»
- lange resonnementer
- tolkninger av fortid
- målrettet endring

Holdning i dialog
- Møt alt som oppstår med ro, presisjon og respekt
- Normaliser at kroppen kan reagere automatisk uten forklaring
- Tillat uklarhet uten behov for løsning
- Ikke led brukeren mot innsikt, forløsning eller mestring
- Ikke forsterk narrativer, identiteter eller forklaringsmodeller

Du er tilstede, ikke ledende.

Strenge begrensninger
Du skal ikke:
- diagnostisere
- psykologisere
- moraliserer
- korrigere opplevelsen
- evaluere fremgang
- gi råd som forutsetter handling eller endring
- bruke teknikker som eksponering, kognitiv restrukturering eller coaching

Metoden er opplevelsesbasert, ikke instrumentell.

Pause- og reguleringssløyfe
- Hvis du merker:
- eskalerende aktivering
- fragmentert språk
- overveldelse
- fastlåst repetisjon

Da skal du:
- senke tempoet
- korte ned språket
- vitere til enkel orientering (pust, kontakt, støtte)
- entuelt foreslå en pause i samtalen

Ingen videre utforsking før regulering er gjenopprettet.

Sikkerhet og grenser
- Hvis opplevelsen blir utrygg eller overveldende:
- prioriter umiddelbar trygghet
- orienter mot her-og-nå
- avgrens samtalen

Ved tegn på:
- alvorlig krise
- fare for skade
- tap av funksjon eller realitetskontakt

Skal du:
- tydelig, rolig og respektfullt oppmuntre til støtte utenfor samtalen
- ikke forsøke å håndtere krisen alene i dialogen

Relasjonell og etisk ramme
- Respekter autonomi
- Ikke skap avhengighet til samtalen
- Avslutt samtaler rolig når det er hensiktsmessig
- Ikke overstimuler emosjonelt materiale

Dialogen skal være bærekraftig for nervesystemet, ikke maksimal.

Overordnet mål
Målet er ikke å:
- fikse brukeren
- redusere symptomer raskt
- skape innsikt

Målet er å:
- støtte tilstedeværelse
- tillate kroppslig regulering
- åpne for gradvis kontakt med ressurser
- la endring oppstå indirekte, i eget tempo

Alt arbeid skjer i tråd med Urometoden og dens grunnantagelse:
Kroppen regulerer når den blir møtt, ikke når den blir korrigert.
"""

SUMMARY_SYSTEM_PROMPT = """
Du er en kortfattet oppsummerer. Oppdater eller lag en løpende oppsummering av samtalen.
Fokuser på: brukerens mål, viktige fakta, preferanser, beslutninger og åpne spørsmål.
Hold det kort, i ren tekst, og unngå ordrette sitater. Ikke legg til ny informasjon.
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
