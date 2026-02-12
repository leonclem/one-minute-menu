/**
 * Unit tests for new page dimensions (A3, HALF_A4_TALL)
 * Requirements: 3.1, 3.2, 3.6, 3.7, 5.1, 5.3
 */

import { PAGE_DIMENSIONS, buildPageSpec } from '../engine-types-v2'
import { TemplateSchemaV2 } from '../template-schema-v2'
import { clearTemplateCache } from '../template-loader-v2'

describe('Page Dimensions - A3 and HALF_A4_TALL', () => {
  describe('PAGE_DIMENSIONS constants', () => {
    it('should include A3_PORTRAIT with correct dimensions', () => {
      expect(PAGE_DIMENSIONS.A3_PORTRAIT).toEqual({
        id: 'A3_PORTRAIT',
        width: 841.89,
        height: 1190.55,
      })
    })

    it('should include A3_LANDSCAPE with correct dimensions', () => {
      expect(PAGE_DIMENSIONS.A3_LANDSCAPE).toEqual({
        id: 'A3_LANDSCAPE',
        width: 1190.55,
        height: 841.89,
      })
    })

    it('should include HALF_A4_TALL with correct dimensions', () => {
      expect(PAGE_DIMENSIONS.HALF_A4_TALL).toEqual({
        id: 'HALF_A4_TALL',
        width: 297.64,
        height: 841.89,
      })
    })

    it('should preserve existing A4 dimensions unchanged', () => {
      expect(PAGE_DIMENSIONS.A4_PORTRAIT).toEqual({
        id: 'A4_PORTRAIT',
        width: 595.28,
        height: 841.89,
      })
      expect(PAGE_DIMENSIONS.A4_LANDSCAPE).toEqual({
        id: 'A4_LANDSCAPE',
        width: 841.89,
        height: 595.28,
      })
    })
  })

  describe('buildPageSpec', () => {
    const defaultMargins = { top: 20, right: 20, bottom: 20, left: 20 }

    it('should return correct spec for A3_PORTRAIT', () => {
      const spec = buildPageSpec('A3_PORTRAIT', defaultMargins)
      expect(spec.id).toBe('A3_PORTRAIT')
      expect(spec.width).toBe(841.89)
      expect(spec.height).toBe(1190.55)
      expect(spec.margins).toEqual(defaultMargins)
    })

    it('should return correct spec for A3_LANDSCAPE', () => {
      const spec = buildPageSpec('A3_LANDSCAPE', defaultMargins)
      expect(spec.id).toBe('A3_LANDSCAPE')
      expect(spec.width).toBe(1190.55)
      expect(spec.height).toBe(841.89)
      expect(spec.margins).toEqual(defaultMargins)
    })

    it('should return correct spec for HALF_A4_TALL', () => {
      const spec = buildPageSpec('HALF_A4_TALL', defaultMargins)
      expect(spec.id).toBe('HALF_A4_TALL')
      expect(spec.width).toBe(297.64)
      expect(spec.height).toBe(841.89)
      expect(spec.margins).toEqual(defaultMargins)
    })
  })

  describe('Template schema page.size enum', () => {
    // Minimal valid template structure for schema testing
    const baseTemplate = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      page: {
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
      },
      regions: {
        header: { height: 60 },
        title: { height: 40 },
        footer: { height: 30 },
      },
      body: {
        container: { type: 'GRID', cols: 4, rowHeight: 70, gapX: 8, gapY: 8 },
      },
      tiles: {
        LOGO: { region: 'header', contentBudget: { nameLines: 0, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 50, paddingTop: 5, paddingBottom: 5, totalHeight: 60 } },
        TITLE: { region: 'title', contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 40 } },
        SECTION_HEADER: { region: 'body', colSpan: 4, contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 4, totalHeight: 32 } },
        ITEM_CARD: { region: 'body', rowSpan: 2, contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 70, paddingTop: 8, paddingBottom: 8, totalHeight: 148 } },
        ITEM_TEXT_ROW: { region: 'body', rowSpan: 1, contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 70 } },
      },
      policies: {
        lastRowBalancing: 'CENTER',
        showLogoOnPages: ['FIRST', 'SINGLE'],
        repeatSectionHeaderOnContinuation: true,
        sectionHeaderKeepWithNextItems: 1,
      },
      filler: {
        enabled: false,
        safeZones: [{ startRow: 'LAST', endRow: 'LAST', startCol: 0, endCol: 3 }],
        tiles: [{ id: 'f1', style: 'icon', content: 'utensils' }],
        policy: 'SEQUENTIAL',
      },
      itemIndicators: {
        mode: 'INLINE',
        maxCount: 3,
        style: { badgeSize: 14, iconSet: 'emoji' },
        spiceScale: { '1': '🌶' },
        letterFallback: { vegetarian: 'V' },
      },
    }

    it('should accept A3_PORTRAIT as page size', () => {
      const result = TemplateSchemaV2.safeParse({ ...baseTemplate, page: { ...baseTemplate.page, size: 'A3_PORTRAIT' } })
      expect(result.success).toBe(true)
    })

    it('should accept A3_LANDSCAPE as page size', () => {
      const result = TemplateSchemaV2.safeParse({ ...baseTemplate, page: { ...baseTemplate.page, size: 'A3_LANDSCAPE' } })
      expect(result.success).toBe(true)
    })

    it('should accept HALF_A4_TALL as page size', () => {
      const result = TemplateSchemaV2.safeParse({ ...baseTemplate, page: { ...baseTemplate.page, size: 'HALF_A4_TALL' } })
      expect(result.success).toBe(true)
    })

    it('should still accept existing A4_PORTRAIT', () => {
      const result = TemplateSchemaV2.safeParse({ ...baseTemplate, page: { ...baseTemplate.page, size: 'A4_PORTRAIT' } })
      expect(result.success).toBe(true)
    })

    it('should reject invalid page size', () => {
      const result = TemplateSchemaV2.safeParse({ ...baseTemplate, page: { ...baseTemplate.page, size: 'TABLOID' } })
      expect(result.success).toBe(false)
    })

    it('should reject empty page size', () => {
      const result = TemplateSchemaV2.safeParse({ ...baseTemplate, page: { ...baseTemplate.page, size: '' } })
      expect(result.success).toBe(false)
    })
  })

  describe('Region height validation with A3', () => {
    beforeEach(() => {
      clearTemplateCache()
    })

    it('should allow larger region heights for A3 pages', () => {
      // A3_PORTRAIT height is 1190.55pt, so 60% = ~714pt
      // Region heights totaling 600pt should be valid for A3 but would fail for A4
      const template = {
        id: 'test-a3',
        version: '1.0.0',
        name: 'Test A3',
        page: {
          size: 'A3_PORTRAIT',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
        },
        regions: {
          header: { height: 200 },
          title: { height: 200 },
          footer: { height: 200 },
        },
        body: {
          container: { type: 'GRID', cols: 4, rowHeight: 70, gapX: 8, gapY: 8 },
        },
        tiles: {
          LOGO: { region: 'header', contentBudget: { nameLines: 0, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 50, paddingTop: 5, paddingBottom: 5, totalHeight: 60 } },
          TITLE: { region: 'title', contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 40 } },
          SECTION_HEADER: { region: 'body', colSpan: 4, contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 4, totalHeight: 32 } },
          ITEM_CARD: { region: 'body', rowSpan: 2, contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 70, paddingTop: 8, paddingBottom: 8, totalHeight: 148 } },
          ITEM_TEXT_ROW: { region: 'body', rowSpan: 1, contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 70 } },
        },
        policies: {
          lastRowBalancing: 'CENTER',
          showLogoOnPages: ['FIRST', 'SINGLE'],
          repeatSectionHeaderOnContinuation: true,
          sectionHeaderKeepWithNextItems: 1,
        },
        filler: {
          enabled: false,
          safeZones: [{ startRow: 'LAST', endRow: 'LAST', startCol: 0, endCol: 3 }],
          tiles: [{ id: 'f1', style: 'icon', content: 'utensils' }],
          policy: 'SEQUENTIAL',
        },
        itemIndicators: {
          mode: 'INLINE',
          maxCount: 3,
          style: { badgeSize: 14, iconSet: 'emoji' },
          spiceScale: { '1': '🌶' },
          letterFallback: { vegetarian: 'V' },
        },
      }

      // Schema should accept this (600pt total regions is valid for A3)
      const result = TemplateSchemaV2.safeParse(template)
      expect(result.success).toBe(true)
    })
  })
})
