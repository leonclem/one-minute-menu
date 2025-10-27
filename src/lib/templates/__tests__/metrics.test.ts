import {
  PerformanceTimer,
  MetricsBuilder,
  logLayoutMetrics,
  validatePerformance,
  getMemoryUsage,
  type LayoutMetrics
} from '../metrics'

describe('PerformanceTimer', () => {
  it('should track elapsed time', () => {
    const timer = new PerformanceTimer()
    
    // Wait a bit
    const start = performance.now()
    while (performance.now() - start < 10) {
      // Busy wait
    }
    
    const elapsed = timer.elapsed()
    expect(elapsed).toBeGreaterThanOrEqual(10)
  })
  
  it('should mark specific points in time', () => {
    const timer = new PerformanceTimer()
    
    timer.mark('start')
    const start = performance.now()
    while (performance.now() - start < 10) {
      // Busy wait
    }
    timer.mark('end')
    
    const duration = timer.measure('start', 'end')
    expect(duration).toBeGreaterThanOrEqual(10)
  })
  
  it('should measure from start if no start mark provided', () => {
    const timer = new PerformanceTimer()
    
    const start = performance.now()
    while (performance.now() - start < 10) {
      // Busy wait
    }
    
    const duration = timer.measure()
    expect(duration).toBeGreaterThanOrEqual(10)
  })
  
  it('should reset timer and marks', () => {
    const timer = new PerformanceTimer()
    
    timer.mark('test')
    const start = performance.now()
    while (performance.now() - start < 10) {
      // Busy wait
    }
    
    timer.reset()
    
    const elapsed = timer.elapsed()
    expect(elapsed).toBeLessThan(10)
  })
})

describe('MetricsBuilder', () => {
  it('should build complete metrics object', () => {
    const builder = new MetricsBuilder()
    
    const metrics = builder
      .setMenuId('menu-123')
      .setUserId('user-456')
      .setMenuCharacteristics({
        sectionCount: 5,
        totalItems: 25,
        imageRatio: 60,
        avgNameLength: 15,
        hasDescriptions: true
      })
      .setLayoutSelection('balanced', 'desktop')
      .setCalculationTime(100)
      .setRenderTime(200)
      .setExportTime(300)
      .setExportDetails('pdf', 50000)
      .setMemoryUsage(128)
      .build()
    
    expect(metrics.menuId).toBe('menu-123')
    expect(metrics.userId).toBe('user-456')
    expect(metrics.sectionCount).toBe(5)
    expect(metrics.totalItems).toBe(25)
    expect(metrics.imageRatio).toBe(60)
    expect(metrics.avgNameLength).toBe(15)
    expect(metrics.hasDescriptions).toBe(true)
    expect(metrics.selectedPreset).toBe('balanced')
    expect(metrics.outputContext).toBe('desktop')
    expect(metrics.calculationTime).toBe(100)
    expect(metrics.renderTime).toBe(200)
    expect(metrics.exportTime).toBe(300)
    expect(metrics.exportFormat).toBe('pdf')
    expect(metrics.exportSize).toBe(50000)
    expect(metrics.memoryUsage).toBe(128)
    expect(metrics.totalTime).toBeGreaterThanOrEqual(0)
    expect(metrics.timestamp).toBeInstanceOf(Date)
  })
  
  it('should use timer marks for automatic time tracking', () => {
    const builder = new MetricsBuilder()
    
    builder
      .setMenuId('menu-123')
      .setMenuCharacteristics({
        sectionCount: 3,
        totalItems: 15,
        imageRatio: 50,
        avgNameLength: 12,
        hasDescriptions: false
      })
      .setLayoutSelection('image-forward', 'mobile')
      .markCalculationStart()
    
    // Simulate work
    const start = performance.now()
    while (performance.now() - start < 10) {
      // Busy wait
    }
    
    builder.markCalculationEnd()
    builder.markRenderStart()
    
    // Simulate more work
    const start2 = performance.now()
    while (performance.now() - start2 < 10) {
      // Busy wait
    }
    
    builder.markRenderEnd()
    
    const metrics = builder.build()
    
    expect(metrics.calculationTime).toBeGreaterThanOrEqual(10)
    expect(metrics.renderTime).toBeGreaterThanOrEqual(10)
  })
  
  it('should throw error if required fields are missing', () => {
    const builder = new MetricsBuilder()
    
    expect(() => builder.build()).toThrow('menuId is required')
    
    builder.setMenuId('menu-123')
    expect(() => builder.build()).toThrow('sectionCount is required')
    
    builder.setMenuCharacteristics({
      sectionCount: 3,
      totalItems: 15,
      imageRatio: 50,
      avgNameLength: 12,
      hasDescriptions: false
    })
    expect(() => builder.build()).toThrow('selectedPreset is required')
    
    builder.setLayoutSelection('balanced', 'desktop')
    expect(() => builder.build()).toThrow('calculationTime is required')
    
    builder.setCalculationTime(100)
    expect(() => builder.build()).toThrow('renderTime is required')
    
    builder.setRenderTime(200)
    
    // Should not throw now
    expect(() => builder.build()).not.toThrow()
  })
  
  it('should capture memory usage automatically if not set', () => {
    const builder = new MetricsBuilder()
    
    const metrics = builder
      .setMenuId('menu-123')
      .setMenuCharacteristics({
        sectionCount: 3,
        totalItems: 15,
        imageRatio: 50,
        avgNameLength: 12,
        hasDescriptions: false
      })
      .setLayoutSelection('balanced', 'desktop')
      .setCalculationTime(100)
      .setRenderTime(200)
      .build()
    
    // Memory usage should be captured (or undefined if not in Node.js)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      expect(metrics.memoryUsage).toBeGreaterThan(0)
    }
  })
})

describe('validatePerformance', () => {
  const createMetrics = (overrides: Partial<LayoutMetrics> = {}): LayoutMetrics => ({
    menuId: 'menu-123',
    sectionCount: 5,
    totalItems: 25,
    imageRatio: 60,
    avgNameLength: 15,
    hasDescriptions: true,
    selectedPreset: 'balanced',
    outputContext: 'desktop',
    calculationTime: 100,
    renderTime: 200,
    totalTime: 300,
    timestamp: new Date(),
    ...overrides
  })
  
  it('should validate metrics within performance targets', () => {
    const metrics = createMetrics()
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })
  
  it('should warn if total time exceeds 10s', () => {
    const metrics = createMetrics({ totalTime: 11000 })
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings).toContain('Total time 11000ms exceeds 10s target')
  })
  
  it('should warn if calculation time exceeds 500ms', () => {
    const metrics = createMetrics({ calculationTime: 600 })
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings).toContain('Calculation time 600ms exceeds 500ms target')
  })
  
  it('should warn if render time exceeds 1s', () => {
    const metrics = createMetrics({ renderTime: 1200 })
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings).toContain('Render time 1200ms exceeds 1s target')
  })
  
  it('should warn if PDF export time exceeds 5s', () => {
    const metrics = createMetrics({
      exportFormat: 'pdf',
      exportTime: 6000
    })
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings).toContain('PDF export time 6000ms exceeds 5s target')
  })
  
  it('should warn if image export time exceeds 4s', () => {
    const metrics = createMetrics({
      exportFormat: 'png',
      exportTime: 5000
    })
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings).toContain('Image export time 5000ms exceeds 4s target')
  })
  
  it('should collect multiple warnings', () => {
    const metrics = createMetrics({
      totalTime: 12000,
      calculationTime: 600,
      renderTime: 1500,
      exportFormat: 'pdf',
      exportTime: 7000
    })
    
    const result = validatePerformance(metrics)
    
    expect(result.isValid).toBe(false)
    expect(result.warnings).toHaveLength(4)
  })
})

describe('logLayoutMetrics', () => {
  const originalEnv = process.env.NODE_ENV
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
  
  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    consoleSpy.mockClear()
  })
  
  afterAll(() => {
    consoleSpy.mockRestore()
  })
  
  it('should log metrics in development mode', () => {
    process.env.NODE_ENV = 'development'
    
    const metrics: LayoutMetrics = {
      menuId: 'menu-123',
      userId: 'user-456',
      sectionCount: 5,
      totalItems: 25,
      imageRatio: 60,
      avgNameLength: 15,
      hasDescriptions: true,
      selectedPreset: 'balanced',
      outputContext: 'desktop',
      calculationTime: 100,
      renderTime: 200,
      exportTime: 300,
      exportFormat: 'pdf',
      exportSize: 50000,
      memoryUsage: 128,
      totalTime: 600,
      timestamp: new Date()
    }
    
    logLayoutMetrics(metrics)
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[LayoutEngine Metrics]',
      expect.objectContaining({
        menuId: 'menu-123',
        preset: 'balanced',
        context: 'desktop',
        items: 25
      })
    )
  })
  
  it('should not log in production mode', () => {
    process.env.NODE_ENV = 'production'
    
    const metrics: LayoutMetrics = {
      menuId: 'menu-123',
      sectionCount: 5,
      totalItems: 25,
      imageRatio: 60,
      avgNameLength: 15,
      hasDescriptions: true,
      selectedPreset: 'balanced',
      outputContext: 'desktop',
      calculationTime: 100,
      renderTime: 200,
      totalTime: 300,
      timestamp: new Date()
    }
    
    logLayoutMetrics(metrics)
    
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})

describe('getMemoryUsage', () => {
  it('should return memory usage in MB', () => {
    const usage = getMemoryUsage()
    
    if (typeof process !== 'undefined' && process.memoryUsage) {
      expect(usage).toBeGreaterThan(0)
      expect(typeof usage).toBe('number')
    } else {
      expect(usage).toBeUndefined()
    }
  })
})
