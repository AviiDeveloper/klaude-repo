# Business Logic & Intelligence

## Talking Points Engine (runs locally in the app)

The app generates contextual talking points from the lead data. NO AI/API call needed — pure logic.

### Rules:

```
IF has_website == false:
  → "No website detected — perfect candidate for a new site"

IF has_demo_site == true:
  → "Demo site ready — show them on your phone"

IF google_rating >= 4.5:
  → "Rated {rating}★ with {review_count} reviews — they clearly care about reputation"
ELSE IF google_rating >= 3.5:
  → "Rated {rating}★ with {review_count} reviews — a website helps attract more positive reviews"

IF avoid_topics is not empty:
  → "Don't mention: {avoid_topics joined by comma}"

IF trust_badges is not empty:
  → "Highlight: {trust_badges joined by comma}"

IF services is not empty:
  → "Their services: {services joined by comma}"

IF best_reviews is not empty:
  → 'Top review: "{review.text}" — {review.author}'

IF has_website == true AND website_quality_score < 30:
  → "They have a website but it's outdated — great upgrade opportunity"
```

## Opening Hours Logic

Parse the `opening_hours` strings to determine:
1. **Is open now?** — show green "Open" or red "Closed"
2. **Closes at X** — if open, show when they close
3. **Opens at X** — if closed, show when they next open
4. **Best time to visit** — don't visit restaurants during lunch rush (12-2pm)

## Commission Calculation

- £50 flat per sale (not percentage)
- Commission is earned when status changes to "sold"
- Projected monthly: (sales_this_week) * 4.33
- No commission for visited/pitched/rejected

## Status Transitions

Valid transitions:
```
new → visited → pitched → sold
new → visited → pitched → rejected
new → visited → rejected
new → rejected

Cannot go backwards (visited → new is not allowed)
```

## Follow-up Logic

- When follow_up_at is set and is today or past: show in "Due" section at top of dashboard
- Sort due follow-ups by date (oldest first)
- After a follow-up is actioned (visited or called), clear the follow_up_at

## Distance Calculation

If user's GPS and lead's postcode are available, show approximate distance.
Use UK postcode → lat/lng lookup or geocoding.
Sort leads by distance when in "Nearby" mode.

## GPS Visit Verification

A visit is "verified" if:
- GPS coordinates at visit start are within 100 meters of the business postcode
- This adds a verification badge to the visit record
- Unverified visits still count but are flagged

## Demo Site URLs

When a lead has `demo_site_domain`, the demo viewer URL is:
```
http://100.93.24.14:4200/site/{demo_site_domain}
```
For production this will be:
```
https://demo.salesflow.co.uk/site/{demo_site_domain}
```

The shareable customer link is different:
```
https://salesflow.co.uk/demo/{code}
```
Generated via POST /leads/:id/demo-link.

## Objection Handling Scripts

Built into the app (no API needed):

| Objection | Response |
|-----------|----------|
| "I don't need a website" | "63% of customers check online before visiting. Your competitors have websites — customers are choosing them instead. Let me show you what yours could look like." |
| "It's too expensive" | "£350 is less than 1 week of Yellow Pages advertising. And at £25/month, if your website brings in just ONE new customer a month, it's paid for itself." |
| "I need to think about it" | "Absolutely. Let me share this link so you can browse the site on your own time. No pressure — but the demo is only available for 30 days." |
| "I already have a website" | "When was it last updated? Can you edit it easily? Most small business sites are outdated. Let me show you what a modern one looks like for comparison." |
| "My nephew/son does my IT" | "That's great for tech stuff. But a professional website is about bringing in customers, not IT. Would your nephew do your accounting too?" |
| "Business is fine without one" | "I'm sure it is — you've got great reviews. But imagine if those {review_count} happy customers could find you even easier. A website works for you 24/7." |

## Price Breakdown Display

```
┌────────────────────────────┐
│ Website Setup      £350    │
│ ─ Custom design            │
│ ─ Mobile responsive        │
│ ─ Google optimised         │
│ ─ Contact form             │
│ ─ Google Maps embed        │
│ ─ Social media links       │
│                            │
│ Monthly Hosting    £25/mo  │
│ ─ SSL certificate          │
│ ─ Domain name              │
│ ─ Unlimited edits          │
│ ─ Email support            │
│ ─ Uptime monitoring        │
└────────────────────────────┘
```
