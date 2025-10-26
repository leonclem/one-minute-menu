/**
 * Unit Tests for Layout Selection Engine
 * 
 * Tests the heuristic-based layout preset selection logic with various
 * menu characteristics profiles and output contexts.
 */

import {
  selectLayoutPreset,
  selectLayoutPresetWithContext,
  scorePreset,
  rankPresets,
  explainPresetSelection,
  getSelectionMetadata,
  validatePresetSelection,
  shouldRecommendManualSelection
} from '@/lib/templates/layout-selector'
import type { MenuCharacteristics } from '@/lib/templates/data-transformer'
import type { OutputContext } from '@/lib/templates/types'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'

describe('Layout Selection Engine', () => {
  describe('selectLayoutPreset', () => {
    it('should select Image Forward for high image ratio (>70%)', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      expect(preset.id).toBe('image-forward')
      expect(preset.family).toBe('image-forward')
    })

    it('should select Text Only for zero image ratio', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 4,
        totalItems: 30,
        avgItemsPerSection: 7.5,
        avgNameLength: 20,
        imageRatio: 0,
        hasDescriptions: false
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      expect(preset.id).toBe('text-only')
    })

    it('should select Dense Catalog for low image ratio (<20%)', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 5,
        totalItems: 40,
        avgItemsPerSection: 8,
        avgNameLength: 18,
        imageRatio: 15,
        hasDescriptions: false
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      expect(preset.id).toBe('dense-catalog')
      expect(preset.family).toBe('dense')
    })

    it('should select Dense Catalog for many items (>50) with short names', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 6,
        totalItems: 60,
        avgItemsPerSection: 10,
        avgNameLength: 15,
        imageRatio: 40,
        hasDescriptions: false
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      expect(preset.id).toBe('dense-catalog')
    })

    it('should select Feature Band for few items (<15) with images', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 12,
        avgItemsPerSection: 6,
        avgNameLength: 30,
        imageRatio: 50,
        hasDescriptions: true
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      expect(preset.id).toBe('feature-band')
      expect(preset.family).toBe('feature-band')
    })

    it('should select Balanced as default for mixed content', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      expect(preset.id).toBe('balanced')
      expect(preset.family).toBe('balanced')
    })

    it('should be deterministic with same inputs', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 30,
        avgItemsPerSection: 10,
        avgNameLength: 22,
        imageRatio: 45,
        hasDescriptions: true
      }

      const preset1 = selectLayoutPreset(characteristics, 'desktop')
      const preset2 = selectLayoutPreset(characteristics, 'desktop')
      const preset3 = selectLayoutPreset(characteristics, 'desktop')

      expect(preset1.id).toBe(preset2.id)
      expect(preset2.id).toBe(preset3.id)
    })

    it('should handle edge case: exactly 70% image ratio', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 10,
        avgItemsPerSection: 5,
        avgNameLength: 20,
        imageRatio: 70,
        hasDescriptions: false
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      // Should not trigger high image ratio rule (>70%)
      expect(preset.id).not.toBe('image-forward')
    })

    it('should handle edge case: exactly 20% image ratio', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 10,
        avgItemsPerSection: 5,
        avgNameLength: 20,
        imageRatio: 20,
        hasDescriptions: false
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      // Should not trigger low image ratio rule (<20%)
      expect(preset.id).not.toBe('dense-catalog')
      expect(preset.id).not.toBe('text-only')
    })

    it('should handle edge case: exactly 50 items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 5,
        totalItems: 50,
        avgItemsPerSection: 10,
        avgNameLength: 15,
        imageRatio: 30,
        hasDescriptions: false
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      // Should not trigger many items rule (>50)
      expect(preset.id).toBe('balanced')
    })

    it('should handle edge case: exactly 15 items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 15,
        avgItemsPerSection: 7.5,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      const preset = selectLayoutPreset(characteristics, 'desktop')

      // Should not trigger few items rule (<15)
      expect(preset.id).not.toBe('feature-band')
    })
  })

  describe('selectLayoutPresetWithContext', () => {
    it('should adjust Feature Band to Balanced for print with many items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 12,
        avgItemsPerSection: 6,
        avgNameLength: 30,
        imageRatio: 50,
        hasDescriptions: true
      }

      const desktopPreset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const printPreset = selectLayoutPresetWithContext(characteristics, 'print')

      expect(desktopPreset.id).toBe('feature-band')
      expect(printPreset.id).toBe('balanced') // Adjusted for print
    })

    it('should adjust Feature Band to Balanced for mobile with many items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 13,
        avgItemsPerSection: 6.5,
        avgNameLength: 30,
        imageRatio: 50,
        hasDescriptions: true
      }

      const desktopPreset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const mobilePreset = selectLayoutPresetWithContext(characteristics, 'mobile')

      expect(desktopPreset.id).toBe('feature-band')
      expect(mobilePreset.id).toBe('balanced') // Adjusted for mobile
    })

    it('should not adjust for tablet and desktop contexts', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 12,
        avgItemsPerSection: 6,
        avgNameLength: 30,
        imageRatio: 50,
        hasDescriptions: true
      }

      const tabletPreset = selectLayoutPresetWithContext(characteristics, 'tablet')
      const desktopPreset = selectLayoutPresetWithContext(characteristics, 'desktop')

      expect(tabletPreset.id).toBe('feature-band')
      expect(desktopPreset.id).toBe('feature-band')
    })

    it('should keep Feature Band for print with few items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 1,
        totalItems: 8,
        avgItemsPerSection: 8,
        avgNameLength: 30,
        imageRatio: 60,
        hasDescriptions: true
      }

      const printPreset = selectLayoutPresetWithContext(characteristics, 'print')

      expect(printPreset.id).toBe('feature-band')
    })
  })

  describe('scorePreset', () => {
    it('should give high score to Image Forward for high image ratio', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const imageForwardScore = scorePreset(LAYOUT_PRESETS['image-forward'], characteristics)
      const denseScore = scorePreset(LAYOUT_PRESETS['dense-catalog'], characteristics)

      expect(imageForwardScore).toBeGreaterThan(denseScore)
      expect(imageForwardScore).toBeGreaterThan(70)
    })

    it('should give high score to Dense Catalog for many items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 6,
        totalItems: 60,
        avgItemsPerSection: 10,
        avgNameLength: 15,
        imageRatio: 30,
        hasDescriptions: false
      }

      const denseScore = scorePreset(LAYOUT_PRESETS['dense-catalog'], characteristics)
      const featureScore = scorePreset(LAYOUT_PRESETS['feature-band'], characteristics)

      expect(denseScore).toBeGreaterThan(featureScore)
      expect(denseScore).toBeGreaterThan(70)
    })

    it('should give high score to Feature Band for few items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 10,
        avgItemsPerSection: 5,
        avgNameLength: 30,
        imageRatio: 60,
        hasDescriptions: true
      }

      const featureScore = scorePreset(LAYOUT_PRESETS['feature-band'], characteristics)
      const denseScore = scorePreset(LAYOUT_PRESETS['dense-catalog'], characteristics)

      expect(featureScore).toBeGreaterThan(denseScore)
      expect(featureScore).toBeGreaterThan(70)
    })

    it('should give high score to Text Only for zero images', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 4,
        totalItems: 30,
        avgItemsPerSection: 7.5,
        avgNameLength: 20,
        imageRatio: 0,
        hasDescriptions: false
      }

      const textOnlyScore = scorePreset(LAYOUT_PRESETS['text-only'], characteristics)
      const imageForwardScore = scorePreset(LAYOUT_PRESETS['image-forward'], characteristics)

      expect(textOnlyScore).toBeGreaterThan(imageForwardScore)
      expect(textOnlyScore).toBeGreaterThan(80)
    })

    it('should give moderate score to Balanced for mixed content', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      const balancedScore = scorePreset(LAYOUT_PRESETS['balanced'], characteristics)

      expect(balancedScore).toBeGreaterThan(60)
      expect(balancedScore).toBeLessThan(90)
    })

    it('should clamp scores to 0-100 range', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 1,
        totalItems: 5,
        avgItemsPerSection: 5,
        avgNameLength: 10,
        imageRatio: 0,
        hasDescriptions: false
      }

      const allPresets = Object.values(LAYOUT_PRESETS)
      
      for (const preset of allPresets) {
        const score = scorePreset(preset, characteristics)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('rankPresets', () => {
    it('should rank presets by score in descending order', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const ranked = rankPresets(characteristics)

      expect(ranked).toHaveLength(5) // All 5 presets
      expect(ranked[0].preset.id).toBe('image-forward') // Highest score
      
      // Verify descending order
      for (let i = 0; i < ranked.length - 1; i++) {
        expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score)
      }
    })

    it('should include all presets in ranking', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      const ranked = rankPresets(characteristics)

      const presetIds = ranked.map(r => r.preset.id)
      expect(presetIds).toContain('dense-catalog')
      expect(presetIds).toContain('image-forward')
      expect(presetIds).toContain('balanced')
      expect(presetIds).toContain('feature-band')
      expect(presetIds).toContain('text-only')
    })

    it('should have consistent ranking for same inputs', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 30,
        avgItemsPerSection: 10,
        avgNameLength: 22,
        imageRatio: 45,
        hasDescriptions: true
      }

      const ranked1 = rankPresets(characteristics)
      const ranked2 = rankPresets(characteristics)

      expect(ranked1[0].preset.id).toBe(ranked2[0].preset.id)
      expect(ranked1[0].score).toBe(ranked2[0].score)
    })
  })

  describe('explainPresetSelection', () => {
    it('should explain Image Forward selection', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const explanation = explainPresetSelection(LAYOUT_PRESETS['image-forward'], characteristics)

      expect(explanation).toContain('High image ratio')
      expect(explanation).toContain('80%')
      expect(explanation).toContain('visual content')
    })

    it('should explain Dense Catalog selection', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 6,
        totalItems: 60,
        avgItemsPerSection: 10,
        avgNameLength: 15,
        imageRatio: 15,
        hasDescriptions: false
      }

      const explanation = explainPresetSelection(LAYOUT_PRESETS['dense-catalog'], characteristics)

      expect(explanation).toContain('Large menu')
      expect(explanation).toContain('60 items')
      expect(explanation).toContain('Short item names')
      expect(explanation).toContain('Low image ratio')
    })

    it('should explain Feature Band selection', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 2,
        totalItems: 10,
        avgItemsPerSection: 5,
        avgNameLength: 30,
        imageRatio: 60,
        hasDescriptions: true
      }

      const explanation = explainPresetSelection(LAYOUT_PRESETS['feature-band'], characteristics)

      expect(explanation).toContain('Small menu')
      expect(explanation).toContain('10 items')
      expect(explanation).toContain('Good image coverage')
      expect(explanation).toContain('premium items')
    })

    it('should explain Text Only selection', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 4,
        totalItems: 30,
        avgItemsPerSection: 7.5,
        avgNameLength: 20,
        imageRatio: 0,
        hasDescriptions: false
      }

      const explanation = explainPresetSelection(LAYOUT_PRESETS['text-only'], characteristics)

      expect(explanation).toContain('No images')
      expect(explanation).toContain('text-based')
    })

    it('should explain Balanced selection', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      const explanation = explainPresetSelection(LAYOUT_PRESETS['balanced'], characteristics)

      expect(explanation).toContain('Versatile')
      expect(explanation).toContain('mixed content')
    })
  })

  describe('getSelectionMetadata', () => {
    it('should return complete metadata', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const preset = LAYOUT_PRESETS['image-forward']
      const metadata = getSelectionMetadata(preset, characteristics, 'desktop')

      expect(metadata.presetId).toBe('image-forward')
      expect(metadata.presetName).toBe('Image Forward')
      expect(metadata.presetFamily).toBe('image-forward')
      expect(metadata.score).toBeGreaterThan(0)
      expect(metadata.characteristics).toEqual(characteristics)
      expect(metadata.context).toBe('desktop')
      expect(metadata.explanation).toBeTruthy()
      expect(metadata.timestamp).toBeInstanceOf(Date)
    })

    it('should include accurate score', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const preset = LAYOUT_PRESETS['image-forward']
      const metadata = getSelectionMetadata(preset, characteristics, 'desktop')
      const directScore = scorePreset(preset, characteristics)

      expect(metadata.score).toBe(directScore)
    })
  })

  describe('validatePresetSelection', () => {
    it('should warn when Image Forward has low image ratio', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 25,
        hasDescriptions: true
      }

      const warnings = validatePresetSelection(LAYOUT_PRESETS['image-forward'], characteristics)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('Image Forward')
      expect(warnings[0]).toContain('25%')
    })

    it('should warn when Text Only has images', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 30,
        hasDescriptions: false
      }

      const warnings = validatePresetSelection(LAYOUT_PRESETS['text-only'], characteristics)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('Text Only')
      expect(warnings[0]).toContain('30%')
    })

    it('should warn when Feature Band has many items', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 30,
        avgItemsPerSection: 10,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      const warnings = validatePresetSelection(LAYOUT_PRESETS['feature-band'], characteristics)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('Feature Band')
      expect(warnings[0]).toContain('30 items')
    })

    it('should warn when Dense Catalog has long names', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 5,
        totalItems: 60,
        avgItemsPerSection: 12,
        avgNameLength: 45,
        imageRatio: 15,
        hasDescriptions: false
      }

      const warnings = validatePresetSelection(LAYOUT_PRESETS['dense-catalog'], characteristics)

      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain('Dense Catalog')
      expect(warnings[0]).toContain('45 chars')
    })

    it('should return no warnings for appropriate selections', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 20,
        avgItemsPerSection: 6.67,
        avgNameLength: 25,
        imageRatio: 80,
        hasDescriptions: true
      }

      const warnings = validatePresetSelection(LAYOUT_PRESETS['image-forward'], characteristics)

      expect(warnings).toHaveLength(0)
    })
  })

  describe('shouldRecommendManualSelection', () => {
    it('should recommend manual selection for very small menus', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 1,
        totalItems: 3,
        avgItemsPerSection: 3,
        avgNameLength: 20,
        imageRatio: 50,
        hasDescriptions: false
      }

      expect(shouldRecommendManualSelection(characteristics)).toBe(true)
    })

    it('should recommend manual selection for very large menus', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 10,
        totalItems: 120,
        avgItemsPerSection: 12,
        avgNameLength: 20,
        imageRatio: 50,
        hasDescriptions: true
      }

      expect(shouldRecommendManualSelection(characteristics)).toBe(true)
    })

    it('should recommend manual selection for unusual image ratios', () => {
      const characteristics1: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 20,
        imageRatio: 25, // Between 20-30
        hasDescriptions: false
      }

      const characteristics2: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 20,
        imageRatio: 75, // Between 70-80
        hasDescriptions: false
      }

      expect(shouldRecommendManualSelection(characteristics1)).toBe(true)
      expect(shouldRecommendManualSelection(characteristics2)).toBe(true)
    })

    it('should recommend manual selection for very long names', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 55,
        imageRatio: 50,
        hasDescriptions: true
      }

      expect(shouldRecommendManualSelection(characteristics)).toBe(true)
    })

    it('should not recommend manual selection for typical menus', () => {
      const characteristics: MenuCharacteristics = {
        sectionCount: 3,
        totalItems: 25,
        avgItemsPerSection: 8.33,
        avgNameLength: 25,
        imageRatio: 50,
        hasDescriptions: true
      }

      expect(shouldRecommendManualSelection(characteristics)).toBe(false)
    })
  })
})
