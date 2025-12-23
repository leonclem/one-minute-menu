/**
 * Unit tests for Template Loader V2
 */

import { loadTemplateV2, clearTemplateCache, templateExists, listAvailableTemplates } from '../template-loader-v2'
import { TemplateValidationError } from '../errors-v2'

describe('Template Loader V2', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearTemplateCache()
  })

  describe('loadTemplateV2', () => {
    it('should load and validate a valid template', async () => {
      const template = await loadTemplateV2('test-template')
      
      expect(template.id).toBe('test-template')
      expect(template.version).toBe('1.0.0')
      expect(template.name).toBe('Test Template')
      expect(template.page.size).toBe('A4_PORTRAIT')
      expect(template.body.container.cols).toBe(4)
      expect(template.tiles.ITEM_CARD.rowSpan).toBe(2)
    })

    it('should load and validate the classic-cards-v2 template', async () => {
      const template = await loadTemplateV2('classic-cards-v2')
      
      expect(template.id).toBe('classic-cards-v2')
      expect(template.version).toBe('2.0.0')
      expect(template.name).toBe('Classic Cards V2')
      expect(template.page.size).toBe('A4_PORTRAIT')
      expect(template.body.container.cols).toBe(4)
      expect(template.body.container.rowHeight).toBe(70)
      expect(template.tiles.ITEM_CARD.rowSpan).toBe(2)
      expect(template.tiles.ITEM_TEXT_ROW.rowSpan).toBe(1)
      expect(template.policies.lastRowBalancing).toBe('CENTER')
      expect(template.filler.enabled).toBe(false)
      expect(template.itemIndicators.mode).toBe('INLINE')
    })

    it('should cache templates after first load', async () => {
      // Load template twice
      const template1 = await loadTemplateV2('test-template')
      const template2 = await loadTemplateV2('test-template')
      
      // Should be the same object reference (cached)
      expect(template1).toBe(template2)
    })

    it('should throw TemplateValidationError for non-existent template', async () => {
      await expect(loadTemplateV2('non-existent-template'))
        .rejects
        .toThrow(TemplateValidationError)
    })
  })

  describe('templateExists', () => {
    it('should return true for existing template', async () => {
      const exists = await templateExists('test-template')
      expect(exists).toBe(true)
    })

    it('should return false for non-existent template', async () => {
      const exists = await templateExists('non-existent-template')
      expect(exists).toBe(false)
    })
  })

  describe('listAvailableTemplates', () => {
    it('should list available templates', async () => {
      const templates = await listAvailableTemplates()
      expect(templates).toContain('test-template')
      expect(Array.isArray(templates)).toBe(true)
    })
  })
})