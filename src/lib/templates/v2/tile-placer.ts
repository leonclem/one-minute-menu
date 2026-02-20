/**
 * Tile Placer for GridMenu V2 Layout Engine
 *
 * This module provides utilities for creating and placing tiles in the layout.
 * All tile heights use FOOTPRINT calculations (rowSpan * rowHeight + gaps),
 * NOT contentBudget.totalHeight which is only for internal text clamping.
 *
 * KEY DESIGN DECISIONS:
 * 1. Tile height = FOOTPRINT (rowSpan * rowHeight + (rowSpan-1) * gapY)
 * 2. gridRow/gridCol are stored at placement time for reliable occupancy checks
 * 3. Position advancement handles multi-row tiles correctly
 * 4. Last row balancing adjusts x-coordinates only (no reordering)
 */

import type {
  TileInstanceV2,
  EngineMenuV2,
  EngineSectionV2,
  EngineItemV2,
  TemplateV2,
  SelectionConfigV2,
  PageLayoutV2,
  TileVariantDefV2,
  TileTypeV2,
  RegionV2,
} from './engine-types-v2'
import { calculateTileHeight, calculateTileWidth, calculateCellWidth } from './engine-types-v2'

// =============================================================================
// Placement Context
// =============================================================================

/**
 * Context for tile placement during pagination.
 * Tracks current position and row occupancy for multi-row tiles.
 */
export interface PlacementContext {
  currentRow: number
  currentCol: number
  /** Track maximum rowSpan in current row to advance correctly */
  currentRowMaxSpan: number
  /** Tiles placed in current row (for tracking max span) */
  currentRowTiles: TileInstanceV2[]
}

/**
 * Initialize placement context for a new page.
 */
export function initPlacementContext(): PlacementContext {
  return {
    currentRow: 0,
    currentCol: 0,
    currentRowMaxSpan: 1,
    currentRowTiles: [],
  }
}

// =============================================================================
// Tile Creation Functions
// =============================================================================

/**
 * Create a section header tile.
 *
 * @param section - Section data
 * @param template - Template configuration
 * @param isContinuation - Whether this is a continuation header
 * @returns Section header tile instance (without position - set during placement)
 */
export function createSectionHeaderTile(
  section: EngineSectionV2,
  template: TemplateV2,
  isContinuation: boolean = false
): Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'> {
  const variant = template.tiles.SECTION_HEADER
  const { rowHeight, gapY, cols, gapX } = template.body.container
  
  const rowSpan = variant.rowSpan ?? 1
  const colSpan = variant.colSpan ?? cols // Default to full width
  
  // CRITICAL: Use FOOTPRINT height, not contentBudget.totalHeight
  const height = calculateTileHeight(rowSpan, rowHeight, gapY)
  
  // Calculate cell width for width calculation
  const bodyRegion = { width: 0 } // Will be set by caller with actual region
  const cellWidth = calculateCellWidth(bodyRegion.width || 1000, cols, gapX)
  const width = calculateTileWidth(colSpan, cellWidth, gapX)
  
  return {
    id: `section-header-${section.id}${isContinuation ? '-cont' : ''}`,
    type: 'SECTION_HEADER',
    regionId: 'body',
    width,
    height,
    colSpan,
    rowSpan,
    layer: 'content',
    content: {
      type: 'SECTION_HEADER',
      sectionId: section.id,
      label: section.name,
      isContinuation,
    },
    // Pass style information from template
    style: variant.style,
    contentBudget: variant.contentBudget,
  }
}

/**
 * Create an item tile (ITEM_CARD or ITEM_TEXT_ROW).
 *
 * @param item - Item data
 * @param sectionId - Parent section ID
 * @param template - Template configuration
 * @param currency - Currency symbol
 * @param selection - User selection config (e.g., textOnly mode)
 * @returns Item tile instance (without position - set during placement)
 */
export function createItemTile(
  item: EngineItemV2,
  sectionId: string,
  template: TemplateV2,
  currency: string,
  selection?: SelectionConfigV2
): Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'> {
  // Select variant based on config and item properties
  const { variant, tileType } = selectItemVariant(item, template, selection)
  const { rowHeight, gapY, cols, gapX } = template.body.container
  
  const rowSpan = variant.rowSpan ?? 1
  const colSpan = variant.colSpan ?? 1
  
  // CRITICAL: Use FOOTPRINT height, not contentBudget.totalHeight
  const height = calculateTileHeight(rowSpan, rowHeight, gapY)
  
  // Calculate cell width for width calculation
  const bodyRegion = { width: 0 } // Will be set by caller with actual region
  const cellWidth = calculateCellWidth(bodyRegion.width || 1000, cols, gapX)
  const width = calculateTileWidth(colSpan, cellWidth, gapX)
  
  const showImage = tileType === 'ITEM_CARD' || tileType === 'FEATURE_CARD'
  
  // Build content based on tile type
  const content = tileType === 'FEATURE_CARD'
    ? {
        type: 'FEATURE_CARD' as const,
        itemId: item.id,
        sectionId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        showImage,
        currency: currency || '$',
        indicators: item.indicators,
      }
    : {
        type: tileType as 'ITEM_CARD' | 'ITEM_TEXT_ROW',
        itemId: item.id,
        sectionId,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        showImage,
        currency: currency || '$',
        indicators: item.indicators,
      }
  
  return {
    id: `item-${item.id}`,
    type: tileType,
    regionId: 'body',
    width,
    height,
    colSpan,
    rowSpan,
    layer: 'content',
    content,
    style: variant.style,
    contentBudget: variant.contentBudget,
  }
}

/**
 * Create a logo tile.
 *
 * @param menu - Menu data
 * @param template - Template configuration
 * @returns Logo tile instance (without position - set during placement)
 */
export function createLogoTile(
  menu: EngineMenuV2,
  template: TemplateV2
): Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'> {
  const variant = template.tiles.LOGO
  
  return {
    id: `logo-${menu.id}`,
    type: 'LOGO',
    regionId: variant.region,
    width: 0, // Will be set by caller based on region width
    height: variant.contentBudget.totalHeight, // Logo uses content budget directly
    colSpan: 1,
    rowSpan: 1,
    layer: 'content',
    content: {
      type: 'LOGO',
      imageUrl: menu.metadata.logoUrl,
      venueName: menu.metadata.venueName,
    },
    style: variant.style,
    contentBudget: variant.contentBudget,
  }
}

/**
 * Create a title tile.
 *
 * @param menu - Menu data
 * @param template - Template configuration
 * @returns Title tile instance (without position - set during placement)
 */
export function createTitleTile(
  menu: EngineMenuV2,
  template: TemplateV2
): Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'> {
  const variant = template.tiles.TITLE
  
  return {
    id: `title-${menu.id}`,
    type: 'TITLE',
    regionId: variant.region,
    width: 0, // Will be set by caller based on region width
    height: variant.contentBudget.totalHeight, // Title uses content budget directly
    colSpan: 1,
    rowSpan: 1,
    layer: 'content',
    content: {
      type: 'TITLE',
      menuName: menu.name,
      venueName: menu.metadata.venueName,
    },
    style: variant.style,
    contentBudget: variant.contentBudget,
  }
}

/**
 * Create a footer info tile.
 *
 * @param menu - Menu data
 * @param template - Template configuration
 * @returns Footer info tile instance (without position - set during placement)
 */
export function createFooterInfoTile(
  menu: EngineMenuV2,
  template: TemplateV2
): Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'> {
  // Use footer region height from template if available, otherwise default to 40
  const height = template.regions.footer?.height || 40 
  
  const footerVariant = template.tiles.FOOTER_INFO

  return {
    id: `footer-info-${menu.id}`,
    type: 'FOOTER_INFO',
    regionId: 'footer',
    width: 0, // Will be set by caller based on region width
    height,
    colSpan: 1,
    rowSpan: 1,
    layer: 'content',
    content: {
      type: 'FOOTER_INFO',
      address: menu.metadata.venueInfo?.address,
      phone: menu.metadata.venueInfo?.phone,
      email: menu.metadata.venueInfo?.email,
      socialMedia: menu.metadata.venueInfo?.socialMedia,
    },
    style: footerVariant?.style,
  }
}

/**
 * Create a decorative divider tile (inserted between sections).
 *
 * @param sectionId - ID of the section after the divider
 * @param template - Template configuration
 * @returns Divider tile instance (without position - set during placement)
 */
export function createDividerTile(
  sectionId: string,
  template: TemplateV2
): Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'> {
  const { rowHeight, gapY, cols, gapX } = template.body.container
  const dividerVariant = template.tiles.DECORATIVE_DIVIDER
  
  const colSpan = dividerVariant?.colSpan ?? cols // Full width by default
  const rowSpan = dividerVariant?.rowSpan ?? 1
  
  const height = calculateTileHeight(rowSpan, rowHeight, gapY)
  const cellWidth = calculateCellWidth(1000, cols, gapX) // placeholder width, recalculated at placement
  const width = calculateTileWidth(colSpan, cellWidth, gapX)
  
  const style = template.dividers?.style ?? 'line'
  
  return {
    id: `divider-${sectionId}`,
    type: 'DECORATIVE_DIVIDER',
    regionId: 'body',
    width,
    height,
    colSpan,
    rowSpan,
    layer: 'content',
    content: {
      type: 'DECORATIVE_DIVIDER',
      sectionId,
      style,
    },
    contentBudget: dividerVariant?.contentBudget,
    style: dividerVariant?.style,
  }
}

// =============================================================================
// Variant Selection
// =============================================================================

/**
 * Select the appropriate item variant based on config and item properties.
 *
 * @param item - Item data
 * @param template - Template configuration
 * @param selection - User selection config
 * @returns The selected tile variant definition and tile type
 */
export function selectItemVariant(
  item: EngineItemV2,
  template: TemplateV2,
  selection?: SelectionConfigV2
): { variant: TileVariantDefV2; tileType: TileTypeV2 } {
  // If textOnly mode is enabled, always use ITEM_TEXT_ROW
  if (selection?.textOnly) {
    return { variant: template.tiles.ITEM_TEXT_ROW, tileType: 'ITEM_TEXT_ROW' }
  }
  
  // Featured item — use FEATURE_CARD if template supports it
  if (item.isFeatured && template.tiles.FEATURE_CARD) {
    return { variant: template.tiles.FEATURE_CARD, tileType: 'FEATURE_CARD' }
  }
  
  // Use ITEM_CARD for all items (with placeholder if no image) to maintain visual parity
  // This ensures consistent spacing and layout regardless of image availability
  if (template.tiles.ITEM_CARD) {
    return { variant: template.tiles.ITEM_CARD, tileType: 'ITEM_CARD' }
  }
  
  // Fallback to ITEM_TEXT_ROW if ITEM_CARD is not available in template
  return { variant: template.tiles.ITEM_TEXT_ROW, tileType: 'ITEM_TEXT_ROW' }
}

// =============================================================================
// Tile Placement Functions
// =============================================================================

/**
 * Place a tile on the current page at the current position.
 * Sets gridRow and gridCol based on current context.
 *
 * @param ctx - Placement context
 * @param page - Current page
 * @param tile - Tile to place (without position)
 * @param bodyRegion - Body region for coordinate calculation
 * @param template - Template configuration
 * @returns The placed tile with position set
 */
export function placeTile(
  ctx: PlacementContext,
  page: PageLayoutV2,
  tile: Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'>,
  region: RegionV2,
  template: TemplateV2
): TileInstanceV2 {
  const { rowHeight, gapY, cols, gapX } = template.body.container
  const cellWidth = calculateCellWidth(region.width, cols, gapX)
  
  let x: number
  let y: number
  let gridRow: number
  let gridCol: number
  
  if (tile.regionId === 'body') {
    // If the tile's colSpan would overflow the current row, wrap to the next row
    if (ctx.currentCol + tile.colSpan > cols && ctx.currentCol > 0) {
      advanceToNextRow(ctx, ctx.currentRowMaxSpan)
    }
    
    // For body tiles, use grid-based positioning
    x = ctx.currentCol * (cellWidth + gapX)
    y = ctx.currentRow * (rowHeight + gapY)
    gridRow = ctx.currentRow
    gridCol = ctx.currentCol
  } else {
    // For non-body tiles (header, title, footer), position at region origin
    x = 0
    y = 0
    gridRow = 0
    gridCol = 0
  }
  
  // Create placed tile with position and grid coordinates
  const placedTile: TileInstanceV2 = {
    ...tile,
    x,
    y,
    gridRow,
    gridCol,
    // Update width with actual cell width (for tiles that need it)
    width: tile.regionId === 'body' 
      ? calculateTileWidth(tile.colSpan, cellWidth, gapX)
      : region.width, // Non-body tiles span full region width
  }
  
  // Add tile to page
  page.tiles.push(placedTile)
  
  // Only track body tiles in placement context
  if (tile.regionId === 'body') {
    // Track this tile in current row
    ctx.currentRowTiles.push(placedTile)
    
    // Update max span for current row
    if (tile.rowSpan > ctx.currentRowMaxSpan) {
      ctx.currentRowMaxSpan = tile.rowSpan
    }
  }
  
  return placedTile
}

/**
 * Advance position after placing a tile.
 * Handles multi-column and multi-row tiles correctly.
 *
 * @param ctx - Placement context
 * @param tile - Tile that was just placed
 * @param template - Template configuration
 */
export function advancePosition(
  ctx: PlacementContext,
  tile: TileInstanceV2,
  template: TemplateV2
): void {
  const { cols } = template.body.container
  
  // Increment column by tile's colSpan
  ctx.currentCol += tile.colSpan
  
  // If we've filled the row, move to next row
  if (ctx.currentCol >= cols) {
    advanceToNextRow(ctx, ctx.currentRowMaxSpan)
  }
}

/**
 * Advance to the next row.
 * Increments row by the specified rowSpan (accounts for multi-row tiles).
 *
 * @param ctx - Placement context
 * @param rowSpan - Number of rows to advance (default 1)
 */
export function advanceToNextRow(ctx: PlacementContext, rowSpan: number = 1): void {
  ctx.currentRow += rowSpan
  ctx.currentCol = 0
  ctx.currentRowMaxSpan = 1
  ctx.currentRowTiles = []
}

// =============================================================================
// Last Row Balancing
// =============================================================================

/**
 * Apply last row balancing to a page.
 * Adjusts x-coordinates of tiles in the last row based on balancing policy.
 *
 * @param page - Page to apply balancing to
 * @param template - Template configuration
 */
export function applyLastRowBalancing(
  page: PageLayoutV2,
  template: TemplateV2
): void {
  const policy = template.policies.lastRowBalancing
  
  // LEFT balancing requires no adjustment
  if (policy === 'LEFT') {
    return
  }
  
  // Find all body tiles (items only)
  const bodyTiles = page.tiles.filter(
    t => t.regionId === 'body' && 
         (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW' || t.type === 'FEATURE_CARD')
  )
  
  if (bodyTiles.length === 0) {
    return
  }
  
  // Find tiles in the last row
  const maxY = Math.max(...bodyTiles.map(t => t.y))
  const lastRowTiles = bodyTiles.filter(t => t.y === maxY)
  
  const { cols, gapX } = template.body.container
  const bodyRegion = page.regions.find(r => r.id === 'body')!
  const cellWidth = calculateCellWidth(bodyRegion.width, cols, gapX)
  
  // Calculate occupied columns in last row
  const occupiedCols = lastRowTiles.reduce((sum, t) => sum + t.colSpan, 0)
  
  // If row is full, no balancing needed
  if (occupiedCols >= cols) {
    return
  }
  
  const emptyCols = cols - occupiedCols
  
  // Calculate offset based on policy
  let offsetXPts = 0
  if (policy === 'CENTER') {
    // Center the items by shifting by half the total empty columns
    // Use fractional offset for precise centering
    const fractionalOffset = emptyCols / 2
    offsetXPts = fractionalOffset * (cellWidth + gapX)
  } else if (policy === 'RIGHT') {
    offsetXPts = emptyCols * (cellWidth + gapX)
  }
  
  if (offsetXPts === 0) {
    return
  }
  
  // Apply offset to last row tiles.
  // IMPORTANT: Make this idempotent. Use gridCol to compute the base X so
  // repeated balancing (or other prior shifts) doesn't accumulate.
  for (const tile of lastRowTiles) {
    const baseX = tile.gridCol * (cellWidth + gapX)
    tile.x = baseX + offsetXPts
    // Note: gridCol is not updated for fractional offsets
  }
}

/**
 * Center-align items in all incomplete rows of a section.
 * This ensures that when a section has fewer items than columns in any row, they're centered.
 * Processes each page separately since Y coordinates are region-relative and reset per page.
 *
 * @param pages - All pages in the layout document
 * @param sectionId - Section ID to center-align
 * @param template - Template configuration
 */
export function applySectionLastRowCentering(
  pages: PageLayoutV2[],
  sectionId: string,
  template: TemplateV2
): void {
  const { cols, gapX } = template.body.container
  
  // Process each page separately since Y coordinates are region-relative and reset per page
  for (const page of pages) {
    // Find all item tiles from this section on this page
    const sectionItems = page.tiles.filter(
      t => t.regionId === 'body' &&
           (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW' || t.type === 'FEATURE_CARD') &&
           (t.content as any).sectionId === sectionId
    )
    
    if (sectionItems.length === 0) {
      continue
    }
    
    // Get body region for this page
    const bodyRegion = page.regions.find(r => r.id === 'body')
    if (!bodyRegion) {
      continue
    }
    
    const cellWidth = calculateCellWidth(bodyRegion.width, cols, gapX)
    
    // Group items by their starting Y coordinate (row) within this page
    // Items with the same Y coordinate are in the same row
    const itemsByRow = new Map<number, TileInstanceV2[]>()
    for (const item of sectionItems) {
      const rowY = item.y
      if (!itemsByRow.has(rowY)) {
        itemsByRow.set(rowY, [])
      }
      itemsByRow.get(rowY)!.push(item)
    }
    
    // For each row, check if it's incomplete and center it if needed
    itemsByRow.forEach((rowItems, rowY) => {
      // Calculate occupied columns in this row
      const occupiedCols = rowItems.reduce((sum, t) => sum + t.colSpan, 0)
      
      // If row is full, no centering needed
      if (occupiedCols >= cols) {
        return
      }
      
      // Calculate center offset for this incomplete row
      const emptyCols = cols - occupiedCols
      const fractionalOffset = emptyCols / 2
      const offsetXPts = fractionalOffset * (cellWidth + gapX)
      
      if (offsetXPts === 0) {
        return
      }
      
      // Apply offset to all items in this row.
      // IMPORTANT: Make this idempotent by using gridCol-derived base X.
      for (const tile of rowItems) {
        const baseX = tile.gridCol * (cellWidth + gapX)
        tile.x = baseX + offsetXPts
        // Note: gridCol is not updated for fractional offsets
      }
    })
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique tile ID.
 *
 * @param type - Tile type
 * @param identifier - Unique identifier (e.g., item ID, section ID)
 * @param suffix - Optional suffix for uniqueness
 * @returns Unique tile ID
 */
export function generateTileId(
  type: string,
  identifier: string,
  suffix?: string
): string {
  const parts = [type.toLowerCase(), identifier]
  if (suffix) {
    parts.push(suffix)
  }
  return parts.join('-')
}
