# GridMenu V2 Layout Engine

The GridMenu V2 Layout Engine is a complete rewrite of the menu layout system with a PDF-first architecture. It introduces region-based page partitioning, streaming pagination, a declarative template DSL, and support for allergen/dietary indicators.

## Documentation map

| Doc | Purpose |
|-----|--------|
| **README.md** (this file) | Architecture, API, flow, and how to run/test. |
| [**TEMPLATE_AUTHORING_GUIDE.md**](./TEMPLATE_AUTHORING_GUIDE.md) | How to create a new template: page, regions, grid, content budget, pitfalls. |
| [**STYLING_GUIDE.md**](./STYLING_GUIDE.md) | Styling options: fonts, typography, sub-elements, spacing, borders, backgrounds. |
| [**LIMITATIONS.md**](./LIMITATIONS.md) | What the engine cannot do (layout, styling, typography, export). Read this before designing a new template. |

Start with this README for the big picture; use the authoring guide when creating or editing a template; use the styling guide for look-and-feel; use the limitations doc to avoid unsupported designs.

## Architecture Overview

V2 replaces the capacity-based pre-calculation approach of V1 with streaming pagination: "place tiles until constraints are violated, then paginate." This eliminates complex capacity math that caused edge-case bugs in V1.

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Engine_Menu_V2 │────▶│  Layout_Engine_V2 │────▶│ Layout_Document │
│  (normalised)   │     │                  │     │   (pages/tiles) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ Template_V2  │
                        │ (parsed DSL) │
                        └──────────────┘
```

### Key Design Principles

1. **PDF-First**: Uses points as canonical unit, content-box relative coordinates
2. **Streaming Pagination**: Places tiles incrementally until constraints violated
3. **Region-Based**: Fixed header/title/footer, paginated body content
4. **Deterministic**: Same inputs always produce identical output
5. **Template-Driven**: YAML-based declarative configuration

## Quick Start

### Basic Usage

```typescript
import { generateLayoutV2 } from './layout-engine-v2'
import { transformMenuToV2 } from './menu-transformer-v2'

// Transform existing menu data to V2 format
const engineMenu = transformMenuToV2(existingMenu)

// Generate layout
const layoutDocument = await generateLayoutV2({
  menu: engineMenu,
  templateId: 'classic-cards-v2',
  selection: { textOnly: false },
  debug: true
})

// Access generated pages
for (const page of layoutDocument.pages) {
  console.log(`Page ${page.pageIndex}: ${page.pageType}`)
  console.log(`Tiles: ${page.tiles.length}`)
}
```

### With Feature Flag

```typescript
import { generateLayoutWithVersion } from '../engine-selector'

// Uses environment variable NEXT_PUBLIC_LAYOUT_ENGINE_VERSION
const result = await generateLayoutWithVersion({
  menu: engineMenu,
  templateId: 'classic-cards-v2'
})

// Or force specific version
const resultV2 = await generateLayoutWithVersion(input, 'v2')
```

## Template DSL Format

Templates are defined in YAML files stored in `src/lib/templates/v2/templates/`:

```yaml
# classic-cards-v2.yaml
id: classic-cards-v2
version: "2.0.0"
name: Classic Cards V2

page:
  size: A4_PORTRAIT
  margins:
    top: 56.69    # 20mm in points
    right: 42.52  # 15mm
    bottom: 56.69
    left: 42.52

regions:
  header:
    height: 60
  title:
    height: 40
  footer:
    height: 30

body:
  container:
    type: GRID
    cols: 4
    rowHeight: 70
    gapX: 8
    gapY: 8

tiles:
  LOGO:
    region: header
    contentBudget:
      nameLines: 0
      descLines: 0
      indicatorAreaHeight: 0
      imageBoxHeight: 50
      paddingTop: 5
      paddingBottom: 5
      totalHeight: 60

  ITEM_CARD:
    region: body
    rowSpan: 2         # Spans 2 rows = 148pt total
    contentBudget:
      nameLines: 2
      descLines: 2
      indicatorAreaHeight: 16
      imageBoxHeight: 70
      paddingTop: 8
      paddingBottom: 8
      totalHeight: 148

  ITEM_TEXT_ROW:
    region: body
    rowSpan: 1         # Single row = 70pt total
    contentBudget:
      nameLines: 2
      descLines: 2
      indicatorAreaHeight: 16
      imageBoxHeight: 0
      paddingTop: 8
      paddingBottom: 8
      totalHeight: 70

policies:
  lastRowBalancing: CENTER
  showLogoOnPages: [FIRST, CONTINUATION, FINAL, SINGLE]
  repeatSectionHeaderOnContinuation: true
  sectionHeaderKeepWithNextItems: 1

filler:
  enabled: false
  safeZones:
    - startRow: LAST
      endRow: LAST
      startCol: 0
      endCol: 3
  tiles:
    - id: filler-icon-1
      style: icon
      content: utensils
  policy: SEQUENTIAL

itemIndicators:
  mode: INLINE
  maxCount: 3
  style:
    badgeSize: 14
    iconSet: emoji
  spiceScale:
    1: "🌶"
    2: "🌶🌶"
    3: "🌶🌶🌶"
  letterFallback:
    vegetarian: "V"
    vegan: "VG"
```

**Typography blocks now support per-sub-element font control (name, description, price, label, contact). Each sub-element can specify fontSet, fontSize, fontWeight, and lineHeight independently.**

**Templates without sub-element typography continue to work - the renderer falls back to sensible defaults for all sub-elements.**

### Template Schema Validation

Templates are validated against Zod schemas:

```typescript
import { TemplateSchemaV2 } from './template-schema-v2'
import { loadTemplateV2 } from './template-loader-v2'

// Load and validate template
const template = await loadTemplateV2('classic-cards-v2')

// Templates are cached automatically
const sameTemplate = await loadTemplateV2('classic-cards-v2') // From cache
```

## Feature Flag Configuration

V2 can be enabled via environment variable:

```bash
# .env.local
NEXT_PUBLIC_LAYOUT_ENGINE_VERSION=v2
```

Or programmatically:

```typescript
import { getEngineVersion } from '../engine-selector'

const currentEngine = getEngineVersion() // 'v1' | 'v2'
```

## Coordinate System (Content-Box Relative)

V2 uses a content-box relative coordinate system to prevent double-offset bugs:

### Page Structure
```
┌─────────────────────────────────────┐ ← Page bounds (595×842pt for A4)
│  ┌─────────────────────────────────┐ │ ← Page margins (20mm/15mm)
│  │ ┌─────────────────────────────┐ │ │ ← Content box (origin 0,0)
│  │ │ Header Region (x=0, y=0)    │ │ │
│  │ ├─────────────────────────────┤ │ │
│  │ │ Title Region (x=0, y=60)    │ │ │
│  │ ├─────────────────────────────┤ │ │
│  │ │ Body Region (x=0, y=100)    │ │ │
│  │ │   ┌─────┐ ┌─────┐ ┌─────┐   │ │ │ ← Tiles positioned within region
│  │ │   │Tile │ │Tile │ │Tile │   │ │ │
│  │ │   └─────┘ └─────┘ └─────┘   │ │ │
│  │ ├─────────────────────────────┤ │ │
│  │ │ Footer Region               │ │ │
│  │ └─────────────────────────────┘ │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Coordinate Calculation
- **Region coordinates**: Relative to content box (x=0 for all regions)
- **Tile coordinates**: Relative to region origin
- **Absolute position**: `pageMargins + region.y + tile.y`

### Footprint vs Content Budget

**CRITICAL DISTINCTION**: Tile dimensions use FOOTPRINT (grid-based), not content budget:

```typescript
// FOOTPRINT (used for placement, occupancy, pagination)
const tileHeight = rowSpan * rowHeight + (rowSpan - 1) * gapY
// Example: rowSpan=2, rowHeight=70, gapY=8 → 148pt

// CONTENT BUDGET (used only for text clamping/truncation)
const contentBudget = {
  nameLines: 2,
  descLines: 2,
  totalHeight: 148  // Must match footprint for validation
}
```

## Data Models

### Engine Menu V2

```typescript
interface EngineMenuV2 {
  id: string
  name: string
  sections: EngineSectionV2[]
  metadata: {
    currency: string
    venueName?: string
    venueAddress?: string
    logoUrl?: string
  }
}

interface EngineItemV2 {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  sortOrder: number
  indicators: ItemIndicatorsV2  // Always defined, never undefined
}

interface ItemIndicatorsV2 {
  dietary: DietaryIndicator[]     // Always array, never undefined
  spiceLevel: number | null       // Always null or number, never undefined
  allergens: string[]             // Always array, never undefined
}
```

### Layout Document

```typescript
interface LayoutDocumentV2 {
  templateId: string
  templateVersion: string
  pageSpec: PageSpecV2
  pages: PageLayoutV2[]
  debug?: LayoutDebugInfoV2
}

interface PageLayoutV2 {
  pageIndex: number
  pageType: 'FIRST' | 'CONTINUATION' | 'FINAL' | 'SINGLE'
  regions: RegionV2[]
  tiles: TileInstanceV2[]
}

interface TileInstanceV2 {
  id: string
  type: TileTypeV2
  regionId: 'header' | 'title' | 'body' | 'footer'
  x: number           // Region-relative coordinates
  y: number
  width: number       // FOOTPRINT dimensions
  height: number
  colSpan: number
  rowSpan: number
  gridRow: number     // Stored at placement time
  gridCol: number
  layer: 'background' | 'content'
  content: TileContentV2
}
```

## Core Components

### Layout Engine (`layout-engine-v2.ts`)

Main entry point for layout generation:

```typescript
export async function generateLayoutV2(
  input: LayoutEngineInputV2
): Promise<LayoutDocumentV2>
```

### Streaming Paginator (`streaming-paginator.ts`)

Core pagination algorithm that places tiles incrementally:

```typescript
export function streamingPaginate(
  menu: EngineMenuV2,
  template: TemplateV2,
  pageSpec: PageSpecV2
): LayoutDocumentV2
```

### Template Loader (`template-loader-v2.ts`)

YAML template parser with caching:

```typescript
export async function loadTemplateV2(templateId: string): Promise<TemplateV2>
```

### Filler Manager (`filler-manager-v2.ts`)

Safe-zone filler tile insertion:

```typescript
export function insertFillers(
  page: PageLayoutV2,
  template: TemplateV2,
  menuId: string,
  pageIndex: number
): TileInstanceV2[]
```

### Invariant Validator (`invariant-validator.ts`)

Runtime correctness checks:

```typescript
export function validateInvariants(
  document: LayoutDocumentV2,
  template: TemplateV2
): InvariantViolation[]
```

## Testing

### Unit Tests

Located in `__tests__/` directory:

```bash
npm test -- --testPathPattern=v2
```

### Property-Based Tests

Uses fast-check for invariant verification:

```typescript
// Example property test
fc.assert(
  fc.property(
    arbitraryEngineMenuV2(),
    async (menu) => {
      const result = await generateLayoutV2({ 
        menu, 
        templateId: 'classic-cards-v2' 
      })
      
      // Verify all tiles within region bounds
      for (const page of result.pages) {
        for (const tile of page.tiles) {
          const region = page.regions.find(r => r.id === tile.regionId)!
          expect(tile.x + tile.width).toBeLessThanOrEqual(region.width)
          expect(tile.y + tile.height).toBeLessThanOrEqual(region.height)
        }
      }
    }
  ),
  { numRuns: 100 }
)
```

### Test Fixtures

Fixture menus for testing:

- `fixtures/tiny.json` - 1 section, 2-3 items
- `fixtures/medium.json` - 3-4 sections, 20-40 items  
- `fixtures/large.json` - 5+ sections, 100+ items
- `fixtures/nasty.json` - Long text, missing data, edge cases

## Layout Lab (Developer Tool)

Access the test harness at `/dev/layout-lab` (requires admin role + environment flag):

```bash
# Enable Layout Lab
NEXT_PUBLIC_LAYOUT_LAB_ENABLED=true
```

Features:
- Fixture menu selection
- Template selection
- Engine version toggle (V1/V2)
- Visual overlays (grid, regions, tile IDs)
- PDF export
- Layout JSON download

## Error Handling

### Error Types

```typescript
// Template validation errors
class TemplateValidationError extends Error {
  constructor(message: string, public issues: z.ZodIssue[])
}

// Runtime invariant violations
class InvariantViolationError extends Error {
  constructor(message: string, public violations: InvariantViolation[])
}

// General layout errors
class LayoutEngineErrorV2 extends Error {
  constructor(message: string, public context?: Record<string, unknown>)
}
```

### Error Recovery

- Template validation errors are fatal
- Invariant violations throw in dev mode only
- Production skips invariant checks for performance

## Performance Considerations

1. **Template Caching**: Parsed templates cached in memory
2. **Single-Pass Pagination**: Incremental page building
3. **Lazy Filler Insertion**: Computed per-page after main layout
4. **Dev-Only Validation**: Invariant checks only in development

## Migration from V1

V2 coexists with V1 under feature flag:

1. **Phase 0**: V2 development alongside V1 (flag defaults to v1)
2. **Phase 1**: V2 testing with Layout Lab
3. **Phase 2**: Feature flag switches to v2 (V1 remains as rollback)
4. **Phase 3**: V1 deprecated and eventually removed

## Extending V2

### Adding New Templates

1. Read [LIMITATIONS.md](./LIMITATIONS.md) so you know what is not possible.
2. Use [TEMPLATE_AUTHORING_GUIDE.md](./TEMPLATE_AUTHORING_GUIDE.md) and copy an existing template from `templates/`.
3. Set page, regions, body grid, and each tile’s `contentBudget` (for body tiles, `totalHeight` must equal footprint: `rowSpan × rowHeight + (rowSpan − 1) × gapY`).
4. Optionally style tiles with [STYLING_GUIDE.md](./STYLING_GUIDE.md) (fonts, borders, backgrounds, sub-element typography).
5. Test in Layout Lab and add to the template selector.

### Adding New Tile Types

1. Add to `TileTypeV2` union in `engine-types-v2.ts`
2. Add content interface to `TileContentV2` union
3. Update template schema validation
4. Implement rendering logic

### Adding New Page Sizes

1. Add to `PAGE_DIMENSIONS` constant
2. Update template schema enum
3. Test with existing templates

## Troubleshooting

### Common Issues

**Tiles outside region bounds**
- Check footprint vs content budget usage
- Verify region height calculations
- Enable invariant validation in dev mode

**Inconsistent pagination**
- Ensure deterministic input data
- Check for floating-point rounding in coordinates
- Verify keep-with-next constraints

**Template validation errors**
- Check YAML syntax
- Verify all required fields present
- Ensure totalHeight matches footprint formula

**Missing tiles**
- Check page type visibility policies
- Verify section/item sort orders
- Enable debug mode for placement logs

### Debug Mode

Enable detailed logging:

```typescript
const result = await generateLayoutV2({
  menu,
  templateId: 'classic-cards-v2',
  debug: true
})

console.log(result.debug?.placementLog)
```

## API Reference

See individual module files for detailed JSDoc documentation:

- `engine-types-v2.ts` - Type definitions
- `layout-engine-v2.ts` - Main API
- `template-loader-v2.ts` - Template loading
- `streaming-paginator.ts` - Pagination algorithm
- `invariant-validator.ts` - Validation rules

## Contributing

When modifying V2:

1. All code must be in `src/lib/templates/v2/` directory
2. Use V2 suffix for all file names
3. Add comprehensive tests for new features
4. Update this README for API changes
5. Test with Layout Lab before committing