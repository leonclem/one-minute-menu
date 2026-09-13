# Patch — Google Ads signup conversion (2026-09-13)

**Type:** Independent patch (Ads conversion tracking). No new product surface.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual.

**Goal:** Make the existing Google Ads signup conversion actually fire, and match
the conversion action Google emailed (`AW-18081721279/JihqCIbtgJ0cEL_XhK5D`).

## Change

- First verified login uses `profiles.last_login_at` (empty = new signup). Auth
  `created_at` was a 30-second window and missed magic-link clicks.
- One client fire path: `SignupConversionBeacon` on `/studio` and `/onboarding`
  (including waitlist). Studio-public redirects keep `?new_signup=true`.
- CSP allows `www.googleadservices.com` so the conversion pixel is not blocked.
- `getProfile` now maps `lastLoginAt`.

## Production deploy

Before the next `npm run deploy:vercel`:

1. In Vercel → Environment Variables → Production, set
   `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL=JihqCIbtgJ0cEL_XhK5D`
   (`NEXT_PUBLIC_GOOGLE_ADS_ID=AW-18081721279` is already correct).
2. Redeploy. `NEXT_PUBLIC_*` is baked in at build time.
3. Smoke: Tag Assistant or Network tab on a **new** magic-link signup, looking
   for `www.googleadservices.com/pagead/conversion/...`.

The Ads UI crawler will often still say the event snippet is missing — it is
not in homepage HTML by design.
