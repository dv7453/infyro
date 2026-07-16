#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Infyro doctor =="
docker compose ps postgres || true
curl -sf "http://127.0.0.1:${API_PORT:-8000}/health" && echo || echo "API not running"
test -n "${TELEGRAM_BOT_TOKEN:-}" && echo "TELEGRAM_BOT_TOKEN set" || echo "TELEGRAM_BOT_TOKEN missing"
test -n "${FERNET_KEY:-}" && echo "FERNET_KEY set" || echo "FERNET_KEY missing"

# OpenClaw deny-list sanity (config file only)
CFG="$ROOT/runtimes/openclaw/openclaw.json"
if command -v python3 >/dev/null; then
  python3 - <<'PY'
import json, pathlib, sys
p = pathlib.Path("runtimes/openclaw/openclaw.json")
if not p.exists():
    print("openclaw config missing")
    sys.exit(0)
cfg = json.loads(p.read_text())
deny = set(cfg.get("tools", {}).get("deny", []))
required = {"browser", "message", "group:messaging", "sessions_spawn", "web_search", "web_fetch"}
missing = required - deny
if missing:
    print("WARN OpenClaw deny missing:", sorted(missing))
else:
    print("OpenClaw deny-list covers messaging/web/subagent paths")
PY
fi
