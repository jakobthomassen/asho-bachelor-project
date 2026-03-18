from __future__ import annotations

import json
import re
from typing import Any

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

PHASE_SUMMARY_FIELD = {
    "situation": "situation_summary",
    "body": "body_summary",
    "discomfort": "discomfort_summary",
    "for_against": "for_against_summary",
    "willingness": "willingness_summary",
    "exploration": "exploration_summary",
}


def merge_summary(current: str, addition: str, max_len: int = 220) -> str:
    current_clean = str(current or "").strip()
    addition_clean = str(addition or "").strip()
    if not addition_clean:
        return current_clean
    if not current_clean:
        return addition_clean[:max_len]
    if addition_clean.lower() in current_clean.lower():
        return current_clean[:max_len]
    return f"{current_clean} {addition_clean}".strip()[:max_len]


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
    snippets: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        sentence = sentence.strip()
        if len(sentence) >= 12:
            snippets.append(sentence[:140])
        if len(snippets) >= 2:
            break
    return {
        "has_body_signal": bool(re.search(r"\b(kropp|bryst|mage|hjerte|pust|spenning|trykk|svimmel|kvalm|rist|skjelv)\b", lowered)),
        "has_discomfort_signal": bool(re.search(r"\b(ubehag|vanskelig|skummelt|flaut|pinlig|redd|uro|angst|stress)\b", lowered)),
        "has_avoidance_signal": bool(re.search(r"\b(unngå|slippe|komme meg bort|trekke meg|avlyse|utsette)\b", lowered)),
        "has_willingness_signal": bool(re.search(r"\b(villig|kan prøve|klarer kanskje|tåler litt|kan stå i)\b", lowered)),
        "references_now": detect_context_timing(text) in {"now", "during"},
        "message_length": len(text),
        "snippets": snippets,
    }


def _is_substantial(text: str, min_len: int = 18) -> bool:
    return len(str(text or "").strip()) >= min_len


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
    return str(state.get("reactive_pattern") or "")


def _phase_resolved_flag(phase: str) -> str:
    return f"{phase}_resolved"


def compute_covered_flags(state: dict[str, Any]) -> dict[str, bool]:
    existing = dict(state.get("covered_flags") or {})
    signals = dict(state.get("extracted_signals") or {})
    situation = _is_substantial(str(state.get("situation_summary") or ""), 24)
    body = _is_substantial(str(state.get("body_summary") or ""), 12) or bool(signals.get("has_body_signal"))
    discomfort = _is_substantial(str(state.get("discomfort_summary") or ""), 12) or bool(signals.get("has_discomfort_signal"))
    for_against = _is_substantial(str(state.get("for_against_summary") or ""), 16) or bool(signals.get("has_avoidance_signal"))
    willingness = _is_substantial(str(state.get("willingness_summary") or ""), 10) or bool(signals.get("has_willingness_signal"))
    reactive_pattern_identified = bool(state.get("reactive_pattern"))
    exploration = _is_substantial(str(state.get("exploration_summary") or ""), 16) or reactive_pattern_identified
    validated = bool(existing.get("validated")) or bool(state.get("last_question_text"))
    covered = {
        "situation": situation,
        "body": body,
        "discomfort": discomfort,
        "for_against": for_against,
        "willingness": willingness,
        "exploration": exploration,
        "practice": bool(state.get("generated_practice_text")),
        "situation_understood": situation,
        "body_contact": body,
        "reactive_pattern_identified": reactive_pattern_identified,
        "validated": validated,
    }
    for phase in ("situation", "body", "discomfort", "for_against", "willingness", "exploration"):
        covered[_phase_resolved_flag(phase)] = bool(existing.get(_phase_resolved_flag(phase)))
    return covered


def ready_for_practice(state: dict[str, Any]) -> bool:
    covered = compute_covered_flags(state)
    required = [
        _phase_resolved_flag("situation"),
        _phase_resolved_flag("body"),
        _phase_resolved_flag("discomfort"),
        _phase_resolved_flag("for_against"),
        _phase_resolved_flag("willingness"),
        _phase_resolved_flag("exploration"),
        "validated",
    ]
    return all(covered.get(key) for key in required) and not state.get("needs_external_support")


def next_phase(phase: str) -> str:
    try:
        idx = PHASES.index(phase)
    except ValueError:
        return PHASES[0]
    return PHASES[min(idx + 1, len(PHASES) - 1)]


def _phase_summary(state: dict[str, Any], phase: str) -> str:
    field = PHASE_SUMMARY_FIELD.get(phase)
    return str(state.get(field) or "").strip()


def _heuristic_phase_resolved(state: dict[str, Any], phase: str) -> bool:
    flags = compute_covered_flags(state)
    mapping = {
        "situation": flags.get("situation_understood"),
        "body": flags.get("body_contact"),
        "discomfort": flags.get("discomfort"),
        "for_against": flags.get("for_against"),
        "willingness": flags.get("willingness"),
        "exploration": flags.get("reactive_pattern_identified") or flags.get("exploration"),
    }
    return bool(mapping.get(phase))


def _evaluate_active_phase(
    state: dict[str, Any],
    user_message: str,
    phase: str,
    *,
    session_id: str | None = None,
) -> tuple[bool, str]:
    summary = _phase_summary(state, phase)
    if not session_id:
        return _heuristic_phase_resolved(state, phase), ""
    if not summary and not _heuristic_phase_resolved(state, phase):
        return False, ""

    payload = {
        "phase": phase,
        "summary": summary[:160],
        "last_user_message": str(user_message or "").strip()[:220],
        "reactive_pattern": str(state.get("reactive_pattern") or "")[:80],
    }
    messages = [
        {
            "role": "system",
            "content": (
                "Vurder kun om aktiv ASHO-fase er avklart nok til å gå videre. "
                "Svar kun med JSON: {\"resolved\": true|false, \"missing\": \"kort tekst\"}. "
                "Bruk false hvis fasen fortsatt er vag eller bare delvis besvart."
            ),
        },
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    try:
        raw, _, _ = _run_chat_completion(
            session_id=session_id,
            messages=messages,
            stage="classifier",
            temperature=0.0,
            max_tokens=40,
        )
        parsed = json.loads(raw)
        resolved = bool(parsed.get("resolved"))
        missing = str(parsed.get("missing") or "").strip()[:80]
        return resolved, missing
    except Exception:
        return _heuristic_phase_resolved(state, phase), ""


def should_progress_phase(
    state: dict[str, Any],
    current_phase: str,
    user_message: str,
    *,
    session_id: str | None = None,
) -> bool:
    phase_question_count = int(state.get("phase_question_count") or 0)
    text_len = len(str(user_message or "").strip())
    if current_phase == "practice":
        return False
    if phase_question_count <= 0:
        return False

    resolved, missing = _evaluate_active_phase(
        state,
        user_message,
        current_phase,
        session_id=session_id,
    )
    flags = compute_covered_flags(state)
    flags[_phase_resolved_flag(current_phase)] = resolved
    if missing:
        flags[f"{current_phase}_missing"] = missing
    state["covered_flags"] = flags

    if resolved:
        return True
    if phase_question_count >= 2:
        return True
    if text_len >= 120 and phase_question_count >= 1:
        return True
    return False


def maybe_advance_phase(
    state: dict[str, Any],
    user_message: str,
    *,
    session_id: str | None = None,
) -> dict[str, Any]:
    current_phase = str(state.get("phase") or PHASES[0])
    if should_progress_phase(state, current_phase, user_message, session_id=session_id):
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
    if state.get("last_question_type") == candidate and phase != "practice":
        return next_phase(phase)
    return candidate


def detect_need_for_external_support(user_message: str) -> bool:
    lowered = str(user_message or "").lower()
    return any(re.search(pattern, lowered) for pattern in RISK_PATTERNS)


def build_supportive_boundary_response() -> str:
    return "Dette virker mer alvorlig enn det jeg bør håndtere i chat. Ta kontakt med noen nær deg eller lokal akutt hjelp nå hvis du ikke er trygg."


def _extract_snippet(user_message: str) -> str:
    snippets = extract_signals(user_message).get("snippets") or []
    if snippets:
        return str(snippets[0])
    return str(user_message or "").strip()[:140]


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
    summary_field = PHASE_SUMMARY_FIELD.get(phase)
    if summary_field and snippet:
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
    snippets = state.get("extracted_signals", {}).get("snippets") or []
    return f"Det høres ut som: {snippets[0][:100]}" if snippets else ""


def _question_for_type(question_type: str) -> str:
    return QUESTION_TEXT.get(question_type, "Hva er det viktigste å få tydeligere fram her?")


def _practice_situation_anchor(state: dict[str, Any]) -> str:
    for key in ("situation_summary", "exploration_summary", "discomfort_summary"):
        value = str(state.get(key) or "").strip()
        if value:
            return value[:160]
    return "brukerens faktiske situasjon"


def _practice_module_instructions(state: dict[str, Any], topic_config: dict[str, Any] | None = None) -> str:
    anchor = _practice_situation_anchor(state)
    topic_key = str((topic_config or {}).get("topic_key") or "").strip()
    lines = [
        "Praksisoppgave, ikke råd.",
        f"Situasjon: {anchor}",
        "Struktur: situasjon, forkant, underveis, normalisering, etterkant, ny atferd.",
        "Kroppsnært, utforskende, varmt, ikke generisk.",
    ]
    if topic_key:
        lines.append(f"Topic: {topic_key}")
    return "\n".join(lines)


def build_asho_framework_prompt(
    state: dict[str, Any],
    user_message: str,
    topic_config: dict[str, Any] | None = None,
    *,
    session_id: str | None = None,
) -> tuple[str, dict[str, Any]]:
    state = update_state_from_user_message(state, user_message, state.get("last_user_message_id") or "")
    if state.get("needs_external_support"):
        return "Risiko. Kort støttende avgrensning. Anbefal støtte utenfor chat.", state

    state = maybe_advance_phase(state, user_message, session_id=session_id)
    question_type = pick_question_type(state)
    question = _question_for_type(question_type)
    reflection = _brief_reflection(state)
    covered = state.get("covered_flags") or {}
    done_fields = ",".join(
        key
        for key in ("situation", "body", "discomfort", "for_against", "willingness", "exploration")
        if covered.get(key)
    ) or "none"
    timing_rule = "Bruk presens." if state.get("context_timing") in {"now", "during"} else "Ikke skriv som om det skjer nå."

    lines = [
        f"ASHO fase={state.get('phase') or 'situation'} fokus={question_type}",
        f"Dekket={done_fields}",
        "Ett kort spørsmål. Ingen råd før practice.",
        "Ikke gjenta samme spørsmålstype.",
        timing_rule,
    ]
    missing = str(covered.get(f"{state.get('phase')}_missing") or "").strip()
    if missing:
        lines.append(f"Mangler: {missing}")
    if reflection:
        lines.append(f"Refleksjon: {reflection}")
    lines.append(f"Spørsmål: {question}")

    topic_key = str((topic_config or {}).get("topic_key") or "").strip()
    topic_system_prompt = str((topic_config or {}).get("system_prompt") or "").strip()
    if topic_key:
        lines.append(f"Topic: {topic_key}")
    if topic_system_prompt:
        lines.append("Tema: " + topic_system_prompt.replace("\n", " ")[:140])
    if state.get("phase") == "practice":
        lines.append("Avslutt med situasjonstilpasset arbeidsoppgave.")
        lines.append(_practice_module_instructions(state, topic_config))

    state["phase_question_count"] = int(state.get("phase_question_count") or 0) + 1
    state["last_question_type"] = question_type
    state["last_question_text"] = question
    state["covered_flags"] = compute_covered_flags(state) | {
        key: value for key, value in covered.items() if key.endswith("_resolved") or key.endswith("_missing")
    }
    return "\n".join(lines), state


def generate_practice_task(
    state: dict[str, Any],
    topic_config: dict[str, Any] | None = None,
    session_id: str | None = None,
) -> str:
    anchor = _practice_situation_anchor(state)
    return (
        f"Neste gang i situasjonen «{anchor}»: stopp opp litt før, legg merke til hva som allerede er aktivert i kroppen, "
        "og se hva som skjer i kroppen mens du går inn i situasjonen. Hvis mønsteret tar over, er det ikke feil, bare noe å registrere. "
        "Når det er over, kom tilbake til kroppen og merk hva som fortsatt er der. Legg merke til om det oppstår litt mer rom for en mindre unnvikende respons."
    )[:420]


def handle_asho_turn(
    state: dict[str, Any],
    user_message: str,
    user_message_id: str,
    topic_config: dict[str, Any] | None = None,
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
        practice_text = generate_practice_task(state, topic_config=topic_config)
        state["generated_practice_text"] = practice_text
        state["practice_direction"] = state.get("reactive_pattern") or state.get("practice_direction") or "less_avoidance"
        state["last_question_type"] = "practice"
        state["last_question_text"] = practice_text
        return (f"{reflection} {practice_text}".strip(), state) if reflection else (practice_text, state)

    question_type = pick_question_type(state)
    question = _question_for_type(question_type)
    state["phase_question_count"] = int(state.get("phase_question_count") or 0) + 1
    state["last_question_type"] = question_type
    state["last_question_text"] = question
    return (f"{reflection} {question}".strip(), state) if reflection else (question, state)
