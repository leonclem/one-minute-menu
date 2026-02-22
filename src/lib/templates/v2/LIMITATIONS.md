# V2 Template Engine: Known Limitations

Read this before designing a new template so you know what is not possible and where to make concessions. For how to author templates and what *is* possible, see [README.md](./README.md) and [TEMPLATE_AUTHORING_GUIDE.md](./TEMPLATE_AUTHORING_GUIDE.md).

## Styling Limitations

- **No per-item conditional styling** — Cannot highlight items based on price, category, or other data conditions
- **No custom element types** — Only the fixed set: text, image, indicator, background
- **No tile-level animation** — No CSS transitions or animation support in rendered output

## Layout Limitations

- **Grid is strictly rectangular** — No masonry, irregular tile shapes, or free-form placement
- **Fixed region order** — Header, title, body, footer — no custom region insertion or reordering
- **No nested tiles** — Tiles cannot contain sub-tiles or tile groups
- **Maximum 6 columns** — Grid cols are validated between 1 and 6
- **No conditional layout** — Cannot auto-switch between card/text-row based on item properties
 (for each menu section)
## Typography Limitations

- **Font sets must be registered in code** — `FONT_SETS_V2` in `renderer-v2.ts`; YAML cannot reference arbitrary Google Fonts
- **Price alignment is always center** — No per-tile right-alignment without renderer changes
- **Image drop shadow** — Configurable per template via `style.imageDropShadow` on `ITEM_CARD` / `FEATURE_CARD` tiles
- **Letter-spacing** — Letter-spacing (when uppercase) is fixed in the renderer; not configurable per template

## Texture Limitations

- **Textures must be registered in code** — `TEXTURE_REGISTRY` in `renderer-v2.ts`; YAML cannot reference arbitrary textures. Textures are palette-independent overlays selected by pattern name (e.g., `dark-paper`, `waves`, `linen`).
- **SVG textures use inline data URIs** — Some complex texture effects may not reproduce identically in PDF
- **Filler interspersion disabled for featured items** — When a section contains FEATURE_CARD items (multi-col/multi-row), fillers fall back to trailing placement instead of semi-random interspersion
- **Filler spread is best-effort** — The spread algorithm minimises horizontal adjacency and vertical stacking but does not guarantee a perfectly uniform distribution in all cases (e.g., when filler count approaches column count)

## Section Header Limitations

- **Decorative patterns require renderer code** — New decorative patterns (e.g., decorative side lines) need renderer-v2.ts changes
- **Section headers span full width** — Cannot have per-column section headers

## Export Limitations

- **PDF rendering depends on Puppeteer** — Font rendering may vary slightly between environments
- **Image quality depends on source** — Low-resolution images will appear pixelated in print

## Future enhancement ideas

- **Alternating / chequerboard item fill** — Option to alternate item tile fill (e.g. surface vs background, or two surface tints) in a grid pattern for visual variety.
