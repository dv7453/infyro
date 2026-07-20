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

## Roadmap (near term)

- [ ] **Sarvam AI** — plug Sarvam models into the existing LLM runtime / routing layer
- [ ] **MCP packaging** — expose Infyro tools as open MCP servers for one-click clients
- [ ] Deeper Docs / Sheets / Gmail workflows for Indian office defaults
- [ ] Stronger multi-language UX (Hindi + English first)
- [ ] Hardening for a public beta beyond `v0.0.1`

Nothing here is locked; open an issue if you want to own a slice.

---

## Repo layout

```text
infyro/
├── README.md                 # You are here
├── backend/                  # Node/Express API + WebSocket agent
│   ├── src/
│   │   ├── agent/            # Orchestrator, prompts, LLM routing
│   │   ├── tools/            # Google tool schemas + executors
│   │   ├── ws/               # WebSocket protocol + handler
│   │   ├── telegram/         # Telegram channel
│   │   ├── whatsapp/         # Optional WhatsApp channel
│   │   ├── google/           # OAuth clients + token refresh
│   │   ├── routes/           # REST: auth, settings, feedback, webhooks
│   │   └── db/               # Supabase accessors
│   ├── migrations/           # SQL schema (run in Supabase SQL Editor)
│   ├── SETUP.md              # Google Cloud + Supabase console steps
│   ├── TELEGRAM_SETUP.md
│   └── WHATSAPP_SETUP.md
└── frontend/                 # TanStack Start web app
    └── src/                  # Auth, agent chat, settings, feedback
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
cp .env.example .env   # fill values — see backend/README.md
npm install
npm run dev            # http://localhost:8080  ·  ws://localhost:8080/ws
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # same Supabase project + VITE_BACKEND_URL
npm install
npm run dev            # http://localhost:3000
```

### 4. Supabase Auth URLs

Allow:

- Site URL: `http://localhost:3000`
- Redirect: `http://localhost:3000/auth/callback`

### Environment (summary)

**Backend** (`backend/.env`): Google client credentials, Supabase URL / service role / JWT secret, Groq key, `FRONTEND_ORIGIN`, optional Telegram / WhatsApp vars. Full table in [`backend/README.md`](backend/README.md).

**Frontend** (`frontend/.env`):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=http://localhost:8080
```

### Deploy notes

- Run migrations on the target Supabase project before traffic.
- Set `FRONTEND_ORIGIN` on the backend to your production frontend origin(s).
- Point `VITE_BACKEND_URL` at the public API URL.
- Add production Site URL + `/auth/callback` in Supabase Auth.
- Never commit `.env` files.

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
