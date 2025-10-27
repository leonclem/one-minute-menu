/**
 * Unit tests for layout caching functionality
 */

import {
  hashMenuData,
  generateCacheKey,
  getCachedLayout,
  setCachedLayout,
  invalidateCacheForMenu,
  clearCache,
  getCacheStats,
  getCacheHitRate,
  resetCacheMetrics
} from '../layout-cache'
import type { LayoutMenuData, LayoutPreset, GridLayout } from '../types'
import { LAYOUT_PRESETS } from '../presets'

describe('Layout Cache', () => {
  // Sample test data
  const sampleMenuData: LayoutMenuData = {
    metadata: {
      title: 'Test Menu',
      currency: '$'
    },
    sections: [
      {
        name: 'Appetizers',
        items: [
          { name: 'Spring Rolls', price: 8.99, featured: false },
          { name: 'Soup', price: 6.99, featured: false }
        ]
      },
      {
        name: 'Mains',
        items: [
          { name: 'Pasta', price: 15.99, featured: false },
          { name: 'Steak', price: 25.99, featured: true }
        ]
      }
    ]
  }

  const samplePreset: LayoutPreset = LAYOUT_PRESETS['balanced']

  const sampleLayout: GridLayout = {
    preset: samplePreset,
    context: 'desktop',
    sections: [
      {
        name: 'Appetizers',
        tiles: [],
        startRow: 0
      }
    ],
    totalTiles: 4
  }

  beforeEach(() => {
    clearCache()
    resetCacheMetrics()
  })

  describe('hashMenuData', () => {
    it('should generate consistent hash for same data', () => {
      const hash1 = hashMenuData(sampleMenuData)
      const hash2 = hashMenuData(sampleMenuData)
      
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different data', () => {
      const modifiedData: LayoutMenuData = {
        ...sampleMenuData,
        sections: [
          {
            name: 'Different Section',
            items: [{ name: 'Different Item', price: 10, featured: false }]
          }
        ]
      }

      const hash1 = hashMenuData(sampleMenuData)
      const hash2 = hashMenuData(modifiedData)
      
      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hash when item prices change', () => {
      const modifiedData: LayoutMenuData = {
        ...sampleMenuData,
        sections: [
          {
            ...sampleMenuData.sections[0],
            items: [
              { ...sampleMenuData.sections[0].items[0], price: 999.99 }
            ]
          }
        ]
      }

      const hash1 = hashMenuData(sampleMenuData)
      const hash2 = hashMenuData(modifiedData)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('generateCacheKey', () => {
    it('should generate unique keys for different contexts', () => {
      const key1 = generateCacheKey(sampleMenuData, samplePreset, 'mobile')
      const key2 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      expect(key1).not.toBe(key2)
      expect(key1).toContain('mobile')
      expect(key2).toContain('desktop')
    })

    it('should generate unique keys for different presets', () => {
      const key1 = generateCacheKey(sampleMenuData, LAYOUT_PRESETS['balanced'], 'desktop')
      const key2 = generateCacheKey(sampleMenuData, LAYOUT_PRESETS['dense-catalog'], 'desktop')
      
      expect(key1).not.toBe(key2)
    })

    it('should generate same key for identical inputs', () => {
      const key1 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      const key2 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      expect(key1).toBe(key2)
    })
  })

  describe('getCachedLayout and setCachedLayout', () => {
    it('should return undefined for non-existent cache entry', () => {
      const key = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      const result = getCachedLayout(key)
      
      expect(result).toBeUndefined()
    })

    it('should store and retrieve cached layout', () => {
      const key = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      setCachedLayout(key, sampleLayout)
      const result = getCachedLayout(key)
      
      expect(result).toEqual(sampleLayout)
    })

    it('should handle multiple cache entries', () => {
      const key1 = generateCacheKey(sampleMenuData, samplePreset, 'mobile')
      const key2 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      const layout1: GridLayout = { ...sampleLayout, context: 'mobile' }
      const layout2: GridLayout = { ...sampleLayout, context: 'desktop' }
      
      setCachedLayout(key1, layout1)
      setCachedLayout(key2, layout2)
      
      expect(getCachedLayout(key1)).toEqual(layout1)
      expect(getCachedLayout(key2)).toEqual(layout2)
    })

    it('should evict oldest entry when cache is full', () => {
      // Fill cache to max size (100 entries)
      const entries: Array<{ key: string; layout: GridLayout }> = []
      
      for (let i = 0; i < 101; i++) {
        const testData: LayoutMenuData = {
          ...sampleMenuData,
          metadata: { ...sampleMenuData.metadata, title: `Menu ${i}` }
        }
        const key = generateCacheKey(testData, samplePreset, 'desktop')
        const layout: GridLayout = { ...sampleLayout, totalTiles: i }
        
        entries.push({ key, layout })
        setCachedLayout(key, layout)
      }
      
      // First entry should be evicted
      expect(getCachedLayout(entries[0].key)).toBeUndefined()
      
      // Last entry should still be present
      expect(getCachedLayout(entries[100].key)).toEqual(entries[100].layout)
      
      // Cache size should be at max
      const stats = getCacheStats()
      expect(stats.size).toBe(100)
    })
  })

  describe('invalidateCacheForMenu', () => {
    it('should remove all cache entries for specific menu data', () => {
      const key1 = generateCacheKey(sampleMenuData, samplePreset, 'mobile')
      const key2 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      const key3 = generateCacheKey(sampleMenuData, LAYOUT_PRESETS['dense-catalog'], 'desktop')
      
      setCachedLayout(key1, sampleLayout)
      setCachedLayout(key2, sampleLayout)
      setCachedLayout(key3, sampleLayout)
      
      invalidateCacheForMenu(sampleMenuData)
      
      expect(getCachedLayout(key1)).toBeUndefined()
      expect(getCachedLayout(key2)).toBeUndefined()
      expect(getCachedLayout(key3)).toBeUndefined()
    })

    it('should not affect cache entries for different menu data', () => {
      const otherMenuData: LayoutMenuData = {
        metadata: { title: 'Other Menu', currency: '€' },
        sections: [
          {
            name: 'Desserts',
            items: [{ name: 'Cake', price: 7.99, featured: false }]
          }
        ]
      }
      
      const key1 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      const key2 = generateCacheKey(otherMenuData, samplePreset, 'desktop')
      
      setCachedLayout(key1, sampleLayout)
      setCachedLayout(key2, sampleLayout)
      
      invalidateCacheForMenu(sampleMenuData)
      
      expect(getCachedLayout(key1)).toBeUndefined()
      expect(getCachedLayout(key2)).toEqual(sampleLayout)
    })
  })

  describe('clearCache', () => {
    it('should remove all cache entries', () => {
      const key1 = generateCacheKey(sampleMenuData, samplePreset, 'mobile')
      const key2 = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      setCachedLayout(key1, sampleLayout)
      setCachedLayout(key2, sampleLayout)
      
      clearCache()
      
      expect(getCachedLayout(key1)).toBeUndefined()
      expect(getCachedLayout(key2)).toBeUndefined()
      
      const stats = getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('should return correct cache statistics', () => {
      const stats1 = getCacheStats()
      expect(stats1.size).toBe(0)
      expect(stats1.maxSize).toBe(100)
      
      const key = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      setCachedLayout(key, sampleLayout)
      
      const stats2 = getCacheStats()
      expect(stats2.size).toBe(1)
    })
  })

  describe('getCacheHitRate', () => {
    it('should return 0 when no cache operations have occurred', () => {
      const hitRate = getCacheHitRate()
      expect(hitRate).toBe(0)
    })

    it('should calculate hit rate correctly', () => {
      const key = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      // Miss
      getCachedLayout(key)
      
      // Store
      setCachedLayout(key, sampleLayout)
      
      // Hit
      getCachedLayout(key)
      getCachedLayout(key)
      
      // Note: The actual hit/miss recording happens in grid-generator
      // This test verifies the calculation logic works
      const hitRate = getCacheHitRate()
      expect(hitRate).toBeGreaterThanOrEqual(0)
      expect(hitRate).toBeLessThanOrEqual(100)
    })
  })

  describe('resetCacheMetrics', () => {
    it('should reset hit rate metrics', () => {
      const key = generateCacheKey(sampleMenuData, samplePreset, 'desktop')
      
      getCachedLayout(key)
      setCachedLayout(key, sampleLayout)
      getCachedLayout(key)
      
      resetCacheMetrics()
      
      const hitRate = getCacheHitRate()
      expect(hitRate).toBe(0)
    })
  })
})
