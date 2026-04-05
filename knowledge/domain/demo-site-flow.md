---
tags: [demo, website, conversion, supabase]
related: [../entities/entity-demo-link.md, ../architecture/database-architecture.md]
---

# Demo Site Flow

The core product: AI generates a custom website for a small business, and the salesperson shows it to close the sale.

## Generation Pipeline

1. **Business profile** scraped/created in Supabase `business_profiles` table (name, category, brand colours, Google data).
2. **Brand analysis** agent extracts design preferences (colour temperature, layout type, hero style, typography).
3. **Site composer** agent generates HTML demo stored at `demo_html_url` in Supabase `demo_records`.
4. **QC scoring** — automated quality check: `qc_score` (0-1), `qc_pass` boolean.

## Sharing Flow

1. Salesperson creates a **demo link** — generates a unique `code` (short string).
2. Link is shareable via URL, QR code (iOS), or AirDrop (iOS).
3. Customer visits the link → demo served from Supabase storage.
4. Each view increments `views` counter and sets `last_viewed_at`.

## Demo Link Statuses

```
active → viewed → interested → converted → expired
```

- **active** — Created, not yet viewed.
- **viewed** — Customer opened the link.
- **interested** — Customer submitted contact info (name, phone, email, message).
- **converted** — Customer purchased via Stripe checkout.
- **expired** — Link past `expires_at` date.

## Storage Split

- **Supabase**: `demo_records` (generated HTML, design metadata, QC scores), `business_profiles` (scraped data).
- **SQLite**: `demo_links` (shareable links, view tracking, customer capture). This is what the apps query.

## Key Files

- Demo serving: `apps/sales-dashboard/src/app/api/demo-site/[slug]/route.ts`
- Demo preview: `apps/sales-dashboard/src/app/api/demo-preview/[id]/route.ts`
- iOS bundled demos: `apps/ios/salesflow/DemoSites/` (5 HTML files for offline use)
