# ADR-0014: SalesFlow Academy — Interactive Sales Training

**Status**: Proposed
**Date**: 2026-03-30
**Author**: System

## Context

New contractors sign up, see a dashboard full of leads, and freeze. The gap between "I signed up" and "I walked into my first business" is where most churn happens. Telling people "no experience needed" only works if you actually make that true.

## Vision

**SalesFlow Academy** — a Duolingo-style learning experience with an editorial, professional tone. Not gamey. Not corporate. Think: a well-designed course that respects your time, teaches through real scenarios, and makes you feel genuinely ready.

The experience should feel like scrolling through a beautifully designed magazine that occasionally asks you to think. Short lessons. Immediate feedback. Satisfying progression. No patronising mascots.

## Design Principles

1. **Bite-sized, not bite-sized-for-the-sake-of-it.** Each lesson is 2-3 minutes. But the content is dense and useful — no filler, no "great job!" after every tap.

2. **Learn by doing.** Every lesson ends with a decision. Not "select the correct answer" — more like "you're standing outside a barber shop at 11am. The owner is with a client. What do you do?" The answers aren't obviously right or wrong.

3. **Editorial voice.** The writing reads like advice from someone who's done this, not a compliance module. Direct. Opinionated. Occasionally dry. Never corporate.

4. **Show, don't quiz.** Instead of "what is the commission per sale?" after reading a slide that says "£50 per sale" — show a scenario where the number matters: "A client asks why it costs £350. You need to explain where that money goes. What do you say?"

5. **Progressive depth.** Surface-level on first pass. If they come back to review, the same scenario has a deeper layer — the advanced response, the nuance they missed.

## The Path

Visual progression modelled on Duolingo's path UI — a vertical scroll of nodes, each representing a lesson. Nodes are connected by a subtle line. Completed nodes are filled, current node pulses, locked nodes are dimmed.

```
◉ The Basics                    ← completed (filled)
│
◉ Reading the Room              ← completed
│
◎ Your First Words              ← current (pulsing)
│
○ The Demo Moment               ← locked (dimmed)
│
○ When They Say No
│
○ Closing
│
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
○ Working Smarter               ← advanced (unlocks after core)
│
○ Building Territory
```

Each node expands to show 3-5 micro-lessons within it. Completing all micro-lessons fills the node.

## Lessons

### Unit 1: "The Basics" (3 lessons, ~6 min total)

**1.1 — "What you're actually doing"**
> You're not a door-to-door salesman. You're walking into a business with something they genuinely need — a website that's already been built for them. The hard part is already done. Your job is to show it to them.

*Scenario*: You're at a pub explaining to a friend what your new side gig is. They ask "so what, you knock on doors?" Pick the response that best describes what you actually do.

**1.2 — "The numbers"**
> £350 upfront. £25/month. You get £50. The client gets a live website within 24 hours. No setup fees, no domain fees, no hidden costs.

*Scenario*: A salon owner says "three hundred and fifty quid?! My nephew could build one for free." How do you respond? (3 options, each with nuanced feedback — none are "wrong," but one is clearly strongest)

**1.3 — "Your tools"**
Quick tour of the app itself: lead cards, demo viewer, QR sharing, status updates. Interactive — tapping through actual UI patterns, not screenshots.

---

### Unit 2: "Reading the Room" (4 lessons, ~8 min)

**2.1 — "Before you walk in"**
> Stand outside for 10 seconds. Not creepily. Just look. Is it busy? Is the owner visible? Is there a website URL on the sign? These 10 seconds save you from walking into the wrong conversation.

*Interactive*: 5 storefront photos. For each: "Walk in now?" / "Wait" / "Skip this one" — with reasoning.

**2.2 — "The best prospects"**
> Takeaways. Barbers. Nail salons. Independent cafés. Tradespeople. These are businesses run by their owners, who make decisions on the spot. Chains, franchises, managed properties — skip them.

*Card sort*: 8 business types appear as cards. Drag into "good prospect" or "probably skip" — see the reasoning after.

**2.3 — "Using your intel"**
> Every lead card has intelligence: Google rating, reviews, services, trust badges, and topics to avoid. A 4.8-star barber who's "family run since 2014" is a different conversation than a 3.2-star takeaway with "previous negative review."

*Scenario*: Two lead cards side by side. "You have time for one more pitch today. Which lead do you visit, and why?"

**2.4 — "When to walk away"**
> Not every door is worth opening. If the owner is hostile, if they're mid-rush, if there's clearly a brand-new website on display — thank them and leave. Time spent on a dead lead is time not spent on a live one.

*Quick-fire*: 6 rapid scenarios (3 seconds each). "Stay or go?" — gut instinct training.

---

### Unit 3: "Your First Words" (3 lessons, ~5 min)

**3.1 — "The opener"**
> "Hi, I'm [name] — I work with a company that builds websites for local businesses. I've actually got one here that was made for yours — can I show you?"
>
> That's it. Thirteen seconds. The key is the last five words: "can I show you?" — you're asking for 30 seconds, not a purchase.

*Practice*: Fill-in-the-blank with your own name. Then: "The owner says 'I'm busy.' What's your one-sentence follow-up?"

**3.2 — "Body language"**
> Stand beside them, not opposite. Hand them the phone — don't hold it up. If they're behind a counter, angle the phone so they can see without leaning. Small things that change the dynamic from "I'm selling to you" to "I'm showing you something."

*Scenario*: Photo of a shop layout. "Where do you stand? Tap the spot." Feedback on positioning.

**3.3 — "Reading their face"**
> Three reactions you'll see in the first 10 seconds:
> - **Interested**: They lean in. They ask questions. Keep going.
> - **Polite**: They nod but don't engage. You have 30 more seconds — make them count.
> - **Hostile**: Arms crossed. "Not interested." Thank them and leave. Never argue.

*Interactive*: Three short text conversations. Identify which reaction you're getting and choose the right response for each.

---

### Unit 4: "The Demo Moment" (3 lessons, ~5 min)

**4.1 — "Let it speak for itself"**
> Don't describe the website. Show it. Hand them the phone. The moment they see their business name, their services, their actual Google reviews on a professional site — that's the pitch. Your job is to shut up for five seconds and let them react.

**4.2 — "What to point out"**
> After they've had the initial reaction:
> - "See how it pulls in your real reviews?"
> - "This is how it looks on mobile — which is how 70% of people would find you"
> - "Everything here is specific to your business — nothing generic"

*Practice*: A sample demo site scrolls. At specific moments, you're prompted: "What do you say here?" — choose from 3 options.

**4.3 — "The QR handoff"**
> Whether they say yes or "let me think about it," the QR code is your best friend. They scan it, the demo stays on their phone. They show their partner, their staff, their friend. The website does the selling after you leave.

---

### Unit 5: "When They Say No" (5 lessons, ~10 min)

The longest unit. The most important one. Each lesson covers 1-2 objections with deep, nuanced responses.

**5.1 — "We already have a website"**
> This is the most common objection, and it's the easiest to handle — because their existing website is almost certainly terrible. Don't say that. Say: "Can I show you what a modern version could look like? Just for comparison."

*Role-play*: Full conversation tree. Owner says "we already have one." You respond. They push back. You adapt. 3 turns deep.

**5.2 — "It's too expensive"**
> £350 sounds like a lot to someone who's never spent money on a website. It sounds like nothing to someone who's been quoted £2,000 by a web agency. Your job is to reframe: "It works out to less than a pound a day. And that includes hosting, the domain, maintenance — everything."

**5.3 — "I need to think about it"**
> This isn't a no. This is "convince me without pressure." Leave the QR code. Say "completely understand — the demo stays live for you to look at. I'll pop back in a few days." Then actually follow up.

**5.4 — "My nephew / friend does our website"**
> The nephew argument. Never dismiss it — it insults their relationship. "That's great that you have someone. This is more like a managed service — we handle hosting, updates, SEO, everything — so [nephew] doesn't have to maintain it."

**5.5 — "We just use Instagram / Facebook"**
> "Social media is great for engagement, but a website means you own your online presence. If Instagram changes their algorithm tomorrow — and they will — your website is still there."

*Each lesson*: Hear the objection → pick your response → see the ideal phrasing → understand *why* it works.

---

### Unit 6: "Closing" (3 lessons, ~5 min)

**6.1 — "The ask"**
> "Would you like to go ahead?" Five words. No tricks. No urgency. No "special offer if you sign today." Just a direct question. If they say yes: payment link. If they say no: QR code and follow-up date.

**6.2 — "After the sale"**
> Update the status. Log the outcome. The business gets their site within 24 hours. Your £50 is confirmed within 7 days. Move to the next lead.

**6.3 — "The referral ask"**
> Before you leave: "Do you know any other business owners around here who might be interested?" Referrals are the highest-conversion leads you'll ever get.

*Final quiz*: 8 questions covering the full journey. Not recall — application. "Given this scenario, what do you do?"

---

### Advanced Units (unlock after core 6)

**Unit 7: "Working Smarter"** — Route planning, time management, batch pitching, weekly targets. For people who are doing this seriously, not casually.

**Unit 8: "Building Territory"** — Social proof loops, revisit strategy, multi-decision-maker handling, earning £300+/week consistently.

## UI Specification

### The Path Screen (main training view)

**iOS**: Full-screen view accessible from ModeSelectView. White/light background (matches onboarding aesthetic — training is an extension of onboarding, not the dashboard).

**Layout**:
- Top: "SalesFlow Academy" wordmark + overall progress ("4 of 18 lessons complete")
- Center: Vertical scrolling path with connected nodes
- Each node: circle + unit title + lesson count + estimated time
- States: completed (filled, checkmark), current (pulsing ring), locked (gray, padlock)
- Bottom: "Continue" button fixed at bottom, jumps to current lesson

**Web**: `/training` route. Same path layout, wider content area. Sidebar shows unit list on desktop.

### Lesson Screen

**Layout**: Full-screen, immersive. No tab bar, no navigation chrome — just the content and a "Continue" / back button.

- **Text content**: Large serif-adjacent font (or system font at 18pt+), generous line height (1.7), max-width ~600px. Reads like a magazine article.
- **Key phrases**: Bold or highlighted in accent blue. Not every other word — only the insight.
- **Scenarios**: Card that slides up from bottom. Options are full-width buttons (not radio buttons). Selected option shows feedback inline — green border for strong choice, amber for okay, explanation text.
- **Role-play**: Chat-bubble style. Owner's message on left (gray), your options on right (blue). Feels like a messaging app.
- **Card sort / interactive**: Smooth drag-and-drop or tap-to-select. Subtle haptic feedback on correct/incorrect.
- **Progress**: Thin bar at top of lesson screen (within the unit, not the overall path).

### Completion

**Unit complete**: Filled node animation + "Unit complete" toast. No confetti. Clean.

**All core complete**: Full-screen "You're ready" moment — similar to onboarding done screen but with a confidence summary. "You scored 85% across all scenarios. You're better prepared than most."

**Review mode**: Completed units can be revisited. Scenarios shuffle so it's not just re-reading.

## Data Model

```sql
CREATE TABLE training_units (
    unit_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    estimated_minutes INTEGER,
    sort_order INTEGER NOT NULL,
    is_advanced BOOLEAN DEFAULT FALSE,
    lessons_json JSONB NOT NULL
);

CREATE TABLE training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    lesson_index INTEGER DEFAULT 0,
    status TEXT DEFAULT 'locked',       -- locked | available | in_progress | completed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    score FLOAT,                         -- 0-1 across all scenarios in unit
    UNIQUE(user_id, unit_id)
);

CREATE TABLE training_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    lesson_index INTEGER NOT NULL,
    scenario_id TEXT NOT NULL,
    selected_option INTEGER,
    score INTEGER,                       -- 1-3 (weak/okay/strong)
    responded_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API

```
GET    /training                  — Units list + user progress
GET    /training/:unitId          — Unit content (lessons_json) + progress
POST   /training/:unitId/start    — Begin unit
POST   /training/:unitId/respond  — Submit scenario response
POST   /training/:unitId/complete — Finish unit, calculate score
```

## Content Format

```json
{
  "lessons": [
    {
      "type": "editorial",
      "content": "You're not a door-to-door salesman...",
      "highlight": "Your job is to show it to them."
    },
    {
      "type": "scenario",
      "setup": "A salon owner says 'three hundred and fifty quid?!'",
      "options": [
        {
          "text": "Break down the value: hosting, domain, maintenance — all included for less than £1/day.",
          "score": 3,
          "feedback": "Strong. You reframed the cost without being defensive."
        },
        {
          "text": "Tell them it's a fair price compared to agencies who charge £2,000+.",
          "score": 2,
          "feedback": "Valid comparison, but it can feel dismissive of their concern."
        },
        {
          "text": "Offer a discount to close the deal.",
          "score": 1,
          "feedback": "Never discount. It undermines the value and your own commission."
        }
      ]
    },
    {
      "type": "roleplay",
      "messages": [
        { "role": "owner", "text": "We just use Facebook, we don't need a website." },
        {
          "role": "you",
          "options": [
            { "text": "Social media is great for engagement, but a website means you own your presence. If Facebook changes their algorithm — your site is still there.", "score": 3 },
            { "text": "A lot of businesses say that, but studies show websites convert better.", "score": 2 },
            { "text": "Facebook isn't enough anymore.", "score": 1 }
          ]
        },
        { "role": "owner", "text": "Hmm, I suppose that's true. But I wouldn't know how to manage a website." },
        {
          "role": "you",
          "options": [
            { "text": "That's the best part — we manage everything. Hosting, updates, changes. You don't touch anything unless you want to.", "score": 3 },
            { "text": "It's really easy, we'll show you.", "score": 1 }
          ]
        }
      ]
    },
    {
      "type": "quickfire",
      "prompt": "Stay or go?",
      "items": [
        { "situation": "Owner is on the phone, gestures you to wait.", "answer": "stay", "reason": "They acknowledged you — wait briefly." },
        { "situation": "Sign on door says 'No cold callers'.", "answer": "go", "reason": "Respect the sign. Come back another way (email/QR drop)." }
      ]
    }
  ]
}
```

## Integration Points

- **ModeSelectView**: Training button with progress ring (e.g., "4/18")
- **LeadsView**: Dismissible card at top: "Complete your training — 12 lessons left" until all core done
- **Profile**: "Academy" section showing completion status and confidence score
- **Analytics**: training_responses feeds into the analytics agent — which objections are hardest, correlation with close rates

## Build Order

1. Write all lesson content (editorial text + scenarios + role-plays) as JSON
2. Database tables + seed content
3. API endpoints in mobile-api
4. iOS: Path screen + lesson viewer + scenario/roleplay components
5. Web: `/training` route
6. Integration: ModeSelectView button, LeadsView card, Profile section
7. Analytics wiring

## What This Is Not

- Not a certification program with pass/fail
- Not gamified with XP, gems, or virtual currency
- Not mandatory — people who want to jump straight in can
- Not video-based (text + interactive only, for now)
- Not a chatbot or AI tutor — it's authored, opinionated content

The goal is simple: someone finishes these 18 lessons and feels like they've done this before, even though they haven't.
