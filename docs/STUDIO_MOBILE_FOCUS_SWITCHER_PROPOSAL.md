# Studio Mobile Focus Switcher Proposal

**Status:** Deferred until after Studio MVP / beta feedback review  
**Scope:** `/studio` mobile and narrow-tablet experience

## Problem

On mobile, Studio currently stacks its major areas in desktop workflow order:

1. Control Panel
2. Workbench
3. Export Variants

This preserves the mental model of the desktop interface, but a user editing several options, reviewing generated images, and preparing exports may repeatedly scroll between distant areas.

## Proposed interaction

Add a mobile-only top-level Studio focus switcher immediately below the dish/actions area. It can be implemented as a compact sticky segmented control or as three horizontal accordion headers:

- **Controls** — staging lighting, surface, backdrop, and other edits.
- **Workbench** — reviewing the selected image, generating, and choosing variants.
- **Exports** — creating and downloading channel-ready variants.

Only one major area is expanded at a time. The collapsed areas remain visible as concise, tappable summaries:

- `Controls · 2 pending changes`
- `Workbench · Variant 3 selected`
- `Exports · 2 ready`

The existing Control Panel section accordions remain in place; this proposal adds a higher-level navigation layer rather than replacing those controls.

## Behaviour guardrails

- Do not automatically switch focus after every edit.
- When generation completes, preserve the current focus and show a clear `View result` action or badge.
- Keep the Generate action sticky within the expanded Controls area.
- Keep the selected image or variant identifiable from the collapsed Workbench summary.
- With an existing image, default to Workbench; during first-run upload, select the area that supports the next required action.
- Do not recreate desktop vertical rails or vertical text on mobile.

## Design direction

Use familiar horizontal labels and touch-sized targets. Preserve the current full mobile stack as a no-JavaScript / fallback layout. The focus switcher should only apply below the desktop grid breakpoint and must not change desktop or laptop behaviour.

## Revisit criteria

Prioritise this after MVP if beta feedback, session recordings, or analytics show that mobile users frequently move between controls, previewing, and exports in a single session. Validate the pattern with representative phone sizes and both first-run and established-dish workflows before rollout.
