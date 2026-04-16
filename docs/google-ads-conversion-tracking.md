# Google Ads Conversion Tracking

This document covers how conversion tracking is implemented for GridMenu and how to set up new campaigns. The goal is to minimise overhead when adding future campaigns.

---

## How it works

The implementation uses the **"Manually with code"** approach — no Google Tag Manager, no automatic form detection. This is intentional because the registration flow uses magic links (not a traditional form post), which Google's automatic detection cannot reliably track.

### Flow

```
User submits email (/register or /auth/signin)
  → Supabase sends magic link email
  → User clicks link → supabase.co/auth/v1/verify?...
  → Supabase redirects to → /auth/callback?next=/onboarding
  → /auth/callback detects new user (created_at < 30s ago)
  → Appends ?new_signup=true to redirect
  → /onboarding page loads → gtag conversion event fires
```

Both `/register` and `/auth/signin` use the same `AuthOTPForm` component and the same `emailRedirectTo`, so new users are captured regardless of which form they used.

---

## Code locations

| What | Where |
|------|-------|
| Global Google tag (loads on every page) | `src/app/layout.tsx` |
| New user detection + `?new_signup=true` flag | `src/app/auth/callback/route.ts` |
| Conversion event (`gtag('event', 'conversion', ...)`) | `src/app/onboarding/onboarding-client.tsx` |

### Global tag — `layout.tsx`

```js
gtag('js', new Date());
gtag('config', 'AW-XXXXXXXXX'); // NEXT_PUBLIC_GOOGLE_ADS_ID
```

Loaded conditionally — only renders if `NEXT_PUBLIC_GOOGLE_ADS_ID` is set, so it is safe in all environments.

### Conversion event — `onboarding-client.tsx`

```js
gtag('event', 'conversion', {
  send_to: `${NEXT_PUBLIC_GOOGLE_ADS_ID}/${NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL}`,
})
```

Fires once per new signup when `?new_signup=true` is present in the URL.

---

## Environment variables

Set these in Vercel (production) and `.env.local` (local dev, optional):

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads account tag ID | `AW-18081721279` |
| `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL` | Conversion label for the signup action | `JihqCIbtgJ0cEL_XhK5D` |

The `send_to` value Google provides looks like `AW-18081721279/JihqCIbtgJ0cEL_XhK5D`. Split on `/`:
- Everything before `/` → `NEXT_PUBLIC_GOOGLE_ADS_ID`
- Everything after `/` → `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL`

---

## Google Ads setup (one-time per account)

1. **Name the Google tag** — Go to Google Ads → Tools → Google tag. Rename "Untitled tag" to something meaningful (e.g. "GridMenu"). This is cosmetic only and has no effect on tracking.

2. **Cross-domain linking** — Go to Google Ads → Tools → Google tag → Settings → Cross-domain linking. Add both domains:
   - `gridmenu.ai`
   - `one-minute-menu-51ppxzf9c-leon-clements-projects.vercel.app` (or current Vercel deployment domain)

   This prevents Google losing the session when Vercel redirects between domains. Without it, conversions can go unattributed.

---

## Setting up a new conversion action

When adding a new campaign that needs its own conversion tracking:

### In Google Ads

1. Go to **Goals → Conversions → + New conversion action**
2. Choose **Website**
3. Select **"Manually with code"**
4. Choose the appropriate category (e.g. Sign-up, Purchase, etc.)
5. Complete the setup — Google will provide a `send_to` value like `AW-18081721279/NEW_LABEL_HERE`

### In the codebase

**Option A — New conversion type on the existing signup flow**

Add a new env var for the label:

```
NEXT_PUBLIC_GOOGLE_ADS_<CAMPAIGN_NAME>_LABEL=NEW_LABEL_HERE
```

Then fire it alongside or instead of the existing event in `onboarding-client.tsx`:

```js
gtag('event', 'conversion', {
  send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${process.env.NEXT_PUBLIC_GOOGLE_ADS_<CAMPAIGN_NAME>_LABEL}`,
})
```

**Option B — Conversion on a different user action**

Place the `gtag('event', 'conversion', { send_to: '...' })` call at the point in the code where that action completes. Common candidates:

| Action | Where to add it |
|--------|----------------|
| Subscription purchase | After successful payment confirmation |
| Menu published | After publish API call succeeds |
| Export downloaded | After export file is delivered |

Keep the same pattern: check `typeof window.gtag === 'function'` before calling to avoid SSR errors.

### Deploy

1. Add the new env var in Vercel → Project Settings → Environment Variables (Production)
2. Redeploy (or it will pick up on next deployment)
3. No code changes needed to `layout.tsx` — the global tag already covers all pages

---

## Verification

After setup, Google Ads will show "No recent conversions" for 1–2 days even when working correctly. Once a real conversion comes through it will update to "Recording conversions".

To test locally, the `NEXT_PUBLIC_GOOGLE_ADS_ID` env var is intentionally not set in `.env.local` by default, so the global tag script does not load in development. You can add it temporarily to test the flow end-to-end.

---

## Notes

- The Supabase magic link email contains a `supabase.co` URL — this is normal. It is an intermediary that verifies the token and then redirects to `/auth/callback`. Users pass through it invisibly.
- The conversion fires on `/onboarding`, not on `/register` or `/auth/callback`. This is intentional — it fires after the full auth round-trip is confirmed, making it more accurate.
- Both `/register` and `/auth/signin` lead to the same conversion event. There is no need to instrument them separately.
