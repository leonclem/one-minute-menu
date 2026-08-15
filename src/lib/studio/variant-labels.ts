import type { StudioImageRecord } from '@/lib/studio/types'

/** Short gallery labels: OG, V1, V2… based on chronological generated order. */
export function studioVariantShortLabel(
  image: StudioImageRecord,
  variants: StudioImageRecord[],
): string {
  if (image.role === 'source') return 'OG'
  const generatedIndex = variants
    .filter((item) => item.role === 'generated')
    .findIndex((item) => item.id === image.id)
  return generatedIndex >= 0 ? `V${generatedIndex + 1}` : 'Variant'
}

/** Spoken gallery labels: Original, Variant 1, Variant 2… */
export function studioVariantSpokenLabel(
  image: StudioImageRecord,
  variants: StudioImageRecord[],
): string {
  if (image.role === 'source') return 'Original'
  const short = studioVariantShortLabel(image, variants)
  if (!short.startsWith('V')) return short
  return `Variant ${short.slice(1)}`
}

/** Parent this image was generated from, using the same OG/Vn labels. */
export function parentVariantShortLabel(
  image: StudioImageRecord,
  variants: StudioImageRecord[],
): string | null {
  if (!image.source_image_id) return null
  const parent = variants.find((item) => item.id === image.source_image_id)
  if (!parent) return null
  return studioVariantShortLabel(parent, variants)
}
