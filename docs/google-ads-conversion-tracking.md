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
  → Supabase redirects to → /auth/callback?next=/studio
  → /auth/callback detects first verified login (profiles.last_login_at is empty)
  → Appends ?new_signup=true to redirect
  → /studio (or /onboarding in legacy menu-builder mode) loads
  → SignupConversionBeacon fires gtag conversion + PostHog signup_completed
```

Both `/register` and `/auth/signin` use the same `AuthOTPForm` component and the same `emailRedirectTo`, so new users are captured regardless of which form they used.

Do **not** paste Google's static event snippet into page HTML. The conversion is fired in JavaScript after the magic-link round trip. Google's site crawler will often keep saying the event snippet is missing; verify with Tag Assistant or a real signup instead.

---

## Code locations

| What | Where |
|------|-------|
| Global Google tag (loads on every page) | `src/app/layout.tsx` |
| First-login detection + `?new_signup=true` flag | `src/app/auth/callback/route.ts` (`isFirstVerifiedLogin`) |
| Conversion event (`gtag('event', 'conversion', ...)`) | `src/components/analytics/SignupConversionBeacon.tsx` |

### Global tag — `layout.tsx`

```js
gtag('js', new Date());
gtag('config', 'AW-XXXXXXXXX'); // NEXT_PUBLIC_GOOGLE_ADS_ID
```

Loaded conditionally — only renders if `NEXT_PUBLIC_GOOGLE_ADS_ID` is set, so it is safe in all environments.

### Conversion event — `SignupConversionBeacon.tsx`

```js
gtag('event', 'conversion', {
  send_to: `${NEXT_PUBLIC_GOOGLE_ADS_ID}/${NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL}`,
})
```

Fires once per first verified login when `?new_signup=true` is present. Mounted from the Studio shell and from `/onboarding` (including the waitlist branch). Studio-public mode preserves the query if `/onboarding` redirects to `/studio`.

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

2. **Cross-domain linking** — Go to Google Ads → Tools → Google tag → Settings → Cross-domain linking. Add:
   - `www.gridmenu.ai`
   - `gridmenu.ai`
   - the current Vercel deployment domain, if ads or magic links can land there

   Point campaigns at `https://www.gridmenu.ai` (apex currently 307s to www).

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

Then fire it from `SignupConversionBeacon` (or a dedicated helper) alongside or instead of the existing signup label.

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

Google Ads often shows "tag not found" / "No recent conversions" for 1–2 days, and the automated checker will not find the event snippet on the homepage (it is not in static HTML).

Reliable check:

1. Deploy with both env vars set (they are inlined at **build** time).
2. Open [Google Tag Assistant](https://tagassistant.google.com/) or Chrome DevTools → Network → filter `google`.
3. Complete a real new signup (magic-link click).
4. Confirm a request to `www.googleadservices.com/pagead/conversion/...` with this `send_to`.

To test locally, add the two `NEXT_PUBLIC_GOOGLE_ADS_*` vars to `.env.local` and restart `npm run dev`.

---

## Notes

- The Supabase magic link email contains a `supabase.co` URL — this is normal. It is an intermediary that verifies the token and then redirects to `/auth/callback`. Users pass through it invisibly.
- First verified login uses `profiles.last_login_at`, not Auth `created_at`. The Auth user exists as soon as the email is submitted.
- The conversion fires on `/studio` (studio-public) or `/onboarding` (legacy), after the auth round-trip is confirmed — not when the magic link is sent.
- Both `/register` and `/auth/signin` lead to the same conversion event. There is no need to instrument them separately.
