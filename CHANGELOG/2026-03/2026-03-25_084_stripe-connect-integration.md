# 2026-03-25_084 — Stripe Connect Integration

## What changed
- Created `packages/stripe/` — shared Stripe client library
  - `index.ts` — `getStripe()`, `createCheckoutSession()`, `constructWebhookEvent()`, `createConnectAccount()`, `createConnectOnboardingLink()`, `transferCommission()`
  - Constants: £350 site price, £27.50 monthly, £50 commission
- Created sales-dashboard API routes (using `stripe` + `@supabase/supabase-js` directly):
  - `POST /api/payments/create-checkout` — creates embedded Stripe Checkout Session (ui_mode: embedded)
  - `POST /api/payments/webhook` — handles `checkout.session.completed`, updates Supabase (pitch_outcomes, salesperson_metrics, cost_log)
  - `POST /api/payments/connect` — creates Connect Express account for salesperson, returns onboarding link
  - `POST /api/payments/payout` — transfers £50 commission to salesperson's Connect account
- Created mobile-api payment routes:
  - `POST /payments/checkout-url` — mobile checkout URL generation
  - `GET /payments/status/:demo_id` — check payment status
  - `POST /payments/connect-onboard` — salesperson Connect onboarding from mobile
- Updated `apps/sales-dashboard/src/app/demo/[code]/page.tsx`:
  - Embedded Stripe Checkout renders in a right-side panel while demo site stays visible
  - Uses `@stripe/react-stripe-js` EmbeddedCheckoutProvider
  - Flow: demo view → name → phone → notes → confirm → embedded payment panel → done
  - No page redirect — customer pays while viewing their site
- Created `apps/sales-dashboard/src/app/payment/success/page.tsx` — post-payment confirmation
- Created `apps/sales-dashboard/src/app/payment/cancelled/page.tsx` — cancellation page
- Fixed demo page data fetch (API wraps in `data` property)
- Wired payments route into `apps/mobile-api/src/index.ts`
- Created `apps/sales-dashboard/.env.local` with Supabase + Stripe keys
- Added Stripe env var placeholders to `.env.example`
- Installed `stripe`, `@supabase/supabase-js`, `@stripe/stripe-js`, `@stripe/react-stripe-js` in sales-dashboard

## Why
Platform needs payment processing to close sales. £350 upfront payment triggers fulfillment. Stripe Connect enables salesperson commission payouts. The `stripe_payment_confirmed` field in `pitch_outcomes` is the anti-poisoning gate for ML training data — only Stripe-confirmed closes count as valid training samples. Embedded checkout keeps the demo visible during payment to maximise impulse conversion.

## Stack
- Stripe API (`stripe` npm package)
- Stripe Embedded Checkout (`@stripe/react-stripe-js`, `@stripe/stripe-js`)
- Next.js API routes (sales-dashboard)
- Express.js routes (mobile-api)
- Supabase for payment state persistence

## Integrations
- Stripe Checkout Embedded (in-page payment form)
- Stripe Connect Express (salesperson payouts)
- Stripe Webhooks (payment confirmation)
- Supabase (pitch_outcomes, salesperson_metrics, cost_log)

## How to verify
1. Stripe sandbox account created and keys configured in `.env.local`
2. Navigate to `http://localhost:4300/demo/preview-test`
3. Walk through: Get this website → name → phone → notes → Pay £350
4. Embedded Stripe payment panel slides in from right
5. Pay with test card `4242 4242 4242 4242`
6. Verify Supabase tables have data (business_profiles, demo_records, pitch_outcomes, salesperson_metrics, cost_log)

## Known issues
- Webhook endpoint needs public URL for Stripe to reach (use Stripe CLI for local testing)
- Recurring monthly billing (£25-30/month) not yet implemented
- Fulfillment trigger on payment logged but not wired to Vercel deployment
- Auto-weekly payout scheduling not yet built (manual trigger only)
- Pre-existing FK constraint error in demo_links activity log (not caused by this change)
