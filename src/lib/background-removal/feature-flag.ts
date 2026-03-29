/**
 * Check if the cut-out generation feature is enabled.
 *
 * Feature is enabled by default. Set CUTOUT_GENERATION_DISABLED=true to disable.
 * This mirrors the AI_IMAGE_GENERATION_DISABLED pattern used elsewhere.
 */
export function isCutoutFeatureEnabled(): boolean {
  return process.env.CUTOUT_GENERATION_DISABLED !== 'true'
}
