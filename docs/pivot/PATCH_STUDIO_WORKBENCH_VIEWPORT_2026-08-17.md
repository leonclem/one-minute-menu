# Patch — Workbench full-frame viewport (2026-08-17)

**Type:** Independent patch (FOH UX, not a requirements phase / chunk).

**Requirements refs (adjacent):** §7.3 image library / Workbench preview; Q6
source framing (2026-08-14).

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. No migration or
env var.

**Goal:** The Workbench default view must show the entire source or variant
image (tabletop and backdrop included), with fit / zoom / pan / reset, instead
of a short landscape crop that hides the edges users are editing.

## Change

- Workbench preview uses an explicit fit-to-viewport camera (letterboxed), not
  a clipped hero window. Zoom in/out, Fit reset, drag-to-pan when zoomed, and
  wheel zoom. Expand-to-lightbox remains a toolbar action so pan is not stolen
  by a full-image click.
- Studio column height no longer caps at 42rem, so the canvas can use leftover
  viewport height.
- Variant strip thumbs use contain (not cover) so OG/Vn comparison shows the
  same full frame.
- Source uploads reject images whose longer side is more than **3×** the
  shorter side. 16:9, 9:16, 4:3, 3:4, and square all pass. True panoramas are
  rejected with a crop-and-retry message. Generation still follows the source
  framing (Q6); this is a usability/model-safety rail, not a forced output
  ratio.

## Production deploy

None beyond the usual manual deploy of `main`.
