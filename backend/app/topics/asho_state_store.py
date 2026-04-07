from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import psycopg

from app.core.config import settings

DEFAULT_TOPIC_KEY = "asho_uroguide"
TABLE_NAME = "asho_conversation_state"

DEFAULT_STATE: dict[str, Any] = {
    "conversation_id": "",
    "topic_key": DEFAULT_TOPIC_KEY,
    "phase": "situation",
    "phase_question_count": 0,
    "total_turn_count": 0,
    "context_timing": "general",
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
    "covered_subtopics": {},
    "used_question_angles": [],
}

JSON_LIKE_COLUMNS = {
    "covered_flags",
    "extracted_signals",
    "covered_subtopics",
    "used_question_angles",
}
SYSTEM_COLUMNS = {"created_at", "updated_at"}


def _connect() -> psycopg.Connection:
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required for ASHO state persistence")
    return psycopg.connect(settings.DATABASE_URL)


@lru_cache(maxsize=1)
def _table_columns() -> tuple[dict[str, str], set[str]]:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
                """,
                (TABLE_NAME,),
            )
            rows = cur.fetchall() or []

    columns = {str(name): str(data_type) for name, data_type in rows}
    json_columns = {
        name for name, data_type in columns.items() if data_type in {"json", "jsonb"}
    }
    return columns, json_columns


def _normalize_state(raw_state: dict[str, Any] | None) -> dict[str, Any] | None:
    if raw_state is None:
        return None

    merged = dict(DEFAULT_STATE)
    merged.update(raw_state)
    merged["conversation_id"] = str(merged.get("conversation_id") or "")
    merged["topic_key"] = str(merged.get("topic_key") or DEFAULT_TOPIC_KEY)
    merged["phase"] = str(merged.get("phase") or "situation")
    merged["phase_question_count"] = int(merged.get("phase_question_count") or 0)
    merged["total_turn_count"] = int(merged.get("total_turn_count") or 0)
    merged["covered_flags"] = dict(merged.get("covered_flags") or {})
    merged["extracted_signals"] = dict(merged.get("extracted_signals") or {})
    merged["can_generate_practice"] = bool(merged.get("can_generate_practice"))
    merged["needs_external_support"] = bool(merged.get("needs_external_support"))
    merged["context_timing"] = str(merged.get("context_timing") or "general")
    merged["covered_subtopics"] = dict(merged.get("covered_subtopics") or {})
    merged["used_question_angles"] = list(merged.get("used_question_angles") or [])
    return merged


def get_asho_state(conversation_id: str) -> dict[str, Any] | None:
    columns, _ = _table_columns()
    selectable_columns = [name for name in DEFAULT_STATE if name in columns]
    if "conversation_id" not in selectable_columns:
        return None

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT {", ".join(selectable_columns)}
                FROM {TABLE_NAME}
                WHERE conversation_id = %s
                """,
                (conversation_id,),
            )
            row = cur.fetchone()

    if not row:
        return None

    state = dict(zip(selectable_columns, row))
    return _normalize_state(state)


def create_asho_state(
    conversation_id: str,
    topic_key: str = DEFAULT_TOPIC_KEY,
) -> dict[str, Any]:
    state = dict(DEFAULT_STATE)
    state["conversation_id"] = conversation_id
    state["topic_key"] = topic_key or DEFAULT_TOPIC_KEY
    save_asho_state(state)
    return _normalize_state(state) or dict(DEFAULT_STATE)


def get_or_create_asho_state(
    conversation_id: str,
    topic_key: str = DEFAULT_TOPIC_KEY,
) -> dict[str, Any]:
    existing = get_asho_state(conversation_id)
    if existing is not None:
        return existing
    return create_asho_state(conversation_id=conversation_id, topic_key=topic_key)


def save_asho_state(state: dict[str, Any]) -> None:
    normalized = _normalize_state(state)
    if normalized is None:
        raise ValueError("ASHO state cannot be empty")

    columns, json_columns = _table_columns()
    write_columns = [
        name
        for name in DEFAULT_STATE
        if name in columns and name not in SYSTEM_COLUMNS
    ]
    if "conversation_id" not in write_columns:
        raise RuntimeError(
            "asho_conversation_state is missing conversation_id; "
            "the runtime schema does not match the expected store contract."
        )

    insert_values: list[Any] = []
    insert_placeholders: list[str] = []
    update_assignments: list[str] = []

    for name in write_columns:
        value = normalized.get(name)
        if name in json_columns or name in JSON_LIKE_COLUMNS:
            value = json.dumps(value or {})
            placeholder = "%s::jsonb"
        else:
            placeholder = "%s"
        insert_values.append(value)
        insert_placeholders.append(placeholder)
        if name != "conversation_id":
            update_assignments.append(f"{name} = EXCLUDED.{name}")

    if "updated_at" in columns:
        update_assignments.append("updated_at = NOW()")

    conflict_action = (
        "DO UPDATE SET " + ", ".join(update_assignments)
        if update_assignments
        else "DO NOTHING"
    )

    with _connect() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    INSERT INTO {TABLE_NAME} ({", ".join(write_columns)})
                    VALUES ({", ".join(insert_placeholders)})
                    ON CONFLICT (conversation_id)
                    {conflict_action}
                    """,
                    tuple(insert_values),
                )


def delete_asho_state(conversation_id: str) -> None:
    with _connect() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    f"DELETE FROM {TABLE_NAME} WHERE conversation_id = %s",
                    (conversation_id,),
                )
