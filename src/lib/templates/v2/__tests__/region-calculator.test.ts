/**
 * Unit tests for Region Calculator
 * 
 * Tests the region partitioning logic for the V2 layout engine.
 */

import { calculateRegions, getBodyRegion, validateRegions } from '../region-calculator'
import { buildPageSpec, PAGE_DIMENSIONS } from '../engine-types-v2'
import type { TemplateV2, PageSpecV2 } from '../engine-types-v2'

// Mock template for testing
const mockTemplate: Pick<TemplateV2, 'regions'> = {
  regions: {
    header: { height: 60 },
    title: { height: 40 },
    footer: { height: 30 },
  },
}

describe('Region Calculator', () => {
  describe('calculateRegions', () => {
    it('should calculate correct regions for A4 portrait with standard margins', () => {
      const pageSpec = buildPageSpec('A4_PORTRAIT', {
        top: 56.69, // 20mm
        right: 42.52, // 15mm
        bottom: 56.69, // 20mm
        left: 42.52, // 15mm
      })

      const regions = calculateRegions(pageSpec, mockTemplate as TemplateV2)

      // Content dimensions: 595.28 - 42.52 - 42.52 = 510.24 width
      // Content height: 841.89 - 56.69 - 56.69 = 728.51 height
      const expectedContentWidth = 510.24
      const expectedContentHeight = 728.51
      const expectedBodyHeight = expectedContentHeight - 60 - 40 - 30 // 598.51

      expect(regions).toHaveLength(4)

      // Header region
      const header = regions.find(r => r.id === 'header')!
      expect(header).toEqual({
        id: 'header',
        x: 0,
        y: 0,
        width: expectedContentWidth,
        height: 60,
      })

      // Title region
      const title = regions.find(r => r.id === 'title')!
      expect(title).toEqual({
        id: 'title',
        x: 0,
        y: 60, // below header
        width: expectedContentWidth,
        height: 40,
      })

      // Body region
      const body = regions.find(r => r.id === 'body')!
      expect(body).toEqual({
        id: 'body',
        x: 0,
        y: 100, // below header + title
        width: expectedContentWidth,
        height: expectedBodyHeight,
      })

      // Footer region
      const footer = regions.find(r => r.id === 'footer')!
      expect(footer).toEqual({
        id: 'footer',
        x: 0,
        y: expectedContentHeight - 30, // anchored to bottom
        width: expectedContentWidth,
        height: 30,
      })
    })

    it('should calculate correct regions for A4 landscape', () => {
      const pageSpec = buildPageSpec('A4_LANDSCAPE', {
        top: 42.52,
        right: 42.52,
        bottom: 42.52,
        left: 42.52,
      })

      const regions = calculateRegions(pageSpec, mockTemplate as TemplateV2)

      // A4 landscape: 841.89 x 595.28
      // Content width: 841.89 - 42.52 - 42.52 = 756.85
      // Content height: 595.28 - 42.52 - 42.52 = 510.24
      const expectedContentWidth = 756.85
      const expectedContentHeight = 510.24

      expect(regions).toHaveLength(4)

      // All regions should span full content width
      regions.forEach(region => {
        expect(region.x).toBe(0)
        expect(region.width).toBeCloseTo(expectedContentWidth, 2)
      })

      // Check stacking
      expect(regions.find(r => r.id === 'header')!.y).toBe(0)
      expect(regions.find(r => r.id === 'title')!.y).toBe(60)
      expect(regions.find(r => r.id === 'body')!.y).toBe(100)
      expect(regions.find(r => r.id === 'footer')!.y).toBeCloseTo(expectedContentHeight - 30, 2)
    })

    it('should throw error when region heights exceed content height', () => {
      const pageSpec: PageSpecV2 = {
        id: 'TINY',
        width: 200,
        height: 100,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
      }

      // Content height would be 80, but regions need 130
      const invalidTemplate = {
        regions: {
          header: { height: 60 },
          title: { height: 40 },
          footer: { height: 30 },
        },
      }

      expect(() => {
        calculateRegions(pageSpec, invalidTemplate as TemplateV2)
      }).toThrow(/body height would be -50pt/)
    })
  })

  describe('getBodyRegion', () => {
    it('should return the body region', () => {
      const pageSpec = buildPageSpec('A4_PORTRAIT', {
        top: 56.69,
        right: 42.52,
        bottom: 56.69,
        left: 42.52,
      })

      const regions = calculateRegions(pageSpec, mockTemplate as TemplateV2)
      const bodyRegion = getBodyRegion(regions)

      expect(bodyRegion.id).toBe('body')
      expect(bodyRegion.x).toBe(0)
      expect(bodyRegion.y).toBe(100) // header + title
    })

    it('should throw error when body region is missing', () => {
      const regions = [
        { id: 'header' as const, x: 0, y: 0, width: 100, height: 50 },
        { id: 'title' as const, x: 0, y: 50, width: 100, height: 30 },
      ]

      expect(() => {
        getBodyRegion(regions)
      }).toThrow('Body region not found')
    })
  })

  describe('validateRegions', () => {
    it('should pass validation for correct regions', () => {
      const pageSpec = buildPageSpec('A4_PORTRAIT', {
        top: 56.69,
        right: 42.52,
        bottom: 56.69,
        left: 42.52,
      })

      const regions = calculateRegions(pageSpec, mockTemplate as TemplateV2)
      const contentHeight = pageSpec.height - pageSpec.margins.top - pageSpec.margins.bottom

      expect(() => {
        validateRegions(regions, contentHeight)
      }).not.toThrow()
    })

    it('should throw error for missing required region', () => {
      const regions = [
        { id: 'header' as const, x: 0, y: 0, width: 100, height: 50 },
        { id: 'title' as const, x: 0, y: 50, width: 100, height: 30 },
        // Missing body and footer
      ]

      expect(() => {
        validateRegions(regions, 100)
      }).toThrow('Missing required region: body')
    })

    it('should throw error for regions with gaps', () => {
      const regions = [
        { id: 'header' as const, x: 0, y: 0, width: 100, height: 50 },
        { id: 'title' as const, x: 0, y: 60, width: 100, height: 30 }, // Gap at y=50-60
        { id: 'body' as const, x: 0, y: 90, width: 100, height: 10 },
        { id: 'footer' as const, x: 0, y: 100, width: 100, height: 10 },
      ]

      expect(() => {
        validateRegions(regions, 110)
      }).toThrow('Region title has y=60, expected y=50')
    })

    it('should throw error for regions not at x=0', () => {
      const regions = [
        { id: 'header' as const, x: 10, y: 0, width: 100, height: 50 }, // x should be 0
        { id: 'title' as const, x: 0, y: 50, width: 100, height: 30 },
        { id: 'body' as const, x: 0, y: 80, width: 100, height: 10 },
        { id: 'footer' as const, x: 0, y: 90, width: 100, height: 10 },
      ]

      expect(() => {
        validateRegions(regions, 100)
      }).toThrow('Region header has x=10, expected x=0')
    })
  })
})