/**
 * Aspect ratios both Studio image models accept on generateContent.
 * Intersection of the Gemini 3.1 Flash Image and Gemini 3 Pro Image tables:
 * https://ai.google.dev/gemini-api/docs/image-generation
 *
 * Extreme Flash-only ratios (1:4, 4:1, 1:8, 8:1) are omitted so a Pro request
 * is never given a ratio that model rejects.
 */
export const STUDIO_ASPECT_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const

export type StudioAspectRatio = (typeof STUDIO_ASPECT_RATIOS)[number]

export function isStudioAspectRatio(value: string): value is StudioAspectRatio {
  return (STUDIO_ASPECT_RATIOS as readonly string[]).includes(value)
}

function ratioValue(label: StudioAspectRatio): number {
  const [width, height] = label.split(':').map(Number)
  return width / height
}

/**
 * Nearest supported output ratio for a source photograph.
 * The model only accepts these labels, so the workbench frame is snapped
 * rather than forwarded as raw pixels.
 */
export function nearestStudioAspectRatio(width: number, height: number): StudioAspectRatio {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive.')
  }
  const target = width / height
  let best: StudioAspectRatio = '1:1'
  let bestError = Number.POSITIVE_INFINITY
  for (const label of STUDIO_ASPECT_RATIOS) {
    const error = Math.abs(ratioValue(label) - target) / target
    if (error < bestError) {
      best = label
      bestError = error
    }
  }
  return best
}
