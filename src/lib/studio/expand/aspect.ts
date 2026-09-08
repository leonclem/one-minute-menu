/** Aspect ratios Flash Image accepts on the Studio mutation path. */
export const FLASH_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '4:5'] as const

export type FlashAspectRatio = (typeof FLASH_ASPECT_RATIOS)[number]

function ratioValue(label: FlashAspectRatio): number {
  const [width, height] = label.split(':').map(Number)
  return width / height
}

/** Nearest Flash aspect ratio for a pixel size. Keeps zoom-out in the source shape. */
export function nearestFlashAspectRatio(width: number, height: number): FlashAspectRatio {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive.')
  }
  const target = width / height
  let best: FlashAspectRatio = '1:1'
  let bestError = Number.POSITIVE_INFINITY
  for (const label of FLASH_ASPECT_RATIOS) {
    const error = Math.abs(ratioValue(label) - target) / target
    if (error < bestError) {
      best = label
      bestError = error
    }
  }
  return best
}
