#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export $(grep -v '^#' .env | xargs) 2>/dev/null || true
cd packages/db
uv run alembic -c alembic.ini upgrade head
echo "Migrations applied."
