from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
import psycopg

from app.core.config import settings
from app.schemas.topic_dashboard import (
    TopicDashboardListResponse,
    TopicDashboardTopic,
    TopicDashboardUpdateRequest,
)
from app.services.google_auth import ensure_auth_tables, get_user_id_for_session, parse_bearer_token

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for topic dashboard")


def _require_user(conn: psycopg.Connection, authorization: str | None) -> str:
    ensure_auth_tables(conn)
    session_token = parse_bearer_token(authorization)
    if not session_token:
        raise HTTPException(status_code=401, detail="Missing session token")
    user_id = get_user_id_for_session(conn, session_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return user_id


def _normalize_keywords(values: list[str]) -> list[str]:
    out: list[str] = []
    for value in values:
        v = str(value).strip()
        if not v:
            continue
        if v not in out:
            out.append(v)
    return out


def _row_to_topic(row: tuple[Any, ...]) -> TopicDashboardTopic:
    return TopicDashboardTopic(
        topic_key=str(row[0]),
        title=str(row[1]),
        version_no=int(row[2]),
        is_current=bool(row[3]),
        classifier_description=str(row[4]),
        classifier_keywords=list(row[5] or []),
        classifier_exclude_keywords=list(row[6] or []),
        system_prompt=str(row[7]),
        micro_instructions=dict(row[8] or {}),
        constraints=dict(row[9] or {}),
        pacing_rules=dict(row[10] or {}),
        reclassify_rules=dict(row[11] or {}),
        safety_rules=dict(row[12] or {}),
        min_confidence=float(row[13]),
        reclassify_turn_threshold=int(row[14]),
        max_clarifying_questions=int(row[15]),
        examples=list(row[16] or []),
    )


@router.get("/topic-dashboard/topics", response_model=TopicDashboardListResponse)
def list_topics(authorization: str | None = Header(default=None)):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_user(conn, authorization)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      t.topic_key,
                      t.title,
                      v.version_no,
                      v.is_current,
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
                      v.max_clarifying_questions,
                      v.examples
                    FROM topic_catalog t
                    JOIN topic_config_versions v ON v.topic_key = t.topic_key
                    WHERE v.is_current = TRUE
                    ORDER BY t.title ASC
                    """
                )
                rows = cur.fetchall() or []

            return {"topics": [_row_to_topic(row) for row in rows]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/topic-dashboard/topics/{topic_key}/versions", response_model=TopicDashboardTopic)
def create_topic_version(
    topic_key: str,
    payload: TopicDashboardUpdateRequest,
    authorization: str | None = Header(default=None),
):
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            _ = _require_user(conn, authorization)

            clean_topic_key = (topic_key or "").strip()
            if not clean_topic_key:
                raise HTTPException(status_code=400, detail="Invalid topic key")

            clean_title = payload.title.strip()
            clean_classifier_description = payload.classifier_description.strip()
            clean_system_prompt = payload.system_prompt.strip()
            clean_created_by = (payload.created_by or "dashboard").strip()[:120] or "dashboard"

            if not clean_title or not clean_classifier_description or not clean_system_prompt:
                raise HTTPException(status_code=400, detail="Missing required fields")

            keywords = _normalize_keywords(payload.classifier_keywords)
            exclude_keywords = _normalize_keywords(payload.classifier_exclude_keywords)

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
                          examples,
                          created_by
                        )
                        VALUES (
                          %s, %s, TRUE, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                          %s::jsonb, %s::jsonb, %s, %s, %s, %s::jsonb, %s
                        )
                        """,
                        (
                          clean_topic_key,
                          next_version,
                          clean_classifier_description,
                          keywords,
                          exclude_keywords,
                          clean_system_prompt,
                          payload.micro_instructions,
                          payload.constraints,
                          payload.pacing_rules,
                          payload.reclassify_rules,
                          payload.safety_rules,
                          payload.min_confidence,
                          payload.reclassify_turn_threshold,
                          payload.max_clarifying_questions,
                          payload.examples,
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
                          v.max_clarifying_questions,
                          v.examples
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
        raise HTTPException(status_code=500, detail=str(exc))
