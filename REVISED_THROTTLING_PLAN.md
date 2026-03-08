# Revised Throttling Implementation Plan (v2)

## Context

A Free plan user was able to generate many images and repeatedly create/publish/delete menus over a 12-hour demo session. The demo crossed midnight, which reset the daily per-item generation limit (20/day for Free). Monthly quota (20/month) was likely consumed but the daily reset allowed continued generation across different items.

---

## Changes Overview

| # | Change | Priority |
|---|--------|----------|
| 1 | Database-backed rate limiting service (replaces in-memory) | HIGH |
| 2 | Per-minute rate limiting on image generation | HIGH |
| 3 | Plan-differentiated batch size limits with inter-item delay | HIGH |
| 4 | PDF/HTML/Image export rate limiting (2-3/min Free, cooldown) | HIGH |
| 5 | Remove menu deletion for Free plan users | HIGH |
| 6 | Update /pricing page with rate limit differentiators | MEDIUM |
| 7 | Public rate limits & fair use page (linked from /support) | MEDIUM |
| 8 | Export button UI: cooldown countdown | MEDIUM |

---

## 1. Database-Backed Rate Limiting

### Why not Redis/Upstash?
- No additional services, no extra cost, no architectural complexity
- PostgreSQL is already in the stack and handles this workload fine
- Rate limit checks are infrequent relative to DB capacity

### When might this need revisiting?
At roughly 10,000+ rate-limit checks per minute sustained, the DB could feel pressure. For context, that would mean ~170 concurrent users all hitting rate-limited endpoints every second. At that scale you'd likely already be scaling other parts of the system, and adding Upstash Redis (a single env var + SDK) would be straightforward. For now, PostgreSQL is more than adequate.

### Schema

```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_type, window_start)
);

CREATE INDEX idx_rate_limits_lookup 
  ON rate_limits(user_id, action_type, window_end);
```

### Risks & Mitigations
- **Write amplification:** Each rate-limited request does an upsert. Mitigated by the index and the fact that these are small rows with short TTLs.
- **Stale rows:** Expired windows accumulate. Mitigated by a daily cleanup (DELETE WHERE window_end < NOW() - INTERVAL '7 days'), triggered by a Supabase cron or a lightweight scheduled function.
- **Cold start:** Unlike in-memory, DB state persists across deployments and serverless cold starts. This is a feature, not a bug.

### Service Interface

```typescript
// src/lib/rate-limiting.ts
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds?: number
}

export async function checkRateLimit(
  userId: string,
  actionType: string,
  plan: User['plan']
): Promise<RateLimitResult>
```

---

## 2. Image Generation Per-Minute Limits

Added on top of existing daily (per-item) and monthly quotas.

| Plan | Per Minute | Per Item/Day | Per Month |
|------|-----------|--------------|-----------|
| Free | 5 | 20 | 20 |
| Grid+ | 15 | 100 | 100 |
| Grid+Premium | 30 | 250 | 1,000 |

### Implementation
In `/api/generate-image`, after auth and before quota check:

```typescript
const rateCheck = await checkRateLimit(user.id, 'image_generation', plan)
if (!rateCheck.allowed) {
  return NextResponse.json({
    error: 'Please wait a moment before generating more images.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: rateCheck.retryAfterSeconds
  }, { status: 429 })
}
```

---

## 3. Batch Generation: Plan-Differentiated Limits & Delay

Currently, batch generation is capped at 20 items for all users with no inter-item delay. This means a Free user can fire off 20 sequential API calls in rapid succession.

### Proposed Limits

| Plan | Max Batch Size | Inter-Item Delay |
|------|---------------|-----------------|
| Free | 5 | 3 seconds |
| Grid+ | 15 | 1 second |
| Grid+Premium | 20 | 500ms |

### Implementation

**Server-side:** Return batch limits in a new lightweight endpoint or piggyback on the existing quota check response:

```typescript
// In quota status response, add:
batchLimits: {
  maxBatchSize: 5,    // plan-dependent
  delayMs: 3000,      // plan-dependent
}
```

**Client-side (BatchAIImageGeneration.tsx):**
- Replace hardcoded `MAX_BATCH_ITEMS = 20` with plan-based value
- Add `await sleep(delayMs)` between items in `runBatchGenerationSequential`
- Show the batch limit in the UI: "You can generate up to 5 items at a time on the Free plan. Upgrade for larger batches."

**batch-generation.ts:**
```typescript
// Add delay between items
for (let index = 0; index < items.length; index++) {
  if (index > 0 && options.delayMs) {
    await sleep(options.delayMs)
  }
  // ... existing generation logic
}
```

### UX Consideration
When a batch has failures, the user currently has to close the dialog and scroll to find which items failed. The batch dialog already shows per-item status (queued/processing/completed/failed). We should:
- Keep the dialog open after completion with a clear summary
- Add a "Retry Failed" button that re-runs only the failed items
- Highlight failed items in red with the error reason visible

---

## 4. Export Rate Limiting (PDF/HTML/Image)

### Limits

| Plan | Exports/Minute | Cooldown After Limit |
|------|---------------|---------------------|
| Free | 3 | 5 minutes |
| Grid+ | 10 | 1 minute |
| Grid+Premium | 20 | 30 seconds |

All export types (PDF, HTML, image) share the same limits since they're all CPU-intensive rendering operations.

### Implementation
In each export route (`/api/templates/export/pdf`, `/api/templates/export/html`, `/api/templates/export/image`, `/api/export/jobs`):

```typescript
const rateCheck = await checkRateLimit(user.id, 'export', plan)
if (!rateCheck.allowed) {
  return NextResponse.json({
    error: `Export limit reached. Try again in ${rateCheck.retryAfterSeconds}s.`,
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: rateCheck.retryAfterSeconds,
    resetAt: rateCheck.resetAt.toISOString()
  }, { status: 429 })
}
```

### UI: Export Button with Cooldown
The "Export PDF" button on the template page should:
- Show a countdown timer when in cooldown: "Export available in 3m 45s"
- Disable the button during cooldown
- Show remaining exports: "2 of 3 exports remaining"

---

## 5. Remove Menu Deletion for Free Plan

### Rationale
Simplest way to prevent the create→export→delete→repeat cycle. Free plan menus are locked for editing after the edit window expires but remain viewable. Deletion is a paid feature.

### Corrected Language
Free plan menus after edit window expiry are **locked for editing and exporting**, not "archived". The menu remains publicly viewable.

### API Change
In `/api/menus/[menuId]/route.ts` DELETE handler:

```typescript
const profile = await userOperations.getProfile(user.id)
if (profile?.plan === 'free') {
  return NextResponse.json({
    error: 'Menu deletion is available on Grid+ and above.',
    code: 'FEATURE_NOT_AVAILABLE',
    upgrade: {
      cta: 'Upgrade to Grid+',
      href: '/pricing',
      reason: 'Unlock menu deletion and manage up to 5 menus.'
    }
  }, { status: 403 })
}
```

### UI Change
- Hide delete button/menu option for Free plan users
- Show tooltip or info text: "Menu deletion is available on Grid+ and above"

---

## 6. Update /pricing Page

The current pricing page lists features like "Unlimited image regenerations (fair-use capped*)" for all plans. We should differentiate with specific numbers.

### Proposed Feature List Updates

**Creator Pack (Free):**
- "1 Fully customisable menu"
- "Unlimited menu edits for 1 week"
- "20 AI image generations per month"
- "Batch photo creation: up to 5 items"
- "3 PDF exports per minute"
- "All templates included"
- "Print-ready PDF Menu Export"
- "Exported PDF menu storage for 30 days"

**Grid+:**
- "Up to 5 active menus"
- "Unlimited menu edits"
- "100 AI image generations per month"
- "Batch photo creation: up to 15 items"
- "10 exports per minute"
- "All templates included"
- "Priority support"
- "Print-ready PDF Menu Export"
- "Social media ready PNG Menu Export"
- "Priority rendering queue"
- "All menu items image export"
- "Exported PDF menu storage for 90 days"

**Grid+Premium:**
- "Unlimited active menus"
- "Unlimited menu edits"
- "1,000 AI image generations per month"
- "Batch photo creation: up to 20 items"
- "20 exports per minute"
- ... (rest unchanged)

### Fair Use Note
Update the existing asterisk note to link to the new rate limits page:
```
*Fair-use limits apply. See our rate limits & fair use policy for details.
```

---

## 7. Public Rate Limits & Fair Use Page

### Location
`/app/(marketing)/rate-limits/page.tsx` (or `/fair-use`)

### Content
A clean, tabular page showing all user-facing limits by plan:

| Feature | Free / Creator Pack | Grid+ | Grid+Premium |
|---------|-------------------|-------|-------------|
| AI Image Generations | 20/month | 100/month | 1,000/month |
| Batch Size | 5 items | 15 items | 20 items |
| Exports per Minute | 3 (5min cooldown) | 10 (1min cooldown) | 20 (30s cooldown) |
| Active Menus | 1 | 5 | Unlimited |
| Menu Items | 40 | 500 | Unlimited |
| Menu Deletion | Not available | Yes | Yes |
| OCR Extractions | 2/hour, 5/month | 20/hour, 100/month | 60/hour, Unlimited |
| Export Storage | 30 days | 90 days | 180 days |

Note: Railway worker limits and internal architectural details are excluded since they're not user-facing.

### Link from Support Page
Add a FAQ entry or link in `/app/support/page.tsx`:
```
Q: What are the rate limits?
A: See our [Rate Limits & Fair Use Policy](/rate-limits) for a full breakdown by plan.
```

---

## 8. Export Button Cooldown UI

### Behaviour
When a user hits the export rate limit:
1. Button becomes disabled
2. Shows countdown: "Export available in 4m 32s"
3. Shows remaining count before limit: "2 exports remaining"
4. Auto-re-enables when cooldown expires

### Implementation
The export API already returns `retryAfter` and `resetAt` in 429 responses. The client needs to:
1. Catch 429 responses
2. Store the `resetAt` timestamp
3. Run a countdown timer
4. Re-enable the button when the timer expires

---

## Implementation Order

### Phase 1: Core Rate Limiting (This Sprint)
1. Create `rate_limits` table migration
2. Implement `src/lib/rate-limiting.ts` service
3. Add per-minute limit to `/api/generate-image`
4. Add export rate limiting to PDF/HTML/image routes
5. Block menu deletion for Free plan (API + UI)
6. Add inter-item delay to batch generation

### Phase 2: UX & Visibility (Next Sprint)
7. Update batch generation component with plan-based limits
8. Add "Retry Failed" to batch dialog
9. Export button cooldown UI
10. Update /pricing page features
11. Create /rate-limits page
12. Link from /support

---

## Open Questions

None — ready to implement pending your confirmation.
