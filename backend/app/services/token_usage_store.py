from __future__ import annotations

import psycopg


def ensure_daily_token_usage_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_token_usage (
                id BIGSERIAL PRIMARY KEY,
                event_date DATE NOT NULL DEFAULT CURRENT_DATE,
                user_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
                output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
                classifier_tokens INTEGER NOT NULL DEFAULT 0 CHECK (classifier_tokens >= 0),
                title_tokens INTEGER NOT NULL DEFAULT 0 CHECK (title_tokens >= 0),
                total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_daily_token_usage_event_date
            ON daily_token_usage (event_date)
            """
        )


def insert_daily_token_usage(
    conn: psycopg.Connection,
    *,
    user_id: str,
    conversation_id: str,
    message_id: str,
    input_tokens: int,
    output_tokens: int,
    classifier_tokens: int,
    title_tokens: int,
) -> None:
    total_tokens = max(
        0,
        int(input_tokens) + int(output_tokens) + int(classifier_tokens) + int(title_tokens),
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO daily_token_usage (
                event_date,
                user_id,
                conversation_id,
                message_id,
                input_tokens,
                output_tokens,
                classifier_tokens,
                title_tokens,
                total_tokens
            )
            VALUES (CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                conversation_id,
                message_id,
                int(input_tokens),
                int(output_tokens),
                int(classifier_tokens),
                int(title_tokens),
                total_tokens,
            ),
        )
