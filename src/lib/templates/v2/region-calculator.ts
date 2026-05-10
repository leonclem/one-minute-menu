/**
 * Region Calculator for GridMenu V2 Layout Engine
 *
 * This module handles the partitioning of pages into regions (header, title, banner, body, footer).
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
 * @param showMenuTitle - Whether to show the menu title (affects region sizing)
 * @param bannerHeight - Optional banner region height in points (0 = no banner region)
 * @returns Array of RegionV2 objects with content-box relative coordinates
 */
export function calculateRegions(
  pageSpec: PageSpecV2,
  template: TemplateV2,
  showMenuTitle: boolean = true,
  bannerHeight: number = 0,
  options?: {
    headerHeightOverride?: number
  }
): RegionV2[] {
  // Calculate content box dimensions (after margins)
  const contentWidth = pageSpec.width - pageSpec.margins.left - pageSpec.margins.right
  const contentHeight = pageSpec.height - pageSpec.margins.top - pageSpec.margins.bottom

  // Extract region heights from template
  // When a banner is present, the header logo is suppressed and the banner renders
  // full-bleed (outside the content-box), so collapse header height to 0.
  const headerHeight = bannerHeight > 0
    ? 0
    : options?.headerHeightOverride ?? template.regions.header.height
  const titleHeight = showMenuTitle ? template.regions.title.height : 0
  const footerHeight = template.regions.footer.height

  // When banner is full-bleed, it doesn't consume content-box space — the body
  // starts at the top of the content-box (below header/title only).
  // The full-bleed banner overlaps the top margin area visually.
  // We push the body down by (bannerHeight - margins.top) so it starts below the banner.
  const bannerBodyOffset = bannerHeight > 0
    ? Math.max(0, bannerHeight - pageSpec.margins.top)
    : 0
  const bodyHeight = contentHeight - headerHeight - titleHeight - bannerBodyOffset - footerHeight

  // Validate that body height is positive
  if (bodyHeight <= 0) {
    throw new Error(
      `Invalid template configuration: body height would be ${bodyHeight}pt. ` +
      `Total region heights (${headerHeight + titleHeight + bannerBodyOffset + footerHeight}pt) ` +
      `exceed content height (${contentHeight}pt).`
    )
  }

  // Position the title below the banner if banner is present, otherwise below the header
  const titleY = headerHeight + bannerBodyOffset
  const bodyY = titleY + titleHeight

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
      y: titleY, // below banner (or header when no banner)
      width: contentWidth,
      height: titleHeight, // Will be 0 if showMenuTitle is false
    },
    {
      id: 'body',
      x: 0,
      y: bodyY,
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

  // Insert banner region when banner height > 0.
  // Banner renders full-bleed in the web/PDF renderer so its y here is used
  // only for tile placement reference; the renderer overrides its position.
  if (bannerHeight > 0) {
    regions.splice(2, 0, {
      id: 'banner',
      x: 0,
      y: 0, // placeholder — full-bleed renderer positions this at page top
      width: contentWidth,
      height: bannerHeight,
    })
  }

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
 * @param allowZeroHeightTitle - Whether to allow title region with height 0
 * @throws Error if validation fails
 */
export function validateRegions(
  regions: RegionV2[], 
  contentHeight: number, 
  allowZeroHeightTitle: boolean = false
): void {
  // Check that all required regions exist (banner is optional)
  const requiredRegions: RegionV2['id'][] = ['header', 'title', 'body', 'footer']
  for (const regionId of requiredRegions) {
    const region = regions.find(r => r.id === regionId)
    if (!region) {
      throw new Error(`Missing required region: ${regionId}`)
    }
    
    // Special case: title region can have height 0 when menu title is hidden
    if (regionId === 'title' && region.height === 0 && !allowZeroHeightTitle) {
      throw new Error('Title region has height 0 but allowZeroHeightTitle is false')
    }
  }

  // Banner is full-bleed and not part of the content-box stacking — exclude from stacking check
  const stackedRegions = regions.filter(r => r.id !== 'banner')
  const sortedRegions = [...stackedRegions].sort((a, b) => a.y - b.y)
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

  // Check that stacked regions cover the full content height
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