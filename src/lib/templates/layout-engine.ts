/**
 * GridMenu Template Engine - Layout Engine
 * 
 * Core layout generation engine that combines menu data with template definitions
 * to produce deterministic layout instances.
 * 
 * The engine follows these steps:
 * 1. Normalize menu data
 * 2. Evaluate constraints (compatibility check)
 * 3. Calculate capacity and required repeats
 * 4. Assign items to tiles
 * 5. Fill static tiles
 * 6. Insert filler tiles (if enabled)
 * 7. Generate pages
 * 8. Return LayoutInstance
 */

import type {
  LayoutEngineInput,
  LayoutInstance,
  PageLayout,
  TileContentInstance,
  MenuItemTileInstance,
  StaticTileInstance,
  TileDefinition,
  EngineMenu,
  EngineItem,
  MenuTemplate,
  MenuTemplateSelection,
  CompatibilityResult,
  PageType
} from './engine-types'
import { EngineMenuSchema } from './engine-types'
import { TEMPLATE_ENGINE_CONFIG } from './engine-config'
import { checkCompatibility } from './compatibility-checker'
import { CompatibilityError, LayoutGenerationError, MenuValidationError } from './engine-errors'

/**
 * Generate a layout instance from menu data and template definition
 * 
 * This is the main entry point for the layout engine. It takes normalized menu data,
 * a template definition, and optional selection configuration, and produces a complete
 * layout instance ready for rendering.
 * 
 * The function is deterministic: given the same inputs, it will always produce
 * the same output. This ensures consistent previews and exports.
 * 
 * @param input - Layout engine input containing menu, template, and optional selection
 * @returns Complete layout instance with positioned tiles across pages
 * @throws {MenuValidationError} If menu data is invalid
 * @throws {CompatibilityError} If template is incompatible with menu
 * @throws {LayoutGenerationError} If layout generation fails
 * 
 * @example
 * ```typescript
 * import { generateLayout } from '@/lib/templates/layout-engine'
 * import { toEngineMenu } from '@/lib/templates/menu-transformer'
 * import { CLASSIC_GRID_CARDS } from '@/lib/templates/template-definitions'
 * 
 * // Convert database menu to engine format
 * const engineMenu = toEngineMenu(databaseMenu)
 * 
 * // Generate layout
 * const layout = generateLayout({
 *   menu: engineMenu,
 *   template: CLASSIC_GRID_CARDS
 * })
 * 
 * // Use layout for rendering
 * console.log(`Generated ${layout.pages.length} page(s)`)
 * layout.pages[0].tiles.forEach(tile => {
 *   console.log(`Tile ${tile.id} at (${tile.col}, ${tile.row})`)
 * })
 * ```
 * 
 * @example
 * ```typescript
 * // With text-only configuration
 * const layout = generateLayout({
 *   menu: engineMenu,
 *   template: CLASSIC_GRID_CARDS,
 *   selection: {
 *     id: 'sel-1',
 *     menuId: engineMenu.id,
 *     templateId: CLASSIC_GRID_CARDS.id,
 *     templateVersion: CLASSIC_GRID_CARDS.version,
 *     configuration: { textOnly: true, useLogo: false },
 *     createdAt: new Date(),
 *     updatedAt: new Date()
 *   }
 * })
 * ```
 */
export function generateLayout(input: LayoutEngineInput): LayoutInstance {
  // Step 1: Validate input
  validateInput(input)
  
  // Step 2: Normalize menu (already normalized, but ensure consistency)
  const normalizedMenu = normalizeMenu(input.menu)
  
  // Step 3: Evaluate constraints
  const compatibility = evaluateConstraints(normalizedMenu, input.template)
  
  // Step 4: Calculate capacity
  const capacity = calculateCapacity(normalizedMenu, input.template)
  
  // Step 5: Assign items to tiles
  const tiles = assignItemsToTiles(normalizedMenu, input.template, input.selection, capacity)
  
  // Step 6: Fill static tiles
  const tilesWithStatic = fillStaticTiles(tiles, normalizedMenu, input.template)
  
  // Step 7: Insert filler tiles (if enabled)
  const tilesWithFillers = insertFillerTiles(tilesWithStatic, input.template)
  
  // Step 8: Generate pages
  const pages = generatePages(tilesWithFillers, input.template, capacity)
  
  // Step 9: Return layout instance
  return {
    templateId: input.template.id,
    templateVersion: input.template.version,
    orientation: input.template.orientation,
    pages
  }
}

/**
 * Validate layout engine input
 */
function validateInput(input: LayoutEngineInput): void {
  if (!input.menu) {
    throw new MenuValidationError('Menu is required')
  }
  
  if (!input.template) {
    throw new LayoutGenerationError('Template is required')
  }
  
  // Validate menu against schema
  try {
    EngineMenuSchema.parse(input.menu)
  } catch (error) {
    throw new MenuValidationError(
      'Invalid menu data',
      { zodError: error }
    )
  }
}

/**
 * Normalize menu data
 * 
 * Ensures menu data is in the expected format:
 * - Flat menus have an implicit "Menu" section
 * - Sections and items are sorted by sortOrder
 */
function normalizeMenu(menu: EngineMenu): EngineMenu {
  // Menu should already be normalized by toEngineMenu, but ensure sorting
  return {
    ...menu,
    sections: menu.sections
      .map(section => ({
        ...section,
        items: [...section.items].sort((a, b) => a.sortOrder - b.sortOrder)
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
}

/**
 * Evaluate constraints and check compatibility
 * 
 * Calls the compatibility checker and throws if template is incompatible.
 * Warnings are allowed to proceed.
 */
function evaluateConstraints(
  menu: EngineMenu,
  template: MenuTemplate
): CompatibilityResult {
  const compatibility = checkCompatibility(menu, template)
  
  if (compatibility.status === 'INCOMPATIBLE') {
    throw new CompatibilityError(
      compatibility.message || 'Template is incompatible with menu',
      { compatibility }
    )
  }
  
  return compatibility
}

/**
 * Calculate template capacity and required repeats
 */
interface CapacityInfo {
  baseItemTileCount: number
  repeatItemTileCount: number
  capacityFirstPage: number
  capacityContinuationPage: number
  totalCapacity: number
  requiredRepeats: number
  totalPages: number
}

/**
 * Check if a tile is visible on a specific page type
 */
function isTileVisible(tileDef: TileDefinition, pageType: PageType): boolean {
  if (!tileDef.options?.visibility) return true
  
  const { showOn, hideOn } = tileDef.options.visibility
  
  // strict allow list
  if (showOn && !showOn.includes(pageType)) return false
  
  // strict deny list
  if (hideOn && hideOn.includes(pageType)) return false
  
  return true
}

function calculateCapacity(
  menu: EngineMenu,
  template: MenuTemplate
): CapacityInfo {
  // Count total items in menu
  const totalItems = menu.sections.reduce(
    (sum, section) => sum + section.items.length,
    0
  )
  
  // Count ITEM/ITEM_TEXT_ONLY tiles in base layout (First/Single Page)
  // These are tiles that are effectively visible on the first page
  const baseItemTiles = template.layout.tiles.filter(
    tile => (tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') && 
            isTileVisible(tile, 'FIRST') // Check against 'FIRST' for base capacity
  )
  const baseItemTileCount = baseItemTiles.length
  
  // Count ITEM tiles in repeat pattern
  // Repeat items are typically for continuation pages
  const repeatItemTileCount = template.layout.repeatPattern
    ? template.layout.repeatPattern.repeatItemTileIds.length
    : 0
  
  const capacityFirstPage = baseItemTileCount
  const capacityContinuationPage = repeatItemTileCount
  
  // Calculate required repeats
  // If we fit in first page, repeats = 0
  // Else, we fill first page, then fill continuation pages
  let requiredRepeats = 0
  if (totalItems > capacityFirstPage) {
    if (capacityContinuationPage > 0) {
      const remainingItems = totalItems - capacityFirstPage
      requiredRepeats = Math.ceil(remainingItems / capacityContinuationPage)
      
      // Enforce maxRepeats limit
      const maxRepeats = template.layout.repeatPattern?.maxRepeats || 
                         TEMPLATE_ENGINE_CONFIG.maxRepeatsDefault
      requiredRepeats = Math.min(requiredRepeats, maxRepeats)
    } else {
      // No capacity for extra items? 
      // Current behavior: they just don't get rendered if we have no repeats
      // or if logic falls back to extending without repeats?
      // Assuming 0 if no continuation capacity
      requiredRepeats = 0
    }
  }
  
  // Calculate total capacity
  const totalCapacity = capacityFirstPage + (requiredRepeats * capacityContinuationPage)
  
  // Calculate total pages
  // If newPagePerRepeat is true, each repeat is a page + the first page
  // If false, it's effectively 1 long page (or just 1 page if we treat it as SINGLE)
  // For the purpose of "PageType", if newPagePerRepeat is false, we might still want to
  // know if we are in "Single" or "Extended" mode.
  // But strictly, totalPages for pagination:
  const newPagePerRepeat = template.layout.repeatPattern?.newPagePerRepeat || false
  const totalPages = newPagePerRepeat 
    ? (requiredRepeats > 0 ? requiredRepeats + 1 : 1) 
    : 1
  
  return {
    baseItemTileCount,
    repeatItemTileCount,
    capacityFirstPage,
    capacityContinuationPage,
    totalCapacity,
    requiredRepeats,
    totalPages
  }
}

/**
 * Assign menu items to tiles
 * 
 * This function:
 * - Flattens menu into ordered items array
 * - Handles templates with sectionSlots
 * - Fills ITEM tiles in reading order (row-major)
 * - Inserts SECTION_HEADER tiles where defined
 * - Respects textOnly configuration
 */
function assignItemsToTiles(
  menu: EngineMenu,
  template: MenuTemplate,
  selection: MenuTemplateSelection | undefined,
  capacity: CapacityInfo
): TileContentInstance[] {
  const tiles: TileContentInstance[] = []
  const textOnly = selection?.configuration?.textOnly || false
  
  // Get all ITEM/ITEM_TEXT_ONLY tiles from base layout
  // Filter by visibility (must be visible on FIRST page to be considered a base slot)
  const baseItemTiles = template.layout.tiles.filter(
    tile => (tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') &&
            isTileVisible(tile, 'FIRST')
  ).sort((a, b) => {
    // Sort by row first, then column (reading order)
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  
  // Determine if template uses text-only tiles by checking base layout
  const templateUsesTextOnly = baseItemTiles.length > 0 && 
                                baseItemTiles.every(t => t.type === 'ITEM_TEXT_ONLY')
  
  // Check if template uses section slots
  // A template uses section slots if it has multiple distinct section slots defined
  const sectionSlots = new Set(
    template.layout.tiles
      .filter(tile => tile.sectionSlot !== undefined)
      .map(tile => tile.sectionSlot)
  )
  const usesSectionSlots = sectionSlots.size > 1
  
  if (usesSectionSlots) {
    // Handle templates with section slots
    tiles.push(...assignItemsWithSectionSlots(menu, template, baseItemTiles, textOnly, templateUsesTextOnly, capacity))
  } else {
    // Handle templates without section slots (flat assignment)
    tiles.push(...assignItemsFlat(menu, template, baseItemTiles, textOnly, templateUsesTextOnly, capacity))
  }
  
  return tiles
}

/**
 * Assign items for templates with section slots
 */
function assignItemsWithSectionSlots(
  menu: EngineMenu,
  template: MenuTemplate,
  baseItemTiles: TileDefinition[],
  textOnly: boolean,
  templateUsesTextOnly: boolean,
  capacity: CapacityInfo
): TileContentInstance[] {
  const tiles: TileContentInstance[] = []
  
  // Group tiles by section slot
  const tilesBySlot = new Map<number, typeof baseItemTiles>()
  baseItemTiles.forEach(tile => {
    const slot = tile.sectionSlot ?? 0
    if (!tilesBySlot.has(slot)) {
      tilesBySlot.set(slot, [])
    }
    tilesBySlot.get(slot)!.push(tile)
  })
  
  // Check if we have more sections than slots
  const maxSlot = Math.max(...Array.from(tilesBySlot.keys()))
  if (menu.sections.length > maxSlot + 1) {
    throw new LayoutGenerationError(
      `Menu has ${menu.sections.length} sections but template only supports ${maxSlot + 1} section slots`,
      { sectionCount: menu.sections.length, maxSlot }
    )
  }
  
  // Assign items for each section
  menu.sections.forEach((section, sectionIndex) => {
    const slotTiles = tilesBySlot.get(sectionIndex) || []
    
    // Add section header if defined
    const sectionHeaderTile = template.layout.tiles.find(
      tile => tile.type === 'SECTION_HEADER' && 
              tile.sectionSlot === sectionIndex &&
              isTileVisible(tile, 'FIRST')
    )
    if (sectionHeaderTile) {
      tiles.push({
        id: `${sectionHeaderTile.id}-${section.id}`,
        type: 'SECTION_HEADER',
        col: sectionHeaderTile.col,
        row: sectionHeaderTile.row,
        colSpan: sectionHeaderTile.colSpan,
        rowSpan: sectionHeaderTile.rowSpan,
        label: section.name,
        sectionId: section.id,
        options: sectionHeaderTile.options
      })
    }
    
    // Assign items to tiles in this slot
    section.items.forEach((item, itemIndex) => {
      if (itemIndex < slotTiles.length) {
        const tileDef = slotTiles[itemIndex]
        tiles.push(createMenuItemTile(tileDef, item, section.id, textOnly))
      }
    })
  })
  
  return tiles
}

/**
 * Assign items for templates without section slots (flat assignment)
 */
/**
 * Assign items for templates without section slots (flat assignment)
 */
function assignItemsFlat(
  menu: EngineMenu,
  template: MenuTemplate,
  baseItemTiles: TileDefinition[],
  textOnly: boolean,
  templateUsesTextOnly: boolean,
  capacity: CapacityInfo
): TileContentInstance[] {
  const tiles: TileContentInstance[] = []
  const baseCols = template.layout.baseCols
  const repeatPattern = template.layout.repeatPattern
  const baseRows = template.layout.baseRows
  const rowsPerRepeat = repeatPattern?.rowsPerRepeat ?? baseRows
  
  // Find template for headers and items
  const headerTemplate = template.layout.tiles.find(t => t.type === 'SECTION_HEADER' && isTileVisible(t, 'FIRST'))
  const firstItemTile = baseItemTiles[0]
  if (!firstItemTile) return []

  // Check if template has a footer that might occupy the bottom row
  const hasFooter = template.layout.tiles.some(t => t.type === 'TEXT_BLOCK' && t.id.includes('footer'))

  let currentPageIndex = 0
  let localCol = 0
  // Start items/headers at the template's defined header row, or where items start
  let localRow = headerTemplate ? headerTemplate.row : firstItemTile.row

  // Helper to calculate virtual row
  const getVirtualRow = (pIdx: number, lRow: number) => {
    if (pIdx === 0) return lRow
    return baseRows + (pIdx - 1) * rowsPerRepeat + lRow
  }

  // Calculate the vertical offset for continuation pages
  const repeatStartOffset = (repeatPattern?.fromRow ?? baseRows) - baseRows

  // Helper to advance to next page
  const advancePage = () => {
    currentPageIndex++
    localCol = 0
    localRow = 0 // Continuation pages start items at local row 0
  }

  // Track the absolute last virtual row used to prevent any overlaps
  let lastUsedVirtualRow = -1

  // Iterate by section to ensure all categories are captured in order
  menu.sections.forEach(section => {
    // 1. Move to next row if we were mid-row from previous section
    if (localCol > 0) {
      localCol = 0
      localRow++
    }

    // 2. Check for page overflow before placing header
    // Continuation pages have less available rows due to the repeatStartOffset (cloned logo space)
    // and we reserve the last row for the footer if it exists.
    const rowLimit = (currentPageIndex === 0) 
      ? baseRows 
      : (baseRows - repeatStartOffset)
    
    // Reserve 1 row for footer at the bottom of the page budget
    const effectiveRowLimit = hasFooter ? rowLimit - 1 : rowLimit

    if (localRow >= effectiveRowLimit) { 
      advancePage()
    }

    // 3. Place Section Header
    if (headerTemplate) {
      const vRow = getVirtualRow(currentPageIndex, localRow)
      
      // Safety check: ensure we don't overlap with previous tiles
      if (vRow <= lastUsedVirtualRow) {
        localRow++
        // Re-check overflow after increment
        const currentLimit = (currentPageIndex === 0) ? baseRows : (baseRows - repeatStartOffset)
        const currentEffectiveLimit = hasFooter ? currentLimit - 1 : currentLimit
        if (localRow >= currentEffectiveLimit) {
          advancePage()
        }
      }

      const finalVRow = getVirtualRow(currentPageIndex, localRow)
      tiles.push({
        id: `${headerTemplate.id}-${section.id}-p${currentPageIndex}`,
        type: 'SECTION_HEADER',
        col: 0,
        row: finalVRow,
        colSpan: baseCols,
        rowSpan: 1,
        label: section.name,
        sectionId: section.id,
        options: headerTemplate.options
      })
      lastUsedVirtualRow = finalVRow
      localRow++
    }

    // 4. Place Items
    section.items.forEach(item => {
      // Check for page overflow before placing item
      const currentLimit = (currentPageIndex === 0) ? baseRows : (baseRows - repeatStartOffset)
      const currentEffectiveLimit = hasFooter ? currentLimit - 1 : currentLimit
      
      if (localRow >= currentEffectiveLimit) {
        advancePage()
        // If we overflow mid-section, repeat the header
        if (headerTemplate) {
          const vRow = getVirtualRow(currentPageIndex, localRow)
          tiles.push({
            id: `${headerTemplate.id}-${section.id}-cont-p${currentPageIndex}`,
            type: 'SECTION_HEADER',
            col: 0,
            row: vRow,
            colSpan: baseCols,
            rowSpan: 1,
            label: section.name, 
            sectionId: section.id,
            options: headerTemplate.options
          })
          lastUsedVirtualRow = vRow
          localRow++
        }
      }

      const itemVRow = getVirtualRow(currentPageIndex, localRow)
      tiles.push({
        ...createMenuItemTile(firstItemTile, item, section.id, textOnly),
        col: localCol,
        row: itemVRow,
        colSpan: firstItemTile.colSpan,
        rowSpan: firstItemTile.rowSpan
      })
      lastUsedVirtualRow = Math.max(lastUsedVirtualRow, itemVRow)

      localCol += firstItemTile.colSpan
      if (localCol >= baseCols) {
        localCol = 0
        localRow += firstItemTile.rowSpan
      }
    })
  })

  return tiles
}

/**
 * Create a menu item tile instance from a tile definition and item
 * 
 * Note: `showImage` indicates whether the tile SUPPORTS images (based on template/config),
 * not whether an image is actually available. This allows renderers to show fallback
 * visuals when the template expects images but the item doesn't have one.
 */
function createMenuItemTile(
  tileDef: TileDefinition,
  item: EngineItem,
  sectionId: string,
  textOnly: boolean
): MenuItemTileInstance {
  // If template definition specifies ITEM_TEXT_ONLY, respect that
  if (tileDef.type === 'ITEM_TEXT_ONLY') {
    return {
      id: `${tileDef.id}-${item.id}`,
      type: 'ITEM_TEXT_ONLY',
      col: tileDef.col,
      row: tileDef.row,
      colSpan: tileDef.colSpan,
      rowSpan: tileDef.rowSpan,
      itemId: item.id,
      sectionId,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: undefined, // Never pass imageUrl for ITEM_TEXT_ONLY
      showImage: false, // Never show images for ITEM_TEXT_ONLY
      options: tileDef.options
    }
  }
  
  // Tile supports images if: not text-only mode, tile type is ITEM, and showImage option is not disabled
  const tileSupportsImages = !textOnly && 
                              tileDef.type === 'ITEM' && 
                              tileDef.options?.showImage !== false
  
  // Tile has an actual image available
  const hasImage = tileSupportsImages && !!item.imageUrl
  
  return {
    id: `${tileDef.id}-${item.id}`,
    type: hasImage ? 'ITEM' : 'ITEM_TEXT_ONLY',
    col: tileDef.col,
    row: tileDef.row,
    colSpan: tileDef.colSpan,
    rowSpan: tileDef.rowSpan,
    itemId: item.id,
    sectionId,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl, // Always pass imageUrl if available
    showImage: tileSupportsImages, // Indicates tile supports images (for fallback rendering)
    options: tileDef.options
  }
}

/**
 * Fill static tiles (TITLE, LOGO, TEXT_BLOCK, etc.)
 * 
 * This function fills in static content tiles:
 * - TITLE: Menu name
 * - LOGO: Placeholder text/icon (future: menu.metadata.logoUrl)
 * - TEXT_BLOCK: Venue address or other metadata
 * - IMAGE_DECORATION: Decorative pattern reference
 * - QR_CODE: Placeholder (post-MVP: integrate with existing QR functionality)
 */
function fillStaticTiles(
  tiles: TileContentInstance[],
  menu: EngineMenu,
  template: MenuTemplate
): TileContentInstance[] {
  const staticTiles: TileContentInstance[] = []
  
  // Find all static tile definitions in the template
  const staticTileDefs = template.layout.tiles.filter(
    tile => tile.type === 'TITLE' || 
            tile.type === 'LOGO' || 
            tile.type === 'TEXT_BLOCK' || 
            tile.type === 'IMAGE_DECORATION' ||
            tile.type === 'QR_CODE'
  )
  
  // Create static tile instances
  staticTileDefs.forEach(tileDef => {
    let content = ''
    let logoUrl: string | undefined
    
    switch (tileDef.type) {
      case 'TITLE':
        content = menu.name
        break
        
      case 'LOGO':
        // Use venue/menu name as fallback text and pass through logo URL when available
        content = menu.metadata.venueName || menu.name
        logoUrl = menu.metadata.logoUrl
        break
        
      case 'TEXT_BLOCK':
        // Use venue address if available, otherwise empty
        content = menu.metadata.venueAddress || ''
        break
        
      case 'IMAGE_DECORATION':
        // Reference to decorative pattern
        // The rendering layer will handle the actual pattern
        content = tileDef.options?.decorativeVariant || 'default'
        break
        
      case 'QR_CODE':
        // MVP: Placeholder
        // Post-MVP: Integrate with existing QR functionality
        content = 'QR (coming soon)'
        break
    }
    
    staticTiles.push({
      id: tileDef.id,
      type: tileDef.type as StaticTileInstance['type'],
      col: tileDef.col,
      row: tileDef.row,
      colSpan: tileDef.colSpan,
      rowSpan: tileDef.rowSpan,
      content,
      ...(logoUrl ? { logoUrl } : {}),
      options: tileDef.options
    })
  })
  
  // Combine with existing tiles
  return [...tiles, ...staticTiles]
}

/**
 * Insert filler tiles in empty grid spaces
 * 
 * This is a placeholder for now - will be implemented in Task 6 (post-MVP)
 */
function insertFillerTiles(
  tiles: TileContentInstance[],
  template: MenuTemplate
): TileContentInstance[] {
  // TODO: Implement in Task 6 (post-MVP)
  // For MVP, just return tiles as-is
  return tiles
}

/**
 * Balance items on the last row of a page
 */
function balancePageLayout(
  page: PageLayout,
  template: MenuTemplate
): void {
  // Only balance if strategy is set
  if (!template.balancingStrategy || template.balancingStrategy === 'left') {
    return
  }
  
  // Find all ITEM tiles on this page
  const itemTiles = page.tiles.filter(
    t => t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY'
  )
  
  if (itemTiles.length === 0) return
  
  // Group by row to find the last row
  const rows = new Map<number, TileContentInstance[]>()
  itemTiles.forEach(tile => {
    if (!rows.has(tile.row)) {
      rows.set(tile.row, [])
    }
    rows.get(tile.row)!.push(tile)
  })
  
  // Find max row index
  const maxRow = Math.max(...Array.from(rows.keys()))
  const lastRowTiles = rows.get(maxRow) || []
  
  // Calculate grid capacity
  // Assuming standard grid where 1 col = 1 unit
  // We need to know the 'width' of the grid. 
  // template.layout.baseCols tells us total columns.
  const gridCols = template.layout.baseCols
  
  // Calculate width occupied by items in last row
  const occupiedWidth = lastRowTiles.reduce((sum, t) => sum + t.colSpan, 0)
  
  // If row is full, nothing to balance
  if (occupiedWidth >= gridCols) return
  
  // Calculate offset to center
  // floor((Total - Occupied) / 2)
  const offset = Math.floor((gridCols - occupiedWidth) / 2)
  
  if (offset <= 0) return
  
  // Apply offset
  lastRowTiles.forEach(tile => {
    tile.col += offset
  })
}

/**
 * Generate pages from tiles
 * 
 * This function:
 * - Creates single page or multiple pages based on newPagePerRepeat
 * - Groups tiles by page based on row positions
 * - Assigns PageTypes (FIRST, CONTINUATION, FINAL, SINGLE)
 * - Filters tiles based on visibility rules
 * - Normalizes row coordinates for multi-page layouts
 * - Balances the last row of items
 */
function generatePages(
  tiles: TileContentInstance[],
  template: MenuTemplate,
  capacity: CapacityInfo
): PageLayout[] {
  const pages: PageLayout[] = []
  
  // Check if template uses multiple pages
  const newPagePerRepeat = template.layout.repeatPattern?.newPagePerRepeat || false
  
  // 1. Group tiles by initial page assignment (based on row)
  const tilesByPageIndex = new Map<number, TileContentInstance[]>()
  const repeatPattern = template.layout.repeatPattern
  const repeatStartRow = repeatPattern?.fromRow ?? template.layout.baseRows
  const rowsPerRepeat = repeatPattern?.rowsPerRepeat ?? 1
  const baseRows = template.layout.baseRows
  
  tiles.forEach(tile => {
    let pageIndex = 0
    
    // Determine page index based on row
    if (newPagePerRepeat && repeatPattern) {
      if (tile.row < baseRows) {
        pageIndex = 0
      } else {
        const rowInPage = tile.row - baseRows
        pageIndex = Math.floor(rowInPage / rowsPerRepeat) + 1
      }
    } else {
      // Single page or continuous flow
      pageIndex = 0
    }
    
    if (!tilesByPageIndex.has(pageIndex)) {
      tilesByPageIndex.set(pageIndex, [])
    }
    tilesByPageIndex.get(pageIndex)!.push(tile)
  })
  
  // 2. Determine total pages
  // Use capacity info if available, otherwise max index found
  const maxIndex = Math.max(0, ...Array.from(tilesByPageIndex.keys()))
  const calculatedTotalPages = Math.max(capacity.totalPages, maxIndex + 1)
  
  // 3. Construct pages
  for (let i = 0; i < calculatedTotalPages; i++) {
    // Determine PageType
    let pageType: PageType = 'CONTINUATION'
    if (calculatedTotalPages === 1) {
      pageType = 'SINGLE'
    } else if (i === 0) {
      pageType = 'FIRST'
    } else if (i === calculatedTotalPages - 1) {
      pageType = 'FINAL'
    }
    
    // Get tiles initially assigned to this page
    let pageTiles = tilesByPageIndex.get(i) || []
    
    // 4. Handle Static Tiles (Clone/Move)
    // If this is a continuation/final page, we might need to copy static tiles from Page 0
    if (i > 0) {
      // Find static tiles on Page 0 that should be shown on this page type
      const pageZeroTiles = tilesByPageIndex.get(0) || []
      const staticTilesToClone = pageZeroTiles.filter(t => 
        t.type !== 'ITEM' && 
        t.type !== 'ITEM_TEXT_ONLY' &&
        t.type !== 'SECTION_HEADER' && // Section headers usually stay with their items
        isTileVisible(template.layout.tiles.find(def => def.id === t.id)!, pageType)
      )
      
      // Clone them
      const clonedTiles = staticTilesToClone.map(t => ({...t, id: `${t.id}-p${i}`}))
      pageTiles = [...pageTiles, ...clonedTiles]
    }
    
    // 5. Filter tiles by visibility
    // (Remove tiles that are assigned here but hidden on this page type)
    pageTiles = pageTiles.filter(t => {
      // Find definition to check options
      // For items, the ID might be composite (tileId-itemId), so we need to find the base tile def
      // But we passed TileContentInstance. 
      // We can use the 'options' on the instance which were copied from definition!
      
      // Re-implement check using instance options
      if (!t.options?.visibility) return true
      const { showOn, hideOn } = t.options.visibility
      if (showOn && !showOn.includes(pageType)) return false
      if (hideOn && hideOn.includes(pageType)) return false
      return true
    })
    
    // 6. Normalize Rows
    // Shift rows so they start at 0 (or appropriate top margin) for the page
    if (i > 0 && newPagePerRepeat) {
      const pageStartRow = template.layout.baseRows + ((i - 1) * rowsPerRepeat)
      // Calculate the offset for continuation pages
      // This is the difference between where repeats start (fromRow) and the base layout height (baseRows)
      const repeatStartOffset = (repeatPattern?.fromRow ?? template.layout.baseRows) - template.layout.baseRows
      
      pageTiles.forEach(t => {
        // Only shift if it was originally after the base layout
        if (t.row >= template.layout.baseRows) {
           t.row = (t.row - pageStartRow) + repeatStartOffset
        }
        // Static tiles cloned from Page 0 already have low row numbers, so don't shift them
      })
    }
    
    const pageLayout: PageLayout = {
      pageIndex: i,
      type: pageType,
      tiles: pageTiles
    }
    
    // 7. Balance Layout
    balancePageLayout(pageLayout, template)
    
    pages.push(pageLayout)
  }
  
  return pages
}
