/**
 * Performance monitoring and telemetry for the layout engine
 * 
 * This module tracks layout generation metrics to:
 * 1. Monitor performance and ensure <10s total pipeline time
 * 2. Build dataset for future ML-based layout suggestions
 * 3. Identify optimization opportunities
 */

import type { OutputContext } from './types'

/**
 * Comprehensive metrics for a layout generation operation
 */
export interface LayoutMetrics {
  // Identifiers
  menuId: string
  userId?: string
  
  // Menu characteristics
  sectionCount: number
  totalItems: number
  imageRatio: number // Percentage (0-100)
  avgNameLength: number
  hasDescriptions: boolean
  
  // Layout selection
  selectedPreset: string
  outputContext: OutputContext
  
  // Performance timings (milliseconds)
  calculationTime: number // Layout calculation
  renderTime: number // Component rendering
  exportTime?: number // Export generation (PDF/PNG/JPG)
  totalTime: number // End-to-end pipeline
  
  // Resource usage
  memoryUsage?: number // Peak memory in MB
  
  // Export details
  exportFormat?: 'html' | 'pdf' | 'png' | 'jpg'
  exportSize?: number // File size in bytes
  
  // Timestamp
  timestamp: Date
}

/**
 * Performance timer utility for tracking operation durations
 */
export class PerformanceTimer {
  private startTime: number
  private marks: Map<string, number> = new Map()
  
  constructor() {
    this.startTime = performance.now()
  }
  
  /**
   * Mark a specific point in time
   */
  mark(label: string): void {
    this.marks.set(label, performance.now())
  }
  
  /**
   * Get duration between two marks (or from start if only one mark provided)
   */
  measure(startMark?: string, endMark?: string): number {
    const start = startMark ? this.marks.get(startMark) ?? this.startTime : this.startTime
    const end = endMark ? this.marks.get(endMark) ?? performance.now() : performance.now()
    return end - start
  }
  
  /**
   * Get total elapsed time since timer creation
   */
  elapsed(): number {
    return performance.now() - this.startTime
  }
  
  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = performance.now()
    this.marks.clear()
  }
}

/**
 * Log layout metrics for monitoring and analysis
 * 
 * In production, this should integrate with your analytics/monitoring service
 * (e.g., Vercel Analytics, DataDog, New Relic, custom telemetry endpoint)
 */
export function logLayoutMetrics(metrics: LayoutMetrics): void {
  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('[LayoutEngine Metrics]', {
      menuId: metrics.menuId,
      preset: metrics.selectedPreset,
      context: metrics.outputContext,
      items: metrics.totalItems,
      imageRatio: `${metrics.imageRatio.toFixed(1)}%`,
      timings: {
        calculation: `${metrics.calculationTime.toFixed(0)}ms`,
        render: `${metrics.renderTime.toFixed(0)}ms`,
        export: metrics.exportTime ? `${metrics.exportTime.toFixed(0)}ms` : 'N/A',
        total: `${metrics.totalTime.toFixed(0)}ms`
      },
      memory: metrics.memoryUsage ? `${metrics.memoryUsage.toFixed(1)}MB` : 'N/A',
      exportFormat: metrics.exportFormat ?? 'N/A',
      exportSize: metrics.exportSize ? `${(metrics.exportSize / 1024).toFixed(1)}KB` : 'N/A'
    })
  }
  
  // Production logging - integrate with your monitoring service
  // Example integrations:
  
  // Vercel Analytics
  // if (typeof window !== 'undefined' && window.va) {
  //   window.va('track', 'layout_generated', {
  //     preset: metrics.selectedPreset,
  //     context: metrics.outputContext,
  //     totalTime: metrics.totalTime,
  //     items: metrics.totalItems
  //   })
  // }
  
  // Custom telemetry endpoint
  // if (process.env.TELEMETRY_ENDPOINT) {
  //   fetch(process.env.TELEMETRY_ENDPOINT, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(metrics)
  //   }).catch(err => console.error('Failed to send metrics:', err))
  // }
  
  // DataDog / New Relic / etc.
  // if (typeof DD_RUM !== 'undefined') {
  //   DD_RUM.addAction('layout_generated', metrics)
  // }
}

/**
 * Check if total pipeline time meets the 10-second requirement
 */
export function validatePerformance(metrics: LayoutMetrics): {
  isValid: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  
  // Check total time
  if (metrics.totalTime > 10000) {
    warnings.push(`Total time ${metrics.totalTime.toFixed(0)}ms exceeds 10s target`)
  }
  
  // Check calculation time
  if (metrics.calculationTime > 500) {
    warnings.push(`Calculation time ${metrics.calculationTime.toFixed(0)}ms exceeds 500ms target`)
  }
  
  // Check render time
  if (metrics.renderTime > 1000) {
    warnings.push(`Render time ${metrics.renderTime.toFixed(0)}ms exceeds 1s target`)
  }
  
  // Check export time
  if (metrics.exportTime) {
    if (metrics.exportFormat === 'pdf' && metrics.exportTime > 5000) {
      warnings.push(`PDF export time ${metrics.exportTime.toFixed(0)}ms exceeds 5s target`)
    }
    if ((metrics.exportFormat === 'png' || metrics.exportFormat === 'jpg') && metrics.exportTime > 4000) {
      warnings.push(`Image export time ${metrics.exportTime.toFixed(0)}ms exceeds 4s target`)
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}

/**
 * Get current memory usage in MB (Node.js only)
 */
export function getMemoryUsage(): number | undefined {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage()
    return usage.heapUsed / 1024 / 1024 // Convert to MB
  }
  return undefined
}

/**
 * Create a metrics builder for incremental metric collection
 */
export class MetricsBuilder {
  private metrics: Partial<LayoutMetrics> = {
    timestamp: new Date()
  }
  private timer: PerformanceTimer = new PerformanceTimer()
  
  setMenuId(menuId: string): this {
    this.metrics.menuId = menuId
    return this
  }
  
  setUserId(userId: string): this {
    this.metrics.userId = userId
    return this
  }
  
  setMenuCharacteristics(characteristics: {
    sectionCount: number
    totalItems: number
    imageRatio: number
    avgNameLength: number
    hasDescriptions: boolean
  }): this {
    Object.assign(this.metrics, characteristics)
    return this
  }
  
  setLayoutSelection(preset: string, context: OutputContext): this {
    this.metrics.selectedPreset = preset
    this.metrics.outputContext = context
    return this
  }
  
  setCalculationTime(time: number): this {
    this.metrics.calculationTime = time
    return this
  }
  
  setRenderTime(time: number): this {
    this.metrics.renderTime = time
    return this
  }
  
  setExportTime(time: number): this {
    this.metrics.exportTime = time
    return this
  }
  
  setExportDetails(format: 'html' | 'pdf' | 'png' | 'jpg', size?: number): this {
    this.metrics.exportFormat = format
    this.metrics.exportSize = size
    return this
  }
  
  setMemoryUsage(usage: number): this {
    this.metrics.memoryUsage = usage
    return this
  }
  
  markCalculationStart(): this {
    this.timer.mark('calculation_start')
    return this
  }
  
  markCalculationEnd(): this {
    this.timer.mark('calculation_end')
    this.metrics.calculationTime = this.timer.measure('calculation_start', 'calculation_end')
    return this
  }
  
  markRenderStart(): this {
    this.timer.mark('render_start')
    return this
  }
  
  markRenderEnd(): this {
    this.timer.mark('render_end')
    this.metrics.renderTime = this.timer.measure('render_start', 'render_end')
    return this
  }
  
  markExportStart(): this {
    this.timer.mark('export_start')
    return this
  }
  
  markExportEnd(): this {
    this.timer.mark('export_end')
    this.metrics.exportTime = this.timer.measure('export_start', 'export_end')
    return this
  }
  
  build(): LayoutMetrics {
    // Calculate total time
    this.metrics.totalTime = this.timer.elapsed()
    
    // Capture memory usage if not already set
    if (!this.metrics.memoryUsage) {
      this.metrics.memoryUsage = getMemoryUsage()
    }
    
    // Validate required fields
    if (!this.metrics.menuId) {
      throw new Error('menuId is required')
    }
    if (this.metrics.sectionCount === undefined) {
      throw new Error('sectionCount is required')
    }
    if (this.metrics.totalItems === undefined) {
      throw new Error('totalItems is required')
    }
    if (this.metrics.imageRatio === undefined) {
      throw new Error('imageRatio is required')
    }
    if (!this.metrics.selectedPreset) {
      throw new Error('selectedPreset is required')
    }
    if (!this.metrics.outputContext) {
      throw new Error('outputContext is required')
    }
    if (this.metrics.calculationTime === undefined) {
      throw new Error('calculationTime is required')
    }
    if (this.metrics.renderTime === undefined) {
      throw new Error('renderTime is required')
    }
    if (this.metrics.totalTime === undefined) {
      throw new Error('totalTime is required')
    }
    
    return this.metrics as LayoutMetrics
  }
}
