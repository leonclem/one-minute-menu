# Studio Finishing Touches

Written 2026-09-02 after the MVP landed in `/studio`. This is the living reference for what shipped, what the user can do, and what we deliberately left for later.

Related: the original product proposal is `.kiro/specs/studio-finishing-touches/gridmenu-finishing-touches-feature-spec.md`. That spec is **intent**, not architecture. This document describes the implementation.

Roadmap item: `src/TODO.md` — “Decorate, e.g. add garnishes, surrounding ingredients, etc.” (done).

---

## Purpose

Let a user professionalise a plain food photo by adding garnishes and small accompaniments **without writing a prompt**.

GridMenu owns the vocabulary (a fixed catalogue). A ranker suggests a short list from the current extract JSON. The user picks which of those suggestions to stage. **Generate** (the existing mutate path) applies them as an additive edit.

Studio ethos still holds: the original extract `MinimalSchema` (then each variant’s stored copy) is the dish description. Finishing touches **append** garnish names onto that JSON. They do not re-analyse the photo or rewrite lighting, vessel, surface, or `main_item`.

---

## What the user can do

All of this lives in the **Elements** accordion on `/studio`, below the existing garnish/side lists (those lists stay **remove-only**).

1. Click **Add finishing touches**. GridMenu loads up to four suggestions for the current image (cached per image; the button does not refetch until you switch variants).
2. Toggle chips on or off (`+` / `✓`). Nothing is generated yet. Helper copy: “Stages garnishes for Generate.”
3. Optionally stage lighting, surface, or backdrop as well. Finishing touches count as **one** pending Elements change, so they can sit with two other staged attributes under the cap of 3.
4. Click **Generate**. Credits are the same as any other mutate (NB2 = 1, NB Pro = 2). Recommend itself is free (text-only).
5. Before Generate, deselect chips, or **Discard** to clear the selection (the suggestion list stays until you change image).
6. Detected garnishes/sides from extract can still be removed in the Elements lists. Staged finishing touches do **not** appear in those lists; they are applied only at Generate time so extract items stay the ones you can remove.

If ranking finds nothing new (everything suggested is already on the dish), Elements shows: “This dish already looks finished.”

### What the user cannot do (MVP)

- Type a free-text garnish (admin Photo Control still can; FOH cannot).
- Browse the full catalogue. Only the ranked shortlist is shown.
- Draw placement, set counts, density, or intensity (Subtle / Styled / Abundant).
- Add extra bowls, cutlery, napkins, glasses, or a second serving.
- Ask this control to change the tabletop or backdrop (those remain Lighting / Surface / Backdrop).

---

## Behaviour on generate

Selected catalogue names are appended to `food_components.garnishes` (or `sides` if a catalogue row says so) on a **copy** of the current editor JSON. The prompt then asks the image model to:

- Add **only** those named items.
- Place them on the food and/or vessel according to catalogue placement hints.
- Scatter a few matching pieces on the **existing** table around the vessel when the item allows `scene` placement.
- Keep placement irregular and restrained (not a grid).
- Not add extra bowls, serving dishes, cutlery, napkins, glasses, ramekins, or unrelated props.
- Not change dish, plating, vessel, crop, or camera.
- Leave lighting, surface, and backdrop unchanged **unless** those are also in the same Generate delta.

The child variant stores the target JSON (parent extract plus the added names). The next edit in the chain starts from that copy.

---

## How it is built

| Piece | Where | Notes |
|---|---|---|
| Catalogue | `src/lib/studio/finishing-touches/catalogue.ts` | Code, not a DB table. ~24 items. |
| Ranker | `POST /api/studio/finishing-touches/recommend` | Uses dish name, `main_item`, current garnishes/sides, extract `description`. Constrained to catalogue IDs. `gemini-2.5-flash` (`STUDIO_EXTRACTION_MODEL`). |
| Fallback stack | coriander, lime wedges, red chilli, sesame seeds | Used when ranking is empty, unknown, or the API key is missing. Items already on the dish are skipped. |
| Staging | `src/lib/studio/finishing-touches/stage.ts` | Selection lives in client state; schema is updated at Generate. |
| Apply names | `applyFinishingTouchesLevel` in `apply-level.ts` | Still “first N of a stack”; Generate passes the **selected** items as that stack, with N = selection count. |
| Prompt | `directive.ts` + `directive-generator.ts` | One bundled addition clause for any garnish/side adds. |
| Persist | mutate `metadata.finishingTouches` | `{ stackIds, level, auto: true }` where `level` is the number selected and `auto: true` means catalogue-ranked (not free text). |
| Analytics | `studio_finishing_touches_recommended`; generate events with `generation_kind: finishing_touches` and `count_bucket` | Allow-listed scalars only. No prompts or image content. |
| Change chip | `Finishing touches: N selected` plus `Added garnish: …` | `src/lib/studio/change-summary.ts` |

Pending-change counting: garnish/side **adds** are one bundle (`countEditableChanges` plus `countStudioPendingChanges` for FOH selection that is not yet in the schema). Removals are still per item.

Output validation is unchanged and **does not** score whether herbs appeared. A weak garnish result still persists.

---

## Catalogue (MVP)

Placement is prompt-only. Schema field is almost always `garnishes`.

| Display name | Typical placement |
|---|---|
| Coriander | on food + table scatter |
| Lime wedges | on food, vessel rim, table scatter |
| Red chilli | on food + table scatter |
| Cashews | on food + table scatter |
| Parsley, basil, mint, thyme, rosemary, microgreens | on food + table scatter |
| Spring onion, chives, peanuts, pomegranate seeds, coconut flakes | on food + table scatter |
| Sesame seeds, black sesame, chilli flakes, crispy shallots, grated parmesan, fried garlic, paprika | on food |
| Lemon wedges | on food, vessel rim, table scatter |
| Pickled red onion | on food + vessel |

Aliases (cilantro / coriander, chili / chilli, and so on) stop the ranker from suggesting something the extract already listed.

---

## What we learned while shaping MVP

The first plan used **dressing levels** (level 1 = first item, level 2 = first two, and so on) so we could feel out how many adds Gemini can take. The shipped UI is a **ranked shortlist of chips** the user can mix. That is closer to “pick an outcome” than a full garnish library, and it still caps the generate payload at four names.

Live image quality (preservation, scatter restraint, combining with surface/lighting) was not fully proven in the implementation pass. Fixture tests cover massaman schemas and directives (`src/lib/studio/finishing-touches/__tests__/massaman-eval.test.ts`). A real `/studio` pass on the massaman before/after pair is still the way to decide default selection count and whether table scatter stays.

---

## Further enhancements

Roughly in product order, not a commitment.

### Shortlist and control

- Pre-select a tasteful default (e.g. two chips) after recommend, instead of an empty selection.
- “Style it for me”: one click that selects a restrained subset and optionally Generate.
- See more: extra compatible catalogue items beyond the four.
- Intensity: Subtle / Styled / Abundant as prompt density, not extra schema fields.
- Named presets (“Fresh & vibrant”) that are combinations, not a bigger picker.

### Placement and scene

- Drop table scatter if eval shows the model rewriting the surface or adding clutter.
- Explicit **on-plate only** vs **on-food only** when space is tight.
- Scene accents as a later opt-in (“style around the dish”) once on-food/on-vessel is reliable.
- Supporting props (second bowl, cutlery, napkin, ramekin) as a separate capability, not this control.

### Ranking and vocabulary

- Grow or edit the catalogue (still code until we need a CMS).
- Stronger use of colour/contrast and “already garnished” from extract, without a second vision pipeline.
- Cuisine / dish-family hints only if extract JSON starts carrying them; do not invent a parallel taxonomy.
- Visual suitability (a brown curry prefers green + red + lime over beige nuts) as a ranker input.

### Generation quality

- Decide whether finishing touches may share a Generate with lighting/surface, or should warn / run exclusive, **after** live eval.
- Optional garnish reference images (pro advice elsewhere in the roadmap).
- Soft validation that requested names are visible in the output (today’s validator is style-only).

### History and apply-elsewhere

- Treat a liked finishing-touch combo as a reusable style (“apply to all dishes”).
- Clearer variant chips when the only change was finishing touches.

---

## Out of scope (still)

These belong to other Studio work, not this feature:

- Surface / backdrop swap (already in Lighting / Surface / Backdrop).
- Object-edit draw-to-remove (and any future draw-to-add).
- Crop, magic expand, re-shoot, vessel swap.

Do not implement finishing touches as an object-edit `add` operation. Object-edit is annotation-driven and remove-only in production. This feature is an outcome picker on the mutate/delta path.

---

## How to try it

1. Run the app (`npm run dev`) and open `/studio`.
2. Select a dish with a completed extract.
3. Elements → **Add finishing touches** → toggle chips → **Generate**.
4. Confirm the new variant’s `metadata.editorState` only gained garnish (or side) names, and `metadata.finishingTouches` lists the selected ids.

Useful tests:

```text
npx jest --testPathPattern=finishing-touches --no-coverage
```
