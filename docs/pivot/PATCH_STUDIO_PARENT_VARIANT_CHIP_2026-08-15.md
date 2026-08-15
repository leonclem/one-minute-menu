# Patch — Workbench parent-variant chip (2026-08-15)

**Type:** Independent patch (FOH UX, not a requirements phase / chunk).

**Requirements refs (adjacent):** §7.3 image library / variant history.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. No migration or
env var.

**Goal:** Show which existing variant a generation was made from, without a
visual tree.

## Change

Workbench change pills now lead with `From OG` / `From V1` / etc., derived from
`source_image_id` and the same OG/Vn numbering as the variant strip. Existing
images pick this up with no backfill. A tree view remains out of scope for beta.

## Production deploy

None beyond the usual manual deploy of `main`.
