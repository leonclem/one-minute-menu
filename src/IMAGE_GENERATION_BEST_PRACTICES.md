# GridMenu — AI Food Photography: Best Practices & Prompting Guide

> Internal guide for the Studio image-editing pipeline: prompt shape, model configuration,
> reference semantics, and iterative editing. **Last updated: July 28, 2026.**
>
> External API behavior in this guide is cited inline to the [Gemini image generation documentation](https://ai.google.dev/gemini-api/docs/image-generation). Content is rephrased rather than quoted.

---

## 1. Current model landscape

Studio uses **`gemini-3.1-flash-image`** for the customer edit path. The Pro model remains an
admin/experimental option. Keep model names and capability decisions centralized in the model
configuration module; do not infer capabilities from a generic reference count.

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

The customer-facing Studio panel no longer exposes the angle/rotation controls that motivated the
old perspective-forcing recipe. Do not add the old prefix to every prompt, and do not describe it as
an active product requirement. Camera intent belongs in the requested scene descriptor when a
supported control actually asks for it.

### Historical — Structural Forcing / Perspective Override Prefix

The following material is retained only to explain older prompts and archived experiments. It is
**not current guidance**:

- Prefer phrases such as “table-top horizon shot” and “zero-degree camera pitch.”
- Deny the top of the plate and prepend `CRITICAL: CHANGE PERSPECTIVE TO SIDE-VIEW...`.

Those phrases were part of the retired Structural Forcing / Perspective Override Prefix approach.
The 2026-07-20 decision parked the related angle work and removed those controls from the FOH panel;
new code and prompts must not depend on an unreachable control. If an administrator explicitly
requests a camera change, express it as a named `target.camera` attribute and preserve all
unmentioned composition.

---

## 3. Two tiers: control state versus scene descriptor

The former **Extreme Compression Strategy** is retired. The old single-letter serializer, string
slicing, opaque database-key values, and 2,000-character budget made the JSON anchor less useful
than the surrounding prose. Do not shorten keys or values to save characters, and do not use a
compressed JSON footnote as the source of truth.

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
extraction data into a verbose, semantically named JSON document. The model-facing payload should be
approximately **90% descriptor JSON and 10% useful framing prose**, and should be shorter overall
than the old 2,492-character prompt. Preserve complete user and extracted strings: there is no
character-slicing rule.

Use these top-level sections:

```json
{
  "subject": {},
  "camera": {},
  "current": {},
  "target": {},
  "output": {}
}
```

- `subject` describes the dish, vessel, food components, identity, and anything that must remain
  recognizable.
- `camera` describes the observed or requested viewpoint, framing, lens/depth cues, and aspect
  intent when one is explicitly selected.
- `current` records the relevant observed scene state.
- `target` records only the requested changes, including `target.lighting`,
  `target.backdrop`, and `target.surface` with descriptive attributes such as quality,
  temperature, shadows, falloff, material, finish, and hex color.
- `output` records output format and semantic exclusions. It may include one positive `locked`
  field describing what is locked; it must not duplicate identity constraints in several prose
  clauses.

Example shape:

```json
{
  "subject": {
    "name": "churros",
    "vessel": "round matte ceramic plate",
    "identity": "Preserve the shown food arrangement, texture, shape, and portion count."
  },
  "camera": {
    "viewpoint": "eye-level table-top horizon",
    "framing": "full vessel with negative space on every side"
  },
  "current": {
    "lighting": "soft side light",
    "surface": "wooden tabletop"
  },
  "target": {
    "lighting": {
      "quality": "soft editorial studio light",
      "temperature": "neutral-warm",
      "shadows": "soft defined contact shadows",
      "falloff": "gradual"
    },
    "surface": {
      "material": "slate",
      "finish": "matte",
      "color": "#2F3437"
    }
  },
  "output": {
    "locked": "subject identity, vessel identity, requested composition, and all unnamed elements",
    "semanticNegativePrompt": "No extra plates, utensils, garnishes, people, hands, text, logos, or cropped vessel."
  }
}
```

The descriptor is the model-facing representation, not a replacement for Tier 1 persistence. The
key invariant is semantic fidelity: the JSON must say what the model should see, not how cheaply the
application can serialize it.

---

## 4. Edit and inpainting prompt shape

A Studio mutation is an **edit of the attached source photograph**, not fresh image synthesis. The
framing prose around the descriptor must do real work while remaining small. Use the following
shape, adapted from the image-edit/inpainting pattern in the [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation):

```text
Edit the attached source image. Change only the named elements in TARGET.
Keep everything else exactly as it is and preserve the original composition, subject identity,
vessel identity, framing, and all unmentioned details. Apply the requested edit naturally to the
existing image; do not create a new scene.

TARGET:
<the Tier 2 scene descriptor JSON>

SEMANTIC NEGATIVE PROMPT:
<one concise description of unwanted additions or alterations>
```

Implementation rules for this wrapper:

1. Say **change only the named elements**.
2. Say **keep everything else exactly as it is** and preserve the original composition.
3. Put the values in the semantic descriptor; do not repeat the same identity or negative clause
   once per style.
4. Use a single positive `locked` field for invariants and one semantic negative prompt for
   exclusions. Prefer “no extra plates, hands, or text” as a description of the unwanted result;
   do not build a long, repeated prohibition list.
5. Do not use `Generate an image of:` or `Compose a new image using the provided reference inputs:`
   for an edit request. Label an attached source image inside the descriptor when a label is
   needed, but frame the operation as editing the source.

This prose is intentionally about 10% of the payload. It supplies the edit/inpainting instruction;
the descriptor supplies the complete values. A pure JSON blob is not a substitute for the edit
wrapper.

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

The customer `/studio` path sends exactly one reference: the source photograph in slot 1. It sends
no lighting, backdrop, surface, or steering references. References carry identity; JSON carries
style. Lighting, backdrop, and surface intent travel exclusively through Tier 2 attributes such as
quality, temperature, shadows, falloff, material, finish, and color.

For admin experiments on Pro, classify each image before attaching it and keep the reference count
within the limit for that kind. Never describe the limit only as “Flash supports N images”: that
bare count is the defect this guide is intended to prevent.

---

## 6. Aspect ratio and image size

The image-generation documentation describes 1:1 as the default when no aspect ratio is supplied
for image generation. It also documents supported output ratios and uppercase image-size tokens
(`1K`, `2K`, `4K`). [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

Apply that behavior deliberately:

- For a Studio **edit** with no explicit user-selected ratio, **omit
  `imageConfig.aspectRatio`** rather than hard-coding 1:1. In this path omission means “do not force
  a square”; the verified `generateContent` edit accepted an empty `imageConfig` and returned a
  non-square image. Exact returned dimensions remain model-selected unless a supported ratio is
  explicitly requested. Do not add an `Aspect ratio: 1:1` sentence to the prompt.
- When the user explicitly selects a supported ratio, send that ratio in `imageConfig.aspectRatio`
  exactly once. The prompt should describe the edit, not repeat the API configuration token.
- Use uppercase `imageConfig.imageSize` values and default Studio to `2K`. Do not emit the stale
  lowercase `1k` fallback.
- A legacy worker path that intentionally renders a square must set that choice explicitly and keep
  its metadata/pixel contract separate from Studio editing.

Aspect ratio is configuration, not scene prose. The descriptor may contain camera/framing intent,
but it must not silently override the request configuration or claim that a square was selected when
it was not.

---

## 7. Semantic negative prompts and identity preservation

Negative guidance should describe the unwanted result semantically and once. It should support the
positive edit instruction rather than compete with it. Prefer:

```json
{
  "locked": "the original dish, vessel, composition, and all unnamed elements",
  "semanticNegativePrompt": "No additional food, plates, utensils, props, people, hands, text, logos, or cropped edges."
}
```

Avoid four copies of “Do not change the dish” or a list of contradictory imperatives. If an item is
locked, identify it positively in `output.locked`; if an addition is unwanted, name the semantic
addition in `semanticNegativePrompt`. A staged change must appear in `target`, and the negative
prompt must not negate that target.

For every mutation, preserve the entire subject and vessel in frame unless the requested target says
otherwise. Keep food identity, physical texture, shape, structure, and portion count stable; change
only the requested lighting, backdrop, surface, camera, or other named element. These are GridMenu
prompt invariants, not a reason to attach extra style images.

---

## 8. Thinking levels

Thinking is a request configuration, not a prompt instruction. Studio passes the configured thinking
level through the API request; it must not be silently dropped by a model-name guard. Use the
model-supported thinking-level values documented by Google, and keep the level explicit in the
central model configuration. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

Current project guidance:

- Customer Studio Flash defaults to `thinkingLevel: "high"` unless product configuration selects a
  different supported level. The documented Flash levels used here are `minimal` and `high`; the
  documented default is `minimal`, while this product defaults Studio to `high`. [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation)
- Pro requests use the Pro model's supported configuration and do not inherit the Flash thinking
  setting.
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
- The descriptor has `subject`, `camera`, `current`, `target`, and `output` sections.
- Staged lighting, backdrop, and surface changes are complete under `target` with descriptive
  attributes; no opaque style key is used as the visual value.
- The prose wrapper says to change only named elements, keep everything else exactly as it is, and
  preserve original composition.
- `output.locked` is positive and singular; semantic exclusions are expressed once in
  `semanticNegativePrompt`.
- The customer Flash path has one source reference and no style/steering references.
- Aspect ratio is omitted unless explicitly selected; explicit size tokens are uppercase.
- Thinking level is present in request configuration, not prompt prose.
- Logged prompt text is the exact text sent to the model.
- No old Structural Forcing prefix, single-letter JSON keys, string slicing, repeated negative
  constraints, or `Generate an image of:` synthesis prefix has slipped back in.

---

## 11. UI implications

- **Stage, then submit:** let users stack changes before one mutation request.
- **Show pending changes:** make the requested target visible before generation.
- **Use semantic controls:** expose meaningful lighting, backdrop, surface, framing, and ratio
  choices rather than technical reference-role selectors.
- **Keep reference semantics invisible where possible:** the customer sees the source photo as the
  image being edited; style tiles become descriptor attributes, not hidden image attachments.
- **Keep admin experimentation separate:** Pro reference experiments must not change the customer
  Flash contract.
