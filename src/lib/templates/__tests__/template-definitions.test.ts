/**
 * Template Definitions Tests
 * 
 * Tests for template definitions and registry
 */

import { describe, it, expect } from '@jest/globals'
import {
  CLASSIC_GRID_CARDS,
  TWO_COLUMN_TEXT,
  SIMPLE_ROWS,
  TEMPLATE_REGISTRY,
  getMvpTemplates
} from '../template-definitions'
import { validateTemplate } from '../template-validator'

describe('Template Definitions', () => {
  describe('CLASSIC_GRID_CARDS', () => {
    it('should pass validation', () => {
      expect(() => validateTemplate(CLASSIC_GRID_CARDS)).not.toThrow()
    })

    it('should have correct structure', () => {
      expect(CLASSIC_GRID_CARDS.id).toBe('classic-grid-cards')
      expect(CLASSIC_GRID_CARDS.name).toBe('Classic Grid Cards')
      expect(CLASSIC_GRID_CARDS.layout.baseCols).toBe(4)
      expect(CLASSIC_GRID_CARDS.layout.tiles.length).toBeGreaterThan(0)
    })

    it('should support images', () => {
      expect(CLASSIC_GRID_CARDS.capabilities.supportsImages).toBe(true)
    })

    it('should support text-only mode', () => {
      expect(CLASSIC_GRID_CARDS.capabilities.supportsTextOnlyMode).toBe(true)
    })

    it('should have repeat pattern', () => {
      expect(CLASSIC_GRID_CARDS.layout.repeatPattern).toBeDefined()
      expect(CLASSIC_GRID_CARDS.layout.repeatPattern?.repeatItemTileIds.length).toBeGreaterThan(0)
    })
  })

  describe('TWO_COLUMN_TEXT', () => {
    it('should pass validation', () => {
      expect(() => validateTemplate(TWO_COLUMN_TEXT)).not.toThrow()
    })

    it('should have correct structure', () => {
      expect(TWO_COLUMN_TEXT.id).toBe('two-column-text')
      expect(TWO_COLUMN_TEXT.name).toBe('Two-Column Text')
      expect(TWO_COLUMN_TEXT.layout.baseCols).toBe(2)
      expect(TWO_COLUMN_TEXT.layout.tiles.length).toBeGreaterThan(0)
    })

    it('should not support images', () => {
      expect(TWO_COLUMN_TEXT.capabilities.supportsImages).toBe(false)
    })

    it('should handle up to 150 items (tank template)', () => {
      expect(TWO_COLUMN_TEXT.constraints.hardMaxItems).toBe(150)
      expect(TWO_COLUMN_TEXT.constraints.minItems).toBe(1)
    })

    it('should have repeat pattern', () => {
      expect(TWO_COLUMN_TEXT.layout.repeatPattern).toBeDefined()
    })
  })

  describe('SIMPLE_ROWS', () => {
    it('should pass validation', () => {
      expect(() => validateTemplate(SIMPLE_ROWS)).not.toThrow()
    })

    it('should have correct structure', () => {
      expect(SIMPLE_ROWS.id).toBe('simple-rows')
      expect(SIMPLE_ROWS.name).toBe('Simple Rows')
      expect(SIMPLE_ROWS.layout.baseCols).toBe(1)
      expect(SIMPLE_ROWS.layout.tiles.length).toBeGreaterThan(0)
    })

    it('should support images', () => {
      expect(SIMPLE_ROWS.capabilities.supportsImages).toBe(true)
    })

    it('should support responsive web', () => {
      expect(SIMPLE_ROWS.capabilities.supportsResponsiveWeb).toBe(true)
    })

    it('should have repeat pattern', () => {
      expect(SIMPLE_ROWS.layout.repeatPattern).toBeDefined()
    })
  })

  describe('TEMPLATE_REGISTRY', () => {
    it('should contain all MVP templates', () => {
      expect(TEMPLATE_REGISTRY['classic-grid-cards']).toBeDefined()
      expect(TEMPLATE_REGISTRY['two-column-text']).toBeDefined()
      expect(TEMPLATE_REGISTRY['simple-rows']).toBeDefined()
    })

    it('should have at least 3 templates', () => {
      expect(Object.keys(TEMPLATE_REGISTRY).length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('getMvpTemplates', () => {
    it('should return all templates when none are marked post-MVP', () => {
      const mvpTemplates = getMvpTemplates()
      expect(mvpTemplates.length).toBe(3)
    })

    it('should filter out post-MVP templates', () => {
      const mvpTemplates = getMvpTemplates()
      mvpTemplates.forEach(template => {
        expect(template.isPostMvp).not.toBe(true)
      })
    })

    it('should return templates with complete structure', () => {
      const mvpTemplates = getMvpTemplates()
      mvpTemplates.forEach(template => {
        expect(template.id).toBeDefined()
        expect(template.name).toBeDefined()
        expect(template.layout).toBeDefined()
        expect(template.constraints).toBeDefined()
        expect(template.capabilities).toBeDefined()
      })
    })
  })
})
