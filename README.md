# ASHO Bachelor Project

A simple AI chat application with a FastAPI backend and a React (Vite) frontend. The backend calls OpenAI chat completions, enforces basic security and token budgets, and stores chat history plus idempotency state in Postgres. The frontend provides a conversation UI with local persistence.

## Architecture

- Backend: FastAPI + OpenAI client + Postgres
- Frontend: React + Vite + localStorage
- DB: Postgres tables for chat history, idempotency, session token usage, and summaries

## Features

- Chat API with idempotent message handling
- Session token budgeting (input + output)
- Server-side chat history stored in Postgres
- Rolling summaries to reduce prompt size
- Prompt trace endpoint for debugging (in-memory only)
- Frontend chat shell with conversation list and local persistence
- Optional debug OpenAI health endpoint

## API Endpoints

- `POST /api/chat`
  - Body: `conversation_id`, `session_id`, `message_id`, `message`
  - Returns: `{ "reply": "..." }`
  - Enforces idempotency; reusing `message_id` with different content returns 409.
- `GET /api/prompt-trace/{session_id}`
  - Returns stored prompt payloads used for that session (in-memory only).
- `GET /api/debug/openai`
  - Only enabled if `ENABLE_DEBUG_ENDPOINTS=true`. Returns a simple OpenAI status reply.
- `GET /health`
  - Health check.

## Environment Variables

Backend (`backend/.env` or system env):
- `OPENAI_API_KEY` (required)
- `MODEL_NAME` (default: `gpt-4o-mini`)
- `DATABASE_URL` (required; Postgres)
- `ALLOWED_ORIGINS` (comma-separated; default allows all)
- `MAX_MESSAGE_TOKENS` (default: `512`)
- `MAX_SESSION_TOKENS` (default: `8000`)
- `MAX_OUTPUT_TOKENS` (default: `512`)
- `MAX_HISTORY_TOKENS` (default: `1800`)
- `MAX_HISTORY_MESSAGES` (default: `12`)
- `SUMMARY_MAX_TOKENS` (default: `350`)
- `SUMMARY_KEEP_LAST_MESSAGES` (default: `6`)
- `SUMMARY_WINDOW_MESSAGES` (default: `30`)
- `ENABLE_DEBUG_ENDPOINTS` (`true` or `false`, default: `false`)

Frontend (`frontend/.env`):
- `VITE_API_BASE_URL` (example: `http://127.0.0.1:8000`)

## Database Schema (Postgres)

The backend expects these tables to exist:

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  session_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_idempotency (
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  req_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress','done')),
  response_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, message_id)
);

CREATE TABLE IF NOT EXISTS session_token_usage (
  session_id TEXT PRIMARY KEY,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  last_message_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
# set env vars, then:
python -m uvicorn app.main:app --reload --reload-dir app
```

Windows helper:
```bat
start_server.bat
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Frontend Routes

- `/` - main chat shell UI
- `/soundtest` - placeholder sound test page
- `/chat` - debug chat panel (shows API payloads and prompt traces)

## Notes

- Chat input is normalized and restricted by a character allowlist, token limits, and prompt-injection heuristics.
- Prompt traces are stored in memory only and reset on server restart.
- Conversations are persisted in the browser via localStorage.

## Scripts

- `start_server.bat` - run backend with uvicorn
- `kill_uvi.bat` - kill uvicorn/python instances on Windows
