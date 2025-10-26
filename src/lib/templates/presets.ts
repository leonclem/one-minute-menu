/**
 * Layout Preset Configurations for Dynamic Menu Layout Engine
 * 
 * This module defines all available layout presets with their grid and tile configurations.
 * Presets are data-driven configurations that can be selected based on menu characteristics.
 * 
 * Preset Families:
 * - Dense Catalog: High-density layouts for menus with many items
 * - Image Forward: Image-heavy layouts that emphasize visual content
 * - Balanced: Versatile layouts that work well for mixed content
 * - Feature Band: Spacious layouts for premium or featured items
 */

import type { LayoutPreset } from './types'
import { GRID_GAPS } from './design-tokens'

// ============================================================================
// Layout Preset Definitions
// ============================================================================

/**
 * Dense Catalog Preset
 * 
 * Optimized for menus with many items and limited images.
 * Uses compact spacing and smaller tiles to fit more content.
 * 
 * Best for:
 * - Large menus (50+ items)
 * - Text-heavy content
 * - Quick-service restaurants
 * - Price-focused menus
 */
const DENSE_CATALOG: LayoutPreset = {
  id: 'dense-catalog',
  name: 'Dense Catalog',
  family: 'dense',
  gridConfig: {
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4,
      print: 6
    },
    gap: GRID_GAPS.sm, // gap-2 (8px)
    sectionSpacing: 'mb-6' // 24px bottom margin
  },
  tileConfig: {
    aspectRatio: '1/1', // Square tiles
    borderRadius: 'rounded-md', // Medium rounded corners
    padding: 'p-3', // 12px padding
    textSize: {
      name: 'text-sm',   // 14px
      price: 'text-base', // 16px
      description: 'text-xs' // 12px
    }
  },
  metadataMode: 'overlay'
}

/**
 * Image Forward Preset
 * 
 * Emphasizes visual content with larger image tiles.
 * Uses landscape aspect ratio to showcase food photography.
 * 
 * Best for:
 * - Image-rich menus (70%+ items with images)
 * - Fine dining restaurants
 * - Visual-first presentations
 * - Social media sharing
 */
const IMAGE_FORWARD: LayoutPreset = {
  id: 'image-forward',
  name: 'Image Forward',
  family: 'image-forward',
  gridConfig: {
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4,
      print: 4
    },
    gap: GRID_GAPS.lg, // gap-4 (16px)
    sectionSpacing: 'mb-8' // 32px bottom margin
  },
  tileConfig: {
    aspectRatio: '4/3', // Landscape tiles
    borderRadius: 'rounded-lg', // Large rounded corners
    padding: 'p-4', // 16px padding
    textSize: {
      name: 'text-base',  // 16px
      price: 'text-lg',   // 18px
      description: 'text-sm' // 14px
    }
  },
  metadataMode: 'overlay'
}

/**
 * Balanced Preset
 * 
 * Versatile layout that works well for most menu types.
 * Balances visual appeal with information density.
 * 
 * Best for:
 * - Mixed content (40-70% images)
 * - General-purpose menus
 * - Casual dining restaurants
 * - Default choice when unsure
 */
const BALANCED: LayoutPreset = {
  id: 'balanced',
  name: 'Balanced',
  family: 'balanced',
  gridConfig: {
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4,
      print: 5
    },
    gap: GRID_GAPS.md, // gap-3 (12px)
    sectionSpacing: 'mb-7' // 28px bottom margin
  },
  tileConfig: {
    aspectRatio: '1/1', // Square tiles
    borderRadius: 'rounded-lg', // Large rounded corners
    padding: 'p-4', // 16px padding
    textSize: {
      name: 'text-base',  // 16px
      price: 'text-lg',   // 18px
      description: 'text-sm' // 14px
    }
  },
  metadataMode: 'overlay'
}

/**
 * Feature Band Preset
 * 
 * Spacious layout that highlights premium or featured items.
 * Uses wide aspect ratio and generous spacing.
 * 
 * Best for:
 * - Small menus (<15 items)
 * - Premium/signature dishes
 * - Tasting menus
 * - Special promotions
 */
const FEATURE_BAND: LayoutPreset = {
  id: 'feature-band',
  name: 'Feature Band',
  family: 'feature-band',
  gridConfig: {
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      print: 3
    },
    gap: GRID_GAPS.xl, // gap-6 (24px)
    sectionSpacing: 'mb-10' // 40px bottom margin
  },
  tileConfig: {
    aspectRatio: '16/9', // Wide landscape tiles
    borderRadius: 'rounded-xl', // Extra large rounded corners
    padding: 'p-6', // 24px padding
    textSize: {
      name: 'text-lg',   // 18px
      price: 'text-xl',  // 20px
      description: 'text-base' // 16px
    }
  },
  metadataMode: 'overlay'
}

/**
 * Text Only Preset
 * 
 * Traditional text-based menu layout without images.
 * Uses line-based structure with aligned prices.
 * 
 * Best for:
 * - Menus with no images (<20% image ratio)
 * - Traditional/classic restaurants
 * - Print-focused menus
 * - Minimalist design aesthetic
 */
const TEXT_ONLY: LayoutPreset = {
  id: 'text-only',
  name: 'Text Only',
  family: 'dense',
  gridConfig: {
    columns: {
      mobile: 1,
      tablet: 1,
      desktop: 1,
      print: 1
    },
    gap: GRID_GAPS.none, // gap-0 (no gap)
    sectionSpacing: 'mb-6' // 24px bottom margin
  },
  tileConfig: {
    aspectRatio: 'auto', // Natural height based on content
    borderRadius: 'rounded-none', // No rounded corners
    padding: 'py-2 px-0', // Vertical padding only
    textSize: {
      name: 'text-base',  // 16px
      price: 'text-base', // 16px
      description: 'text-sm' // 14px
    }
  },
  metadataMode: 'adjacent' // Text next to price, not overlay
}

// ============================================================================
// Preset Registry
// ============================================================================

/**
 * Registry of all available layout presets
 * Keyed by preset ID for easy lookup
 */
export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  'dense-catalog': DENSE_CATALOG,
  'image-forward': IMAGE_FORWARD,
  'balanced': BALANCED,
  'feature-band': FEATURE_BAND,
  'text-only': TEXT_ONLY
}

/**
 * Array of all preset IDs for iteration
 */
export const PRESET_IDS = Object.keys(LAYOUT_PRESETS) as Array<keyof typeof LAYOUT_PRESETS>

/**
 * Default preset to use when no specific selection is made
 */
export const DEFAULT_PRESET_ID = 'balanced'

// ============================================================================
// Preset Lookup Functions
// ============================================================================

/**
 * Get a preset by ID
 * @param id - Preset identifier
 * @returns Layout preset or undefined if not found
 */
export function getPresetById(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS[id]
}

/**
 * Get a preset by ID with fallback to default
 * @param id - Preset identifier
 * @returns Layout preset (never undefined)
 */
export function getPresetByIdOrDefault(id: string): LayoutPreset {
  return LAYOUT_PRESETS[id] ?? LAYOUT_PRESETS[DEFAULT_PRESET_ID]
}

/**
 * Get all presets as an array
 * @returns Array of all layout presets
 */
export function getAllPresets(): LayoutPreset[] {
  return Object.values(LAYOUT_PRESETS)
}

/**
 * Get presets filtered by family
 * @param family - Preset family to filter by
 * @returns Array of presets in the specified family
 */
export function getPresetsByFamily(family: LayoutPreset['family']): LayoutPreset[] {
  return getAllPresets().filter(preset => preset.family === family)
}

/**
 * Check if a preset ID exists
 * @param id - Preset identifier to check
 * @returns True if preset exists
 */
export function isValidPresetId(id: string): boolean {
  return id in LAYOUT_PRESETS
}

// ============================================================================
// Preset Metadata
// ============================================================================

/**
 * Get human-readable description for a preset
 * @param id - Preset identifier
 * @returns Description string
 */
export function getPresetDescription(id: string): string {
  const descriptions: Record<string, string> = {
    'dense-catalog': 'Compact layout for menus with many items. Maximizes content density.',
    'image-forward': 'Visual-first layout that emphasizes food photography and imagery.',
    'balanced': 'Versatile layout that works well for most menu types and content mixes.',
    'feature-band': 'Spacious layout for highlighting premium or featured menu items.',
    'text-only': 'Traditional text-based menu without images. Clean and minimalist.'
  }
  return descriptions[id] ?? 'No description available'
}

/**
 * Get recommended use cases for a preset
 * @param id - Preset identifier
 * @returns Array of use case strings
 */
export function getPresetUseCases(id: string): string[] {
  const useCases: Record<string, string[]> = {
    'dense-catalog': [
      'Large menus (50+ items)',
      'Text-heavy content',
      'Quick-service restaurants',
      'Price-focused menus'
    ],
    'image-forward': [
      'Image-rich menus (70%+ with images)',
      'Fine dining restaurants',
      'Visual-first presentations',
      'Social media sharing'
    ],
    'balanced': [
      'Mixed content (40-70% images)',
      'General-purpose menus',
      'Casual dining restaurants',
      'Default choice when unsure'
    ],
    'feature-band': [
      'Small menus (<15 items)',
      'Premium/signature dishes',
      'Tasting menus',
      'Special promotions'
    ],
    'text-only': [
      'Menus with no images',
      'Traditional/classic restaurants',
      'Print-focused menus',
      'Minimalist design aesthetic'
    ]
  }
  return useCases[id] ?? []
}

// ============================================================================
// Future Extensibility
// ============================================================================

/**
 * Load preset from JSON configuration (future enhancement)
 * 
 * This function is a placeholder for future functionality where presets
 * can be loaded from external JSON files or database records.
 * 
 * @param json - JSON string or object containing preset configuration
 * @returns Parsed layout preset
 */
export function loadPresetFromJSON(json: string | object): LayoutPreset {
  // TODO: Implement JSON parsing and validation
  // This will enable user-defined or dynamically generated presets
  throw new Error('loadPresetFromJSON not yet implemented')
}

/**
 * Export preset to JSON configuration (future enhancement)
 * 
 * @param preset - Layout preset to export
 * @returns JSON string representation
 */
export function exportPresetToJSON(preset: LayoutPreset): string {
  return JSON.stringify(preset, null, 2)
}

/**
 * Validate preset configuration (future enhancement)
 * 
 * @param preset - Preset to validate
 * @returns True if valid, false otherwise
 */
export function validatePreset(preset: LayoutPreset): boolean {
  // TODO: Implement comprehensive validation
  // Check for valid column counts, Tailwind classes, etc.
  return true
}
