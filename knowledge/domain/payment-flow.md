---
tags: [payment, stripe, commission, checkout]
related: [../entities/entity-lead.md, ../domain/lead-lifecycle.md]
---

# Payment Flow

Revenue comes from businesses purchasing their AI-generated website. Salespeople earn commission.

## Stripe Connect Setup

- Each salesperson onboards to Stripe Connect (express accounts).
- Onboarding endpoint: `POST /api/payments/connect-onboard` (sales-dashboard) or `POST /payments/connect-onboard` (mobile-api).
- Stripe account ID stored in Supabase `salesperson_metrics.stripe_connect_id`.

## Checkout Flow

1. Customer decides to buy → salesperson initiates checkout.
2. `POST /api/payments/create-checkout` creates a Stripe Checkout Session.
3. Customer pays → Stripe fires webhook to `POST /api/payments/webhook`.
4. Webhook confirms payment → lead status set to `sold`, `sold_at` timestamp set.
5. Commission calculated: `sale_price * salesperson.commission_rate`.
6. Platform takes its cut, remainder transferred to salesperson's Connect account.

## Payout Tracking

- Sales dashboard `/payouts` page shows: pending, paid, total commission.
- Mobile-api `/payments/status/:demo_id` checks payment state.
- `lead_assignments.commission_amount` stores the final commission for that sale.

## Environment Variables

- `STRIPE_SECRET_KEY` — server-side Stripe API key
- `STRIPE_PUBLISHABLE_KEY` — client-side (exposed to browser)
- `STRIPE_WEBHOOK_SECRET` — validates webhook signatures

## Key Files

- Sales dashboard: `apps/sales-dashboard/src/app/api/payments/` (3 routes)
- Mobile API: `apps/mobile-api/src/routes/payments.ts`
- Supabase: `salesperson_metrics` table, `pitch_outcomes` table
