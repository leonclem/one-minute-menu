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
  CompatibilityResult
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
  totalCapacity: number
  requiredRepeats: number
  totalPages: number
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
  
  // Count ITEM/ITEM_TEXT_ONLY tiles in base layout
  const baseItemTiles = template.layout.tiles.filter(
    tile => tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY'
  )
  const baseItemTileCount = baseItemTiles.length
  
  // Count ITEM tiles in repeat pattern
  const repeatItemTileCount = template.layout.repeatPattern
    ? template.layout.repeatPattern.repeatItemTileIds.length
    : 0
  
  // Calculate required repeats
  let requiredRepeats = 0
  if (repeatItemTileCount > 0 && totalItems > baseItemTileCount) {
    const remainingItems = totalItems - baseItemTileCount
    requiredRepeats = Math.ceil(remainingItems / repeatItemTileCount)
    
    // Enforce maxRepeats limit
    const maxRepeats = template.layout.repeatPattern?.maxRepeats || 
                       TEMPLATE_ENGINE_CONFIG.maxRepeatsDefault
    requiredRepeats = Math.min(requiredRepeats, maxRepeats)
  }
  
  // Calculate total capacity
  const totalCapacity = baseItemTileCount + (requiredRepeats * repeatItemTileCount)
  
  // Calculate total pages
  const newPagePerRepeat = template.layout.repeatPattern?.newPagePerRepeat || false
  const totalPages = newPagePerRepeat ? requiredRepeats + 1 : 1
  
  return {
    baseItemTileCount,
    repeatItemTileCount,
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
  const baseItemTiles = template.layout.tiles.filter(
    tile => tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY'
  ).sort((a, b) => {
    // Sort by row first, then column (reading order)
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  
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
    tiles.push(...assignItemsWithSectionSlots(menu, template, baseItemTiles, textOnly, capacity))
  } else {
    // Handle templates without section slots (flat assignment)
    tiles.push(...assignItemsFlat(menu, template, baseItemTiles, textOnly, capacity))
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
      tile => tile.type === 'SECTION_HEADER' && tile.sectionSlot === sectionIndex
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
        tiles.push(createMenuItemTile(tileDef, item, textOnly))
      }
    })
  })
  
  return tiles
}

/**
 * Assign items for templates without section slots (flat assignment)
 */
function assignItemsFlat(
  menu: EngineMenu,
  template: MenuTemplate,
  baseItemTiles: TileDefinition[],
  textOnly: boolean,
  capacity: CapacityInfo
): TileContentInstance[] {
  const tiles: TileContentInstance[] = []
  
  // Flatten all items from all sections
  const allItems: Array<{ section: typeof menu.sections[0], item: typeof menu.sections[0]['items'][0] }> = []
  menu.sections.forEach(section => {
    section.items.forEach(item => {
      allItems.push({ section, item })
    })
  })
  
  // Track current section for header insertion
  let currentSectionId: string | null = null
  let tileIndex = 0
  
  // Assign items to base tiles
  for (let i = 0; i < allItems.length && tileIndex < baseItemTiles.length; i++) {
    const { section, item } = allItems[i]
    
    // Insert section header if we're starting a new section
    if (section.id !== currentSectionId) {
      currentSectionId = section.id
      
      // Find if there's a section header tile at this position
      const sectionHeaderTile = template.layout.tiles.find(
        tile => tile.type === 'SECTION_HEADER' && 
                tile.row === baseItemTiles[tileIndex].row &&
                tile.col < baseItemTiles[tileIndex].col
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
    }
    
    // Assign item to tile
    const tileDef = baseItemTiles[tileIndex]
    tiles.push(createMenuItemTile(tileDef, item, textOnly))
    tileIndex++
  }
  
  // Handle repeat pattern if needed
  if (capacity.requiredRepeats > 0 && template.layout.repeatPattern) {
    const remainingItems = allItems.slice(tileIndex)
    tiles.push(...assignItemsToRepeatPattern(
      remainingItems,
      template,
      textOnly,
      capacity
    ))
  }
  
  return tiles
}

/**
 * Assign items to repeat pattern tiles
 */
function assignItemsToRepeatPattern(
  items: Array<{ section: any, item: any }>,
  template: MenuTemplate,
  textOnly: boolean,
  capacity: CapacityInfo
): TileContentInstance[] {
  const tiles: TileContentInstance[] = []
  const repeatPattern = template.layout.repeatPattern!
  
  // For repeat patterns, we need to create virtual tile definitions
  // based on the pattern structure. The repeatItemTileIds are just IDs,
  // not actual tiles in the base layout.
  
  // Calculate how many tiles per repeat based on the pattern
  const tilesPerRepeat = repeatPattern.repeatItemTileIds.length
  
  // Determine the grid structure for repeat tiles
  // For now, assume they follow the same column structure as the base layout
  const baseCols = template.layout.baseCols
  const tilesPerRow = Math.min(baseCols, tilesPerRepeat)
  
  // Assign items to repeat tiles
  let itemIndex = 0
  for (let repeatIndex = 0; repeatIndex < capacity.requiredRepeats; repeatIndex++) {
    for (let tileIndex = 0; tileIndex < tilesPerRepeat; tileIndex++) {
      if (itemIndex >= items.length) break
      
      const { item } = items[itemIndex]
      
      // Calculate position in repeat
      const rowInRepeat = Math.floor(tileIndex / tilesPerRow)
      const colInRepeat = tileIndex % tilesPerRow
      const rowOffset = repeatPattern.fromRow + (repeatIndex * repeatPattern.rowsPerRepeat)
      
      // Create a virtual tile definition for this repeat tile
      const virtualTileDef: TileDefinition = {
        id: `${repeatPattern.repeatItemTileIds[tileIndex]}-repeat-${repeatIndex}`,
        type: textOnly ? 'ITEM_TEXT_ONLY' : 'ITEM',
        col: colInRepeat,
        row: rowOffset + rowInRepeat,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: !textOnly, showDescription: true }
      }
      
      tiles.push(createMenuItemTile(virtualTileDef, item, textOnly))
      
      itemIndex++
    }
  }
  
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
  textOnly: boolean
): MenuItemTileInstance {
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
    
    switch (tileDef.type) {
      case 'TITLE':
        content = menu.name
        break
        
      case 'LOGO':
        // MVP: Placeholder text/icon
        // Future: menu.metadata.logoUrl
        content = menu.metadata.venueName || menu.name
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
 * Generate pages from tiles
 * 
 * This function:
 * - Creates single page or multiple pages based on newPagePerRepeat
 * - Groups tiles by page based on row positions
 * - Returns complete PageLayout objects with positioned tiles
 */
function generatePages(
  tiles: TileContentInstance[],
  template: MenuTemplate,
  capacity: CapacityInfo
): PageLayout[] {
  const pages: PageLayout[] = []
  
  // Check if template uses multiple pages
  const newPagePerRepeat = template.layout.repeatPattern?.newPagePerRepeat || false
  
  if (!newPagePerRepeat || capacity.requiredRepeats === 0) {
    // Single page layout
    pages.push({
      pageIndex: 0,
      tiles: tiles
    })
  } else {
    // Multiple page layout
    const repeatPattern = template.layout.repeatPattern!
    const baseRows = repeatPattern.fromRow
    const rowsPerRepeat = repeatPattern.rowsPerRepeat
    
    // Group tiles by page
    const tilesByPage = new Map<number, TileContentInstance[]>()
    
    tiles.forEach(tile => {
      let pageIndex = 0
      
      if (tile.row < baseRows) {
        // Base layout tiles go on first page
        pageIndex = 0
      } else {
        // Repeat tiles are distributed across pages
        const rowInRepeat = tile.row - baseRows
        pageIndex = Math.floor(rowInRepeat / rowsPerRepeat) + 1
      }
      
      if (!tilesByPage.has(pageIndex)) {
        tilesByPage.set(pageIndex, [])
      }
      tilesByPage.get(pageIndex)!.push(tile)
    })
    
    // Create page layouts
    const pageIndices = Array.from(tilesByPage.keys()).sort((a, b) => a - b)
    pageIndices.forEach(pageIndex => {
      pages.push({
        pageIndex,
        tiles: tilesByPage.get(pageIndex) || []
      })
    })
  }
  
  return pages
}
