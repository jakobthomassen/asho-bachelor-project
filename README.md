[![Better Stack Badge](https://uptime.betterstack.com/status-badges/v3/monitor/2f2j6.svg)](https://uptime.betterstack.com/?utm_source=status_badge)

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
- `GET /api/auth/apple/start`
  - Starts Apple OIDC auth (state + nonce) and redirects to Apple.
- `POST /api/auth/apple/callback`
  - Apple return endpoint (`response_mode=form_post`), validates state/nonce and signs in user.
- `POST /api/auth/register`
  - Body: `email`, `password`
- `POST /api/auth/login`
  - Body: `email`, `password`
- `POST /api/auth/logout`
  - Revokes bearer session token.
- `POST /api/auth/forgot-password`
  - Body: `email`
- `POST /api/auth/reset-password`
  - Body: `token`, `new_password`
- `POST /api/auth/verify-email`
  - Body: `token`

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
- `GOOGLE_CLIENT_ID` (required for Google auth)
- `GOOGLE_SUB_HASH_SECRET` (required for Google auth and default hash secret fallback)

Apple Sign-In:
- `APPLE_TEAM_ID`
- `APPLE_CLIENT_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` (PEM; can be single-line with `\n`)
- `APPLE_REDIRECT_URI` (must match Apple Return URL; usually `https://<api>/api/auth/apple/callback`)
- `APPLE_ISSUER` (default: `https://appleid.apple.com`)

Custom Email/Password Auth:
- `AUTH_CREDENTIAL_STORE_MASTER_KEY` (required for encrypted credential file)
- `AUTH_CREDENTIAL_STORE_PATH` (default: `backend/.auth_credentials.enc`)
- `AUTH_SUB_HASH_SECRET` (optional, falls back to `GOOGLE_SUB_HASH_SECRET`)
- `AUTH_TOKEN_HASH_SECRET` (optional, falls back to `GOOGLE_SUB_HASH_SECRET`)
- `AUTH_STATE_SIGNING_SECRET` (optional, falls back to `GOOGLE_SUB_HASH_SECRET`)
- `AUTH_REQUIRE_EMAIL_VERIFICATION` (default: `true`)
- `AUTH_DEBUG_RETURN_TOKENS` (default: `false`, if true API returns verify/reset tokens for local testing)
- `AUTH_MIN_PASSWORD_LENGTH` (default: `8`)
- `AUTH_EMAIL_VERIFY_TOKEN_TTL_MINUTES` (default: `30`)
- `AUTH_RESET_TOKEN_TTL_MINUTES` (default: `30`)
- `AUTH_OAUTH_COOKIE_TTL_SECONDS` (default: `900`)
- `AUTH_COOKIE_SECURE` (default: `true`)
- `AUTH_COOKIE_SAMESITE` (default: `lax`)
- `AUTH_COOKIE_DOMAIN` (optional)
- `AUTH_RATE_IP_CAPACITY` (default: `20`)
- `AUTH_RATE_IP_REFILL_PER_SEC` (default: `0.33`)
- `AUTH_RATE_IDENTIFIER_CAPACITY` (default: `8`)
- `AUTH_RATE_IDENTIFIER_REFILL_PER_SEC` (default: `0.1`)

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
- Because DB schema changes are disallowed, email/password credentials are stored in an encrypted server-side file (`AUTH_CREDENTIAL_STORE_PATH`) instead of Postgres. This is a compromise and has deployment/scaling limitations (single-file consistency and key management).

## Apple Developer Setup

1. In Apple Developer, create a **Service ID** and enable **Sign in with Apple**.
2. Configure the **Return URL** to match your backend callback exactly, e.g. `https://your-api.example.com/api/auth/apple/callback`.
3. Create a **Sign in with Apple key**, note `Key ID`, and download the `.p8` private key.
4. Set env vars: `APPLE_TEAM_ID`, `APPLE_CLIENT_ID` (Service ID), `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, and `APPLE_REDIRECT_URI`.
5. Ensure frontend origin and `return_to` values are allowed by backend CORS/origin settings.

## Auth Curl Examples

```bash
# Register
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPassword123"}'

# Verify email (token is only returned when AUTH_DEBUG_RETURN_TOKENS=true)
curl -X POST http://127.0.0.1:8000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"<verification-token>"}'

# Login
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPassword123"}'

# Forgot password
curl -X POST http://127.0.0.1:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Reset password
curl -X POST http://127.0.0.1:8000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<reset-token>","new_password":"NewStrongPassword123"}'

# Start Apple login (follow redirects in browser)
curl -i "http://127.0.0.1:8000/api/auth/apple/start?return_to=http://localhost:5173"
```

## Scripts

- `start_server.bat` - run backend with uvicorn
- `kill_uvi.bat` - kill uvicorn/python instances on Windows
