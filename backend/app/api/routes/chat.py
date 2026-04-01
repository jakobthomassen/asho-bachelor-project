import json
import hashlib
import threading
from fastapi import APIRouter, HTTPException, Response, Header
import psycopg
import time
from typing import Dict, List

from app.schemas.chat import SimpleChatRequest, SimpleChatResponse
from app.services.llm_client import (
    chat_with_history_with_system,
    classify_topic_by_embedding,
    create_initial_summary,
    generate_conversation_title,
    summarize_history,
    SYSTEM_PROMPT,
    DEFAULT_DIALOGUE_APPENDIX,
    SOMATIC_NUDGE_APPENDIX,
)
from app.services.app_config_store import fetch_app_config
from app.core.config import settings
from app.services.security import SecurityRejectionError, validate_and_count
from app.services.security_rejection_store import insert_security_rejection
from app.services.session_budget import add_tokens_and_check_budget
from app.services.google_auth import get_user_id_for_session, parse_bearer_token

from app.services.token_count import count_tokens

# NEW: DB-backed chat history
from app.services.chat_history_store import (
    insert_message,
    fetch_messages_after,
)
from app.services.chat_summary_store import get_summary, upsert_summary
from app.services.topic_routing_store import (
    fetch_active_topic_configs,
    get_conversation_topic_state,
    upsert_conversation_topic_state,
    insert_topic_routing_event,
)
from app.services.token_usage_store import (
    insert_daily_token_usage,
)
from app.topics.asho_engine import handle_asho_turn
from app.topics.asho_state_store import get_or_create_asho_state, save_asho_state

router = APIRouter()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for idempotency protection")

INITIAL_CLASSIFY_TURNS = 2   # Classify on every turn up to this for fast detection
CORRECTION_WINDOW_TURNS = 2  # After topic set, re-evaluate but keep topic if inconclusive
DEFAULT_RECLASSIFY_TURN_THRESHOLD = 12
TITLE_MIN_CONFIDENCE = 0.60
TITLE_CHECK_MIN_USER_MESSAGES = 3
GENERIC_TITLES = {"Samtale", "Ny samtale", ""}
GLOBAL_PACING_RULES = {"tempo": "slow", "max_questions_per_turn": 1}
SOMATIC_NUDGE_TURN_THRESHOLD = 5


def _run_background_summarization(
    conversation_id: str,
    session_id: str,
    existing_summary: str | None,
    existing_initial_summary: str | None,
    messages: list,
    last_message_id: int,
) -> None:
    try:
        if existing_initial_summary is None:
            new_summary, _, _ = create_initial_summary(
                session_id=session_id,
                messages=messages,
            )
            if new_summary:
                with psycopg.connect(settings.DATABASE_URL or "") as bg_conn:
                    with bg_conn.transaction():
                        upsert_summary(
                            bg_conn,
                            conversation_id=conversation_id,
                            summary_text="",
                            initial_summary_text=new_summary,
                            last_message_id=last_message_id,
                        )
        else:
            new_summary, _, _ = summarize_history(
                session_id=session_id,
                existing_summary=existing_summary,
                messages=messages,
            )
            if new_summary:
                with psycopg.connect(settings.DATABASE_URL or "") as bg_conn:
                    with bg_conn.transaction():
                        upsert_summary(
                            bg_conn,
                            conversation_id=conversation_id,
                            summary_text=new_summary,
                            last_message_id=last_message_id,
                        )
    except Exception:
        pass


@router.options("/chat")
def chat_options():
    return Response(status_code=200)


def _req_hash(conversation_id: str, normalized_message: str) -> str:
    normalized = {
        "conversation_id": conversation_id,
        "message": normalized_message,
    }
    s = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _estimate_prompt_tokens(summary_text: str | None, history, base_prompt: str = SYSTEM_PROMPT) -> int:
    total = count_tokens(base_prompt, model=settings.MODEL_NAME)
    if summary_text:
        total += count_tokens(summary_text, model=settings.MODEL_NAME)
    for msg in history:
        total += count_tokens(str(msg.get("content") or ""), model=settings.MODEL_NAME)
    return total


def _estimate_messages_prompt_tokens(messages: List[Dict[str, str]]) -> int:
    total = 0
    for msg in messages:
        total += count_tokens(str(msg.get("content") or ""), model=settings.MODEL_NAME)
    return total


def _fetch_latest_chat_message_id(
    conn: psycopg.Connection,
    *,
    conversation_id: str,
    role: str,
) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM chat_messages
            WHERE conversation_id = %s AND role = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (conversation_id, role),
        )
        row = cur.fetchone()
    if not row:
        return None
    return str(row[0])


def _needs_reclassify_from_user_text(message: str) -> bool:
    msg = (message or "").lower()
    triggers = [
        "dette hjelper ikke",
        "ikke nyttig",
        "ikke relevant",
        "misforstår",
        "for generelt",
        "passer ikke",
    ]
    return any(t in msg for t in triggers)


def _build_topic_system_prompt(topic, base_prompt: str = SYSTEM_PROMPT) -> str:
    sections = [
        base_prompt.strip(),
        f"Valgt tema: {topic.topic_key}",
        f"Tematittel: {topic.title}",
        "Tema-spesifikk systeminstruksjon:",
        topic.system_prompt.strip(),
        "Tema-instruksjoner (JSON):",
        json.dumps(
            {
                "micro_instructions": topic.micro_instructions,
                "constraints": topic.constraints,
                "pacing_rules": GLOBAL_PACING_RULES,
                "reclassify_rules": topic.reclassify_rules,
                "safety_rules": topic.safety_rules,
            },
            ensure_ascii=False,
        ),
        "Behandle tema-instruksjonene som en utvidelse av grunnprompten. Ved konflikt gjelder trygghet og nøkternhet først.",
    ]
    return "\n\n".join(sections)


@router.post("/chat", response_model=SimpleChatResponse)
def chat(payload: SimpleChatRequest, authorization: str | None = Header(default=None)):
    # 1) Security: normalize + per-message token cap
    try:
        sec = validate_and_count(payload.message, model_name=settings.MODEL_NAME)
    except SecurityRejectionError as e:
        try:
            session_token = parse_bearer_token(authorization)
            with psycopg.connect(settings.DATABASE_URL or "") as log_conn:
                user_id = get_user_id_for_session(log_conn, session_token) if session_token else None
                insert_security_rejection(
                    log_conn,
                    conversation_id=payload.conversation_id,
                    session_id=payload.session_id,
                    message_id=payload.message_id,
                    user_id=user_id,
                    message_preview=payload.message[:500],
                    rejection_type=e.rejection_type,
                )
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))

    normalized_message = sec.normalized_message
    input_tokens = sec.message_tokens
    req_hash = _req_hash(payload.conversation_id, normalized_message)

    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            session_token = parse_bearer_token(authorization)
            if not session_token:
                raise HTTPException(status_code=401, detail="Missing session token")
            user_id = get_user_id_for_session(conn, session_token)
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid session token")

            # 1b) Fetch base system prompt from DB (falls back to hardcoded constant)
            base_prompt = fetch_app_config(conn, "base_system_prompt") or SYSTEM_PROMPT

            # 2) Ensure conversation exists and is owned by user
            conversation_title = "Ny samtale"
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT user_id, title
                    FROM conversations
                    WHERE id = %s
                    """,
                    (payload.conversation_id,),
                )
                row = cur.fetchone()

                if row is None:
                    cur.execute(
                        """
                        INSERT INTO conversations (id, user_id, title)
                        VALUES (%s, %s, %s)
                        """,
                        (payload.conversation_id, user_id, "Ny samtale"),
                    )
                else:
                    owner_id, current_title = row
                    if str(owner_id) != str(user_id):
                        raise HTTPException(status_code=403, detail="Conversation not owned by user")
                    conversation_title = str(current_title or "Ny samtale")
                conn.commit()

            # 3) Idempotency claim (conversation_id + message_id)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_idempotency (conversation_id, message_id, req_hash, status)
                    VALUES (%s, %s, %s, 'in_progress')
                    ON CONFLICT (conversation_id, message_id) DO NOTHING
                    RETURNING 1
                    """,
                    (payload.conversation_id, payload.message_id, req_hash),
                )
                inserted = cur.fetchone() is not None
                conn.commit()

                cur.execute(
                    """
                    SELECT req_hash, status, response_json
                    FROM llm_idempotency
                    WHERE conversation_id=%s AND message_id=%s
                    """,
                    (payload.conversation_id, payload.message_id),
                )
                row = cur.fetchone()

                if not row:
                    raise HTTPException(status_code=500, detail="Idempotency state error")

                existing_hash, status, response_json = row

                if existing_hash != req_hash:
                    raise HTTPException(
                        status_code=409,
                        detail="message_id reused with different content",
                    )

                if status == "done" and response_json:
                    return json.loads(response_json)

                # If someone else is processing this message_id, wait briefly and return cached result if it finishes
                if not inserted:
                    for _ in range(12):
                        time.sleep(0.2)
                        cur.execute(
                            """
                            SELECT status, response_json
                            FROM llm_idempotency
                            WHERE conversation_id=%s AND message_id=%s
                            """,
                            (payload.conversation_id, payload.message_id),
                        )
                        status2, response_json2 = cur.fetchone()
                        if status2 == "done" and response_json2:
                            return json.loads(response_json2)

                    raise HTTPException(
                        status_code=409,
                        detail="Request is already being processed; retry with same message_id",
                    )

            # 4) Budget: input tokens
            try:
                with conn.transaction():
                    add_tokens_and_check_budget(
                        conn=conn,
                        session_id=payload.session_id,
                        add_tokens=input_tokens,
                        max_session_tokens=settings.MAX_SESSION_TOKENS,
                    )
            except RuntimeError:
                raise HTTPException(status_code=429, detail="Session token budget exceeded")

            # 5) Persist user message (durable history)
            with conn.transaction():
                insert_message(
                    conn,
                    conversation_id=payload.conversation_id,
                    session_id=payload.session_id,
                    role="user",
                    content=normalized_message,
                )

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    """,
                    (payload.conversation_id, user_id),
                )
                conn.commit()

            # 6) Rolling summary + bounded history window
            summary_text = None
            initial_summary_text = None
            summary_last_id = 0
            try:
                summary_row = get_summary(conn, conversation_id=payload.conversation_id)
                if summary_row:
                    summary_text = summary_row.summary_text or None
                    initial_summary_text = summary_row.initial_summary_text
                    summary_last_id = summary_row.last_message_id
            except Exception:
                summary_text = None
                initial_summary_text = None
                summary_last_id = 0
                conn.rollback()

            recent_rows = fetch_messages_after(
                conn,
                conversation_id=payload.conversation_id,
                after_message_id=summary_last_id,
                limit_messages=settings.MAX_HISTORY_MESSAGES,
                newest_first=True,
            )
            recent_rows.reverse()
            history = [{"role": row.role, "content": row.content} for row in recent_rows]

            summary_output_tokens = 0
            summary_prompt_tokens = 0
            try:
                combined_summary = "\n\n".join(s for s in [initial_summary_text, summary_text] if s)
                est_tokens = _estimate_prompt_tokens(combined_summary or None, history, base_prompt)
                if est_tokens > settings.MAX_HISTORY_TOKENS or len(recent_rows) >= settings.MAX_HISTORY_MESSAGES - 1:
                    candidate_rows = fetch_messages_after(
                        conn,
                        conversation_id=payload.conversation_id,
                        after_message_id=summary_last_id,
                        limit_messages=settings.SUMMARY_WINDOW_MESSAGES,
                        newest_first=False,
                    )
                    if len(candidate_rows) > settings.SUMMARY_KEEP_LAST_MESSAGES:
                        to_summarize = candidate_rows[:-settings.SUMMARY_KEEP_LAST_MESSAGES]
                        summary_input = [
                            {"role": row.role, "content": row.content} for row in to_summarize
                        ]
                        threading.Thread(
                            target=_run_background_summarization,
                            args=(
                                payload.conversation_id,
                                payload.session_id,
                                summary_text,
                                initial_summary_text,
                                summary_input,
                                to_summarize[-1].id,
                            ),
                            daemon=True,
                        ).start()
            except Exception:
                pass

            prepend = []
            if initial_summary_text:
                prepend.append({"role": "assistant", "content": "Samtalestart:\n" + initial_summary_text})
            if summary_text:
                prepend.append({"role": "assistant", "content": "Senere i samtalen:\n" + summary_text})
            if prepend:
                history = prepend + history

            total_user_turns = 0
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*)
                    FROM chat_messages
                    WHERE conversation_id = %s
                      AND role = 'user'
                    """,
                    (payload.conversation_id,),
                )
                count_row = cur.fetchone()
                total_user_turns = int((count_row or [0])[0] or 0)

            # 7) Route + call LLM (topic-specific or default handling)
            classifier_tokens = 0
            _somatic = SOMATIC_NUDGE_APPENDIX if total_user_turns >= SOMATIC_NUDGE_TURN_THRESHOLD else ""
            runtime_system_prompt = base_prompt + "\n\n" + DEFAULT_DIALOGUE_APPENDIX + ("\n\n" + _somatic if _somatic else "")
            topic_by_key = {}
            selected_topic_key = None
            classification_debug: Dict[str, object] = {
                "method": "embedding",
                "event": "none",
                "route_mode": "default",
                "selected_topic_key": None,
                "confidence": None,
                "reason": None,
            }
            try:
                active_topics = fetch_active_topic_configs(conn)
                topic_by_key = {t.topic_key: t for t in active_topics}
                state = get_conversation_topic_state(conn, conversation_id=payload.conversation_id)
                force_reclassify = _needs_reclassify_from_user_text(normalized_message)

                needs_classify = False
                if active_topics:
                    if state is None:
                        needs_classify = True
                    elif total_user_turns <= INITIAL_CLASSIFY_TURNS:
                        # Always classify in early turns for fast topic detection.
                        needs_classify = True
                    elif force_reclassify:
                        needs_classify = True
                    elif state.route_mode == "default":
                        # Keep trying to find a topic during the correction window,
                        # then fall back to periodic re-checks.
                        if total_user_turns <= INITIAL_CLASSIFY_TURNS + CORRECTION_WINDOW_TURNS:
                            needs_classify = True
                        elif state.turns_in_default >= DEFAULT_RECLASSIFY_TURN_THRESHOLD:
                            needs_classify = True
                    elif state.route_mode == "topic":
                        selected_topic = topic_by_key.get(state.current_topic_key or "")
                        topic_reclassify_threshold = (
                            int(selected_topic.reclassify_turn_threshold)
                            if selected_topic is not None
                            else DEFAULT_RECLASSIFY_TURN_THRESHOLD
                        )
                        # Correction window: re-evaluate shortly after first classification
                        # so wrong initial picks can be corrected.
                        if state.turns_since_classify <= CORRECTION_WINDOW_TURNS:
                            needs_classify = True
                        elif state.turns_since_classify >= topic_reclassify_threshold:
                            needs_classify = True

                route_mode = "default"
                last_confidence = state.last_confidence if state else None

                if needs_classify and active_topics:
                    classifier_topics: List[Dict[str, object]] = []
                    for t in active_topics:
                        classifier_topics.append(
                            {
                                "topic_key": t.topic_key,
                                "embedding": t.classifier_embedding,
                            }
                        )

                    cls_topic_key, cls_conf, cls_reason, cls_tokens = classify_topic_by_embedding(
                        user_message=normalized_message,
                        recent_history=history,
                        topics=classifier_topics,
                    )
                    classifier_tokens = cls_tokens
                    last_confidence = cls_conf

                    in_correction_window = (
                        state is not None
                        and state.route_mode == "topic"
                        and state.turns_since_classify <= CORRECTION_WINDOW_TURNS
                    )

                    if cls_topic_key and cls_topic_key in topic_by_key:
                        threshold = float(topic_by_key[cls_topic_key].min_confidence)
                        if cls_conf >= threshold:
                            selected_topic_key = cls_topic_key
                            route_mode = "topic"
                        elif in_correction_window and state is not None:
                            # Inconclusive during correction window — keep current topic.
                            selected_topic_key = state.current_topic_key
                            route_mode = "topic"
                    elif in_correction_window and state is not None:
                        # No topic matched during correction window — keep current topic.
                        selected_topic_key = state.current_topic_key
                        route_mode = "topic"

                    event_type = "reclassify" if force_reclassify and state is not None else "classify"
                    next_turns_in_default = 0 if route_mode == "topic" else ((state.turns_in_default + 1) if state else 1)
                    classification_debug = {
                        "method": "embedding",
                        "event": event_type,
                        "route_mode": route_mode,
                        "selected_topic_key": selected_topic_key,
                        "candidate_topic_key": cls_topic_key,
                        "confidence": cls_conf,
                        "reason": cls_reason,
                    }
                    with conn.transaction():
                        upsert_conversation_topic_state(
                            conn,
                            conversation_id=payload.conversation_id,
                            current_topic_key=selected_topic_key,
                            route_mode=route_mode,
                            last_confidence=last_confidence,
                            turns_since_classify=0,
                            turns_in_default=next_turns_in_default,
                            clarifying_questions_asked=0,
                        )
                        insert_topic_routing_event(
                            conn,
                            conversation_id=payload.conversation_id,
                            message_id=payload.message_id,
                            event_type=event_type,
                            selected_topic_key=selected_topic_key,
                            confidence=last_confidence,
                            reason=cls_reason or None,
                            classifier_payload={
                                "topic_key": cls_topic_key,
                                "confidence": cls_conf,
                                "reason": cls_reason,
                            },
                        )
                        insert_topic_routing_event(
                            conn,
                            conversation_id=payload.conversation_id,
                            message_id=payload.message_id,
                            event_type="route_decision",
                            selected_topic_key=selected_topic_key,
                            confidence=last_confidence,
                            reason=f"route={route_mode}",
                            classifier_payload=None,
                        )
                else:
                    if state and state.route_mode == "topic" and state.current_topic_key in topic_by_key:
                        selected_topic_key = state.current_topic_key
                        route_mode = "topic"
                        turns_since_classify = state.turns_since_classify + 1
                        turns_in_default = 0
                    else:
                        route_mode = "default"
                        turns_since_classify = (state.turns_since_classify + 1) if state else 1
                        turns_in_default = (state.turns_in_default + 1) if state else 1

                    with conn.transaction():
                        upsert_conversation_topic_state(
                            conn,
                            conversation_id=payload.conversation_id,
                            current_topic_key=selected_topic_key,
                            route_mode=route_mode,
                            last_confidence=last_confidence,
                            turns_since_classify=turns_since_classify,
                            turns_in_default=turns_in_default,
                            clarifying_questions_asked=(
                                state.clarifying_questions_asked if state else 0
                            ),
                        )
                        insert_topic_routing_event(
                            conn,
                            conversation_id=payload.conversation_id,
                            message_id=payload.message_id,
                            event_type="route_decision",
                            selected_topic_key=selected_topic_key,
                            confidence=last_confidence,
                            reason=f"route={route_mode}",
                            classifier_payload=None,
                        )
                    classification_debug = {
                        "method": "embedding",
                        "event": "reuse_route",
                        "route_mode": route_mode,
                        "selected_topic_key": selected_topic_key,
                        "candidate_topic_key": None,
                        "confidence": last_confidence,
                        "reason": "classification skipped this turn",
                    }

                if selected_topic_key and selected_topic_key in topic_by_key:
                    runtime_system_prompt = _build_topic_system_prompt(topic_by_key[selected_topic_key], base_prompt)
                else:
                    runtime_system_prompt = base_prompt + "\n\n" + DEFAULT_DIALOGUE_APPENDIX + ("\n\n" + _somatic if _somatic else "")
            except Exception:
                runtime_system_prompt = base_prompt + "\n\n" + DEFAULT_DIALOGUE_APPENDIX
                classifier_tokens = 0
                classification_debug = {
                    "method": "embedding",
                    "event": "error_fallback",
                    "route_mode": "default",
                    "selected_topic_key": None,
                    "candidate_topic_key": None,
                    "confidence": None,
                    "reason": "classification pipeline failed",
                }

            asho_topic = topic_by_key.get("asho_uroguide")
            asho_topic_config = None
            if asho_topic is not None:
                asho_topic_config = {
                    "topic_key": asho_topic.topic_key,
                    "title": asho_topic.title,
                    "system_prompt": asho_topic.system_prompt,
                    "micro_instructions": asho_topic.micro_instructions,
                    "constraints": asho_topic.constraints,
                    "reclassify_rules": asho_topic.reclassify_rules,
                    "safety_rules": asho_topic.safety_rules,
                }

            use_asho_by_default = True
            if use_asho_by_default:
                asho_state = get_or_create_asho_state(
                    conversation_id=payload.conversation_id,
                    topic_key="asho_uroguide",
                )
                asho_state["last_user_message_id"] = payload.message_id
                db_user_message_id = _fetch_latest_chat_message_id(
                    conn,
                    conversation_id=payload.conversation_id,
                    role="user",
                )
                if db_user_message_id:
                    asho_state["last_user_message_id"] = db_user_message_id

                reply, asho_state = handle_asho_turn(
                    asho_state,
                    normalized_message,
                    payload.message_id,
                    topic_config=asho_topic_config,
                )
                chat_prompt_tokens = int(asho_state.pop("_asho_prompt_tokens", 0) or 0)
                output_tokens = int(
                    asho_state.pop("_asho_output_tokens", count_tokens(reply, model=settings.MODEL_NAME))
                )
                last_prompt_tokens = chat_prompt_tokens
            else:
                prompt_messages_for_last_call: List[Dict[str, str]] = [
                    {"role": "system", "content": runtime_system_prompt}
                ]
                prompt_messages_for_last_call.extend(history)
                if not (
                    history
                    and history[-1].get("role") == "user"
                    and history[-1].get("content") == normalized_message
                ):
                    prompt_messages_for_last_call.append({"role": "user", "content": normalized_message})
                last_prompt_tokens = _estimate_messages_prompt_tokens(prompt_messages_for_last_call)

                reply, output_tokens, chat_prompt_tokens = chat_with_history_with_system(
                    session_id=payload.session_id,
                    history=history,
                    user_message=normalized_message,
                    system_prompt=runtime_system_prompt,
                )

            title_tokens = 0
            if (conversation_title or "") in GENERIC_TITLES:
                user_msgs_for_title = [
                    str(m.get("content") or "")
                    for m in history
                    if str(m.get("role")) == "user"
                ]
                # Keep the default title until the 3rd user message is sent.
                if len(user_msgs_for_title) >= TITLE_CHECK_MIN_USER_MESSAGES:
                    suggested_title, title_conf, title_reason, gen_title_output, gen_title_prompt = generate_conversation_title(
                        session_id=payload.session_id,
                        user_messages=user_msgs_for_title,
                    )
                    title_tokens = gen_title_output + gen_title_prompt
                    if suggested_title and suggested_title.strip() and title_conf >= TITLE_MIN_CONFIDENCE:
                        conversation_title = suggested_title.strip()[:80]
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                UPDATE conversations
                                SET title = %s, updated_at = NOW()
                                WHERE id = %s AND user_id = %s
                                """,
                                (conversation_title, payload.conversation_id, user_id),
                            )
                            conn.commit()
                    else:
                        _ = title_reason

            # 8) Persist assistant message
            with conn.transaction():
                insert_message(
                    conn,
                    conversation_id=payload.conversation_id,
                    session_id=payload.session_id,
                    role="assistant",
                    content=reply,
                )

            if use_asho_by_default:
                db_assistant_message_id = _fetch_latest_chat_message_id(
                    conn,
                    conversation_id=payload.conversation_id,
                    role="assistant",
                )
                if db_assistant_message_id:
                    asho_state["last_assistant_message_id"] = db_assistant_message_id
                save_asho_state(asho_state)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    """,
                    (payload.conversation_id, user_id),
                )
                conn.commit()

            # 9) Budget: output tokens
            conversation_tokens = None
            try:
                with conn.transaction():
                    budget_res = add_tokens_and_check_budget(
                        conn=conn,
                        session_id=payload.session_id,
                        add_tokens=output_tokens + classifier_tokens + title_tokens,
                        max_session_tokens=settings.MAX_SESSION_TOKENS,
                    )
                    conversation_tokens = budget_res.tokens_used_after
            except RuntimeError:
                raise HTTPException(status_code=429, detail="Session token budget exceeded")

            # 9b) Persist daily token usage for dashboard stats.
            try:
                with conn.transaction():
                    insert_daily_token_usage(
                        conn,
                        user_id=str(user_id),
                        conversation_id=payload.conversation_id,
                        message_id=payload.message_id,
                        input_tokens=chat_prompt_tokens,
                        output_tokens=output_tokens + summary_output_tokens + summary_prompt_tokens,
                        classifier_tokens=classifier_tokens,
                        title_tokens=title_tokens,
                    )
            except Exception:
                pass

            response = {
                "reply": reply,
                "last_prompt_tokens": last_prompt_tokens,
                "conversation_tokens": conversation_tokens,
                "conversation_title": conversation_title,
                "classification": classification_debug,
            }

            # 10) Store idempotent result
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE llm_idempotency
                    SET status='done', response_json=%s
                    WHERE conversation_id=%s AND message_id=%s
                    """,
                    (json.dumps(response), payload.conversation_id, payload.message_id),
                )
                conn.commit()

            return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
