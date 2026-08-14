# Build Plan — Chunk 8: Studio-first public cutover

**Requirements refs:** §3.2, Q1/Q2, §9.3, §10 Phase 6 landing task, §16.1.

**Branch:** `main` (direct commits; no chunk branch).

## Goal

Present GridMenu to new visitors as an invite-only AI food photo studio. Park the
menu-builder public surface (do not delete it). Signed-in users land on `/studio`.
Public CTAs promise waitlist/invite, not “sign up and generate.”

## Decisions for this chunk

1. Brand stays **GridMenu**. Do not rename the logo to “GridMenu Photo Studio.”
2. Public site is studio-first. This supersedes the 2026-07-29 “keep homepage/CTAs unchanged” row.
3. Reuse `require_admin_approval` (Admin Hub registration gating) for waitlist vs auto-approve.
4. Keep `NEXT_PUBLIC_STUDIO_ACCESS_MODE` for who can open the editor. Do not auto-grant `studio_beta_access` on account approval.
5. Post-login default is `/studio`. Skip restaurant/menu onboarding for this path.
6. Pricing hides menu plan cards; private beta + contact only.
7. Worker-queue Generate, plating, and clutter-add are out of scope.
8. Legal ownership / Gemini-as-processor / Studio-beta Terms wait on [`STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md`](./STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md).

## Knowledge docs (this chunk)

- [`PARKED_MENU_BUILDER_SURFACES.md`](./PARKED_MENU_BUILDER_SURFACES.md) — old site URLs and how to restore them.
- [`PIVOT_REMAINING_WORK.md`](./PIVOT_REMAINING_WORK.md) — unfinished requirements/tracker/backlog items.
- [`STUDIO_PUBLIC_SEO.md`](./STUDIO_PUBLIC_SEO.md) — Chunk 8 SEO contract for later enhancement.
- [`STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md`](./STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md) — questions that need owner input.

## Reversibility

Visitor-facing copy and link changes branch on `isStudioPublicSurface()`:

- `NEXT_PUBLIC_PRODUCT_MODE=photo-studio`
- `NEXT_PUBLIC_ENABLE_LEGACY_MENUS=false`
- `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO=true`

Code defaults stay menu-builder-preserving when flags are unset. Menu routes remain at the same URLs.

## Scope

1. Flag helper + tests.
2. Auth default `next=/studio`; waitlist gate on `/studio` and Settings; pending-invite instead of 404 for `admin-only` non-admins; Google Ads signup fire moved off restaurant onboarding.
3. Homepage, layout SEO, JSON-LD, sitemap, nav/footer.
4. Pricing waitlist page; Support FAQ rewrite; register/sign-in copy; hide restaurant settings when legacy off.
5. `noindex` parked menu marketing pages.
6. Tracker + production backlog env intended values.

## Out of scope

- Studio Generate worker queue.
- Plating/vessel, clutter removal, garnish add, composition controls.
- Deleting menu routes or Stripe menu products.
- Full Terms rewrite and Privacy ownership/processor language.
- Production deploy commands.

## Acceptance criteria

- [x] With studio-public flags on, homepage/pricing/support/register do not sell the menu builder.
- [x] Menu routes remain reachable by URL and are omitted from sitemap / `noindex`.
- [x] Post-login lands on `/studio`; unapproved users see waitlist; `admin-only` non-admins see pending invite, not 404.
- [x] Google Ads signup still fires without restaurant onboarding.
- [x] Tests cover flags, redirects, sitemap, and waitlist-on-studio.
- [x] Knowledge docs and tracker updates land in the same commits as the work.
