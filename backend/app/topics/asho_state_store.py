from __future__ import annotations

import json
from typing import Any, Dict

import psycopg


DEFAULT_TOPIC_KEY = "asho_uroguide"
JSON_FIELDS = {"covered_flags", "extracted_signals"}
STATE_FIELDS = (
    "conversation_id",
    "topic_key",
    "phase",
    "phase_question_count",
    "total_turn_count",
    "context_timing",
    "situation_summary",
    "body_summary",
    "discomfort_summary",
    "for_against_summary",
    "willingness_summary",
    "exploration_summary",
    "reactive_pattern",
    "practice_direction",
    "generated_practice_text",
    "covered_flags",
    "extracted_signals",
    "last_question_type",
    "last_question_text",
    "last_user_message_id",
    "last_assistant_message_id",
    "can_generate_practice",
    "needs_external_support",
)


def _normalize_state(row: tuple[Any, ...] | None) -> dict[str, Any] | None:
    if not row:
        return None

    state: dict[str, Any] = {}
    for idx, field in enumerate(STATE_FIELDS):
        value = row[idx]
        if field in JSON_FIELDS:
            state[field] = dict(value or {})
        else:
            state[field] = value
    return state


def _default_state(conversation_id: str, topic_key: str = DEFAULT_TOPIC_KEY) -> dict[str, Any]:
    return {
        "conversation_id": conversation_id,
        "topic_key": topic_key,
        "phase": "situation",
        "phase_question_count": 0,
        "total_turn_count": 0,
        "context_timing": "unknown",
        "situation_summary": "",
        "body_summary": "",
        "discomfort_summary": "",
        "for_against_summary": "",
        "willingness_summary": "",
        "exploration_summary": "",
        "reactive_pattern": "",
        "practice_direction": "",
        "generated_practice_text": "",
        "covered_flags": {},
        "extracted_signals": {},
        "last_question_type": None,
        "last_question_text": None,
        "last_user_message_id": None,
        "last_assistant_message_id": None,
        "can_generate_practice": False,
        "needs_external_support": False,
    }


def get_asho_state(
    conn: psycopg.Connection,
    conversation_id: str,
) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              conversation_id,
              topic_key,
              phase,
              phase_question_count,
              total_turn_count,
              context_timing,
              situation_summary,
              body_summary,
              discomfort_summary,
              for_against_summary,
              willingness_summary,
              exploration_summary,
              reactive_pattern,
              practice_direction,
              generated_practice_text,
              covered_flags,
              extracted_signals,
              last_question_type,
              last_question_text,
              last_user_message_id,
              last_assistant_message_id,
              can_generate_practice,
              needs_external_support
            FROM asho_conversation_state
            WHERE conversation_id = %s
            """,
            (conversation_id,),
        )
        return _normalize_state(cur.fetchone())


def create_asho_state(
    conn: psycopg.Connection,
    conversation_id: str,
    topic_key: str = DEFAULT_TOPIC_KEY,
) -> dict[str, Any]:
    state = _default_state(conversation_id, topic_key)
    save_asho_state(conn, state)
    return state


def get_or_create_asho_state(
    conn: psycopg.Connection,
    conversation_id: str,
    topic_key: str = DEFAULT_TOPIC_KEY,
) -> dict[str, Any]:
    state = get_asho_state(conn, conversation_id)
    if state is not None:
        return state
    return create_asho_state(conn, conversation_id, topic_key)


def save_asho_state(conn: psycopg.Connection, state: Dict[str, Any]) -> None:
    payload = _default_state(
        conversation_id=str(state["conversation_id"]),
        topic_key=str(state.get("topic_key") or DEFAULT_TOPIC_KEY),
    )
    payload.update(state)
    payload["covered_flags"] = dict(payload.get("covered_flags") or {})
    payload["extracted_signals"] = dict(payload.get("extracted_signals") or {})
    payload["phase_question_count"] = int(payload.get("phase_question_count") or 0)
    payload["total_turn_count"] = int(payload.get("total_turn_count") or 0)
    payload["can_generate_practice"] = bool(payload.get("can_generate_practice"))
    payload["needs_external_support"] = bool(payload.get("needs_external_support"))

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO asho_conversation_state (
              conversation_id,
              topic_key,
              phase,
              phase_question_count,
              total_turn_count,
              context_timing,
              situation_summary,
              body_summary,
              discomfort_summary,
              for_against_summary,
              willingness_summary,
              exploration_summary,
              reactive_pattern,
              practice_direction,
              generated_practice_text,
              covered_flags,
              extracted_signals,
              last_question_type,
              last_question_text,
              last_user_message_id,
              last_assistant_message_id,
              can_generate_practice,
              needs_external_support,
              updated_at
            )
            VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, NOW()
            )
            ON CONFLICT (conversation_id)
            DO UPDATE SET
              topic_key = EXCLUDED.topic_key,
              phase = EXCLUDED.phase,
              phase_question_count = EXCLUDED.phase_question_count,
              total_turn_count = EXCLUDED.total_turn_count,
              context_timing = EXCLUDED.context_timing,
              situation_summary = EXCLUDED.situation_summary,
              body_summary = EXCLUDED.body_summary,
              discomfort_summary = EXCLUDED.discomfort_summary,
              for_against_summary = EXCLUDED.for_against_summary,
              willingness_summary = EXCLUDED.willingness_summary,
              exploration_summary = EXCLUDED.exploration_summary,
              reactive_pattern = EXCLUDED.reactive_pattern,
              practice_direction = EXCLUDED.practice_direction,
              generated_practice_text = EXCLUDED.generated_practice_text,
              covered_flags = EXCLUDED.covered_flags,
              extracted_signals = EXCLUDED.extracted_signals,
              last_question_type = EXCLUDED.last_question_type,
              last_question_text = EXCLUDED.last_question_text,
              last_user_message_id = EXCLUDED.last_user_message_id,
              last_assistant_message_id = EXCLUDED.last_assistant_message_id,
              can_generate_practice = EXCLUDED.can_generate_practice,
              needs_external_support = EXCLUDED.needs_external_support,
              updated_at = NOW()
            """,
            (
                payload["conversation_id"],
                payload["topic_key"],
                payload["phase"],
                payload["phase_question_count"],
                payload["total_turn_count"],
                payload["context_timing"],
                payload["situation_summary"],
                payload["body_summary"],
                payload["discomfort_summary"],
                payload["for_against_summary"],
                payload["willingness_summary"],
                payload["exploration_summary"],
                payload["reactive_pattern"],
                payload["practice_direction"],
                payload["generated_practice_text"],
                json.dumps(payload["covered_flags"], ensure_ascii=False),
                json.dumps(payload["extracted_signals"], ensure_ascii=False),
                payload["last_question_type"],
                payload["last_question_text"],
                payload["last_user_message_id"],
                payload["last_assistant_message_id"],
                payload["can_generate_practice"],
                payload["needs_external_support"],
            ),
        )


def delete_asho_state(conn: psycopg.Connection, conversation_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM asho_conversation_state
            WHERE conversation_id = %s
            """,
            (conversation_id,),
        )
