/**
 * GridMenu Template Engine - Configuration Constants
 * 
 * This module defines global configuration for the template engine including:
 * - Default limits for items and repeats
 * - Page size specifications for A4 portrait and landscape
 * - Cache settings
 */

// ============================================================================
// Template Engine Configuration
// ============================================================================

export const TEMPLATE_ENGINE_CONFIG = {
  /**
   * Default hard maximum number of items per menu
   * Templates can override this with their own hardMaxItems
   */
  hardMaxItemsDefault: 150,

  /**
   * Default maximum number of repeat patterns
   * Templates can override this with their own maxRepeats
   */
  maxRepeatsDefault: 10,

  /**
   * Enable layout caching
   */
  cacheEnabled: true,

  /**
   * Cache time-to-live in milliseconds (1 hour)
   */
  cacheTTL: 3600000,
} as const

// ============================================================================
// Page Size Specifications
// ============================================================================

export const PAGE_SIZES = {
  A4_PORTRAIT: {
    width: '210mm',
    height: '297mm',
    widthPx: 794,
    heightPx: 1123
  },
  A4_LANDSCAPE: {
    width: '297mm',
    height: '210mm',
    widthPx: 1123,
    heightPx: 794
  }
} as const

// ============================================================================
// Type Exports
// ============================================================================

export type PageSizeKey = keyof typeof PAGE_SIZES
export type PageSize = typeof PAGE_SIZES[PageSizeKey]
