/**
 * Layout Selection Engine
 * 
 * Implements heuristic-based layout preset selection based on menu characteristics
 * and output context. Uses deterministic rules without external AI dependencies.
 * 
 * Selection Rules:
 * 1. High image ratio (>70%) → Image Forward
 * 2. Low image ratio (<20%) → Dense Catalog or Text-only
 * 3. Many items (>50) with short names → Dense Catalog
 * 4. Few items (<15) with images → Feature Band
 * 5. Default → Balanced
 */

import type { MenuCharacteristics } from './data-transformer'
import type { LayoutPreset, OutputContext } from './types'
import { LAYOUT_PRESETS } from './presets'

// ============================================================================
// Layout Selection Rules
// ============================================================================

/**
 * Thresholds for layout selection heuristics
 */
const SELECTION_THRESHOLDS = {
  HIGH_IMAGE_RATIO: 70, // Percentage
  LOW_IMAGE_RATIO: 20, // Percentage
  MANY_ITEMS: 50, // Item count
  FEW_ITEMS: 15, // Item count
  SHORT_NAME_LENGTH: 20, // Characters
  MEDIUM_IMAGE_RATIO: 40 // Percentage
} as const

/**
 * Select optimal layout preset based on menu characteristics and output context
 * 
 * This function applies deterministic heuristics to choose the best preset
 * for a given menu. The selection is based on:
 * - Image availability ratio
 * - Total item count
 * - Average item name length
 * - Output context (mobile, tablet, desktop, print)
 * 
 * @param characteristics - Analyzed menu characteristics
 * @param context - Target output context
 * @returns Selected layout preset
 */
export function selectLayoutPreset(
  characteristics: MenuCharacteristics,
  context: OutputContext
): LayoutPreset {
  // Rule 1: High image ratio (>70%) → Image Forward
  // Best for image-rich menus where visual content is the primary focus
  if (characteristics.imageRatio > SELECTION_THRESHOLDS.HIGH_IMAGE_RATIO) {
    return LAYOUT_PRESETS['image-forward']
  }

  // Rule 2: Low image ratio (<20%) → Dense Catalog or Text-only
  // Best for text-heavy menus with minimal or no images
  if (characteristics.imageRatio < SELECTION_THRESHOLDS.LOW_IMAGE_RATIO) {
    // If almost no images, use text-only layout
    if (characteristics.imageRatio === 0) {
      return LAYOUT_PRESETS['text-only']
    }
    // Otherwise use dense catalog for compact presentation
    return LAYOUT_PRESETS['dense-catalog']
  }

  // Rule 3: Many items (>50) with short names → Dense Catalog
  // Best for large menus that need to fit many items efficiently
  if (
    characteristics.totalItems > SELECTION_THRESHOLDS.MANY_ITEMS &&
    characteristics.avgNameLength < SELECTION_THRESHOLDS.SHORT_NAME_LENGTH
  ) {
    return LAYOUT_PRESETS['dense-catalog']
  }

  // Rule 4: Few items (<15) with images → Feature Band
  // Best for small, curated menus where each item should be highlighted
  if (
    characteristics.totalItems < SELECTION_THRESHOLDS.FEW_ITEMS &&
    characteristics.imageRatio > SELECTION_THRESHOLDS.MEDIUM_IMAGE_RATIO
  ) {
    return LAYOUT_PRESETS['feature-band']
  }

  // Default: Balanced layout
  // Works well for most menu types with mixed content
  return LAYOUT_PRESETS['balanced']
}

/**
 * Select layout preset with context-specific adjustments
 * 
 * This function extends the base selection logic with output context
 * considerations. For example, print context may prefer denser layouts.
 * 
 * @param characteristics - Analyzed menu characteristics
 * @param context - Target output context
 * @returns Selected layout preset
 */
export function selectLayoutPresetWithContext(
  characteristics: MenuCharacteristics,
  context: OutputContext
): LayoutPreset {
  // Get base preset selection
  const basePreset = selectLayoutPreset(characteristics, context)

  // Context-specific adjustments
  switch (context) {
    case 'print':
      // For print, prefer denser layouts to fit more content per page
      if (basePreset.id === 'feature-band' && characteristics.totalItems > 10) {
        return LAYOUT_PRESETS['balanced']
      }
      break

    case 'mobile':
      // For mobile, avoid feature-band if there are many items
      if (basePreset.id === 'feature-band' && characteristics.totalItems > 12) {
        return LAYOUT_PRESETS['balanced']
      }
      break

    case 'tablet':
    case 'desktop':
      // No specific adjustments for tablet/desktop
      break
  }

  return basePreset
}

// ============================================================================
// Preset Scoring (for future ML-based selection)
// ============================================================================

/**
 * Score a preset for a given menu profile
 * 
 * This function calculates a numeric score indicating how well a preset
 * matches the menu characteristics. Higher scores indicate better matches.
 * 
 * This is a foundation for future ML-based layout selection where we can
 * train models on user preferences and satisfaction metrics.
 * 
 * @param preset - Layout preset to score
 * @param characteristics - Menu characteristics
 * @returns Score from 0-100 (higher is better)
 */
export function scorePreset(
  preset: LayoutPreset,
  characteristics: MenuCharacteristics
): number {
  let score = 50 // Base score

  // Image Forward scoring
  if (preset.id === 'image-forward') {
    // Bonus for high image ratio
    if (characteristics.imageRatio > 70) score += 30
    else if (characteristics.imageRatio > 50) score += 15
    else if (characteristics.imageRatio < 30) score -= 20
  }

  // Dense Catalog scoring
  if (preset.id === 'dense-catalog') {
    // Bonus for many items
    if (characteristics.totalItems > 50) score += 25
    else if (characteristics.totalItems > 30) score += 15
    
    // Bonus for short names
    if (characteristics.avgNameLength < 20) score += 15
    
    // Penalty for high image ratio
    if (characteristics.imageRatio > 60) score -= 15
  }

  // Feature Band scoring
  if (preset.id === 'feature-band') {
    // Bonus for few items
    if (characteristics.totalItems < 15) score += 30
    else if (characteristics.totalItems < 25) score += 10
    else score -= 20
    
    // Bonus for images
    if (characteristics.imageRatio > 40) score += 15
  }

  // Text Only scoring
  if (preset.id === 'text-only') {
    // Bonus for no images
    if (characteristics.imageRatio === 0) score += 40
    else if (characteristics.imageRatio < 10) score += 20
    else score -= 30
  }

  // Balanced scoring (always decent, never extreme)
  if (preset.id === 'balanced') {
    // Balanced gets a moderate bonus for mixed content
    if (characteristics.imageRatio >= 30 && characteristics.imageRatio <= 70) {
      score += 20
    }
    if (characteristics.totalItems >= 15 && characteristics.totalItems <= 50) {
      score += 15
    }
  }

  // Clamp score to 0-100 range
  return Math.max(0, Math.min(100, score))
}

/**
 * Get all presets ranked by score for a menu profile
 * 
 * @param characteristics - Menu characteristics
 * @returns Array of presets with scores, sorted by score (descending)
 */
export function rankPresets(
  characteristics: MenuCharacteristics
): Array<{ preset: LayoutPreset; score: number }> {
  const presets = Object.values(LAYOUT_PRESETS)
  
  const scored = presets.map(preset => ({
    preset,
    score: scorePreset(preset, characteristics)
  }))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored
}

// ============================================================================
// Selection Explanation (for debugging and UI)
// ============================================================================

/**
 * Get human-readable explanation for why a preset was selected
 * 
 * @param preset - Selected preset
 * @param characteristics - Menu characteristics
 * @returns Explanation string
 */
export function explainPresetSelection(
  preset: LayoutPreset,
  characteristics: MenuCharacteristics
): string {
  const reasons: string[] = []

  // Analyze why this preset was selected
  if (preset.id === 'image-forward') {
    if (characteristics.imageRatio > 70) {
      reasons.push(`High image ratio (${characteristics.imageRatio.toFixed(0)}%)`)
    }
    reasons.push('Emphasizes visual content')
  }

  if (preset.id === 'dense-catalog') {
    if (characteristics.totalItems > 50) {
      reasons.push(`Large menu (${characteristics.totalItems} items)`)
    }
    if (characteristics.avgNameLength < 20) {
      reasons.push('Short item names')
    }
    if (characteristics.imageRatio < 20) {
      reasons.push(`Low image ratio (${characteristics.imageRatio.toFixed(0)}%)`)
    }
    reasons.push('Maximizes content density')
  }

  if (preset.id === 'feature-band') {
    if (characteristics.totalItems < 15) {
      reasons.push(`Small menu (${characteristics.totalItems} items)`)
    }
    if (characteristics.imageRatio > 40) {
      reasons.push(`Good image coverage (${characteristics.imageRatio.toFixed(0)}%)`)
    }
    reasons.push('Highlights premium items')
  }

  if (preset.id === 'text-only') {
    if (characteristics.imageRatio === 0) {
      reasons.push('No images available')
    } else {
      reasons.push(`Very low image ratio (${characteristics.imageRatio.toFixed(0)}%)`)
    }
    reasons.push('Traditional text-based layout')
  }

  if (preset.id === 'balanced') {
    reasons.push('Versatile layout for mixed content')
    if (characteristics.imageRatio >= 30 && characteristics.imageRatio <= 70) {
      reasons.push(`Moderate image ratio (${characteristics.imageRatio.toFixed(0)}%)`)
    }
    if (characteristics.totalItems >= 15 && characteristics.totalItems <= 50) {
      reasons.push(`Medium-sized menu (${characteristics.totalItems} items)`)
    }
  }

  return reasons.join('. ')
}

/**
 * Get selection metadata for telemetry and debugging
 * 
 * @param preset - Selected preset
 * @param characteristics - Menu characteristics
 * @param context - Output context
 * @returns Selection metadata object
 */
export interface SelectionMetadata {
  presetId: string
  presetName: string
  presetFamily: string
  score: number
  characteristics: MenuCharacteristics
  context: OutputContext
  explanation: string
  timestamp: Date
}

export function getSelectionMetadata(
  preset: LayoutPreset,
  characteristics: MenuCharacteristics,
  context: OutputContext
): SelectionMetadata {
  return {
    presetId: preset.id,
    presetName: preset.name,
    presetFamily: preset.family,
    score: scorePreset(preset, characteristics),
    characteristics,
    context,
    explanation: explainPresetSelection(preset, characteristics),
    timestamp: new Date()
  }
}

// ============================================================================
// Validation and Utilities
// ============================================================================

/**
 * Validate that a preset is appropriate for the given characteristics
 * 
 * @param preset - Preset to validate
 * @param characteristics - Menu characteristics
 * @returns Array of warning messages (empty if valid)
 */
export function validatePresetSelection(
  preset: LayoutPreset,
  characteristics: MenuCharacteristics
): string[] {
  const warnings: string[] = []

  // Check for potential issues
  if (preset.id === 'image-forward' && characteristics.imageRatio < 30) {
    warnings.push(
      `Image Forward preset selected but only ${characteristics.imageRatio.toFixed(0)}% of items have images`
    )
  }

  if (preset.id === 'text-only' && characteristics.imageRatio > 20) {
    warnings.push(
      `Text Only preset selected but ${characteristics.imageRatio.toFixed(0)}% of items have images`
    )
  }

  if (preset.id === 'feature-band' && characteristics.totalItems > 25) {
    warnings.push(
      `Feature Band preset selected but menu has ${characteristics.totalItems} items (works best with <15)`
    )
  }

  if (preset.id === 'dense-catalog' && characteristics.avgNameLength > 40) {
    warnings.push(
      `Dense Catalog preset selected but average name length is ${characteristics.avgNameLength.toFixed(0)} chars (may cause text overflow)`
    )
  }

  return warnings
}

/**
 * Check if automatic selection should be overridden
 * 
 * This function can be used to detect cases where manual preset selection
 * might be preferable to automatic selection.
 * 
 * @param characteristics - Menu characteristics
 * @returns True if manual selection is recommended
 */
export function shouldRecommendManualSelection(
  characteristics: MenuCharacteristics
): boolean {
  // Recommend manual selection for edge cases
  
  // Very small menus (might want custom layout)
  if (characteristics.totalItems < 5) return true
  
  // Very large menus (might need special handling)
  if (characteristics.totalItems > 100) return true
  
  // Unusual image ratios (neither high nor low)
  if (characteristics.imageRatio > 20 && characteristics.imageRatio < 30) return true
  if (characteristics.imageRatio > 70 && characteristics.imageRatio < 80) return true
  
  // Very long item names (might need special layout)
  if (characteristics.avgNameLength > 50) return true
  
  return false
}
