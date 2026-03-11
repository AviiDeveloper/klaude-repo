#!/usr/bin/env bash
set -euo pipefail

LOCAL_REPO="${LOCAL_REPO:-/Users/Avii/Desktop/klaude-repo}"
PI_HOST="${PI_HOST:-openclaw@pi400}"
REMOTE_REPO="${REMOTE_REPO:-/home/openclaw/klaude-repo}"
MC_HOST="${MC_HOST:-0.0.0.0}"
MC_PORT="${MC_PORT:-3001}"
SSH_OPTS="${SSH_OPTS:--o ServerAliveInterval=20 -o ServerAliveCountMax=6 -o ConnectTimeout=10}"

ssh_run() {
  # shellcheck disable=SC2086
  ssh ${SSH_OPTS} "${PI_HOST}" "$@"
}

echo "[1/5] Syncing repo to ${PI_HOST}:${REMOTE_REPO}"
rsync -az --progress \
  --exclude '.git' \
  --exclude '.env.local' \
  --exclude 'apps/mission-control/.env.local' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude 'coverage' \
  --exclude 'mission-control.db*' \
  "${LOCAL_REPO}/" "${PI_HOST}:${REMOTE_REPO}/"

echo "[2/5] Installing/building on Pi"
ssh_run "cd '${REMOTE_REPO}' && npm install && npm --prefix apps/mission-control install && npm --prefix apps/mission-control run build -- --no-lint"

echo "[3/5] Restarting Mission Control on Pi"
ssh_run "\
  mkdir -p /home/openclaw/.config/systemd/user && \
  printf '%s\n' \
    '[Unit]' \
    'Description=Mission Control Next.js (klaude-repo)' \
    'After=network.target' \
    '' \
    '[Service]' \
    'Type=simple' \
    'WorkingDirectory=${REMOTE_REPO}/apps/mission-control' \
    'Environment=NODE_ENV=production' \
    'ExecStart=/usr/bin/env npm run start -- -H ${MC_HOST} -p ${MC_PORT}' \
    'Restart=always' \
    'RestartSec=3' \
    '' \
    '[Install]' \
    'WantedBy=default.target' \
    > /home/openclaw/.config/systemd/user/mission-control-next.service && \
  systemctl --user unmask mission-control-next.service >/dev/null 2>&1 || true && \
  systemctl --user daemon-reload && \
  systemctl --user enable mission-control-next.service >/dev/null 2>&1 || true && \
  pids=\$(lsof -ti tcp:${MC_PORT} || true); \
  if [ -n \"\$pids\" ]; then kill -9 \$pids || true; fi; \
  systemctl --user restart mission-control-next.service \
"

echo "[4/5] Verifying service"
ssh_run "\
  sleep 4; \
  systemctl --user --no-pager --full status mission-control-next.service | sed -n '1,24p'; \
  ss -ltnp | grep :${MC_PORT}; \
  curl -sS -m 10 http://127.0.0.1:${MC_PORT}/api/workspaces >/dev/null \
"

TAILSCALE_IP="$(ssh_run "tailscale ip -4 2>/dev/null | head -n1" | tr -d '\r')"
if [ -n "${TAILSCALE_IP}" ]; then
  URL="http://${TAILSCALE_IP}:${MC_PORT}/workspace/default/lead"
else
  URL="http://100.93.24.14:${MC_PORT}/workspace/default/lead"
fi

echo "[5/5] Ready"
echo "Mission Control URL: ${URL}"
