#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/openclaw/klaude-repo}"
APP_DIR="$REPO_DIR/apps/mission-control"
ENV_FILE="$APP_DIR/.env.local"
LOG_FILE="/tmp/next-mission-control.log"
PID_FILE="/tmp/next-mission-control.pid"
MC_PORT="${MC_PORT:-3001}"
MC_HOST="${MC_HOST:-0.0.0.0}"
GATEWAY_URL="${GATEWAY_URL:-ws://100.93.24.14:27932}"
GATEWAY_ORIGIN="${GATEWAY_ORIGIN:-http://100.93.24.14:${MC_PORT}}"
GATEWAY_SCOPES="${GATEWAY_SCOPES:-operator.read,operator.write}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "mission-control app dir not found: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$HOME/.openclaw/openclaw.json" ]]; then
  echo "missing OpenClaw config: $HOME/.openclaw/openclaw.json" >&2
  exit 1
fi

TOKEN="$(python3 - <<'PY'
import json, pathlib
cfg = json.loads((pathlib.Path.home() / ".openclaw/openclaw.json").read_text())
print(cfg.get("gateway", {}).get("auth", {}).get("token", ""))
PY
)"

if [[ -z "$TOKEN" ]]; then
  echo "gateway token missing in ~/.openclaw/openclaw.json (gateway.auth.token)" >&2
  exit 1
fi

mkdir -p "$APP_DIR"
cat > "$ENV_FILE" <<EOF
OPENCLAW_GATEWAY_URL=$GATEWAY_URL
OPENCLAW_GATEWAY_TOKEN=$TOKEN
OPENCLAW_GATEWAY_ORIGIN=$GATEWAY_ORIGIN
OPENCLAW_GATEWAY_SCOPES=$GATEWAY_SCOPES
EOF
chmod 600 "$ENV_FILE"

pkill -f "next dev -H ${MC_HOST} -p ${MC_PORT}" >/dev/null 2>&1 || true

cd "$REPO_DIR"
nohup env \
  WS_NO_BUFFER_UTIL=1 \
  WS_NO_UTF_8_VALIDATE=1 \
  npm --prefix apps/mission-control run dev -- -H "${MC_HOST}" -p "${MC_PORT}" \
  >"$LOG_FILE" 2>&1 < /dev/null &
echo "$!" > "$PID_FILE"

sleep 3
echo "mission-control pid: $(cat "$PID_FILE")"
echo "listening:"
ss -ltnp | grep ":${MC_PORT}" || true
echo "openclaw status:"
curl -sS -m 8 "http://127.0.0.1:${MC_PORT}/api/openclaw/status" || true
echo
echo "log tail:"
tail -n 20 "$LOG_FILE" || true
