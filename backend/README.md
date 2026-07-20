# Infyro Agent Backend

Node.js (TypeScript) API for the Google-connected AI agent. Exposes REST settings/auth endpoints and a WebSocket agent at `/ws`, using Groq for chat/tool orchestration and Google APIs for tool execution.

## Prerequisites

1. Complete the manual console steps in [`SETUP.md`](SETUP.md).
2. Run [`migrations/001_initial.sql`](migrations/001_initial.sql) in the Supabase SQL Editor.
3. (Optional WhatsApp) Follow [`WHATSAPP_SETUP.md`](WHATSAPP_SETUP.md) and run [`migrations/002_whatsapp.sql`](migrations/002_whatsapp.sql).
4. Node.js 20+.

## Setup

```bash
cd backend
cp .env.example .env
# Fill in all values (see below)
npm install
npm run dev
```

The server listens on **http://localhost:8080** by default. WebSocket: **ws://localhost:8080/ws**.

Point the frontend at this backend:

```bash
# frontend/.env
VITE_BACKEND_URL=http://localhost:8080
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret from Google Cloud Console |
| `SUPABASE_URL` | Supabase project URL (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only; bypasses RLS) |
| `SUPABASE_JWT_SECRET` | JWT secret (Settings → API → JWT) |
| `GROQ_API_KEY` | API key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL_LIGHT` | Fast model for low-risk turns (default `openai/gpt-oss-20b`) |
| `GROQ_MODEL_HEAVY` | Capable model for high-risk tools (default `openai/gpt-oss-120b`) |
| `PORT` | HTTP/WS port (default `8080`) |
| `FRONTEND_ORIGIN` | Allowed CORS / WS origin (default `http://localhost:3000`) |
| `WHATSAPP_ACCESS_TOKEN` | Meta System User token (optional; WhatsApp channel) |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Shared secret for Meta webhook verification |
| `WHATSAPP_BUSINESS_NUMBER` | Display number for Settings (e.g. `+1 555…`) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled `dist/index.js` |

## API overview

All REST routes require `Authorization: Bearer <supabase access token>`.

- `POST /api/auth/store-tokens` — upsert Google refresh token + scopes
- `POST /api/auth/disconnect` — revoke Google token and delete stored row
- `GET /api/settings/connection` — connected email + scopes
- `GET/PUT /api/settings/persona`
- `GET/PUT /api/settings/tool-permissions`
- `GET/PUT /api/settings/defaults`
- `POST /api/settings/whatsapp/generate-code` — 6-digit link code (10 min)
- `GET /api/settings/whatsapp/status` — `{ linked, phone_number }`
- `POST /api/settings/whatsapp/unlink`
- `GET/POST /webhooks/whatsapp` — Meta Cloud API webhook
- `GET /health` — liveness check

WebSocket `/ws` message types match the frontend contract (`auth`, `user_message`, `confirm` inbound; `auth_ok` / `token` / `tool_*` / `message_complete` / `error` outbound).

## WhatsApp local testing

Meta requires a **public HTTPS** webhook URL. For local development, use a tunnel:

```bash
ngrok http 8080
# In Meta WhatsApp → Configuration → Webhook:
# Callback URL = https://<your-ngrok-host>/webhooks/whatsapp
# Verify token = same value as WHATSAPP_VERIFY_TOKEN
```

Use a **System User** permanent token, not the 24-hour temporary token from Meta’s quickstart. See [`WHATSAPP_SETUP.md`](WHATSAPP_SETUP.md).
