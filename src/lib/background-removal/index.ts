// Barrel export for background-removal module

// Types & interfaces
export type {
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
  BackgroundRemovalError,
} from './types'

// Provider factory
export { getBackgroundRemovalProvider } from './provider-factory'

// Core service
export { CutoutGenerationService } from './cutout-service'

// Feature flag
export { isCutoutFeatureEnabled } from './feature-flag'

// Render tracking
export { trackRenderUsage } from './render-tracking'
export type { TrackRenderUsageParams } from './render-tracking'

// Background worker
export { processPendingCutouts } from './cutout-worker'
export type { WorkerResult } from './cutout-worker'
