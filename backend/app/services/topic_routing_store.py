from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import psycopg


@dataclass(frozen=True)
class TopicConfigRow:
    topic_key: str
    title: str
    classifier_description: str
    classifier_keywords: List[str]
    classifier_exclude_keywords: List[str]
    system_prompt: str
    micro_instructions: Dict[str, Any]
    constraints: Dict[str, Any]
    pacing_rules: Dict[str, Any]
    reclassify_rules: Dict[str, Any]
    safety_rules: Dict[str, Any]
    min_confidence: float
    reclassify_turn_threshold: int
    max_clarifying_questions: int


@dataclass(frozen=True)
class ConversationTopicStateRow:
    conversation_id: str
    current_topic_key: Optional[str]
    route_mode: str
    last_confidence: Optional[float]
    turns_since_classify: int
    turns_in_default: int
    clarifying_questions_asked: int


def fetch_active_topic_configs(conn: psycopg.Connection) -> List[TopicConfigRow]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              t.topic_key,
              t.title,
              v.classifier_description,
              v.classifier_keywords,
              v.classifier_exclude_keywords,
              v.system_prompt,
              v.micro_instructions,
              v.constraints,
              v.pacing_rules,
              v.reclassify_rules,
              v.safety_rules,
              v.min_confidence,
              v.reclassify_turn_threshold,
              v.max_clarifying_questions
            FROM topic_catalog t
            JOIN topic_config_versions v ON v.topic_key = t.topic_key
            WHERE t.is_active = TRUE
              AND v.is_current = TRUE
            ORDER BY t.topic_key
            """
        )
        rows = cur.fetchall() or []

    topics: List[TopicConfigRow] = []
    for (
        topic_key,
        title,
        classifier_description,
        classifier_keywords,
        classifier_exclude_keywords,
        system_prompt,
        micro_instructions,
        constraints,
        pacing_rules,
        reclassify_rules,
        safety_rules,
        min_confidence,
        reclassify_turn_threshold,
        max_clarifying_questions,
    ) in rows:
        topics.append(
            TopicConfigRow(
                topic_key=str(topic_key),
                title=str(title),
                classifier_description=str(classifier_description),
                classifier_keywords=list(classifier_keywords or []),
                classifier_exclude_keywords=list(classifier_exclude_keywords or []),
                system_prompt=str(system_prompt),
                micro_instructions=dict(micro_instructions or {}),
                constraints=dict(constraints or {}),
                pacing_rules=dict(pacing_rules or {}),
                reclassify_rules=dict(reclassify_rules or {}),
                safety_rules=dict(safety_rules or {}),
                min_confidence=float(min_confidence),
                reclassify_turn_threshold=int(reclassify_turn_threshold),
                max_clarifying_questions=int(max_clarifying_questions),
            )
        )
    return topics


def get_conversation_topic_state(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
) -> Optional[ConversationTopicStateRow]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              conversation_id,
              current_topic_key,
              route_mode,
              last_confidence,
              turns_since_classify,
              turns_in_default,
              clarifying_questions_asked
            FROM conversation_topic_state
            WHERE conversation_id = %s
            """,
            (conversation_id,),
        )
        row = cur.fetchone()

    if not row:
        return None

    return ConversationTopicStateRow(
        conversation_id=str(row[0]),
        current_topic_key=str(row[1]) if row[1] is not None else None,
        route_mode=str(row[2]),
        last_confidence=float(row[3]) if row[3] is not None else None,
        turns_since_classify=int(row[4]),
        turns_in_default=int(row[5]),
        clarifying_questions_asked=int(row[6]),
    )


def upsert_conversation_topic_state(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    current_topic_key: Optional[str],
    route_mode: str,
    last_confidence: Optional[float],
    turns_since_classify: int,
    turns_in_default: int,
    clarifying_questions_asked: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO conversation_topic_state (
              conversation_id,
              current_topic_key,
              route_mode,
              last_confidence,
              turns_since_classify,
              turns_in_default,
              clarifying_questions_asked,
              updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (conversation_id)
            DO UPDATE SET
              current_topic_key = EXCLUDED.current_topic_key,
              route_mode = EXCLUDED.route_mode,
              last_confidence = EXCLUDED.last_confidence,
              turns_since_classify = EXCLUDED.turns_since_classify,
              turns_in_default = EXCLUDED.turns_in_default,
              clarifying_questions_asked = EXCLUDED.clarifying_questions_asked,
              updated_at = NOW()
            """,
            (
                conversation_id,
                current_topic_key,
                route_mode,
                last_confidence,
                int(turns_since_classify),
                int(turns_in_default),
                int(clarifying_questions_asked),
            ),
        )


def insert_topic_routing_event(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    message_id: str,
    event_type: str,
    selected_topic_key: Optional[str],
    confidence: Optional[float],
    reason: Optional[str],
    classifier_payload: Optional[Dict[str, Any]],
) -> None:
    payload_json = json.dumps(classifier_payload) if classifier_payload is not None else None
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO topic_routing_events (
              conversation_id,
              message_id,
              event_type,
              selected_topic_key,
              confidence,
              reason,
              classifier_payload
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (conversation_id, message_id, event_type)
            DO NOTHING
            """,
            (
                conversation_id,
                message_id,
                event_type,
                selected_topic_key,
                confidence,
                reason,
                payload_json,
            ),
        )
