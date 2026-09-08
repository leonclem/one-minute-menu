# Studio Expand Scene (workbench MVP)

Design brief from the 2026-09-07/08 spike. Use this for UI exploration. It is product and architecture intent, not a pixel spec.

Related: crop is the workbench control labelled **Reframe** (`docs/STUDIO_PAGE_BUTTONS.md`). This feature is the third tool chip labelled **Expand**. Export expand is a separate channel adapter (`src/lib/studio/export-renderers.ts`).

---

## One sentence

Give a tight food photo more room around the dish **without changing the food**, as if the cook lowered zoom on a phone camera: same place, same angle, same frame shape, more table and backdrop.

The user then keeps editing that new shot with lighting, surface, backdrop, and garnishes as they do today.

---

## Naming

Crop stays **Reframe**. This feature is **Expand**. Helper:

> Create more room around your dish without changing the food.

Do not lead with “Magic Expand”, “AI zoom”, or “regenerate wider”.

---

## Who it is for

Many usable dish photos are too tight for Studio:

- food fills the frame
- plate is cut off
- little or no tabletop
- surface / backdrop edits have nothing to change
- the dish itself is already fine

This is an **enabling** step, not an export format. After expand, the shot is a normal Studio image.

---

## Product principles

1. **Preserve the dish.** Do not restyle, re-plate, or re-cook.
2. **Keep the source aspect ratio.** Portrait stays portrait; landscape stays landscape. This is a phone zoom-out, not a conversion to Instagram 4:5.
3. **User picks intent, not pixels.** Named amounts of extra scene. GridMenu chooses how much canvas to add.
4. **Gemini’s image is the result.** Do not paste the original photo back on top (that created a visible stamp in tests).
5. **Do not invent a new art direction.** Extra table and backdrop only. No new bowls, cutlery, chairs, or garnishes. Those stay Elements / Scene.
6. **Same editing model after.** The child shot is not a special mode. Lighting, surface, garnish, crop, remove, export all still apply.

---

## MVP functionality

### What the user does

1. Open a shot on the workbench (any variant, including Original).
2. Open Expand from the third tool chip, next to crop (today’s Reframe) and Remove.
3. Pick one of **three named amounts** of extra scene, or drag a corner of the frame (snaps to the same three). GridMenu adds space on **all sides**, proportional to width and height, so the photo’s shape does not change.
4. Confirm. Credits and wait behave like **Generate** (a new generated shot, GEN goes up).
5. The new shot becomes current. Filmstrip / library show it in the lineage. The user continues in Scene as usual.

Suggested preset names (revisable in design):

| Preset | Intent | Backend meaning (not shown) |
|---|---|---|
| A little wider | Modest breathing room | Small pad (~10% per axis) |
| Balanced | Natural food-photo margin | Medium pad (~20% per axis; spike default) |
| Editorial | Clearly more environment | Larger pad (~35% per axis) |

Do not show percentages, pixel paddings, or “3:4 / 16:9” as the primary choice. Aspect is inherited from the current photo.

Optional in the panel: a one-line credit cost (`· N credits`), same pattern as Generate / Remove.

### What the user does not do in MVP

- Draw a crop window (that remains today’s Reframe / crop).
- Pick “only left” or “only above” (supported later; not MVP).
- Pick a target format (square, story, 16:9). That is **Export**.
- Type a prompt.
- Choose feather / restore / model. Those were spike diagnostics only.

### Result in the product

- New `studio_images` row, `role: generated`, parent = current shot.
- Title along the lines of `Expanded · Balanced` (exact chip copy is a design choice).
- GEN increments. Degradation warning at GEN 3+ still applies if they expand from a late generation.
- JSON (dish description) is copied from the parent. We do not re-analyse the photo in MVP.
- Spatial object-edit marks from the parent do not carry over (same as crop: coordinates belong to the old frame).

---

## How it sits next to existing Studio

```
Crop (today: “Reframe”)     shrink the canvas, lossless, free
Expand scene (this MVP)     grow the canvas, generative, paid
Generate                    change lighting / surface / garnish on the same canvas
Remove                      object-edit on the same canvas
Export                      make a channel file (may change ratio for delivery / IG)
```

**Crop vs expand:** opposites. Crop discards edges. Expand invents edges. A cook might crop a messy table, then expand a tight plate, or the reverse. They should feel like two frame tools, not two names for one tool.

**Generate vs expand:** Generate changes *what is in the scene* (light, table, herbs). Expand only changes *how much scene you can see*. After expand, Generate has more table to recolour.

**Export vs expand:** Export already has an AI expand for **wrong-shaped channel slots** (e.g. square hero to 16:9) and then normalises to exact pixels. That stays on the Exports tab. This MVP does not replace it. A later tweak might reuse the zoom-out prompt; it is not a shared “compositor” and it is not in this UI.

**Remove then expand:** cooks *may* remove a half-in-shot bowl first. Do not design the flow as if they must. Expand should still run on a busy table.

---

## Workbench placement and UX constraints

Toolbar: **Reframe** (crop), **Expand**, **Remove**. Scene Generate lives in the footer.

**Settled**

- Expand is a **third tool chip** next to crop and Remove.
- Busy, failure, credits, and mobile chrome **reuse Generate / Remove**.
- Overlay inverts crop: the photo stays centered; the frame grows around it. **Four corner handles only**. Drag snaps to the same three presets as the chips. No edge handles, no move handle, no free-form percentages.
- Confirm is `Expand · N credits`. Filmstrip title is `Expanded · Balanced` (etc.). GEN increments.

---

## Visual quality (what mockups should not over-promise)

From live tests on burger, chicken rice, corn cake, and pasta:

- **Happy path:** dish fully in frame, extra wood / wall around it. Looks like a zoom-out. Use this in marketing and default mockups.
- **Cut objects:** a plate, napkin, or bowl that already hits the source edge may continue into the new area, sometimes with a faint join at the old frame. Acceptable; do not show “pixel-perfect plate completion” as a guarantee.
- **Invented rooms:** the model sometimes adds a chair, extra wall, or kitchen beyond “more of the same table.” Copy and empty states should not promise a perfectly empty studio sweep.
- **Do not mock the diagnostic panels** (hard paste, inner restore, red/teal boxes). Those are not user-facing.

The workbench **zoom in/out** on the preview (pinch / buttons) is unrelated. That only changes how the cook inspects the image; it does not generate pixels.

---

## High-level architecture (for alignment, not a UI spec)

```
Current shot
    → pad a larger canvas, same aspect (percent of width and of height)
    → Studio Flash image edit
         prompt: phone zoom-out, camera locked, fill new scene only
         imageConfig.aspectRatio: nearest Flash ratio to the source
    → save Gemini bytes as the new shot
    → copy parent editor JSON
```

- **Not** the export worker and **not** a download tile.
- **Not** crop’s sharp.extract path.
- Same credit and generation-cap family as mutate (exact credit number follows existing NB2 / NB Pro rules unless product says otherwise).
- Spike code lives in `scripts/studio-reframe-spike/` and is not the production UI.

Flash only emits a handful of ratios (`1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `4:5`). Odd phone sizes snap to the nearest. Design can ignore that; it should not become a picker.

Later (not MVP): pad only left / only above, by putting the original photo on one side of a larger canvas. Same engine, different layout recipe. Do not put directional handles in the first UI.

---

## Explicitly out of this MVP

- Pixel restore, feathering, or “original photo stamped back”.
- Target format / delivery / Instagram as part of this control.
- Subject left / right / up / down.
- Post-expand re-analysis of JSON.
- Changing export tiles.
- Sharing a restore compositor with export (restore lost in the spike).

Downstream Scene edits and export stay as they are. They may need small copy or GEN-warning tweaks once expand exists; no redesign of those surfaces is required to start this UI.

---

Implementation: `POST /api/studio/expand`. Pad canvas, Flash/Pro mutate with nearest source aspect, persist Gemini bytes, copy parent editor JSON.
