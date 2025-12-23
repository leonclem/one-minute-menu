/**
 * Region Calculator for GridMenu V2 Layout Engine
 *
 * This module handles the partitioning of pages into regions (header, title, body, footer).
 * All coordinates are CONTENT-BOX RELATIVE, meaning they are relative to the content box
 * origin (0,0) after page margins are applied.
 *
 * KEY DESIGN DECISIONS:
 * 1. All region coordinates are content-box relative (x=0 for all regions)
 * 2. Regions are stacked vertically within the content box
 * 3. Body height is computed as remaining space after other regions
 * 4. Renderer applies page margins once at the content-box wrapper level
 */

import type { PageSpecV2, RegionV2, TemplateV2 } from './engine-types-v2'

/**
 * Calculate region rectangles in CONTENT-BOX RELATIVE coordinates.
 *
 * DESIGN DECISION: All region coordinates are relative to the content box origin (0,0).
 * - x = 0 for all regions (they span full content width)
 * - y is stacked within the content box (header at 0, title below header, etc.)
 * - The RENDERER applies page margins once at the content-box wrapper level
 * - This prevents double-offset bugs and keeps layout math simple
 *
 * Absolute page position = pageMargins.left + region.x + tile.x (for x-axis)
 * Absolute page position = pageMargins.top + region.y + tile.y (for y-axis)
 *
 * @param pageSpec - Page specification with dimensions and margins
 * @param template - Template configuration with region heights
 * @returns Array of RegionV2 objects with content-box relative coordinates
 */
export function calculateRegions(
  pageSpec: PageSpecV2,
  template: TemplateV2
): RegionV2[] {
  // Calculate content box dimensions (after margins)
  const contentWidth = pageSpec.width - pageSpec.margins.left - pageSpec.margins.right
  const contentHeight = pageSpec.height - pageSpec.margins.top - pageSpec.margins.bottom

  // Extract region heights from template
  const headerHeight = template.regions.header.height
  const titleHeight = template.regions.title.height
  const footerHeight = template.regions.footer.height

  // Body height is computed as remaining space
  const bodyHeight = contentHeight - headerHeight - titleHeight - footerHeight

  // Validate that body height is positive
  if (bodyHeight <= 0) {
    throw new Error(
      `Invalid template configuration: body height would be ${bodyHeight}pt. ` +
      `Total region heights (${headerHeight + titleHeight + footerHeight}pt) ` +
      `exceed content height (${contentHeight}pt).`
    )
  }

  // All coordinates are CONTENT-BOX RELATIVE (x=0, y stacked from 0)
  const regions: RegionV2[] = [
    {
      id: 'header',
      x: 0, // content-box relative
      y: 0, // starts at top of content box
      width: contentWidth,
      height: headerHeight,
    },
    {
      id: 'title',
      x: 0,
      y: headerHeight, // stacked below header
      width: contentWidth,
      height: titleHeight,
    },
    {
      id: 'body',
      x: 0,
      y: headerHeight + titleHeight, // stacked below title
      width: contentWidth,
      height: bodyHeight,
    },
    {
      id: 'footer',
      x: 0,
      y: contentHeight - footerHeight, // anchored to bottom of content box
      width: contentWidth,
      height: footerHeight,
    },
  ]

  return regions
}

/**
 * Get the body region from a regions array.
 * Convenience function for accessing the body region specifically.
 *
 * @param regions - Array of regions
 * @returns The body region
 * @throws Error if body region is not found
 */
export function getBodyRegion(regions: RegionV2[]): RegionV2 {
  const bodyRegion = regions.find(r => r.id === 'body')
  if (!bodyRegion) {
    throw new Error('Body region not found in regions array')
  }
  return bodyRegion
}

/**
 * Validate that regions are properly configured.
 * Checks for common configuration errors.
 *
 * @param regions - Array of regions to validate
 * @param contentHeight - Total content height for validation
 * @throws Error if validation fails
 */
export function validateRegions(regions: RegionV2[], contentHeight: number): void {
  // Check that all required regions exist
  const requiredRegions: RegionV2['id'][] = ['header', 'title', 'body', 'footer']
  for (const regionId of requiredRegions) {
    if (!regions.find(r => r.id === regionId)) {
      throw new Error(`Missing required region: ${regionId}`)
    }
  }

  // Check that regions don't overlap and cover the full content height
  const sortedRegions = [...regions].sort((a, b) => a.y - b.y)
  let expectedY = 0

  for (const region of sortedRegions) {
    if (region.y !== expectedY) {
      throw new Error(
        `Region ${region.id} has y=${region.y}, expected y=${expectedY}. ` +
        'Regions must be stacked without gaps or overlaps.'
      )
    }
    expectedY += region.height
  }

  // Check that total height matches content height
  if (expectedY !== contentHeight) {
    throw new Error(
      `Total region height (${expectedY}pt) does not match content height (${contentHeight}pt)`
    )
  }

  // Check that all regions have x=0 (content-box relative)
  for (const region of regions) {
    if (region.x !== 0) {
      throw new Error(
        `Region ${region.id} has x=${region.x}, expected x=0. ` +
        'All regions must be content-box relative with x=0.'
      )
    }
  }
}