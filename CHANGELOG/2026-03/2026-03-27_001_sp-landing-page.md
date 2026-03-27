# 2026-03-27_001 — Salesperson Recruitment Landing Page

## What changed
- **Replaced root page (`/`)** — was a redirect to `/dashboard`, now a full recruitment landing page
- **Sections:** Hero with "Earn £50" headline, How It Works (4 steps), Interactive Earnings Calculator (slider), What You Get (4 perks), FAQ (6 collapsible questions), Final CTA, Footer with legal links
- **Updated `ConditionalShell.tsx`** — excludes `/` from the AppShell sidebar
- **Updated `middleware.ts`** — added `/` as a public path (no auth required)

## Why
Need a public-facing page to link from recruitment ads (Instagram, Facebook). Converts visitors into salesperson signups. Previously the root URL just redirected to the dashboard which requires login.

## Stack
- Next.js 14, React, Tailwind CSS, Lucide React icons

## Integrations
- None — pure frontend, no API calls

## How to verify
1. Visit `salesflow-sigma.vercel.app/` (logged out or incognito) — landing page shows
2. No sidebar visible
3. "Start Earning" → `/signup`
4. "Log in" → `/login`
5. Earnings calculator slider updates numbers in real time
6. FAQ questions expand/collapse on click
7. Footer links go to legal pages

## Known issues
- None
