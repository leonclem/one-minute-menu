/**
 * Streaming Paginator for GridMenu V2 Layout Engine
 *
 * This module implements the core pagination algorithm that replaces V1's
 * capacity-based pre-calculation with streaming placement. The algorithm
 * places tiles until constraints are violated, then creates new pages.
 *
 * KEY DESIGN DECISIONS:
 * 1. Normal function (not generator) - returns complete LayoutDocumentV2
 * 2. All height calculations use FOOTPRINT heights (grid-based)
 * 3. Keep-with-next enforcement uses footprint heights for both header and items
 * 4. Row advancement handles multi-row tiles correctly
 * 5. Page types assigned after all pages are created
 */

import type {
  EngineMenuV2,
  TemplateV2,
  PageSpecV2,
  LayoutDocumentV2,
  PageLayoutV2,
  PageTypeV2,
  TileInstanceV2,
  RegionV2,
  SelectionConfigV2,
  PlacementLogEntry,
} from './engine-types-v2'
import { calculateRegions, getBodyRegion } from './region-calculator'
import {
  createSectionHeaderTile,
  createItemTile,
  createLogoTile,
  createTitleTile,
  createFooterInfoTile,
  createDividerTile,
  selectItemVariant,
  placeTile,
  advancePosition,
  advanceToNextRow,
  applyLastRowBalancing,
  PlacementContext,
  initPlacementContext,
} from './tile-placer'
import { calculateTileHeight, calculateMaxRows } from './engine-types-v2'

// =============================================================================
// Placement Context Extension
// =============================================================================

/**
 * Extended placement context for streaming pagination.
 * Includes page management and debug information.
 */
export interface StreamingContext extends PlacementContext {
  template: TemplateV2
  pageSpec: PageSpecV2
  currentPage: PageLayoutV2
  pages: PageLayoutV2[]
  selection?: SelectionConfigV2
  debug?: {
    placementLog: PlacementLogEntry[]
  }
}



// =============================================================================
// Context Management
// =============================================================================

/**
 * Initialize streaming context for pagination.
 *
 * @param template - Template configuration
 * @param pageSpec - Page specification
 * @param selection - User selection config
 * @returns Initial streaming context
 */
export function initContext(
  template: TemplateV2,
  pageSpec: PageSpecV2,
  selection?: SelectionConfigV2
): StreamingContext {
  const showMenuTitle = selection?.showMenuTitle !== false // Default to true
  const regions = calculateRegions(pageSpec, template, showMenuTitle)
  
  const initialPage: PageLayoutV2 = {
    pageIndex: 0,
    pageType: 'SINGLE', // Will be updated later
    regions,
    tiles: [],
  }

  return {
    ...initPlacementContext(),
    template,
    pageSpec,
    currentPage: initialPage,
    pages: [initialPage],
    selection,
    debug: process.env.NODE_ENV === 'development' ? { placementLog: [] } : undefined,
  }
}

/**
 * Log a placement action for debugging.
 *
 * @param ctx - Streaming context
 * @param action - Action type
 * @param tileId - Optional tile ID
 * @param reason - Optional reason
 */
function logPlacement(
  ctx: StreamingContext,
  action: PlacementLogEntry['action'],
  tileId?: string,
  reason?: string
): void {
  if (!ctx.debug) return

  ctx.debug.placementLog.push({
    action,
    tileId,
    pageIndex: ctx.currentPage.pageIndex,
    row: ctx.currentRow,
    col: ctx.currentCol,
    reason,
    timestamp: Date.now(),
  })
}

// =============================================================================
// Page Management
// =============================================================================

/**
 * Check if a tile fits in the current page.
 * Uses FOOTPRINT height calculations.
 *
 * @param ctx - Streaming context
 * @param requiredHeight - Required height in points (FOOTPRINT)
 * @param colSpan - Column span of the tile (to check for row wrapping)
 * @returns True if tile fits, false otherwise
 */
export function fitsInCurrentPage(
  ctx: StreamingContext, 
  requiredHeight: number,
  colSpan: number = 1
): boolean {
  const bodyRegion = getBodyRegion(ctx.currentPage.regions)
  const { rowHeight, gapY, cols } = ctx.template.body.container
  
  // Calculate where the tile would actually be placed (handling potential row wrap)
  let targetRow = ctx.currentRow
  if (ctx.currentCol + colSpan > cols && ctx.currentCol > 0) {
    targetRow += ctx.currentRowMaxSpan
  }
  
  // Calculate the y-position where the next tile would be placed
  const nextTileY = targetRow * (rowHeight + gapY)
  
  // Check if the tile would fit within the body region
  const wouldFit = nextTileY + requiredHeight <= bodyRegion.height
  
  return wouldFit
}

/**
 * Finalize the current page.
 * Applies last row balancing and prepares for next page.
 *
 * @param ctx - Streaming context
 */
export function finalizePage(ctx: StreamingContext): void {
  logPlacement(ctx, 'finalize_page')
  
  // Apply last row balancing to current page
  applyLastRowBalancing(ctx.currentPage, ctx.template)
}

/**
 * Start a new page.
 *
 * @param ctx - Streaming context
 * @param pageType - Type of the new page
 */
export function startNewPage(ctx: StreamingContext, pageType: PageTypeV2): void {
  const showMenuTitle = ctx.selection?.showMenuTitle !== false // Default to true
  const regions = calculateRegions(ctx.pageSpec, ctx.template, showMenuTitle)
  
  const newPage: PageLayoutV2 = {
    pageIndex: ctx.pages.length,
    pageType, // Will be updated later by assignPageTypes
    regions,
    tiles: [],
  }

  ctx.pages.push(newPage)
  ctx.currentPage = newPage
  
  // Reset placement context for new page
  ctx.currentRow = 0
  ctx.currentCol = 0
  ctx.currentRowMaxSpan = 1
  ctx.currentRowTiles = []
  
  logPlacement(ctx, 'new_page', undefined, `Started ${pageType} page`)
}

// =============================================================================
// Static Tile Placement
// =============================================================================

/**
 * Place static tiles (logo, title) on a page based on page type.
 *
 * @param ctx - Streaming context
 * @param menu - Menu data
 * @param pageType - Type of page being created
 */
export function placeStaticTiles(
  ctx: StreamingContext,
  menu: EngineMenuV2,
  pageType: PageTypeV2
): void {
  const { showLogoOnPages } = ctx.template.policies
  
  // Place logo if policy allows for this page type
  if (showLogoOnPages.includes(pageType)) {
    const logoTile = createLogoTile(menu, ctx.template)
    const headerRegion = ctx.currentPage.regions.find(r => r.id === 'header')!
    
    const placedLogo = placeTile(
      ctx,
      ctx.currentPage,
      {
        ...logoTile,
        width: headerRegion.width, // Logo spans full header width
      },
      headerRegion,
      ctx.template
    )
    
    logPlacement(ctx, 'placed', placedLogo.id, 'Static logo tile')
  }
  
  // Place title tile only if showMenuTitle is enabled
  const showMenuTitle = ctx.selection?.showMenuTitle !== false // Default to true
  if (showMenuTitle) {
    const titleTile = createTitleTile(menu, ctx.template)
    const titleRegion = ctx.currentPage.regions.find(r => r.id === 'title')!
    
    const placedTitle = placeTile(
      ctx,
      ctx.currentPage,
      {
        ...titleTile,
        width: titleRegion.width, // Title spans full title region width
      },
      titleRegion,
      ctx.template
    )
    
    logPlacement(ctx, 'placed', placedTitle.id, 'Static title tile')
  }

  // Place footer info if present
  if (menu.metadata.venueInfo && (
    menu.metadata.venueInfo.address || 
    menu.metadata.venueInfo.phone || 
    menu.metadata.venueInfo.email ||
    menu.metadata.venueInfo.socialMedia?.instagram ||
    menu.metadata.venueInfo.socialMedia?.facebook ||
    menu.metadata.venueInfo.socialMedia?.x ||
    menu.metadata.venueInfo.socialMedia?.website
  )) {
    const footerTile = createFooterInfoTile(menu, ctx.template)
    const footerRegion = ctx.currentPage.regions.find(r => r.id === 'footer')
    
    if (footerRegion) {
      const placedFooter = placeTile(
        ctx,
        ctx.currentPage,
        footerTile,
        footerRegion,
        ctx.template
      )
      logPlacement(ctx, 'placed', placedFooter.id, 'Static footer info tile')
    }
  }
}

// =============================================================================
// Keep-With-Next Logic
// =============================================================================

/**
 * Check if a section header can be placed with required items.
 * Enforces keep-with-next policy using FOOTPRINT heights.
 *
 * @param ctx - Streaming context
 * @param section - Section to check
 * @param headerTile - Header tile (without position)
 * @returns True if header + required items fit, false otherwise
 */
function canPlaceHeaderWithItems(
  ctx: StreamingContext,
  section: { items: any[] },
  headerTile: Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'>
): boolean {
  const { sectionHeaderKeepWithNextItems } = ctx.template.policies
  const { rowHeight, gapY, cols } = ctx.template.body.container
  
  // Calculate the row where the section header would actually be placed
  // Section headers always start new rows, so if we're not at column 0, we need to advance
  let headerRow = ctx.currentRow
  if (ctx.currentCol !== 0) {
    headerRow += ctx.currentRowMaxSpan
  }
  
  // Create a temporary context to check if header fits at the correct position
  const tempCtx = { ...ctx, currentRow: headerRow }
  
  if (section.items.length === 0 || sectionHeaderKeepWithNextItems === 0) {
    return fitsInCurrentPage(tempCtx, headerTile.height)
  }
  
  // Calculate required height: header + gap + height needed for keep-with-next items
  let requiredHeight = headerTile.height + gapY
  
  const itemsToCheck = Math.min(sectionHeaderKeepWithNextItems, section.items.length)
  
  // Simulate placing the first N items to calculate actual grid row heights needed
  let simulatedCol = 0
  let maxRowSpanInCurrentRow = 1
  let rowsNeeded = 0
  
  for (let i = 0; i < itemsToCheck; i++) {
    const item = section.items[i]
    const itemVariant = selectItemVariant(item, ctx.template, ctx.selection)
    const itemRowSpan = itemVariant.variant.rowSpan ?? 1
    const itemColSpan = itemVariant.variant.colSpan ?? 1
    
    // Correct simulation: Check if item fits in current row before updating maxRowSpan
    if (simulatedCol + itemColSpan > cols && simulatedCol > 0) {
      rowsNeeded += maxRowSpanInCurrentRow
      simulatedCol = 0
      maxRowSpanInCurrentRow = 1
    }
    
    simulatedCol += itemColSpan
    if (itemRowSpan > maxRowSpanInCurrentRow) {
      maxRowSpanInCurrentRow = itemRowSpan
    }
    
    // If exactly filled, advance
    if (simulatedCol >= cols) {
      rowsNeeded += maxRowSpanInCurrentRow
      simulatedCol = 0
      maxRowSpanInCurrentRow = 1
    }
  }
  
  // If there are items remaining in the last simulated row, account for them
  if (simulatedCol > 0) {
    rowsNeeded += maxRowSpanInCurrentRow
  }
  
  // Calculate height needed for the rows using FOOTPRINT formula
  // This accounts for the actual grid space needed, not individual tile heights
  const itemsHeight = rowsNeeded * rowHeight + Math.max(0, rowsNeeded - 1) * gapY
  requiredHeight += itemsHeight
  
  // Header colSpan is usually 'cols' (full width)
  return fitsInCurrentPage(tempCtx, requiredHeight, headerTile.colSpan)
}

// =============================================================================
// Main Streaming Algorithm
// =============================================================================

/**
 * Main streaming pagination function.
 * Processes menu items and creates paginated layout.
 *
 * DESIGN DECISION: Normal function, not a generator.
 * Returns the complete LayoutDocumentV2 directly.
 *
 * @param menu - Menu data
 * @param template - Template configuration
 * @param pageSpec - Page specification
 * @param selection - User selection config
 * @returns Complete layout document
 */
export function streamingPaginate(
  menu: EngineMenuV2,
  template: TemplateV2,
  pageSpec: PageSpecV2,
  selection?: SelectionConfigV2
): LayoutDocumentV2 {
  const ctx = initContext(template, pageSpec, selection)
  const bodyRegion = getBodyRegion(ctx.currentPage.regions)
  
  // Place static tiles on first page
  placeStaticTiles(ctx, menu, 'FIRST')
  
  // Process each section in sortOrder
  const sortedSections = [...menu.sections].sort((a, b) => a.sortOrder - b.sortOrder)
  let nonEmptySectionIndex = 0
  for (const section of sortedSections) {
    // Skip empty sections (enforce INV-3: No widowed section headers)
    if (!section.items || section.items.length === 0) {
      continue
    }

    // Insert divider between sections (not before first non-empty section)
    if (template.dividers?.enabled && nonEmptySectionIndex > 0) {
      const dividerTile = createDividerTile(section.id, template)

      // Force new row before divider
      if (ctx.currentCol !== 0) {
        advanceToNextRow(ctx, ctx.currentRowMaxSpan)
      }

      if (!fitsInCurrentPage(ctx, dividerTile.height, dividerTile.colSpan)) {
        // Divider + next section go to new page together
        finalizePage(ctx)
        startNewPage(ctx, 'CONTINUATION')
        placeStaticTiles(ctx, menu, 'CONTINUATION')
      }

      const dividerRegion = getBodyRegion(ctx.currentPage.regions)
      const placedDivider = placeTile(ctx, ctx.currentPage, dividerTile, dividerRegion, template)
      logPlacement(ctx, 'placed', placedDivider.id, 'Section divider')
      advanceToNextRow(ctx, dividerTile.rowSpan)
    }

    nonEmptySectionIndex++

    // Create section header tile with FOOTPRINT height
    const headerTile = createSectionHeaderTile(section, template, false)
    
    // Check keep-with-next: header + required items must fit
    if (!canPlaceHeaderWithItems(ctx, section, headerTile)) {
      // Finalize current page and start new one
      finalizePage(ctx)
      startNewPage(ctx, 'CONTINUATION')
      placeStaticTiles(ctx, menu, 'CONTINUATION')
      
      // Get body region from new page
      const newBodyRegion = getBodyRegion(ctx.currentPage.regions)
      
      // Section headers always start new rows - force new row if not at start
      if (ctx.currentCol !== 0) {
        advanceToNextRow(ctx, ctx.currentRowMaxSpan)
      }
      
      // Place section header on new page
      const placedHeader = placeTile(ctx, ctx.currentPage, headerTile, newBodyRegion, template)
      logPlacement(ctx, 'placed', placedHeader.id, 'Section header')
    } else {
      // Section headers always start new rows - force new row if not at start
      if (ctx.currentCol !== 0) {
        advanceToNextRow(ctx, ctx.currentRowMaxSpan)
      }
      
      // Place section header on current page
      const placedHeader = placeTile(ctx, ctx.currentPage, headerTile, bodyRegion, template)
      logPlacement(ctx, 'placed', placedHeader.id, 'Section header')
    }
    
    // Advance to next row (section headers always start new rows)
    advanceToNextRow(ctx, headerTile.rowSpan)
    
    // Process items in this section in sortOrder
    const sortedItems = [...section.items].sort((a, b) => a.sortOrder - b.sortOrder)
    const maxFeatured = template.policies.maxFeaturedPerSection
    let featuredCount = 0
    for (const item of sortedItems) {
      // Enforce per-section featured limit: demote excess featured items to regular cards
      let effectiveItem = item
      if (item.isFeatured && maxFeatured != null && featuredCount >= maxFeatured) {
        effectiveItem = { ...item, isFeatured: false }
      }
      const itemTile = createItemTile(effectiveItem, section.id, template, menu.metadata.currency, selection)
      if (effectiveItem.isFeatured && itemTile.type === 'FEATURE_CARD') {
        featuredCount++
      }
      
      // Check if item fits on current page (passing colSpan for accurate wrap prediction)
      if (!fitsInCurrentPage(ctx, itemTile.height, itemTile.colSpan)) {
        // Finalize current page and start new one
        finalizePage(ctx)
        startNewPage(ctx, 'CONTINUATION')
        placeStaticTiles(ctx, menu, 'CONTINUATION')
        
        // Get body region from new page
        const newBodyRegion = getBodyRegion(ctx.currentPage.regions)
        
        // Repeat section header if policy enabled
        if (template.policies.repeatSectionHeaderOnContinuation) {
          const contHeader = createSectionHeaderTile(section, template, true)
          // Continuation headers also start new rows - should already be at start since it's a new page
          const placedContHeader = placeTile(ctx, ctx.currentPage, contHeader, newBodyRegion, template)
          logPlacement(ctx, 'placed', placedContHeader.id, 'Continuation header')
          advanceToNextRow(ctx, contHeader.rowSpan)
        }
        
        // Place item tile on new page
        const placedItem = placeTile(ctx, ctx.currentPage, itemTile, newBodyRegion, template)
        logPlacement(ctx, 'placed', placedItem.id, 'Item tile')
        
        // Advance position
        advancePosition(ctx, placedItem, template)
      } else {
        // Place item tile on current page
        const placedItem = placeTile(ctx, ctx.currentPage, itemTile, bodyRegion, template)
        logPlacement(ctx, 'placed', placedItem.id, 'Item tile')
        
        // Advance position
        advancePosition(ctx, placedItem, template)
      }
    }
  }
  
  // Finalize last page
  finalizePage(ctx)
  
  // Assign final page types
  assignPageTypes(ctx.pages)
  
  // Build and return layout document
  return buildLayoutDocument(ctx, menu)
}

// =============================================================================
// Page Type Assignment
// =============================================================================

/**
 * Assign correct page types to all pages.
 *
 * @param pages - Array of pages to update
 */
export function assignPageTypes(pages: PageLayoutV2[]): void {
  if (pages.length === 1) {
    pages[0].pageType = 'SINGLE'
  } else if (pages.length > 1) {
    pages[0].pageType = 'FIRST'
    pages[pages.length - 1].pageType = 'FINAL'
    
    // Middle pages are CONTINUATION
    for (let i = 1; i < pages.length - 1; i++) {
      pages[i].pageType = 'CONTINUATION'
    }
  }
}

// =============================================================================
// Layout Document Builder
// =============================================================================

/**
 * Build the final layout document.
 *
 * @param ctx - Streaming context
 * @param menu - Menu data
 * @returns Complete layout document
 */
export function buildLayoutDocument(
  ctx: StreamingContext,
  menu: EngineMenuV2
): LayoutDocumentV2 {
  const document: LayoutDocumentV2 = {
    templateId: ctx.template.id,
    templateVersion: ctx.template.version,
    pageSpec: ctx.pageSpec,
    pages: ctx.pages,
  }
  
  // Add debug info in development mode
  if (ctx.debug) {
    document.debug = {
      generatedAt: new Date().toISOString(),
      engineVersion: 'v2',
      inputHash: generateInputHash(menu, ctx.template, ctx.selection),
      placementLog: ctx.debug.placementLog,
    }
  }
  
  return document
}

/**
 * Generate a hash of the input for cache invalidation.
 * Excludes debug.generatedAt from determinism checks.
 *
 * @param menu - Menu data
 * @param template - Template configuration
 * @param selection - Selection config
 * @returns Hash string
 */
function generateInputHash(
  menu: EngineMenuV2,
  template: TemplateV2,
  selection?: SelectionConfigV2
): string {
  const input = {
    menuId: menu.id,
    templateId: template.id,
    templateVersion: template.version,
    selection,
    // Include relevant menu data for cache invalidation
    sectionsCount: menu.sections.length,
    itemsCount: menu.sections.reduce((sum, s) => sum + s.items.length, 0),
  }
  
  // Simple hash implementation (could be replaced with crypto.createHash in Node.js)
  const str = JSON.stringify(input)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}