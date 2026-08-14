# Post-MVP to-do (after original pivot requirements)

The 16 July 2026 requirements document is **closed** (decision 2026-08-14).
This file is the leftover product and ops list — not open requirements that
block that document.

**Sources:** [`PIVOT_TRACKER.md`](./PIVOT_TRACKER.md),
[`PRODUCTION_DEPLOY_BACKLOG.md`](./PRODUCTION_DEPLOY_BACKLOG.md).

---

## Ops (next real-world step)

| Item | Notes |
|---|---|
| Production env cutover | Manual Vercel deploy + studio-public flags: `NEXT_PUBLIC_PRODUCT_MODE=photo-studio`, `NEXT_PUBLIC_ENABLE_LEGACY_MENUS=false`, `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO=true`, `NEXT_PUBLIC_STUDIO_ACCESS_MODE=admin-only`. See deploy backlog. |

---

## Product backlog (absorbed from the original include-list)

| Item | Notes |
|---|---|
| Clutter removal | No customer Studio control yet. |
| Garnish / sides **add** | FOH is remove-only; add remains admin Photo Control. |
| Plating / vessel library | Original Phase 7. Keep FOH off until quality is acceptable. |
| Studio Generate worker queue | Plan: `docs/STUDIO_GENERATION_WORKER_QUEUE_PLAN.md`. Generate still runs in the request. |
| Stripe 12-month credit packs | Terms mention them; checkout/SKU/name not built. Subscriptions later. |
| Watermark-removal tool | Q5: possible later premium; Gemini watermarks remain. |
| Crop / composition as Studio stage controls | Export variants already cover channel sizes after generate. In-editor crop/zoom/negative-space controls were in the original include-list. |
| Staged transparent cut-out | **Not the same as export cut-out.** See below. |

## Accepted as-is (not to-do)

- **Q6 outputs:** generate keeps the source framing; user picks export variants (delivery, social, PDF, transparent cut-out) afterwards.
- **Q7 credits:** debit on successful persist; log failures; support investigates; admin re-credits if warranted. No automatic refund UX.
- **Q3 ICP:** primarily menu designers and food photographers; other original ICP options remain welcome.
- Menu builder parked from the public funnel; URLs still work.
- Privacy/Terms owner-approved; lawyer pass optional, not required to close requirements.

---

## Staged cut-out vs export cut-out

**What exists today (export):** after a normal Studio generate, the user can
export a **transparent cut-out** of the current image. Background removal runs
on that finished photo and the dish is placed on a transparent canvas. It is a
download/format step, like “make a square for a delivery app.”

**What the original requirements meant (staged control):** treat “transparent
background” as a **change you stage before Generate**, next to lighting or
surface — then the model generates a new image that is already a cut-out. That
control was never added. Export cut-out is the accepted substitute unless this
backlog item is picked up later.

---

## Architecture follow-ups (unnumbered)

- Consolidate admin Photo Control onto the DB lighting/background style path.
- Interactions API (`previous_interaction_id`) instead of `generateContent`.
- Mobile focus switcher — `docs/STUDIO_MOBILE_FOCUS_SWITCHER_PROPOSAL.md`.
- Optional counsel pass on Privacy/Terms.
