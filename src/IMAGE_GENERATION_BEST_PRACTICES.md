# GridMenu — AI Food Photography: Best Practices & Prompting Guide

> Internal reference for optimising image generation quality, cost, subscriber value, and UI design.
> Last updated: June 2026

---

## 1. Model Landscape (June 2026)

**Decision: Nano Banana 2 (Gemini 3.1 Flash Image) is the production default.**

NB2 (Gemini 3.1 Flash Image) has proven capable of high-precision perspective control (including difficult 0° eye-level shots) when using aggressive structural prompting. NB Pro (Gemini 3 Pro Image) remains available for admin experimentation but is not required for standard precision tasks.

| Model | Official Name | Speed | Max Res | Cost/image (approx) | Status |
|---|---|---|---|---|---|
| Nano Banana | Gemini 2.5 Flash Image | Fast | 1K | ~$0.039 | Retired |
| **Nano Banana 2** | **Gemini 3.1 Flash Image** | **4–6s** | **4K** | **~$0.067** | **Production Default** |
| Nano Banana Pro | Gemini 3 Pro Image | 20–60s | 2K | ~$0.134 | Admin Experimental |

---

## 2. The AI Camera Conundrum: Forcing 0° Perspective

AI models are biased toward the "visual average" of their training data. In food photography, this is the **45-degree "Diner's Perspective"**. To break this bias and achieve a true 0° Eye-Level shot, "polite" technical terms are insufficient. You must use **Structural Forcing** and **Literal Denial**.

### Aggressive Terminology
Avoid "Eye-level" (which models often interpret as 30-45°). Use:
- `"Table-top horizon shot"`
- `"Zero-degree camera pitch"`
- `"Straight-on side profile view"`
- `"Ground-level shot looking across the plate"`

### Structural Denial Clause
Tell the model exactly what it is **not allowed to see**. This forces the geometric reconstruction:
- `"The top surface of the plate and the top view of the food layout must not be visible."`
- `"The plate must render as a perfectly flat, horizontal line across the canvas."`

### Perspective Override Prefix
For perspective shifts (especially from an overhead or 45° source image), prefix the prompt with:
`CRITICAL: CHANGE PERSPECTIVE TO SIDE-VIEW. IGNORE THE ANGLE OF THE REFERENCE IMAGE.`

---

## 3. Prompt Budget Management (2000-Char Limit)

The `NanoBananaClient` enforces a hard **2000-character limit**. When combining natural language directives with JSON state anchors, the budget can be breached easily.

### Extreme Compression Strategy
If the codebase were lost, these are the essential rules for prompt generation:
1. **Single-Letter JSON Keys**: Use `s` for scene, `a` for angle, `f` for framing, `c` for canvas, `v` for vessel, etc.
2. **String Slicing**: Clamp all user-provided or extracted strings (dish names, descriptions, background details) to **50–100 characters**.
3. **Narrative Essence**: Remove "fluff" words. Instead of *"Use an 85mm prime lens at f/1.8 to create a shallow depth of field"*, use *"85mm lens at f/1.8, shallow depth of field"*.
4. **Metadata Keys**: Shorten keys in structured metadata (e.g., `pitch_angle` -> `pitch`, `output_format` -> `format`).

---

## 4. Framing & Identity Preservation

To prevent the model from cropping the dish or losing the "vessel" (plate/bowl), use explicit framing constraints.

### The "Full Shot" Rule
Always include: `"Ensure the entire subject and its vessel are fully visible in the frame without any cropping at the edges. Maintain negative space on all sides."`

### Identity Preservation
When mutating an image, the model needs a "grounding anchor" to keep the food looking like the same dish:
`"Preserve {main_item}: maintain its physical texture, shape, and structure exactly as shown in the original image."`

---

## 5. Reference Image Modes (Multi-Image Steering)

Nano Banana supports up to 14 reference images (Pro) or 3 (Flash). We use three distinct roles:

1. **The Dish (Role: 'dish')**: The source image being edited.
2. **The Vessel (Role: 'style')**: A photo of the user's actual crockery to match shape/color.
3. **Structural Alignment Guide (Role: 'layout')**: A diagram or blueprint (e.g., a 3D camera angle chart) to help the model understand the target perspective.

---

## 6. Recommended Prompt Structure (Narrative)

**Nano Banana is a language model — describe scenes, not keyword lists.**

```
[PREFIX]       Perspective override (if applicable).
[DIRECTIVE]    What is changing (Angle, Lighting, Position, Add/Remove).
[GROUNDING]    "Original" and "Target" state anchors in compressed JSON.
[METADATA]     "Camera" and "Meta" specifications in compressed JSON.
[CONSTRAINTS]  "No people, no hands, no text, no cropping."
```

### Example: Compressed Eye-Level Mutation
```
CRITICAL: CHANGE PERSPECTIVE TO SIDE-VIEW. IGNORE THE ANGLE OF THE REFERENCE IMAGE. 
Change angle to 0-degree Table-top horizon shot. Plate as flat line, no top surface visible.
85mm lens at f/1.8. Ensure entire dish in frame, no cropping.

Original: {"s":{"a":"45-degree"},"f":{"m":"Churros"}}
Target: {"s":{"a":"eye-level"},"f":{"m":"Churros"}}

Camera: {"pitch":"0°","lens":"85mm","focus":"shallow"}
Meta: {"style":"photoreal","format":"JPG","framing":"full shot"}
```

---

## 7. Common Failure Modes & Fixes

| Problem | Fix |
|---|---|
| **Perspective Bias** | Use "Structural Denial" and "Perspective Override Prefix". |
| **Cropped Dish** | Add "Full shot, negative space on all sides" to framing. |
| **Budget Breach** | Apply "Extreme Compression" (single-letter keys, string slicing). |
| **Plastic Texture** | Include "natural textures, realistic surface detail" in constraints. |
| **Mismatched Lighting** | Use structured `Camera` metadata to specify aperture and focus. |

---

## 8. Modal UI Design Principles

- **Stage, then Submit**: Do not trigger prompts on every click. Allow users to stack up to 3 changes.
- **Visual Feedback**: Show a "Pending Changes" counter.
- **Model Transparency**: Allow admins to switch between Flash and Pro, but default to Flash (NB2) for cost-efficiency.
- **Reference Slots**: Use named slots ("My Plate", "My Venue") instead of technical "Role" dropdowns.
