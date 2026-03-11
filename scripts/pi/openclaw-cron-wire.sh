#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <job_id> <every_ms> [mission_control_url]"
  echo "example: $0 content-automation-default 3600000 http://127.0.0.1:4317"
  exit 1
fi

JOB_ID="$1"
EVERY_MS="$2"
MC_URL="${3:-http://127.0.0.1:4317}"
TRIGGER_TOKEN="${MISSION_CONTROL_CRON_TRIGGER_TOKEN:-}"

if [[ -z "$TRIGGER_TOKEN" ]]; then
  echo "error: MISSION_CONTROL_CRON_TRIGGER_TOKEN is required"
  exit 1
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "error: openclaw CLI not found in PATH"
  exit 1
fi

MESSAGE=$(cat <<EOF
Use bash tool. Execute exactly:
curl -fsS -X POST '${MC_URL%/}/api/jobs/${JOB_ID}/trigger' \
  -H 'content-type: application/json' \
  -H 'x-mc-cron-token: ${TRIGGER_TOKEN}' \
  -d '{}'
Return only: trigger_status=<ok|failed> and one-line reason.
EOF
)

NAME="mc-trigger-${JOB_ID}"

echo "Creating OpenClaw cron job: ${NAME}"
openclaw cron add \
  --name "${NAME}" \
  --every "${EVERY_MS}" \
  --session isolated \
  --message "${MESSAGE}" \
  --announce

echo "Done. Validate with:"
echo "  openclaw cron list"
echo "  openclaw cron run <jobId>"
