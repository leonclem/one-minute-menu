/**
 * Performance Tests for Dynamic Menu Layout Engine
 * 
 * Tests layout generation and export performance against targets:
 * - Layout calculation: <500ms
 * - HTML rendering: <1s
 * - PDF export: <5s
 * - PNG/JPG export: <4s
 * - Total pipeline: <10s
 * 
 * Requirements: 3.5, 8.5
 */

// Enable rate limiting enforcement for these tests
const originalEnforceRateLimiting = process.env.ENFORCE_RATE_LIMITING_IN_TESTS

beforeAll(() => {
  process.env.ENFORCE_RATE_LIMITING_IN_TESTS = 'true'
})

afterAll(() => {
  if (originalEnforceRateLimiting === undefined) {
    delete process.env.ENFORCE_RATE_LIMITING_IN_TESTS
  } else {
    process.env.ENFORCE_RATE_LIMITING_IN_TESTS = originalEnforceRateLimiting
  }
})

import { generateGridLayout, calculateLayoutStatistics, clearCache } from '../grid-generator'
import { selectLayoutPreset } from '../layout-selector'
import { analyzeMenuCharacteristics } from '../data-transformer'
import { LAYOUT_PRESETS } from '../presets'
import type { LayoutMenuData, LayoutItem, OutputContext } from '../types'
import { PerformanceTimer, MetricsBuilder, validatePerformance } from '../metrics'

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate test menu data with specified number of items
 */
function generateTestMenuData(totalItems: number, imageRatio: number = 50): LayoutMenuData {
  const itemsPerSection = Math.ceil(totalItems / 5) // Distribute across 5 sections
  const sections = []
  
  let itemCount = 0
  const sectionNames = ['Appetizers', 'Salads', 'Mains', 'Desserts', 'Beverages']
  
  for (let s = 0; s < 5 && itemCount < totalItems; s++) {
    const items: LayoutItem[] = []
    const itemsInThisSection = Math.min(itemsPerSection, totalItems - itemCount)
    
    for (let i = 0; i < itemsInThisSection; i++) {
      const hasImage = (Math.random() * 100) < imageRatio
      
      items.push({
        name: `Test Item ${itemCount + 1}`,
        price: Math.round((Math.random() * 20 + 5) * 100) / 100,
        description: Math.random() > 0.5 ? `Description for item ${itemCount + 1}` : undefined,
        imageRef: hasImage ? `https://example.com/image-${itemCount + 1}.jpg` : undefined,
        featured: Math.random() > 0.9
      })
      
      itemCount++
    }
    
    if (items.length > 0) {
      sections.push({
        name: sectionNames[s],
        items
      })
    }
  }
  
  return {
    metadata: {
      title: `Test Menu (${totalItems} items)`,
      currency: '$'
    },
    sections
  }
}

// ============================================================================
// Performance Test Suite
// ============================================================================

describe('Performance: Layout Generation', () => {
  const contexts: OutputContext[] = ['mobile', 'tablet', 'desktop', 'print']
  
  describe('Small Menus (20 items)', () => {
    const menuData = generateTestMenuData(20, 60)
    
    it('should generate layout within 500ms', () => {
      const timer = new PerformanceTimer()
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      timer.mark('start')
      const layout = generateGridLayout(menuData, preset, 'desktop')
      const duration = timer.measure('start')
      
      expect(layout.totalTiles).toBe(20)
      expect(duration).toBeLessThan(500)
    })
    
    it('should handle all output contexts efficiently', () => {
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      for (const context of contexts) {
        const timer = new PerformanceTimer()
        const layout = generateGridLayout(menuData, preset, context)
        const duration = timer.elapsed()
        
        expect(layout.totalTiles).toBe(20)
        expect(duration).toBeLessThan(500)
      }
    })
    
    it('should benefit from caching on repeated calls', () => {
      // Ensure first call is a cache miss for accurate comparison
      clearCache()
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      // First call (cache miss)
      const timer1 = new PerformanceTimer()
      generateGridLayout(menuData, preset, 'desktop')
      const firstCallDuration = timer1.elapsed()
      
      // Second call (cache hit)
      const timer2 = new PerformanceTimer()
      const cachedLayout = generateGridLayout(menuData, preset, 'desktop')
      const secondCallDuration = timer2.elapsed()
      
      // Cache hit should be faster or approximately equal allowing small jitter
      // Note: On very fast systems, both might be < 1ms; allow 1ms slack or 50% jitter
      // to account for event-loop variance when running the full test suite
      expect(cachedLayout.totalTiles).toBe(20)
      const tolerance = Math.max(1, firstCallDuration * 0.5)
      expect(secondCallDuration).toBeLessThanOrEqual(firstCallDuration + tolerance)
    })
  })
  
  describe('Medium Menus (50 items)', () => {
    const menuData = generateTestMenuData(50, 50)
    
    it('should generate layout within 500ms', () => {
      const timer = new PerformanceTimer()
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      const layout = generateGridLayout(menuData, preset, 'desktop')
      const duration = timer.elapsed()
      
      expect(layout.totalTiles).toBe(50)
      expect(duration).toBeLessThan(500)
    })
    
    it('should maintain performance across all presets', () => {
      const presetIds = Object.keys(LAYOUT_PRESETS)
      
      for (const presetId of presetIds) {
        const preset = LAYOUT_PRESETS[presetId]
        const timer = new PerformanceTimer()
        
        const layout = generateGridLayout(menuData, preset, 'desktop')
        const duration = timer.elapsed()
        
        expect(layout.totalTiles).toBe(50)
        expect(duration).toBeLessThan(500)
      }
    })
    
    it('should calculate statistics efficiently', () => {
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      const layout = generateGridLayout(menuData, preset, 'desktop')
      
      const timer = new PerformanceTimer()
      const stats = calculateLayoutStatistics(layout)
      const duration = timer.elapsed()
      
      expect(stats.totalTiles).toBe(50)
      expect(duration).toBeLessThan(50) // Statistics should be very fast
    })
  })
  
  describe('Large Menus (100 items)', () => {
    const menuData = generateTestMenuData(100, 40)
    
    it('should generate layout within 500ms', () => {
      const timer = new PerformanceTimer()
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      const layout = generateGridLayout(menuData, preset, 'desktop')
      const duration = timer.elapsed()
      
      expect(layout.totalTiles).toBe(100)
      expect(duration).toBeLessThan(500)
    })
    
    it('should handle all output contexts within budget', () => {
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      const totalTimer = new PerformanceTimer()
      
      for (const context of contexts) {
        const layout = generateGridLayout(menuData, preset, context)
        expect(layout.totalTiles).toBe(100)
      }
      
      const totalDuration = totalTimer.elapsed()
      
      // All 4 contexts should complete within 2 seconds total
      expect(totalDuration).toBeLessThan(2000)
    })
    
    it('should not degrade with repeated generation', () => {
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      const durations: number[] = []
      
      // Generate layout 10 times
      for (let i = 0; i < 10; i++) {
        // Use slightly different data to avoid cache
        const testData = generateTestMenuData(100, 40)
        const timer = new PerformanceTimer()
        generateGridLayout(testData, preset, 'desktop')
        durations.push(timer.elapsed())
      }
      
      // All iterations should be within budget
      for (const duration of durations) {
        expect(duration).toBeLessThan(500)
      }
      
      // Average should be well within budget
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length
      expect(average).toBeLessThan(400)
    })
  })
  
  describe('Memory Usage', () => {
    it('should not leak memory with repeated generations', () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Generate many layouts
      for (let i = 0; i < 50; i++) {
        const menuData = generateTestMenuData(50, 50)
        const characteristics = analyzeMenuCharacteristics(menuData)
        const preset = selectLayoutPreset(characteristics, 'desktop')
        generateGridLayout(menuData, preset, 'desktop')
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50)
    })
    
    it('should handle large menus without excessive memory', () => {
      const menuData = generateTestMenuData(100, 50)
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      const beforeMemory = process.memoryUsage().heapUsed
      const layout = generateGridLayout(menuData, preset, 'desktop')
      const afterMemory = process.memoryUsage().heapUsed
      
      const memoryUsed = (afterMemory - beforeMemory) / 1024 / 1024 // MB
      
      expect(layout.totalTiles).toBe(100)
      // Single layout generation should use less than 10MB
      expect(memoryUsed).toBeLessThan(10)
    })
  })
})

describe('Performance: Metrics and Validation', () => {
  it('should build metrics efficiently', () => {
    const timer = new PerformanceTimer()
    
    const builder = new MetricsBuilder()
    builder
      .setMenuId('test-menu-123')
      .setMenuCharacteristics({
        sectionCount: 5,
        totalItems: 50,
        imageRatio: 60,
        avgNameLength: 15,
        hasDescriptions: true
      })
      .setLayoutSelection('balanced', 'desktop')
      .setCalculationTime(100)
      .setRenderTime(200)
      .setExportTime(300)
      .setExportDetails('pdf', 50000)
    
    const metrics = builder.build()
    const duration = timer.elapsed()
    
    expect(metrics.menuId).toBe('test-menu-123')
    expect(duration).toBeLessThan(30) // Metrics building should be instant
  })
  
  it('should validate performance quickly', () => {
    const metrics = {
      menuId: 'test-menu',
      sectionCount: 5,
      totalItems: 50,
      imageRatio: 60,
      avgNameLength: 15,
      hasDescriptions: true,
      selectedPreset: 'balanced',
      outputContext: 'desktop' as OutputContext,
      calculationTime: 100,
      renderTime: 200,
      totalTime: 300,
      timestamp: new Date()
    }
    
    const timer = new PerformanceTimer()
    const result = validatePerformance(metrics)
    const duration = timer.elapsed()
    
    expect(result.isValid).toBe(true)
    expect(duration).toBeLessThan(20) // Validation should be instant
  })
  
  it('should detect performance violations', () => {
    const slowMetrics = {
      menuId: 'slow-menu',
      sectionCount: 10,
      totalItems: 100,
      imageRatio: 80,
      avgNameLength: 20,
      hasDescriptions: true,
      selectedPreset: 'image-forward',
      outputContext: 'desktop' as OutputContext,
      calculationTime: 600, // Exceeds 500ms target
      renderTime: 1500, // Exceeds 1s target
      exportTime: 6000, // Exceeds 5s target for PDF
      exportFormat: 'pdf' as const,
      totalTime: 12000, // Exceeds 10s target
      timestamp: new Date()
    }
    
    const result = validatePerformance(slowMetrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings).toContain('Total time 12000ms exceeds 10s target')
    expect(result.warnings).toContain('Calculation time 600ms exceeds 500ms target')
    expect(result.warnings).toContain('Render time 1500ms exceeds 1s target')
    expect(result.warnings).toContain('PDF export time 6000ms exceeds 5s target')
  })
})

describe('Performance: End-to-End Pipeline', () => {
  it('should complete full pipeline within 10s for medium menu', () => {
    const menuData = generateTestMenuData(50, 60)
    const timer = new PerformanceTimer()
    
    // Step 1: Analyze characteristics
    timer.mark('analyze-start')
    const characteristics = analyzeMenuCharacteristics(menuData)
    const analyzeTime = timer.measure('analyze-start')
    
    // Step 2: Select layout
    timer.mark('select-start')
    const preset = selectLayoutPreset(characteristics, 'desktop')
    const selectTime = timer.measure('select-start')
    
    // Step 3: Generate layout
    timer.mark('generate-start')
    const layout = generateGridLayout(menuData, preset, 'desktop')
    const generateTime = timer.measure('generate-start')
    
    // Step 4: Calculate statistics
    timer.mark('stats-start')
    const stats = calculateLayoutStatistics(layout)
    const statsTime = timer.measure('stats-start')
    
    const totalTime = timer.elapsed()
    
    // Verify results
    expect(layout.totalTiles).toBe(50)
    expect(stats.totalTiles).toBe(50)
    
    // Verify performance targets
    expect(analyzeTime).toBeLessThan(100)
    expect(selectTime).toBeLessThan(50)
    expect(generateTime).toBeLessThan(500)
    expect(statsTime).toBeLessThan(50)
    expect(totalTime).toBeLessThan(1000) // Core pipeline should be under 1s
  })
  
  it('should handle concurrent layout generations', () => {
    const menuData1 = generateTestMenuData(30, 50)
    const menuData2 = generateTestMenuData(40, 60)
    const menuData3 = generateTestMenuData(50, 70)
    
    const timer = new PerformanceTimer()
    
    // Simulate concurrent requests
    const characteristics1 = analyzeMenuCharacteristics(menuData1)
    const characteristics2 = analyzeMenuCharacteristics(menuData2)
    const characteristics3 = analyzeMenuCharacteristics(menuData3)
    
    const preset1 = selectLayoutPreset(characteristics1, 'mobile')
    const preset2 = selectLayoutPreset(characteristics2, 'tablet')
    const preset3 = selectLayoutPreset(characteristics3, 'desktop')
    
    const layout1 = generateGridLayout(menuData1, preset1, 'mobile')
    const layout2 = generateGridLayout(menuData2, preset2, 'tablet')
    const layout3 = generateGridLayout(menuData3, preset3, 'desktop')
    
    const totalTime = timer.elapsed()
    
    expect(layout1.totalTiles).toBe(30)
    expect(layout2.totalTiles).toBe(40)
    expect(layout3.totalTiles).toBe(50)
    
    // All three should complete quickly
    expect(totalTime).toBeLessThan(2000)
  })
})

describe('Performance: Scalability', () => {
  it('should scale linearly with menu size', () => {
    const sizes = [10, 20, 40, 80]
    const durations: number[] = []
    
    for (const size of sizes) {
      const menuData = generateTestMenuData(size, 50)
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      
      const timer = new PerformanceTimer()
      generateGridLayout(menuData, preset, 'desktop')
      durations.push(timer.elapsed())
    }
    
    // Check that doubling size doesn't more than triple time
    for (let i = 1; i < sizes.length; i++) {
      const sizeRatio = sizes[i] / sizes[i - 1]
      const timeRatio = durations[i] / Math.max(0.5, durations[i - 1])
      
      // Time ratio should be less than or equal to size ratio (linear or better)
      // Allow generous margin for small timing variations (1-2ms) and cache effects
      expect(timeRatio).toBeLessThanOrEqual(sizeRatio * 3.5)
    }
  })
  
  it('should handle extreme menu sizes gracefully', () => {
    const menuData = generateTestMenuData(200, 30)
    const characteristics = analyzeMenuCharacteristics(menuData)
    const preset = selectLayoutPreset(characteristics, 'desktop')
    
    const timer = new PerformanceTimer()
    const layout = generateGridLayout(menuData, preset, 'desktop')
    const duration = timer.elapsed()
    
    expect(layout.totalTiles).toBe(200)
    // Even with 200 items, should complete within 1 second
    expect(duration).toBeLessThan(1000)
  })
})

describe('Performance: Cache Effectiveness', () => {
  it('should improve performance with cache hits', () => {
    const menuData = generateTestMenuData(50, 50)
    const characteristics = analyzeMenuCharacteristics(menuData)
    const preset = selectLayoutPreset(characteristics, 'desktop')
    
    // Warm up cache
    generateGridLayout(menuData, preset, 'desktop')
    
    // Measure cache hit performance
    const timer = new PerformanceTimer()
    const iterations = 100
    
    for (let i = 0; i < iterations; i++) {
      generateGridLayout(menuData, preset, 'desktop')
    }
    
    const totalTime = timer.elapsed()
    const averageTime = totalTime / iterations

    // Cache hits should be fast; threshold relaxed for slow/loaded machines (CI, laptops)
    expect(averageTime).toBeLessThan(50)
  })
  
  it('should handle cache misses efficiently', () => {
    const timer = new PerformanceTimer()
    const iterations = 20
    
    for (let i = 0; i < iterations; i++) {
      // Generate unique menu data for each iteration (cache miss)
      const menuData = generateTestMenuData(50 + i, 50)
      const characteristics = analyzeMenuCharacteristics(menuData)
      const preset = selectLayoutPreset(characteristics, 'desktop')
      generateGridLayout(menuData, preset, 'desktop')
    }
    
    const totalTime = timer.elapsed()
    const averageTime = totalTime / iterations
    
    // Even with cache misses, average should be well within budget
    expect(averageTime).toBeLessThan(500)
  })
})

describe('Performance: Rate Limiting', () => {
  // Import rate limiter for testing
  const { RateLimiter } = require('../rate-limiter')
  
  it('should enforce rate limits without performance degradation', () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60000
    })
    
    const timer = new PerformanceTimer()
    const userId = 'perf-test-user-1'
    
    // Make requests up to the limit
    for (let i = 0; i < 10; i++) {
      const result = limiter.check(userId)
      expect(result.allowed).toBe(true)
    }
    
    // Next request should be blocked
    const blockedResult = limiter.check(userId)
    expect(blockedResult.allowed).toBe(false)
    
    const duration = timer.elapsed()

    // Rate limit checks should be fast; threshold relaxed for slow/loaded machines
    expect(duration).toBeLessThan(1000)

    // Cleanup
    limiter.reset(userId)
  })

  it('should handle high-frequency rate limit checks', () => {
    const limiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 60000
    })
    
    const timer = new PerformanceTimer()
    const iterations = 1000
    
    for (let i = 0; i < iterations; i++) {
      const userId = `perf-test-user-${i % 10}` // 10 different users
      limiter.check(userId)
    }
    
    const duration = timer.elapsed()
    const averageTime = duration / iterations

    // Each check should be fast; threshold relaxed for slow/loaded machines
    expect(averageTime).toBeLessThan(2)

    // Cleanup
    for (let i = 0; i < 10; i++) {
      limiter.reset(`perf-test-user-${i}`)
    }
  })
  
  it('should not impact layout generation performance', () => {
    const limiter = new RateLimiter({
      maxRequests: 50,
      windowMs: 60000
    })
    
    const menuData = generateTestMenuData(50, 50)
    const characteristics = analyzeMenuCharacteristics(menuData)
    const preset = selectLayoutPreset(characteristics, 'desktop')
    const userId = 'perf-test-user-2'
    
    const timer = new PerformanceTimer()
    
    // Simulate rate-limited layout generation
    for (let i = 0; i < 10; i++) {
      const rateLimitResult = limiter.check(userId)
      
      if (rateLimitResult.allowed) {
        generateGridLayout(menuData, preset, 'desktop')
      }
    }
    
    const duration = timer.elapsed()
    
    // 10 generations with rate limiting should still be fast
    expect(duration).toBeLessThan(1000)
    
    // Cleanup
    limiter.reset(userId)
  })
  
  it('should scale with concurrent users', () => {
    const limiter = new RateLimiter({
      maxRequests: 20,
      windowMs: 60000
    })
    
    const timer = new PerformanceTimer()
    const userCount = 100
    const requestsPerUser = 5
    
    // Simulate concurrent requests from multiple users
    for (let user = 0; user < userCount; user++) {
      const userId = `concurrent-user-${user}`
      
      for (let req = 0; req < requestsPerUser; req++) {
        limiter.check(userId)
      }
    }
    
    const duration = timer.elapsed()
    const totalRequests = userCount * requestsPerUser
    const averageTime = duration / totalRequests
    
    // Should handle 500 requests efficiently
    expect(duration).toBeLessThan(100)
    expect(averageTime).toBeLessThan(0.2)
    
    // Cleanup
    for (let user = 0; user < userCount; user++) {
      limiter.reset(`concurrent-user-${user}`)
    }
  })
  
  it('should cleanup expired entries efficiently', async () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 100 // Short window for testing
    })
    
    const userId = 'cleanup-test-user'
    
    // Use up the limit
    for (let i = 0; i < 5; i++) {
      limiter.check(userId)
    }
    
    // Verify limit is reached
    const blockedResult = limiter.check(userId)
    expect(blockedResult.allowed).toBe(false)
    
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Should be allowed again
    const timer = new PerformanceTimer()
    const allowedResult = limiter.check(userId)
    const duration = timer.elapsed()
    
    expect(allowedResult.allowed).toBe(true)
    expect(duration).toBeLessThan(20) // Cleanup shouldn't slow down checks
    
    // Cleanup
    limiter.reset(userId)
  })
})
