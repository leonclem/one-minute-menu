# Layout Engine Metrics Guide

## Overview

The metrics system tracks performance and telemetry data for the layout engine to:
1. Monitor performance and ensure <10s total pipeline time
2. Build a dataset for future ML-based layout suggestions
3. Identify optimization opportunities

## Components

### LayoutMetrics Interface

Comprehensive metrics for a layout generation operation:

```typescript
interface LayoutMetrics {
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
```

### MetricsBuilder

A builder class for incrementally collecting metrics:

```typescript
const metricsBuilder = new MetricsBuilder()

metricsBuilder
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
  .markCalculationStart()
  // ... do calculation work ...
  .markCalculationEnd()
  .markRenderStart()
  // ... do rendering work ...
  .markRenderEnd()
  .markExportStart()
  // ... do export work ...
  .markExportEnd()
  .setExportDetails('pdf', 50000)

const metrics = metricsBuilder.build()
```

### PerformanceTimer

A utility for tracking operation durations:

```typescript
const timer = new PerformanceTimer()

timer.mark('start')
// ... do work ...
timer.mark('end')

const duration = timer.measure('start', 'end')
console.log(`Operation took ${duration}ms`)
```

## Usage in API Routes

### Layout Generation

```typescript
export async function POST(request: NextRequest) {
  const metricsBuilder = new MetricsBuilder()
  
  try {
    // Set identifiers
    metricsBuilder.setMenuId(menuId).setUserId(user.id)
    
    // Track calculation
    metricsBuilder.markCalculationStart()
    const characteristics = analyzeMenuCharacteristics(layoutData)
    metricsBuilder.setMenuCharacteristics(characteristics)
    const preset = selectLayoutPreset(characteristics, context)
    metricsBuilder.setLayoutSelection(preset.id, context)
    const layout = generateGridLayout(layoutData, preset, context)
    metricsBuilder.markCalculationEnd()
    
    // Set render time (0 for server-side, measured on client)
    metricsBuilder.setRenderTime(0)
    
    // Build and log metrics
    const metrics = metricsBuilder.build()
    logLayoutMetrics(metrics)
    
    // Validate performance
    const performanceCheck = validatePerformance(metrics)
    if (!performanceCheck.isValid) {
      console.warn('Performance warnings:', performanceCheck.warnings)
    }
    
    return NextResponse.json({ layout, metrics })
  } catch (error) {
    // Handle errors
  }
}
```

### Export Routes (HTML/PDF/Image)

```typescript
export async function POST(request: NextRequest) {
  const metricsBuilder = new MetricsBuilder()
  
  try {
    // Set identifiers
    metricsBuilder.setMenuId(menuId).setUserId(user.id)
    
    // Track calculation
    metricsBuilder.markCalculationStart()
    const layoutData = transformExtractionToLayout(extraction, menuName)
    const characteristics = analyzeMenuCharacteristics(layoutData)
    metricsBuilder.setMenuCharacteristics(characteristics)
    const preset = selectLayoutPreset(characteristics, context)
    metricsBuilder.setLayoutSelection(preset.id, context)
    metricsBuilder.markCalculationEnd()
    
    // Track rendering
    metricsBuilder.markRenderStart()
    const componentHTML = renderToString(createElement(Component, props))
    metricsBuilder.markRenderEnd()
    
    // Track export
    metricsBuilder.markExportStart()
    const result = await exportToPDF(html, layoutData, options)
    metricsBuilder.markExportEnd()
    
    // Set export details
    metricsBuilder.setExportDetails('pdf', result.size)
    
    // Build and log metrics
    const metrics = metricsBuilder.build()
    logLayoutMetrics(metrics)
    
    // Validate performance
    const performanceCheck = validatePerformance(metrics)
    if (!performanceCheck.isValid) {
      console.warn('Performance warnings:', performanceCheck.warnings)
    }
    
    return new Response(result.pdfBytes, { headers: { ... } })
  } catch (error) {
    // Handle errors
  }
}
```

## Performance Targets

The `validatePerformance` function checks metrics against these targets:

- **Total time**: <10 seconds (end-to-end pipeline)
- **Calculation time**: <500ms (layout calculation)
- **Render time**: <1 second (component rendering)
- **PDF export**: <5 seconds
- **Image export (PNG/JPG)**: <4 seconds

## Logging and Telemetry

### Development Mode

In development, metrics are logged to the console:

```
[LayoutEngine Metrics] {
  menuId: 'menu-123',
  preset: 'balanced',
  context: 'desktop',
  items: 25,
  imageRatio: '60.0%',
  timings: {
    calculation: '100ms',
    render: '200ms',
    export: '300ms',
    total: '600ms'
  },
  memory: '128.5MB',
  exportFormat: 'pdf',
  exportSize: '48.8KB'
}
```

### Production Mode

In production, integrate with your monitoring service by uncommenting the relevant section in `logLayoutMetrics`:

```typescript
// Vercel Analytics
if (typeof window !== 'undefined' && window.va) {
  window.va('track', 'layout_generated', {
    preset: metrics.selectedPreset,
    context: metrics.outputContext,
    totalTime: metrics.totalTime,
    items: metrics.totalItems
  })
}

// Custom telemetry endpoint
if (process.env.TELEMETRY_ENDPOINT) {
  fetch(process.env.TELEMETRY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics)
  }).catch(err => console.error('Failed to send metrics:', err))
}

// DataDog / New Relic / etc.
if (typeof DD_RUM !== 'undefined') {
  DD_RUM.addAction('layout_generated', metrics)
}
```

## Future ML Dataset

The metrics collected include all data needed for future ML-based layout suggestions:

- Menu characteristics (section count, items, image ratio, name length)
- Selected preset and output context
- Performance metrics
- User ID for personalization

This dataset can be used to train models that predict optimal presets based on menu characteristics and user preferences.

## Memory Usage Tracking

Memory usage is automatically captured on Node.js:

```typescript
const usage = getMemoryUsage() // Returns MB or undefined
```

The `MetricsBuilder` automatically captures memory usage when building metrics if not explicitly set.

## Error Handling

In error handlers, you can still access metrics:

```typescript
catch (error) {
  if (error instanceof LayoutEngineError) {
    logLayoutError(error, {
      endpoint: '/api/templates/generate',
      duration: metricsBuilder.build().totalTime
    })
  }
}
```

Note: Calling `build()` multiple times is safe - it returns the same metrics object.
