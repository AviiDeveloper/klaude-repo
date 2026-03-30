# ADR-0014: Interactive Sales Training Module

**Status**: Proposed
**Date**: 2026-03-30
**Author**: System

## Context

The platform recruits salespeople with zero experience and tells them "no experience needed." Currently, the only guidance is:
- Onboarding slides (4 pitch screens during signup)
- A help modal in ProfileView (6 generic steps)
- Objection handlers embedded in lead detail cards

This is insufficient. Most new contractors will feel unprepared walking into their first business. The drop-off between signup and first pitch is the highest-risk churn point.

## Decision

Build an interactive, module-based sales training course embedded in both the iOS app and web dashboard. Training is **optional but encouraged** — the dashboard is accessible immediately, but a persistent badge/prompt drives completion. Training progress syncs across platforms.

## Training Architecture

### Modules (6 core + 2 advanced)

#### Core modules (unlock sequentially)

**Module 1: "How This Works"** (5 min)
- What you're actually selling (website service, not a product)
- The pricing: £350 upfront + £25/month — what the client gets
- Your commission: £50 per closed sale, paid weekly
- The demo site: AI-generated, personalised, already built
- **Quiz**: 3 questions on pricing and commission

**Module 2: "Reading a Business"** (8 min)
- What to look for before walking in (signage, foot traffic, existing web presence)
- Best business types (takeaways, salons, tradespeople, retailers)
- When NOT to walk in (busy periods, obvious chains, hostile reception)
- Using the lead card intel (reviews, trust badges, services, avoid topics)
- **Interactive**: "Would you walk in?" — 5 business scenarios with photos

**Module 3: "The Approach"** (6 min)
- Opening line: "Hi, I'm [name] — I work with a company that builds websites for local businesses like yours"
- The 10-second hook: show the demo on your phone immediately
- Body language: confident but not pushy, stand beside not opposite
- Reading the room: interested vs polite vs hostile — when to continue, when to leave a card
- **Role-play**: Text-based conversation sim — 3 scenarios

**Module 4: "The Demo Walkthrough"** (7 min)
- How to present the demo site (hand the phone, don't describe — let them see)
- What to point out: their business name, real services, mobile-friendly
- The "surprise and delight" moment: "This was made specifically for your business"
- Handling "how much?" early — redirect to value first
- **Practice**: Guided demo walkthrough with prompts (using a sample demo site)

**Module 5: "Handling Objections"** (10 min)
- The 8 most common objections with proven responses:
  1. "We already have a website" → "Can I show you what a modern one looks like for comparison?"
  2. "We don't need a website" → "Most of your customers Google before they visit..."
  3. "It's too expensive" → "It works out to less than £1 a day..."
  4. "I need to think about it" → "Completely understand — can I leave you with this?" (QR code)
  5. "My nephew does our website" → "That's great — this is professionally maintained so [nephew] doesn't have to..."
  6. "We use social media" → "A website means you own your online presence..."
  7. "Business is slow right now" → "That's exactly when visibility matters most..."
  8. "I've been burned before" → "We offer a 14-day cancellation window..."
- **Interactive**: Objection cards — hear the objection, choose the best response, see the ideal answer

**Module 6: "Closing and After"** (5 min)
- The close: "Would you like to go ahead?" — simple, direct, no tricks
- Payment flow: what happens when they say yes (Stripe link, instant)
- After the sale: update status, log the outcome, move to next lead
- Follow-up strategy: when to go back, how to leave a QR code
- The referral: "Know any other business owners who might be interested?"
- **Quiz**: 5 questions covering the full sales process

#### Advanced modules (unlock after all core completed)

**Module 7: "Scaling Your Day"** (6 min)
- Route planning: cluster leads geographically
- Time management: best hours to pitch (10am-12pm, 2pm-4pm)
- Batch pitching: aim for 8-12 doors per session
- Tracking your conversion funnel: visits → pitches → sales
- Weekly earning targets and how to hit them

**Module 8: "Advanced Techniques"** (8 min)
- Social proof: "I just set up [nearby business] last week"
- The revisit strategy: when and how to go back to a "maybe"
- Building a territory: becoming the known person in an area
- Handling multiple decision makers ("I need to ask my partner")
- Upsell awareness: recognising clients who might want more later

### UI Design

#### iOS — Training Tab or Section

**Option A: Fifth tab** — "Learn" tab with graduation cap icon
- Pro: Always visible, easy to access
- Con: 5 tabs is crowded, may reduce tab bar usability

**Option B: Section in ModeSelectView** — Third mode button: "Sales Training"
- Pro: Clean, doesn't add tab clutter
- Con: Hidden behind mode select, less discoverable

**Option C: Card in LeadsView** — Pinned training card at top of leads list until completed
- Pro: In-context, impossible to miss
- Con: Takes space from lead list

**Recommendation**: Option B (mode select) + Option C (pinned card until completion). The training section is a full-screen experience accessed from mode select. A dismissible card in LeadsView shows progress and nudges completion.

#### Screen structure (per module)

1. **Module intro** — title, estimated time, what you'll learn (3 bullets)
2. **Lesson slides** — swipeable cards with text + illustrations (no video in MVP)
3. **Interactive checkpoint** — quiz, scenario card, or role-play
4. **Module complete** — checkmark + what's next

#### Web dashboard — `/training` route

Same module content rendered as a full-page experience. Left sidebar shows module list with completion states. Main area shows current lesson content. Responsive — works on mobile web too.

### Data Model

```sql
-- Module definitions (static, seeded)
CREATE TABLE training_modules (
    module_id TEXT PRIMARY KEY,          -- 'mod-01', 'mod-02', etc.
    title TEXT NOT NULL,
    description TEXT,
    estimated_minutes INTEGER,
    sort_order INTEGER,
    is_advanced BOOLEAN DEFAULT FALSE,
    content_json JSONB                   -- Lessons, quizzes, scenarios
);

-- User progress (per salesperson)
CREATE TABLE training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,               -- FK to sales_users
    module_id TEXT NOT NULL,             -- FK to training_modules
    status TEXT DEFAULT 'locked',        -- locked | available | in_progress | completed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    quiz_score FLOAT,                    -- 0-1, percentage correct
    quiz_attempts INTEGER DEFAULT 0,
    current_lesson INTEGER DEFAULT 0,    -- Index of current slide
    UNIQUE(user_id, module_id)
);

-- Individual quiz/scenario responses (for analytics)
CREATE TABLE training_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    selected_answer TEXT,
    is_correct BOOLEAN,
    responded_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

```
GET    /training/modules          — List modules with user's progress
GET    /training/modules/:id      — Module content + lessons
POST   /training/modules/:id/start    — Mark module as in_progress
POST   /training/modules/:id/complete — Submit quiz, mark complete
POST   /training/responses        — Log individual quiz response
GET    /training/progress         — Overall training progress summary
```

### Content Format (content_json)

```json
{
  "lessons": [
    {
      "type": "text",
      "title": "What You're Actually Selling",
      "body": "You're not selling a product...",
      "highlight": "The demo is already built before you walk in."
    },
    {
      "type": "scenario",
      "prompt": "You walk into a busy salon at 11am. The owner is cutting hair. What do you do?",
      "options": [
        { "text": "Wait until they finish and approach", "correct": true, "feedback": "Good — shows respect for their time." },
        { "text": "Interrupt and pitch immediately", "correct": false, "feedback": "Never interrupt someone with a client." },
        { "text": "Leave and come back later", "correct": false, "feedback": "You could, but a brief wait shows initiative." }
      ]
    },
    {
      "type": "roleplay",
      "setup": "You've just shown the demo to a restaurant owner. They say:",
      "dialogue": [
        { "speaker": "owner", "text": "This looks nice but we already have a Facebook page." },
        { "options": [
          { "text": "A website means you own your online presence — Facebook can change their algorithm any time.", "score": 3 },
          { "text": "Facebook isn't the same as a website.", "score": 1 },
          { "text": "Most customers Google 'restaurant near me' — they find websites, not Facebook pages.", "score": 3 }
        ]}
      ]
    }
  ],
  "quiz": [
    {
      "id": "q1",
      "question": "How much commission do you earn per sale?",
      "options": ["£25", "£50", "£75", "£100"],
      "correct": 1
    }
  ]
}
```

### Gamification (lightweight)

- **Progress bar** in mode select: "3/6 modules complete"
- **Badge** on leads tab until training is done
- **Completion celebration**: confetti animation + "You're certified!" screen
- **Confidence score**: based on quiz accuracy across all modules (shown in profile)
- No leaderboards, no streaks — this isn't a game, it's preparation

### Analytics Value

Training response data feeds the self-learning system:
- Which objections are hardest for salespeople → improve scripts
- Which modules have lowest completion → improve content
- Correlation between training scores and close rates → prove ROI
- Which scenarios people get wrong → target those in follow-up tips

### Build Order

1. **Database**: Create tables, seed module content
2. **API**: Training endpoints in mobile-api
3. **iOS**: Training section UI (module list → lesson slides → quiz)
4. **Web**: `/training` route mirroring iOS content
5. **Integration**: Pinned card in LeadsView, progress in profile
6. **Analytics**: Wire training_responses into the analytics agent

### Cost Estimate

- **Content writing**: 2-3 hours to write all 8 modules
- **iOS UI**: 1-2 sessions (module list, lesson viewer, quiz components)
- **Web UI**: 1 session (reuse content, different layout)
- **API + DB**: 1 session
- **Total**: ~4-5 development sessions

## Consequences

**Positive**:
- Dramatically reduces first-pitch anxiety
- Provides structured path from signup to first sale
- Training data improves the platform's scripts and objection handlers
- Legal protection: documented training for commission-only workers
- Differentiator vs competitors who just dump leads and hope

**Negative**:
- Content must be maintained and updated as pricing/process changes
- Risk of over-training: people spend too long studying instead of doing
- Module content is opinionated — may not suit all personality types

**Mitigations**:
- Keep modules short (5-10 min each)
- "Optional but encouraged" gating — don't block the doers
- Version content_json so updates don't break progress
- A/B test training vs no-training cohorts to measure actual impact

## Decision

Approved for implementation. Build in the order specified above, starting with database schema and module content authoring.
