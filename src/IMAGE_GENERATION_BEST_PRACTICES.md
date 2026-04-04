# GridMenu — AI Food Photography: Best Practices & Prompting Guide

> Internal reference for optimising image generation quality, cost, subscriber value, and UI design.
> Last updated: April 2026

---

## 1. Model Landscape (March 2026)

**Decision: Migrate to Nano Banana 2 (Gemini 3.1 Flash Image).**

NB2 launched February 26, 2026. It is the second-generation product, delivers richer output, supports 4K, and costs less than Nano Banana Pro. As a second-generation model, prompt adherence and compositional quality are meaningfully better. This is the right move.

| Model | Official Name | Speed | Max Res | Cost/image (approx) | Status |
|---|---|---|---|---|---|
| Nano Banana | Gemini 2.5 Flash Image | Fast | 1K | ~$0.039 | Current default — migrate away |
| Nano Banana Pro | Gemini 3 Pro Image | 20–60s | 2K | ~$0.134 | Admin experimental only |
| **Nano Banana 2** | **Gemini 3.1 Flash Image** | **4–6s** | **4K** | **~$0.067** | **Target default** |
| Imagen 4.0 | Imagen 4.0 | Medium | 2K | TBC | Admin experimental only |

> Pricing source: [Fello AI — Nano Banana 2 review](https://felloai.com/nano-banana-2/) and [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). Image output ~$60/1M tokens; a standard image consumes ~1290 tokens ≈ $0.067 for NB2.

---

## 2. Subscriber Tier — Image Resolution Strategy

### Current state (to be updated)

| Plan | Allowance | Type |
|---|---|---|
| Free | 50 generations | Monthly |
| Creator Pack | 200 generations | One-time (not monthly) |
| Grid+ | 300 generations | Monthly |
| Grid+Premium | 1,000 generations | Monthly |

### Proposed resolution tiers

**Key decision:** NB2 costs the same per image regardless of whether you generate at 1K or 4K (cost is per token, and resolution differences are marginal at this price point). This means we can offer 4K to both Grid+ and Grid+Premium without a meaningful cost difference. Grid+Premium is still differentiated by volume (1,000 vs 300 images/month).

**Default for all tiers: 1K.** Users opt in to higher resolution at the point of generation (a checkbox or toggle). This keeps average costs well below worst-case.

| Plan | Default Res | Max Res (opt-in) | Model | Cost/image | Monthly allowance | Worst-case monthly cost | Monthly revenue |
|---|---|---|---|---|---|---|---|
| Free | 1K | 1K | NB2 | ~$0.067 | 50 | ~$3.35 | — |
| Creator Pack | 1K | 1K | NB2 | ~$0.067 | 200 (one-time) | ~$13.40 | USD $75 one-time |
| Grid+ | 1K | 4K (opt-in) | NB2 | ~$0.067 | 300/month | ~$20.10 | USD $35/month |
| Grid+Premium | 1K | 4K (opt-in) | NB2 | ~$0.067 | 1,000/month | ~$67.00 | USD $109/month |

### Sanity check

- Grid+ worst-case: ~$20/month image cost vs $35 revenue. Viable, especially since most users won't hit 300/month.
- Grid+Premium worst-case: ~$67/month image cost vs $109 revenue. Comfortable margin even at full usage.
- Free tier worst-case: ~$3.35 for 50 images. Acceptable as a loss-leader.
- Creator Pack: ~$13.40 image cost against $75 one-time revenue. Fine.

### Action required

- Update `/pricing` page to reflect resolution entitlements per tier (4K available for Grid+ and Grid+Premium).
- Update `PLAN_CONFIGS` in `src/types/index.ts` to add a `maxImageResolution` field per plan.
- Add a resolution opt-in toggle to the image generation modal (default: 1K, opt-in: 4K for eligible plans).

---

## 3. The Core Prompting Principle

**Nano Banana 2 is a language model — describe scenes, not keyword lists.**

NB2 processes prompts through a 32,768-token context window. It understands relationships, spatial arrangements, and narrative context. Keyword-stuffing (a habit from older CLIP-based models) actively hurts output quality.

❌ Weak (keyword list):
```
grilled chicken, white plate, restaurant, garnish, 4K, professional
```

✅ Strong (scene description):
```
A grilled half-chicken with golden-brown crispy skin, resting on a clean white ceramic plate.
Garnished with a sprig of fresh rosemary and a wedge of lemon.
Three-quarter camera angle, shallow depth of field.
Soft natural window light from the left, gentle shadows, clean neutral background.
Photoreal food photography. No text, no people, no hands.
```

Source: [cursor-ide.com — Nano Banana Best Prompts](https://cursor-ide.com/blog/nano-banana-best-prompts), [skywork.ai — Prompt Engineering Best Practices](https://skywork.ai/blog/nano-banana-gemini-prompt-engineering-best-practices-2025/)

---

## 4. Recommended Prompt Structure for Food Photography

Use this modular structure consistently. Each clause removes ambiguity.

```
[SUBJECT]      Dish name, key ingredients, cooking method, plating style.
[COMPOSITION]  Camera angle, framing, background, depth of field.
[LIGHTING]     Light quality, direction, mood.
[STYLE]        Photography aesthetic, colour palette.
[CONSTRAINTS]  Explicit exclusions — what must NOT appear.
```

### Example — Menu Hero Shot

```
A bowl of laksa with thick rice noodles, prawns, fish cake slices, and a rich coconut
curry broth. Garnished with fresh bean sprouts, a halved boiled egg, and chopped spring onion.
Three-quarter angle (45°), dish centred, shallow depth of field, clean neutral background.
Soft natural window light from the left, gentle shadows, warm tones.
Photoreal food photography, sharp focus on the dish, appetizing presentation.
No people, no hands, no text, no watermarks, no utensils in frame.
```

---

## 5. Key Variables and Their Impact

These variables inform prompt construction behind the scenes. They do not need to be exposed as form fields — they map to UI choices (see Section 9 on the new modal design).

### Camera Angle
| Angle | Best for |
|---|---|
| Three-quarter (45°) | Most dishes — default |
| Top-down (90°) | Flat dishes, bowls, sharing plates |
| Eye-level | Burgers, stacked items, drinks |
| Macro close-up | Texture-forward dishes, desserts |

### Lighting
| Style | Best for |
|---|---|
| Soft natural window light | Most dishes — default |
| Studio softbox | Clean product shots, white backgrounds |
| Moody restaurant | Fine dining, premium meats |
| Bright daylight | Fresh salads, drinks, brunch |
| Golden hour | Warm, lifestyle-feel shots |

> **Implementation note (April 2026):** `buildPromptV2()` currently implements three lighting options: `natural`, `studio`, and `moody`. The proposed modal design (Section 9) shows four icon buttons including Warm and Golden Hour — these are not yet wired up in the type system or prompt construction. Do not add them until the unified modal redesign is underway.

### Background
| Background | Best for |
|---|---|
| Neutral / clean | Menu hero shots — most versatile, default |
| White marble | Desserts, pastries, premium items |
| Dark slate | Fine dining, meats, rich sauces |
| Warm wood table | Casual dining, comfort food |
| Restaurant table setting | Composite/contextual shots |

> **Implementation note (April 2026):** "Neutral / clean" has been retired as the default. Dark slate is now the universal default surface in `buildPromptV2()` for all establishment types except those with an explicit override (cafe-brunch → warm wood, bakery-dessert → marble, hawker-foodcourt → stainless steel). The rationale: our standard plate is a warm beige circular ceramic, and dark slate provides the contrast needed for clean cutout segmentation. "Neutral clean surface" produced flat, low-contrast results that made background removal unreliable. There is no scenario where we should fall back to a neutral surface — it's either dark slate, an establishment-specific surface, or a user-supplied reference scene.

---

## 6. Cuisine-Specific Guidance (Behind the Curtain)

Cuisine context is woven into prompt construction automatically from the user's venue profile. Not exposed in the UI.

| Cuisine | Prompt additions |
|---|---|
| Singaporean / Hawker | "authentic hawker centre presentation, vibrant colours, casual ceramic bowl" |
| Peranakan | "ornate nyonya ware, intricate garnish, vibrant traditional colours" |
| Japanese | "minimalist zen plating, precise arrangement, matte ceramic, negative space" |
| Fine dining (any) | "elegant plating with intentional negative space, premium restaurant setting" |
| Bakery / Desserts | "soft pastel tones, warm oven light, tempting textures, bakery display style" |
| Street food / Casual | "vibrant, fresh, approachable, bright natural light" |

### What's currently wired up (April 2026)

| Signal | Source | Used in prompt? |
|---|---|---|
| Establishment type | `menus.establishment_type` | Yes — drives surface selection |
| Primary cuisine | `menus.primary_cuisine` | Yes — drives cuisine context clause |
| Item category | `menu_items.category` | Yes (fixed April 2026) — drives form factor hint |
| Country / location | User profile | No — not yet wired up |

**Item category is the most important signal for ambiguous item names.** "Buttermilk Chicken" on a plate is a perfectly reasonable interpretation without context — but in a "Burgers" category it should be in a bun. `getCategoryContext()` in `prompt-construction.ts` maps common category names (Burgers, Pizza, Pasta, Soup, Salad, Desserts, Drinks, Starters, etc.) to form-factor hints injected into the subject clause. Unknown categories fall back to `"From the {category} section of the menu."` which still provides useful context.

---

## 7. Reference Image Modes — Simplified

The current implementation exposes too many reference image roles (Dish/Subject, Table/Scene, Style/Lighting, Plating/Layout, Other) and a free-text comment field. This is too technical for GridMenu users.

**Proposed simplification — two reference use cases only:**

### Use this plate / bowl / vessel
User uploads a photo of their actual crockery. The model uses it to match the vessel type, colour, and style.
- Prompt addition: `"Serve the dish in the same type of vessel shown in the reference image — match the shape, colour, and material. Do not copy any other elements."`

### Use this setting / background
User uploads a photo of their actual table, bar, or venue. The model places the dish into that scene.
- Prompt addition: `"Place the dish naturally into the scene shown in the reference image. Match the perspective, lighting direction, and surface. Keep geometry realistic — no warped plates, no floating food."`

These two can be combined (upload one image for both purposes, or two separate images). The role dropdown and free-text comment field are removed. The intent is inferred from which slot the image is placed into.

**What GridMenu users realistically want from reference images:**
1. Consistency with their actual crockery/branding
2. Consistency with their actual venue aesthetic
3. Style-matching from a previous generation they liked

That's it. Everything else is noise for this audience.

---

## 8. Negative Prompts / Constraints (Always Applied, Never Shown)

These are baked into every prompt automatically. Never ask the user to type them.

**Standard food photography constraints (always included):**
```
No people, no hands, no text, no watermarks, no logos, no utensils in use,
no blurry dish, no artificial colours, no plastic-looking textures,
no overexposed highlights, no clutter.
```

**Additional for composite/scene shots:**
```
No warped plates, no floating food, no mismatched perspective, no incorrect shadows.
```

The current "Exclude from image" text field is removed from the UI. These constraints are handled automatically.

---

## 9. New Modal Design — Unified, Simplified

**Key decisions:**
- One shared modal for both singular and batch generation (currently two separate components: `AIImageGeneration.tsx` and `BatchAIImageGeneration.tsx`).
- Remove "Choose a style" (Modern/Rustic/Elegant/Casual) — these map to vague keyword-list prompts and are being replaced by the narrative prompt approach.
- Remove "Exclude from image" text field — constraints are always applied automatically.
- Remove "Additional details" text field from the primary UI — if retained at all, it lives in a collapsed "Expert mode" section for power users only.
- Remove the Presentation dropdown (White plate / Wooden board / Overhead / Close-up / Bokeh / None).
- Replace Lighting dropdown with large icon buttons (3–4 options max).
- Reference images simplified to two named slots (see Section 7).
- Resolution opt-in (1K default, 4K for eligible plans) as a simple toggle.

### Proposed modal structure

```
┌─────────────────────────────────────────────────────┐
│  [Item name]                    [X generations left] │
│  [Item description — read only]                      │
├─────────────────────────────────────────────────────┤
│  Lighting                                            │
│  [☀ Natural] [🕯 Warm] [💡 Studio] [🌅 Golden Hour] │
│  (large icon buttons, one selected at a time)        │
├─────────────────────────────────────────────────────┤
│  Reference photos (optional)                         │
│  [+ Use my plate/bowl]  [+ Use my venue/table]       │
│  (each slot shows thumbnail when filled, tap to      │
│   replace or remove)                                 │
├─────────────────────────────────────────────────────┤
│  Resolution: [1K ●] [4K ○]  (Grid+/Premium only)    │
├─────────────────────────────────────────────────────┤
│  [Cancel]              [✦ Generate Photo]            │
└─────────────────────────────────────────────────────┘
```

For batch mode, the item list replaces the item name/description header, and the same controls apply to all items in the batch.

### What's removed vs current UI

| Current element | Decision |
|---|---|
| "Choose a style" (Modern/Rustic/Elegant/Casual) | Removed — replaced by narrative prompt construction |
| Lighting dropdown | Replaced by icon buttons |
| Presentation dropdown | Removed — handled by reference image slots |
| "Exclude from image" text field | Removed — always applied automatically |
| "Additional details" text field | Removed from primary UI (optional expert mode only) |
| Reference image role dropdown | Removed — replaced by named slots |
| Reference image comment textarea | Removed — intent inferred from slot |
| "Advanced options" collapsible | Removed — everything is now top-level and minimal |

### What's preserved

- Reference image upload (up to 2 named slots)
- "Add as Reference" from previous generations
- Previous generated images display
- Error display with retry
- Daily/monthly quota display
- Batch progress list

---

## 10. Iterative Refinement (Multi-Turn) — On Rails

NB2 supports conversational editing. We preserve this but put it on rails rather than exposing free-text.

After a generation, the user sees the result and can:
- **"Try again"** — regenerates with the same settings
- **"Use as reference"** — adds the generated image to the reference slot and regenerates (the primary iterative loop)
- **"Use this"** — selects the image

We do not expose a free-text "refine this image" prompt. The reference image mechanism is the refinement tool.

---

## 11. Common Failure Modes — Handled Automatically

These are addressed by the new prompt structure and automatic constraints. No user action required.

| Problem | Fix in new approach |
|---|---|
| Generic, flat result | Narrative prompt construction replaces keyword lists |
| Wrong dish appears | Item name + description + category all fed into prompt |
| Cluttered background | "clean neutral background, no clutter" always in constraints |
| Harsh/unnatural lighting | Lighting selection maps to specific prompt language |
| Plastic-looking food | "natural textures, realistic surface detail" always included |
| Content policy block | Constraints clause prevents most triggers proactively |
| Warped plate geometry | Composite constraints always applied when reference used |
| People/hands appearing | "No people, no hands" always in constraints |

---

## 12. Prompt Construction Refactor — What Changes in Code

Current gaps in `src/lib/prompt-construction.ts`:

1. **Comma-separated modifier lists** — `buildPrompt()` appends style modifiers as a comma list. Replace with narrative sentence construction.
2. **No inline constraints clause** — negative prompts are a separate parameter. Move core constraints inline into the main prompt.
3. **Generic quality tail** — `", high quality, professional photography, appetizing, well-lit"` appended as keywords. Embed these concepts in the scene description instead.
4. **Style templates are vague** — `modern`, `rustic`, `elegant`, `casual` templates don't include camera angle or lighting direction. These are being retired in favour of the structured narrative approach.
5. **Description normalisation is good** — the 350-char clamp and natural break logic in `normalizeDescription()` is solid. Keep it.

### Revised prompt template

```
{dish_name} — {key_ingredients_and_cooking_method}.
Plated {plating_style} on {surface}.
{camera_angle} camera angle, shallow depth of field, dish in sharp focus.
{lighting_description}.
{background_description}.
{cuisine_context}.
Photoreal food photography, natural textures, appetizing presentation.
No people, no hands, no text, no watermarks, no clutter.
{reference_instructions_if_applicable}
```

---

## 13. Testing Approach

Automated unit tests can cover prompt construction logic (input → expected prompt string). They cannot validate visual output quality.

**What to test automatically:**
- `buildPrompt()` output matches expected narrative structure for given inputs
- Constraints clause is always present in output
- Cuisine context is correctly injected from venue profile
- Reference image instructions are correctly appended when reference slots are filled
- Resolution parameter is correctly passed based on plan tier
- Batch and singular paths produce identical prompt structure

**What requires manual testing:**
- Visual quality of generated images across lighting options
- Reference image slot behaviour (plate matching, scene matching)
- "Use as reference" iterative loop
- Resolution toggle (1K vs 4K visual difference)
- Batch progress UI
- Error states and retry behaviour
- Mobile layout of the new modal

**Recommended approach:** Build the new unified modal first in the admin area (as a new admin page or replacing the existing Gemini 2.5 Flash admin generator). Validate prompts and visual output there before migrating to `/extracted`. This keeps experimentation out of the production user flow.

---

## 14. Next Steps (Updated)

### Immediate
- [ ] Migrate default model from Nano Banana (Gemini 2.5 Flash) to Nano Banana 2 (Gemini 3.1 Flash Image) in `src/lib/nano-banana.ts` default URL
- [ ] Refactor `buildPrompt()` in `src/lib/prompt-construction.ts` to use narrative structure (Section 12)
- [ ] Add inline constraints clause to all generated prompts — remove reliance on separate negative prompt field
- [ ] Retire `modern`/`rustic`/`elegant`/`casual` style templates from prompt construction

### Modal redesign
- [ ] Design and build unified `ImageGenerationModal` component (replaces both `AIImageGeneration.tsx` and `BatchAIImageGeneration.tsx`)
- [ ] Replace lighting dropdown with icon button row (Natural / Warm / Studio / Golden Hour)
- [ ] Replace reference image role dropdown + comment textarea with two named slots (plate/vessel, venue/scene)
- [ ] Remove "Choose a style", "Exclude from image", "Additional details", and "Presentation" fields
- [ ] Add resolution toggle (1K default, 4K opt-in for Grid+ and Grid+Premium)
- [ ] Build and validate in admin area first, then migrate to `/extracted`

### Pricing & tiers
- [ ] Update `/pricing` page to reflect 4K resolution for Grid+ and Grid+Premium
- [ ] Add `maxImageResolution` field to `PLAN_CONFIGS` in `src/types/index.ts`
- [ ] Update Creator Pack allowance display (200 one-time, not monthly)

### Testing
- [ ] Write unit tests for refactored `buildPrompt()` covering all cuisine/lighting/reference combinations
- [ ] Manual test checklist for new modal (see Section 13)
