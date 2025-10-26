/**
 * Responsive Breakpoint Configurations for Dynamic Menu Layout Engine
 * 
 * This module defines breakpoint configurations for responsive grid layouts.
 * Breakpoints determine how many columns to use based on viewport width.
 * 
 * Breakpoint Strategy:
 * - Mobile: 2-3 columns for small screens
 * - Tablet: 3-4 columns for medium screens
 * - Desktop: 4-6 columns for large screens
 * - Print: 4-8 columns for A4 paper
 */

import type { Breakpoint, OutputContext } from './types'
import { BREAKPOINTS as BREAKPOINT_WIDTHS } from './design-tokens'

// ============================================================================
// Breakpoint Definitions
// ============================================================================

/**
 * Mobile breakpoint configuration
 * Optimized for phones and small devices
 */
const MOBILE_BREAKPOINT: Breakpoint = {
  name: 'mobile',
  minWidth: BREAKPOINT_WIDTHS.mobile.min,
  maxWidth: BREAKPOINT_WIDTHS.mobile.max,
  columns: 2 // Default 2 columns for mobile
}

/**
 * Tablet breakpoint configuration
 * Optimized for tablets and small laptops
 */
const TABLET_BREAKPOINT: Breakpoint = {
  name: 'tablet',
  minWidth: BREAKPOINT_WIDTHS.tablet.min,
  maxWidth: BREAKPOINT_WIDTHS.tablet.max,
  columns: 3 // Default 3 columns for tablet
}

/**
 * Desktop breakpoint configuration
 * Optimized for desktop monitors and large screens
 */
const DESKTOP_BREAKPOINT: Breakpoint = {
  name: 'desktop',
  minWidth: BREAKPOINT_WIDTHS.desktop.min,
  maxWidth: BREAKPOINT_WIDTHS.desktop.max,
  columns: 4 // Default 4 columns for desktop
}

/**
 * Print breakpoint configuration
 * Optimized for A4 paper and PDF export
 */
const PRINT_BREAKPOINT: Breakpoint = {
  name: 'print',
  minWidth: BREAKPOINT_WIDTHS.print.min,
  maxWidth: BREAKPOINT_WIDTHS.print.max,
  columns: 5 // Default 5 columns for print
}

// ============================================================================
// Breakpoint Registry
// ============================================================================

/**
 * Array of all breakpoints in ascending order by minWidth
 */
export const BREAKPOINTS: Breakpoint[] = [
  MOBILE_BREAKPOINT,
  TABLET_BREAKPOINT,
  DESKTOP_BREAKPOINT,
  PRINT_BREAKPOINT
]

/**
 * Breakpoint lookup by name
 */
export const BREAKPOINT_MAP: Record<OutputContext, Breakpoint> = {
  mobile: MOBILE_BREAKPOINT,
  tablet: TABLET_BREAKPOINT,
  desktop: DESKTOP_BREAKPOINT,
  print: PRINT_BREAKPOINT
}

// ============================================================================
// Breakpoint Detection Functions
// ============================================================================

/**
 * Determine the current breakpoint based on viewport width
 * @param width - Viewport width in pixels
 * @returns Output context name
 */
export function getBreakpointFromWidth(width: number): OutputContext {
  // Check breakpoints in reverse order (largest to smallest)
  for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
    const breakpoint = BREAKPOINTS[i]
    if (width >= breakpoint.minWidth) {
      // Check if width is within max width (if defined)
      if (breakpoint.maxWidth === undefined || width <= breakpoint.maxWidth) {
        return breakpoint.name
      }
    }
  }
  
  // Fallback to mobile if no match (shouldn't happen)
  return 'mobile'
}

/**
 * Get breakpoint configuration by name
 * @param context - Output context name
 * @returns Breakpoint configuration
 */
export function getBreakpoint(context: OutputContext): Breakpoint {
  return BREAKPOINT_MAP[context]
}

/**
 * Get the column count for a specific breakpoint
 * @param context - Output context name
 * @returns Number of columns
 */
export function getColumnsForBreakpoint(context: OutputContext): number {
  return BREAKPOINT_MAP[context].columns
}

/**
 * Check if a width falls within a specific breakpoint
 * @param width - Viewport width in pixels
 * @param context - Output context to check
 * @returns True if width is within the breakpoint range
 */
export function isWidthInBreakpoint(width: number, context: OutputContext): boolean {
  const breakpoint = BREAKPOINT_MAP[context]
  const withinMin = width >= breakpoint.minWidth
  const withinMax = breakpoint.maxWidth === undefined || width <= breakpoint.maxWidth
  return withinMin && withinMax
}

/**
 * Get the next larger breakpoint
 * @param context - Current output context
 * @returns Next breakpoint or undefined if already at largest
 */
export function getNextBreakpoint(context: OutputContext): Breakpoint | undefined {
  const currentIndex = BREAKPOINTS.findIndex(bp => bp.name === context)
  if (currentIndex === -1 || currentIndex === BREAKPOINTS.length - 1) {
    return undefined
  }
  return BREAKPOINTS[currentIndex + 1]
}

/**
 * Get the previous smaller breakpoint
 * @param context - Current output context
 * @returns Previous breakpoint or undefined if already at smallest
 */
export function getPreviousBreakpoint(context: OutputContext): Breakpoint | undefined {
  const currentIndex = BREAKPOINTS.findIndex(bp => bp.name === context)
  if (currentIndex <= 0) {
    return undefined
  }
  return BREAKPOINTS[currentIndex - 1]
}

// ============================================================================
// Responsive Grid Helpers
// ============================================================================

/**
 * Calculate the number of columns for a given width and preset
 * This function can be used to override preset defaults based on actual width
 * 
 * @param width - Viewport width in pixels
 * @param presetColumns - Column configuration from preset
 * @returns Number of columns to use
 */
export function calculateResponsiveColumns(
  width: number,
  presetColumns: { mobile: number; tablet: number; desktop: number; print: number }
): number {
  const context = getBreakpointFromWidth(width)
  return presetColumns[context]
}

/**
 * Get Tailwind CSS classes for responsive grid columns
 * @param presetColumns - Column configuration from preset
 * @returns Tailwind class string
 */
export function getResponsiveGridClasses(
  presetColumns: { mobile: number; tablet: number; desktop: number; print: number }
): string {
  const classes: string[] = []
  
  // Mobile (default, no prefix)
  classes.push(`grid-cols-${presetColumns.mobile}`)
  
  // Tablet (md: prefix)
  classes.push(`md:grid-cols-${presetColumns.tablet}`)
  
  // Desktop (lg: prefix)
  classes.push(`lg:grid-cols-${presetColumns.desktop}`)
  
  // Print (print: prefix)
  classes.push(`print:grid-cols-${presetColumns.print}`)
  
  return classes.join(' ')
}

/**
 * Get the minimum width for a specific breakpoint
 * @param context - Output context name
 * @returns Minimum width in pixels
 */
export function getBreakpointMinWidth(context: OutputContext): number {
  return BREAKPOINT_MAP[context].minWidth
}

/**
 * Get the maximum width for a specific breakpoint
 * @param context - Output context name
 * @returns Maximum width in pixels or undefined if no max
 */
export function getBreakpointMaxWidth(context: OutputContext): number | undefined {
  return BREAKPOINT_MAP[context].maxWidth
}

// ============================================================================
// Media Query Helpers
// ============================================================================

/**
 * Generate CSS media query string for a breakpoint
 * @param context - Output context name
 * @returns CSS media query string
 */
export function getMediaQuery(context: OutputContext): string {
  const breakpoint = BREAKPOINT_MAP[context]
  
  if (breakpoint.maxWidth === undefined) {
    // No max width (largest breakpoint)
    return `@media (min-width: ${breakpoint.minWidth}px)`
  }
  
  // Has both min and max width
  return `@media (min-width: ${breakpoint.minWidth}px) and (max-width: ${breakpoint.maxWidth}px)`
}

/**
 * Generate print media query string
 * @returns CSS print media query
 */
export function getPrintMediaQuery(): string {
  return '@media print'
}

/**
 * Check if the current environment is print context
 * (useful for server-side rendering)
 * @returns True if print context
 */
export function isPrintContext(): boolean {
  // This is a placeholder for server-side detection
  // In browser, you would check window.matchMedia('print')
  return false
}

// ============================================================================
// Breakpoint Utilities
// ============================================================================

/**
 * Get all breakpoint names as an array
 * @returns Array of output context names
 */
export function getAllBreakpointNames(): OutputContext[] {
  return BREAKPOINTS.map(bp => bp.name)
}

/**
 * Get breakpoint width ranges as a human-readable string
 * @param context - Output context name
 * @returns Human-readable width range (e.g., "768px - 1023px")
 */
export function getBreakpointRangeString(context: OutputContext): string {
  const breakpoint = BREAKPOINT_MAP[context]
  
  if (breakpoint.maxWidth === undefined) {
    return `${breakpoint.minWidth}px+`
  }
  
  return `${breakpoint.minWidth}px - ${breakpoint.maxWidth}px`
}

/**
 * Get recommended column count range for a breakpoint
 * Based on requirements (mobile: 2-3, tablet: 3-4, desktop: 4-6, print: 4-8)
 * 
 * @param context - Output context name
 * @returns Object with min and max recommended columns
 */
export function getRecommendedColumnRange(context: OutputContext): { min: number; max: number } {
  const ranges: Record<OutputContext, { min: number; max: number }> = {
    mobile: { min: 2, max: 3 },
    tablet: { min: 3, max: 4 },
    desktop: { min: 4, max: 6 },
    print: { min: 4, max: 8 }
  }
  return ranges[context]
}

/**
 * Validate that column counts are within recommended ranges
 * @param presetColumns - Column configuration to validate
 * @returns True if all column counts are within recommended ranges
 */
export function validateColumnCounts(
  presetColumns: { mobile: number; tablet: number; desktop: number; print: number }
): boolean {
  const contexts: OutputContext[] = ['mobile', 'tablet', 'desktop', 'print']
  
  for (const context of contexts) {
    const range = getRecommendedColumnRange(context)
    const columns = presetColumns[context]
    
    if (columns < range.min || columns > range.max) {
      return false
    }
  }
  
  return true
}

/**
 * Get validation warnings for column counts outside recommended ranges
 * @param presetColumns - Column configuration to validate
 * @returns Array of warning messages (empty if valid)
 */
export function getColumnCountWarnings(
  presetColumns: { mobile: number; tablet: number; desktop: number; print: number }
): string[] {
  const warnings: string[] = []
  const contexts: OutputContext[] = ['mobile', 'tablet', 'desktop', 'print']
  
  for (const context of contexts) {
    const range = getRecommendedColumnRange(context)
    const columns = presetColumns[context]
    
    if (columns < range.min) {
      warnings.push(
        `${context}: ${columns} columns is below recommended minimum of ${range.min}`
      )
    } else if (columns > range.max) {
      warnings.push(
        `${context}: ${columns} columns exceeds recommended maximum of ${range.max}`
      )
    }
  }
  
  return warnings
}
