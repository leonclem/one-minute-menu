# Studio page button inventory

Inventory of interactive controls on Photo Studio after the three-level redesign
(dishes → dish library → workbench). Taken from `src/app/studio/_components/` as
of 2026-09-06.

**Do not change mutate / crop / object-edit / export generation behaviour** to
match this doc. This file describes the UI that is shipped.

**Scope:** the signed-in Studio editor. Customer site chrome (header/footer)
uses the same Figtree + colour tokens as Studio, but Studio itself renders
`StudioAppBar` rather than `UXHeader`. Account-gated substitutes (waitlist,
disabled, pending invite) are listed at the end.

---

## How to read this

| Column           | Meaning                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| **Label**        | Visible text, or `aria-label` when the control is icon-only                  |
| **Kind**         | `button`, `switch`, `radio`, `link`, `submit`, `file`, `checkbox`, `details` |
| **When shown**   | Conditions before the control exists                                         |
| **What it does** | Client behaviour                                                             |
| **API**          | HTTP calls this click starts. `—` means local UI only                        |

Credit costs for Generate / Re-shoot / Remove / Expand come from `GET /api/studio/credits`
(`nb2` vs `nbPro`) and are shown as `· N credits` on the primary action.

---

## Three-level layout

```
/studio                         Your dishes
/studio/[dishId]                Dish library  (?tab=shots|exports&view=grid|tree)
/studio/[dishId]/[imageId]      Workbench     (?tab=scene|exports)

StudioAppBar (GridMenu, All dishes, credits, Settings, Sign out)
┌─────────────────────────────────────────────────────────────────┐
│  Dishes home     │  Dish library          │  Workbench          │
│  dish cards      │  shots grid/tree or    │  canvas + filmstrip │
│  + New dish      │  export matrix         │  Scene or Exports   │
└─────────────────────────────────────────────────────────────────┘
Studio footer (Privacy, Terms, Support)
```

Tool modes (Reframe / Expand / Remove) stay client state. They are not URL params.

**Same shot list** in the workbench filmstrip (chronological), library grid, and
library tree (lineage via `source_image_id`).

**Shot title** is the change line (`Lighting → …`, `Cropped 4:5`, `Re-shot from …`).
Filmstrip short labels are OG / G1 / G2 (generative depth). Crop
(`metadata.mode === 'crop'`) is lossless and does not increment GEN.

**New shot** = another upload on the same dish (another root). First
`role=source` is Original; later sources are Upload 2, Upload 3.

---

## 1. Studio chrome (`StudioAppBar` + shell footer)

Rendered by `StudioShell` on every Studio route. Not `UXHeader` / `UXFooter`.

Customer marketing, dashboard, auth, and menus chrome (`UXHeader` / `UXFooter`)
uses the same Figtree + Studio colour tokens. Admin Hub stays on its own light
chrome.

### App bar


| Label            | Kind   | When shown                         | What it does                         | API                  |
| ---------------- | ------ | ---------------------------------- | ------------------------------------ | -------------------- |
| GridMenu logo    | link   | Always                             | Navigate home (`/`)                  | —                    |
| **All dishes**   | status | On `/studio`                       | Current location; not a link         | —                    |
| **All dishes**   | link   | On a dish library or workbench     | `/studio`                            | —                    |
| **N credits**    | link   | Editor session; balance known      | `/pricing`                           | `GET /api/studio/credits` on layout load |
| Settings         | link   | `sm+`                              | `/dashboard/settings`                | —                    |
| Sign out         | submit | Always                             | POST sign-out form                   | `POST /auth/signout` |


### Shell footer


| Label   | Kind | When shown | What it does | API |
| ------- | ---- | ---------- | ------------ | --- |
| Privacy | link | Always     | `/privacy`   | —   |
| Terms   | link | Always     | `/terms`     | —   |
| Support | link | Always     | `/support`   | —   |


Breadcrumbs on inner screens: dish name on the workbench links to
`/studio/[dishId]`. The library has no extra breadcrumb beyond All dishes.

---

## 2. Dishes home (`/studio`)

Component: `studio-dishes-home.tsx`. Empty accounts see the first-run panel as
the primary CTA until a dish exists.


| Label                         | Kind   | When shown                                      | What it does                                      | API                                                                                    |
| ----------------------------- | ------ | ----------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **+ New dish**                | button | Header shown (hidden only during first-run takeover on an empty account) | Opens “Name your dish” modal                      | Confirm: `POST /api/studio/dishes`, then navigate to `/studio/[dishId]`                |
| Dish card                     | link   | Each dish                                       | Open that dish’s library                          | —                                                                                      |
| **+ New dish** (first-run)    | button | First-run panel visible                         | Same as header New dish                           | Same create path                                                                       |
| Don't show this again         | checkbox | First-run visible and the account already has a dish | Persist hide preference                      | `PATCH /api/studio/onboarding` `{ dismissed: true }`                                   |


Status line on a dish card is `N shots · M files ready` or `No photo yet`
(`dishGridStatusText`).

Hidden file input is **not** on this page. Upload happens on the dish library
after create.

---

## 3. Dish library (`/studio/[dishId]`)

Header: dish name, rename/delete, optional Re-shoot, **+ New shot**.

### Library header


| Label              | Kind   | When shown                                                    | What it does                                                                 | API                                                                              |
| ------------------ | ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Rename**         | button | Always                                                        | Opens rename modal                                                           | Confirm: `PATCH /api/studio/dishes/:dishId` `{ name }`                           |
| **Re-shoot**       | button | `NEXT_PUBLIC_STUDIO_ENABLE_RESHOOT=true` and a current shot exists | Opens re-shoot dialog                                                    | Confirm: `POST /api/studio/reshoot`                                              |
| **+ New shot**     | button | Always                                                        | Opens hidden file picker (new `role=source` on this dish)                    | Upload chain, then `POST /api/studio/images` (see [Upload chain](#upload-chain)) |
| **Delete dish**    | button | Account has **more than one** dish                            | Loads deletion counts, then confirm dialog                                   | `GET /api/studio/dishes/:dishId` then `DELETE /api/studio/dishes/:dishId`        |


Hidden file input: `accept` PNG/JPEG/WebP, `aria-label="Upload a new shot"`.

### Shots / Exports tabs


| Label     | Kind   | When shown        | What it does                                      | API |
| --------- | ------ | ----------------- | ------------------------------------------------- | --- |
| **Shots** | tab    | Always            | `?tab=shots`                                      | —   |
| **Exports** | tab  | Always            | `?tab=exports`; loads dish export matrix          | `GET /api/studio/exports?dishId=` |
| **Grid**  | button | Shots tab         | `?view=grid`                                      | —   |
| **Tree**  | button | Shots tab         | `?view=tree`                                      | —   |


### Shot card / tree row


| Label          | Kind | When shown     | What it does                                      | API |
| -------------- | ---- | -------------- | ------------------------------------------------- | --- |
| Thumb / title  | link | Each shot      | Open workbench `/studio/[dishId]/[imageId]`       | —   |
| **Branch here**| link | Each shot      | Same workbench URL. Does not auto-pick a parent.  | —   |


Cards show GEN / ORIGINAL / UPLOAD / LOSSLESS badges, the change-line title,
and five export ticks (ready = amber).

### Export matrix (dish-level)

Every shot × the five `EXPORT_PRESETS`. Cell click uses the same generate path
as the per-shot panel.


| Label                         | Kind   | When shown              | What it does                         | API                                                         |
| ----------------------------- | ------ | ----------------------- | ------------------------------------ | ----------------------------------------------------------- |
| **Download all ready (N)**    | button | Two or more tiles ready | Sequential client downloads          | No API — fetches stored preview URLs                        |
| Shot thumb                    | button | Each row                | Preview lightbox                     | —                                                           |
| Empty / credit cell           | button | Tile not ready          | Queue that export                    | `POST /api/studio/exports` `{ sourceImageId, variantType }` |
| Ready cell                    | button | Tile ready              | Download that file                   | No API — client download                                    |


---

## 4. Workbench (`/studio/[dishId]/[imageId]`)

Canvas + filmstrip (full dish shot list). Right column: Scene or Exports.
Tool bar: **Reframe**, **Expand**, and **Remove**.

### Workbench chrome


| Label                                 | Kind   | When shown                                      | What it does                                                                 | API                                                                                                                                                      |
| ------------------------------------- | ------ | ----------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dish name                             | link   | Always                                          | Back to `/studio/[dishId]`                                                   | —                                                                                                                                                        |
| **Previous shot** / **Next shot**     | button | Always (disabled at ends)                       | Chronological neighbours                                                     | —                                                                                                                                                        |
| **Delete shot**                       | button | A shot is selected                              | Confirm, then delete image and its exports                                   | `DELETE /api/studio/images/:imageId`                                                                                                                     |
| **Scene** / **Exports**               | tab    | Always                                          | `?tab=scene` or `?tab=exports`                                               | Exports tab: `GET /api/studio/exports?sourceImageId=`                                                                                                    |
| Filmstrip thumb                       | button | Each gallery image                              | Select that shot (updates canvas + exports)                                  | `PATCH /api/studio/dishes/:dishId` `{ currentImageId }` (extract/hydrate if needed)                                                                      |
| **Delete {shot}** (filmstrip trash)   | button | Each shot; always on small screens, hover on large | Same delete-image confirm                                                | `DELETE /api/studio/images/:imageId`                                                                                                                     |
| **Zoom out** / **Zoom in** / **Reset**| button | Image loaded                                    | Camera zoom                                                                  | —                                                                                                                                                        |
| Expand preview                        | button | Image loaded                                    | Full-size workbench expand                                                   | —                                                                                                                                                        |
| **Close** / **Close expanded preview**| button | Expanded                                        | Exit expand                                                                  | —                                                                                                                                                        |
| **Rate result**                       | button | Selected image is generated; ~10s after load if feedback incomplete | Open feedback modal                                             | Status: `GET /api/studio/feedback?studioImageId=`                                                                                                        |


### Tools — Reframe (today’s crop)

Deterministic / free. Copy stays lossless, not a re-render.


| Label                                                                          | Kind             | When shown     | What it does                                                        | API                                                                                      |
| ------------------------------------------------------------------------------ | ---------------- | -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Reframe**                                                                    | button           | Shot selected  | Open crop overlay + panel                                           | —                                                                                        |
| **Original**, **1:1**, **4:5**, **3:4**, **4:3**, **16:9**, **9:16**, **Free** | toggle buttons   | Reframe open   | Set crop window aspect                                              | —                                                                                        |
| **Apply reframe**                                                              | button           | Reframe open   | Deterministic crop; **does not use credits**; new shot, same GEN    | `POST /api/studio/crop`; then quiet `POST /api/studio/extract`                           |
| **Cancel**                                                                     | button           | Reframe open   | Close without saving                                                | —                                                                                        |
| Resize handles                                                                 | pointer          | Reframe open   | Drag crop window                                                    | —                                                                                        |


### Tools — Expand (scene zoom-out)

Paid generation. Same dish, wider field of view, same aspect. Persists Gemini’s image.


| Label                                          | Kind    | When shown    | What it does                                                                 | API                     |
| ---------------------------------------------- | ------- | ------------- | ---------------------------------------------------------------------------- | ----------------------- |
| **Expand**                                     | button  | Shot selected | Open expand overlay + panel                                                  | —                       |
| **A little wider**, **Balanced**, **Editorial** | toggle  | Expand open   | Named extra-scene amounts; keep current layout                               | —                       |
| **All sides**                                  | toggle  | Expand open   | Even padding on every side; photo centred                                    | —                       |
| Edge handles                                   | pointer | Expand open   | Drag only: extra room on that side; snap amount                              | —                       |
| Corner handles                                 | pointer | Expand open   | Drag only: extra room on those two sides; photo hugs the opposite corner     | —                       |
| **Expand · N credits**                         | button  | Expand open   | AI zoom-out; new generated shot; GEN increments                              | `POST /api/studio/expand` |
| **Cancel**                                     | button  | Expand open   | Close without saving                                                         | —                       |


### Tools — Remove (today’s object-edit)

Counts as a generation (whole frame). Not inpaint / “paints the area” copy.


| Label                  | Kind   | When shown                                      | What it does                             | API                            |
| ---------------------- | ------ | ----------------------------------------------- | ---------------------------------------- | ------------------------------ |
| **Remove**             | button | Shot selected                                   | Open object-remove mode                  | —                              |
| **Undo** / **Clear**   | button | Remove open                                     | Edit marks                               | —                              |
| **Remove · N credits** | button | Remove open; enabled after a valid selection    | AI object removal; new generated shot    | `POST /api/studio/object-edit` |
| **Cancel** / **Close** | button | Remove open                                     | Exit edit mode                           | —                              |


Workbench drawing is pointer input. Max 8 marks.

### Scene tab

One scrolled panel. Intro: this shot is never overwritten. Clicking a Quick
Look **stages** lighting + surface + backdrop (skips backdrop if extraction hid
it). A full look is exactly `MAX_PENDING_CHANGES` (3).


| Label                          | Kind      | When shown                                              | What it does                                                                 | API                                                                                                 |
| ------------------------------ | --------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Quick Look tile                | button    | Hydrated                                                | Stage Bright & Clean / Golden Hour / Dark & Moody / Colour Pop               | Applied later by `POST /api/studio/mutate`                                                          |
| Lighting / Surface / Backdrop  | accordion | Hydrated                                                | Expand tiles. Backdrop disabled if the working shot is overhead or no vertical backdrop was detected | — |
| Camera                         | accordion | `NEXT_PUBLIC_STUDIO_ENABLE_VERTICAL_SWITCH=true` and hydrated | One switch: overhead if the shot is not, 45° if it already is. Stacks with lighting/surface. Targeting overhead drops a staged backdrop. | Generate: `POST /api/studio/mutate` |
| Each style tile                | radio     | Section open                                            | Stage that lighting/surface/backdrop                                         | Applied later by `POST /api/studio/mutate`                                                          |
| **On the plate**               | accordion | Hydrated                                                | Garnish/side remove + finishing touches                                      | —                                                                                                   |
| **Remove {garnish/side}**      | button    | One per detected garnish or side                        | Stage removal locally                                                        | —                                                                                                   |
| **Add finishing touches**      | button    | On the plate open                                       | Ranked garnish/side stack for this dish                                      | `POST /api/studio/finishing-touches/recommend`                                                      |
| **+ / ✓ {name}** chips         | toggle    | After a stack is loaded                                 | Stage or unstage a catalogue garnish. Applied only on Generate               | Generate uses `POST /api/studio/mutate`                                                             |
| **Std** / **Pro**              | switch    | `NEXT_PUBLIC_STUDIO_ENABLE_PRO=true`                    | Toggle NB2 vs Nano Banana Pro. Switching *to* Pro may open a cost warning    | — (model is sent later on generate/remove/reshoot)                                                  |
| **Re-shoot**                   | button    | `NEXT_PUBLIC_STUDIO_ENABLE_RESHOOT=true`                | Re-shoot dialog                                                              | Confirm: `POST /api/studio/reshoot`                                                                 |
| **Discard**                    | button    | Staged (un-generated) Scene changes                     | Revert lighting/surface/backdrop/elements and finishing-touch chips          | —                                                                                                   |
| **Generate new shot · N credits** | button | Always in Scene footer; **disabled** until pending changes | Controlled mutation of the current image                                  | `POST /api/studio/mutate`. Insufficient credits → credits dialog (no POST)                          |


While generating, the label becomes **Generating…**.

`GET /api/studio/styles` runs on hydrate, not on tile click.

Too many staged changes (more than the pending-change cap) opens the
**More than N changes?** dialog instead of applying the latest tile/chip.

Typical lighting (DB via `GET /api/studio/styles`, with this fallback):
Bright & Clean, Bold Sunlight, Soft Natural, Golden Hour, Dark & Moody.

Typical surfaces: Natural Oak, Dark Walnut, White Marble, Raw Concrete, Dark
Stone, Natural Linen, Terrazzo.

Typical backdrops: Soft Neutral, Warm Sand, Sage Green, Terracotta, Deep Navy,
Charcoal, Mustard Yellow, Coral Red, Teal, Hot Pink.

Colour Pop = Bold Sunlight + Dark Stone + Mustard Yellow.

### Degradation warning (GEN 3+)

When Generate / Remove / Re-shoot / Expand would produce **GEN 3+** on the current
branch, a gold callout appears. Copy gets stronger at 4 and 5+. **No hard stop.**


| Label              | Kind | When shown                    | What it does                                      | API |
| ------------------ | ---- | ----------------------------- | ------------------------------------------------- | --- |
| **View shot tree** | link | Warning visible               | `/studio/[dishId]?tab=shots&view=tree`            | —   |


### Exports tab (this shot)

Same `studio-export-panel.tsx` as before, scoped to the selected workbench
image.

Tiles: Delivery Square (1200×1200), Delivery Landscape (1600×900), Instagram
Feed (1080×1350), PDF Menu Tile (1500×1500, always crop/resize), Cut-Out PNG
(2048×2048).


| Label                                                                | Kind   | When shown     | What it does                                      | API                                                         |
| -------------------------------------------------------------------- | ------ | -------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Info (i)                                                             | button | Panel expanded | Toggle copy explaining which formats cost credits | —                                                           |
| **Download all (N)**                                                 | button | Two or more tiles ready | Sequential client downloads                | No API                                                      |
| **Retry**                                                            | button | Tile list failed to load | Reload tiles                               | `GET /api/studio/exports?sourceImageId=`                    |
| Tile preview / Expand                                                | button | Tile `ready`   | Lightbox                                          | —                                                           |
| Download (icon)                                                      | button | Tile ready     | Download that file                                | No API                                                      |
| **Make** / **Retry** / **Queued…** / **Generating…**                 | button | Tile not ready | Queue or run that export                          | `POST /api/studio/exports` `{ sourceImageId, variantType }` |
| **Redo · N credits**                                                 | button | Tile ready     | Regenerate that format (same POST)                | `POST /api/studio/exports`                                  |


One export generation at a time. Paid tiles poll `GET /api/studio/exports`
every 6s while queued/generating.

---

## 5. Dialogs


### Name your dish / Rename dish (`StudioTextModal`)


| Label      | Kind   | What it does                                  | API                                |
| ---------- | ------ | --------------------------------------------- | ---------------------------------- |
| **Cancel** | button | Close                                         | —                                  |
| **Create** / **Save** | button | Create or rename dish                | `POST` or `PATCH /api/studio/dishes` |


### Delete dish / Delete image

Confirm dialogs. **Delete dish** / **Delete image** vs **Cancel**.

### Switch to Nano Banana Pro?


| Label                              | Kind     | What it does                          | API |
| ---------------------------------- | -------- | ------------------------------------- | --- |
| Don't show this again this session | checkbox | Remember dismissal in session storage | —   |
| **Stay with NB2**                  | button   | Close; keep NB2                       | —   |
| **Switch to Pro**                  | button   | Set Pro model                         | —   |


### Generation unavailable (insufficient credits)


| Label           | Kind   | What it does | API |
| --------------- | ------ | ------------ | --- |
| **Close**       | button | Close        | —   |
| **See pricing** | link   | `/pricing`   | —   |


### Re-shoot this dish (flagged)


| Label                    | Kind     | What it does                                                                | API                        |
| ------------------------ | -------- | --------------------------------------------------------------------------- | -------------------------- |
| Improve plating          | checkbox | Include plating improvement in the request                                  | —                          |
| **Advanced styles**      | details  | Show lighting/backdrop/surface tiles                                        | —                          |
| Style tiles              | radio    | Override re-shoot styles                                                    | —                          |
| **Cancel**               | button   | Close                                                                       | —                          |
| **Re-shoot · N credits** | button   | Full restyle generation                                                     | `POST /api/studio/reshoot` |


### More than N changes?


| Label                         | Kind     | What it does                                     | API |
| ----------------------------- | -------- | ------------------------------------------------ | --- |
| Don't show again this session | checkbox | Skip this warning for the rest of the session    | —   |
| **Okay, let me review**       | button   | Reject the extra change; keep current staged set | —   |
| **Apply anyway**              | button   | Accept the extra staged change                   | —   |


---

## 6. Account-gated Studio

When the layout gate is not `editor`, `StudioGateNotices` replaces the editor.


| Kind            | Primary control     | Notes                                      |
| --------------- | ------------------- | ------------------------------------------ |
| Waitlist        | Pending approval UI | Email shown; no editor                     |
| Studio disabled | **Contact support** | `denied_studio_disabled`                   |
| Pending invite  | **Contact support** | Admin-only or beta access required         |


Inline notices on the editor: no credits (**See pricing**), dish generation
paused.

---

## Upload chain

Used by **+ New shot** on the library (and historically by first-run upload).

1. Client uploads the file to Studio storage (`uploadStudioSourceFile`).
2. `POST /api/studio/images` creates a `role=source` record on the dish.
3. Extract runs (`POST /api/studio/extract`) so Scene controls can hydrate.

Creating a dish (`POST /api/studio/dishes`) does **not** upload a photo. The
user lands on the empty library and uses **+ New shot**.

---

## Parked tools (not in this ship)

These are intentionally hidden. There is no customer control and no generation
API for them yet. Do not add toolbar or Scene entries until an API exists.


| Tool                    | Notes                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Change angle            | Replaced by Scene Camera vertical switch (`NEXT_PUBLIC_STUDIO_ENABLE_VERTICAL_SWITCH`). Horizontal spin still parked. |
| Swap vessel             | Plate/bowl swap. Hidden from toolbar and Scene.                       |
| Remove inverse          | Keep-only / inverse of whole-frame Remove.                            |
| User-saved Quick Looks  | Looks stay four hardcoded bundles. No “save this combo” control.      |


Also dropped from v1 (by product rule, not parked-for-later UI): FINE DETAIL
badge, user-renamed shots, inpaint-style Remove copy.
