#!/usr/bin/env bash
# Replace {{INFYRO_ROOT}} placeholders in runtime configs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
sed "s|{{INFYRO_ROOT}}|$ROOT|g" "$ROOT/runtimes/openclaw/openclaw.json" > "$ROOT/runtimes/openclaw/openclaw.local.json"
sed "s|{{INFYRO_ROOT}}|$ROOT|g" "$ROOT/runtimes/hermes/config.yaml" > "$ROOT/runtimes/hermes/config.local.yaml"
echo "Wrote openclaw.local.json and hermes/config.local.yaml"
