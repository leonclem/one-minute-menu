/**
 * Filler Manager for GridMenu V2 Layout Engine
 *
 * This module handles the insertion of filler tiles in safe zones to improve
 * visual balance of sparse menus. Fillers are placed AFTER main layout and
 * last-row balancing to avoid interfering with content placement.
 *
 * KEY DESIGN DECISIONS:
 * 1. MVP CONSTRAINT: Filler tiles are 1×1 only (colSpan=1, rowSpan=1)
 * 2. Use tile.gridRow/gridCol (stored at placement time) for occupancy checks
 * 3. Safe zones use grid coordinates with 'LAST' row support
 * 4. Fillers never reorder or displace menu items
 * 5. Deterministic selection based on seeded randomness
 */

import type {
  PageLayoutV2,
  TemplateV2,
  TileInstanceV2,
  SafeZoneV2,
  FillerTileDefV2,
  FillerPolicyV2,
  FillerContentV2,
} from './engine-types-v2'
import { calculateCellWidth, calculateMaxRows, calculateTileWidth, calculateTileHeight } from './engine-types-v2'

// =============================================================================
// Types
// =============================================================================

/** Empty cell in the grid */
interface EmptyCell {
  row: number
  col: number
}

/** Selected filler with its target cell */
interface SelectedFiller {
  cell: EmptyCell
  filler: FillerTileDefV2
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Insert filler tiles into empty cells within safe zones.
 * 
 * DESIGN DECISION: Fillers can be multi-cell (colSpan/rowSpan > 1).
 * They are placed after content and balancing.
 *
 * @param page - Page to insert fillers into
 * @param template - Template configuration
 * @param menuId - Menu ID for deterministic seeding
 * @param pageIndex - Page index for deterministic seeding
 * @param enabledOverride - Optional override for filler enabled state
 * @returns Array of filler tile instances
 */
export function insertFillers(
  page: PageLayoutV2,
  template: TemplateV2,
  menuId: string,
  pageIndex: number,
  enabledOverride?: boolean
): TileInstanceV2[] {
  const isEnabled = enabledOverride ?? template.filler.enabled
  if (!isEnabled) {
    return []
  }

  const fillerTiles: TileInstanceV2[] = []
  const bodyRegion = page.regions.find(r => r.id === 'body')!
  const { cols, rowHeight, gapX, gapY } = template.body.container

  // Build occupancy grid (accounts for colSpan/rowSpan of placed tiles)
  const maxRows = calculateMaxRows(bodyRegion.height, rowHeight, gapY)
  const occupancy = buildOccupancyGrid(page, template, cols, maxRows)

  // Find the last row that actually contains content
  const lastContentRow = findLastOccupiedRow(occupancy)

  // Find empty cells in safe zones
  const emptyCells = findEmptyCellsInSafeZones(
    occupancy,
    template.filler.safeZones,
    cols,
    maxRows,
    lastContentRow
  )

  // Select filler variants based on policy
  const seed = hashString(`${menuId}-${template.id}-${pageIndex}`)
  const selectedFillers = selectFillers(
    emptyCells,
    template.filler.tiles,
    template.filler.policy,
    seed
  )

  // Create filler tile instances
  const cellWidth = calculateCellWidth(bodyRegion.width, cols, gapX)
  
  for (const { cell, filler } of selectedFillers) {
    const fRowSpan = filler.rowSpan ?? 1
    const fColSpan = filler.colSpan ?? 1
    
    // Final check that the space is still empty (since previous fillers might have taken it)
    if (isAreaEmpty(occupancy, cell.row, cell.col, fRowSpan, fColSpan)) {
      fillerTiles.push({
        id: `filler-${pageIndex}-${cell.row}-${cell.col}`,
        type: 'FILLER',
        regionId: 'body',
        x: cell.col * (cellWidth + gapX),
        y: cell.row * (rowHeight + gapY),
        width: calculateTileWidth(fColSpan, cellWidth, gapX),
        height: calculateTileHeight(fRowSpan, rowHeight, gapY),
        colSpan: fColSpan,
        rowSpan: fRowSpan,
        gridRow: cell.row,
        gridCol: cell.col,
        layer: 'background',
        content: {
          type: 'FILLER',
          style: filler.style,
          content: filler.content,
        } as FillerContentV2,
      })
      
      // Mark cells as occupied to prevent other fillers from overlapping
      markAreaOccupied(occupancy, cell.row, cell.col, fRowSpan, fColSpan)
    }
  }

  return fillerTiles
}

// =============================================================================
// Occupancy Grid Utilities
// =============================================================================

/**
 * Check if a rectangular area in the grid is completely empty.
 * 
 * @param grid - 2D occupancy grid
 * @param row - Start row
 * @param col - Start col
 * @param rowSpan - Row span
 * @param colSpan - Col span
 * @returns True if area is empty and within grid bounds
 */
function isAreaEmpty(
  grid: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): boolean {
  const maxRows = grid.length
  const cols = grid[0]?.length || 0

  if (row < 0 || col < 0 || row + rowSpan > maxRows || col + colSpan > cols) {
    return false
  }

  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (grid[r][c]) return false
    }
  }
  return true
}

/**
 * Mark a rectangular area in the grid as occupied.
 */
function markAreaOccupied(
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

// =============================================================================
// Occupancy Grid
// =============================================================================

/**
 * Build 2D occupancy grid marking cells occupied by tiles.
 *
 * DESIGN DECISION: For tiles moved by last row balancing, we need to handle
 * fractional grid positions properly since CENTER balancing can place items
 * between grid cells.
 *
 * @param page - Page with placed tiles
 * @param template - Template configuration
 * @param cols - Number of columns in grid
 * @param maxRows - Maximum number of rows in grid
 * @returns 2D boolean array (rows × cols) where true = occupied
 */
export function buildOccupancyGrid(
  page: PageLayoutV2,
  template: TemplateV2,
  cols: number,
  maxRows: number
): boolean[][] {
  // Initialize grid with all cells empty
  const grid: boolean[][] = Array.from({ length: maxRows }, () =>
    Array(cols).fill(false)
  )

  const bodyRegion = page.regions.find(r => r.id === 'body')!
  const { gapX, gapY, rowHeight } = template.body.container
  const cellWidth = calculateCellWidth(bodyRegion.width, cols, gapX)

  // Mark occupied cells using stored grid coordinates or derived coordinates
  for (const tile of page.tiles) {
    if (tile.regionId !== 'body') continue

    let startRow = tile.gridRow
    let startCol = tile.gridCol
    let endCol = startCol + tile.colSpan - 1

    // For tiles that might have been moved by last row balancing,
    // derive grid position from actual coordinates to ensure accuracy
    if (template.policies?.lastRowBalancing !== 'LEFT' && 
        (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW')) {
      
      // Check if this tile's x position differs significantly from expected grid position
      const expectedX = startCol * (cellWidth + gapX)
      const actualX = tile.x
      const tolerance = 5 // Increased tolerance for floating point precision and rounding
      
      if (Math.abs(actualX - expectedX) > tolerance) {
        // Tile has been moved, derive grid position from actual coordinates
        // For fractional positions, we need to mark all cells that the tile overlaps
        const startColFloat = actualX / (cellWidth + gapX)
        const endColFloat = (actualX + tile.width) / (cellWidth + gapX)
        
        startCol = Math.floor(startColFloat)
        endCol = Math.floor(endColFloat)
        
        // If the tile spans across a cell boundary, include the next cell
        if (endColFloat > Math.floor(endColFloat)) {
          endCol = Math.floor(endColFloat)
        }
      }
    }

    // Mark all cells covered by this tile's span
    for (let r = startRow; r < startRow + tile.rowSpan && r < maxRows; r++) {
      for (let c = startCol; c <= endCol && c < cols; c++) {
        if (r >= 0 && c >= 0) {
          grid[r][c] = true
        }
      }
    }
  }

  return grid
}

/**
 * Find the last row in the occupancy grid that contains at least one occupied cell.
 * 
 * @param occupancy - 2D occupancy grid
 * @returns Index of the last occupied row, or -1 if empty
 */
export function findLastOccupiedRow(occupancy: boolean[][]): number {
  for (let r = occupancy.length - 1; r >= 0; r--) {
    if (occupancy[r].some(cell => cell)) {
      return r
    }
  }
  return -1
}

// =============================================================================
// Safe Zone Processing
// =============================================================================

/**
 * Find empty cells within safe zones.
 *
 * @param occupancy - 2D occupancy grid
 * @param safeZones - Safe zone definitions
 * @param cols - Number of columns
 * @param maxRows - Maximum number of rows
 * @param lastContentRow - Index of the last row containing content
 * @returns Array of empty cells within safe zones
 */
export function findEmptyCellsInSafeZones(
  occupancy: boolean[][],
  safeZones: SafeZoneV2[],
  cols: number,
  maxRows: number,
  lastContentRow: number
): EmptyCell[] {
  const emptyCells: EmptyCell[] = []

  for (const zone of safeZones) {
    const startRow = resolveSafeZoneIndex(zone.startRow, maxRows, lastContentRow)
    const endRow = resolveSafeZoneIndex(zone.endRow, maxRows, lastContentRow)
    const startCol = zone.startCol
    const endCol = Math.min(zone.endCol, cols - 1)

    // Find empty cells within this safe zone
    for (let row = startRow; row <= endRow && row < maxRows; row++) {
      if (row < 0) continue
      for (let col = startCol; col <= endCol && col < cols; col++) {
        if (!occupancy[row][col]) {
          emptyCells.push({ row, col })
        }
      }
    }
  }

  return emptyCells
}

/**
 * Resolve safe zone index, handling special keywords.
 * 
 * DESIGN DECISION: 
 * - 'LAST' resolves to the absolute last row of the body grid.
 * - 'LAST_CONTENT' resolves to the last row index that actually contains content.
 *
 * @param value - Index value or keyword
 * @param maxRows - Maximum number of rows in grid
 * @param lastContentRow - Index of the last row containing content
 * @returns Resolved row index
 */
export function resolveSafeZoneIndex(
  value: number | 'LAST' | 'LAST_CONTENT',
  maxRows: number,
  lastContentRow: number
): number {
  if (value === 'LAST') {
    return Math.max(0, maxRows - 1)
  }
  if (value === 'LAST_CONTENT') {
    return lastContentRow >= 0 ? lastContentRow : Math.max(0, maxRows - 1)
  }
  return Math.max(0, Math.min(value, maxRows - 1))
}

// =============================================================================
// Filler Selection
// =============================================================================

/**
 * Select fillers for empty cells based on policy.
 *
 * @param cells - Empty cells to fill
 * @param fillerDefs - Available filler definitions
 * @param policy - Selection policy
 * @param seed - Seed for deterministic randomness
 * @returns Array of selected fillers with their target cells
 */
export function selectFillers(
  cells: EmptyCell[],
  fillerDefs: FillerTileDefV2[],
  policy: FillerPolicyV2,
  seed: number
): SelectedFiller[] {
  if (cells.length === 0 || fillerDefs.length === 0) {
    return []
  }

  const selected: SelectedFiller[] = []

  switch (policy) {
    case 'SEQUENTIAL':
      for (let i = 0; i < cells.length; i++) {
        const filler = fillerDefs[i % fillerDefs.length]
        selected.push({ cell: cells[i], filler })
      }
      break

    case 'BY_PAGE_TYPE':
      // For MVP, treat same as SEQUENTIAL
      // Future: could vary by page type (FIRST, CONTINUATION, etc.)
      for (let i = 0; i < cells.length; i++) {
        const filler = fillerDefs[i % fillerDefs.length]
        selected.push({ cell: cells[i], filler })
      }
      break

    case 'RANDOM_SEEDED':
      const rng = createSeededRandom(seed)
      for (const cell of cells) {
        const index = Math.floor(rng() * fillerDefs.length)
        const filler = fillerDefs[index]
        selected.push({ cell, filler })
      }
      break
  }

  return selected
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a simple hash from a string for deterministic seeding.
 *
 * @param str - String to hash
 * @returns Hash value as positive integer
 */
export function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Create a seeded pseudo-random number generator.
 * Uses a simple linear congruential generator for deterministic results.
 *
 * @param seed - Seed value
 * @returns Function that returns random numbers between 0 and 1
 */
function createSeededRandom(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646

  return function() {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}