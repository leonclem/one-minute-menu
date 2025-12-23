/**
 * V2 Layout Engine Invariant Validator
 *
 * Runtime invariant checking to ensure layout correctness.
 * Validates that generated layouts satisfy all required constraints.
 */

import type { LayoutDocumentV2, TemplateV2, TileInstanceV2, PageLayoutV2 } from './engine-types-v2'
import type { InvariantViolation } from './errors-v2'
import type { ItemContentV2, SectionHeaderContentV2 } from './engine-types-v2'

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate all invariants for a generated layout document.
 * 
 * Returns array of violations (empty array = valid layout).
 * Used in dev mode and when debug=true to catch layout bugs early.
 */
export function validateInvariants(
  document: LayoutDocumentV2,
  template: TemplateV2
): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  for (const page of document.pages) {
    // INV-1: No tile outside region bounds
    violations.push(...checkTilesWithinRegionBounds(page))

    // INV-2: No overlapping tiles with layer awareness
    violations.push(...checkTileOverlaps(page))

    // INV-3: No widowed section headers
    violations.push(...checkNoWidowedSectionHeaders(page))

    // INV-4: All item tiles in body region
    violations.push(...checkItemTilesInBody(page))
  }

  return violations
}

// =============================================================================
// Individual Invariant Checks
// =============================================================================

/**
 * INV-1: Check that no tile extends outside its assigned region bounds.
 * Uses final bounding box (x, y, width, height) regardless of rowSpan/colSpan.
 */
function checkTilesWithinRegionBounds(page: PageLayoutV2): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  for (const tile of page.tiles) {
    const region = page.regions.find(r => r.id === tile.regionId)
    if (!region) {
      violations.push({
        code: 'REGION_NOT_FOUND',
        message: `Tile ${tile.id} references non-existent region ${tile.regionId}`,
        tile: {
          id: tile.id,
          type: tile.type,
          regionId: tile.regionId,
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height
        },
        page: page.pageIndex
      })
      continue
    }

    // Check if tile extends outside region bounds
    const tileRight = tile.x + tile.width
    const tileBottom = tile.y + tile.height

    if (tile.x < 0 || tile.y < 0 || tileRight > region.width || tileBottom > region.height) {
      violations.push({
        code: 'TILE_OUTSIDE_REGION',
        message: `Tile ${tile.id} extends outside ${tile.regionId} region bounds`,
        tile: {
          id: tile.id,
          type: tile.type,
          regionId: tile.regionId,
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height
        },
        page: page.pageIndex,
        context: {
          regionBounds: { width: region.width, height: region.height },
          tileBounds: { right: tileRight, bottom: tileBottom }
        }
      })
    }
  }

  return violations
}

/**
 * INV-2: Check for overlapping tiles with layer awareness.
 * - Overlap allowed if either tile has layer='background'
 * - Overlap NOT allowed if both tiles have layer='content'
 * - Uses final rectangles for collision detection
 */
function checkTileOverlaps(page: PageLayoutV2): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  // Group tiles by region for efficiency
  const tilesByRegion = new Map<string, TileInstanceV2[]>()
  for (const tile of page.tiles) {
    if (!tilesByRegion.has(tile.regionId)) {
      tilesByRegion.set(tile.regionId, [])
    }
    tilesByRegion.get(tile.regionId)!.push(tile)
  }

  // Check overlaps within each region
  for (const [regionId, regionTiles] of Array.from(tilesByRegion.entries())) {
    for (let i = 0; i < regionTiles.length; i++) {
      for (let j = i + 1; j < regionTiles.length; j++) {
        const tileA = regionTiles[i]
        const tileB = regionTiles[j]

        if (tilesOverlap(tileA, tileB) && !checkLayerOverlapAllowed(tileA, tileB)) {
          violations.push({
            code: 'TILES_OVERLAP',
            message: `Tiles ${tileA.id} and ${tileB.id} overlap (both are content layer)`,
            page: page.pageIndex,
            context: {
              tileA: {
                id: tileA.id,
                bounds: { x: tileA.x, y: tileA.y, width: tileA.width, height: tileA.height },
                layer: tileA.layer
              },
              tileB: {
                id: tileB.id,
                bounds: { x: tileB.x, y: tileB.y, width: tileB.width, height: tileB.height },
                layer: tileB.layer
              }
            }
          })
        }
      }
    }
  }

  return violations
}

/**
 * INV-3: Check for widowed section headers (header without items on same page).
 * A section header should always have at least one item from the same section
 * appearing below it on the same page.
 */
function checkNoWidowedSectionHeaders(page: PageLayoutV2): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  const sectionHeaders = page.tiles.filter(t => t.type === 'SECTION_HEADER')

  for (const header of sectionHeaders) {
    const headerContent = header.content as SectionHeaderContentV2
    const sectionId = headerContent.sectionId

    // Find items from the same section that appear below this header
    const itemsBelow = page.tiles.filter(tile => {
      if (tile.type !== 'ITEM_CARD' && tile.type !== 'ITEM_TEXT_ROW') {
        return false
      }

      const itemContent = tile.content as ItemContentV2
      return itemContent.sectionId === sectionId && tile.y > header.y
    })

    if (itemsBelow.length === 0) {
      violations.push({
        code: 'WIDOWED_SECTION_HEADER',
        message: `Section header "${headerContent.label}" has no items on page ${page.pageIndex}`,
        tile: {
          id: header.id,
          type: header.type,
          regionId: header.regionId,
          x: header.x,
          y: header.y,
          width: header.width,
          height: header.height
        },
        page: page.pageIndex,
        context: {
          sectionId,
          headerLabel: headerContent.label,
          isContinuation: headerContent.isContinuation
        }
      })
    }
  }

  return violations
}

/**
 * INV-4: Check that all item tiles (ITEM_CARD, ITEM_TEXT_ROW) are in body region.
 * Menu items should never appear in header, title, or footer regions.
 */
function checkItemTilesInBody(page: PageLayoutV2): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  const itemTiles = page.tiles.filter(
    t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
  )

  for (const tile of itemTiles) {
    if (tile.regionId !== 'body') {
      violations.push({
        code: 'ITEM_NOT_IN_BODY',
        message: `Item tile ${tile.id} is in ${tile.regionId} region, expected body`,
        tile: {
          id: tile.id,
          type: tile.type,
          regionId: tile.regionId,
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height
        },
        page: page.pageIndex,
        context: {
          expectedRegion: 'body',
          actualRegion: tile.regionId
        }
      })
    }
  }

  return violations
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if two tiles overlap using their final bounding boxes.
 * 
 * Two rectangles overlap if they intersect in both x and y dimensions.
 * They do NOT overlap if one is completely to the left, right, above, or below the other.
 */
export function tilesOverlap(a: TileInstanceV2, b: TileInstanceV2): boolean {
  // Check if rectangles are completely separated
  const aRight = a.x + a.width
  const aBottom = a.y + a.height
  const bRight = b.x + b.width
  const bBottom = b.y + b.height

  // No overlap if:
  // - A is completely to the left of B (aRight <= b.x)
  // - B is completely to the left of A (bRight <= a.x)
  // - A is completely above B (aBottom <= b.y)
  // - B is completely above A (bBottom <= a.y)
  return !(aRight <= b.x || bRight <= a.x || aBottom <= b.y || bBottom <= a.y)
}

/**
 * Check if overlap is allowed between two tiles based on their layers.
 * 
 * Overlap is allowed if either tile is a background layer.
 * This allows decorative background elements to underlay content tiles.
 */
export function checkLayerOverlapAllowed(a: TileInstanceV2, b: TileInstanceV2): boolean {
  return a.layer === 'background' || b.layer === 'background'
}