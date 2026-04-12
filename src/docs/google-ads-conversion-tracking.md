# Google Ads Conversion Tracking

How to add a new Google Ads conversion event to this project.

---

## How it works

The global `gtag.js` script is loaded in `src/app/layout.tsx` via env vars. When a conversion event fires (e.g. sign-up), we call `window.gtag('event', 'conversion', { send_to: '...' })` alongside the existing internal `trackConversionEvent` call.

---

## Adding a new conversion

### 1. Get your credentials from Google Ads

In Google Ads → Goals → Conversions → create or open a conversion action. Under **"Use Google Tag Manager"**, note:

- **Conversion ID** — format `AW-XXXXXXXXXX`
- **Conversion label** — the string after the `/` in the `send_to` value

### 2. Add env vars

In `.env.local` (dev) and your production environment (Vercel / Railway):

```env
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXXX          # shared across all conversions
NEXT_PUBLIC_GOOGLE_ADS_YOUR_EVENT_LABEL=your-label-here
```

> The `NEXT_PUBLIC_GOOGLE_ADS_ID` is already set — you only need to add a new label var per conversion action.

Also update `.env.production.example` so the pattern is documented for the team.

### 3. Fire the conversion event in code

Find the place in the codebase where the user action completes (form submit success, purchase confirmed, etc.) and add:

```ts
if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
  ;(window as any).gtag('event', 'conversion', {
    send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${process.env.NEXT_PUBLIC_GOOGLE_ADS_YOUR_EVENT_LABEL}`,
  })
}
```

Pair this with the existing `trackConversionEvent` call if one exists for the same action — they're independent and both should fire.

### 4. Verify it's working

1. Deploy (or run locally with the env vars set)
2. Open Chrome DevTools → Network tab → filter by `google`
3. Trigger the conversion action
4. You should see a request to `googleadservices.com/pagead/conversion/...` fire

Alternatively install the [Google Tag Assistant](https://tagassistant.google.com/) Chrome extension for a guided verification flow.

---

## Current conversions

| Event | Env var (label) | Fired in |
|---|---|---|
| Sign-up | `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL` | `src/components/auth/AuthOTPForm.tsx` |

---

## Notes

- The global `gtag('config', ...)` call in `layout.tsx` also enables the **Conversion Linker** automatically — no separate tag needed.
- The gtag script only loads when `NEXT_PUBLIC_GOOGLE_ADS_ID` is set, so local dev without the var is clean.
- Never fire conversion events server-side — `window.gtag` is client-only.
