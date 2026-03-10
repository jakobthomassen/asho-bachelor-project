[![Better Stack Badge](https://uptime.betterstack.com/status-badges/v3/monitor/2f2j6.svg)](https://uptime.betterstack.com/?utm_source=status_badge)

# ASHO Bachelor Project

An AI-assisted chat application built as a bachelor thesis project. Users authenticate, start conversations, and interact with an LLM through a structured topic-routing system. The backend enforces security boundaries, manages token budgets, and stores durable conversation history.

## Architecture

```
┌──────────────┐     HTTPS      ┌──────────────────────────────────────┐
│   React SPA  │ ─────────────► │  FastAPI Backend                     │
│  (Vite)      │                │                                      │
└──────────────┘                │  ┌────────────┐  ┌────────────────┐  │
                                │  │ Auth layer │  │  Chat pipeline │  │
                                │  └────────────┘  └───────┬────────┘  │
                                │                          │           │
                                │                  ┌───────▼────────┐  │
                                │                  │  OpenAI API    │  │
                                │                  └────────────────┘  │
                                └──────────────────────────┬───────────┘
                                                           │
                                                  ┌────────▼────────┐
                                                  │   PostgreSQL    │
                                                  └─────────────────┘
```

**Backend** — FastAPI application structured around independent service modules. No ORM; all database access uses raw parameterized queries via `psycopg`.

**Frontend** — React + Vite SPA. Conversation list and UI state are persisted in `localStorage`. Auth state is managed via an HttpOnly session cookie set by the backend after OAuth.

**Database** — PostgreSQL. Used for chat history, conversation metadata, session token budgets, rolling summaries, topic routing state, idempotency records, and auth identities.

## Chat Pipeline

Each message passes through the following stages before a reply is returned:

1. **Security validation** — message is normalized (NFC, whitespace collapse), checked against a character allowlist, token-counted, and screened for prompt-injection heuristics. Rejections are logged to the database.
2. **Idempotency** — a `(conversation_id, message_id)` claim is inserted. Duplicate requests with the same ID return the cached response; conflicting content returns 409.
3. **Session budget** — input tokens are charged atomically against the session's token allowance before the LLM is called.
4. **Topic classification** — the message is classified against active topic configs using embedding similarity. The result determines which system prompt variant is used.
5. **History assembly** — recent messages are fetched. If the history token count exceeds the configured window, older messages are summarized and stored, then replaced with the summary.
6. **LLM call** — the assembled prompt is sent to OpenAI. Output tokens are charged to the session budget after the response arrives.
7. **Persistence** — both the user message and assistant reply are written to `chat_messages`. Daily token usage is recorded for dashboard stats.

## Authentication

Three auth methods are supported, all issuing the same session token format:

- **Google Sign-In** — credential exchange via Google's token verification endpoint
- **Apple Sign-In** — OIDC authorization code flow with signed state and nonce cookies
- **Email/password** — custom implementation with bcrypt hashing, email verification, and password reset; backed by Postgres

Session tokens are delivered as `HttpOnly`, `Secure` cookies after OAuth redirects. API endpoints authenticate via `Authorization: Bearer <token>`.

## Topic Routing

Conversations are classified into configurable topics using embedding cosine similarity. Topic configs are stored in Postgres and include a system prompt, micro-instructions, pacing rules, safety rules, and a reclassification threshold. The classifier re-evaluates the topic periodically and on explicit user feedback signals.

## Security Measures

- Input normalization and character allowlist (Latin + Norwegian + digits + limited punctuation)
- Per-message token cap enforced before any LLM call
- Prompt injection heuristics (regex-based phrase detection with proximity matching)
- Session token budget enforced atomically in Postgres
- Request idempotency to prevent duplicate LLM charges
- All security rejections logged with type and message preview
- Internal exception details never returned to clients (generic 500 messages)
- Admin-only endpoints require a valid session with `is_admin = true`

## Project Structure

```
backend/
  app/
    api/routes/       # FastAPI route handlers
    services/         # Business logic and DB access
    schemas/          # Pydantic request/response models
    core/             # Config and settings
frontend/
  src/
    components/       # React UI components
    services/         # API client and local storage
```

See `SCHEMA.md` (forthcoming) for the full database schema.

## Local Development

**Backend**

```bash
cd backend
pip install -r requirements.txt
# configure backend/.env, then:
python -m uvicorn app.main:app --reload --reload-dir app
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Key Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `MODEL_NAME` | Model to use (default: `gpt-4o-mini`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `APPLE_*` | Apple Sign-In credentials (team, client, key) |
| `MAX_SESSION_TOKENS` | Per-session token budget |
| `MAX_MESSAGE_TOKENS` | Per-message input token cap |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins |

Full variable reference is in `backend/app/core/config.py`.