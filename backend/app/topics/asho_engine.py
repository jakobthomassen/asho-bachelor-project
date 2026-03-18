from __future__ import annotations

import json
import re
from typing import Any

from app.core.config import settings
from app.services.llm_client import SYSTEM_PROMPT
from app.services.llm_client import _run_chat_completion

PHASES = [
    "situation",
    "body",
    "discomfort",
    "for_against",
    "willingness",
    "exploration",
    "practice",
]

RISK_PATTERNS = [
    r"\b(selvmord|suicid|ta livet|vil dø|ønsker å dø)\b",
    r"\b(skade meg selv|skade meg sjøl|self harm|cut myself)\b",
    r"\b(ikke trygg|unsafe|kan ikke være alene)\b",
]

QUESTION_TEXT = {
    "situation_now": "Hva skjer akkurat nå som trigger uroen mest?",
    "situation_past": "Hva var situasjonen da uroen ble tydelig?",
    "body": "Hva merket du i kroppen i den situasjonen?",
    "discomfort": "Hva ved dette kjennes mest ubehagelig eller vanskelig?",
    "for_against": "Hva trekker deg mot reaksjonen din, og hva taler imot den?",
    "willingness": "Hva kjennes du villig til å møte litt mer direkte akkurat her?",
    "exploration": "Hva legger du merke til om mønsteret ditt når dette skjer?",
}


def merge_summary(current: str, addition: str, max_len: int = 280) -> str:
    current_clean = str(current or "").strip()
    addition_clean = str(addition or "").strip()
    if not addition_clean:
        return current_clean
    if not current_clean:
        return addition_clean[:max_len]
    if addition_clean.lower() in current_clean.lower():
        return current_clean[:max_len]
    merged = f"{current_clean} {addition_clean}".strip()
    return merged[:max_len]


def detect_context_timing(user_message: str) -> str:
    text = str(user_message or "").lower()
    if re.search(r"\b(nå|akkurat nå|i dag|med en gang)\b", text):
        return "now"
    if re.search(r"\b(mens|under|i møtet|på jobb|i timen)\b", text):
        return "during"
    if re.search(r"\b(da|etterpå|senere|i går|forrige|tidligere)\b", text):
        return "past"
    return "unknown"


def extract_signals(user_message: str) -> dict[str, Any]:
    text = str(user_message or "").strip()
    lowered = text.lower()
    signals: dict[str, Any] = {
        "has_body_signal": bool(re.search(r"\b(kropp|bryst|mage|hjerte|pust|spenning|trykk|svimmel|kvalm|rist|skjelv)\b", lowered)),
        "has_discomfort_signal": bool(re.search(r"\b(ubehag|vanskelig|skummelt|flaut|pinlig|redd|uro|angst|stress)\b", lowered)),
        "has_avoidance_signal": bool(re.search(r"\b(unngå|slippe|komme meg bort|trekke meg|avlyse|utsette)\b", lowered)),
        "has_willingness_signal": bool(re.search(r"\b(villig|kan prøve|klarer kanskje|tåler litt|kan stå i)\b", lowered)),
        "references_now": detect_context_timing(text) in {"now", "during"},
        "message_length": len(text),
    }
    snippets: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        sentence = sentence.strip()
        if len(sentence) >= 12:
            snippets.append(sentence[:160])
        if len(snippets) >= 2:
            break
    if snippets:
        signals["snippets"] = snippets
    return signals


def compute_covered_flags(state: dict[str, Any]) -> dict[str, bool]:
    signals = dict(state.get("extracted_signals") or {})
    return {
        "situation": bool(state.get("situation_summary")),
        "body": bool(state.get("body_summary")) or bool(signals.get("has_body_signal")),
        "discomfort": bool(state.get("discomfort_summary")) or bool(signals.get("has_discomfort_signal")),
        "for_against": bool(state.get("for_against_summary")) or bool(signals.get("has_avoidance_signal")),
        "willingness": bool(state.get("willingness_summary")) or bool(signals.get("has_willingness_signal")),
        "exploration": bool(state.get("exploration_summary")) or bool(state.get("reactive_pattern")),
        "practice": bool(state.get("generated_practice_text")),
    }


def infer_reactive_pattern(state: dict[str, Any]) -> str:
    text = " ".join(
        str(part or "")
        for part in [
            state.get("situation_summary"),
            state.get("for_against_summary"),
            state.get("exploration_summary"),
        ]
    ).lower()
    if re.search(r"\b(unngå|trekke meg|slippe|avlyse|utsette)\b", text):
        return "avoidance"
    if re.search(r"\b(kontroll|sjekke|forsikre|tenke gjennom alt)\b", text):
        return "control"
    if re.search(r"\b(stivne|låse|bli helt stille)\b", text):
        return "freeze"
    return state.get("reactive_pattern") or ""


def ready_for_practice(state: dict[str, Any]) -> bool:
    covered = compute_covered_flags(state)
    required = ["situation", "body", "discomfort", "for_against", "willingness", "exploration"]
    return all(covered.get(key) for key in required) and not state.get("needs_external_support")


def next_phase(phase: str) -> str:
    try:
        idx = PHASES.index(phase)
    except ValueError:
        return PHASES[0]
    if idx >= len(PHASES) - 1:
        return PHASES[-1]
    return PHASES[idx + 1]


def should_progress_phase(state: dict[str, Any], current_phase: str, user_message: str) -> bool:
    flags = compute_covered_flags(state)
    text = str(user_message or "").strip()
    if current_phase == "practice":
        return False
    if flags.get(current_phase):
        return True
    if len(text) >= 40 and state.get("phase_question_count", 0) >= 1:
        return True
    if state.get("phase_question_count", 0) >= 2:
        return True
    return False


def maybe_advance_phase(state: dict[str, Any], user_message: str) -> dict[str, Any]:
    current_phase = str(state.get("phase") or PHASES[0])
    if should_progress_phase(state, current_phase, user_message):
        new_phase = next_phase(current_phase)
        if new_phase != current_phase:
            state["phase"] = new_phase
            state["phase_question_count"] = 0
    if ready_for_practice(state):
        state["phase"] = "practice"
        state["can_generate_practice"] = True
    return state


def pick_question_type(state: dict[str, Any]) -> str:
    phase = str(state.get("phase") or PHASES[0])
    context_timing = state.get("context_timing") or "unknown"
    if phase == "situation":
        candidate = "situation_now" if context_timing in {"now", "during"} else "situation_past"
    else:
        candidate = phase
    if state.get("last_question_type") == candidate:
        return next_phase(phase) if phase != "practice" else "practice"
    return candidate


def detect_need_for_external_support(user_message: str) -> bool:
    lowered = str(user_message or "").lower()
    return any(re.search(pattern, lowered) for pattern in RISK_PATTERNS)


def build_supportive_boundary_response() -> str:
    return (
        "Dette virker mer alvorlig enn det jeg bør håndtere i chat. "
        "Ta kontakt med noen nær deg eller lokal akutt hjelp nå hvis du ikke er trygg."
    )


def _extract_snippet(user_message: str) -> str:
    snippets = extract_signals(user_message).get("snippets") or []
    if snippets:
        return str(snippets[0])
    return str(user_message or "").strip()[:180]


def update_state_from_user_message(
    state: dict[str, Any],
    user_message: str,
    user_message_id: str,
) -> dict[str, Any]:
    state["total_turn_count"] = int(state.get("total_turn_count") or 0) + 1
    state["last_user_message_id"] = user_message_id
    timing = detect_context_timing(user_message)
    if timing != "unknown":
        state["context_timing"] = timing

    incoming_signals = extract_signals(user_message)
    merged_signals = dict(state.get("extracted_signals") or {})
    merged_signals.update(incoming_signals)
    state["extracted_signals"] = merged_signals

    snippet = _extract_snippet(user_message)
    phase = str(state.get("phase") or PHASES[0])
    summary_field = f"{phase}_summary"
    if summary_field in state and snippet:
        state[summary_field] = merge_summary(state.get(summary_field, ""), snippet)

    if not state.get("situation_summary"):
        state["situation_summary"] = snippet
    if incoming_signals.get("has_body_signal"):
        state["body_summary"] = merge_summary(state.get("body_summary", ""), snippet)
    if incoming_signals.get("has_discomfort_signal"):
        state["discomfort_summary"] = merge_summary(state.get("discomfort_summary", ""), snippet)
    if incoming_signals.get("has_avoidance_signal"):
        state["for_against_summary"] = merge_summary(state.get("for_against_summary", ""), snippet)
    if incoming_signals.get("has_willingness_signal"):
        state["willingness_summary"] = merge_summary(state.get("willingness_summary", ""), snippet)

    state["reactive_pattern"] = infer_reactive_pattern(state)
    state["covered_flags"] = compute_covered_flags(state)
    state["needs_external_support"] = detect_need_for_external_support(user_message)
    state["can_generate_practice"] = ready_for_practice(state)
    return state


def _brief_reflection(state: dict[str, Any]) -> str:
    phase = str(state.get("phase") or "")
    snippets = state.get("extracted_signals", {}).get("snippets") or []
    lead = str(snippets[0]) if snippets else ""
    if phase == "practice":
        return "Det gir et tydeligere bilde."
    if not lead:
        return ""
    return f"Det høres ut som: {lead[:120]}"


def _question_for_type(question_type: str) -> str:
    if question_type in QUESTION_TEXT:
        return QUESTION_TEXT[question_type]
    return "Hva er det viktigste å få tydeligere fram her?"


def build_asho_framework_prompt(
    state: dict[str, Any],
    user_message: str,
    topic_config: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    state = update_state_from_user_message(state, user_message, state.get("last_user_message_id") or "")
    if state.get("needs_external_support"):
        prompt = (
            "ASHO-ramme for denne turen:\n"
            "- Meldingen inneholder mulig risiko eller behov for støtte utenfor chat.\n"
            "- Ikke fortsett vanlig utforsking.\n"
            "- Svar kort, støttende og avgrensende.\n"
            "- Oppfordre rolig til kontakt med nær person eller lokal akutt hjelp hvis brukeren ikke er trygg."
        )
        return prompt, state

    state = maybe_advance_phase(state, user_message)
    question_type = pick_question_type(state)
    question = _question_for_type(question_type)
    reflection = _brief_reflection(state)

    timing_rule = (
        "Situasjonen ser ut til å skje nå eller underveis; du kan formulere deg i presens."
        if state.get("context_timing") in {"now", "during"}
        else "Ikke skriv som om situasjonen skjer akkurat nå hvis bruker beskriver noe tidligere eller generelt."
    )

    covered = state.get("covered_flags") or {}
    active_topic = str((topic_config or {}).get("topic_key") or "").strip()
    topic_system_prompt = str((topic_config or {}).get("system_prompt") or "").strip()
    topic_constraints = (topic_config or {}).get("constraints") or {}
    topic_micro = (topic_config or {}).get("micro_instructions") or {}

    lines = [
        "ASHO-ramme for denne turen:",
        f"- Aktiv fase: {state.get('phase') or 'situation'}",
        "- Følg rekkefølgen: situation -> body -> discomfort -> for_against -> willingness -> exploration -> practice.",
        "- Maks ett kort spørsmål i denne turen.",
        "- Ikke gjenta samme spørsmålstype med ny ordlyd.",
        "- Hvis body eller discomfort allerede er tydelig, gå videre.",
        f"- {timing_rule}",
        "- Før practice: ikke gi løsninger, pusteteknikker, grounding, reassurance eller generiske råd.",
    ]
    if reflection:
        lines.append(f"- Kort refleksjon er lov: {reflection}")
    lines.append(f"- Neste naturlige fokus nå: {question_type}")
    lines.append(f"- Hvis du trenger et spørsmål, bruk denne retningen: {question}")
    lines.append(
        "- Dekkede felt så langt: "
        + ", ".join([key for key, value in covered.items() if value]) if covered else "- Dekkede felt så langt: none"
    )
    if active_topic:
        lines.append(f"- Aktiv topic-spesialisering: {active_topic}")
    if topic_system_prompt:
        lines.append("- Tema-spesifikk instruksjon: " + topic_system_prompt.replace("\n", " ")[:400])
    if topic_micro or topic_constraints:
        lines.append(
            "- Tema-tillegg: "
            + json.dumps(
                {
                    "micro_instructions": topic_micro,
                    "constraints": topic_constraints,
                },
                ensure_ascii=False,
            )[:500]
        )

    state["phase_question_count"] = int(state.get("phase_question_count") or 0) + 1
    state["last_question_type"] = question_type
    state["last_question_text"] = question
    return "\n".join(lines), state


def _build_style_system_prompt(topic_config: dict[str, Any] | None = None) -> str:
    topic_config = topic_config or {}
    base_prompt = str(topic_config.get("base_prompt") or SYSTEM_PROMPT).strip()
    sections = [
        base_prompt,
        (
            "Du svarer gjennom ASHO-rammen. "
            "Hold svaret kort, nøkternt og strukturert. "
            "Still ett fokusert spørsmål om gangen. "
            "Ikke gi løsninger, pusteteknikker, grounding eller generell beroligelse før praksisfasen."
        ),
    ]
    topic_key = str(topic_config.get("topic_key") or "").strip()
    system_prompt = str(topic_config.get("system_prompt") or "").strip()
    constraints = topic_config.get("constraints") or {}
    micro_instructions = topic_config.get("micro_instructions") or {}
    if topic_key:
        sections.append(f"Aktiv spesialisering: {topic_key}")
    if system_prompt:
        sections.append("Tema-spesifikk instruksjon:\n" + system_prompt)
    if micro_instructions or constraints:
        sections.append(
            "Tema-spesifikke tillegg:\n"
            + json.dumps(
                {
                    "micro_instructions": micro_instructions,
                    "constraints": constraints,
                },
                ensure_ascii=False,
            )
        )
    return "\n\n".join([section for section in sections if section])


def _render_structured_turn(
    state: dict[str, Any],
    reflection: str,
    question: str,
    question_type: str,
    topic_config: dict[str, Any] | None = None,
    session_id: str | None = None,
) -> str:
    fallback = f"{reflection} {question}".strip() if reflection else question
    if not session_id:
        return fallback

    payload = {
        "phase": state.get("phase"),
        "question_type": question_type,
        "context_timing": state.get("context_timing"),
        "reflection": reflection,
        "question": question,
        "covered_flags": state.get("covered_flags") or {},
        "last_question_type": state.get("last_question_type"),
        "last_question_text": state.get("last_question_text"),
        "summaries": {
            "situation": state.get("situation_summary"),
            "body": state.get("body_summary"),
            "discomfort": state.get("discomfort_summary"),
            "for_against": state.get("for_against_summary"),
            "willingness": state.get("willingness_summary"),
            "exploration": state.get("exploration_summary"),
        },
    }
    messages = [
        {"role": "system", "content": _build_style_system_prompt(topic_config)},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    try:
        text, _, _ = _run_chat_completion(
            session_id=session_id,
            messages=messages,
            stage="chat",
            temperature=0.25,
            max_tokens=min(120, settings.MAX_OUTPUT_TOKENS),
        )
        clean = str(text or "").strip()
        return clean or fallback
    except Exception:
        return fallback


def generate_practice_task(
    state: dict[str, Any],
    topic_config: dict[str, Any] | None = None,
    session_id: str | None = None,
) -> str:
    direction = state.get("practice_direction") or state.get("reactive_pattern") or "avoidance"
    fallback = (
        "Neste steg: velg én liten handling i den aktuelle situasjonen som er litt mindre unnvikende enn vanlig."
    )
    if not session_id:
        return fallback

    prompt_payload = {
        "topic_key": state.get("topic_key") or "asho_uroguide",
        "phase": state.get("phase"),
        "context_timing": state.get("context_timing"),
        "situation_summary": state.get("situation_summary"),
        "body_summary": state.get("body_summary"),
        "discomfort_summary": state.get("discomfort_summary"),
        "for_against_summary": state.get("for_against_summary"),
        "willingness_summary": state.get("willingness_summary"),
        "exploration_summary": state.get("exploration_summary"),
        "reactive_pattern": state.get("reactive_pattern"),
        "practice_direction": direction,
        "topic_constraints": (topic_config or {}).get("constraints") or {},
    }
    messages = [
        {
            "role": "system",
            "content": (
                _build_style_system_prompt(topic_config)
                + "\n\n"
                + "Du er i praksisfasen. "
                "Lag ett kort, konkret neste steg. "
                "Ikke bruk pusteteknikker, grounding, generell trygging eller terapeutisk språk. "
                "Steget skal være realistisk, lite og mindre unngående enn brukerens vanlige mønster."
            ),
        },
        {"role": "user", "content": json.dumps(prompt_payload, ensure_ascii=False)},
    ]
    try:
        text, _, _ = _run_chat_completion(
            session_id=session_id,
            messages=messages,
            stage="chat",
            temperature=0.2,
            max_tokens=min(140, settings.MAX_OUTPUT_TOKENS),
        )
        clean = str(text or "").strip()
        return clean or fallback
    except Exception:
        return fallback


def handle_asho_turn(
    state: dict[str, Any],
    user_message: str,
    user_message_id: str,
    topic_config: dict[str, Any] | None = None,
    session_id: str | None = None,
) -> tuple[str, dict[str, Any]]:
    state = update_state_from_user_message(state, user_message, user_message_id)
    if state.get("needs_external_support"):
        reply = build_supportive_boundary_response()
        state["last_question_type"] = "external_support"
        state["last_question_text"] = reply
        return reply, state

    state = maybe_advance_phase(state, user_message)
    reflection = _brief_reflection(state)

    if state.get("phase") == "practice":
        practice_text = generate_practice_task(state, topic_config=topic_config, session_id=session_id)
        state["generated_practice_text"] = practice_text
        state["practice_direction"] = state.get("reactive_pattern") or state.get("practice_direction") or "less_avoidance"
        state["last_question_type"] = "practice"
        state["last_question_text"] = practice_text
        prefix = f"{reflection} " if reflection else ""
        return f"{prefix}{practice_text}".strip(), state

    question_type = pick_question_type(state)
    question = _question_for_type(question_type)
    if question_type == "body" and state.get("covered_flags", {}).get("body"):
        state["phase"] = "discomfort"
        question_type = "discomfort"
        question = _question_for_type(question_type)
    if question_type == "discomfort" and state.get("covered_flags", {}).get("discomfort"):
        state["phase"] = "for_against"
        question_type = "for_against"
        question = _question_for_type(question_type)

    reply = _render_structured_turn(
        state,
        reflection,
        question,
        question_type,
        topic_config=topic_config,
        session_id=session_id,
    )
    state["phase_question_count"] = int(state.get("phase_question_count") or 0) + 1
    state["last_question_type"] = question_type
    state["last_question_text"] = question
    return reply, state
