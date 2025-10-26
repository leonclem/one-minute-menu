/**
 * Contrast Validator for Template System
 * 
 * Validates WCAG AA contrast ratios for menu layouts.
 * Integrates with existing color utilities and provides
 * validation warnings for non-compliant combinations.
 */

import { contrastRatio, isWcagAA, ensureTextContrast } from '@/lib/color'
import type { LayoutPreset, TemplateTheme } from './types'

// ============================================================================
// Types
// ============================================================================

export interface ContrastValidationResult {
  isValid: boolean
  ratio: number
  minimumRequired: number
  recommendation?: string
}

export interface LayoutContrastReport {
  overlayContrast: ContrastValidationResult
  fallbackContrast: ContrastValidationResult
  fillerContrast: ContrastValidationResult
  warnings: string[]
}

// ============================================================================
// WCAG Standards
// ============================================================================

const WCAG_AA_NORMAL_TEXT = 4.5
const WCAG_AA_LARGE_TEXT = 3.0
const WCAG_AAA_NORMAL_TEXT = 7.0
const WCAG_AAA_LARGE_TEXT = 4.5

/**
 * Determine if text size qualifies as "large text" per WCAG
 * Large text is 18pt+ (24px+) or 14pt+ (18.66px+) bold
 */
export function isLargeText(fontSize: string, isBold: boolean = false): boolean {
  // Parse Tailwind text size classes
  const sizeMap: Record<string, number> = {
    'text-xs': 12,
    'text-sm': 14,
    'text-base': 16,
    'text-lg': 18,
    'text-xl': 20,
    'text-2xl': 24,
    'text-3xl': 30,
    'text-4xl': 36
  }

  const pixelSize = sizeMap[fontSize] || 16

  if (isBold) {
    return pixelSize >= 18.66
  }

  return pixelSize >= 24
}

/**
 * Get minimum contrast ratio required for WCAG AA compliance
 */
export function getMinimumContrastRatio(fontSize: string, isBold: boolean = false): number {
  return isLargeText(fontSize, isBold) ? WCAG_AA_LARGE_TEXT : WCAG_AA_NORMAL_TEXT
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate contrast ratio for metadata overlay
 * Checks white text on dark gradient background
 */
export function validateOverlayContrast(
  textColor: string = '#ffffff',
  backgroundColor: string = 'rgba(0, 0, 0, 0.8)'
): ContrastValidationResult {
  // Convert rgba to hex for contrast calculation
  // For rgba(0, 0, 0, 0.8), we approximate as #333333
  const bgHex = backgroundColor.includes('rgba')
    ? approximateRgbaToHex(backgroundColor)
    : backgroundColor

  const ratio = contrastRatio(textColor, bgHex)
  const minimumRequired = WCAG_AA_NORMAL_TEXT

  return {
    isValid: ratio >= minimumRequired,
    ratio,
    minimumRequired,
    recommendation: ratio < minimumRequired
      ? `Increase background opacity or use darker gradient. Current ratio: ${ratio.toFixed(2)}, required: ${minimumRequired}`
      : undefined
  }
}

/**
 * Validate contrast for fallback tiles (no image)
 */
export function validateFallbackContrast(
  textColor: string,
  backgroundColor: string,
  fontSize: string,
  isBold: boolean = false
): ContrastValidationResult {
  const ratio = contrastRatio(textColor, backgroundColor)
  const minimumRequired = getMinimumContrastRatio(fontSize, isBold)

  return {
    isValid: ratio >= minimumRequired,
    ratio,
    minimumRequired,
    recommendation: ratio < minimumRequired
      ? `Adjust text or background color. Current ratio: ${ratio.toFixed(2)}, required: ${minimumRequired}. Suggested text color: ${ensureTextContrast(backgroundColor, textColor)}`
      : undefined
  }
}

/**
 * Validate contrast for filler tiles
 */
export function validateFillerContrast(
  textColor: string,
  backgroundColor: string
): ContrastValidationResult {
  const ratio = contrastRatio(textColor, backgroundColor)
  const minimumRequired = WCAG_AA_LARGE_TEXT // Filler tiles typically have large icons

  return {
    isValid: ratio >= minimumRequired,
    ratio,
    minimumRequired,
    recommendation: ratio < minimumRequired
      ? `Adjust filler tile colors. Current ratio: ${ratio.toFixed(2)}, required: ${minimumRequired}`
      : undefined
  }
}

/**
 * Validate all contrast ratios for a layout preset and theme
 */
export function validateLayoutContrast(
  preset: LayoutPreset,
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
): LayoutContrastReport {
  const warnings: string[] = []

  // Default colors
  const textColor = themeColors?.text || '#111827'
  const backgroundColor = themeColors?.background || '#ffffff'
  const secondaryColor = themeColors?.secondary || '#e5e7eb'

  // Validate overlay contrast
  const overlayContrast = validateOverlayContrast()
  if (!overlayContrast.isValid) {
    warnings.push(`Overlay: ${overlayContrast.recommendation}`)
  }

  // Validate fallback tile contrast (name text)
  const fallbackContrast = validateFallbackContrast(
    textColor,
    secondaryColor,
    preset.tileConfig.textSize.name,
    true // Name is typically bold
  )
  if (!fallbackContrast.isValid) {
    warnings.push(`Fallback tiles: ${fallbackContrast.recommendation}`)
  }

  // Validate filler tile contrast
  const fillerContrast = validateFillerContrast(
    themeColors?.accent || '#9ca3af',
    backgroundColor
  )
  if (!fillerContrast.isValid) {
    warnings.push(`Filler tiles: ${fillerContrast.recommendation}`)
  }

  return {
    overlayContrast,
    fallbackContrast,
    fillerContrast,
    warnings
  }
}

/**
 * Check if a specific text/background combination meets WCAG AA
 */
export function meetsWCAGAA(
  textColor: string,
  backgroundColor: string,
  fontSize: string,
  isBold: boolean = false
): boolean {
  const ratio = contrastRatio(textColor, backgroundColor)
  const minimumRequired = getMinimumContrastRatio(fontSize, isBold)
  return ratio >= minimumRequired
}

/**
 * Check if a specific text/background combination meets WCAG AAA
 */
export function meetsWCAGAAA(
  textColor: string,
  backgroundColor: string,
  fontSize: string,
  isBold: boolean = false
): boolean {
  const ratio = contrastRatio(textColor, backgroundColor)
  const minimumRequired = isLargeText(fontSize, isBold)
    ? WCAG_AAA_LARGE_TEXT
    : WCAG_AAA_NORMAL_TEXT
  return ratio >= minimumRequired
}

/**
 * Get suggested text color that meets WCAG AA for given background
 */
export function getSuggestedTextColor(
  backgroundColor: string,
  preferredColor?: string
): string {
  return ensureTextContrast(backgroundColor, preferredColor)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Approximate rgba color to hex for contrast calculation
 * This is a simplified conversion that assumes white background
 */
function approximateRgbaToHex(rgba: string): string {
  // Parse rgba(r, g, b, a)
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/)
  
  if (!match) {
    return '#000000' // Fallback
  }

  const r = parseInt(match[1])
  const g = parseInt(match[2])
  const b = parseInt(match[3])
  const a = match[4] ? parseFloat(match[4]) : 1

  // Blend with white background
  const blendedR = Math.round(r * a + 255 * (1 - a))
  const blendedG = Math.round(g * a + 255 * (1 - a))
  const blendedB = Math.round(b * a + 255 * (1 - a))

  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(blendedR)}${toHex(blendedG)}${toHex(blendedB)}`
}

/**
 * Validate contrast for image overlay with dynamic background
 * This is more complex as it needs to check against actual image colors
 */
export function validateImageOverlayContrast(
  imageColors: string[],
  overlayTextColor: string = '#ffffff',
  overlayGradient: string = 'rgba(0, 0, 0, 0.8)'
): ContrastValidationResult {
  // Get the darkest color from the image (likely at bottom where overlay is)
  const darkestColor = imageColors.reduce((darkest, color) => {
    const ratio1 = contrastRatio(color, '#000000')
    const ratio2 = contrastRatio(darkest, '#000000')
    return ratio1 < ratio2 ? color : darkest
  }, imageColors[0])

  // Blend the darkest image color with the overlay gradient
  const overlayBg = approximateRgbaToHex(overlayGradient)
  
  // Calculate contrast between text and blended background
  const ratio = contrastRatio(overlayTextColor, overlayBg)
  const minimumRequired = WCAG_AA_NORMAL_TEXT

  return {
    isValid: ratio >= minimumRequired,
    ratio,
    minimumRequired,
    recommendation: ratio < minimumRequired
      ? `Increase overlay gradient opacity or use darker gradient for better text contrast over images`
      : undefined
  }
}

/**
 * Batch validate multiple color combinations
 */
export function batchValidateContrast(
  combinations: Array<{
    text: string
    background: string
    fontSize: string
    isBold?: boolean
    label: string
  }>
): Array<ContrastValidationResult & { label: string }> {
  return combinations.map(({ text, background, fontSize, isBold, label }) => ({
    label,
    ...validateFallbackContrast(text, background, fontSize, isBold || false)
  }))
}
