# Supabase Setup

Production data layer for the AI-Powered Salesperson Platform.
Handles all sales platform data: demos, pitches, salespeople, training, orchestration.

SQLite remains for Mission Control agent orchestration. The two coexist.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Select **London** region (closest to target market)
3. Set a strong database password and save it somewhere safe
4. Wait for the project to finish provisioning (~2 minutes)

## 2. Run the Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New query**
4. Paste the entire contents of `schema.sql` into the editor
5. Click **Run** (or Cmd+Enter)
6. Verify: go to **Table Editor** — you should see all 13 tables

## 3. Get Your Keys

1. Go to **Settings > API** in your Supabase dashboard
2. Copy these values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Service role key** (under `service_role`) — starts with `eyJ...`
   - **Anon key** (under `anon`) — starts with `eyJ...`

## 4. Configure Environment Variables

Add to your `.env.local` in each app that needs Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

For non-Next.js apps (mobile-api, orchestrator), use:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
```

## 5. Verify Connection

```typescript
import { createServiceClient } from '@klaude/supabase';

const supabase = createServiceClient();
const { data, error } = await supabase.from('system_config').select('*');
console.log(data); // Should show 11 default config rows
```

## Tables

| Table | Purpose |
|-------|---------|
| business_profiles | Scraped business data, location, category |
| demo_records | Generated demos with full design element vectors |
| pitch_outcomes | Close/reject/follow-up with salesperson-adjusted scores |
| salesperson_metrics | Running stats per salesperson |
| model_versions | ML model versioning and deployment status |
| training_runs | Vast.ai training run logs and metrics |
| decision_log | Every orchestrator decision with expected vs actual outcome |
| agent_state | Agent heartbeats and health status |
| system_config | Key-value configuration store |
| message_log | Inter-agent message bus log |
| targeting_scores | Category/region/SP-affinity scores |
| cost_log | Service cost tracking |
| validation_flags | Data quality flags for review |

## Security

- **RLS is enabled** on all tables
- Service role key bypasses RLS — use only server-side
- Anon key respects RLS — safe for client-side
- Never commit keys to git
- Rotate keys every 90 days
