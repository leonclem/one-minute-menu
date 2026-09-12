# Patch — Studio vertical switch, 45° ↔ overhead (2026-09-12)

**Type:** Independent patch (FOH Studio camera height). Exploratory ship behind a flag.

**Requirements refs:** §6.1–6.2, §7.8 (parked 2026-07-20). Eye-level remains out of scope.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. Two new env vars;
leave them unset in production until the control is accepted.

**Goal:** Let Studio users switch the working shot between overhead and a 45°
food-photography view, using the JSON mutate path (not Structural Forcing, not
reshoot, not admin photo-control).

## Change

- Scene **Camera** section (flag `NEXT_PUBLIC_STUDIO_ENABLE_VERTICAL_SWITCH=true`):
  one switch. If the working shot is overhead → stage 45°; otherwise → stage
  overhead. Stacks with lighting/surface. Targeting overhead drops a staged
  backdrop (unsatisfiable wall). Backdrop tiles stay hidden on overhead working
  shots, else follow `backdrop_visible`.
- Mutate: semantic `target.camera` viewpoint + plate-facing lock; camera-aware
  edit wrapper (do not preserve original camera height); thin directive. Do not
  emit internal keys (`top-down`) as visual values. Do not call the old f-stop /
  CRITICAL angle clauses for this pair.
- `STUDIO_LOG_PROMPTS=true` prints the exact Studio mutate prompt to the local
  server log. Default off. Do not enable in production.

## Production deploy

None required. Leave both env vars unset (or `false`) on Vercel until quality
is accepted. Then set `NEXT_PUBLIC_STUDIO_ENABLE_VERTICAL_SWITCH=true` and
restart. Prompt logging stays local.
