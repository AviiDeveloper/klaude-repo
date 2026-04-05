---
tags: [architecture, apps, overview, ports]
related: [../contracts/api-surface.md, ../contracts/database-architecture.md]
---

# App Overview

Six applications serving one business. Three are salesperson-facing, one is admin, one is orchestration, one is a mobile backend.

## Salesperson Apps

**Sales Dashboard** (`apps/sales-dashboard/`) — port 4300
- Next.js 14, deployed to Vercel
- Web interface for salespeople: view leads, track status, share demos, view payouts
- Auth: PIN + HMAC token (cookie for web, Bearer for mobile fallback)
- DB: SQLite (operations) + Supabase (demo storage)
- Pages: /dashboard, /lead/[id], /map, /payouts, /profile, /settings, /referrals, /help, /demo/[code]
- Also has /admin section for demo upload and lead assignment

**iOS App** (`apps/ios/salesflow/`) — SwiftUI native
- Native iPhone app for field salespeople
- Screens: login, leads list, lead detail, map view, demo share (QR/AirDrop), payouts, profile, training academy
- Talks to mobile-api (Express), NOT directly to sales-dashboard
- Offline support: SwiftData persistence, pending status updates, sync queue
- 5 bundled HTML demo sites for offline presentation

**Mobile App** (`apps/mobile/`) — Expo React Native
- Cross-platform alternative to iOS native app (less developed)
- Same screens as iOS but using React Native

## Backend

**Mobile API** (`apps/mobile-api/`) — port 4350
- Express.js backend serving iOS and mobile apps
- Same auth mechanism as sales-dashboard (shared SD_SECRET)
- Extra features: visit sessions, lead photos, offline sync, training academy
- Shares SQLite DB with sales-dashboard and admin-panel

## Admin

**Admin Panel** (`apps/admin-panel/`) — port 4400
- Next.js 14, internal tool
- Manage salespeople, view pipeline, assign leads, monitor performance
- Separate role-based auth (owner/manager/viewer), not PIN-based
- Shares SQLite DB with sales-dashboard

## Orchestration

**Mission Control** (`apps/mission-control/`) — port 3000
- Next.js 14, orchestration UI for the multi-agent system
- Manages workspaces, agents, tasks, evaluations, learning, costs
- Different domain from sales apps — this is the AI infrastructure layer
- Deployed to Raspberry Pi 400 via Tailscale

**Runtime** (`src/`) — port 4317
- TypeScript orchestration engine (OpenClaw multi-agent system)
- Agents: code agent, ops agent, outreach agents (brand analyser, brief generator, site composer)
- Pipeline: DAG execution with budget enforcement
- Own SQLite DB at `data/mvp.sqlite` (separate from sales DB)
