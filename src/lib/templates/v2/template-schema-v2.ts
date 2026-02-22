/**
 * Zod schemas for validating YAML template files.
 * 
 * These schemas validate the structure and constraints of V2 template YAML files
 * before they are parsed into TemplateV2 objects.
 */

import { z } from 'zod'

// =============================================================================
// Styling Schemas
// =============================================================================

/**
 * Schema for per-sub-element typography (name, description, price, etc.)
 */
export const SubElementTypographySchemaV2 = z.object({
  fontSet: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional()
})

/**
 * Schema for typography styling
 */
export const TypographyStyleSchemaV2 = z.object({
  fontSet: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  lineHeight: z.string().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  color: z.string().optional(),
  name: SubElementTypographySchemaV2.optional(),
  description: SubElementTypographySchemaV2.optional(),
  price: SubElementTypographySchemaV2.optional(),
  label: SubElementTypographySchemaV2.optional(),
  contact: SubElementTypographySchemaV2.optional()
})

/**
 * Schema for spacing styling
 */
export const SpacingStyleSchemaV2 = z.object({
  paddingTop: z.number().min(0).optional(),
  paddingBottom: z.number().min(0).optional(),
  paddingLeft: z.number().min(0).optional(),
  paddingRight: z.number().min(0).optional()
})

/**
 * Schema for border styling
 */
export const BorderStyleSchemaV2 = z.object({
  width: z.number().min(0).optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  sides: z.array(z.enum(['top', 'bottom', 'left', 'right'])).optional()
})

/**
 * Schema for background styling
 */
export const BackgroundStyleSchemaV2 = z.object({
  color: z.string().optional(),
  borderRadius: z.number().min(0).optional()
})

/**
 * Schema for image styling (e.g. drop shadow)
 */
export const ImageStyleSchemaV2 = z.object({
  boxShadow: z.string().optional()
})

/**
 * Schema for complete tile styling
 */
export const TileStyleSchemaV2 = z.object({
  typography: TypographyStyleSchemaV2.optional(),
  spacing: SpacingStyleSchemaV2.optional(),
  border: BorderStyleSchemaV2.optional(),
  background: BackgroundStyleSchemaV2.optional(),
  image: ImageStyleSchemaV2.optional()
})

// =============================================================================
// Content Budget Schema
// =============================================================================

/**
 * Schema for ContentBudgetV2 - validates all fields for tile content budgets.
 */
export const ContentBudgetSchemaV2 = z.object({
  nameLines: z.number().int().min(0).max(5),
  descLines: z.number().int().min(0).max(10),
  indicatorAreaHeight: z.number().min(0),
  imageBoxHeight: z.number().min(0),
  paddingTop: z.number().min(0),
  paddingBottom: z.number().min(0),
  totalHeight: z.number().min(0)
})

// =============================================================================
// Safe Zone Schema
// =============================================================================

/**
 * Schema for SafeZoneV2 - supports 'LAST' and 'LAST_CONTENT' literals for dynamic row references.
 */
export const SafeZoneSchemaV2 = z.object({
  startRow: z.union([z.number().int().min(0), z.literal('LAST'), z.literal('LAST_CONTENT')]),
  endRow: z.union([z.number().int().min(0), z.literal('LAST'), z.literal('LAST_CONTENT')]),
  startCol: z.number().int().min(0),
  endCol: z.number().int().min(0)
})

// =============================================================================
// Region Schema
// =============================================================================

/**
 * Schema for region IDs - enum validation catches typos at parse time.
 */
export const RegionIdSchema = z.enum(['header', 'title', 'body', 'footer'])

// =============================================================================
// Tile Variant Schema
// =============================================================================

/**
 * Schema for TileVariantDefV2 - validates region enum, colSpan, rowSpan, and styling.
 */
export const TileVariantSchemaV2 = z.object({
  region: RegionIdSchema,
  contentBudget: ContentBudgetSchemaV2,
  colSpan: z.number().int().min(1).optional(),
  rowSpan: z.number().int().min(1).optional(),
  style: TileStyleSchemaV2.optional()
})

// =============================================================================
// Filler Tile Schema
// =============================================================================

/**
 * Schema for FillerTileDefV2 - supports multi-cell fillers.
 */
export const FillerTileSchemaV2 = z.object({
  id: z.string(),
  style: z.enum(['color', 'pattern', 'icon']),
  content: z.string().optional(),
  colSpan: z.number().int().min(1).optional(),
  rowSpan: z.number().int().min(1).optional()
})

// =============================================================================
// Main Template Schema
// =============================================================================

/**
 * Complete schema for TemplateV2 YAML files.
 * Validates all sections and enforces constraints.
 */
export const TemplateSchemaV2 = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  
  page: z.object({
    size: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE', 'A3_PORTRAIT', 'A3_LANDSCAPE', 'HALF_A4_TALL']),
    margins: z.object({
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
      left: z.number()
    })
  }),
  
  regions: z.object({
    header: z.object({ height: z.number().min(0) }),
    title: z.object({ height: z.number().min(0) }),
    footer: z.object({ height: z.number().min(0) })
    // body height is computed from remaining space
  }),
  
  body: z.object({
    container: z.object({
      type: z.literal('GRID'),
      cols: z.number().int().min(1).max(6),
      rowHeight: z.number().min(50),
      gapX: z.number().min(0),
      gapY: z.number().min(0)
    })
  }),
  
  tiles: z.object({
    LOGO: TileVariantSchemaV2,
    TITLE: TileVariantSchemaV2,
    SECTION_HEADER: TileVariantSchemaV2,
    ITEM_CARD: TileVariantSchemaV2,
    ITEM_TEXT_ROW: TileVariantSchemaV2,
    FILLER: z.array(FillerTileSchemaV2).optional(),
    FEATURE_CARD: TileVariantSchemaV2.optional(),
    DECORATIVE_DIVIDER: TileVariantSchemaV2.optional(),
    FOOTER_INFO: TileVariantSchemaV2.optional(),
  }),
  
  dividers: z.object({
    enabled: z.boolean(),
    style: z.enum(['line', 'pattern', 'icon', 'ornament']),
    height: z.number().min(0),
  }).optional(),
  
  policies: z.object({
    lastRowBalancing: z.enum(['CENTER', 'LEFT', 'RIGHT']),
    showLogoOnPages: z.array(z.enum(['FIRST', 'CONTINUATION', 'FINAL', 'SINGLE'])),
    repeatSectionHeaderOnContinuation: z.boolean(),
    sectionHeaderKeepWithNextItems: z.number().int().min(1),
    maxFeaturedPerSection: z.number().int().min(1).optional()
  }),
  
  filler: z.object({
    enabled: z.boolean(),
    safeZones: z.array(SafeZoneSchemaV2),
    tiles: z.array(FillerTileSchemaV2),
    policy: z.enum(['SEQUENTIAL', 'BY_PAGE_TYPE', 'RANDOM_SEEDED'])
  }),
  
  itemIndicators: z.object({
    mode: z.enum(['IMAGE_OVERLAY', 'INLINE', 'INLINE_AFTER_NAME', 'IN_DESCRIPTION']),
    maxCount: z.number().int().min(1).max(10),
    style: z.object({
      badgeSize: z.number().min(0),
      iconSet: z.enum(['emoji', 'lucide', 'letters'])
    }),
    spiceScale: z.record(z.string()),
    letterFallback: z.record(z.string())
  })
})

// =============================================================================
// Type Inference
// =============================================================================

/**
 * Inferred TypeScript type from the schema.
 * This should match TemplateV2 from engine-types-v2.ts
 */
export type TemplateSchemaType = z.infer<typeof TemplateSchemaV2>

// =============================================================================
// Exports
// =============================================================================

// All schemas are exported inline above for use in template loader and tests