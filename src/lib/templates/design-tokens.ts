/**
 * Design Tokens for Dynamic Menu Layout Engine
 * 
 * Single source of truth for all visual properties used across HTML, PDF, and image exports.
 * These tokens ensure rendering consistency across all output formats.
 * 
 * Usage:
 * - React components: Use Tailwind classes mapped to these tokens
 * - PDF renderer: Use token values directly for spacing/fonts
 * - Image exporter: Render HTML with token-based styles
 */

// ============================================================================
// Spacing Tokens
// ============================================================================

/**
 * Spacing scale for margins, padding, and gaps
 * Values in rem units for scalability
 */
export const SPACING = {
  xs: '0.5rem',   // 8px at base font size
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem'   // 48px
} as const

/**
 * Spacing scale in pixels for PDF and image rendering
 */
export const SPACING_PX = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48
} as const

// ============================================================================
// Typography Tokens
// ============================================================================

/**
 * Font size scale
 * Values in rem units for scalability
 */
export const FONT_SIZE = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem'  // 36px
} as const

/**
 * Font size scale in pixels for PDF and image rendering
 */
export const FONT_SIZE_PX = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36
} as const

/**
 * Font weight scale
 */
export const FONT_WEIGHT = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700
} as const

/**
 * Line height scale
 */
export const LINE_HEIGHT = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
  loose: 2
} as const

// ============================================================================
// Border Radius Tokens
// ============================================================================

/**
 * Border radius scale for rounded corners
 * Values in rem units
 */
export const BORDER_RADIUS = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px'   // Fully rounded
} as const

/**
 * Border radius scale in pixels for PDF and image rendering
 */
export const BORDER_RADIUS_PX = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999
} as const

// ============================================================================
// Aspect Ratio Tokens
// ============================================================================

/**
 * Common aspect ratios for tile layouts
 */
export const ASPECT_RATIOS = {
  square: '1/1',      // 1:1 ratio
  landscape: '4/3',   // 4:3 ratio
  wide: '16/9',       // 16:9 ratio
  portrait: '3/4',    // 3:4 ratio
  auto: 'auto'        // Natural aspect ratio
} as const

/**
 * Aspect ratio values as decimals for calculations
 */
export const ASPECT_RATIO_VALUES = {
  square: 1,
  landscape: 4 / 3,
  wide: 16 / 9,
  portrait: 3 / 4
} as const

// ============================================================================
// Grid Tokens
// ============================================================================

/**
 * Grid gap sizes (Tailwind class names)
 */
export const GRID_GAPS = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
  '2xl': 'gap-8'
} as const

/**
 * Grid gap sizes in pixels for PDF and image rendering
 */
export const GRID_GAP_PX = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32
} as const

// ============================================================================
// Color Tokens
// ============================================================================

/**
 * Default color palette for filler tiles and backgrounds
 * These can be overridden by theme configuration
 */
export const DEFAULT_COLORS = {
  primary: '#3b82f6',      // Blue
  secondary: '#8b5cf6',    // Purple
  accent: '#f59e0b',       // Amber
  background: '#ffffff',   // White
  text: '#1f2937',         // Gray-800
  textLight: '#6b7280',    // Gray-500
  border: '#e5e7eb',       // Gray-200
  overlay: 'rgba(0, 0, 0, 0.5)' // Semi-transparent black
} as const

// ============================================================================
// Opacity Tokens
// ============================================================================

/**
 * Opacity values for overlays and backgrounds
 */
export const OPACITY = {
  none: 0,
  light: 0.1,
  medium: 0.5,
  heavy: 0.75,
  full: 1
} as const

// ============================================================================
// Shadow Tokens
// ============================================================================

/**
 * Box shadow definitions for depth
 */
export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
} as const

// ============================================================================
// Print-Specific Tokens
// ============================================================================

/**
 * A4 page dimensions in pixels at 300 DPI
 */
export const A4_DIMENSIONS = {
  portrait: {
    width: 2480,  // 210mm at 300 DPI
    height: 3508  // 297mm at 300 DPI
  },
  landscape: {
    width: 3508,  // 297mm at 300 DPI
    height: 2480  // 210mm at 300 DPI
  }
} as const

/**
 * Print margins in pixels at 300 DPI
 */
export const PRINT_MARGINS = {
  top: 118,     // 10mm
  right: 118,   // 10mm
  bottom: 118,  // 10mm
  left: 118     // 10mm
} as const

// ============================================================================
// Breakpoint Tokens
// ============================================================================

/**
 * Responsive breakpoint widths in pixels
 */
export const BREAKPOINTS = {
  mobile: {
    min: 0,
    max: 767
  },
  tablet: {
    min: 768,
    max: 1023
  },
  desktop: {
    min: 1024,
    max: 1919
  },
  print: {
    min: 1920,
    max: undefined
  }
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert rem value to pixels (assumes 16px base font size)
 */
export function remToPx(rem: string): number {
  const value = parseFloat(rem)
  return value * 16
}

/**
 * Convert pixels to rem (assumes 16px base font size)
 */
export function pxToRem(px: number): string {
  return `${px / 16}rem`
}

/**
 * Get spacing value in pixels
 */
export function getSpacingPx(key: keyof typeof SPACING_PX): number {
  return SPACING_PX[key]
}

/**
 * Get font size value in pixels
 */
export function getFontSizePx(key: keyof typeof FONT_SIZE_PX): number {
  return FONT_SIZE_PX[key]
}

/**
 * Get border radius value in pixels
 */
export function getBorderRadiusPx(key: keyof typeof BORDER_RADIUS_PX): number {
  return BORDER_RADIUS_PX[key]
}

/**
 * Get grid gap value in pixels
 */
export function getGridGapPx(key: keyof typeof GRID_GAP_PX): number {
  return GRID_GAP_PX[key]
}

// ============================================================================
// Type Exports
// ============================================================================

export type SpacingKey = keyof typeof SPACING
export type FontSizeKey = keyof typeof FONT_SIZE
export type BorderRadiusKey = keyof typeof BORDER_RADIUS
export type AspectRatioKey = keyof typeof ASPECT_RATIOS
export type GridGapKey = keyof typeof GRID_GAPS
export type ColorKey = keyof typeof DEFAULT_COLORS
