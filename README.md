# Infyro

Infyro helps everyday people get real work done with the tools they already use — Gmail, Calendar, Docs, Sheets, and Drive — without needing to learn menus, shortcuts, or “power user” workflows.

Talk to your agent in plain language. Ask it to draft an email, book a meeting, or create a document. You stay in control: sensitive actions ask for your confirmation before anything is sent or changed.

---

## What you can do

- Connect Google once and work through a simple chat
- Send email and schedule meetings on your behalf (with confirmation when you want it)
- Create Docs / Sheets and save files to Drive
- Tune how the agent writes (persona) and which tools need your OK
- (Optional) Reach the same agent over WhatsApp

---

## For developers

### Repo layout

```text
infyro/
├── README.md                 # This file
├── backend/                  # Node/Express API + WebSocket agent
│   ├── src/                  # Source (auth, settings, tools, Groq, WhatsApp)
│   ├── migrations/           # Supabase SQL schema (run once per environment)
│   ├── .env.example
│   ├── SETUP.md              # Google Cloud + Supabase console steps
│   └── WHATSAPP_SETUP.md     # Optional WhatsApp Cloud API
└── frontend/                 # TanStack Start (Vite) web app
    ├── src/                  # UI, auth callback, agent chat, settings
    └── .env.example
```

### Stack

| Layer | Tech |
|-------|------|
| Frontend | TanStack Start, React, Vite, Tailwind |
| Auth | Supabase Auth (Google OAuth) |
| Backend | Node.js, Express, WebSocket (`/ws`) |
| Agent | Groq (tool-calling loop) |
| Tools | Google APIs (Gmail, Calendar, Docs, Sheets, Drive) |
| Data | Supabase (Postgres) |

### Quick start

1. **Console setup** — follow [`backend/SETUP.md`](backend/SETUP.md) (Google OAuth + Supabase).
2. **Database** — in the Supabase SQL Editor, run:
   - [`backend/migrations/001_initial.sql`](backend/migrations/001_initial.sql)
   - (Optional) [`backend/migrations/002_whatsapp.sql`](backend/migrations/002_whatsapp.sql)
3. **Backend**

   ```bash
   cd backend
   cp .env.example .env   # fill values
   npm install
   npm run dev            # http://localhost:8080
   ```

4. **Frontend**

   ```bash
   cd frontend
   cp .env.example .env   # same Supabase project + VITE_BACKEND_URL
   npm install
   npm run dev            # http://localhost:3000
   ```

5. In Supabase → Authentication → URL Configuration, allow:
   - Site URL: `http://localhost:3000`
   - Redirect: `http://localhost:3000/auth/callback`

### Environment (summary)

**Backend** (`backend/.env`) — Google client credentials, Supabase URL / service role / JWT secret, Groq key, `FRONTEND_ORIGIN`, optional WhatsApp vars. See `backend/.env.example`.

**Frontend** (`frontend/.env`):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=http://localhost:8080
```

### Deploy notes

- Run migrations against the target Supabase project before first traffic.
- Set `FRONTEND_ORIGIN` on the backend to your production frontend origin(s), comma-separated if needed.
- Point frontend `VITE_BACKEND_URL` at the public API URL.
- Add production Site URL + `/auth/callback` in Supabase Auth.
- Never commit `.env` files (they are gitignored).

More detail: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md).
