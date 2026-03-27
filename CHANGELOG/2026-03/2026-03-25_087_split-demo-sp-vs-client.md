# 2026-03-25_087 — Split Demo Page: Salesperson View vs Client View

## What changed
- **Rewrote `/demo/[code]/page.tsx`** to detect viewer type and show different UIs:
  - **Salesperson view** (UUID code from dashboard) → full-screen demo + "Send to Client" button → share panel with Copy, WhatsApp, SMS, Email, QR Code
  - **Client view** (short code from shared link) → full-screen demo + "Get this website" CTA → payment wizard → Stripe embedded checkout
- Detection uses UUID regex: UUIDs = salesperson (assignment ID from dashboard), short codes = client (demo link code)
- Salesperson never sees the payment wizard or "Get this website" button
- Client never sees share options or salesperson UI

## Why
Salesperson and business owner have different needs when viewing the same demo. The SP needs to send the demo link to the client right there in the business. The client needs to view the demo and pay. Previously both saw the payment wizard which made no sense for the SP.

## Stack
- Next.js 14, React, Stripe Embedded Checkout, qrcode.react

## Integrations
- **Stripe** — embedded checkout for client payment flow
- **Supabase** — demo_links table for share link generation and tracking
- **Native share** — WhatsApp, SMS, Email via URL schemes

## How to verify
1. Log in as a salesperson at `salesflow-sigma.vercel.app`
2. Open a lead with a demo → tap "View Demo"
3. Should see full-screen demo + "Send to Client" button (NOT "Get this website")
4. Tap "Send to Client" → share panel with Copy/WhatsApp/SMS/Email/QR
5. Copy the link and open in incognito → should see "Get this website" + payment wizard

## Known issues
- None
