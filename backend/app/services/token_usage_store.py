from __future__ import annotations

import psycopg


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
