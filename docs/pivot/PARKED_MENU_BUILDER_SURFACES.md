# Parked menu-builder surfaces

Snapshot of the **pre-Chunk 8** GridMenu site: what each URL was for, and how to
reach it after the studio-first public cutover.

**Snapshot git HEAD:** `7e02743` (2026-08-13).  
**Chunk:** 8 — studio-first public cutover.  
**Policy:** park, do not delete. Routes stay at the same paths.

---

## How to restore the old public site

Menu-builder marketing is the default when flags are unset. To show the old
homepage, pricing cards, demo CTA, and Dashboard nav again:

```env
NEXT_PUBLIC_PRODUCT_MODE=menu-builder
NEXT_PUBLIC_ENABLE_LEGACY_MENUS=true
```

`NEXT_PUBLIC_ENABLE_PHOTO_STUDIO` can stay `true` if `/studio` should remain
available to entitled users. The studio-public surface (`isStudioPublicSurface()`)
is on only when **all three** are set:

```env
NEXT_PUBLIC_PRODUCT_MODE=photo-studio
NEXT_PUBLIC_ENABLE_LEGACY_MENUS=false
NEXT_PUBLIC_ENABLE_PHOTO_STUDIO=true
```

After Chunk 8, parked pages remain at the URLs below. In studio-public mode they
are removed from nav, footer, and sitemap, and most get `noindex`.

---

## Former primary CTAs (before Chunk 8)

| Surface | Label | Destination |
|---|---|---|
| Homepage hero (logged out) | Start with my menu | `/register` |
| Homepage hero (logged in) | Start with my menu | `/dashboard` |
| Homepage hero secondary | Try a demo menu | `/demo/sample` |
| Homepage final CTA | See pricing | `/pricing` |
| Support bottom CTA | Create Your Menu | `/register` |
| Auth magic-link default | — | `/auth/callback?next=/onboarding` |
| After onboarding complete | — | `/dashboard` (or `next` query) |

---

## Public marketing URLs

| URL | Pre-Chunk 8 purpose | After Chunk 8 (studio-public flags on) |
|---|---|---|
| `/` | Restaurant menu maker homepage | Studio waitlist homepage (rewritten). Old copy returns if flags restored. |
| `/pricing` | Creator Pack / Grid+ / Grid+Premium menu plans | Private-beta / contact page. Stripe checkout routes still exist. |
| `/register` | Account signup; waitlist banner when approval required | Same URL; Photo Studio waitlist copy. |
| `/demo/sample` | Interactive sample-menu demo | Parked. Removed from homepage + sitemap. `noindex`. Still works by URL. |
| `/support` | Menu-builder FAQs; Contact Us target | Rewritten Studio FAQs. Same URL. |
| `/privacy` | Privacy policy (menu + Chunk 7 Studio section) | Same URL; engineer-safe lead tweaks only. |
| `/terms` | Menu subscription / Creator Pack terms | Same URL; no full rewrite until legal review. |
| `/blog` | Menu-strategy article index | Parked. Hidden from footer. `noindex`. |
| `/blog/digital-vs-paper-menus` | Paper vs digital menus article | Parked. `noindex`. |
| `/blog/restaurants-cannot-control-inflation` | Menu agility / inflation article | Parked. `noindex`. |
| `/rate-limits` | Menu plan quotas and export retention | Parked. `noindex`. Linked from old support/pricing. |
| `/upgrade` | Redirects to `/pricing` | Still redirects; pricing content is waitlist in studio-public mode. |
| `/sgfnb` | Flyer redirect to `/?utm_source=flyer…` (`noindex`) | Unchanged; lands on whatever `/` currently is. |

---

## Auth and app URLs

| URL | Pre-Chunk 8 purpose | After Chunk 8 (studio-public flags on) |
|---|---|---|
| `/auth/signin` | Sign in to manage digital menus | Same URL; studio-oriented subtitle. Default post-login `/studio`. |
| `/auth/callback` | Magic-link callback; default `next=/onboarding` | Default `next=/studio`. |
| `/onboarding` | Restaurant name / type / cuisine; then dashboard | Still exists. Not the default post-login. Still gates parked **menu** routes. |
| `/dashboard` | Menu list, create menu, quotas | Parked from nav. Reachable by URL. Optional legacy banner. |
| `/dashboard/settings` | Restaurant, menu currency, billing | Billing kept; restaurant/menu-currency hidden when legacy nav is off. Waitlist-gated. |
| `/dashboard/menus/new` | Create a menu | Parked. Reachable by URL. |
| `/dashboard/menus/[menuId]` | Menu editor | Parked. Reachable by URL. |
| `/dashboard/menus/[menuId]/templates` | Menu template picker | Parked. Reachable by URL. |
| `/menus/[menuId]/upload` | Upload a paper menu photo | Parked. Reachable by URL. Onboarding-gated. |
| `/menus/[menuId]/extract` | Extraction progress | Parked. |
| `/menus/[menuId]/extracted` | Extracted items | Parked. |
| `/menus/[menuId]/template` | Template / layout | Parked. |
| `/menus/[menuId]/export` | PDF/PNG export | Parked. |
| `/studio` | Photo Studio (auth + access mode) | **Default post-login destination.** Waitlist / pending-invite states instead of 404. |
| `/checkout/success` | Stripe success → dashboard | Parked commerce; links should not promote Dashboard as the product home. |
| `/checkout/cancel` | Stripe cancel → dashboard | Same. |
| `/u/[userId]/[slug]` | Public published menu | Unchanged user-generated URL. Not in sitemap. |

Admin routes (`/admin`, Photo Control, user management) are unchanged.

---

## Related code

- Flags: `src/lib/product-mode.ts` (`isStudioPublicSurface`, `shouldShowLegacyMenuNav`)
- Header/footer: `src/components/ux/UXHeader.tsx`, `src/components/ux/UXFooter.tsx`
- Registration gating toggle: Admin Hub → User Management → `RegistrationGatingSettings`
