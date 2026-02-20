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
- **Image drop shadow and letter-spacing** — Image shadow and letter-spacing (when uppercase) are fixed in the renderer; not configurable per template

## Texture Limitations

- **Textures must be registered in code** — `TEXTURE_REGISTRY` in `renderer-v2.ts`; YAML cannot reference arbitrary textures
- **Light palette textures use inline SVG** — Some complex texture effects may not reproduce identically in PDF

## Section Header Limitations

- **Decorative patterns require renderer code** — New decorative patterns (e.g., decorative side lines) need renderer-v2.ts changes
- **Section headers span full width** — Cannot have per-column section headers

## Export Limitations

- **PDF rendering depends on Puppeteer** — Font rendering may vary slightly between environments
- **Image quality depends on source** — Low-resolution images will appear pixelated in print
