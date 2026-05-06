# Analytics Implementation

## Overview

GridMenu implements three independent analytics surfaces:

1. **Vercel Analytics** (`src/components/VercelAnalytics.tsx`) — traffic and Core Web Vitals.
2. **First-party menu analytics** (`src/lib/analytics-client.ts` + `src/lib/analytics-server.ts`) — menu page views and platform/generation metrics persisted to Supabase.
3. **PostHog product analytics** (`src/lib/posthog/`) — end-to-end user-journey funnels, per-user event timelines, and session replay with privacy masking.

All three systems run in parallel and in separate modules. The PostHog integration does not replace or modify the other two systems.

---

## PostHog Integration

### Environment Variables

All PostHog configuration comes from environment variables. Set these in Vercel (or `.env.local` for local development):

| Variable | Required? | Default | Purpose |
|----------|-----------|---------|---------|
| `NEXT_PUBLIC_POSTHOG_TOKEN` | No (absent disables PostHog) | — | PostHog project token |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | `https://us.i.posthog.com` | Ingest host (`api_host`); may be a managed reverse proxy domain |
| `NEXT_PUBLIC_POSTHOG_UI_HOST` | No | omitted from init | PostHog app URL (`https://us.posthog.com` or `https://eu.posthog.com`) — **NOT** an ingest host such as `https://us.i.posthog.com`. Only required when `NEXT_PUBLIC_POSTHOG_HOST` points to a managed reverse proxy custom domain. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | No (must be `"true"`) | not enabled | Global analytics master switch |

### Local Enable/Disable

To enable PostHog locally:
1. Copy `.env.production.example` to `.env.local`
2. Set `NEXT_PUBLIC_POSTHOG_TOKEN=your_token`
3. Set `NEXT_PUBLIC_ENABLE_ANALYTICS=true`

To disable PostHog locally (default): leave `NEXT_PUBLIC_ENABLE_ANALYTICS` unset or set to anything other than `"true"`.

### Admin Opt-Out

Admins can exclude their own browser from PostHog analytics to prevent internal testing from polluting product metrics.

- **Toggle location**: Admin Hub → Developer tab → "Exclude my activity from analytics"
- **Storage**: `localStorage` key `gridmenu_analytics_disabled` = `"true"` (browser-local only, no server round-trip)
- **Behavior**: When enabled, PostHog is opted out immediately. When disabled, PostHog re-initializes if all other gates pass.

### Event Naming Conventions

- All event names are lowercase `snake_case`
- All events are defined in `src/lib/posthog/events.ts` as `ANALYTICS_EVENTS` constants
- Application code MUST use `ANALYTICS_EVENTS.*` constants — never raw strings
- Import pattern: `import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'`

### Implemented Events and Trigger Locations

#### Prioritized Events (Req 4)

| Event | Trigger Location | Properties |
|-------|-----------------|------------|
| `homepage_viewed` | `src/app/(marketing)/HomepageAnalytics.tsx` — `useEffect` on mount | none |
| `cta_clicked` | Marketing/pricing CTA click handlers | `{ location, label }` |
| `signup_completed` | `src/app/onboarding/onboarding-client.tsx` — after session confirmed | none |
| `menu_creation_started` | `src/app/dashboard/menus/new/` — on new draft creation | `{ creation_session_id }` |
| `menu_image_uploaded` | Upload success handler | `{ source, file_type }` — no `file_name` |
| `menu_extraction_completed` | `src/app/menus/[menuId]/extracted/extracted-client.tsx` — `onJobComplete` | `{ item_count, category_count, duration_ms }` |
| `template_selected` | Template chooser component | `{ template_id, template_name, orientation }` |
| `food_photo_generated` | `src/components/AIImageGeneration.tsx` — on successful generation | none |
| `pdf_export_started` | `src/components/dashboard/MenuCard.tsx` — before network call | `{ menu_id, template_id, orientation }` |
| `pdf_exported` | `src/components/dashboard/MenuCard.tsx` — at client-visible completion | `{ menu_id, template_id, orientation, page_count }` |
| `checkout_started` | `src/app/(marketing)/pricing/PricingPageContent.tsx` — before Stripe redirect | `{ plan, location: 'pricing_page' }` |

#### Secondary Events (Req 5)

| Event | Trigger Location | Properties |
|-------|-----------------|------------|
| `pricing_viewed` | `src/app/(marketing)/pricing/PricingPageContent.tsx` — `useEffect` on mount | none |
| `signup_started` | `src/components/auth/AuthOTPForm.tsx` — first focus of email field (once per mount) | none |
| `menu_extraction_started` | `src/app/menus/[menuId]/extract/extract-client.tsx` — before `/api/extraction/submit` | none |
| `menu_extraction_failed` | `src/app/menus/[menuId]/extract/extract-client.tsx` — on extraction error | `{ error_code }` |
| `food_photo_generation_started` | `src/components/AIImageGeneration.tsx` — at click of generate | none |
| `food_photo_generation_failed` | `src/components/AIImageGeneration.tsx` — on generation error | `{ error_code }` |
| `pdf_export_failed` | `src/components/dashboard/MenuCard.tsx` — on export error | `{ error_code }` |
| `menu_item_edited` | `src/app/menus/[menuId]/extracted/extracted-client.tsx` — on successful `handleUpdateItem` | none |

### Session Replay Privacy and Masking

PostHog session replay is configured with maximum privacy defaults:

- `maskAllInputs: true` — every `<input>`, `<textarea>`, `<select>` is masked
- `maskInputOptions: { password: true, email: true }` — belt-and-suspenders for PII input types
- `maskTextSelector: '*'` — every rendered text node is masked (protects menu text, dish names, descriptions)

Selective unblocking of safe UI labels (button text, tab labels) can be done via `.ph-no-mask` CSS class — but the default posture is maximum privacy.

### Sensitive Properties Deny-List

The following property keys are automatically stripped from every `captureEvent` and `identifyUser` call by the sanitizer in `src/lib/posthog/sanitize.ts`:

```
email, phone, full_name, name, address, billing_address, payment, password,
dish_name, dish_description, menu_text, file_name, prompt
```

For `*_failed` events, only `{ error_code }` is forwarded — never raw error messages, stack traces, or user content.

### User Identification

- **Distinct ID**: Supabase `user.id` (UUID) — never email, phone, or name
- **Trigger**: `auth.onAuthStateChange` listener in `src/lib/posthog/useAnalyticsIdentify.ts`
- **Person properties forwarded**: `role`, `plan`, `subscription_status`, `is_admin`, `is_approved`, `created_at`
- **No `account_id`**: GridMenu has no separate account/tenant entity; `user.id` fully identifies the account

### Logout / Reset Behavior

When the user signs out (Supabase `SIGNED_OUT` event), `resetAnalytics()` is called to clear the PostHog distinct ID and session data, preventing cross-user data leakage.

### Pre-Initialization Event Queue

Events captured during the small window between page load and `posthog.init()` completion are held in a bounded in-memory FIFO queue:

- **Capacity**: 20 entries maximum (events beyond 20 are silently dropped)
- **Storage**: Memory-only — no `localStorage`, no IndexedDB, no `sendBeacon`
- **Gating**: Consent, opt-out, and env checks run at enqueue time — the queue never holds blocked events
- **Flush**: Flushed in FIFO order once `posthog.init()` completes via the `loaded` callback
- **Unload**: If init never completes during the page's lifetime, the queue is garbage-collected on unload

This means up to 20 early events (e.g. `homepage_viewed` fired before PostHog finishes loading) are reliably forwarded. Events beyond the 20-entry cap are silently dropped.

---

## Deliberate Scope Exclusions

### `subscription_started` — Intentionally NOT Auto-Wired

`subscription_started` is in the event registry but is intentionally NOT automatically wired in this spec. Post-checkout subscription outcomes are tracked manually via PostHog funnels and Stripe webhook data rather than by an automatic client-side capture. The event remains in the registry for future manual instrumentation.

### PDF Generation Pipeline — Intentionally NOT Instrumented

The PDF generation pipeline running on the Railway worker (production) and Docker (local) is intentionally NOT instrumented by PostHog. Only the client-side export intent (`pdf_export_started`) and client-visible completion signal (`pdf_exported`) are captured. The worker-side rendering process is out of scope.

---

## TODO: Secondary Events Pending Code Path

The following Secondary_Events are in the registry but their corresponding code paths do not yet exist in the codebase. They are recorded here per Req 5.2 and will be wired when the code paths are implemented:

- **`login_completed`** — The auth callback (`src/app/auth/callback/route.ts`) is a server-side route handler with no browser context. There is no reliable client-side code path that distinguishes a returning user login from a new signup at the point the session is confirmed. A client-side listener (e.g. in `useAnalyticsIdentify.ts` on `SIGNED_IN` for non-new users) could be added when this distinction is needed for funnel analysis.

---

## PostHog Managed Reverse Proxy — Deployment Checklist

> **Note**: This is a manual deployment/operations checklist, outside the code acceptance criteria.

To route PostHog ingest through a managed reverse proxy (improves resilience against ad blockers):

1. **Create managed proxy** in PostHog dashboard → Settings → Managed reverse proxy
2. **Add DNS CNAME** for your chosen GridMenu subdomain (e.g. `edge.gridmenu.ai`) pointing at PostHog's returned target
   - **Subdomain naming note**: Choose a neutral subdomain that does not hint at analytics. Avoid `analytics`, `tracking`, `telemetry`, `posthog`, `ph`, `ph-*`, and `*-events` — ad-blocker rule lists actively target these patterns. `edge`, `assets`, or a project-specific name like `gm-edge` are good choices.
3. **Wait for SSL provisioning** — PostHog issues the certificate automatically
4. **Set `NEXT_PUBLIC_POSTHOG_HOST`** to the proxy domain (e.g. `https://edge.gridmenu.ai`) in Vercel
5. **Set `NEXT_PUBLIC_POSTHOG_UI_HOST`** to the actual PostHog app URL (`https://us.posthog.com` for US or `https://eu.posthog.com` for EU) in Vercel
   - This is the PostHog **app** URL — NOT an ingest host
6. **Redeploy** the application
7. **Verify** a pageview appears in PostHog's Events live stream via the proxy path

---

## Legacy First-Party Analytics

The sections below document the original first-party analytics system (pre-PostHog).

### Features

#### 1. Cookieless Tracking

- **Rotating Visitor IDs**: Uses localStorage to generate daily rotating identifiers
- **No Persistent Tracking**: Identifiers change every day, preventing long-term tracking
- **No Cookies**: Complies with privacy regulations without cookie consent banners
- **No IP Addresses**: Only aggregated counts are stored

#### 2. Menu Analytics

Restaurant owners can view:
- **Today's Views**: Page views for the current day
- **Today's Visitors**: Estimated unique visitors (approximate due to rotating IDs)
- **Last 7 Days**: Aggregated views and visitors over the past week
- **Daily Breakdown**: Table showing daily statistics

#### 3. Platform Analytics (Admin)

Platform administrators can monitor:
- **Platform-wide Metrics**: Total registrations, active users, OCR jobs, etc.
- **Geographic Usage**: Country-level usage patterns for compliance
- **System Health**: Processing times, success rates, error rates

#### 4. Data Retention Controls

- **Delete Original Photos**: After publishing, owners can delete original menu photos
- **Automatic Cleanup**: Analytics data can be configured to auto-delete after retention period
- **PDPA Compliance**: "Delete originals after publish" option for data minimization

#### 5. Abuse Prevention

- **Report Abuse**: Public reporting system for brand impersonation or inappropriate content
- **Takedown Process**: Simple workflow for reviewing and acting on reports
- **Reserved Slugs**: System prevents use of major brand names

### Implementation Details

#### Client-Side Tracking

```typescript
// Generate rotating visitor ID (changes daily)
const visitorId = getVisitorId()

// Track menu view
await trackMenuView(menuId)
```

#### Server-Side Analytics

```typescript
// Record a view
await analyticsOperations.recordMenuView(menuId, visitorId)

// Get analytics summary
const summary = await analyticsOperations.getMenuAnalyticsSummary(menuId)

// Get detailed history
const history = await analyticsOperations.getMenuAnalytics(menuId, 7)
```

### Privacy Compliance

#### GDPR Compliance
- ✅ No cookies or persistent identifiers
- ✅ No IP address collection
- ✅ Aggregated data only
- ✅ Daily identifier rotation
- ✅ Data minimization by design

#### PDPA Compliance (Singapore)
- ✅ Clear data retention controls
- ✅ "Delete originals after publish" option
- ✅ No unnecessary data collection
- ✅ Transparent privacy notices
