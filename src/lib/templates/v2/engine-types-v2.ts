/**
 * V2 Layout Engine Type Definitions
 *
 * This file contains all type definitions for the GridMenu V2 Layout Engine.
 * V2 uses a PDF-first architecture with region-based page partitioning and
 * streaming pagination.
 *
 * KEY DESIGN DECISIONS:
 * 1. Canonical unit: points (1pt = 1/72 inch)
 * 2. Coordinates are content-box relative (renderer applies margins once)
 * 3. TileInstanceV2.height is FOOTPRINT (rowSpan * rowHeight + (rowSpan-1) * gapY),
 *    NOT contentBudget.totalHeight. Content budget is only for text clamping.
 * 4. gridRow/gridCol stored at placement time for reliable occupancy checks
 */

// =============================================================================
// Page Specification
// =============================================================================

/**
 * Page specification input.
 *
 * DESIGN DECISION: PAGE_DIMENSIONS provides only width/height.
 * Margins come from template.page.margins (or user override via input.pageSpec.margins).
 * This prevents silent margin conflicts between PAGE_DIMENSIONS and YAML.
 */
export interface PageSpecV2 {
  id: string
  width: number // points
  height: number // points
  margins: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

/** Pre-defined page dimensions (margins NOT included - come from template) */
export const PAGE_DIMENSIONS = {
  A4_PORTRAIT: {
    id: 'A4_PORTRAIT',
    width: 595.28,
    height: 841.89,
  },
  A4_LANDSCAPE: {
    id: 'A4_LANDSCAPE',
    width: 841.89,
    height: 595.28,
  },
} as const

export type PageDimensionId = keyof typeof PAGE_DIMENSIONS

/**
 * Build PageSpecV2 from dimensions + margins.
 * Priority: input.pageSpec.margins > template.page.margins > defaults
 */
export function buildPageSpec(
  size: PageDimensionId,
  margins: PageSpecV2['margins']
): PageSpecV2 {
  const dims = PAGE_DIMENSIONS[size]
  return {
    id: dims.id,
    width: dims.width,
    height: dims.height,
    margins,
  }
}

// =============================================================================
// Region Definitions
// =============================================================================

/** Region IDs */
export type RegionIdV2 = 'header' | 'title' | 'body' | 'footer'

/**
 * Region definition.
 *
 * DESIGN DECISION: Regions use content-box relative coordinates.
 * - x/y are relative to the content box (after page margins), NOT absolute page coords
 * - This means region.x = 0 for all regions (they span full content width)
 * - region.y is stacked within the content box
 * - Renderer applies page margins once at the content-box wrapper level
 * - Tile coords are relative to region origin (0,0 = top-left of region)
 *
 * Absolute page position = pageMargins + region.y + tile.y
 */
export interface RegionV2 {
  id: RegionIdV2
  x: number // always 0 (content-box relative)
  y: number // stacked position within content box
  width: number // content width (page width - left margin - right margin)
  height: number
}

// =============================================================================
// Page Types
// =============================================================================

/** Page type classification */
export type PageTypeV2 = 'FIRST' | 'CONTINUATION' | 'FINAL' | 'SINGLE'

// =============================================================================
// Tile Types and Content
// =============================================================================

/** Tile types */
export type TileTypeV2 =
  | 'LOGO'
  | 'TITLE'
  | 'SECTION_HEADER'
  | 'ITEM_CARD'
  | 'ITEM_TEXT_ROW'
  | 'FILLER'
  | 'TEXT_BLOCK'
  | 'FOOTER_INFO'

/** Tile layer for z-ordering and overlap detection */
export type TileLayerV2 = 'background' | 'content'

/**
 * Content budget for tile variants.
 * Used for internal text clamping/truncation only - NOT for placement.
 */
export interface ContentBudgetV2 {
  nameLines: number
  descLines: number
  indicatorAreaHeight: number // points
  imageBoxHeight: number // points (0 for text-only)
  paddingTop: number
  paddingBottom: number
  totalHeight: number // computed: sum of all
}

// =============================================================================
// Item Indicators
// =============================================================================

/** Dietary indicator types */
export type DietaryIndicator =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'gluten-free'

/** Item indicators for dietary, allergen, and spice information */
export interface ItemIndicatorsV2 {
  dietary: DietaryIndicator[]
  spiceLevel: number | null // 0-3 or null
  allergens: string[]
}

// =============================================================================
// Tile Content Types
// =============================================================================

/** Logo tile content */
export interface LogoContentV2 {
  type: 'LOGO'
  imageUrl?: string
  venueName?: string
}

/** Title tile content */
export interface TitleContentV2 {
  type: 'TITLE'
  menuName: string
  venueName?: string
}

/** Section header tile content */
export interface SectionHeaderContentV2 {
  type: 'SECTION_HEADER'
  sectionId: string
  label: string
  isContinuation: boolean
}

/** Item tile content (for both ITEM_CARD and ITEM_TEXT_ROW) */
export interface ItemContentV2 {
  type: 'ITEM_CARD' | 'ITEM_TEXT_ROW'
  itemId: string
  sectionId: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  showImage: boolean
  currency: string
  indicators: ItemIndicatorsV2
}

/** Filler tile content */
export interface FillerContentV2 {
  type: 'FILLER'
  style: 'color' | 'pattern' | 'icon'
  content?: string
}

/** Text block tile content */
export interface TextBlockContentV2 {
  type: 'TEXT_BLOCK'
  text: string
}

/** Footer info tile content */
export interface FooterInfoContentV2 {
  type: 'FOOTER_INFO'
  address?: string
  phone?: string
  email?: string
  socialMedia?: {
    instagram?: string
    facebook?: string
    x?: string
    website?: string
  }
}

/** Union of all tile content types */
export type TileContentV2 =
  | LogoContentV2
  | TitleContentV2
  | SectionHeaderContentV2
  | ItemContentV2
  | FillerContentV2
  | TextBlockContentV2
  | FooterInfoContentV2

// =============================================================================
// Tile Instance
// =============================================================================

/**
 * Positioned tile in output.
 *
 * DESIGN DECISION: Tile coordinates are region-relative.
 * - x/y are relative to the region's origin (0,0 = top-left of region)
 * - Renderer computes absolute position: pageMargins + region.y + tile.y
 * - layer field supports z-ordering for backgrounds vs content
 *
 * CRITICAL: width/height represent GRID FOOTPRINT, not content budget.
 * - Footprint = rowSpan * rowHeight + (rowSpan - 1) * gapY (for height)
 * - Footprint = colSpan * cellWidth + (colSpan - 1) * gapX (for width)
 * - contentBudget.totalHeight is for internal clamping/truncation only
 * - All placement logic (fitsInCurrentPage, occupancy, pagination) uses footprint
 *
 * gridRow/gridCol are stored at placement time for reliable occupancy checks
 * (avoids floating-point rounding issues from deriving row/col from x/y).
 */
export interface TileInstanceV2 {
  id: string
  type: TileTypeV2
  regionId: RegionIdV2
  x: number // relative to region origin (points)
  y: number // relative to region origin (points)
  width: number // FOOTPRINT width (points)
  height: number // FOOTPRINT height (points)
  colSpan: number
  rowSpan: number
  gridRow: number // grid row index at placement time (for occupancy)
  gridCol: number // grid col index at placement time (for occupancy)
  layer: TileLayerV2 // for overlap detection (backgrounds can underlay)
  content: TileContentV2
  /** Optional styling configuration */
  style?: TileStyleV2
  /** Optional content budget (for text clamping and image sizing) */
  contentBudget?: ContentBudgetV2
}

// =============================================================================
// Page Layout
// =============================================================================

/** Page in output document */
export interface PageLayoutV2 {
  pageIndex: number
  pageType: PageTypeV2
  regions: RegionV2[]
  tiles: TileInstanceV2[]
}

// =============================================================================
// Layout Document Output
// =============================================================================

/** Placement log entry for debugging */
export interface PlacementLogEntry {
  tileId?: string
  action:
    | 'placed'
    | 'page_break'
    | 'keep_with_next_violation'
    | 'finalize_page'
    | 'new_page'
  pageIndex: number
  row?: number
  col?: number
  reason?: string
  timestamp?: number
}

/**
 * Debug metadata (dev mode only).
 *
 * DESIGN DECISION: generatedAt is excluded from determinism checks.
 * Tests compare layouts excluding debug.generatedAt field.
 */
export interface LayoutDebugInfoV2 {
  generatedAt: string // ISO timestamp - excluded from determinism checks
  engineVersion: string
  inputHash: string // hash of menu + template for cache invalidation
  placementLog: PlacementLogEntry[]
}

/** Complete layout output */
export interface LayoutDocumentV2 {
  templateId: string
  templateVersion: string
  pageSpec: PageSpecV2
  pages: PageLayoutV2[]
  debug?: LayoutDebugInfoV2
}

// =============================================================================
// Engine Menu Input
// =============================================================================

/** Normalised menu input for V2 */
export interface EngineMenuV2 {
  id: string
  name: string
  sections: EngineSectionV2[]
  metadata: {
    currency: string
    venueName?: string
    venueAddress?: string
    logoUrl?: string
    establishmentType?: string
    primaryCuisine?: string
    venueInfo?: {
      address?: string
      email?: string
      phone?: string
    socialMedia?: {
      instagram?: string
      facebook?: string
      x?: string
      tiktok?: string
      website?: string
    }
    }
  }
}

/** Section with items */
export interface EngineSectionV2 {
  id: string
  name: string
  sortOrder: number
  items: EngineItemV2[]
}

/** Item with indicator support */
export interface EngineItemV2 {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  sortOrder: number
  indicators: ItemIndicatorsV2
}

// =============================================================================
// Selection Config
// =============================================================================

/** User selection configuration for layout generation */
export interface SelectionConfigV2 {
  /** Use text-only mode (ITEM_TEXT_ROW for all items) */
  textOnly?: boolean
  /** Override filler enabled state */
  fillersEnabled?: boolean
  /** Enable textured backgrounds for supported palettes */
  texturesEnabled?: boolean
  /** Show menu title in title region */
  showMenuTitle?: boolean
}


// =============================================================================
// Template Configuration Types
// =============================================================================

/** Parsed template from YAML */
export interface TemplateV2 {
  id: string
  version: string
  name: string
  page: TemplatePageConfigV2
  regions: TemplateRegionsConfigV2
  body: TemplateBodyConfigV2
  tiles: TemplateTileVariantsV2
  policies: TemplatePoliciesV2
  filler: TemplateFillerConfigV2
  itemIndicators: TemplateIndicatorConfigV2
}

/** Page configuration */
export interface TemplatePageConfigV2 {
  size: PageDimensionId
  margins: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

/** Region definitions in template */
export interface TemplateRegionsConfigV2 {
  header: { height: number }
  title: { height: number }
  footer: { height: number }
  // body height is computed from remaining space
}

/** Body container type */
export type BodyContainerTypeV2 = 'GRID'

/** Body container configuration */
export interface TemplateBodyConfigV2 {
  container: {
    type: BodyContainerTypeV2
    cols: number
    rowHeight: number
    gapX: number
    gapY: number
  }
}

// =============================================================================
// Styling Types
// =============================================================================

/** Typography styling configuration */
export interface TypographyStyleV2 {
  /** Font set ID (e.g., 'modern-sans', 'elegant-serif') */
  fontSet?: string
  /** Font size token (e.g., 'xl', '2xl') */
  fontSize?: string
  /** Font weight token (e.g., 'normal', 'semibold', 'bold') */
  fontWeight?: string
  /** Text alignment */
  textAlign?: 'left' | 'center' | 'right'
  /** Line height token (e.g., 'tight', 'normal', 'relaxed') */
  lineHeight?: string
}

/** Spacing styling configuration */
export interface SpacingStyleV2 {
  /** Padding top in points */
  paddingTop?: number
  /** Padding bottom in points */
  paddingBottom?: number
  /** Padding left in points */
  paddingLeft?: number
  /** Padding right in points */
  paddingRight?: number
}

/** Border styling configuration */
export interface BorderStyleV2 {
  /** Border width in points */
  width?: number
  /** Border color (hex, rgb, etc.) */
  color?: string
  /** Border style */
  style?: 'solid' | 'dashed' | 'dotted'
  /** Which sides to apply border to */
  sides?: ('top' | 'bottom' | 'left' | 'right')[]
}

/** Background styling configuration */
export interface BackgroundStyleV2 {
  /** Background color (hex, rgb, etc.) */
  color?: string
  /** Border radius in points */
  borderRadius?: number
}

/** Complete tile styling configuration */
export interface TileStyleV2 {
  /** Typography styling */
  typography?: TypographyStyleV2
  /** Spacing styling */
  spacing?: SpacingStyleV2
  /** Border styling */
  border?: BorderStyleV2
  /** Background styling */
  background?: BackgroundStyleV2
}

/** Single tile variant definition */
export interface TileVariantDefV2 {
  region: RegionIdV2
  contentBudget: ContentBudgetV2
  colSpan?: number
  rowSpan?: number
  /** Optional styling configuration */
  style?: TileStyleV2
}

/** Tile variant definitions */
export interface TemplateTileVariantsV2 {
  LOGO: TileVariantDefV2
  TITLE: TileVariantDefV2
  SECTION_HEADER: TileVariantDefV2
  ITEM_CARD: TileVariantDefV2
  ITEM_TEXT_ROW: TileVariantDefV2
  FILLER?: TileVariantDefV2[]
}

/** Layout policies */
export interface TemplatePoliciesV2 {
  lastRowBalancing: 'CENTER' | 'LEFT' | 'RIGHT'
  showLogoOnPages: PageTypeV2[]
  repeatSectionHeaderOnContinuation: boolean
  sectionHeaderKeepWithNextItems: number
}

/**
 * Safe zone as grid range.
 *
 * DESIGN DECISION: Safe zones use grid coordinates (row/col indices).
 * - 'LAST' means the final row index computed as: floor((bodyHeight - gapY) / (rowHeight + gapY))
 * - Safe zones are evaluated AFTER placement and AFTER last-row balancing
 * - Fillers only placed in empty cells within safe zones
 */
export interface SafeZoneV2 {
  startRow: number | 'LAST' | 'LAST_CONTENT' // 'LAST' = final row index in body grid, 'LAST_CONTENT' = last row index used by items
  endRow: number | 'LAST' | 'LAST_CONTENT'
  startCol: number
  endCol: number
}

/** Filler tile definition */
export interface FillerTileDefV2 {
  id: string
  style: 'color' | 'pattern' | 'icon'
  content?: string
  rowSpan?: number // Defaults to 1 if not specified
  colSpan?: number // Defaults to 1 if not specified
}

/** Filler selection policy */
export type FillerPolicyV2 = 'SEQUENTIAL' | 'BY_PAGE_TYPE' | 'RANDOM_SEEDED'

/** Filler configuration */
export interface TemplateFillerConfigV2 {
  enabled: boolean
  safeZones: SafeZoneV2[]
  tiles: FillerTileDefV2[]
  policy: FillerPolicyV2
}

/** Indicator rendering mode */
export type IndicatorModeV2 =
  | 'IMAGE_OVERLAY'
  | 'INLINE'
  | 'INLINE_AFTER_NAME'
  | 'IN_DESCRIPTION'

/** Icon set for indicators */
export type IndicatorIconSetV2 = 'emoji' | 'lucide' | 'letters'

/** Indicator configuration */
export interface TemplateIndicatorConfigV2 {
  mode: IndicatorModeV2
  maxCount: number
  style: {
    badgeSize: number
    iconSet: IndicatorIconSetV2
  }
  spiceScale: Record<number, string> // e.g., { 1: '🌶', 2: '🌶🌶', 3: '🌶🌶🌶' }
  letterFallback: Record<string, string> // e.g., { vegetarian: 'V', vegan: 'VG' }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate tile FOOTPRINT height from rowSpan.
 *
 * CRITICAL: This is the height used for ALL placement logic:
 * - fitsInCurrentPage checks
 * - keep-with-next calculations
 * - occupancy grid
 * - tile.height field
 *
 * contentBudget.totalHeight is ONLY for internal text clamping/truncation.
 *
 * Formula: rowSpan * rowHeight + (rowSpan - 1) * gapY
 *
 * Examples with rowHeight=70, gapY=8:
 * - rowSpan=1: 70 * 1 + 0 * 8 = 70pt
 * - rowSpan=2: 70 * 2 + 1 * 8 = 148pt (spans 2 rows including gap)
 */
export function calculateTileHeight(
  rowSpan: number,
  rowHeight: number,
  gapY: number
): number {
  return rowSpan * rowHeight + (rowSpan - 1) * gapY
}

/**
 * Calculate tile FOOTPRINT width from colSpan.
 *
 * Formula: colSpan * cellWidth + (colSpan - 1) * gapX
 */
export function calculateTileWidth(
  colSpan: number,
  cellWidth: number,
  gapX: number
): number {
  return colSpan * cellWidth + (colSpan - 1) * gapX
}

/**
 * Calculate cell width from body region and grid config.
 */
export function calculateCellWidth(
  bodyWidth: number,
  cols: number,
  gapX: number
): number {
  return (bodyWidth - (cols - 1) * gapX) / cols
}

/**
 * Calculate maximum rows that fit in body region.
 */
export function calculateMaxRows(
  bodyHeight: number,
  rowHeight: number,
  gapY: number
): number {
  // First row doesn't need gap above it
  // Each subsequent row needs rowHeight + gapY
  // Formula: floor((bodyHeight + gapY) / (rowHeight + gapY))
  return Math.floor((bodyHeight + gapY) / (rowHeight + gapY))
}
