# Geo / currency detection – diagnosis (production)

Geo is used to suggest a default billing/menu currency (e.g. SGD in Singapore, GBP in UK). It is **not** required for correctness; the app works if geo fails (defaults to USD).

## How it works

- **IP-based (production):** Vercel sets `x-vercel-ip-country` on requests. The **server** API `GET /api/geo` reads this header and returns `countryCode`, `billingCurrency`, `menuCurrency`. This only works when the **client** calls `/api/geo`.
- **Client fallback:** If the client doesn’t get a result from `/api/geo`, it uses `detectLocation()` which:
  - Cannot read Vercel headers in the browser (always “undetected” from headers).
  - Falls back to `navigator.language` (e.g. `en-SG` → SG) with low confidence.

So for IP-based geo to work in production, the UI must call `/api/geo` when deciding the initial currency.

## Quick checks in production

1. **See what the geo API returns**
   - Open the pricing page (or any page that uses `BillingCurrencySelector`) with:
     - `https://your-production-domain.com/pricing?geo_debug=1`
   - Open DevTools → Console. You should see logs like:
     - `[BillingCurrencySelector] geo_debug=1 | URL params: ...`
     - `[BillingCurrencySelector] /api/geo response: { status: 200, data: { countryCode, billingCurrency, menuCurrency, detected } }`
   - If `data.detected === true` and `data.countryCode` is set, Vercel IP geo is working and the API is being used.
   - If `data.detected === false` or `countryCode: null`, the API is being called but Vercel is not sending a country (or you’re not hitting Vercel’s edge).

2. **Call the API directly**
   - In the same origin (production), open DevTools → Console and run:
     - `fetch('/api/geo').then(r => r.json()).then(console.log)`
   - Check the response:
     - `data.detected === true` and `data.countryCode` set → IP geo works; if the UI still shows USD, the UI likely isn’t calling `/api/geo` in the default path (see below).
     - `data.detected === false` → Vercel may not be setting `x-vercel-ip-country` for that request (e.g. region, proxy, or deployment type).

3. **Without `?geo_debug=1`**
   - For anonymous users with no stored currency, the intended behaviour is to call `/api/geo` once and use its result if `detected === true`, otherwise fall back to client `detectLocation()` (e.g. browser language). If the UI was not calling `/api/geo` in that path, geo would never work in production for first-time anonymous users; that has been fixed so the default path does call `/api/geo`.

## Common causes

| Symptom | Likely cause |
|--------|----------------|
| `?geo_debug=1` shows `detected: true` but normal visit always shows USD | Previously: UI didn’t call `/api/geo` in the default flow. Now fixed: default flow calls `/api/geo` when no stored currency. |
| `/api/geo` returns `detected: false` / `countryCode: null` in production | Vercel not sending `x-vercel-ip-country` (e.g. preview deployments, or request path not going through Vercel edge). |
| Works locally with `?country=SG` | Expected: dev override. Production uses IP from `/api/geo`. |

## Vercel notes

- Header used: `x-vercel-ip-country` (ISO 3166-1 alpha-2, e.g. `SG`, `US`).
- Set on requests that go through Vercel’s edge; may be missing on some preview or local builds.
- See [Vercel: Geo](https://vercel.com/docs/concepts/edge-network/headers#request-headers) for details.
