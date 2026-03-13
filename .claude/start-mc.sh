#!/usr/bin/env bash
cd "$(dirname "$0")/../apps/mission-control" && exec npx --package=next@14.2.35 next dev --port "${1:-3000}"
