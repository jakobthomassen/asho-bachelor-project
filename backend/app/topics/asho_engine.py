from __future__ import annotations

import json
import re
from typing import Any

from app.services.llm_client import chat_with_history_with_system
from app.services.token_count import count_tokens
from app.core.config import settings

PHASES = [
    "situation",
    "body",
    "discomfort",
    "for_against",
    "willingness",
    "exploration",
    "practice",
]

LOW_INFORMATION_RESPONSES = {
    "nei",
    "vet ikke",
    "usikker",
    "aner ikke",
    "kanskje",
    "vetikkje",
    "idk",
    "dont know",
    "don't know",
}

RISK_PATTERNS = [
    r"\bselvmord\b",
    r"\bta livet\b",
    r"\bskade meg selv\b",
    r"\bskade meg sjølv\b",
    r"\bvil ikke leve\b",
    r"\bvil ikkje leve\b",
    r"\bdrepe meg\b",
    r"\boverdose\b",
]

LOCATION_WORDS = [
    "bryst",
    "mage",
    "hals",
    "nakke",
    "skuld",
    "skulder",
    "kjeve",
    "rygg",
    "arm",
    "bein",
    "ben",
    "hender",
    "hånd",
    "hendene",
    "hodet",
    "ansikt",
]

BODY_QUALITY_WORDS = [
    "stramt",
    "stram",
    "press",
    "trykk",
    "knute",
    "urolig",
    "rastløs",
    "rastlaus",
    "prikking",
    "svimmel",
    "varm",
    "kald",
    "tung",
    "spent",
    "stiv",
    "kvalm",
    "dirrer",
    "skjelver",
    "skjelv",
    "hjertebank",
]

ESCALATION_WORDS = [
    "øker",
    "auker",
    "verre",
    "sterkere",
    "sterkare",
    "skyter fart",
    "bygger seg opp",
    "bygger seg",
    "mer og mer",
    "eskalerer",
]

DISCOMFORT_WORDS = [
    "ubehag",
    "ubehagelig",
    "engstelig",
    "redd",
    "frykt",
    "stress",
    "stresset",
    "panikk",
    "nervøs",
]

REACTIVE_PATTERNS = {
    "escape":  [
    "komme meg ut",
    "må ut",
    "vil ut",
    "gå ut",
    "gå vekk",
    "løpe",
    "stikke",
    "unngå",
    "slippe unna",
    "dra hjem",
    "må bort",
    "vil bort",
    "komme meg vekk",
    "får lyst til å gå",
],
    "freeze": ["stivner", "låser seg", "fryser", "blir helt stille", "nummen"],
    "control": ["må få kontroll", "må sjekke", "må tenke", "må fikse", "må roe ned"],
    "appease": ["må skjerpe meg", "må virke rolig", "ikke vise", "please", "tilpasse meg"],
}

QUESTION_TEMPLATES = {
    "situation_when": "Hva pleier å skje rett før uroen kommer i denne situasjonen?",
    "situation_pattern": "Er dette mest noe som skjer i en bestemt type situasjon, eller mer generelt?",
    "body_signal": "Hva er det tydeligste kroppslige signalet når dette skjer?",
    "body_location": "Hvor i kroppen merker du det tydeligst?",
    "body_escalation": "Hva skjer videre i kroppen når det først starter?",    "discomfort_meaning": "Hva i dette kjennes mest ubehagelig å være med?",
    "for_against_cost": "Hva prøver du å slippe ved å reagere slik?",
    "for_against_function": "Hva får du mest lyst til å gjøre når det skjer?",    "willingness_edge": "Hva virker mulig å være litt mer villig til å kjenne, uten å presse deg?",
    "exploration_small_shift": "Hvis du ikke skulle gå rett i automatreaksjonen, hva kunne et lite annet steg vært?",
    "practice_commitment": "Hva ville vært et lite, realistisk steg i mindre unngående retning neste gang?",
    "reactive_pattern": "Hva pleier du å gjøre når det blir sånn?",
}

FALLBACK_PRACTICE = (
    "Neste gang uroen kommer, legg merke til det første kroppssignalet og bli hos det i to rolige pust "
    "før du gjør det vanlige unngåelsessteget."
)


def merge_summary(existing: str | None, addition: str | None, *, max_length: int = 320) -> str:
    current = str(existing or "").strip()
    new_text = str(addition or "").strip()
    if not new_text:
        return current
    if new_text.lower() in current.lower():
        return current
    merged = f"{current} {new_text}".strip() if current else new_text
    if len(merged) <= max_length:
        return merged
    return merged[-max_length:]


def detect_context_timing(user_message: str) -> str | None:
    text = (user_message or "").lower()
    if any(token in text for token in ["nå", "akkurat nå", "right now", "i dette øyeblikket"]):
        return "now"
    if any(token in text for token in ["når", "hver gang", "ofte", "pleier", "vanligvis"]):
        return "general"
    if any(token in text for token in ["da", "under", "mens", "i går", "sist"]):
        return "during"
    return None


def extract_signals(user_message: str) -> dict[str, Any]:
    text = (user_message or "").strip()
    lower = text.lower()
    tokens = re.findall(r"\w+", lower)

    locations = [word for word in LOCATION_WORDS if word in lower]
    qualities = [word for word in BODY_QUALITY_WORDS if word in lower]
    escalation = [word for word in ESCALATION_WORDS if word in lower]
    low_information = lower in LOW_INFORMATION_RESPONSES or len(tokens) <= 2
    unknown = "vet ikke" in lower or "usikker" in lower or "aner ikke" in lower
    body_signal = bool(locations or qualities or "kropp" in lower or "hjertet" in lower)

    return {
        "locations": locations,
        "qualities": qualities,
        "escalation_markers": escalation,
        "mentions_body_signal": body_signal,
        "mentions_discomfort": any(word in lower for word in DISCOMFORT_WORDS),
        "low_information": low_information,
        "unknown_description": unknown,
        "mentions_avoidance": any(
            phrase in lower
            for phrase in ["unngå", "komme meg bort", "slippe", "være hjemme", "gå ut", "flykte"]
        ),
        "mentions_willingness": any(
            phrase in lower for phrase in ["kan tåle", "villig", "klare å stå i", "bli i det"]
        ),
        "raw_excerpt": text[:180],
    }


def compute_covered_flags(state: dict[str, Any]) -> dict[str, bool]:
    signals = dict(state.get("extracted_signals") or {})
    reactive_pattern = str(state.get("reactive_pattern") or "").strip()

    return {
        "situation": bool(state.get("situation_summary")),
        "body_signal": bool(signals.get("body_signal_text") or signals.get("mentions_body_signal")),
        "body_location": bool(signals.get("locations")),
        "body_quality": bool(signals.get("qualities")),
        "escalation": bool(signals.get("escalation_markers") or signals.get("escalation_text")),
        "discomfort": bool(state.get("discomfort_summary")) or bool(signals.get("mentions_discomfort")),
        "for_against": bool(state.get("for_against_summary")),
        "willingness": bool(state.get("willingness_summary") or signals.get("mentions_willingness")),
        "exploration": bool(state.get("exploration_summary")),
        "reactive_pattern": bool(reactive_pattern),
        "practice_direction": bool(state.get("practice_direction")),
    }


def infer_reactive_pattern(state: dict[str, Any], user_message: str) -> str:
    text = " ".join(
        [
            str(user_message or ""),
            str(state.get("situation_summary") or ""),
            str(state.get("body_summary") or ""),
            str(state.get("discomfort_summary") or ""),
            str(state.get("for_against_summary") or ""),
        ]
    ).lower()

    for pattern_name, phrases in REACTIVE_PATTERNS.items():
        if any(phrase in text for phrase in phrases):
            return pattern_name
        if "må gå ut" in text or "vil gå ut" in text or "må komme meg ut" in text:
            return "escape"
    return str(state.get("reactive_pattern") or "")


def ready_for_practice(state: dict[str, Any]) -> bool:
    flags = dict(state.get("covered_flags") or {})
    body_clear = (
        flags.get("body_signal")
        and flags.get("escalation")
        and flags.get("reactive_pattern")
    )
    return bool(
        flags.get("situation")
        and body_clear
        and flags.get("discomfort")
        and (flags.get("willingness") or flags.get("exploration"))
    )


def next_phase(phase: str) -> str:
    if phase not in PHASES:
        return PHASES[0]
    index = PHASES.index(phase)
    if index >= len(PHASES) - 1:
        return PHASES[-1]
    return PHASES[index + 1]


def should_progress_phase(state: dict[str, Any]) -> bool:
    phase = str(state.get("phase") or PHASES[0])
    count = int(state.get("phase_question_count") or 0)
    flags = dict(state.get("covered_flags") or {})
    signals = dict(state.get("extracted_signals") or {})

    if state.get("needs_external_support"):
        return False

    if phase == "situation":
        return flags.get("situation") or count >= 2
    if phase == "body":
        if flags.get("body_signal") and flags.get("reactive_pattern"):
            return True
        if flags.get("body_signal") and (flags.get("body_location") or flags.get("body_quality")) and flags.get("escalation"):
            return True
        if signals.get("unknown_description") or signals.get("low_information"):
            return count >= 1
        return count >= 2
    if phase == "discomfort":
        return flags.get("discomfort") or count >= 2
    if phase == "for_against":
        return flags.get("for_against") or count >= 2
    if phase == "willingness":
        return flags.get("willingness") or count >= 2
    if phase == "exploration":
        return flags.get("exploration") or ready_for_practice(state) or count >= 2
    return False


def maybe_advance_phase(state: dict[str, Any]) -> dict[str, Any]:
    while state.get("phase") != "practice" and should_progress_phase(state):
        state["phase"] = next_phase(str(state.get("phase") or PHASES[0]))
        state["phase_question_count"] = 0

    if ready_for_practice(state):
        state["can_generate_practice"] = True
        if state.get("phase") in {"exploration", "practice"}:
            state["phase"] = "practice"
            state["phase_question_count"] = 0
    return state


def pick_question_type(state: dict[str, Any]) -> str:
    phase = str(state.get("phase") or PHASES[0])
    flags = dict(state.get("covered_flags") or {})
    signals = dict(state.get("extracted_signals") or {})
    last_question_type = str(state.get("last_question_type") or "")
    context_timing = str(state.get("context_timing") or "")

    candidates: list[str]
    if phase == "situation":
        candidates = ["situation_when", "situation_pattern"]
    elif phase == "body":
        if flags.get("reactive_pattern"):
            return "discomfort_meaning"
        if flags.get("body_signal") and flags.get("escalation"):
            return "discomfort_meaning"
        if not flags.get("body_signal"):
            candidates = ["body_signal"]
        elif not flags.get("body_location") and not signals.get("unknown_description"):
            candidates = ["body_location"]
        elif not flags.get("body_quality") and not signals.get("unknown_description"):
            candidates = ["body_signal"]
        else:
            return "discomfort_meaning"
    elif phase == "discomfort":
        candidates = ["discomfort_meaning"]
    elif phase == "for_against":
        candidates = ["for_against_cost", "for_against_function"]
    elif phase == "willingness":
        candidates = ["willingness_edge"]
    elif phase == "exploration":
        candidates = ["exploration_small_shift"]
    else:
        candidates = ["practice_commitment"]

    for candidate in candidates:
        if candidate != last_question_type:
            if context_timing not in {"now", "during"} and candidate == "body_signal":
                return "body_signal"
            return candidate
    return candidates[0]


def detect_need_for_external_support(user_message: str) -> bool:
    lower = (user_message or "").lower()
    return any(re.search(pattern, lower) for pattern in RISK_PATTERNS)


def build_supportive_boundary_response() -> str:
    return (
        "Det du beskriver høres så belastende ut at denne chatten ikke er riktig sted å stå alene i det. "
        "Ta kontakt med noen nær deg eller legevakt/akutt hjelp nå hvis det er fare for at du kan skade deg selv."
    )


def _format_topic_config(topic_config: dict[str, Any] | None) -> str:
    if not topic_config:
        return ""
    compact = {
        "title": topic_config.get("title"),
        "micro_instructions": topic_config.get("micro_instructions") or {},
        "constraints": topic_config.get("constraints") or {},
        "safety_rules": topic_config.get("safety_rules") or {},
    }
    return json.dumps(compact, ensure_ascii=False)


def _llm_turn(
    *,
    conversation_id: str,
    phase: str,
    question_type: str,
    state: dict[str, Any],
    topic_config: dict[str, Any] | None,
    mode: str,
) -> tuple[str, int, int]:
    system_prompt = (
        "Du er ASHO. Jobben din er avgrenset: hjelp brukeren å legge merke til hva som skjer i kroppen "
        "når ubehag eller uro kommer.\n"
        "Skriv på norsk, enkelt og kort.\n"
        "Still høyst ett kort spørsmål.\n"
        "Ikke gi råd, løsninger, trøst, pusteteknikker, grounding, forklaringer eller analyse før praksisfasen.\n"
        "Ikke gjenta samme informasjonsbehov i ny ordlyd.\n"
        "Hvis brukeren beskriver tanker eller forklaringer, led oppmerksomheten rolig tilbake til det som merkes.\n"
        "Snakk ikke som om alt skjer akkurat nå hvis konteksten er generell eller fra tidligere.\n"
        "I praksisfasen: gi ett lite, konkret, realistisk steg i mindre unngående retning.\n"
        "Svar kun med selve teksten til brukeren."
    )

    prompt_payload = {
        "mode": mode,
        "phase": phase,
        "question_type": question_type,
        "context_timing": state.get("context_timing"),
        "covered_flags": state.get("covered_flags"),
        "reactive_pattern": state.get("reactive_pattern"),
        "situation_summary": state.get("situation_summary"),
        "body_summary": state.get("body_summary"),
        "discomfort_summary": state.get("discomfort_summary"),
        "for_against_summary": state.get("for_against_summary"),
        "willingness_summary": state.get("willingness_summary"),
        "exploration_summary": state.get("exploration_summary"),
        "practice_direction": state.get("practice_direction"),
        "suggested_template": QUESTION_TEMPLATES.get(question_type, ""),
        "topic_config": _format_topic_config(topic_config),
    }

    user_prompt = (
        "Lag neste ASHO-svar ut fra denne tilstanden. "
        "Hvis mode er question: still ett kort spørsmål. "
        "Hvis mode er practice: skriv ett kort forslag til øvelse/steg, ikke flere. "
        "Hvis mode er redirect: bekreft kort og led tilbake til kroppslig registrering uten å hjelpe.\n\n"
        + json.dumps(prompt_payload, ensure_ascii=False)
    )

    return chat_with_history_with_system(
        session_id=conversation_id,
        history=[],
        user_message=user_prompt,
        system_prompt=system_prompt,
        temperature=0.3,
    )


def generate_practice_task(
    state: dict[str, Any],
    topic_config: dict[str, Any] | None = None,
) -> tuple[str, int, int]:
    reply, output_tokens, prompt_tokens = _llm_turn(
        conversation_id=str(state.get("conversation_id") or ""),
        phase="practice",
        question_type="practice_commitment",
        state=state,
        topic_config=topic_config,
        mode="practice",
    )
    clean = (reply or "").strip()
    if not clean:
        clean = FALLBACK_PRACTICE
        output_tokens = count_tokens(clean, model=settings.MODEL_NAME)
    return clean, output_tokens, prompt_tokens


def update_state_from_user_message(
    state: dict[str, Any],
    user_message: str,
    user_message_id: str,
) -> dict[str, Any]:
    phase = str(state.get("phase") or PHASES[0])
    signals = dict(state.get("extracted_signals") or {})
    new_signals = extract_signals(user_message)

    merged_signals = {
        "locations": list(dict.fromkeys(list(signals.get("locations") or []) + list(new_signals.get("locations") or []))),
        "qualities": list(dict.fromkeys(list(signals.get("qualities") or []) + list(new_signals.get("qualities") or []))),
        "escalation_markers": list(
            dict.fromkeys(list(signals.get("escalation_markers") or []) + list(new_signals.get("escalation_markers") or []))
        ),
        "mentions_body_signal": bool(signals.get("mentions_body_signal") or new_signals.get("mentions_body_signal")),
        "low_information": bool(new_signals.get("low_information")),
        "unknown_description": bool(new_signals.get("unknown_description")),
        "mentions_willingness": bool(signals.get("mentions_willingness") or new_signals.get("mentions_willingness")),
        "mentions_avoidance": bool(signals.get("mentions_avoidance") or new_signals.get("mentions_avoidance")),
        "last_excerpt": new_signals.get("raw_excerpt") or signals.get("last_excerpt"),
    }

    if merged_signals["mentions_body_signal"] and not signals.get("body_signal_text"):
        merged_signals["body_signal_text"] = new_signals.get("raw_excerpt")
    elif signals.get("body_signal_text"):
        merged_signals["body_signal_text"] = signals.get("body_signal_text")

    if merged_signals["escalation_markers"] and not signals.get("escalation_text"):
        merged_signals["escalation_text"] = new_signals.get("raw_excerpt")
    elif signals.get("escalation_text"):
        merged_signals["escalation_text"] = signals.get("escalation_text")

    state["extracted_signals"] = merged_signals
    state["context_timing"] = detect_context_timing(user_message) or state.get("context_timing")
    state["reactive_pattern"] = infer_reactive_pattern(state, user_message)
    state["last_user_message_id"] = user_message_id
    state["total_turn_count"] = int(state.get("total_turn_count") or 0) + 1
    state["needs_external_support"] = detect_need_for_external_support(user_message)

    if phase == "situation":
        state["situation_summary"] = merge_summary(state.get("situation_summary"), new_signals.get("raw_excerpt"))
    elif phase == "body":
        state["body_summary"] = merge_summary(state.get("body_summary"), new_signals.get("raw_excerpt"))
    elif phase == "discomfort":
        state["discomfort_summary"] = merge_summary(state.get("discomfort_summary"), new_signals.get("raw_excerpt"))
    elif phase == "for_against":
        state["for_against_summary"] = merge_summary(state.get("for_against_summary"), new_signals.get("raw_excerpt"))
    elif phase == "willingness":
        state["willingness_summary"] = merge_summary(state.get("willingness_summary"), new_signals.get("raw_excerpt"))
    elif phase in {"exploration", "practice"}:
        state["exploration_summary"] = merge_summary(state.get("exploration_summary"), new_signals.get("raw_excerpt"))

    if state.get("reactive_pattern") and not state.get("practice_direction"):
        state["practice_direction"] = (
            "bli litt lenger i det første kroppssignalet før du går i automatisk unngåelse"
            if state["reactive_pattern"] == "escape"
            else "legge merke til signalet uten å gå helt inn i automatreaksjonen"
        )

    state["covered_flags"] = compute_covered_flags(state)
    state["can_generate_practice"] = ready_for_practice(state)
    return state


def handle_asho_turn(
    state: dict[str, Any],
    user_message: str,
    user_message_id: str,
    topic_config: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    state = update_state_from_user_message(dict(state), user_message, user_message_id)

    if state.get("needs_external_support"):
        reply = build_supportive_boundary_response()
        state["_asho_output_tokens"] = count_tokens(reply, model=settings.MODEL_NAME)
        state["_asho_prompt_tokens"] = 0
        return reply, state

    state = maybe_advance_phase(state)

    if state.get("phase") == "practice" and state.get("can_generate_practice"):
        reply, output_tokens, prompt_tokens = generate_practice_task(state, topic_config)
        state["generated_practice_text"] = reply
        state["last_question_type"] = "practice_commitment"
        state["last_question_text"] = reply
        state["_asho_output_tokens"] = output_tokens
        state["_asho_prompt_tokens"] = prompt_tokens
        return reply, state

    question_type = pick_question_type(state)
    mode = "redirect" if question_type == "body_signal" and not state.get("context_timing") else "question"
    clean_reply = QUESTION_TEMPLATES.get(question_type, "Hva merker du?")
    output_tokens = count_tokens(clean_reply, model=settings.MODEL_NAME)
    prompt_tokens = 0
    state["phase_question_count"] = int(state.get("phase_question_count") or 0) + 1
    state["last_question_type"] = question_type
    state["last_question_text"] = clean_reply
    state["_asho_output_tokens"] = output_tokens or count_tokens(clean_reply, model=settings.MODEL_NAME)
    state["_asho_prompt_tokens"] = prompt_tokens
    return clean_reply, state
