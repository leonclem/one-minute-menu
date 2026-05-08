# V2 Theme Presets Maintenance Guide

This guide documents the Neon Blue palette and the repeatable pattern for future seasonal or promotional themes.

Read alongside:

- `src/docs/v2-layout-engine-current-architecture.md`
- `src/docs/v2-layout-engine-features-guide.md`
- `src/lib/templates/v2/palettes-v2.ts`
- `src/lib/templates/v2/renderer-v2.ts`
- `src/app/menus/[menuId]/template/template-client.tsx`

## Architecture in One Sentence

A theme is just a named colour palette plus optional renderer treatments (spacer SVGs, neon glows, section frames). There is no locking, no snapshot/restore, and no separate control-panel state. The palette behaves identically to every other palette from the user's perspective.

## What Neon Blue Adds

The Neon Blue palette uses the internal ID `galactic-menu` (preserved for backward compatibility with saved configs). It is displayed as "Neon Blue" in the UI.

| File | What it contributes |
|---|---|
| `palettes-v2.ts` | `galactic-menu` colour tokens (dark navy, cyan, gold) |
| `renderer-v2.ts` | Neon glow effects, section perimeter frames, `future` font preset, `warp-speed-bg` texture, `warp-speed` / `targeting-grid` spacer SVGs |
| `renderer-web-v2.tsx` | Section perimeter frame overlay drawn around category blocks |
| `components/ux/PaletteDropdown.tsx` | Custom swatch colours (navy → mid-blue → cyan) |
| `template-client.tsx` | Force-unchecks "Logo / title as tile" and "Category name as tiles" when `galactic-menu` is selected (palette-specific `useEffect`) |

### Palette-specific UI rules in `template-client.tsx`

These are the only Neon Blue–specific lines in the client. Search for `galactic-menu` to find them:

1. **Swatch colours** — `getPaletteSwatchColors` in `PaletteDropdown.tsx` has a `galactic-menu` case.
2. **Tile options disabled** — a `useEffect` forces `showLogoTile` and `showCategoryHeaderTiles` to `false` while `paletteId === 'galactic-menu'`, and the two checkboxes are rendered as disabled.

That is the complete list. Everything else (banner, texture, spacers, font) is fully user-controlled.

### Dark palette features

Neon Blue is in `DARK_PALETTE_IDS`, which makes the "Warp Speed" and "Dark Paper" textures available in the Background Texture panel. The incompatibility badge on the Background Texture heading appears automatically when a dark-only texture is active on a light palette (or vice versa) — no per-palette code needed.

---

## How To Add A New Theme

Minimum steps. Only do what the theme actually needs.

### Step 1 — Add the palette

In `src/lib/templates/v2/palettes-v2.ts`, add a `ColorPaletteV2` entry:

```typescript
{
  id: 'halloween-menu',
  name: 'Halloween',
  colors: {
    background: '#1A0A00',
    // ... all required colour fields
    promoted: {
      featured: { ... },
      flagship: { ... },
    }
  }
}
```

Use a stable kebab-case ID. It will be stored in saved configs so never rename it after launch.

If the palette is dark, add its ID to `DARK_PALETTE_IDS` in `renderer-v2.ts` so dark-only textures become available for it.

### Step 2 — Add swatch colours (optional)

If the default swatch logic (`background / itemTitle / itemPrice`) doesn't represent the palette well, add a case to `getPaletteSwatchColors` in `src/components/ux/PaletteDropdown.tsx`:

```typescript
if (palette.id === 'halloween-menu') {
  return [palette.colors.background, palette.colors.sectionHeader, palette.colors.itemPrice]
}
```

### Step 3 — Add spacer patterns (optional)

If the theme needs custom spacer tiles, add SVG generator functions in `renderer-v2.ts` and register them in `FILLER_PATTERN_REGISTRY`:

```typescript
['pumpkin-stars', { label: 'Pumpkin Stars', getSvgDataUri: pumpkinStarsSvg }],
```

Internal IDs are permanent. Labels can change freely without breaking saved configs.

### Step 4 — Add a background texture (optional)

If the theme needs a full-page background, add it to `TEXTURE_REGISTRY` in `renderer-v2.ts` and to `TEXTURE_IDS` (to make it user-selectable). Mark it in `DARK_ONLY_TEXTURE_IDS` or `LIGHT_ONLY_TEXTURE_IDS` as appropriate.

```typescript
['halloween-bg', {
  label: 'Halloween Night',
  webCss: () => ({ backgroundImage: `url("${SVG_TEXTURES.halloweenBg}")`, ... }),
  webCssExport: () => ({ ... }),
  pdfTextureFile: '',
}],
```

### Step 5 — Add a font preset (optional)

If the theme uses a distinctive Google Font, add it to `FONT_STYLE_PRESETS` in `renderer-v2.ts` and extend the `FontStylePreset` type in `engine-types-v2.ts`:

```typescript
// engine-types-v2.ts
export type FontStylePreset = 'strong' | 'fun' | 'standard' | 'serif' | 'future' | 'spooky'

// renderer-v2.ts
spooky: {
  id: 'spooky',
  label: 'Spooky',
  bannerTitleFamily: '"Creepster", cursive',
  sectionHeaderFamily: '"Creepster", cursive',
  googleFonts: 'Creepster',
  bannerTitleWeight: 400,
  sectionHeaderWeight: 400,
},
```

Font loading for preview and export is automatic — no other changes needed.

### Step 6 — Add renderer treatments (optional)

Only add renderer conditionals when the theme needs visual effects that can't be expressed through palette colour tokens alone. Examples: neon glows, perimeter frames, star overlays.

Scope them behind a palette ID check:

```typescript
const isHalloween = options.palette?.id === 'halloween-menu'
```

Keep them minimal. Prefer palette-owned colours over hard-coded values.

### Step 7 — Add palette-specific UI rules (optional)

If certain display options don't work with the palette (like Neon Blue and tile options), add a `useEffect` in `template-client.tsx`:

```typescript
useEffect(() => {
  if (paletteId !== 'halloween-menu') return
  if (showLogoTile) setShowLogoTile(false)
}, [paletteId, showLogoTile])
```

And disable the corresponding checkbox in the Display Options section using the same `paletteId === 'halloween-menu'` check.

### Step 8 — Add tests

At minimum:

- A renderer registry test asserting the new spacer/texture IDs are present (follow `renderer-v2.test.ts`)
- Manual verification: web preview and PDF export match, all grid layouts work

---

## How To Remove A Theme

### Option A — Hide it (safest, reversible)

Filter the palette out of `palettesForGrid` in `template-client.tsx`:

```typescript
const palettesForGrid = useMemo(() => {
  return PALETTES_V2.filter(p => p.id !== 'halloween-menu')
}, [])
```

Leave all code in place. Re-enable by removing the filter.

### Option B — Full removal

Remove in this order:

1. Palette entry from `PALETTES_V2` in `palettes-v2.ts`
2. Palette ID from `DARK_PALETTE_IDS` (if added)
3. Swatch case from `getPaletteSwatchColors` in `PaletteDropdown.tsx`
4. Spacer SVG functions and `FILLER_PATTERN_REGISTRY` entries from `renderer-v2.ts`
5. Texture entry from `TEXTURE_REGISTRY`, `TEXTURE_IDS`, and dark/light sets
6. Font preset from `FONT_STYLE_PRESETS` and `FontStylePreset` type (if theme-specific)
7. Renderer conditionals (`isHalloween` branches)
8. `useEffect` and disabled-checkbox logic in `template-client.tsx`
9. Test assertions referencing the removed IDs

After removal, run:

```powershell
npx jest --testPathPattern="renderer-v2|banner-footer" --no-coverage
```

---

## Current Neon Blue Specifics

### Palette-specific behaviour

- `showLogoTile` and `showCategoryHeaderTiles` are forced off and disabled in the UI when `galactic-menu` is selected. These options cause rendering issues with this palette.

### Renderer treatments

- **Neon glow** — applied to menu item and flagship tiles via `galacticGlow` in `renderer-web-v2.tsx`
- **Section perimeter frames** — cyan-bordered frames drawn around each category block in `RegionRenderer`
- **Banner star overlay** — subtle star dots rendered behind banner text

### Spacers

| Internal ID | Label | Notes |
|---|---|---|
| `warp-speed` | Stars | Tileable star pattern |
| `targeting-grid` | Grid Lines | Rings + crosshair |

### Textures

| Internal ID | Label | Availability |
|---|---|---|
| `warp-speed-bg` | Warp Speed | Dark palettes only |

### Font

The `future` preset (Orbitron/Anta) is a general-purpose selectable font — not locked to Neon Blue. It appears in the Font Style panel for all palettes.

---

## Gotchas

- **Internal IDs are permanent.** `galactic-menu`, `warp-speed`, `targeting-grid` are stored in saved user configs. Never rename them after launch. Labels can change freely.
- **Dark palette textures.** Add the palette ID to `DARK_PALETTE_IDS` or dark-only textures won't appear for it.
- **Texture incompatibility badge.** The amber `!` badge on the Background Texture heading is automatic — it appears whenever the active texture is incompatible with the current palette. No per-theme code needed.
- **Font loading is automatic.** Any `FontStylePreset` registered in `FONT_STYLE_PRESETS` is loaded for preview and export via `getFontStylePresetGoogleFontsUrl()`. No separate font loading code needed.
- **The `1-column-tall` template has `banner.enabled: false`.** This is a template design decision, not a theme issue.
