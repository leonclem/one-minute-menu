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
  EngineItemV2,
} from './engine-types-v2'
import { calculateRegions, getBodyRegion } from './region-calculator'
import {
  createSectionHeaderTile,
  createLogoTile,
  createTitleTile,
  createFooterInfoTile,
  createDividerTile,
  createBannerTile,
  createBannerStripTile,
  placeTile,
  advanceToNextRow,
  applyLastRowBalancing,
  applySectionLastRowCentering,
  PlacementContext,
  initPlacementContext,
} from './tile-placer'
import { calculateMaxRows } from './engine-types-v2'
import { PALETTES_V2, DEFAULT_PALETTE_V2 } from './palettes-v2'
import { buildContinuationLeadRowPlan, buildSectionPlans } from './lead-row-planner'

// =============================================================================
// Banner Helpers
// =============================================================================

/**
 * Determine if banner should be shown based on selection config and template config.
 * Returns false when showBanner is false OR template.banner.enabled is false/absent.
 */
export function isBannerEnabled(
  template: TemplateV2,
  selection?: SelectionConfigV2
): boolean {
  const bannerConfig = template.banner
  if (!bannerConfig?.enabled) return false
  // showBanner defaults to true when template supports it
  return selection?.showBanner !== false
}

/**
 * Compute banner height for FIRST/SINGLE pages.
 * Returns 0 when banner is disabled.
 */
export function computeBannerHeight(
  template: TemplateV2,
  selection?: SelectionConfigV2
): number {
  if (!isBannerEnabled(template, selection)) return 0
  return template.banner!.heightPt
}

/**
 * Compute banner strip height for CONTINUATION/FINAL pages.
 * Returns 0 when banner is disabled.
 */
export function computeStripHeight(
  template: TemplateV2,
  selection?: SelectionConfigV2
): number {
  if (!isBannerEnabled(template, selection)) return 0
  return template.banner!.stripHeightPt
}

/**
 * Get surface and text colors from the active palette.
 */
function getBannerColors(selection?: SelectionConfigV2): { surfaceColor: string; textColor: string } {
  const palette = selection?.colourPaletteId
    ? (PALETTES_V2.find(p => p.id === selection.colourPaletteId) ?? DEFAULT_PALETTE_V2)
    : DEFAULT_PALETTE_V2

  return {
    surfaceColor: palette.colors.bannerSurface,
    textColor: palette.colors.bannerText
  }
}

/**
 * Find the flagship item across all sections of the menu.
 */
function findFlagshipItem(menu: EngineMenuV2): EngineItemV2 | undefined {
  for (const section of menu.sections) {
    const flagship = section.items.find(item => item.isFlagship)
    if (flagship) return flagship
  }
  return undefined
}

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

const BODY_TOP_PADDING_NO_HEADERS = 20 // pts of breathing room when category titles are hidden
const HEADER_BUFFER_WITH_BODY_LOGO = 8 // small print-safe gap when the header logo is suppressed
const BODY_TOP_PADDING_WITH_BANNER = 6 // small buffer between banner/strip and first body row

function resolveHeaderRegionHeight(
  template: TemplateV2,
  selection: SelectionConfigV2 | undefined,
  bannerHeight: number
): number {
  if (bannerHeight > 0) return 0
  if (selection?.showLogoTile === true) return HEADER_BUFFER_WITH_BODY_LOGO
  return 0
}

/**
 * Add a small buffer below the banner/strip so body rows do not sit flush
 * against the banner edge.
 */
function applyBannerBodyPadding(regions: RegionV2[], template: TemplateV2, selection?: SelectionConfigV2): void {
  const banner = regions.find(r => r.id === 'banner')
  if (!banner || banner.height <= 0) return

  const showCategoryTitles = selection?.showCategoryTitles !== false // default true
  if (!showCategoryTitles) return

  const body = regions.find(r => r.id === 'body')
  if (!body) return

  const padding = BODY_TOP_PADDING_WITH_BANNER

  body.y += padding
  body.height -= padding
}

/**
 * When category titles are hidden, nudge the body region down slightly so items
 * don't sit flush against the logo/header. Reduces body height by the same amount
 * so the footer anchor is unaffected.
 */
function applyBodyTopPadding(regions: RegionV2[], selection?: SelectionConfigV2): void {
  const showCategoryTitles = selection?.showCategoryTitles !== false // default true
  if (showCategoryTitles) return
  const body = regions.find(r => r.id === 'body')
  if (!body) return
  body.y += BODY_TOP_PADDING_NO_HEADERS
  body.height -= BODY_TOP_PADDING_NO_HEADERS
}

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
  const bannerHeight = computeBannerHeight(template, selection)
  // For showTitleBar templates, title region is shown when showMenuTitle is true (user-controlled)
  // For other templates, title is suppressed when banner is present
  const showMenuTitle = template.banner?.showTitleBar === true
    ? selection?.showMenuTitle === true
    : (bannerHeight === 0 && selection?.showMenuTitle === true)
  const headerHeight = resolveHeaderRegionHeight(template, selection, bannerHeight)
  const regions = calculateRegions(pageSpec, template, showMenuTitle, bannerHeight, {
    headerHeightOverride: headerHeight,
  })
  applyBannerBodyPadding(regions, template, selection)
  applyBodyTopPadding(regions, selection)
  
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
  
  // When fillers are enabled (template or selection), do not center so empty cells remain for fillers
  const fillersEnabled = ctx.selection?.fillersEnabled ?? ctx.template.filler.enabled
  const spacerTilePatternId = ctx.selection?.spacerTilePatternId || ctx.template.filler.tiles[0]?.id
  const hasSpacers = fillersEnabled && spacerTilePatternId !== 'none'

  // Apply centering if: spacers are disabled AND centering is wanted.
  // centreAlignment === false means the user explicitly disabled it, overriding the template policy.
  // centreAlignment === true means the user explicitly enabled it.
  // centreAlignment === undefined means defer to the template policy.
  const templateWantsCentre = ctx.template.policies.lastRowBalancing === 'CENTER'
  const userOverride = ctx.selection?.centreAlignment  // true | false | undefined
  const shouldCentre = userOverride === false ? false : (userOverride === true ? true : templateWantsCentre)
  if (!hasSpacers && shouldCentre) {
    applyLastRowBalancing(ctx.currentPage, ctx.template)
  }
}

/**
 * Start a new page.
 *
 * @param ctx - Streaming context
 * @param pageType - Type of the new page
 */
export function startNewPage(ctx: StreamingContext, pageType: PageTypeV2): void {
  // Continuation/Final pages use strip height; First/Single use full banner height
  const isFirstOrSingle = pageType === 'FIRST' || pageType === 'SINGLE'
  const bannerHeight = isFirstOrSingle
    ? computeBannerHeight(ctx.template, ctx.selection)
    : computeStripHeight(ctx.template, ctx.selection)
  // For showTitleBar templates, title region is shown when showMenuTitle is true (user-controlled)
  const showMenuTitle = ctx.template.banner?.showTitleBar === true
    ? ctx.selection?.showMenuTitle === true
    : (bannerHeight === 0 && ctx.selection?.showMenuTitle === true)
  const headerHeight = resolveHeaderRegionHeight(ctx.template, ctx.selection, bannerHeight)
  const regions = calculateRegions(ctx.pageSpec, ctx.template, showMenuTitle, bannerHeight, {
    headerHeightOverride: headerHeight,
  })
  applyBannerBodyPadding(regions, ctx.template, ctx.selection)
  applyBodyTopPadding(regions, ctx.selection)
  
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
 * Place static tiles (logo, title, banner/strip) on a page based on page type.
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
  const hasBanner = !!ctx.currentPage.regions.find(r => r.id === 'banner')

  // For showTitleBar templates, title region is shown when showMenuTitle is true (user-controlled)
  const showMenuTitle = ctx.template.banner?.showTitleBar === true
    ? ctx.selection?.showMenuTitle === true
    : (!hasBanner && ctx.selection?.showMenuTitle === true)
  if (showMenuTitle) {
    // For showTitleBar templates, use the banner title text ("MENU" etc) not the menu name
    const titleText = ctx.template.banner?.showTitleBar === true
      ? (ctx.selection?.bannerTitle?.trim() || 'MENU')
      : menu.name
    const titleTile = createTitleTile(menu, ctx.template, titleText)
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

  // Place banner or banner strip when enabled
  const bannerRegion = ctx.currentPage.regions.find(r => r.id === 'banner')
  if (bannerRegion) {
    const { surfaceColor, textColor } = getBannerColors(ctx.selection)
    const isFirstOrSingle = pageType === 'FIRST' || pageType === 'SINGLE'

    if (isFirstOrSingle) {
      // Full banner on FIRST/SINGLE pages
      const flagshipItem = findFlagshipItem(menu)
      const bannerTile = createBannerTile(
        menu,
        ctx.selection ?? {},
        bannerRegion.height,
        surfaceColor,
        textColor,
        flagshipItem
      )
      const placedBanner = placeTile(
        ctx,
        ctx.currentPage,
        { ...bannerTile, width: bannerRegion.width },
        bannerRegion,
        ctx.template
      )
      logPlacement(ctx, 'placed', placedBanner.id, 'Static banner tile')
    } else {
      // Banner strip on CONTINUATION/FINAL pages
      const stripTile = createBannerStripTile(menu, bannerRegion.height, surfaceColor)
      const placedStrip = placeTile(
        ctx,
        ctx.currentPage,
        { ...stripTile, width: bannerRegion.width },
        bannerRegion,
        ctx.template
      )
      logPlacement(ctx, 'placed', placedStrip.id, 'Static banner strip tile')
    }
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
    // Use the same blended surface color as the banner so footer matches
    const { surfaceColor: footerSurfaceColor } = bannerRegion ? getBannerColors(ctx.selection) : { surfaceColor: undefined }
    const footerTile = createFooterInfoTile(menu, ctx.template, footerSurfaceColor)
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

interface GridPosition {
  row: number
  col: number
}

function createPlacementGrid(maxRows: number, cols: number, startRow: number): boolean[][] {
  const grid = Array.from({ length: maxRows }, () => Array(cols).fill(false))

  for (let row = 0; row < startRow && row < maxRows; row++) {
    grid[row].fill(true)
  }

  return grid
}

function isGridAreaEmpty(
  grid: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): boolean {
  const maxRows = grid.length
  const cols = grid[0]?.length ?? 0

  if (row < 0 || col < 0 || row + rowSpan > maxRows || col + colSpan > cols) {
    return false
  }

  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (grid[r][c]) {
        return false
      }
    }
  }

  return true
}

function markGridAreaOccupied(
  grid: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): void {
  for (let r = row; r < row + rowSpan && r < grid.length; r++) {
    for (let c = col; c < col + colSpan && c < grid[0].length; c++) {
      grid[r][c] = true
    }
  }
}

function findNextGridPosition(
  grid: boolean[][],
  startRow: number,
  tile: Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'>
): GridPosition | null {
  const cols = grid[0]?.length ?? 0

  for (let row = startRow; row < grid.length; row++) {
    for (let col = 0; col <= cols - tile.colSpan; col++) {
      if (isGridAreaEmpty(grid, row, col, tile.rowSpan, tile.colSpan)) {
        return { row, col }
      }
    }
  }

  return null
}

function getSectionStartRow(ctx: StreamingContext): number {
  return ctx.currentCol === 0 ? ctx.currentRow : ctx.currentRow + ctx.currentRowMaxSpan
}

function countLeadRowFollowers(
  leadRow: ReturnType<typeof buildSectionPlans>[number]['leadRow']
): number {
  return [...leadRow.chosenTiles, ...leadRow.queuedTiles].filter(
    candidate => candidate.kind === 'flagship' || candidate.kind === 'item'
  ).length
}

function canPlaceLeadRowWithFollowers(
  ctx: StreamingContext,
  leadRow: ReturnType<typeof buildSectionPlans>[number]['leadRow']
): boolean {
  const hasHeader = leadRow.candidates.some(candidate => candidate.kind === 'header')
  const keepWithNext = hasHeader ? ctx.template.policies.sectionHeaderKeepWithNextItems : 0
  const totalFollowers = countLeadRowFollowers(leadRow)
  const requiredFollowers = Math.min(keepWithNext, totalFollowers)
  const bodyRegion = getBodyRegion(ctx.currentPage.regions)
  const { cols, rowHeight, gapY } = ctx.template.body.container
  const maxRows = calculateMaxRows(bodyRegion.height, rowHeight, gapY)
  const startRow = getSectionStartRow(ctx)
  const grid = createPlacementGrid(maxRows, cols, startRow)
  const candidates = [...leadRow.chosenTiles, ...leadRow.queuedTiles]
  let followersPlaced = 0

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]
    const position = findNextGridPosition(grid, startRow, candidate.tile)

    if (!position) {
      return false
    }

    markGridAreaOccupied(grid, position.row, position.col, candidate.tile.rowSpan, candidate.tile.colSpan)

    if (candidate.kind === 'flagship' || candidate.kind === 'item') {
      followersPlaced++
    }

    const allLeadTilesPlaced = index + 1 >= leadRow.chosenTiles.length
    if (allLeadTilesPlaced && followersPlaced >= requiredFollowers) {
      return true
    }
  }

  return leadRow.chosenTiles.length === 0 || followersPlaced >= requiredFollowers
}

function placeTileAtGridPosition(
  ctx: StreamingContext,
  tile: Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'>,
  bodyRegion: RegionV2,
  row: number,
  col: number
): TileInstanceV2 {
  ctx.currentRow = row
  ctx.currentCol = col
  ctx.currentRowMaxSpan = 1
  ctx.currentRowTiles = []

  return placeTile(ctx, ctx.currentPage, tile, bodyRegion, ctx.template)
}

function placeCandidateTilesOnPage(
  ctx: StreamingContext,
  bodyRegion: RegionV2,
  candidates: Array<ReturnType<typeof buildSectionPlans>[number]['leadRow']['chosenTiles'][number]>,
  startRow: number
): { placedCount: number; lastRowEnd: number } {
  const { cols, rowHeight, gapY } = ctx.template.body.container
  const maxRows = calculateMaxRows(bodyRegion.height, rowHeight, gapY)
  const grid = createPlacementGrid(maxRows, cols, startRow)
  let lastRowEnd = startRow
  let searchRowFloor = startRow

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]
    const position = findNextGridPosition(grid, searchRowFloor, candidate.tile)

    if (!position) {
      return {
        placedCount: index,
        lastRowEnd,
      }
    }

    const placedTile = placeTileAtGridPosition(ctx, candidate.tile, bodyRegion, position.row, position.col)
    logPlacement(ctx, 'placed', placedTile.id, `Section tile (${candidate.kind})`)
    markGridAreaOccupied(grid, position.row, position.col, candidate.tile.rowSpan, candidate.tile.colSpan)
    lastRowEnd = Math.max(lastRowEnd, position.row + candidate.tile.rowSpan)

    const isFullWidthHeader = candidate.kind === 'header' && candidate.tile.colSpan >= cols
    if (isFullWidthHeader) {
      searchRowFloor = position.row + candidate.tile.rowSpan
    }
  }

  return {
    placedCount: candidates.length,
    lastRowEnd,
  }
}

function placeSectionPlan(
  ctx: StreamingContext,
  menu: EngineMenuV2,
  sectionPlan: ReturnType<typeof buildSectionPlans>[number],
  bodyRegion: RegionV2
): RegionV2 {
  let targetBodyRegion = bodyRegion
  let pendingCandidates = [...sectionPlan.leadRow.chosenTiles, ...sectionPlan.leadRow.queuedTiles]
  let sectionStarted = false
  const showCategoryTitles = ctx.selection?.showCategoryTitles !== false

  while (pendingCandidates.length > 0) {
    if (!sectionStarted && !canPlaceLeadRowWithFollowers(ctx, sectionPlan.leadRow)) {
      finalizePage(ctx)
      startNewPage(ctx, 'CONTINUATION')
      placeStaticTiles(ctx, menu, 'CONTINUATION')
      targetBodyRegion = getBodyRegion(ctx.currentPage.regions)
      continue
    }

    const continuationPrefix = sectionStarted &&
      ctx.template.policies.repeatSectionHeaderOnContinuation &&
      showCategoryTitles
      ? buildContinuationLeadRowPlan(sectionPlan.section, ctx.template, ctx.selection).chosenTiles
      : []

    const startRow = getSectionStartRow(ctx)
    const pageCandidates = [...continuationPrefix, ...pendingCandidates]
    const { placedCount, lastRowEnd } = placeCandidateTilesOnPage(
      ctx,
      targetBodyRegion,
      pageCandidates,
      startRow
    )
    const pendingPlacedCount = Math.max(0, placedCount - continuationPrefix.length)

    if (pendingPlacedCount > 0 || (!sectionStarted && placedCount > 0)) {
      sectionStarted = true
    }

    pendingCandidates = pendingCandidates.slice(pendingPlacedCount)

    if (placedCount === pageCandidates.length) {
      ctx.currentRow = lastRowEnd
      ctx.currentCol = 0
      ctx.currentRowMaxSpan = 1
      ctx.currentRowTiles = []
      return targetBodyRegion
    }

    finalizePage(ctx)
    startNewPage(ctx, 'CONTINUATION')
    placeStaticTiles(ctx, menu, 'CONTINUATION')
    targetBodyRegion = getBodyRegion(ctx.currentPage.regions)
  }

  return targetBodyRegion
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
  let bodyRegion = getBodyRegion(ctx.currentPage.regions)
  
  // Place static tiles on first page
  placeStaticTiles(ctx, menu, 'FIRST')
  const sectionPlans = buildSectionPlans(menu, template, selection)
  const fillersEnabled = ctx.selection?.fillersEnabled ?? template.filler.enabled

  for (const sectionPlan of sectionPlans) {
    if (ctx.currentCol !== 0) {
      advanceToNextRow(ctx, ctx.currentRowMaxSpan)
    }

    if (sectionPlan.hasDividerBefore) {
      const dividerTile = createDividerTile(sectionPlan.section.id, template)

      if (ctx.currentCol !== 0) {
        advanceToNextRow(ctx, ctx.currentRowMaxSpan)
      }

      if (!fitsInCurrentPage(ctx, dividerTile.height, dividerTile.colSpan)) {
        finalizePage(ctx)
        startNewPage(ctx, 'CONTINUATION')
        placeStaticTiles(ctx, menu, 'CONTINUATION')
        bodyRegion = getBodyRegion(ctx.currentPage.regions)
      }

      const placedDivider = placeTile(ctx, ctx.currentPage, dividerTile, bodyRegion, template)
      logPlacement(ctx, 'placed', placedDivider.id, 'Section divider')
      advanceToNextRow(ctx, dividerTile.rowSpan)
    }

    bodyRegion = placeSectionPlan(ctx, menu, sectionPlan, bodyRegion)

    const spacerTilePatternId = ctx.selection?.spacerTilePatternId || template.filler.tiles[0]?.id
    const hasSpacers = fillersEnabled && spacerTilePatternId !== 'none'

    if (!hasSpacers && ctx.selection?.centreAlignment) {
      applySectionLastRowCentering(ctx.pages, sectionPlan.section.id, template)
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