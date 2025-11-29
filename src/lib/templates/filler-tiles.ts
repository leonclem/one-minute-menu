/**
 * Filler Tile Generation for GridMenu Template Engine
 * 
 * This module handles the detection and insertion of filler tiles (SPACER tiles) to occupy
 * empty cells in grid layouts. Filler tiles are decorative elements that maintain visual
 * balance and professional appearance.
 * 
 * Key Responsibilities:
 * - Detect empty cells after placing all content tiles
 * - Generate SPACER tiles with deterministic color selection
 * - Never override existing tiles
 * - Only insert fillers when template.capabilities.autoFillerTiles is true
 * 
 * IMPORTANT: Filler insertion MUST NOT alter the number or position of
 * ITEM / ITEM_TEXT_ONLY / SECTION_HEADER tiles. It may only add SPACER tiles
 * into previously empty cells.
 */

import type {
  GridLayout,
  GridSection,
  GridTile,
  FillerTile,
  LayoutPreset,
  OutputContext
} from './types'
import type {
  LayoutInstance,
  PageLayout,
  MenuTemplate,
  SpacerTileInstance
} from './engine-types'
import { calculateEmptyCells, hasIncompleteLastRow } from './grid-generator'

// ============================================================================
// Filler Tile Styles
// ============================================================================

/**
 * Available filler tile style types
 */
export type FillerStyle = 'color' | 'pattern' | 'icon'

/**
 * Icon options for filler tiles
 */
export const FILLER_ICONS = [
  'utensils',      // Fork and knife
  'coffee',        // Coffee cup
  'wine-glass',    // Wine glass
  'leaf',          // Leaf (for vegetarian/organic)
  'star',          // Star (for featured/premium)
  'heart',         // Heart (for favorites)
  'chef-hat',      // Chef hat
  'plate'          // Plate
] as const

export type FillerIcon = typeof FILLER_ICONS[number]

/**
 * Pattern options for filler tiles
 */
export const FILLER_PATTERNS = [
  'dots',          // Polka dots
  'stripes',       // Diagonal stripes
  'grid',          // Grid pattern
  'waves',         // Wave pattern
  'chevron'        // Chevron pattern
] as const

export type FillerPattern = typeof FILLER_PATTERNS[number]

// ============================================================================
// Filler Tile Generation
// ============================================================================

/**
 * Insert filler tiles into a grid layout
 * 
 * This function analyzes the grid layout and inserts filler tiles into empty cells
 * at the end of sections. It maintains grid alignment and respects section boundaries.
 * 
 * @param layout - Grid layout to process
 * @returns New grid layout with filler tiles inserted
 * 
 * @example
 * ```typescript
 * const layoutWithFillers = insertFillerTiles(layout)
 * console.log(layoutWithFillers.totalTiles) // Includes filler tiles
 * ```
 */
export function insertFillerTiles(layout: GridLayout): GridLayout {
  const columns = layout.preset.gridConfig.columns[layout.context]
  const sectionsWithFillers: GridSection[] = []
  
  for (const section of layout.sections) {
    const itemCount = section.tiles.filter(t => t.type === 'item').length
    
    // Check if the last row is incomplete
    if (hasIncompleteLastRow(itemCount, columns)) {
      const emptyCells = calculateEmptyCells(itemCount, columns)
      const fillerTiles = generateFillerTilesForSection(
        section,
        emptyCells,
        columns,
        layout.preset,
        layout.context
      )
      
      // Create new section with original tiles plus filler tiles
      sectionsWithFillers.push({
        ...section,
        tiles: [...section.tiles, ...fillerTiles]
      })
    } else {
      // No filler needed, keep section as is
      sectionsWithFillers.push(section)
    }
  }
  
  // Calculate new total tile count
  const totalTiles = sectionsWithFillers.reduce((sum, s) => sum + s.tiles.length, 0)
  
  return {
    ...layout,
    sections: sectionsWithFillers,
    totalTiles
  }
}

/**
 * Generate filler tiles for a section's incomplete last row
 * 
 * @param section - Grid section
 * @param emptyCells - Number of empty cells to fill
 * @param columns - Total number of columns in the grid
 * @param preset - Layout preset
 * @param context - Output context
 * @returns Array of filler tiles
 */
function generateFillerTilesForSection(
  section: GridSection,
  emptyCells: number,
  columns: number,
  preset: LayoutPreset,
  context: OutputContext
): FillerTile[] {
  const fillerTiles: FillerTile[] = []
  const itemCount = section.tiles.filter(t => t.type === 'item').length
  
  // Calculate the row and starting column for filler tiles
  const lastItemIndex = itemCount - 1
  const lastItemColumn = lastItemIndex % columns
  const lastItemRow = section.startRow + Math.floor(lastItemIndex / columns)
  
  // Starting column for first filler tile
  let startColumn = lastItemColumn + 1
  
  // Generate filler tiles for each empty cell
  for (let i = 0; i < emptyCells; i++) {
    const column = startColumn + i
    const fillerTile = createFillerTile(column, lastItemRow, i, preset, context)
    fillerTiles.push(fillerTile)
  }
  
  return fillerTiles
}

/**
 * Create a single filler tile
 * 
 * @param column - Column position
 * @param row - Row position
 * @param index - Index of the filler tile (for variation)
 * @param preset - Layout preset
 * @param context - Output context
 * @returns Filler tile
 */
function createFillerTile(
  column: number,
  row: number,
  index: number,
  preset: LayoutPreset,
  context: OutputContext
): FillerTile {
  // Select filler style based on preset family and context
  const style = selectFillerStyle(preset, context)
  const content = selectFillerContent(style, index)
  
  return {
    type: 'filler',
    style,
    content,
    column,
    row,
    span: { columns: 1, rows: 1 }
  }
}

// ============================================================================
// Filler Style Selection
// ============================================================================

/**
 * Select appropriate filler style based on preset and context
 * 
 * @param preset - Layout preset
 * @param context - Output context
 * @returns Filler style
 */
function selectFillerStyle(preset: LayoutPreset, context: OutputContext): FillerStyle {
  // For better visibility and user experience, always use icons
  // Icons are more visually clear than patterns or solid colors
  // This ensures consistent filler tile appearance across all presets
  return 'icon'
}

/**
 * Select content for a filler tile based on style and index
 * 
 * @param style - Filler style
 * @param index - Index of the filler tile (for variation)
 * @returns Content identifier (icon name or pattern name)
 */
function selectFillerContent(style: FillerStyle, index: number): string | undefined {
  if (style === 'color') {
    // No content needed for solid color tiles
    return undefined
  }
  
  if (style === 'icon') {
    // Rotate through available icons
    const iconIndex = index % FILLER_ICONS.length
    return FILLER_ICONS[iconIndex]
  }
  
  if (style === 'pattern') {
    // Rotate through available patterns
    const patternIndex = index % FILLER_PATTERNS.length
    return FILLER_PATTERNS[patternIndex]
  }
  
  return undefined
}

// ============================================================================
// Filler Tile Query Functions
// ============================================================================

/**
 * Get all filler tiles from a layout
 * 
 * @param layout - Grid layout
 * @returns Array of filler tiles
 */
export function getFillerTiles(layout: GridLayout): FillerTile[] {
  const fillerTiles: FillerTile[] = []
  
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      if (tile.type === 'filler') {
        fillerTiles.push(tile)
      }
    }
  }
  
  return fillerTiles
}

/**
 * Count the number of filler tiles in a layout
 * 
 * @param layout - Grid layout
 * @returns Number of filler tiles
 */
export function countFillerTiles(layout: GridLayout): number {
  return getFillerTiles(layout).length
}

/**
 * Get filler tiles for a specific section
 * 
 * @param section - Grid section
 * @returns Array of filler tiles in the section
 */
export function getFillerTilesInSection(section: GridSection): FillerTile[] {
  return section.tiles.filter(t => t.type === 'filler') as FillerTile[]
}

/**
 * Check if a layout has any filler tiles
 * 
 * @param layout - Grid layout
 * @returns True if layout contains filler tiles
 */
export function hasFillerTiles(layout: GridLayout): boolean {
  return countFillerTiles(layout) > 0
}

// ============================================================================
// Filler Tile Removal
// ============================================================================

/**
 * Remove all filler tiles from a layout
 * Useful for recalculating layout or exporting without fillers
 * 
 * @param layout - Grid layout
 * @returns New layout without filler tiles
 */
export function removeFillerTiles(layout: GridLayout): GridLayout {
  const sectionsWithoutFillers: GridSection[] = layout.sections.map(section => ({
    ...section,
    tiles: section.tiles.filter(t => t.type === 'item')
  }))
  
  const totalTiles = sectionsWithoutFillers.reduce((sum, s) => sum + s.tiles.length, 0)
  
  return {
    ...layout,
    sections: sectionsWithoutFillers,
    totalTiles
  }
}

// ============================================================================
// Filler Tile Validation
// ============================================================================

/**
 * Validate that filler tiles are correctly placed
 * Checks that fillers only appear at the end of sections and don't disrupt layout
 * 
 * @param layout - Grid layout to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateFillerTiles(layout: GridLayout): string[] {
  const errors: string[] = []
  const columns = layout.preset.gridConfig.columns[layout.context]
  
  for (const section of layout.sections) {
    const itemTiles = section.tiles.filter(t => t.type === 'item')
    const fillerTiles = section.tiles.filter(t => t.type === 'filler')
    
    if (fillerTiles.length === 0) {
      continue // No fillers to validate
    }
    
    // Check that fillers are only in the last row
    const itemCount = itemTiles.length
    const lastItemRow = section.startRow + Math.floor((itemCount - 1) / columns)
    
    for (const filler of fillerTiles) {
      if (filler.row !== lastItemRow) {
        errors.push(
          `Filler tile in section "${section.name}" is not in the last row (row ${filler.row}, expected ${lastItemRow})`
        )
      }
    }
    
    // Check that the number of fillers matches the expected empty cells
    const expectedFillers = calculateEmptyCells(itemCount, columns)
    if (fillerTiles.length !== expectedFillers) {
      errors.push(
        `Section "${section.name}" has ${fillerTiles.length} filler tiles, expected ${expectedFillers}`
      )
    }
    
    // Check that fillers don't overlap with items
    for (const filler of fillerTiles) {
      for (const item of itemTiles) {
        if (filler.row === item.row && filler.column === item.column) {
          errors.push(
            `Filler tile overlaps with item tile at position (${filler.column}, ${filler.row}) in section "${section.name}"`
          )
        }
      }
    }
  }
  
  return errors
}

/**
 * Check if filler tiles are valid
 * 
 * @param layout - Grid layout to check
 * @returns True if filler tiles are valid
 */
export function areFillerTilesValid(layout: GridLayout): boolean {
  return validateFillerTiles(layout).length === 0
}

// ============================================================================
// Filler Tile Statistics
// ============================================================================

/**
 * Calculate statistics about filler tiles in a layout
 * 
 * @param layout - Grid layout
 * @returns Object with filler tile statistics
 */
export function calculateFillerStatistics(layout: GridLayout): {
  totalFillers: number
  fillersByStyle: Record<FillerStyle, number>
  sectionsWithFillers: number
  averageFillersPerSection: number
  fillerRatio: number // Percentage of tiles that are fillers
} {
  const fillerTiles = getFillerTiles(layout)
  const totalFillers = fillerTiles.length
  
  // Count fillers by style
  const fillersByStyle: Record<FillerStyle, number> = {
    color: 0,
    pattern: 0,
    icon: 0
  }
  
  for (const filler of fillerTiles) {
    fillersByStyle[filler.style]++
  }
  
  // Count sections with fillers
  let sectionsWithFillers = 0
  for (const section of layout.sections) {
    if (getFillerTilesInSection(section).length > 0) {
      sectionsWithFillers++
    }
  }
  
  const averageFillersPerSection = sectionsWithFillers > 0
    ? totalFillers / sectionsWithFillers
    : 0
  
  const fillerRatio = layout.totalTiles > 0
    ? (totalFillers / layout.totalTiles) * 100
    : 0
  
  return {
    totalFillers,
    fillersByStyle,
    sectionsWithFillers,
    averageFillersPerSection,
    fillerRatio
  }
}

// ============================================================================
// Filler Tile Customization (Future Enhancement)
// ============================================================================

/**
 * Custom filler tile configuration (future enhancement)
 * Allows users to specify custom icons, patterns, or colors
 */
export interface CustomFillerConfig {
  style: FillerStyle
  content?: string
  color?: string
  opacity?: number
}

/**
 * Insert custom filler tiles (future enhancement)
 * 
 * @param layout - Grid layout
 * @param config - Custom filler configuration
 * @returns Layout with custom filler tiles
 */
export function insertCustomFillerTiles(
  layout: GridLayout,
  config: CustomFillerConfig
): GridLayout {
  // TODO: Implement custom filler tile insertion
  // This will allow users to specify their own icons, patterns, or colors
  return layout
}

// ============================================================================
// Template Engine Filler Tile Insertion (New Engine)
// ============================================================================

/**
 * Deterministic color palette for filler tiles
 * Colors are selected based on grid position to ensure consistency
 */
const FILLER_COLORS = [
  '#F3F4F6', // gray-100
  '#E5E7EB', // gray-200
  '#D1D5DB', // gray-300
  '#FEF3C7', // amber-100
  '#FEE2E2', // red-100
  '#DBEAFE', // blue-100
] as const

/**
 * Filler tile placement mode
 * - 'row-end': Place filler tiles at the end of incomplete rows (default)
 * - 'distributed': Place filler tiles in a pseudo-random distributed pattern
 */
export type FillerPlacementMode = 'row-end' | 'distributed'

/**
 * Simple deterministic hash function for seeding
 * Creates a number from a string that's consistent across runs
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Seeded random number generator for deterministic "randomness"
 * Uses a simple LCG (Linear Congruential Generator) algorithm
 */
function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return state / 0xffffffff
  }
}

/**
 * Shuffle array using Fisher-Yates with seeded random
 */
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array]
  const random = createSeededRandom(seed)
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  
  return result
}

/**
 * Options for filler tile insertion
 */
export interface FillerTileOptions {
  /** Placement mode: 'row-end' or 'distributed' */
  placementMode?: FillerPlacementMode
  /** Seed for deterministic distributed placement (e.g., menuId + templateId) */
  seed?: string
  /** Maximum number of filler tiles to insert (limits clutter) */
  maxFillers?: number
  /** Use template's filler style preference */
  respectTemplateStyle?: boolean
}

/**
 * Insert filler tiles into a layout instance generated by the template engine
 * 
 * This function:
 * - Only inserts fillers if template.capabilities.autoFillerTiles is true
 * - Scans the grid for empty cells after placing all content tiles
 * - Inserts SPACER tiles with deterministic color selection based on position
 * - Never overrides existing tiles
 * - Ensures same menu + template produces same fillers
 * - Supports distributed placement mode for more natural-looking layouts
 * 
 * IMPORTANT: This function MUST NOT alter the number or position of
 * ITEM / ITEM_TEXT_ONLY / SECTION_HEADER tiles. It may only add SPACER tiles
 * into previously empty cells.
 * 
 * @param layout - Layout instance from the template engine
 * @param template - Menu template definition
 * @param options - Optional configuration for filler insertion
 * @returns New layout instance with filler tiles inserted
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const layoutWithFillers = insertFillerTilesIntoLayout(layout, template)
 * 
 * // With distributed placement
 * const layoutWithDistributed = insertFillerTilesIntoLayout(layout, template, {
 *   placementMode: 'distributed',
 *   seed: `${menuId}-${templateId}`,
 *   maxFillers: 6
 * })
 * ```
 */
export function insertFillerTilesIntoLayout(
  layout: LayoutInstance,
  template: MenuTemplate,
  options?: FillerTileOptions
): LayoutInstance {
  // Only insert fillers if template supports it
  if (!template.capabilities.autoFillerTiles) {
    return layout
  }

  const placementMode = options?.placementMode || 'row-end'
  const seed = options?.seed || `${template.id}-${layout.templateVersion}`
  const maxFillers = options?.maxFillers
  const fillerStyle = options?.respectTemplateStyle !== false 
    ? template.style?.fillerTileStyle 
    : undefined

  // Process each page
  const pagesWithFillers = layout.pages.map((page, pageIndex) => 
    insertFillerTilesIntoPageEnhanced(
      page, 
      template, 
      placementMode, 
      `${seed}-page${pageIndex}`,
      maxFillers,
      fillerStyle
    )
  )

  return {
    ...layout,
    pages: pagesWithFillers
  }
}

/**
 * Insert filler tiles into a single page (legacy function for backwards compatibility)
 * 
 * @param page - Page layout
 * @param template - Menu template definition
 * @returns New page layout with filler tiles
 */
function insertFillerTilesIntoPage(
  page: PageLayout,
  template: MenuTemplate
): PageLayout {
  return insertFillerTilesIntoPageEnhanced(page, template, 'row-end', 'default')
}

/**
 * Enhanced filler tile insertion with support for different placement modes
 * 
 * @param page - Page layout
 * @param template - Menu template definition
 * @param placementMode - How to place filler tiles
 * @param seed - Seed for deterministic randomness
 * @param maxFillers - Maximum number of fillers to insert
 * @param fillerStyle - Style preference for filler tiles
 * @returns New page layout with filler tiles
 */
function insertFillerTilesIntoPageEnhanced(
  page: PageLayout,
  template: MenuTemplate,
  placementMode: FillerPlacementMode,
  seed: string,
  maxFillers?: number,
  fillerStyle?: 'icon' | 'pattern' | 'color'
): PageLayout {
  const { baseCols, baseRows } = template.layout
  
  // Build occupancy grid to track which cells are filled
  const occupancyGrid = buildOccupancyGrid(page, baseCols, baseRows)
  
  // Find empty cells
  let emptyCells = findEmptyCells(occupancyGrid, baseCols, baseRows)
  
  // Apply placement mode logic
  if (placementMode === 'distributed') {
    // Shuffle empty cells using seeded random for pseudo-random but deterministic distribution
    const seedNumber = hashString(seed)
    emptyCells = shuffleWithSeed(emptyCells, seedNumber)
    
    // For distributed mode, we typically want fewer fillers for cleaner look
    // Only fill a subset of empty cells (every 2nd or 3rd cell)
    const distributionRate = 0.4 // 40% of empty cells get fillers
    const maxByRate = Math.ceil(emptyCells.length * distributionRate)
    const effectiveMax = maxFillers !== undefined 
      ? Math.min(maxFillers, maxByRate) 
      : maxByRate
    
    emptyCells = emptyCells.slice(0, effectiveMax)
  } else if (maxFillers !== undefined) {
    // For row-end mode, just limit the count
    emptyCells = emptyCells.slice(0, maxFillers)
  }
  
  // Generate filler tiles for selected empty cells
  const seedNumber = hashString(seed)
  const fillerTiles = emptyCells.map((cell, index) => 
    createSpacerTileEnhanced(cell.col, cell.row, index, seedNumber, fillerStyle)
  )
  
  return {
    ...page,
    tiles: [...page.tiles, ...fillerTiles]
  }
}

/**
 * Build an occupancy grid showing which cells are filled
 * 
 * @param page - Page layout
 * @param cols - Number of columns
 * @param rows - Number of rows
 * @returns 2D boolean array where true = occupied
 */
function buildOccupancyGrid(
  page: PageLayout,
  cols: number,
  rows: number
): boolean[][] {
  // Initialize grid with all cells empty
  const grid: boolean[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false))
  
  // Mark occupied cells
  for (const tile of page.tiles) {
    for (let r = tile.row; r < tile.row + tile.rowSpan; r++) {
      for (let c = tile.col; c < tile.col + tile.colSpan; c++) {
        if (r < rows && c < cols) {
          grid[r][c] = true
        }
      }
    }
  }
  
  return grid
}

/**
 * Find all empty cells in the grid
 * 
 * @param occupancyGrid - 2D boolean array
 * @param cols - Number of columns
 * @param rows - Number of rows
 * @returns Array of empty cell positions
 */
function findEmptyCells(
  occupancyGrid: boolean[][],
  cols: number,
  rows: number
): Array<{ col: number; row: number }> {
  const emptyCells: Array<{ col: number; row: number }> = []
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!occupancyGrid[row][col]) {
        emptyCells.push({ col, row })
      }
    }
  }
  
  return emptyCells
}

/**
 * Create a SPACER tile for an empty cell (legacy function)
 * 
 * @param col - Column position
 * @param row - Row position
 * @param index - Index for deterministic color selection
 * @returns Spacer tile instance
 */
function createSpacerTile(
  col: number,
  row: number,
  index: number
): SpacerTileInstance {
  // Deterministic color selection based on position
  const colorIndex = (row * 100 + col + index) % FILLER_COLORS.length
  const backgroundColor = FILLER_COLORS[colorIndex]
  
  return {
    id: `spacer-${col}-${row}`,
    type: 'SPACER',
    col,
    row,
    colSpan: 1,
    rowSpan: 1,
    backgroundColor
  }
}

/**
 * Enhanced SPACER tile creation with style preference support
 * 
 * @param col - Column position
 * @param row - Row position
 * @param index - Index for variation
 * @param seed - Seed for deterministic selection
 * @param fillerStyle - Preferred filler style
 * @returns Spacer tile instance
 */
function createSpacerTileEnhanced(
  col: number,
  row: number,
  index: number,
  seed: number,
  fillerStyle?: 'icon' | 'pattern' | 'color'
): SpacerTileInstance {
  // Use seeded random for more varied but deterministic color selection
  const random = createSeededRandom(seed + row * 1000 + col * 100 + index)
  const colorIndex = Math.floor(random() * FILLER_COLORS.length)
  const backgroundColor = FILLER_COLORS[colorIndex]
  
  // Base tile
  const tile: SpacerTileInstance = {
    id: `spacer-${col}-${row}`,
    type: 'SPACER',
    col,
    row,
    colSpan: 1,
    rowSpan: 1,
    backgroundColor
  }
  
  // Add decorative variant based on style preference
  if (fillerStyle === 'icon') {
    const iconIndex = Math.floor(random() * FILLER_ICONS.length)
    tile.options = {
      decorativeVariant: FILLER_ICONS[iconIndex]
    }
  } else if (fillerStyle === 'pattern') {
    const patternIndex = Math.floor(random() * FILLER_PATTERNS.length)
    tile.options = {
      decorativeVariant: FILLER_PATTERNS[patternIndex]
    }
  }
  
  return tile
}

/**
 * Count the number of filler tiles in a layout instance
 * 
 * @param layout - Layout instance
 * @returns Number of SPACER tiles
 */
export function countFillerTilesInLayout(layout: LayoutInstance): number {
  return layout.pages.reduce(
    (sum, page) => sum + page.tiles.filter(t => t.type === 'SPACER').length,
    0
  )
}

/**
 * Validate that filler tiles don't override content tiles
 * 
 * @param layout - Layout instance
 * @returns Array of validation error messages (empty if valid)
 */
export function validateFillerTilesInLayout(layout: LayoutInstance): string[] {
  const errors: string[] = []
  
  for (const page of layout.pages) {
    const spacerTiles = page.tiles.filter(t => t.type === 'SPACER')
    const contentTiles = page.tiles.filter(t => t.type !== 'SPACER')
    
    // Check that spacers don't overlap with content tiles
    for (const spacer of spacerTiles) {
      for (const content of contentTiles) {
        if (tilesOverlap(spacer, content)) {
          errors.push(
            `SPACER tile at (${spacer.col}, ${spacer.row}) overlaps with ${content.type} tile at (${content.col}, ${content.row}) on page ${page.pageIndex}`
          )
        }
      }
    }
  }
  
  return errors
}

/**
 * Check if two tiles overlap
 * 
 * @param tile1 - First tile
 * @param tile2 - Second tile
 * @returns True if tiles overlap
 */
function tilesOverlap(
  tile1: { col: number; row: number; colSpan: number; rowSpan: number },
  tile2: { col: number; row: number; colSpan: number; rowSpan: number }
): boolean {
  const tile1Right = tile1.col + tile1.colSpan
  const tile1Bottom = tile1.row + tile1.rowSpan
  const tile2Right = tile2.col + tile2.colSpan
  const tile2Bottom = tile2.row + tile2.rowSpan
  
  return !(
    tile1Right <= tile2.col ||
    tile1.col >= tile2Right ||
    tile1Bottom <= tile2.row ||
    tile1.row >= tile2Bottom
  )
}
