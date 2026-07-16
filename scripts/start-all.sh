#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "Starting Infyro processes (API, Hermes, OpenClaw worker, Web)…"
uv run uvicorn infyro_api.main:app --host 0.0.0.0 --port "${API_PORT:-8000}" &
API_PID=$!
uv run python runtimes/hermes/runtime.py &
HERMES_PID=$!
uv run python runtimes/openclaw/market_worker.py --interval 300 &
WORKER_PID=$!
(cd frontend && npm run dev) &
WEB_PID=$!

trap 'kill $API_PID $HERMES_PID $WORKER_PID $WEB_PID 2>/dev/null || true' EXIT
wait
