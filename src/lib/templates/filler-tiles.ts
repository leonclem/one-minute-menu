/**
 * Filler Tile Generation for Dynamic Menu Layout Engine
 * 
 * This module handles the detection and insertion of filler tiles to occupy dead space
 * in grid layouts. Filler tiles are decorative elements that maintain visual balance
 * and professional appearance when sections don't perfectly fill grid rows.
 * 
 * Key Responsibilities:
 * - Detect empty cells at the end of sections
 * - Generate filler tiles with appropriate styles
 * - Maintain grid alignment and spacing consistency
 * - Respect section boundaries
 */

import type {
  GridLayout,
  GridSection,
  GridTile,
  FillerTile,
  LayoutPreset,
  OutputContext
} from './types'
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
