# V2 Theme Presets Maintenance Guide

This guide documents the Galactic menu preset work and the repeatable pattern for future seasonal themes such as Halloween or Christmas.

It should be read alongside:

- `src/docs/v2-layout-engine-current-architecture.md`
- `src/docs/v2-layout-engine-features-guide.md`
- `C:\Users\Leon Clements\.cursor\plans\galactic_theme_preset_6508367e.plan.md` (original build plan)
- `src/lib/templates/v2/theme-presets-v2.ts`
- `src/app/menus/[menuId]/template/template-client.tsx`
- `src/lib/templates/v2/renderer-v2.ts`
- `src/lib/templates/v2/renderer-web-v2.tsx`

The important architectural choice is that themes are a reversible UI-layer preset over the existing `SelectionConfigV2` surface. They do not add a new layout-engine concept.

This matches the original plan: keep V2 templates, planner, paginator, banner rendering, image modes, and spacer infrastructure intact; resolve the theme to existing `SelectionConfigV2` fields; and use the template client for the wide promo button, locked controls, and previous-settings restore behaviour.

## What Galactic Adds

The Galactic preset is activated by selecting the `galactic-menu` color palette.

Core pieces:

- `src/lib/templates/v2/palettes-v2.ts`
  - Adds the `galactic-menu` palette.
  - Defines dark space colours, cyan/gold accents, and promoted item chrome.

- `src/lib/templates/v2/theme-presets-v2.ts`
  - Defines the `galactic-menu` theme preset.
  - Date-gates availability through `enabledUntil`.
  - Locks preset values such as banner, warp-speed background, banner image style, font style, and display options.
  - Restricts spacer options to the Galactic spacer set.

- `src/app/menus/[menuId]/template/template-client.tsx`
  - Shows the wide Galactic color palette button while available.
  - Applies locked preset settings when Galactic is selected.
  - Tracks and restores the latest non-theme settings when the user switches away.
  - Disables or restricts theme-locked controls.
  - Styles Galactic spacer buttons specially when the regular palettes are active.

- `src/lib/templates/v2/renderer-v2.ts`
  - Adds Galactic texture/spacer SVGs.
  - Applies Galactic-only banner, section heading, badge, star, border, and typography treatments.
  - Keeps spacer `mix` Galactic-only when the Galactic palette is active.

- `src/lib/templates/v2/renderer-web-v2.tsx`
  - Loads Galactic header fonts (`Orbitron`, fallback `Anta`).
  - Draws the section "perimeter fence" around category blocks at render time.
  - Applies full-page warp-speed background texture rendering.

- Tests:
  - `src/lib/templates/v2/__tests__/theme-presets-v2.test.ts`
  - `src/lib/templates/v2/__tests__/renderer-v2.test.ts`
  - Existing banner/footer tests cover preset-compatible banner config behaviour.

## Current Locked Galactic Behaviour

When `galactic-menu` is active, these settings are enforced:

- `texturesEnabled: true`
- `textureId: 'warp-speed-bg'`
- `showBanner: true`
- `bannerTitle: 'Galactic Menu'`
- `showBannerTitle: true`
- `bannerSwapLayout: true`
- `bannerImageStyle: 'none'`
- `showLogoTile: false`
- `showCategoryHeaderTiles: false`
- `fontStylePreset: 'standard'`

User-toggleable while Galactic is active:

- `showVenueName` / "Show venue logo"
- grid layout
- image style for menu items
- flagship selection/visibility via existing behaviour
- allowed Galactic spacer choice

Spacer options while Galactic is active:

- `none`
- `blank`
- `mix`
- `warp-speed` (labelled as `Stars` for compatibility)
- `targeting-grid`
- `orbit-map`

Important compatibility note: the internal ID `warp-speed` is still used for the `Stars` spacer so older saved configs do not break.

## How To Disable Or Back Out Galactic

There are three levels of rollback. Pick the smallest one that matches the need.

### 1. Disable The Promo Button Only

In `src/lib/templates/v2/theme-presets-v2.ts`, set `enabledUntil` to a past date.

This removes the wide Galactic promo button because `isThemePresetAvailable('galactic-menu')` becomes false.

However, with the current UI logic, the `galactic-menu` palette may still appear in the normal palette grid if it remains in `PALETTES_V2`. Use this only if you still want the palette available as a normal palette.

### 2. Hide Galactic From Users But Keep Code

Use this when the theme should be unavailable, but the implementation should remain easy to re-enable.

Recommended steps:

1. In `template-client.tsx`, keep `galactic-menu` filtered out of `palettesForGrid` regardless of availability.
2. Set `enabledUntil` to a past date or remove the preset from `THEME_PRESETS_V2`.
3. Leave `PALETTES_V2`, spacer registry entries, renderer helpers, and tests in place.

This is the safest operational disable because it avoids deleting shared rendering code while preventing user selection.

### 3. Full Backout

Use this only if the Galactic work should be removed from the branch.

Remove or revert:

- `galactic-menu` from `PALETTES_V2`
- `src/lib/templates/v2/theme-presets-v2.ts`
- imports and theme preset logic in `template-client.tsx`
- Galactic-specific renderer helpers and branches in `renderer-v2.ts`
- Galactic font loading and section frame overlay in `renderer-web-v2.tsx`
- Galactic spacer IDs from `FILLER_PATTERN_REGISTRY`
- Galactic test expectations in `renderer-v2.test.ts`
- `theme-presets-v2.test.ts`

Also remove any UI copy that references Galactic, cosmic spacers, or locked theme controls.

After a full backout, run:

```powershell
npm test --silent -- src/lib/templates/v2/__tests__/renderer-v2.test.ts src/lib/templates/v2/__tests__/banner-footer.unit.test.ts src/lib/templates/v2/__tests__/theme-presets-v2.test.ts
```

If `theme-presets-v2.test.ts` has been removed, omit it from the command.

## How The Restore Behaviour Works

The template client keeps two refs:

- `previousNonThemeConfigRef`
- `latestNonThemeConfigRef`

`latestNonThemeConfigRef` continuously tracks the latest non-theme configuration while a theme is inactive. When the user enters Galactic, that latest non-theme config is snapshotted. When the user exits Galactic, the snapshot is restored before the newly selected palette is applied.

This is important because Galactic locks and mutates fields such as:

- banner title
- banner image style
- banner switch layout
- logo/title tile display
- category-as-tile display
- background texture
- spacer tiles

Future themes should use this same restore path rather than adding bespoke restoration logic.

## How To Build Another Theme

Use Galactic as the pattern, not as a one-off.

### 1. Add A Palette

Add a new `ColorPaletteV2` entry in `src/lib/templates/v2/palettes-v2.ts`.

Guidelines:

- Use a stable ID such as `halloween-menu` or `christmas-menu`.
- Define all required palette fields.
- Put theme-specific promoted item colours under `promoted` rather than hard-coding them into renderers when possible.
- Consider whether the palette should appear as a normal grid option or only as a wide promo button.

### 2. Add A Theme Preset

Extend the type in `src/lib/templates/v2/theme-presets-v2.ts`:

```typescript
export type ThemePresetIdV2 = 'galactic-menu' | 'halloween-menu'
```

Add a `THEME_PRESETS_V2` entry:

```typescript
{
  id: 'halloween-menu',
  paletteId: 'halloween-menu',
  tagline: 'A spooky seasonal menu',
  enabledUntil: '2026-11-02T00:00:00.000Z',
  lockedSelection: {
    showBanner: true,
    bannerTitle: 'Halloween Menu',
    showBannerTitle: true,
    bannerImageStyle: 'none',
    fontStylePreset: 'standard',
  },
  allowedSpacerTilePatternIds: [
    'mix',
    'none',
    'blank',
    'pumpkin-stars',
    'web-grid',
  ],
}
```

Only lock settings that are genuinely part of the theme. Do not lock controls just because they are convenient.

### 3. Add Spacer Patterns

Add SVG spacer patterns in `renderer-v2.ts` and register them in `FILLER_PATTERN_REGISTRY`.

Use pattern IDs that are theme-neutral enough to survive visual iteration, or preserve compatibility when relabelling. Galactic does this by keeping `warp-speed` as the internal ID while labelling it `Stars`.

If a theme uses `mix`, decide whether it should:

- use all spacers, or
- use only that theme's spacer IDs.

Galactic uses `GALACTIC_FILLER_PATTERN_IDS` so `mix` stays on-theme.

### 4. Add Background Texture If Needed

If a theme needs a fixed background, add it to `TEXTURE_REGISTRY`.

For locked, non-user-selectable textures:

- add the registry entry,
- do not add it to `TEXTURE_IDS`,
- set it through `lockedSelection.textureId`.

This is how `warp-speed-bg` works.

### 5. Add Renderer Treatments Carefully

Prefer palette-owned values first. Add renderer conditionals only when the theme needs custom rendering that cannot be represented by palette/style tokens.

Current Galactic renderer conditionals include:

- banner star overlays
- Galactic title/subheading treatment
- section heading font override
- neon badge/border glow
- page category perimeter frames
- Galactic-only spacer mix

Keep conditionals scoped behind a helper like `isGalacticPalette(options)` or a future generic `isThemePalette(options, id)`.

### 6. Update The Template Client UI

In `template-client.tsx`:

- show the theme as a wide promo button if it is promotional,
- filter it out of the normal palette grid while promo-active,
- apply `lockedSelection` in `applyThemeLockedSelection`,
- disable locked controls,
- keep unlocked controls toggleable,
- ensure `buildCurrentConfiguration()` includes every field that the theme mutates,
- rely on the existing non-theme snapshot refs for restoration.

### 7. Wire Export Fonts

If a theme uses fonts outside the existing `FontStylePreset` Google Fonts URLs, preview-only loading is not enough.

For Galactic, the web preview loads `Orbitron`/`Anta` in `renderer-web-v2.tsx`, but PDF and PNG exports render server-side HTML through:

- `src/lib/templates/v2/renderer-pdf-v2.ts`
- `src/lib/templates/v2/renderer-image-v2.ts`

Those export HTML generators must include render-blocking `<link rel="stylesheet">` tags for the theme font URL. Galactic centralises this in `getGalacticThemeGoogleFontsUrl()` from `renderer-v2.ts`.

When testing export font fixes through the Docker worker, rebuild and restart the worker image unless the source tree is bind-mounted into the container.

### 8. Add Tests

At minimum:

- theme availability/date-gating tests, following `theme-presets-v2.test.ts`
- renderer registry tests if adding spacer or texture IDs
- focused assertions for changed badge labels, spacer IDs, or other renderer outputs

Manually verify:

- entering theme applies locked values,
- leaving theme restores previous values,
- saved theme config re-applies locked values on load,
- web preview and PDF export match closely,
- all supported grid layouts remain usable.

## Gotchas From The Galactic Build

- Date-gating only controls preset availability. It does not automatically remove the palette from `PALETTES_V2`.
- If a theme mutates a setting, include that setting in `buildCurrentConfiguration()` or restoration may be incomplete.
- Locked controls need both state enforcement and UI disabling. Doing only one causes confusing state drift.
- Browser text fitting can differ from heuristic text fitting, especially with Google fonts like `Orbitron`. Prefer conservative sizing and `whiteSpace: 'nowrap'` for fixed banner text.
- Theme font loading has separate preview and export paths. Client-side font loading in `renderer-web-v2.tsx` does not automatically affect PDF/PNG export HTML.
- Pattern labels can change without changing internal IDs. This is useful for compatibility.
- `mix` needs theme-aware filtering if a theme should not include regular spacer patterns.
- Full-page render overlays that need section geometry are easier in `renderer-web-v2.tsx` than inside individual tile rendering.
- The `1-column-tall` template currently has `banner.enabled: false`; this is not a Galactic bug.

## Current Known Limitation

The category perimeter frame is implemented in the web renderer around body sections. If PDF export ever diverges visually, check whether the same React web renderer path is being used for export and whether all frame styles survive Puppeteer rendering.

The `1-column-tall` layout does not show a banner because its template explicitly disables banners:

```yaml
banner:
  enabled: false
```

Changing that should be treated as a template design decision, not a theme fix.
