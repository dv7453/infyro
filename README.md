# Infyro

**Every market, one thread.** · beta 0.0.1

Telegram markets co-pilot + web dashboard. Custom agents with BYOK LLMs, CoinGecko + Yahoo Finance, threshold alerts.

## Repo layout

```
apps/api/          FastAPI
frontend/          React dashboard (Vite)
packages/db/       Models + migrations
packages/*_mcp/    Market / finance tools
runtimes/hermes/   Telegram + chat
runtimes/openclaw/ Price worker
scripts/           migrate, seed, doctor, start-all
docs/DEPLOY.md     Hosting notes
```

## Local quick start

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
# set FERNET_KEY, JWT_SECRET, TELEGRAM_BOT_TOKEN

docker compose up -d          # optional local Postgres on :55432
uv sync
./scripts/migrate.sh
./scripts/seed.sh

# API
set -a && source .env && set +a
uv run uvicorn infyro_api.main:app --host 127.0.0.1 --port 8000

# Dashboard
cd frontend && npm install && npm run dev

# Telegram bot (separate terminal)
uv run python runtimes/hermes/runtime.py

# Optional alerts worker
uv run python runtimes/openclaw/market_worker.py --once
```

- UI: http://127.0.0.1:5174  
- API: http://127.0.0.1:8000/docs  

Or: `./scripts/start-all.sh` (API + Hermes + worker + Vite).

## Telegram bot (BotFather)

1. `@BotFather` → `/newbot`
2. Put token + username in `.env`
3. Run Hermes; keep webhook deleted while using long-poll

## Production

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for **Render** step-by-step (API + Hermes worker + static UI).

Set `INFYRO_DEV_MODE=0` and `VITE_SKIP_AUTH=0` before a real launch.

## Architecture

![Infyro system architecture](docs/architecture.jpg)

| Role | Does | Must not |
|------|------|----------|
| Hermes | Telegram, LLM chat, deliver alerts | Own cron price jobs |
| OpenClaw worker | Fetch prices, write alerts | Telegram / LLM |
| FastAPI | REST + JWT + OTP | Chat loop |
| finance-tools MCP | Typed Postgres tools | — |

## Scripts

- `./scripts/migrate.sh` — Alembic upgrade  
- `./scripts/seed.sh` — MCP catalog seed  
- `./scripts/doctor.sh` — health check  
- `./scripts/start-all.sh` — local all-in-one  
