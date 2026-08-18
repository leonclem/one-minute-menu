# Patch — Studio public homepage and SEO copy (2026-08-18)

**Type:** Independent patch (marketing copy / SEO, not a requirements phase / chunk).

**Requirements refs (adjacent):** Chunk 8 public cutover; Q2 landing page.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. No migration or
env var.

**Goal:** Public pages should describe self-serve Photo Studio (sign up, credits,
generate). Do not market waitlist/invite or a menu-builder product. Keep the
**Menu Pack** public name (100 credits sized for a small menu of dish photos).

## Change

Homepage:

- Hero secondary CTA: `How access works` → `See pricing`.
- Workflow H2: `How GridMenu works` → `How AI food photos work`.
- Removed FAQ `Does a menu subscription include Studio?` from
  `STUDIO_PUBLIC_FAQS` (homepage JSON-LD and Support share this list).

Pricing:

- Visible pack cards stay at the top. SEO H1 is visually hidden (`sr-only`):
  `Photo Studio credits`.
- Title: `Photo credits | GridMenu`. Menu Pack name/tagline unchanged.

Privacy:

- Collection copy is dish photos / images only (no “menu content”).

Housekeeping (public metadata and parked pages):

- Root layout, marketing layout, homepage metadata, PWA manifest, register,
  sign-in, and Support always use studio copy (no menu-maker fallback titles).
- Support no longer ships menu-builder FAQs.
- Register approval banner no longer says “exclusive waitlist”.
- Blog and rate-limits stay `noindex`; `keywords` meta tags removed; blog index
  description no longer sells digital-menu creation.

## Production deploy

None beyond the usual manual deploy of `main`. Recrawl `/`, `/pricing`, and
`/privacy` in Search Console after deploy.
