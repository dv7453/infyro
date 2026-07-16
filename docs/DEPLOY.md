# Deploy Infyro on Render

Infyro needs **3 services** (plus Postgres you already have on Supabase):

| Service | Type on Render | What it runs |
|---------|----------------|--------------|
| API | Web Service | FastAPI |
| Hermes | Background Worker | Telegram long-poll + LLM chat |
| Dashboard | Static Site | `frontend/dist` |
| OpenClaw (optional) | Background Worker / Cron | Price alerts |

> **Important:** Free Render web services **sleep**. Hermes must stay awake to poll Telegram, so use a **paid Background Worker** (Starter) for Hermes, or run Hermes on any always-on machine. Do **not** set a Telegram webhook while Hermes long-polls.

The API `/auth/telegram/webhook` route only handles `/start` (pairing). Full chat lives in Hermes.

---

## 0. Prep the repo

1. Push this repo to GitHub.
2. Keep using **Supabase** `DATABASE_URL` (or create Render Postgres).
3. Generate secrets if needed:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# JWT_SECRET: any long random string
```

4. Locally run migrations once against the cloud DB (from your machine):

```bash
set -a && source .env && set +a
./scripts/migrate.sh
./scripts/seed.sh
```

---

## 1. API — Web Service

**Dashboard → New → Web Service → connect repo**

| Setting | Value |
|---------|--------|
| Name | `infyro-api` |
| Runtime | Python 3 |
| Root Directory | *(leave empty — monorepo root)* |
| Build Command | `pip install uv && uv sync --frozen` |
| Start Command | `uv run uvicorn infyro_api.main:app --host 0.0.0.0 --port $PORT` |

**Environment variables** (same names as `.env.example`):

```
DATABASE_URL=postgresql+psycopg://...@db....supabase.co:5432/postgres?sslmode=require
JWT_SECRET=...
FERNET_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=InfyroMarketBot
TELEGRAM_INGRESS=hermes
CORS_ORIGINS=https://YOUR-STATIC-SITE.onrender.com
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=          # optional server fallback; prefer BYOK on agents
INFYRO_DEV_MODE=0
```

After deploy, open `https://infyro-api.onrender.com/health` → `{"status":"ok",...}`.

---

## 2. Hermes — Background Worker

**New → Background Worker** (same repo)

| Setting | Value |
|---------|--------|
| Name | `infyro-hermes` |
| Runtime | Python 3 |
| Build Command | `pip install uv && uv sync --frozen` |
| Start Command | `uv run python runtimes/hermes/runtime.py` |

**Env:** copy the **same** `DATABASE_URL`, `FERNET_KEY`, `TELEGRAM_*`, `GROQ_*` as the API.

Then clear any webhook so long-poll works (one-time, from your laptop):

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

Message `@InfyroMarketBot` — Hermes logs should show activity.

---

## 3. Dashboard — Static Site

**New → Static Site**

| Setting | Value |
|---------|--------|
| Name | `infyro-web` |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

**Build env vars** (Vite bakes these in at build time):

```
VITE_API_URL=https://infyro-api.onrender.com
VITE_SKIP_AUTH=0
```

For a **recruiter demo** you can temporarily use:

```
VITE_SKIP_AUTH=1
```

and set `INFYRO_DEV_MODE=1` on the API — not for a real launch.

Update API `CORS_ORIGINS` to your static URL, then redeploy the API.

---

## 4. Optional: OpenClaw worker

**Background Worker** or **Cron Job** (every 5 min):

```
uv run python runtimes/openclaw/market_worker.py --once
```

Same DB + secrets as API.

---

## Checklist after deploy

- [ ] `/health` on API is OK  
- [ ] Dashboard loads and can call the API (no CORS errors)  
- [ ] Hermes worker is **running** (not spun down)  
- [ ] Webhook deleted; bot replies in Telegram  
- [ ] `INFYRO_DEV_MODE=0` for production  
- [ ] Agent has a Groq/OpenAI key saved (BYOK) or `GROQ_API_KEY` set  

---

## Cost note (Render)

| Piece | Free? |
|-------|--------|
| Static Site (UI) | Yes |
| Web Service (API) | Free sleeps after ~15m (cold starts) |
| Background Worker (Hermes) | **Paid** (needed for always-on Telegram) |
| Supabase Postgres | Free tier OK for beta |

Cheapest reliable demo: keep Supabase free + Render Static Site + paid API/Hermes Starter, or run Hermes on a small always-on VPS.
