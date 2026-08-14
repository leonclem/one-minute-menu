# Studio public SEO — Chunk 8 approach

Contract for the studio-first public site. Use this in a later chat to enhance
SEO without rediscovering intent. Branding decision: keep **GridMenu** in the
logo and titles; do not launch as “GridMenu Photo Studio.”

**Chunk:** 8. **Good enough to ship; not a full SEO programme.**

---

## Positioning

New visitors should not learn that GridMenu is a menu builder. The public promise
is an **invite-only AI food photo studio**: upload a real dish photo, apply
controls (not prompts), get a commercial image.

Do **not** claim “sign up and generate.” Waitlist / invite only.

---

## Shipped metadata (studio-public flags on)

| Field | Value |
|---|---|
| Title | `AI Food Photo Studio \| GridMenu` |
| Description | `Turn a real dish photo into polished commercial food images — no prompts. Control lighting, background, and surface. Private beta, invite only.` |
| H1 | `Turn real dish photos into menu-ready images` |
| OG image | Existing `/logos/social-1200x630.png` (alt text updated; no new photography in this chunk) |

Starter keywords (not stuffed into a `keywords` meta tag):

- AI food photography
- food photo editor
- restaurant dish photos
- delivery-app food photos

---

## Index vs noindex vs sitemap

**Indexed (in `src/app/sitemap.ts` when studio-public):**

- `/`
- `/pricing` (waitlist/contact page, not menu plans)
- `/register`
- `/support`
- `/privacy`
- `/terms`

**Not in sitemap; `noindex` in studio-public mode:**

- `/demo/sample`
- `/blog` and blog articles
- `/rate-limits`
- `/upgrade` (redirects)

**Never in sitemap:**

- `/studio` (auth-gated)
- `/dashboard`, `/menus/*`, `/onboarding`, `/checkout/*`
- `/u/[userId]/[slug]` (user-generated public menus)
- `/sgfnb` (already `noindex`)

`public/robots.txt` stays `Allow: /` plus sitemap URL. Parked pages rely on
per-page `robots: { index: false }`, not a `Disallow` list.

When studio-public flags are **off**, sitemap and metadata revert to the
menu-builder set (including `/demo/sample`).

---

## JSON-LD

Shipped on the homepage (studio variant):

- `WebSite` — name GridMenu, studio description, site URL
- `FAQPage` — studio waitlist FAQs (not menu-creation FAQs)

Support page keeps `FAQPage` aligned with the rewritten FAQs.

**Not adding in Chunk 8:** `Product`, extra `Organization`, software application
schema, or breadcrumb lists.

---

## Code owners

| Concern | File |
|---|---|
| Site-wide default title/description/OG | `src/app/layout.tsx` |
| Marketing layout fallback | `src/app/(marketing)/layout.tsx` |
| Home title/description | `src/app/(marketing)/page.tsx` |
| Home hero + JSON-LD | `src/app/(marketing)/HomePageContent.tsx` (studio vs menu variants) |
| Sitemap | `src/app/sitemap.ts` |
| PWA description | `public/manifest.json` |
| Tests | `src/__tests__/unit/homepage-seo.test.tsx`, `src/__tests__/unit/seo-jsonld.test.tsx` |
| Flag | `isStudioPublicSurface()` in `src/lib/product-mode.ts` |

---

## Explicitly out of scope (enhance later)

- New OG / social / hero photography.
- Keyword research beyond the starter list; Search Console setup.
- Redirect / canonical strategy for old “restaurant menu maker” SERP URLs.
- Rewriting or noindexing blog content beyond `noindex` + hide footer link.
- hreflang, international targeting.
- Adding `/studio` to the sitemap if it ever becomes a public landing page.
- Google Ads landing-page path cleanup beyond moving the signup conversion off restaurant onboarding.

When enhancing: keep the waitlist/invite promise until access mode is deliberately
opened; do not imply self-serve generation in titles or descriptions.
