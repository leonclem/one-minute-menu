/**
 * Grid Layout Generator for Dynamic Menu Layout Engine
 * 
 * This module generates grid layouts with positioned tiles based on menu data and preset configuration.
 * It handles tile placement, row wrapping, section boundaries, and calculates final grid structure.
 * 
 * Key Responsibilities:
 * - Calculate tile positions based on column count
 * - Handle section boundaries and row wrapping
 * - Generate GridLayout with positioned ItemTiles
 * - Prepare structure for filler tile insertion
 * - Cache layout calculations for performance
 */

import type {
  LayoutMenuData,
  LayoutPreset,
  OutputContext,
  GridLayout,
  GridSection,
  GridTile,
  ItemTile
} from './types'
import {
  generateCacheKey,
  getCachedLayout,
  setCachedLayout,
  recordCacheHit,
  recordCacheMiss,
  invalidateCacheForMenu,
  clearCache,
  getCacheStats,
  getCacheHitRate
} from './layout-cache'

// Re-export cache management functions for convenience
export {
  invalidateCacheForMenu,
  clearCache,
  getCacheStats,
  getCacheHitRate
}

// ============================================================================
// Grid Layout Generation
// ============================================================================

/**
 * Generate grid layout with tile placement
 * 
 * This function takes menu data and a preset configuration, then calculates
 * the position of each menu item tile within a responsive grid structure.
 * 
 * Results are cached based on menu data hash and preset ID for improved performance.
 * 
 * @param data - Normalized menu data
 * @param preset - Selected layout preset
 * @param context - Target output context (mobile, tablet, desktop, print)
 * @returns Complete grid layout with positioned tiles
 * 
 * @example
 * ```typescript
 * const layout = generateGridLayout(menuData, LAYOUT_PRESETS['balanced'], 'desktop')
 * console.log(layout.totalTiles) // Total number of tiles in the grid
 * ```
 */
export function generateGridLayout(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext
): GridLayout {
  // Check cache first
  const cacheKey = generateCacheKey(data, preset, context)
  const cachedLayout = getCachedLayout(cacheKey)
  
  if (cachedLayout) {
    recordCacheHit()
    return cachedLayout
  }
  
  recordCacheMiss()
  
  // Generate layout if not cached
  const layout = generateGridLayoutInternal(data, preset, context)
  
  // Store in cache
  setCachedLayout(cacheKey, layout)
  
  return layout
}

/**
 * Internal grid layout generation (uncached)
 * 
 * @param data - Normalized menu data
 * @param preset - Selected layout preset
 * @param context - Target output context
 * @returns Complete grid layout with positioned tiles
 */
function generateGridLayoutInternal(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext
): GridLayout {
  // Get column count for the current context
  const columns = preset.gridConfig.columns[context]
  
  const sections: GridSection[] = []
  let currentRow = 0

  // Process each section
  for (const section of data.sections) {
    const tiles: GridTile[] = []
    let column = 0
    let row = currentRow

    // Place item tiles for this section
    for (const item of section.items) {
      const tile: ItemTile = {
        type: 'item',
        item,
        column,
        row,
        span: { columns: 1, rows: 1 } // Default span (can be extended for featured items)
      }
      tiles.push(tile)

      // Move to next column
      column++
      
      // Wrap to next row if we've filled all columns
      if (column >= columns) {
        column = 0
        row++
      }
    }

    // If the last row is incomplete, move to the next row for the next section
    // This ensures each section starts on a new row
    if (column > 0) {
      row++
    }

    // Create grid section with positioned tiles
    sections.push({
      name: section.name,
      tiles,
      startRow: currentRow
    })

    // Update current row for next section
    // Add 1 for section spacing (gap between sections)
    currentRow = row + 1
  }

  // Calculate total number of tiles
  const totalTiles = sections.reduce((sum, s) => sum + s.tiles.length, 0)

  return {
    preset,
    context,
    sections,
    totalTiles
  }
}

// ============================================================================
// Grid Calculation Helpers
// ============================================================================

/**
 * Calculate the total number of rows needed for a section
 * 
 * @param itemCount - Number of items in the section
 * @param columns - Number of columns in the grid
 * @returns Number of rows needed
 */
export function calculateRowsNeeded(itemCount: number, columns: number): number {
  return Math.ceil(itemCount / columns)
}

/**
 * Calculate the number of empty cells in the last row of a section
 * 
 * @param itemCount - Number of items in the section
 * @param columns - Number of columns in the grid
 * @returns Number of empty cells (0 if last row is full)
 */
export function calculateEmptyCells(itemCount: number, columns: number): number {
  const remainder = itemCount % columns
  return remainder === 0 ? 0 : columns - remainder
}

/**
 * Check if a section's last row is incomplete
 * 
 * @param itemCount - Number of items in the section
 * @param columns - Number of columns in the grid
 * @returns True if the last row has empty cells
 */
export function hasIncompleteLastRow(itemCount: number, columns: number): boolean {
  return itemCount % columns !== 0
}

/**
 * Get the position of the last tile in a section
 * 
 * @param itemCount - Number of items in the section
 * @param columns - Number of columns in the grid
 * @param startRow - Starting row of the section
 * @returns Object with column and row of the last tile
 */
export function getLastTilePosition(
  itemCount: number,
  columns: number,
  startRow: number
): { column: number; row: number } {
  const lastIndex = itemCount - 1
  const column = lastIndex % columns
  const row = startRow + Math.floor(lastIndex / columns)
  
  return { column, row }
}

/**
 * Calculate grid dimensions (total columns and rows)
 * 
 * @param layout - Generated grid layout
 * @returns Object with total columns and rows
 */
export function calculateGridDimensions(layout: GridLayout): { columns: number; rows: number } {
  const columns = layout.preset.gridConfig.columns[layout.context]
  
  // Find the maximum row number across all tiles
  let maxRow = 0
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      const tileEndRow = tile.row + tile.span.rows - 1
      if (tileEndRow > maxRow) {
        maxRow = tileEndRow
      }
    }
  }
  
  const rows = maxRow + 1 // Convert from 0-indexed to count
  
  return { columns, rows }
}

// ============================================================================
// Tile Query Functions
// ============================================================================

/**
 * Get all tiles at a specific row
 * 
 * @param layout - Grid layout
 * @param row - Row number (0-indexed)
 * @returns Array of tiles at the specified row
 */
export function getTilesAtRow(layout: GridLayout, row: number): GridTile[] {
  const tiles: GridTile[] = []
  
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      if (tile.row === row) {
        tiles.push(tile)
      }
    }
  }
  
  return tiles
}

/**
 * Get all tiles in a specific column
 * 
 * @param layout - Grid layout
 * @param column - Column number (0-indexed)
 * @returns Array of tiles in the specified column
 */
export function getTilesAtColumn(layout: GridLayout, column: number): GridTile[] {
  const tiles: GridTile[] = []
  
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      if (tile.column === column) {
        tiles.push(tile)
      }
    }
  }
  
  return tiles
}

/**
 * Get tile at a specific grid position
 * 
 * @param layout - Grid layout
 * @param column - Column number (0-indexed)
 * @param row - Row number (0-indexed)
 * @returns Tile at the position or undefined if empty
 */
export function getTileAt(
  layout: GridLayout,
  column: number,
  row: number
): GridTile | undefined {
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      // Check if the position falls within the tile's span
      const tileStartCol = tile.column
      const tileEndCol = tile.column + tile.span.columns - 1
      const tileStartRow = tile.row
      const tileEndRow = tile.row + tile.span.rows - 1
      
      if (
        column >= tileStartCol &&
        column <= tileEndCol &&
        row >= tileStartRow &&
        row <= tileEndRow
      ) {
        return tile
      }
    }
  }
  
  return undefined
}

/**
 * Check if a grid position is occupied by a tile
 * 
 * @param layout - Grid layout
 * @param column - Column number (0-indexed)
 * @param row - Row number (0-indexed)
 * @returns True if position is occupied
 */
export function isPositionOccupied(
  layout: GridLayout,
  column: number,
  row: number
): boolean {
  return getTileAt(layout, column, row) !== undefined
}

// ============================================================================
// Section Query Functions
// ============================================================================

/**
 * Get section by name
 * 
 * @param layout - Grid layout
 * @param sectionName - Name of the section
 * @returns Grid section or undefined if not found
 */
export function getSectionByName(
  layout: GridLayout,
  sectionName: string
): GridSection | undefined {
  return layout.sections.find(s => s.name === sectionName)
}

/**
 * Get the row range for a section
 * 
 * @param section - Grid section
 * @returns Object with start and end row numbers
 */
export function getSectionRowRange(section: GridSection): { start: number; end: number } {
  if (section.tiles.length === 0) {
    return { start: section.startRow, end: section.startRow }
  }
  
  let maxRow = section.startRow
  for (const tile of section.tiles) {
    const tileEndRow = tile.row + tile.span.rows - 1
    if (tileEndRow > maxRow) {
      maxRow = tileEndRow
    }
  }
  
  return { start: section.startRow, end: maxRow }
}

/**
 * Get the number of rows occupied by a section
 * 
 * @param section - Grid section
 * @returns Number of rows
 */
export function getSectionRowCount(section: GridSection): number {
  const range = getSectionRowRange(section)
  return range.end - range.start + 1
}

// ============================================================================
// Layout Validation
// ============================================================================

/**
 * Validate that a grid layout is well-formed
 * Checks for overlapping tiles, out-of-bounds positions, etc.
 * 
 * @param layout - Grid layout to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateGridLayout(layout: GridLayout): string[] {
  const errors: string[] = []
  const columns = layout.preset.gridConfig.columns[layout.context]
  
  // Check for tiles outside grid bounds
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      if (tile.column < 0) {
        errors.push(`Tile in section "${section.name}" has negative column: ${tile.column}`)
      }
      
      // Check if tile (including its span) exceeds grid columns
      const tileEndColumn = tile.column + tile.span.columns
      if (tileEndColumn > columns) {
        errors.push(
          `Tile in section "${section.name}" exceeds grid columns: ${tile.column} + ${tile.span.columns} > ${columns}`
        )
      }
      
      if (tile.row < 0) {
        errors.push(`Tile in section "${section.name}" has negative row: ${tile.row}`)
      }
      
      if (tile.span.columns < 1) {
        errors.push(`Tile in section "${section.name}" has invalid column span: ${tile.span.columns}`)
      }
      
      if (tile.span.rows < 1) {
        errors.push(`Tile in section "${section.name}" has invalid row span: ${tile.span.rows}`)
      }
    }
  }
  
  // Check for overlapping tiles
  const occupiedPositions = new Set<string>()
  
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      // Check all positions occupied by this tile
      for (let r = tile.row; r < tile.row + tile.span.rows; r++) {
        for (let c = tile.column; c < tile.column + tile.span.columns; c++) {
          const posKey = `${c},${r}`
          
          if (occupiedPositions.has(posKey)) {
            errors.push(
              `Overlapping tiles detected at position (${c}, ${r}) in section "${section.name}"`
            )
          }
          
          occupiedPositions.add(posKey)
        }
      }
    }
  }
  
  return errors
}

/**
 * Check if a grid layout is valid
 * 
 * @param layout - Grid layout to check
 * @returns True if layout is valid
 */
export function isGridLayoutValid(layout: GridLayout): boolean {
  return validateGridLayout(layout).length === 0
}

// ============================================================================
// Layout Statistics
// ============================================================================

/**
 * Calculate statistics about a grid layout
 * Useful for debugging and optimization
 * 
 * @param layout - Grid layout
 * @returns Object with layout statistics
 */
export function calculateLayoutStatistics(layout: GridLayout): {
  totalSections: number
  totalTiles: number
  totalRows: number
  totalColumns: number
  averageTilesPerSection: number
  averageRowsPerSection: number
  gridUtilization: number // Percentage of grid cells occupied
} {
  const dimensions = calculateGridDimensions(layout)
  const totalCells = dimensions.columns * dimensions.rows
  const occupiedCells = layout.totalTiles // Assuming 1x1 tiles for now
  
  const totalSections = layout.sections.length
  const totalTiles = layout.totalTiles
  const averageTilesPerSection = totalTiles / totalSections
  
  let totalSectionRows = 0
  for (const section of layout.sections) {
    totalSectionRows += getSectionRowCount(section)
  }
  const averageRowsPerSection = totalSectionRows / totalSections
  
  const gridUtilization = (occupiedCells / totalCells) * 100
  
  return {
    totalSections,
    totalTiles,
    totalRows: dimensions.rows,
    totalColumns: dimensions.columns,
    averageTilesPerSection,
    averageRowsPerSection,
    gridUtilization
  }
}
