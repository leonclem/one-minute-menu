/**
 * Source-photo aspect rail for Studio uploads.
 *
 * Mutate keeps the source framing (Q6). Gemini only emits a handful of ratios,
 * but phone photos are commonly 4:3, 3:4, 16:9, 9:16, or square — all of those
 * must be accepted. Reject only extreme panoramas that the Workbench cannot
 * show usefully and the model will not preserve.
 */

/** Longer side / shorter side. 16:9 ≈ 1.78; 21:9 ≈ 2.33; 3:1 = 3. */
export const MAX_SOURCE_ASPECT_ELONGATION = 3

export const SOURCE_ASPECT_REJECTION =
  'This photo is too wide or too tall for Studio. Crop it toward a normal photo (square, 4:3, 16:9, or 9:16) and try again.'

export function sourceAspectRejection(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'Could not read this image. Try a different photo.'
  }
  const elongation = Math.max(width, height) / Math.min(width, height)
  if (elongation > MAX_SOURCE_ASPECT_ELONGATION) {
    return SOURCE_ASPECT_REJECTION
  }
  return null
}

export async function readImagePixelSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not read this image. Try a different photo.'))
      image.src = url
    })
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}
