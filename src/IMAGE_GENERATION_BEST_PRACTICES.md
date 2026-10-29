# GridMenu — AI Food Photography: Best Practices & Prompting Guide

> Internal guide for the Studio image-editing pipeline: prompt shape, model configuration,
> reference semantics, and iterative editing. **Last updated: October 18, 2026.**
>
> External API behavior in this guide is cited inline to the [Gemini image generation documentation](https://ai.google.dev/gemini-api/docs/image-generation). Content is rephrased rather than quoted.

---

## 1. Current model landscape

Studio uses the Flash-family image model for the customer edit path. Live ids come from
`STUDIO_STD_MODEL_URL` and `STUDIO_PRO_MODEL_URL`. A Nano Banana 2.x id is the Flash family:
it accepts a thinking level and has no style-reference slot. The Pro model remains an
admin/experimental option and does not accept `thinkingLevel`. Keep model names and capability
decisions centralized in the model configuration module; do not infer capabilities from a
generic reference count.

| Model | GridMenu role | Image output / reference capability relevant here |
|---|---|---|
| `gemini-3.1-flash-image` | Production Studio default | Fast image generation and editing; up to 10 object-fidelity references and up to 4 character-resemblance references, but **no style-reference slot**. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) |
| `gemini-3-pro-image` | Admin experimentation | Supports style references (up to 3), object-fidelity references (up to 6), and character-resemblance references (up to 5); the combined documented budget is up to 14 references. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) |

These are API capability categories, not UI slots. A Studio style tile must never be treated as an
image reference merely because the model accepts other kinds of reference images. The customer
path currently sends the source photograph as its identity anchor and carries lighting, backdrop,
and surface intent in the scene descriptor.

---

## 2. Perspective guidance: current rule and historical material

The customer Scene **Camera** control (flagged) is a vertical switch between overhead and a
45° food-photography view, plus an in-place 90° yaw (flagged separately). Express height as
named `target.camera` viewpoint + keep-the-plate-facing lock. Express yaw as
`target.camera.plateFacing` (a full quarter-turn as seen from above, like a turntable). Do not emit
internal keys such as `top-down` or `left-90` as visual values. When only viewpoint is
staged, the edit wrapper must not say to preserve the original camera height. When only
yaw is staged, the wrapper must **keep** camera height and must not orbit.

Do not add the old Structural Forcing prefix to every prompt. Eye-level / 0° side-view remains
parked. Do not revive HORIZONTAL ORBIT FORCE for FOH yaw.

### Historical — Structural Forcing / Perspective Override Prefix

The following material is retained only to explain older prompts and archived experiments. It is
**not current guidance**:

- Prefer phrases such as “table-top horizon shot” and “zero-degree camera pitch.”
- Deny the top of the plate and prepend `CRITICAL: CHANGE PERSPECTIVE TO SIDE-VIEW...`.

Those phrases were part of the retired Structural Forcing / Perspective Override Prefix approach.
The 2026-07-20 decision parked eye-level work. New Studio camera prompts must use
`target.camera` viewpoint language, not f-stops or CRITICAL prefixes.

---

## 3. Two tiers: control state versus scene descriptor

The former **Extreme Compression Strategy** is retired. The old single-letter serializer, string
slicing, and opaque database-key values made the JSON anchor less useful than the surrounding
prose. Do not shorten keys or values to save characters, and do not use a compressed JSON
footnote as the source of truth. The descriptor is the edit. Do not pad prose until it competes
with `target`.

### Tier 1 — control state

Tier 1 is the existing `MinimalSchema` in `src/lib/photo-control/minimal-schema.ts`. It is the
small, enum-constrained state used by the UI tiles, `StateDelta` diffing, persistence in
`studio_images.metadata.editorState`, and validation. Its role and shape remain stable so old
persisted editor states and the client contract continue to work.

Tier 1 may contain a selected style key such as `studio` or `dark-slate`; that key is a control
value, not model-facing prose. Never send an internal database key as if it were a visual
instruction.

### Tier 2 — scene descriptor

Tier 2 is built server-side for the model. Expand Tier 1, resolved style descriptors, and observed
extraction data into a verbose, semantically named JSON document. Preserve complete user and
extracted strings. The only trim is `subject.description`, and only when the composed prompt would
exceed the composer ceiling.

Use these top-level sections:

```json
{
  "task": "edit",
  "subject": {},
  "current": {},
  "target": {},
  "output": {}
}
```

Omit an empty root `camera`. It repeats the observed viewpoint already available from the
photograph and from `current.camera`. Keep `current.camera` and `target.camera` when the angle
or yaw is the change.

- `subject` keeps identity: dish, vessel, the original observation in `description`, components,
  and `locked`. It is not a second edit.
- `current` is the before-state of this variant. It is not a second edit.
- `target` is the only change. It holds lighting, backdrop, surface, a replacement vessel,
  finishing touches, props, camera, and `foodPreservation`. Style attributes stay descriptive:
  quality, temperature, shadows, falloff, material, finish, and hex colour. Never send an
  internal style key as the visual value.
- `output` is `style: photorealistic` and `framing: full shot, no cropping`. It is not a lock
  list and it is not a negative prompt.

`subject.description` is the original photograph analysis. It can still mention a board, garnish,
or surface that a later edit has replaced. Do not rewrite it into the new scene, and do not treat
it as proof of what is on the current variant.

Example shape for a surface change with one garnish and one prop:

```json
{
  "task": "edit",
  "subject": {
    "locked": [
      "dish identity",
      "ingredient and component counts",
      "vessel",
      "framing",
      "natural food geometry and surface detail"
    ],
    "dish": "Massaman curry",
    "vessel": "round matte ceramic bowl",
    "description": "Original photograph analysis. Not a list of edits.",
    "components": { "garnishes": [], "sides": [] }
  },
  "current": {
    "components": { "garnishes": [] }
  },
  "target": {
    "surface": {
      "material": "slate",
      "finish": "matte",
      "colour": "#2F3437"
    },
    "finishingTouches": [
      { "item": "Coriander", "placement": "finely chopped on the food; a small sprig on the tabletop around the vessel" }
    ],
    "finishingTouchesRule": "Place items naturally and irregularly, not in a grid, and keep quantities restrained.",
    "props": [
      {
        "name": "Fork",
        "description": "One plain stainless-steel dinner fork.",
        "placement": "On the tabletop to the left of the vessel."
      }
    ],
    "propsRule": "These are set-dressing props, not garnishes on the food. A prop that rests on the table casts a soft contact shadow on the tabletop.",
    "foodPreservation": "Keep texture, shape, and structure as irregular cooked geometry, with browning, moisture, and natural colour variation. Do not smooth, round, or unify the food.",
    "cameraPreservation": "Keep the camera angle and height of the source photograph. Do not move to overhead, eye level, or a side view."
  },
  "output": {
    "style": "photorealistic",
    "framing": "full shot, no cropping"
  }
}
```

The descriptor is the model-facing representation, not a replacement for Tier 1 persistence. The
key invariant is semantic fidelity: the JSON must say what the model should see, not how cheaply the
application can serialize it. Do not add `output.locked` or `semanticNegativePrompt`. Those fields
competed with `target` and are not part of the current payload.

---

## 4. Edit and inpainting prompt shape

A Studio mutation is an **edit of the attached source photograph**, not fresh image synthesis. The
framing prose around the descriptor must do real work while remaining small. Use the following
shape, adapted from the image-edit/inpainting pattern in the [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation):

```text
Edit the attached photograph. Change only target. subject keeps the dish and vessel. Leave anything target omits as shown.
Requested directive: <short pointers only>

<the Tier 2 scene descriptor JSON>
```

The directive is built in the browser and posted with the mutate request. A stale Studio bundle
keeps the old directive even after the server has the new JSON. Reload Studio before judging a
prompt from the log.

Implementation rules for this wrapper:

1. Say **change only target**. `subject` names the dish and vessel to keep. `current` is the
   before-state, not a second edit. Leave anything target omits as shown.
2. Do not say **keep everything else exactly as-is**. That sentence is read as louder than
   `target`, and a staged surface is the change that gets dropped.
3. Put the values in the semantic descriptor. The directive points at them. It does not restate
   them.
   - Lighting, backdrop, and surface live only in `target`. Their client clauses are excluded
     (`scene_setup.lighting`, `canvas.background_style`, `canvas.surface_style`). Do not append
     "leave all other attributes unchanged" when that excluded style was the only prose clause.
   - Garnish and side placement lives on `target.finishingTouches`, with one shared
     `target.finishingTouchesRule`. The directive says only: add the finishing touches in
     `target.finishingTouches`.
   - Prop description and placement live on `target.props`, with one shared `target.propsRule`.
     The directive says only: add the props in `target.props`. Props are text. Do not attach a
     prop image.
   - Food keep lives on `target.foodPreservation` for every non-reshoot edit. The directive
     points at that field. It still has to contain the words texture, shape, and structure.
     Do not paste the browning essay into the directive as well.
4. Once surface, vessel, or backdrop is in `target`, prose must not call that surface "existing"
   or "current". Say "the tabletop" and "the vessel". Catalogue phrases are rewritten at compose
   time when that axis is changing.
5. Use one positive `subject.locked` list. The food entry is **natural food geometry and surface
   detail**. "Colours and textures" on its own is read as a licence to smooth sear, moisture, and
   irregular edges when `target` is busy. A lock label is still dropped when `target` is busy, so
   the active keep is `target.foodPreservation`, not a second prohibition paragraph.
   `subject.locked` also says **framing**, which means crop, not camera height. When the user has
   not staged `scene_setup.angle`, add `target.cameraPreservation` and point the directive at it.
   Omit that keep when `target.camera.viewpoint` is the requested change. A yaw-only edit still
   keeps the angle.
6. A vessel swap may stay in the directive, because it has to name the additional reference image
   and tell the model not to copy that image's background, tabletop, lighting, or food. The new
   vessel also appears as `target.vessel`. Removals stay in the directive. `target.components`
   lists what should remain.
7. Do not use `Generate an image of:` or `Compose a new image using the provided reference inputs:`
   for an edit request. Frame the operation as editing the source.
8. Do not add a global-to-local prose block (canvas style, then subject, then background, then
   lighting). Google's edit guidance is a strong verb, a statement of what changes and what stays,
   and iteration. That is the one-line wrapper plus `target`. A second hierarchy in prose competes
   with `target`, which is how a staged surface gets dropped.
   [Nano Banana prompting guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)

A pure JSON blob is not a substitute for the edit wrapper. The wrapper stays one sentence.

### How many changes in one edit

One request that bundles more than about four or five changes drops some of them. The surface is
a common drop. Do not fix a drop by restating that change in the directive. The documented edit
pattern is to iterate: apply a smaller set, then edit the result. The Studio UI can still stack
controls into one submit. That stack is still one prompt, and a large stack is less reliable than
a short sequence of edits.

---

## 5. Reference kinds and per-model availability

“Reference image” is not one capability. Decompose every attached image by **kind** before deciding
whether it belongs in a request. The limits below describe the documented model capabilities; they
are not permission to fill every slot.

| Reference kind | What the image is for | `gemini-3.1-flash-image` | `gemini-3-pro-image` |
|---|---|---:|---:|
| **Style reference** | A visual exemplar whose lighting, palette, or aesthetic the model emulates | **None — no style-reference slot** | Up to 3 [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) |
| **Object fidelity** | An object anchor whose referenced object should be reproduced in the output | Up to 10 [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) | Up to 6 [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) |
| **Character resemblance** | A person/character consistency anchor | Up to 4 [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) | Up to 5 [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) |

The critical Flash rule is explicit: **`gemini-3.1-flash-image` has no style-reference slot.** Its
reference slots are for object fidelity and character resemblance, and the documented purpose of
those references is to reproduce the referenced object or maintain the referenced character. A
lighting swatch, backdrop tile, or surface swatch attached to Flash can therefore be interpreted as
an object to reproduce, not as a style to emulate. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

### Studio customer-path policy

The customer `/studio` path sends the source photograph as the identity anchor. It sends no
lighting, backdrop, surface, or steering references. References carry identity; JSON carries
style. Lighting, backdrop, and surface intent travel exclusively through Tier 2 attributes such as
quality, temperature, shadows, falloff, material, finish, and colour.

A vessel swap is the exception. It attaches one extra object reference: the replacement vessel,
fitted to the source frame. The prompt must say to move the existing food onto that vessel and
not to copy the reference image's background, tabletop, lighting, or food. Output aspect ratio
stays the source photograph's ratio, not the vessel image's ratio. Props stay text on
`target.props`.

For admin experiments on Pro, classify each image before attaching it and keep the reference count
within the limit for that kind. Never describe the limit only as “Flash supports N images”: that
bare count is the defect this guide is intended to prevent.

---

## 6. Aspect ratio and image size

The image-generation documentation describes 1:1 as the default when no aspect ratio is supplied
for image generation. It also documents supported output ratios and uppercase image-size tokens
(`1K`, `2K`, `4K`). [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

Apply that behavior deliberately:

- For a Studio **edit** with no explicit ratio, measure the source photograph and send
  `imageConfig.aspectRatio` as the nearest ratio both models accept (`studio/aspect-ratio.ts`).
  Omitting the field lets the model pick a frame, including the aspect ratio of a second reference
  such as a replacement vessel. Do not hard-code `1:1`, and do not add an aspect-ratio sentence to
  the prompt. If the source dimensions cannot be read, omit the field.
- When the caller already selected a supported ratio (scene expand, export reframe), send that
  ratio in `imageConfig.aspectRatio` exactly once. The prompt should describe the edit, not repeat
  the API configuration token.
- Use uppercase `imageConfig.imageSize` values and default Studio to `2K`. Do not emit the stale
  lowercase `1k` fallback.
- A legacy worker path that intentionally renders a square must set that choice explicitly and keep
  its metadata/pixel contract separate from Studio editing.

Aspect ratio is configuration, not scene prose. The descriptor may contain camera/framing intent,
but it must not silently override the request configuration or claim that a square was selected when
it was not.

---

## 7. Semantic negative prompts and identity preservation

Say the unwanted result once, inside the directive's identity clause: do not add new food, props,
hands, text, labels, logos, napkins, or cutlery, except the items this edit names. Do not copy
that sentence onto `output`, and do not add `semanticNegativePrompt` or `output.locked`.

`subject.locked` is the positive list: dish identity, ingredient and component counts, vessel
(unless the vessel is the change), framing (unless camera geometry is the change), and natural
food geometry. `target.foodPreservation` is the active food keep, because the lock label is
dropped when `target` is busy. A staged change must appear in `target`, and neither the lock list
nor the identity clause may negate it.

For every mutation, preserve the entire subject and vessel in frame unless the requested target says
otherwise. These are GridMenu prompt invariants, not a reason to attach extra style images.

---

## 8. Thinking levels

Thinking is a request configuration, not a prompt instruction. Studio passes the configured thinking
level through the API request; it must not be silently dropped by a model-name guard. Use the
model-supported thinking-level values documented by Google, and keep the level explicit in the
central model configuration. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

Current project guidance:

- Customer Studio Flash, including Nano Banana 2.x, defaults to `thinkingLevel: "high"` unless
  `STUDIO_THINKING_LEVEL` selects another supported level (`minimal`, `medium`, or `high`). An
  invalid value falls back to `high`. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)
- Pro (`gemini-3-pro-image`) does not accept `thinkingLevel`. The consumer Gemini menu labels
  Fast, Thinking, and Pro are different models. "Redo with Pro" is a model change, not a higher
  thinking level on the Flash request. Switching models is a product decision. Do not imitate it
  by adding a thinking instruction to the prompt.
- Do not put `thinking_level: high` or a billing/configuration explanation in the natural-language
  prompt. Inspect the assembled request configuration when debugging.
- Higher reasoning can affect latency and usage; measure that in the product's cost/latency
  controls rather than promising a fixed generation time.

---

## 9. Multi-turn editing and the recommended API direction

For iterative image editing, the documented direction is to use the **Interactions API** and carry
`previous_interaction_id` into the next turn rather than reconstructing every turn as an unrelated
request. This lets a follow-up refer to the prior interaction while preserving the conversation's
editing context. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

A future Studio flow should therefore retain the prior interaction identifier alongside the generated
image and use it for “edit again” operations. `MutationEngine.MutationOutput.thoughtSignature`
already exists as an unused extension point for carrying the continuation metadata needed by such a
design; it is not currently a transport implementation.

**Migration status: recommended direction, explicitly out of scope for this patch.** The current
patch keeps the existing `generateContent` transport so the Group A request baseline remains stable.
Do not add `previous_interaction_id` handling, change transports, or claim multi-turn continuity is
implemented until a separately scoped migration covers persistence, retries, authorization, and
verification.

---

## 10. Prompt assembly checklist

Before sending a Studio mutation, verify:

- The request is framed as editing the attached source, not synthesizing a new image.
- Tier 1 remains the UI/persistence control state; Tier 2 is the semantic model-facing descriptor.
- The descriptor has `task`, `subject`, `current`, `target`, and `output`. An empty root `camera`
  is omitted.
- Staged lighting, backdrop, and surface changes are complete under `target` with descriptive
  attributes; no opaque style key is used as the visual value. Those three are absent from the
  directive.
- Finishing-touch placement is only on `target.finishingTouches`. Prop copy is only on
  `target.props`. The directive is the short pointer for each.
- Non-reshoot edits include `target.foodPreservation`. `subject.locked` says natural food
  geometry and surface detail, not "colours and textures" alone.
- Edits that do not stage a camera-angle change include `target.cameraPreservation`. An angle
  change does not.
- The prose wrapper says to change only `target`. `subject` keeps the dish and vessel. It does not
  say to keep everything exactly as-is. Prose does not call a staged surface or backdrop "existing".
- There is no `output.locked` and no `semanticNegativePrompt`.
- The customer path sends the source photograph and no style or steering references. A vessel
  swap may add one vessel reference, with an instruction not to copy its scene or food.
- For an edit with no explicit ratio, send the source photograph's nearest supported
  `imageConfig.aspectRatio`. Explicit size tokens are uppercase. Do not add an aspect-ratio
  sentence to the prompt.
- Thinking level is present in request configuration for Flash and Nano Banana 2.x, and absent
  for Pro. It is never prompt prose.
- Logged prompt text is the exact text sent to the model. Terminal colour is display-only.
- No old Structural Forcing prefix, single-letter JSON keys, string slicing, global-to-local prose
  block, repeated placement paragraphs, or `Generate an image of:` synthesis prefix has slipped
  back in.

---

## 11. UI implications

- **Stage, then submit:** let users stack changes before one mutation request. A stack of more
  than about four or five changes is still one edit, and the model may drop some of them. Prefer
  a shorter sequence of edits over a larger prompt.
- **Show pending changes:** make the requested target visible before generation.
- **Use semantic controls:** expose meaningful lighting, backdrop, surface, framing, and ratio
  choices rather than technical reference-role selectors.
- **Keep reference semantics invisible where possible:** the customer sees the source photo as the
  image being edited; style tiles become descriptor attributes, not hidden image attachments.
- **Keep admin experimentation separate:** Pro reference experiments must not change the customer
  Flash contract.
