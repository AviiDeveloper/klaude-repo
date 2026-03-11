#!/usr/bin/env bash
set -euo pipefail

MC_PORT="${MC_PORT:-3001}"
MC_HOST="${MC_HOST:-0.0.0.0}"

pkill -f "next dev -H ${MC_HOST} -p ${MC_PORT}" >/dev/null 2>&1 || true
echo "stopped mission-control dev on ${MC_HOST}:${MC_PORT}"
