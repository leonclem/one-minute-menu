# Scenes POC — what we tried, and why it stopped

Status: stopped on 9 October 2026. The two-image scene composite is not the path.
The uncommitted scene implementation was removed after this write-up. Last commit on `main`
does not contain the Scenes tab, the scene API, or these prompts.

Read this before starting the next look at Quick Looks. Do not rebuild the two-image composite
from the old handoff. That handoff described the plan. This file records how the plan behaved.

## Product intent

Upload a real dish photo, pick a look, get a usable photograph. Food must stay recognisable:
ingredients, portion, shape, plating, vessel. The surroundings may change.

A Scene was meant to be one creative treatment guided by a reference photo, not a bundle of
Fine-tune controls (lighting, backdrop, surface). Props, user-uploaded references, recommendations,
analytics, and renaming the Fine-tune tab were out of scope.

## Reference photos

All four are angled. None is overhead. They live in `public/studio/scenes/` and were not committed.

| File | What it shows | Placement note from review |
|---|---|---|
| `recipe-editorial.jpg` | Wooden counter, soft kitchen, tomatoes left, peppers right. A clear gap. | The open center between the vegetables. |
| `bakery-morning.jpg` | Warm bakery table, window light, bowls, whisks, flour. Crowded. | Just behind the copper rolling pin, more central. Not a perfect scene. Ignore the corner sparkle. |
| `dark-moody.jpg` | Dark wood table, one overhead lamp, wet-looking boards. Near edge is out of focus. | The lit, sharp band under the pendant, on the near half of the table. |
| `clean-commercial.jpg` | Stainless commercial kitchen, not a clean studio surface. | The open near island, clear of the sink basins. |

## What was built

Uncommitted, and removed with the rollback:

- A **Scenes** tab, default, with four cards. Selection staged only. Generate used the existing Std | Pro toggle, credit cost, and signup gate.
- `POST /api/studio/scene` sent two inline images on `generateContent`.
  - Image A: the food base (the upload, or the latest non-scene edit such as remove, keep, crop, expand, or Fine-tune).
  - Image B: the scene jpg.
- Another scene was a sibling of that food base, not a child of the previous scene.
- Aspect ratio came from Image A.
- Later, a one-shot extractor wrote a reviewed JSON record per scene (setting, surface, placement, framed by, lighting, scale reference, objects to preserve, surface interaction, scene camera, background lock). Generation was supposed to read that record and not analyse the scene again. Dish wording came from the stored upload analysis (main item, vessel, description). Missing analysis stayed generic.

Std and Pro could be pointed at Gemini model URLs (`STUDIO_STD_MODEL_URL`, `STUDIO_PRO_MODEL_URL`) so Nano Banana 2.1 could be tested beside `gemini-3.1-flash-image` and Nano Banana Pro. That endpoint wiring was also uncommitted and was removed with the rollback.

## Approaches

### 1. Rebuild the look, keep Image A's camera

The first studio prompt told the model to rebuild the surroundings in the mood of Image B, keep Image A's camera, and not reproduce Image B. It sent a JSON descriptor. It never named where the dish should sit.

Result: poor. Reviewers rejected it.

Separate direct Gemini tests, outside the product, looked better when the prompt named a landing spot and told the model to leave the scene photo alone. Two remembered examples: banana bread just in front of the bakery tools, and a plate of salmon between the tomatoes and the peppers, with the plate tilted to the scene camera. Those tests were not re-run inside Studio.

### 2. Place the dish into Image B

This is the plan the old handoff agreed. Image B owns the room, the camera, and the light. Image A owns the meal. The prompt was prose, filled from the reviewed record:

1. Place the dish in the named gap.
2. Match the scene's light, including a contact shadow and a little reflected light.
3. Match the scene's camera and scale. Do not keep the dish photo's camera.
4. Keep the named surrounding objects.
5. Do not change the background.

A research brief (8 October 2026, `gridmenu_image_compositing_research.md`) supported this shape. Google's composition template and Runware's product-on-a-table example are short prose: take the object from the first image, put it in a named spot in the second, match that scene's light and camera. The brief also said a camera mismatch forces the model to invent a new view of the dish, and that this threatens fidelity. Staged masking (cut out the plate, paste it, harmonise) fixes light and edges. It does not invent the unseen side of the food. Leaderboard rank was not treated as a reason to switch models.

Studio result, overhead salmon into Dark & Moody: the room, the lamp, and the table were the scene. The plate was still the overhead photograph, set down on the table with a contact shadow. The fillet, asparagus, and potato were still seen from above. Nano Banana 2.1 was better than `gemini-3.1-flash-image` and better than Nano Banana Pro. It was still not a matching camera.

The same angle failure was reported across the other tests and the other models. This write-up has only one pair in front of it: that overhead salmon and Dark & Moody.

Why that pair fails:

- The source looks straight down. The plate is a circle. Dark & Moody looks along the table. A true match would show a thin ellipse, the near rim, and the sides of the food. Those sides are not in the photograph.
- The request opener, shared in spirit with other edits, told the model it was editing Image A and to preserve the food. The scene prompt then said to match Image B's camera and not to rearrange the meal. A real camera change has to change what you see.
- The stored analysis did not label that salmon as overhead, so the mismatch sentence never ran. The log of the prompt confirmed the sentence was absent.
- "Scale it to the pendant lamp" and "move the lamp, walls, windows, and chairs if the dish needs room" were the wrong kind of instruction for an empty table. The droplets line referred to wet specks already on the Dark & Moody boards, so they would not be painted onto the salmon. Neither issue was the angle failure.
- Quote marks around two prompt lines in a pasted log were JavaScript quoting, because those lines contain an apostrophe. They were not sent to the model.

### 3. Concession: keep the meal, allow the viewpoint to change

The opener and the scene prompt were changed so they agreed. Keep the same ingredients, amounts, arrangement, and vessel. Change the viewpoint to Image B's camera. Lay the vessel so its ellipse follows Image B's surface. Show the near rim and the sides of the food that camera would see. Foreshortening and occlusion were allowed. Adding or removing food was not.

"Preserve it exactly, but reconstruct it so it sits on the table" was considered and not used. The salmon result already sat on the table. That wording describes the failure.

After further testing, this was still not good enough to keep.

### 4. Reverse: keep Image A's camera, rebuild the surroundings

Image A kept its food, plate, camera position, framing, and proportions. Image B was only an atmosphere reference (setting, surface, light). Landing spot, camera match, and "move these objects" were removed so they would not pull the dish into Image B.

The hope was a same-angle photograph with a new room around it. That is closer to a mood change than to a reshoot. It was tried and rejected. The specific way it failed was not captured in this chat.

## Why it stopped

Putting a real dish into a reference photo asks the model to re-photograph the dish from the scene's camera. When the cameras differ, the model keeps the dish's viewpoint and borrows the room, or it redraws the food. Prompt concessions did not find a balance worth shipping. Using the scene photo only as inspiration, or masking and harmonising, does not create the missing sides of the food.

The part that did work in the Dark & Moody test was the room. The part that did not work was the plate's camera. Quick Looks already changes light, surface, and backdrop while keeping the photograph's camera. That is the next place to build a "scene," then props, then drama such as steam or a falling garnish.

## Removed with the rollback

- Scenes tab, scene API, scene prompt, scene records, and scene tests.
- The Std/Pro model URL switch and the related failure-message and retry changes that were only in the working tree.

Kept on disk, still uncommitted:

- This file.
- `public/studio/scenes/*.jpg`.
- Edits in `src/TODO.md` that are ordinary roadmap notes, not scene code.

## Open questions

- What did approach 4 actually do wrong: unchanged room, redrawn food, moved camera, or something else?
- Did approach 2 and 3 fail the same way on 45-degree dishes, or only when an overhead photo was sent into these angled scenes?
