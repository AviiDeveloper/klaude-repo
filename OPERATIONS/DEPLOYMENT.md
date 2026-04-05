# Deployment Blueprint (Current Architecture)

## Services

### Raspberry Pi 400 (primary host via Tailscale)
- **Runtime** (`src/`) — 8-agent DAG pipeline, orchestrator, OpenClaw bridge, voice/telephony
  - Port 4317, systemd managed
  - Deployed via `scripts/pi/runtime-push-pi.sh`
- **Mission Control** (`apps/mission-control/`) — Next.js dashboard, SQLite, 50+ tables
  - Port 3001 on Pi (3000 local dev)
  - Deployed via `scripts/pi/mc-push-pi.sh`
- **Mobile API** (`apps/mobile-api/`) — Express backend for iOS app
  - Port 4350
  - Shares SQLite DB with Mission Control
- **Admin Panel** (`apps/admin-panel/`) — Role-based admin UI
  - Port 4400

### Vercel (cloud)
- **Sales Dashboard** (`apps/sales-dashboard/`) — Next.js salesperson app
  - Deployed via `vercel` CLI
  - Uses SQLite locally, Supabase for demo storage

### iOS (App Store / TestFlight)
- **SalesFlow** (`apps/ios/salesflow/`) — SwiftUI native app
  - Xcode build → TestFlight

### Not deployed (development only)
- **Mobile** (`apps/mobile/`) — React Native/Expo scaffold (placeholder)

## Database

Two databases:
1. **SQLite** (`mission-control.db`) — operational data, shared by MC + mobile-api + admin-panel + sales-dashboard
2. **Supabase PostgreSQL** — demo generation, ML, business profiles

## Startup Order (Pi)

1. SQLite DB auto-creates on first access (WAL mode)
2. Runtime process (systemd: `openclaw-runtime.service`)
3. Mission Control (systemd: `mission-control.service`)
4. Mobile API (manual or systemd)

## Deploy Commands

```bash
# Mission Control → Pi
LOCAL_REPO="<path>" PI_HOST="openclaw@100.93.24.14" bash scripts/pi/mc-push-pi.sh

# Runtime → Pi
LOCAL_REPO="<path>" PI_HOST="openclaw@100.93.24.14" bash scripts/pi/runtime-push-pi.sh

# Sales Dashboard → Vercel
cd apps/sales-dashboard && vercel --prod
```

## Agent Topology (8 agents)

Content pipeline: idea → research → script → code → ops → qa → publish → analytics
Outreach pipeline: brand-analyser → site-composer → screenshot → qc → publisher

Managed via DAG scheduler with node retries and blocked-dependency handling.
