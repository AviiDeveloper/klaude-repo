# 2026-03-25_085 — Payment Flow Polish

## What changed
- Updated demo page (`apps/sales-dashboard/src/app/demo/[code]/page.tsx`):
  - Payment success now shows inline over the demo (no page redirect)
  - Stripe embedded checkout return_url points back to `/demo/{code}?session_id=`
  - Page detects `session_id` query param on load and shows done state
  - Purchase card is full-width on mobile (`left-4 right-4` instead of fixed width)
  - Added close (X) button to purchase card
  - Done state shows centered modal with green checkmark over blurred demo
  - Payment panel is full-screen on mobile, side panel on desktop
- Added QR code to ShareDemo component (`apps/sales-dashboard/src/components/ShareDemo.tsx`):
  - New "QR Code" button alongside WhatsApp, Text, Email
  - Full-screen QR modal with business name and demo code
  - Uses `qrcode.react` for SVG QR generation
- Installed `qrcode.react` in sales-dashboard
- Stripe checkout API updated: `return_url` now returns to demo page (not separate success page)

## Why
Payment flow needs to be perfect for real-world friend testing. Key improvements:
1. Customer never leaves the demo — pays while viewing their site (impulse conversion)
2. QR code enables business owner to scan and view demo on their own phone
3. Mobile-first design ensures flow works on salesperson's phone during in-person pitch

## Stack
- React (`qrcode.react` for QR generation)
- Stripe Embedded Checkout (`@stripe/react-stripe-js`)
- Next.js (sales-dashboard)

## Integrations
- Stripe Embedded Checkout (inline payment)
- QR code generation (client-side SVG)

## How to verify
1. Desktop: `http://localhost:4300/demo/preview-test` → Get this website → fill info → Pay £350 → Stripe panel slides in from right
2. Mobile: resize to 375px width → same flow → payment panel goes full-screen
3. QR code: from lead detail page → Share demo → Generate link → QR Code button → scan with phone
4. After payment: page shows inline "Payment received!" modal over blurred demo

## Known issues
- Webhook still needs public URL for Stripe to confirm payment (use `stripe listen --forward-to localhost:4300/api/payments/webhook` for local testing)
- "TEST MODE" badge visible on Stripe form (expected in sandbox — disappears with live keys)
