# Infyro

**Beta `v0.0.1` — open-source agent platform for everyday work in India**

Infyro is a plain-language AI co-pilot that sits on top of the tools people already use — **Gmail, Google Calendar, Docs, Sheets, Drive** — and reaches them where they already chat (**Telegram** today; WhatsApp optional). You ask in natural language; the agent drafts, schedules, searches, and creates. Sensitive actions ask for confirmation before anything is sent or changed.

We are building Infyro toward an **open-source MCP (Model Context Protocol)** surface: one-click, India-first integrations so builders and end users can plug agents into real workflows without wiring every API by hand.

> **This is an early beta (`v0.0.1`).** Expect rough edges. Please do **not** use it with sensitive or production-critical data yet. Feedback and collaboration are very welcome — see [Contributing](#contributing--feedback) below.

---

## Why Infyro

| Problem | How Infyro approaches it |
|--------|---------------------------|
| Productivity tools are powerful but menu-heavy | Chat in plain language instead of hunting settings |
| Agents are often demos, not connected to your account | Real Google OAuth + tool execution on your data |
| India needs local language + local infra paths | Roadmap: **Sarvam AI** for India-first models & voice, plus MCP packaging for one-click reuse |
| Channels are fragmented | Same agent over web chat **and** Telegram (WhatsApp optional) |

---

## What works today (`v0.0.1`)

### Google workspace tools

Once you connect Google, the agent can:

| Tool | What it does |
|------|----------------|
| **Gmail** | Search mail, draft/send email (with confirmation when configured) |
| **Calendar** | Schedule meetings with attendees and duration |
| **Docs** | Create documents from a title + body |
| **Sheets** | Create spreadsheets with columns |
| **Drive** | Save files / export Docs as PDF into Drive |

### Channels

- **Web app** — authenticated chat UI with streaming replies
- **Telegram** — link your account with a short code / deep link; talk to the same agent from Telegram
- **WhatsApp** (optional) — Meta Cloud API webhook path for the same agent loop

### Product controls

- **Persona** — tune how the agent writes
- **Tool permissions** — choose which tools need your explicit OK
- **BYOK** — optional per-user OpenAI / Groq keys
- **Feedback form** — in-app feedback for the beta

---

## Vision: open-source MCP for India

Infyro is not only a hosted chat app. The longer-term shape is:

1. **One-click MCP servers / packs** for common Indian and global workflows (Gmail, Docs, Sheets, Calendar, messaging, local LLMs).
2. **Sarvam AI integration** — India-first models (and voice) behind the same agent/tool loop, so Hindi and other Indian languages feel first-class, not bolted on.
3. **Channel-agnostic agent core** — one orchestrator; many front doors (web WebSocket, Telegram, WhatsApp, and eventually MCP clients).

If you care about MCP, Indian-language AI, or Google/Telegram automation, this repo is meant to grow with you.

---

## Architecture (high level)

```text
┌─────────────────┐     HTTPS / REST      ┌──────────────────────────────┐
│  TanStack Start │ ────────────────────► │  Express API                 │
│  (React web UI) │                       │  auth · settings · webhooks  │
│                 │     WebSocket /ws     │                              │
│  Chat + confirm │ ◄───────────────────► │  Agent orchestrator          │
└─────────────────┘   stream tokens +     │    ├─ LLM (Groq / BYOK)      │
                      tool events         │    ├─ tool schemas + exec    │
                                          │    └─ Google APIs            │
┌─────────────────┐                       │                              │
│  Telegram bot   │ ── webhook/polling ─► │  Same orchestrator           │
└─────────────────┘                       │                              │
┌─────────────────┐                       │  Supabase Auth + Postgres    │
│  WhatsApp       │ ── Meta webhook ────► │  tokens · settings · history │
└─────────────────┘                       └──────────────────────────────┘
```

### WebSocket agent (`/ws`)

The web chat does **not** poll HTTP for tokens. After login, the frontend opens a WebSocket to the backend:

| Direction | Message types (summary) |
|-----------|-------------------------|
| Client → server | `auth` (Supabase JWT), `user_message`, `confirm` (approve/deny a high-risk tool) |
| Server → client | `auth_ok` / `auth_error`, `history`, streaming `token`, `tool_call_started`, `tool_result`, `confirmation_required`, `message_complete`, `error` |

Flow in short:

1. Client connects to `ws://<backend>/ws` and sends `auth` with the session token.
2. Server validates auth, loads persona / permissions / history, replies `auth_ok` (+ `history` when present).
3. User messages run through the **tool-calling loop** (LLM ↔ Google tools).
4. High-risk tools can pause on `confirmation_required` until the client sends `confirm`.
5. Assistant text streams as `token` chunks, then `message_complete`.

Implementation pointers:

- Protocol: `backend/src/ws/protocol.ts`, `frontend/src/lib/websocket.ts`
- Socket server: `backend/src/ws/handler.ts`
- Agent loop: `backend/src/agent/orchestrator.ts`
- Tools: `backend/src/tools/{schemas,executors,summaries}.ts`

### Stack

| Layer | Tech |
|-------|------|
| Frontend | TanStack Start, React, Vite, Tailwind |
| Auth | Supabase Auth (Google OAuth) |
| Backend | Node.js, Express, WebSocket (`/ws`) |
| Agent | Groq tool-calling loop (light/heavy model routing); optional BYOK |
| Tools | Google APIs — Gmail, Calendar, Docs, Sheets, Drive |
| Messaging | Telegram Bot API; optional WhatsApp Cloud API |
| Data | Supabase (Postgres) |

---

## Backend

The **backend** (`backend/`) is the system of record for auth tokens, agent settings, conversations, and tool execution.

**Responsibilities**

- Express REST API for Google token storage, persona / tool permissions, BYOK keys, feedback, Telegram/WhatsApp linking
- WebSocket server at `/ws` for streaming chat + tool confirmations
- Agent orchestrator: LLM tool-calling loop, light/heavy model routing, history budget
- Google API executors (Gmail, Calendar, Docs, Sheets, Drive)
- Telegram (webhook or long-polling) and optional WhatsApp Cloud API webhooks
- Supabase (service role) for persistence

**Entry point:** `backend/src/index.ts` — boots HTTP + WebSocket, mounts routes, optionally starts Telegram polling.

**Key packages of code**

| Path | Role |
|------|------|
| `src/agent/` | Orchestrator, prompts, Groq/LLM runtime, model routing, event sink |
| `src/ws/` | WebSocket protocol + connection handler |
| `src/tools/` | Tool schemas (Zod), executors, user-facing summaries |
| `src/google/` | OAuth Google clients + refresh |
| `src/routes/` | REST + webhook routers |
| `src/telegram/`, `src/whatsapp/` | Channel adapters into the same agent |
| `src/db/` | Supabase table accessors |
| `migrations/` | Schema to run in the Supabase SQL Editor |

Copy [`backend/.env.example`](backend/.env.example) → `backend/.env`. Console steps: [`backend/SETUP.md`](backend/SETUP.md).

---

## Frontend

The **frontend** (`frontend/`) is the TanStack Start (Vite + React) web app users sign into.

**Responsibilities**

- Google sign-in via Supabase Auth + OAuth callback
- Agent chat UI over WebSocket (streaming tokens, tool status, confirmations)
- Settings: connection status, persona, tool permissions, Telegram/WhatsApp link codes, BYOK
- In-app feedback form + global beta banner
- Optional browser speech recognition helper for voice input

**Main routes**

| Route | Purpose |
|-------|---------|
| `/` | Sign-in landing |
| `/auth/callback` | OAuth redirect handler |
| `/agent` | Chat with the agent (WebSocket) |
| `/settings` | Persona, tools, channels, keys |
| `/form` | Beta feedback |

**Key packages of code**

| Path | Role |
|------|------|
| `src/routes/` | File-based TanStack Router pages |
| `src/components/agent/` | Chat session provider + types |
| `src/lib/websocket.ts` | Client WebSocket protocol helpers |
| `src/lib/api.ts` | REST calls to the backend |
| `src/lib/auth.ts`, `supabase.ts` | Session + Supabase client |
| `src/components/ui/` | Shared UI primitives (shadcn-style) |

Copy [`frontend/.env.example`](frontend/.env.example) → `frontend/.env`. Point `VITE_BACKEND_URL` at the running backend.

---

## Roadmap (near term)

- [ ] **Sarvam AI** — plug Sarvam models into the existing LLM runtime / routing layer
- [ ] **MCP packaging** — expose Infyro tools as open MCP servers for one-click clients
- [ ] Deeper Docs / Sheets / Gmail workflows for Indian office defaults
- [ ] Stronger multi-language UX (Hindi + English first)
- [ ] Hardening for a public beta beyond `v0.0.1`

Nothing here is locked; open an issue if you want to own a slice.

---

## File system tree

```text
infyro/
├── README.md
├── .gitignore
│
├── backend/
│   ├── .env.example              # All backend env vars (copy → .env)
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── SETUP.md                  # Google Cloud + Supabase console steps
│   ├── TELEGRAM_SETUP.md
│   ├── WHATSAPP_SETUP.md
│   ├── migrations/
│   │   ├── 001_initial.sql       # Core tables (tokens, settings, conversations)
│   │   ├── 002_whatsapp.sql      # Optional WhatsApp link tables
│   │   ├── 003_feedback.sql      # Feedback form storage
│   │   ├── 004_telegram.sql      # Optional Telegram link tables
│   │   └── 005_byok.sql          # Per-user LLM API keys
│   └── src/
│       ├── index.ts              # HTTP + WebSocket server entry
│       ├── config.ts             # Env loading / validation (zod)
│       ├── supabase.ts
│       ├── middleware/
│       │   └── auth.ts           # Bearer JWT checks for REST
│       ├── agent/
│       │   ├── orchestrator.ts   # Tool-calling loop
│       │   ├── prompts.ts
│       │   ├── llm.ts            # Resolve Groq / BYOK runtime
│       │   ├── groq.ts
│       │   ├── routeModel.ts     # Light vs heavy model selection
│       │   ├── historyBudget.ts
│       │   └── sink.ts           # Event sink (WS / channels)
│       ├── ws/
│       │   ├── handler.ts        # /ws server
│       │   └── protocol.ts       # Client/server message types
│       ├── tools/
│       │   ├── schemas.ts        # Tool names + Zod / OpenAI tool defs
│       │   ├── executors.ts      # Google API execution
│       │   └── summaries.ts      # Short result summaries for the UI
│       ├── google/
│       │   ├── client.ts         # Gmail / Calendar / Docs / Sheets / Drive clients
│       │   └── tokenRefresh.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── settings.ts
│       │   ├── feedback.ts
│       │   ├── telegramSettings.ts
│       │   ├── telegramWebhook.ts
│       │   ├── whatsappSettings.ts
│       │   └── whatsappWebhook.ts
│       ├── telegram/
│       │   ├── handler.ts
│       │   ├── polling.ts
│       │   ├── send.ts
│       │   └── sessions.ts
│       ├── whatsapp/
│       │   ├── handler.ts
│       │   ├── send.ts
│       │   └── sessions.ts
│       └── db/
│           ├── googleTokens.ts
│           ├── agentSettings.ts
│           ├── conversations.ts
│           ├── activityLog.ts
│           ├── feedback.ts
│           ├── llmKeys.ts
│           ├── telegram.ts
│           └── whatsapp.ts
│
└── frontend/
    ├── .env.example              # All frontend env vars (copy → .env)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── eslint.config.js
    ├── components.json           # shadcn/ui config
    ├── README.md
    ├── public/
    │   └── favicon.png
    └── src/
        ├── start.ts
        ├── server.ts
        ├── router.tsx
        ├── routeTree.gen.ts      # Generated route tree
        ├── styles.css
        ├── assets/
        │   └── infyro-logo.png
        ├── routes/
        │   ├── __root.tsx
        │   ├── index.tsx         # Sign-in
        │   ├── auth/
        │   │   └── callback.tsx
        │   ├── _authenticated.tsx
        │   └── _authenticated/
        │       ├── agent.tsx     # Chat UI
        │       ├── settings.tsx
        │       └── form.tsx      # Feedback
        ├── components/
        │   ├── AppShell.tsx
        │   ├── BetaBanner.tsx
        │   ├── agent/
        │   │   ├── ChatSessionProvider.tsx
        │   │   └── chatTypes.ts
        │   └── ui/               # Button, dialog, input, … (shared primitives)
        ├── hooks/
        │   └── use-mobile.tsx
        └── lib/
            ├── websocket.ts      # WS client protocol
            ├── api.ts            # Backend REST helpers
            ├── auth.ts
            ├── supabase.ts
            ├── scopes.ts         # Google OAuth scopes
            ├── constants.ts
            ├── speechRecognition.ts
            ├── utils.ts
            ├── error-capture.ts
            ├── error-page.ts
            └── error-reporting.ts
```

---

## Quick start (developers)

### Prerequisites

- Node.js 20+
- A Supabase project
- Google Cloud OAuth client (see [`backend/SETUP.md`](backend/SETUP.md))
- Groq API key (or BYOK later in settings)

### 1. Database

In the Supabase SQL Editor, run (in order):

- [`backend/migrations/001_initial.sql`](backend/migrations/001_initial.sql)
- [`backend/migrations/003_feedback.sql`](backend/migrations/003_feedback.sql)
- [`backend/migrations/005_byok.sql`](backend/migrations/005_byok.sql)
- Optional: [`002_whatsapp.sql`](backend/migrations/002_whatsapp.sql), [`004_telegram.sql`](backend/migrations/004_telegram.sql)

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill every variable below
npm install
npm run dev            # http://localhost:8080  ·  ws://localhost:8080/ws
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # fill every variable below
npm install
npm run dev            # http://localhost:3000
```

### 4. Supabase Auth URLs

Allow:

- Site URL: `http://localhost:3000`
- Redirect: `http://localhost:3000/auth/callback`

---

## Environment variables

Copy from each `.env.example`. **Never commit** real `.env` files.

### Backend — `backend/.env.example`

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
GROQ_API_KEY=
GROQ_MODEL_LIGHT=openai/gpt-oss-20b
GROQ_MODEL_HEAVY=openai/gpt-oss-120b
PORT=8080
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:5173
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_BUSINESS_NUMBER=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_USE_POLLING=true
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID (Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret |
| `SUPABASE_URL` | Yes | Supabase project URL (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — **server only**, bypasses RLS |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret used to verify Supabase access tokens |
| `GROQ_API_KEY` | Recommended | Platform Groq key when the user has no BYOK key |
| `GROQ_MODEL_LIGHT` | No | Fast model for low-risk turns (default `openai/gpt-oss-20b`) |
| `GROQ_MODEL_HEAVY` | No | Stronger model for high-risk tools (default `openai/gpt-oss-120b`) |
| `PORT` | No | HTTP + WebSocket port (default `8080`) |
| `FRONTEND_ORIGIN` | Yes (prod) | Comma-separated allowed browser origins for CORS + WS |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Meta System User token (WhatsApp Cloud API) |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp Cloud API phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Optional | Shared secret for Meta webhook verification |
| `WHATSAPP_BUSINESS_NUMBER` | Optional | Display number shown in Settings (e.g. `+91 …`) |
| `TELEGRAM_BOT_TOKEN` | Optional | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | Optional | Bot username without `@` (deep links) |
| `TELEGRAM_WEBHOOK_SECRET` | Optional | Secret for Telegram webhook header checks |
| `TELEGRAM_USE_POLLING` | Optional | `true` = local long-polling (no public webhook URL) |

### Frontend — `frontend/.env.example`

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=http://localhost:8080
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Same Supabase project URL as the backend |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase **anon** key (safe for the browser; RLS applies) |
| `VITE_BACKEND_URL` | Yes | Public base URL of the Express API (used for REST + deriving `ws://` / `wss://`) |

---

## Deploy notes

- Run migrations on the target Supabase project before traffic.
- Set `FRONTEND_ORIGIN` on the backend to your production frontend origin(s), comma-separated if needed.
- Point frontend `VITE_BACKEND_URL` at the public API URL.
- Add production Site URL + `/auth/callback` in Supabase Auth.
- Never commit `.env` files (they are gitignored).

More detail: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md).

---

## Contributing & feedback

**Infyro `v0.0.1` is a beta.** I would love to collaborate and grow this — especially around MCP packaging, Sarvam AI, Telegram/Google tools, and India-first UX.

1. **Found a bug or have an idea?** Open an issue on the [Issues](https://github.com/dv7453/Infyro/issues) tab. Screenshots, repro steps, and “what you expected” help a lot.
2. **Want to contribute code?** Fork → branch → PR. Small, focused PRs are easiest to review.
3. **Trying the beta?** Use the in-app feedback form, or file an issue with what felt confusing or broken.

Thank you for checking out Infyro — let’s build open, one-click agent tooling that actually works for Indian users.

---

## License

Open source — contributions welcome. If you plan a large feature (MCP server surface, Sarvam routing, new channels), open an issue first so we can align on shape.
