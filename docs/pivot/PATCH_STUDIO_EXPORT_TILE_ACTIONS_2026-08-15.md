# Patch — Studio export tile actions (2026-08-15)

**Type:** Independent patch (FOH UX, not a requirements phase / chunk).

**Requirements refs (adjacent):** §7.9 output packs / export variants.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. No migration or
env var.

**Goal:** Make export tiles cheaper to scan on desktop and mobile: credit cost
on the Generate action, tap the preview to view, regenerate from a compact
control, and match primary button rounding to the Control panel.

## Change

1. Paid Generate / Retry buttons show the cost in-button (`Generate · 1 credit`),
   matching the Control panel Generate label. Free formats stay `Generate`.
2. Remove the Open and Redo text buttons.
3. Tapping the ready preview opens the same Workbench lightbox (`StudioImageLightbox`) via the shared `StudioExpandablePreview` (pointer cursor + EXPAND overlay). The previous Open link opened a new tab.
4. Ready tiles: yellow download icon (same amber as Dishes) plus a teal Redo
   button that includes the credit cost when the format is paid
   (`Redo · 1 credit`), matching Generate.
5. Generate and Download use `rounded-md` like the Control panel Generate button.
6. Header info control explains that AI expand/cut-out uses credits and
   resize/crop is included (tap/click, not hover, so it works on phones).

## Production deploy

None beyond the usual manual deploy of `main`.
