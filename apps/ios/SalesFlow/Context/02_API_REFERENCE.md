# Mobile API Reference

## Base URL
- **Development**: `http://localhost:4350`
- **Production**: TBD (will be a real HTTPS URL)

## Authentication
All requests except `/auth/login` and `/auth/register` require:
```
Authorization: Bearer {token}
```

Token is returned from login/register and should be stored in iOS Keychain.

---

## Endpoints

### POST /auth/login
Login with name + PIN.

**Request:**
```json
{
  "name": "demo",
  "pin": "1234"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "ceced2ae-4500-42eb-8589-c8647c799657",
    "name": "demo",
    "email": null,
    "phone": null,
    "area_postcode": "M1",
    "commission_rate": 0.10,
    "created_at": "2026-03-23T10:05:47.957Z"
  },
  "token": "eyJ1c2VyX2lkIjoi..."
}
```

**Response (401):**
```json
{ "error": "Invalid credentials" }
```

---

### POST /auth/register
Register a new salesperson account.

**Request:**
```json
{
  "name": "ahmed",
  "pin": "5678",
  "area_postcode": "M4",
  "phone": "07700900123"
}
```

**Response (201):**
Same shape as login response.

---

### GET /leads
Get all leads assigned to the authenticated user.

**Response (200):**
```json
{
  "leads": [
    {
      "id": "4f39184a-9ea7-49f0-8faf-35c0bca34f16",
      "lead_id": "test-greggs",
      "status": "new",
      "business_name": "Greggs",
      "business_type": "bakery",
      "postcode": "M1 2PF",
      "address": "M1 2PF, Manchester",
      "phone": "0161 000 0002",
      "google_rating": 4.2,
      "google_review_count": 312,
      "has_demo_site": true,
      "demo_site_domain": "greggs",
      "has_website": false,
      "follow_up_at": null,
      "contact_person": null,
      "contact_role": null,
      "opening_hours": ["Mon-Fri: 9:00-17:30", "Sat: 9:00-16:00", "Sun: Closed"],
      "services": ["Bread & Rolls", "Cakes", "Pastries", "Sandwiches"],
      "trust_badges": ["Baked Fresh Daily", "Custom Orders"],
      "avoid_topics": ["free quotes", "booking", "emergency"],
      "best_reviews": [
        { "author": "John D", "rating": 5, "text": "Absolutely brilliant service..." }
      ]
    }
  ]
}
```

**Status values:** `"new"` | `"visited"` | `"pitched"` | `"sold"` | `"rejected"`

---

### GET /leads/:id
Get full detail for a single lead. Same shape as individual item from `/leads`.

---

### PATCH /leads/:id/status
Update lead status with GPS verification.

**Request:**
```json
{
  "status": "visited",
  "lat": 53.4808,
  "lng": -2.2426
}
```

**Response (200):**
```json
{ "ok": true, "status": "visited" }
```

---

### POST /leads/:id/visit
Start or end a GPS-tracked visit session.

**Request (start):**
```json
{
  "action": "start",
  "lat": 53.4808,
  "lng": -2.2426
}
```

**Request (end):**
```json
{
  "action": "end",
  "lat": 53.4808,
  "lng": -2.2426
}
```

**Response (200):**
```json
{
  "session_id": "uuid",
  "duration_seconds": 342,
  "verified": true
}
```

---

### POST /leads/:id/photos
Upload a business photo. Multipart form data.

**Request:**
- `photo` — image file (JPEG)
- `category` — `"storefront"` | `"interior"` | `"business_card"` | `"menu"` | `"signage"`
- `lat` — GPS latitude (optional)
- `lng` — GPS longitude (optional)

**Response (200):**
```json
{ "photo_id": "uuid", "filename": "storefront_1234.jpg" }
```

---

### POST /leads/:id/intel
Save conversation intelligence from a visit.

**Request:**
```json
{
  "contact_person": "Ahmed",
  "contact_role": "Owner",
  "interest_level": "warm",
  "objections": ["too_expensive", "need_to_think"],
  "competitor_mentioned": "Wix",
  "best_time_to_return": "morning",
  "price_discussed": 350,
  "owner_sentiment": "friendly",
  "notes": "Liked the design, wants to show his wife"
}
```

---

### POST /leads/:id/demo-link
Generate a shareable demo link for the customer.

**Response (200):**
```json
{
  "code": "abc123",
  "url": "https://salesflow.co.uk/demo/abc123",
  "expires_at": "2026-04-23T10:00:00Z"
}
```

---

### GET /stats
Dashboard statistics for the authenticated user.

**Response (200):**
```json
{
  "queue": 5,
  "visited": 2,
  "pitched": 1,
  "sold": 0,
  "rejected": 0,
  "earned": 0,
  "visits_today": 2,
  "sales_today": 0,
  "visits_this_week": 4,
  "sales_this_week": 0,
  "total_commission": 0
}
```

---

### POST /location/track
Background GPS ping while at a business.

**Request:**
```json
{
  "session_id": "uuid",
  "lat": 53.4808,
  "lng": -2.2426
}
```

---

### POST /push/register
Register device for push notifications.

**Request:**
```json
{
  "token": "ExponentPushToken[xxx]",
  "platform": "ios"
}
```
