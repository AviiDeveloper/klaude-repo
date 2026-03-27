## 2026-03-27 — Landing page restore + middleware public path fix

### What changed
- `apps/sales-dashboard/src/app/page.tsx` — restored full landing page (was previously lost/uncommitted). HMRC-safe design: no earnings guarantees, social proof framing, FAQ, CTA.
- `apps/sales-dashboard/src/components/ConditionalShell.tsx` — `/` excluded from AppShell so landing page renders without sidebar
- `apps/sales-dashboard/src/middleware.ts` — added `pathname === '/'` exact match as public path (no auth redirect for landing page); also added `/legal` to PUBLIC_PATHS

### Why
Landing page was built but never committed to git; Vercel was serving the old redirect-to-dashboard behaviour. User wanted the public recruitment page live at the root URL.

### Stack
Next.js 14 App Router, Tailwind CSS, Vercel

### Integrations
Vercel (salesflow-sigma.vercel.app)

### How to verify
1. Visit https://salesflow-sigma.vercel.app/ without being logged in — landing page renders (no redirect to /login)
2. "Get started" and "Start earning today" buttons link to /signup
3. "Already have an account" / "Log in" links go to /login
4. FAQ items expand/collapse
5. Footer links to /legal/privacy and /legal/terms

### Known issues
None
