# Patch — Studio in-place yaw, rotate 90° (2026-09-12)

**Type:** Independent patch (FOH Studio horizontal dish rotation). Exploratory
ship behind a flag.

**Requirements refs:** §7.8 (parked 2026-07-20 same-plane rotate). 45° spin
keys (`left-45` / `right-45`) and orbit-force prose are removed; camera
height `45-degree` (angled) is unchanged.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. Leave the new
env var unset in production until quality is accepted.

**Goal:** Let Studio users rotate the working dish 90° left or right on the
table, using the JSON mutate path. Camera height stays put. This is a
turntable move, not a camera orbit. Buttons are labelled clockwise /
anti-clockwise (as seen from above).

## Change

- Scene **Camera** is last in the Scene list (after Backdrop). Rotate
  **BETA** explains on hover or tap that this is a beta feature and may
  produce unexpected results.
- After Generate, 90° yaw is consumed: the new photo is the new zero so
  another rotate can be staged immediately. `/studio` and dish library
  grids refetch when shown so a new shot is visible without a hard refresh.
- Mutate: semantic `target.camera.plateFacing` (rotated 90° on a turntable).
  Do not emit internal keys (`left-90`) as visual values. Yaw-only uses a
  wrapper that **keeps** camera height. Combined height + yaw uses a combined
  wrapper. Thin turntable directive; no HORIZONTAL ORBIT FORCE.
- Extract observes spin as `0` only. Relative 90° yaw is
  not scored by post-gen extract (the new photo is the new zero).
- `STUDIO_LOG_PROMPTS=true` still prints the exact Studio mutate prompt.

## Production deploy

None required. Leave `NEXT_PUBLIC_STUDIO_ENABLE_YAW` unset (or `false`) on
Vercel until quality is accepted. Then set `true` and restart. Prompt logging
stays local.
