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

1. Click **Add finishing touches**. GridMenu loads suggestions for the current image (cached per image; the button does not refetch until you switch variants). Both savoury dishes and cakes get a ranked list of up to 12 garnishes. The first four show as chips; **Show more** reveals the next four from that same response. You can select **up to four** for Generate. The same request also ranks up to four props, which appear as chips in the Props section.
2. Toggle chips on or off (`+` / `✓`). Nothing is generated yet. Helper copy: “Stages garnishes for Generate.”
3. Optionally stage lighting, surface, or backdrop as well. Finishing touches count as **one** pending Elements change, so they can sit with two other staged attributes under the cap of 3.
4. Click **Generate**. Credits are the same as any other mutate (NB2 = 1, NB Pro = 2). Recommend itself is free (text-only).
5. Before Generate, deselect chips, or **Discard** to clear the selection (the suggestion list stays until you change image).
6. Detected garnishes/sides from extract can still be removed in the Elements lists. Staged finishing touches do **not** appear in those lists; they are applied only at Generate time so extract items stay the ones you can remove.

If ranking finds nothing new (everything suggested is already on the dish), Elements shows: “This dish already looks finished.”

### What the user cannot do (MVP)

- Type a free-text garnish (admin Photo Control still can; FOH cannot).
- Browse the full garnish catalogue. Only the ranked shortlist is shown (up to 12, four at a time). Props can be browsed in full from **Browse props** / **Show more**.
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
| Catalogue | `src/lib/studio/finishing-touches/catalogue.ts` plus `catalogue-cake.ts` | Code, not a DB table. 43 savoury items; 32 cake items. Family defaults to savoury. Props live in `src/lib/studio/props/catalogue.ts` (39 items). |
| Ranker | `POST /api/studio/finishing-touches/recommend` | Uses dish name, `main_item`, current garnishes/sides, extract `description`. Returns `family` (`savory` or `cake`), up to 12 garnish ids, and up to 4 prop ids. Missing/invalid family is treated as savoury. `gemini-2.5-flash` (`STUDIO_EXTRACTION_MODEL`). |
| Fallback stack | savoury: coriander, lime wedges, red chilli, sesame seeds; cake: fresh berries, powdered sugar, chocolate shavings, mint sprig | Used when ranking is empty, unknown, or the API key is missing. Cake fallback is only used when family is cake (or a dessert-cake keyword assist on API failure). Items already on the dish are skipped. |
| Staging | `src/lib/studio/finishing-touches/stage.ts` | Selection lives in client state; schema is updated at Generate. |
| Apply names | `applyFinishingTouchesLevel` in `apply-level.ts` | Still “first N of a stack”; Generate passes the **selected** items as that stack, with N = selection count. |
| Prompt | `directive.ts` + `directive-generator.ts` | One bundled addition clause for any garnish/side adds. Drizzle/swirl removals restore the cake or plate surface instead of filling with background texture. |
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
| Parsley, basil, mint, dill, thyme, rosemary, microgreens | on food + table scatter |
| Spring onion, chives, peanuts, pomegranate seeds, coconut flakes, toasted pine nuts, flaked almonds | on food + table scatter |
| Sesame seeds, black sesame, chilli flakes, crispy shallots, grated parmesan, fried garlic, paprika, nori strips, fried capers | on food |
| Chilli oil drizzle, balsamic glaze | on food + vessel |
| Lemon wedges | on food, vessel rim, table scatter |
| Pickled red onion | on food + vessel |

Aliases (cilantro / coriander, chili / chilli, and so on) stop the ranker from suggesting something the extract already listed.

### Cake family

Cake is opt-in on the recommend call. The extract JSON and `MinimalSchema` do **not** store a dish family. If Gemini omits `family`, or returns anything other than `cake`, ranking stays on the savoury catalogue and savoury fallback. Crab, fish, corn, rice, and potato cakes are savoury.

Cake items have no table scatter. Schema field is `garnishes`. One default style is baked into each drizzle/swirl prompt; there is no style picker. The cake shortlist is the ranked ids only (up to 12), same as savoury. Generate still applies at most four selected names.

| Display name | Typical placement |
|---|---|
| Fresh berries | on cake + a few on the existing plate |
| Powdered sugar | light dusting on cake only |
| Chocolate shavings | on cake only |
| Mint sprig | one sprig on cake only (separate from savoury mint) |
| Lemon zest | on cake only |
| Pistachio crumbs | on cake only |
| Chocolate drizzle | thin zigzag on cake and/or plate; not a flood |
| Berry coulis | a few dots or a short drizzle on the plate |
| Cream swirl | one swirl or quenelle on the plate beside the cake |
| Lemon drizzle | thin drizzle on cake and/or plate; not a flood |
| Chopped pecans, crushed hazelnuts, cocoa dusting, orange zest, fresh fig slices | on cake only |
| Caramel drizzle | thin zigzag on cake and/or plate; not a flood |
| Edible rose petals | on cake, plus a few pieces on the existing plate |

Named drizzles and swirls can be removed through the existing Elements list once they appear on the JSON (including after a previous Generate). Removal asks the model to restore the cake or plate surface. Unnamed original-photo sauces still use draw-to-remove. Extract is unchanged.

Keyword assist filters **Browse props** before a rank exists. Cake, pie, and brownie count as dessert. A tart does not, unless the name also contains chocolate, caramel, or a fruit. Savoury cakes and savoury pies stay savoury. The same guess is the fallback when the recommend API key is missing or the ranker request fails. Once Gemini returns a family, that result replaces it.

---

## What we learned while shaping MVP

The first plan used **dressing levels** (level 1 = first item, level 2 = first two, and so on) so we could feel out how many adds Gemini can take. The shipped UI is a **ranked shortlist of chips** the user can mix. Generate still caps the payload at four garnish names. The suggestion list can hold up to 12, shown four at a time.

Live image quality (preservation, scatter restraint, combining with surface/lighting) was not fully proven in the implementation pass. Fixture tests cover massaman schemas and directives (`src/lib/studio/finishing-touches/__tests__/massaman-eval.test.ts`). A real `/studio` pass on the massaman before/after pair is still the way to decide default selection count and whether table scatter stays.

---

## Further enhancements

Roughly in product order, not a commitment.

### Shortlist and control

- Pre-select a tasteful default (e.g. two chips) after recommend, instead of an empty selection.
- “Style it for me”: one click that selects a restrained subset and optionally Generate.
- See more: shipped for the ranked window (four at a time, up to 12). A full garnish browser is still out.
- Intensity: Subtle / Styled / Abundant as prompt density, not extra schema fields (parked).
- Named presets (“Fresh & vibrant”) that are combinations, not a bigger picker.

### Placement and scene

- Drop table scatter if eval shows the model rewriting the surface or adding clutter.
- Explicit **on-plate only** vs **on-food only** when space is tight.
- Scene accents as a later opt-in (“style around the dish”) once on-food/on-vessel is reliable.
- Supporting props (second bowl, cutlery, napkin, ramekin) as a separate capability, not this control.

### Ranking and vocabulary

- Grow or edit the catalogue (still code until we need a CMS).
- Stronger use of colour/contrast and “already garnished” from extract, without a second vision pipeline.
- Cuisine / dish-family hints only if extract JSON starts carrying them; do not invent a parallel taxonomy. Cake vs savoury lives on the ranker response only.
- Intensity / density / distribution as prompt density, not extra schema fields (parked).
- Visual suitability (a brown curry prefers green + red + lime over beige nuts) as a ranker input.
- Further dessert families (tart, ice cream) as additional catalogues behind the same family gate.
- Swirl/drizzle style picker (zigzag vs dots vs pool) after the default styles prove reliable.

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

## Catalogue expansion log

2026-10-18. Source list: a ChatGPT brief that proposed 25 savoury garnishes, 29 cake garnishes, and 35 props. We shipped a first wave and left the rest until generation tests show the new items behave. Placements are still applied together, so an item listed as on-food and on-vessel and scene is asked for in all of those places. New herbs follow the existing herb pattern (on food + one table sprig), not all three.

### Added

| Kind | Name | Prep choice |
|---|---|---|
| Savoury | Dill | `chopped` / table `sprig`, same as parsley |
| Savoury | Nori strips | `sliced` (the existing "slivers, not thick chunks" sentence). `shavings` is written for chocolate curls |
| Savoury | Chilli oil drizzle, balsamic glaze | `drizzle`, on food and vessel, same as chocolate drizzle |
| Savoury | Toasted pine nuts, flaked almonds | `whole`, on food + a few matching pieces on the table |
| Savoury | Fried capers | `whole`, on food only, same as fried garlic |
| Cake | Cocoa dusting | `dusted`, on cake only, same as powdered sugar |
| Cake | Caramel drizzle | `drizzle`, on cake and plate |
| Cake | Orange zest | `fine-chop`, on cake only, same as lemon zest |
| Cake | Crushed hazelnuts | `crushed`, on cake only, same as pistachio crumbs |
| Cake | Fresh fig slices | `sliced`, on cake only, so the prompt does not also ask for slices on the rim |
| Cake | Edible rose petals | `whole`, on cake and a few on the plate. No table scatter |
| Prop | Chopsticks, fine grater | Cutlery & tools |
| Prop | Olive oil cruet, soy sauce dish, small jam jar | Condiments & service |
| Prop | Parmesan wedge, whole lemon, whole lime, cherry tomato vine, small bowl of berries | Ingredients |

Props are ranked (up to four chips) on the same finishing-touches request, and only from the dish family. Cake dishes are not offered savoury props such as salt mills or the olive oil cruet. Shared props (napkins, grater, whole lemon, butter dish) stay available for both. **Show more** opens the props that fit that family, grouped, with an icon on each group title. Before that request, **Browse props** uses the same filter from the dish name. Fallback ranking does not invent props.

### Second wave (2026-10-18)

Added once the first wave held up. Prep and placement follow the existing sentences. A few names were adjusted so labels stay unique.

**Savoury:** Oregano, sage, tarragon (herb pattern: on food + table sprig). Radish slices and cherry tomato halves (sliced or halved on the food, one whole piece on the table). Cucumber slices on the food only. Pumpkin seeds. Toasted breadcrumbs. Furikake. Lime zest uses `fine-chop`, same as lemon zest. Pistachio nuts (not “crushed pistachios”, which is already an alias of cake Pistachio crumbs). Cracked black pepper and sumac use `dusted`; that sentence now says “the food”, not “the cake”.

**Cake:** Cinnamon dusting, matcha dusting, biscuit crumbs, cacao nibs, toasted coconut chips, toasted flaked almonds (alias avoids the savoury “toasted almond flakes” label), chopped walnuts with `prep: 'crushed'` so the herb-sprig sentence is not used, candied orange peel, candied ginger, kiwi slices, edible pansies, honey drizzle (no bare “honey” alias), white chocolate drizzle, lemon curd swirl, passion fruit pulp.

**Props:** Soup spoon, butter knife, tomato sauce ramekin, chilli oil dish, garlic bulb, kimchi bowl, pickle bowl (savoury). Teaspoon, dessert fork, cake server, wooden spoon, mini whisk, bag of flour, chocolate squares, cocoa tin, honey pot, cinnamon sticks, vanilla pods (cake). Small butter dish is shared. Greenery is shared except potted basil, which is savoury only: a trailing vine entering from the top of the frame, dried grasses, leafy stems in a glass, and cow parsley. They stay behind the dish and do not replace the backdrop. The earlier generic leafy and grassy pots were removed. Jam jar and the berry bowl are cake-only and sit in the Baking group.

### Still not added, and why

- Chervil, fennel fronds, savoury edible petals, sunflower seeds. Too close to dill, parsley, rose petals, or the seeds already listed.
- Freeze-dried raspberry dust, freeze-dried strawberry crumbs, desiccated coconut, crushed meringue, chocolate chips, crushed macadamias, candied lemon peel, candied violets. Near-duplicates of cocoa, berries, coconut chips, hazelnuts, candied orange peel, or rose petals.
- Salt cellar and a separate pepper mill. The wooden salt mill and the salt-and-pepper pair already cover them.
- Cake knife beside the cake server. Halved lemon beside whole lemon and the lemon-wedge garnish. Rosemary sprigs beside the rosemary garnish.
- Espresso cup, tea cup, water glass, milk jug. They tend to become a second subject.

### Prompt notes we did not paste in

The brief's global prompt paragraph repeats rules already in the identity clause, `FINISHING_TOUCHES_RULE`, and `PROPS_RULE`. Not added. Still unsolved, and not worth a new paragraph until photos show the failure: dropping a prop when the crop has no table, and suppressing a whole lemon next to lemon wedges.

## How to try it

1. Run the app (`npm run dev`) and open `/studio`.
2. Select a dish with a completed extract.
3. Elements → **Add finishing touches** → toggle chips → **Generate**.
4. Confirm the new variant’s `metadata.editorState` only gained garnish (or side) names, and `metadata.finishingTouches` lists the selected ids.

Useful tests:

```text
npx jest --testPathPattern=finishing-touches --no-coverage
```
