from __future__ import annotations
import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
import psycopg

from app.core.config import settings
from app.schemas.topic_dashboard import (
    TopicDashboardCreateRequest,
    TopicDashboardDailyTokens,
    TopicDashboardListResponse,
    TopicDashboardStatsResponse,
    TopicDashboardTopic,
    TopicDashboardUpdateRequest,
    SecurityRejectionItem,
    SecurityRejectionListResponse,
)
from app.services.app_config_store import fetch_app_config, upsert_app_config
from app.services.google_auth import get_session_principal, parse_bearer_token
from app.services.llm_client import create_text_embedding

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for topic dashboard")


def _require_admin(conn: psycopg.Connection, authorization: str | None) -> str:
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=401, detail="Missing session token")
    principal = get_session_principal(conn, session_token)
    if not principal:
        raise HTTPException(status_code=401, detail="Invalid session token")
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return principal.user_id


def _row_to_topic(row: tuple[Any, ...]) -> TopicDashboardTopic:
    return TopicDashboardTopic(
        topic_key=str(row[0]),
        title=str(row[1]),
        version_no=int(row[2]),
        is_current=bool(row[3]),
        classifier_description=str(row[4]),
        classifier_embedding=[float(x) for x in row[5]] if row[5] is not None else None,
        system_prompt=str(row[6]),
        micro_instructions=dict(row[7] or {}),
        constraints=dict(row[8] or {}),
        reclassify_rules=dict(row[9] or {}),
        safety_rules=dict(row[10] or {}),
        min_confidence=float(row[11]),
        reclassify_turn_threshold=int(row[12]),
        max_clarifying_questions=int(row[13]),
        updated_at=row[14] if len(row) > 14 else None,
    )


@router.get("/topic-dashboard/topics", response_model=TopicDashboardListResponse)
def list_topics(authorization: str | None = Header(default=None)):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_admin(conn, authorization)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      t.topic_key,
                      t.title,
                      v.version_no,
                      v.is_current,
                      v.classifier_description,
                      v.classifier_embedding,
                      v.system_prompt,
                      v.micro_instructions,
                      v.constraints,
                      v.reclassify_rules,
                      v.safety_rules,
                      v.min_confidence,
                      v.reclassify_turn_threshold,
                      v.max_clarifying_questions,
                      t.updated_at
                    FROM topic_catalog t
                    JOIN topic_config_versions v ON v.topic_key = t.topic_key
                    WHERE v.is_current = TRUE
                    ORDER BY t.updated_at DESC NULLS LAST
                    """
                )
                rows = cur.fetchall() or []

            return {"topics": [_row_to_topic(row) for row in rows]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topic-dashboard/stats", response_model=TopicDashboardStatsResponse)
def topic_dashboard_stats(
    days: int = Query(default=7, ge=1, le=90),
    authorization: str | None = Header(default=None),
):
    input_price_per_million = 4.0
    output_price_per_million = 16.0

    def _estimated_cost_usd(input_tokens: int, output_tokens: int) -> float:
        return (float(input_tokens) / 1_000_000.0) * input_price_per_million + (
            float(output_tokens) / 1_000_000.0
        ) * output_price_per_million

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_admin(conn, authorization)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      COUNT(DISTINCT user_id) AS total_unique_users,
                      COUNT(*) AS total_conversations
                    FROM conversations
                    """
                )
                row = cur.fetchone() or (0, 0)
                total_unique_users = int(row[0] or 0)
                total_conversations = int(row[1] or 0)
                avg_conversations_per_user = (
                    (float(total_conversations) / float(total_unique_users))
                    if total_unique_users > 0
                    else 0.0
                )

                cur.execute(
                    """
                    WITH per_conversation AS (
                      SELECT
                        c.id,
                        COUNT(m.id) AS message_count
                      FROM conversations c
                      LEFT JOIN chat_messages m ON m.conversation_id = c.id
                      GROUP BY c.id
                    )
                    SELECT COALESCE(AVG(message_count::float), 0)
                    FROM per_conversation
                    """
                )
                avg_len_row = cur.fetchone() or (0.0,)
                avg_conversation_length_messages = float(avg_len_row[0] or 0.0)

                cur.execute(
                    """
                    WITH days AS (
                      SELECT generate_series(
                        CURRENT_DATE - (%s::int - 1),
                        CURRENT_DATE,
                        INTERVAL '1 day'
                      )::date AS day
                    ),
                    totals AS (
                      SELECT event_date::date AS day, SUM(total_tokens)::bigint AS total_tokens
                      FROM daily_token_usage
                      WHERE event_date >= CURRENT_DATE - (%s::int - 1)
                      GROUP BY event_date::date
                    )
                    SELECT d.day, COALESCE(t.total_tokens, 0) AS total_tokens
                    FROM days d
                    LEFT JOIN totals t ON t.day = d.day
                    ORDER BY d.day ASC
                    """,
                    (days, days),
                )
                token_rows = cur.fetchall() or []

                cur.execute(
                    """
                    SELECT
                      COALESCE(SUM(input_tokens), 0) AS input_tokens,
                      COALESCE(SUM(output_tokens + classifier_tokens + title_tokens), 0) AS output_tokens
                    FROM daily_token_usage
                    WHERE event_date >= date_trunc('month', CURRENT_DATE)::date
                    """
                )
                month_row = cur.fetchone() or (0, 0)
                monthly_input_tokens = int(month_row[0] or 0)
                monthly_output_tokens = int(month_row[1] or 0)

                cur.execute(
                    """
                    SELECT
                      COALESCE(SUM(input_tokens), 0) AS input_tokens,
                      COALESCE(SUM(output_tokens + classifier_tokens + title_tokens), 0) AS output_tokens
                    FROM daily_token_usage
                    """
                )
                total_row = cur.fetchone() or (0, 0)
                total_input_tokens = int(total_row[0] or 0)
                total_output_tokens = int(total_row[1] or 0)

            daily_tokens = [
                TopicDashboardDailyTokens(day=str(day), total_tokens=int(total_tokens or 0))
                for day, total_tokens in token_rows
            ]

            return TopicDashboardStatsResponse(
                total_unique_users=total_unique_users,
                total_conversations=total_conversations,
                avg_conversations_per_user=round(avg_conversations_per_user, 2),
                avg_conversation_length_messages=round(avg_conversation_length_messages, 2),
                monthly_estimated_token_cost_usd=round(
                    _estimated_cost_usd(monthly_input_tokens, monthly_output_tokens), 6
                ),
                total_estimated_token_cost_usd=round(
                    _estimated_cost_usd(total_input_tokens, total_output_tokens), 6
                ),
                daily_tokens=daily_tokens,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/topic-dashboard/topics", response_model=TopicDashboardTopic)
def create_topic(
    payload: TopicDashboardCreateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_admin(conn, authorization)

            clean_topic_key = (payload.topic_key or "").strip()
            if not clean_topic_key:
                raise HTTPException(status_code=400, detail="Invalid topic key")

            clean_title = payload.title.strip()
            clean_classifier_description = payload.classifier_description.strip()
            clean_system_prompt = payload.system_prompt.strip()
            clean_created_by = (payload.created_by or "dashboard").strip()[:120] or "dashboard"

            if not clean_title or not clean_classifier_description or not clean_system_prompt:
                raise HTTPException(status_code=400, detail="Missing required fields")

            micro_instructions_json = json.dumps(payload.micro_instructions or {})
            constraints_json = json.dumps(payload.constraints or {})
            reclassify_rules_json = json.dumps(payload.reclassify_rules or {})
            safety_rules_json = json.dumps(payload.safety_rules or {})

            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT 1 FROM topic_catalog WHERE topic_key = %s",
                        (clean_topic_key,),
                    )
                    if cur.fetchone() is not None:
                        raise HTTPException(status_code=409, detail="Topic key already exists")

                    cur.execute(
                        "INSERT INTO topic_catalog (topic_key, title) VALUES (%s, %s)",
                        (clean_topic_key, clean_title),
                    )

                    cur.execute(
                        """
                        INSERT INTO topic_config_versions (
                          topic_key, version_no, is_current,
                          classifier_description, classifier_embedding,
                          system_prompt, micro_instructions, constraints,
                          reclassify_rules, safety_rules,
                          min_confidence, reclassify_turn_threshold,
                          max_clarifying_questions, created_by
                        )
                        VALUES (%s, 1, TRUE, %s, NULL, %s, %s::jsonb, %s::jsonb,
                                %s::jsonb, %s::jsonb, %s, %s, %s, %s)
                        """,
                        (
                            clean_topic_key,
                            clean_classifier_description,
                            clean_system_prompt,
                            micro_instructions_json,
                            constraints_json,
                            reclassify_rules_json,
                            safety_rules_json,
                            payload.min_confidence,
                            payload.reclassify_turn_threshold,
                            payload.max_clarifying_questions,
                            clean_created_by,
                        ),
                    )

                    cur.execute(
                        """
                        SELECT
                          t.topic_key, t.title, v.version_no, v.is_current,
                          v.classifier_description, v.classifier_embedding,
                          v.system_prompt, v.micro_instructions, v.constraints,
                          v.reclassify_rules, v.safety_rules,
                          v.min_confidence, v.reclassify_turn_threshold,
                          v.max_clarifying_questions
                        FROM topic_catalog t
                        JOIN topic_config_versions v ON v.topic_key = t.topic_key
                        WHERE t.topic_key = %s AND v.version_no = 1
                        """,
                        (clean_topic_key,),
                    )
                    row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=500, detail="Failed to create topic")

            return _row_to_topic(row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/topic-dashboard/topics/{topic_key}/versions", response_model=TopicDashboardTopic)
def create_topic_version(
    topic_key: str,
    payload: TopicDashboardUpdateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_admin(conn, authorization)

            clean_topic_key = (topic_key or "").strip()
            if not clean_topic_key:
                raise HTTPException(status_code=400, detail="Invalid topic key")

            clean_title = payload.title.strip()
            clean_classifier_description = payload.classifier_description.strip()
            clean_system_prompt = payload.system_prompt.strip()
            clean_created_by = (payload.created_by or "dashboard").strip()[:120] or "dashboard"
            if not clean_title or not clean_classifier_description or not clean_system_prompt:
                raise HTTPException(status_code=400, detail="Missing required fields")

            micro_instructions_json = json.dumps(payload.micro_instructions or {})
            constraints_json = json.dumps(payload.constraints or {})
            reclassify_rules_json = json.dumps(payload.reclassify_rules or {})
            safety_rules_json = json.dumps(payload.safety_rules or {})

            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT 1
                        FROM topic_catalog
                        WHERE topic_key = %s
                        """,
                        (clean_topic_key,),
                    )
                    if cur.fetchone() is None:
                        raise HTTPException(status_code=404, detail="Topic not found")

                    # Lock version rows for this topic to avoid duplicate version numbers.
                    cur.execute(
                        """
                        SELECT version_no
                        FROM topic_config_versions
                        WHERE topic_key = %s
                        FOR UPDATE
                        """,
                        (clean_topic_key,),
                    )
                    version_rows = cur.fetchall() or []
                    current_max_version = max([int(r[0]) for r in version_rows], default=0)
                    next_version = current_max_version + 1

                    cur.execute(
                        """
                        UPDATE topic_catalog
                        SET title = %s,
                            updated_at = NOW()
                        WHERE topic_key = %s
                        """,
                        (clean_title, clean_topic_key),
                    )

                    cur.execute(
                        """
                        UPDATE topic_config_versions
                        SET is_current = FALSE
                        WHERE topic_key = %s
                          AND is_current = TRUE
                        """,
                        (clean_topic_key,),
                    )

                    cur.execute(
                        """
                        INSERT INTO topic_config_versions (
                          topic_key,
                          version_no,
                          is_current,
                          classifier_description,
                          classifier_embedding,
                          system_prompt,
                          micro_instructions,
                          constraints,
                          reclassify_rules,
                          safety_rules,
                          min_confidence,
                          reclassify_turn_threshold,
                          max_clarifying_questions,
                          created_by
                        )
                        VALUES (
                          %s, %s, TRUE, %s, NULL, %s, %s::jsonb, %s::jsonb,
                          %s::jsonb, %s::jsonb, %s, %s, %s, %s
                        )
                        """,
                        (
                          clean_topic_key,
                          next_version,
                          clean_classifier_description,
                          clean_system_prompt,
                          micro_instructions_json,
                          constraints_json,
                          reclassify_rules_json,
                          safety_rules_json,
                          payload.min_confidence,
                          payload.reclassify_turn_threshold,
                          payload.max_clarifying_questions,
                          clean_created_by,
                        ),
                    )
                    cur.execute(
                        """
                        SELECT
                          t.topic_key,
                          t.title,
                          v.version_no,
                          v.is_current,
                          v.classifier_description,
                          v.classifier_embedding,
                          v.system_prompt,
                          v.micro_instructions,
                          v.constraints,
                          v.reclassify_rules,
                          v.safety_rules,
                          v.min_confidence,
                          v.reclassify_turn_threshold,
                          v.max_clarifying_questions
                        FROM topic_catalog t
                        JOIN topic_config_versions v ON v.topic_key = t.topic_key
                        WHERE t.topic_key = %s
                          AND v.version_no = %s
                        """,
                        (clean_topic_key, next_version),
                    )
                    row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=500, detail="Failed to create topic version")

            return _row_to_topic(row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/topic-dashboard/topics/{topic_key}/calculate-vector", response_model=TopicDashboardTopic)
def calculate_topic_vector(
    topic_key: str,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_admin(conn, authorization)

            clean_topic_key = (topic_key or "").strip()
            if not clean_topic_key:
                raise HTTPException(status_code=400, detail="Invalid topic key")

            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT classifier_description
                        FROM topic_config_versions
                        WHERE topic_key = %s
                          AND is_current = TRUE
                        FOR UPDATE
                        """,
                        (clean_topic_key,),
                    )
                    desc_row = cur.fetchone()
                    if not desc_row:
                        raise HTTPException(status_code=404, detail="Current topic version not found")

                    classifier_description = str(desc_row[0] or "").strip()
                    if not classifier_description:
                        raise HTTPException(status_code=400, detail="classifier_description is empty")

                    embedding = create_text_embedding(text=classifier_description)
                    if not embedding:
                        raise HTTPException(status_code=500, detail="Failed to create embedding")

                    cur.execute(
                        """
                        UPDATE topic_config_versions
                        SET classifier_embedding = %s
                        WHERE topic_key = %s
                          AND is_current = TRUE
                        """,
                        (embedding, clean_topic_key),
                    )

                    cur.execute(
                        """
                        SELECT
                          t.topic_key,
                          t.title,
                          v.version_no,
                          v.is_current,
                          v.classifier_description,
                          v.classifier_embedding,
                          v.system_prompt,
                          v.micro_instructions,
                          v.constraints,
                          v.reclassify_rules,
                          v.safety_rules,
                          v.min_confidence,
                          v.reclassify_turn_threshold,
                          v.max_clarifying_questions
                        FROM topic_catalog t
                        JOIN topic_config_versions v ON v.topic_key = t.topic_key
                        WHERE t.topic_key = %s
                          AND v.is_current = TRUE
                        """,
                        (clean_topic_key,),
                    )
                    row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=500, detail="Failed to load updated topic")

            return _row_to_topic(row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topic-dashboard/security-rejections", response_model=SecurityRejectionListResponse)
def list_security_rejections(
    limit: int = Query(default=200, ge=1, le=1000),
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _require_admin(conn, authorization)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      id,
                      conversation_id,
                      session_id,
                      message_id,
                      user_id,
                      message_preview,
                      rejection_type,
                      created_at
                    FROM security_rejections
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall() or []

        rejections = [
            SecurityRejectionItem(
                id=int(row[0]),
                conversation_id=row[1],
                session_id=row[2],
                message_id=row[3],
                user_id=row[4],
                message_preview=row[5],
                rejection_type=str(row[6]),
                created_at=row[7].isoformat() if row[7] else None,
            )
            for row in rows
        ]
        return SecurityRejectionListResponse(rejections=rejections)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")


class BaseSystemPromptResponse(BaseModel):
    value: str


class BaseSystemPromptUpdateRequest(BaseModel):
    value: str


@router.get("/topic-dashboard/app-config/base-system-prompt", response_model=BaseSystemPromptResponse)
def get_base_system_prompt(authorization: str | None = Header(default=None)):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _require_admin(conn, authorization)
            value = fetch_app_config(conn, "base_system_prompt") or ""
            return BaseSystemPromptResponse(value=value)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/topic-dashboard/app-config/base-system-prompt", response_model=BaseSystemPromptResponse)
def update_base_system_prompt(
    payload: BaseSystemPromptUpdateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        clean_value = (payload.value or "").strip()
        if not clean_value:
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _require_admin(conn, authorization)
            with conn.transaction():
                upsert_app_config(conn, "base_system_prompt", clean_value)
            return BaseSystemPromptResponse(value=clean_value)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")
